jest.mock("../cache/redisClient");

import { MatchService, Tier } from "../services/MatchService";
import { getRedis } from "../cache/redisClient";

// ── mock Redis builder ─────────────────────────────────────────────────────

function mockRedis(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const store: Record<string, any> = {};
  const lists: Record<string, string[]> = {};

  const r: any = {
    multi: jest.fn(),
    get:   jest.fn().mockImplementation((key: string) => Promise.resolve(store[key] ?? null)),
    set:   jest.fn().mockImplementation((_key: string, _val: string, ..._args: any[]) => Promise.resolve("OK")),
    exists: jest.fn().mockImplementation((key: string) => Promise.resolve(store[key] ? 1 : 0)),
    lrem:   jest.fn().mockResolvedValue(0),
    rpush:  jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    del:    jest.fn().mockResolvedValue(1),
    ...overrides,
  };

  // Default MULTI chain that records but returns OK
  r.multi.mockReturnValue({
    lrem:   jest.fn().mockReturnThis(),
    rpush:  jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    set:    jest.fn().mockReturnThis(),
    exec:   jest.fn().mockResolvedValue([null, 1, 1, "OK"]),
  });

  return r;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// resolveTier — pure, no Redis
// ══════════════════════════════════════════════════════════════════════════════

describe("MatchService.resolveTier()", () => {
  it("AC-1: bronze → tier_1", () => {
    expect(MatchService.resolveTier("bronze", 0)).toEqual(["tier_1"]);
  });

  it("AC-1: all rank→tier mappings", () => {
    const cases: Array<[string, Tier]> = [
      ["bronze",   "tier_1"],
      ["silver",   "tier_2"],
      ["gold",     "tier_3"],
      ["platinum", "tier_4"],
      ["diamond",  "tier_5"],
      ["master",   "tier_5"],
    ];
    for (const [rank, expectedTier] of cases) {
      const tiers = MatchService.resolveTier(rank, 0);
      expect(tiers).toContain(expectedTier);
    }
  });

  it("AC-2: <15s → only exact tier", () => {
    expect(MatchService.resolveTier("gold", 10)).toEqual(["tier_3"]);
    expect(MatchService.resolveTier("gold", 14)).toEqual(["tier_3"]);
  });

  it("AC-3: >=15s → expands ±1 tier", () => {
    const tiers = MatchService.resolveTier("gold", 15); // gold = tier_3
    expect(tiers).toContain("tier_2");
    expect(tiers).toContain("tier_3");
    expect(tiers).toContain("tier_4");
    expect(tiers).toHaveLength(3);
  });

  it("AC-4: tier_1 (floor) expands only up to tier_2", () => {
    const tiers = MatchService.resolveTier("bronze", 15);
    expect(tiers).toContain("tier_1");
    expect(tiers).toContain("tier_2");
    expect(tiers).not.toContain("tier_0" as Tier); // out-of-range tier does not exist
    expect(tiers.length).toBeLessThanOrEqual(2);
  });

  it("AC-4: tier_5 (ceiling) expands only down to tier_4", () => {
    const tiers = MatchService.resolveTier("diamond", 15);
    expect(tiers).toContain("tier_4");
    expect(tiers).toContain("tier_5");
    expect(tiers.length).toBeLessThanOrEqual(2);
  });

  it("AC-1: unknown rank defaults to tier_1", () => {
    expect(MatchService.resolveTier("unknown_rank", 0)).toEqual(["tier_1"]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// joinQueue (AC-8, AC-10)
// ══════════════════════════════════════════════════════════════════════════════

describe("MatchService.joinQueue()", () => {
  it("AC-8: enqueues via MULTI with lrem+rpush+expire+set", async () => {
    const redis = mockRedis();
    (getRedis as jest.Mock).mockReturnValue(redis);

    await MatchService.joinQueue("sess-1", "bronze");

    expect(redis.multi).toHaveBeenCalled();
    const chain = redis.multi.mock.results[0].value;
    expect(chain.lrem).toHaveBeenCalledWith("match:queue:tier_1", 0, "sess-1");
    expect(chain.rpush).toHaveBeenCalledWith("match:queue:tier_1", "sess-1");
    expect(chain.set).toHaveBeenCalledWith(
      "match:session:sess-1",
      "tier_1",
      "EX",
      expect.any(Number),
    );
    expect(chain.exec).toHaveBeenCalled();
  });

  it("AC-10: stores reverse session→tier key", async () => {
    const redis = mockRedis();
    (getRedis as jest.Mock).mockReturnValue(redis);

    await MatchService.joinQueue("sess-2", "gold"); // gold → tier_3

    const chain = redis.multi.mock.results[0].value;
    expect(chain.set).toHaveBeenCalledWith(
      "match:session:sess-2",
      "tier_3",
      "EX",
      expect.any(Number),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// leaveQueue (AC-9)
// ══════════════════════════════════════════════════════════════════════════════

describe("MatchService.leaveQueue()", () => {
  it("AC-9: removes from queue and deletes session key", async () => {
    const redis = mockRedis({
      get: jest.fn().mockResolvedValue("tier_1"),
      lrem: jest.fn().mockResolvedValue(1),
      del:  jest.fn().mockResolvedValue(1),
    });
    (getRedis as jest.Mock).mockReturnValue(redis);

    await MatchService.leaveQueue("sess-1");

    expect(redis.lrem).toHaveBeenCalledWith("match:queue:tier_1", 0, "sess-1");
    expect(redis.del).toHaveBeenCalledWith("match:session:sess-1");
  });

  it("AC-9: no-op when session key not found", async () => {
    const redis = mockRedis({
      get:  jest.fn().mockResolvedValue(null), // not in Redis
      lrem: jest.fn(),
      del:  jest.fn(),
    });
    (getRedis as jest.Mock).mockReturnValue(redis);

    await expect(MatchService.leaveQueue("unknown-sess")).resolves.not.toThrow();
    expect(redis.lrem).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// generateRoomCode + validateRoomCode (AC-11, AC-12, AC-13)
// ══════════════════════════════════════════════════════════════════════════════

describe("MatchService.generateRoomCode()", () => {
  it("AC-12: returns a 6-digit numeric string", async () => {
    const redis = mockRedis({ set: jest.fn().mockResolvedValue("OK") });
    (getRedis as jest.Mock).mockReturnValue(redis);

    const code = await MatchService.generateRoomCode();
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it("AC-13: stores with 1800s TTL and NX flag", async () => {
    const redis = mockRedis({ set: jest.fn().mockResolvedValue("OK") });
    (getRedis as jest.Mock).mockReturnValue(redis);

    await MatchService.generateRoomCode();

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^room:code:\d{6}$/),
      "1",
      "EX",
      1800,
      "NX",
    );
  });

  it("AC-12: retries on collision (NX returns null first, then OK)", async () => {
    const redis = mockRedis({
      set: jest.fn()
        .mockResolvedValueOnce(null)   // first attempt: key exists (collision)
        .mockResolvedValue("OK"),       // second attempt: OK
    });
    (getRedis as jest.Mock).mockReturnValue(redis);

    const code = await MatchService.generateRoomCode();
    expect(/^\d{6}$/.test(code)).toBe(true);
    expect(redis.set).toHaveBeenCalledTimes(2);
  });
});

describe("MatchService.validateRoomCode()", () => {
  it("AC-11: returns true when code key exists", async () => {
    const redis = mockRedis({ exists: jest.fn().mockResolvedValue(1) });
    (getRedis as jest.Mock).mockReturnValue(redis);

    const valid = await MatchService.validateRoomCode("123456");
    expect(valid).toBe(true);
    expect(redis.exists).toHaveBeenCalledWith("room:code:123456");
  });

  it("AC-11: returns false when code key does not exist", async () => {
    const redis = mockRedis({ exists: jest.fn().mockResolvedValue(0) });
    (getRedis as jest.Mock).mockReturnValue(redis);

    const valid = await MatchService.validateRoomCode("999999");
    expect(valid).toBe(false);
  });
});
