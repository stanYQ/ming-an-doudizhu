jest.mock("../db/connection");

import { SettleService, GameSummary } from "../services/SettleService";
import { getPool } from "../db/connection";

// ── mock DB helpers ────────────────────────────────────────────────────────

function mockConn(scoresByUserId: Record<number, number> = {}) {
  const conn: any = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit:           jest.fn().mockResolvedValue(undefined),
    rollback:         jest.fn().mockResolvedValue(undefined),
    release:          jest.fn(),
    execute:          jest.fn(),
  };

  let insertId = 100;
  conn.execute.mockImplementation((sql: string, params: any[]) => {
    if (/INSERT INTO game_records/i.test(sql)) {
      return Promise.resolve([{ insertId: insertId++ }, []]);
    }
    if (/INSERT INTO game_players/i.test(sql)) {
      return Promise.resolve([{ insertId: insertId++ }, []]);
    }
    if (/SELECT score FROM users/i.test(sql)) {
      const uid = params[0] as number;
      const score = scoresByUserId[uid] ?? 1000;
      return Promise.resolve([[{ score }], []]);
    }
    if (/UPDATE users/i.test(sql)) {
      return Promise.resolve([{ affectedRows: 1 }, []]);
    }
    return Promise.resolve([[], []]);
  });

  return conn;
}

function mockPool(conn: any) {
  return { getConnection: jest.fn().mockResolvedValue(conn) };
}

// ── base summary ───────────────────────────────────────────────────────────

function baseSummary(overrides: Partial<GameSummary> = {}): GameSummary {
  return {
    roomId:          "room1",
    winnerCamp:      1,
    isLandlordAlone: false,
    landlordId:      "p0",
    partnerId:       "p2",
    firstOutId:      "p0",
    multiplier:      1,
    bombCount:       0,
    rocketCount:     0,
    hasEightBomb:    false,
    duration:        300,
    players: [
      { userId: 1, sessionId: "p0", rankLevel: "bronze",   rankPos: 1 },
      { userId: 2, sessionId: "p1", rankLevel: "bronze",   rankPos: 2 },
      { userId: 3, sessionId: "p2", rankLevel: "bronze",   rankPos: 3 },
      { userId: 4, sessionId: "p3", rankLevel: "bronze",   rankPos: 4 },
      { userId: 5, sessionId: "p4", rankLevel: "bronze",   rankPos: 5 },
    ],
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// calcMultiplier (pure)
// ══════════════════════════════════════════════════════════════════════════════

describe("SettleService.calcMultiplier()", () => {
  it("AC-3/AC-4: base case, standard mode, no bombs → ×1", () => {
    expect(SettleService.calcMultiplier({ isLandlordAlone: false, bombCount: 0, rocketCount: 0, hasEightBomb: false })).toBe(1);
  });

  it("AC-4: 一挑四 mode doubles base multiplier", () => {
    expect(SettleService.calcMultiplier({ isLandlordAlone: true, bombCount: 0, rocketCount: 0, hasEightBomb: false })).toBe(2);
  });

  it("AC-5: one regular bomb → ×2", () => {
    expect(SettleService.calcMultiplier({ isLandlordAlone: false, bombCount: 1, rocketCount: 0, hasEightBomb: false })).toBe(2);
  });

  it("AC-5: two regular bombs → ×4", () => {
    expect(SettleService.calcMultiplier({ isLandlordAlone: false, bombCount: 2, rocketCount: 0, hasEightBomb: false })).toBe(4);
  });

  it("AC-5: one 8-bomb → ×4 (replaces ×2)", () => {
    expect(SettleService.calcMultiplier({ isLandlordAlone: false, bombCount: 1, rocketCount: 0, hasEightBomb: true })).toBe(4);
  });

  it("AC-5: 8-bomb + one regular bomb → 4×2 = ×8", () => {
    expect(SettleService.calcMultiplier({ isLandlordAlone: false, bombCount: 2, rocketCount: 0, hasEightBomb: true })).toBe(8);
  });

  it("AC-6: one rocket → ×3", () => {
    expect(SettleService.calcMultiplier({ isLandlordAlone: false, bombCount: 0, rocketCount: 1, hasEightBomb: false })).toBe(3);
  });

  it("AC-6: two rockets → ×9", () => {
    expect(SettleService.calcMultiplier({ isLandlordAlone: false, bombCount: 0, rocketCount: 2, hasEightBomb: false })).toBe(9);
  });

  it("AC-3: mode × bomb × rocket all cumulate", () => {
    // alone(×2) × 1bomb(×2) × 1rocket(×3) = 12
    expect(SettleService.calcMultiplier({ isLandlordAlone: true, bombCount: 1, rocketCount: 1, hasEightBomb: false })).toBe(12);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// calcDeltas (pure)
// ══════════════════════════════════════════════════════════════════════════════

describe("SettleService.calcDeltas()", () => {
  const BASE = 100; // bronze BaseScore

  it("AC-8: standard, landlord camp wins → landlord +2份, partner +2份, civilians −1份", () => {
    const summary = baseSummary({ winnerCamp: 1 });
    const d = SettleService.calcDeltas(summary);
    expect(d.get("p0")).toBe(Math.round(2 * BASE)); // landlord +2
    expect(d.get("p2")).toBe(Math.round(2 * BASE)); // partner +2
    expect(d.get("p1")).toBe(Math.round(-1 * BASE)); // civilian -1
    expect(d.get("p3")).toBe(Math.round(-1 * BASE));
    expect(d.get("p4")).toBe(Math.round(-1 * BASE));
  });

  it("AC-9: standard, civilian wins → landlord −2份, partner −2份, civilians +4/3份", () => {
    const summary = baseSummary({ winnerCamp: 0 });
    const d = SettleService.calcDeltas(summary);
    expect(d.get("p0")).toBe(Math.round(-2 * BASE));
    expect(d.get("p2")).toBe(Math.round(-2 * BASE));
    expect(d.get("p1")).toBe(Math.round((4 / 3) * BASE));
    expect(d.get("p3")).toBe(Math.round((4 / 3) * BASE));
    expect(d.get("p4")).toBe(Math.round((4 / 3) * BASE));
  });

  it("AC-10: 一挑四, landlord wins → landlord +8份, civilians −2份 each", () => {
    const summary = baseSummary({ winnerCamp: 1, isLandlordAlone: true, partnerId: null });
    const d = SettleService.calcDeltas(summary);
    // multiplier for alone-no-bombs = 2; unit = 100*2 = 200
    expect(d.get("p0")).toBe(Math.round(8 * 100 * 2));
    expect(d.get("p1")).toBe(Math.round(-2 * 100 * 2));
  });

  it("AC-11: 一挑四, landlord loses → landlord −4份, civilians +1份 each", () => {
    const summary = baseSummary({ winnerCamp: 0, isLandlordAlone: true, partnerId: null });
    const d = SettleService.calcDeltas(summary);
    expect(d.get("p0")).toBe(Math.round(-4 * 100 * 2));
    expect(d.get("p1")).toBe(Math.round(1 * 100 * 2));
  });

  it("AC-12: scoreDelta uses round() — civilian 4/3 份 is rounded", () => {
    const summary = baseSummary({ winnerCamp: 0 }); // civilian +4/3 × 100 = 133.33 → 133
    const d = SettleService.calcDeltas(summary);
    expect(d.get("p1")).toBe(133); // round(133.33) = 133
  });

  it("AC-7: winner gets positive delta, loser negative", () => {
    const d = SettleService.calcDeltas(baseSummary({ winnerCamp: 1 }));
    expect(d.get("p0")!).toBeGreaterThan(0);
    expect(d.get("p1")!).toBeLessThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// settle() — DB writes (AC-15 … AC-19)
// ══════════════════════════════════════════════════════════════════════════════

describe("SettleService.settle()", () => {
  it("AC-15/AC-16/AC-17: inserts game_records, game_players, updates users", async () => {
    const conn = mockConn({ 1: 1000, 2: 1200, 3: 1000, 4: 800, 5: 900 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    await SettleService.settle(baseSummary({ winnerCamp: 1 }));

    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO game_records/i),
      expect.any(Array),
    );
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO game_players/i),
      expect.any(Array),
    );
    expect(conn.execute).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE users/i),
      expect.any(Array),
    );
  });

  it("AC-14: new score is clamped to 0 when delta would go negative", async () => {
    const conn = mockConn({ 1: 50 }); // landlord has only 50 score, will go negative on loss
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    const summary = baseSummary({
      winnerCamp: 0, // civilian wins → landlord loses → negative delta
      players: [{ userId: 1, sessionId: "p0", rankLevel: "bronze", rankPos: 1 },
                { userId: 2, sessionId: "p2", rankLevel: "bronze", rankPos: 2 },
                { userId: 3, sessionId: "p1", rankLevel: "bronze", rankPos: 3 },
                { userId: 4, sessionId: "p3", rankLevel: "bronze", rankPos: 4 },
                { userId: 5, sessionId: "p4", rankLevel: "bronze", rankPos: 5 }],
    });

    const result = await SettleService.settle(summary);
    const landlordResult = result.players.find(p => p.userId === 1);
    expect(landlordResult!.newScore).toBeGreaterThanOrEqual(0);
  });

  it("AC-13: rank_level updated after score change", async () => {
    // Player starts at 1150 (bronze), gains delta pushing above 1200 → silver
    const conn = mockConn({ 1: 1150 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    // Force a big positive delta: landlord wins with multiplier
    const summary = baseSummary({
      winnerCamp: 1,
      bombCount: 1, // ×2 multiplier → delta = 2 × 100 × 2 = 400 → 1150+400=1550 → gold
      players: [{ userId: 1, sessionId: "p0", rankLevel: "bronze", rankPos: 1 },
                { userId: 2, sessionId: "p2", rankLevel: "bronze", rankPos: 2 },
                { userId: 3, sessionId: "p1", rankLevel: "bronze", rankPos: 3 },
                { userId: 4, sessionId: "p3", rankLevel: "bronze", rankPos: 4 },
                { userId: 5, sessionId: "p4", rankLevel: "bronze", rankPos: 5 }],
    });

    const result = await SettleService.settle(summary);
    const landlord = result.players.find(p => p.userId === 1)!;
    expect(["silver", "gold"]).toContain(landlord.newRankLevel);
  });

  it("AC-18: DB error rolls back transaction and throws", async () => {
    const conn = mockConn();
    conn.execute.mockRejectedValueOnce(new Error("Deadlock found"));
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    await expect(SettleService.settle(baseSummary())).rejects.toThrow();
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it("AC-19: settle() returns SettleResult with players/multiplier/winnerCamp", async () => {
    const conn = mockConn({ 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    const result = await SettleService.settle(baseSummary({ winnerCamp: 1 }));
    expect(result.winnerCamp).toBe(1);
    expect(typeof result.multiplier).toBe("number");
    expect(Array.isArray(result.players)).toBe(true);
    expect(result.players.every(p => "scoreDelta" in p && "newScore" in p)).toBe(true);
  });

  it("AC: AI player (userId=0) skipped in users update", async () => {
    const conn = mockConn({ 1: 1000 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    const summary = baseSummary({
      players: [
        { userId: 1,  sessionId: "p0", rankLevel: "bronze", rankPos: 1 },
        { userId: 0,  sessionId: "ai_1", rankLevel: "bronze", rankPos: 2 }, // AI
        { userId: 2,  sessionId: "p2", rankLevel: "bronze", rankPos: 3 },
        { userId: 3,  sessionId: "p3", rankLevel: "bronze", rankPos: 4 },
        { userId: 4,  sessionId: "p4", rankLevel: "bronze", rankPos: 5 },
      ],
    });

    const result = await SettleService.settle(summary);
    expect(result.players.find(p => p.userId === 0)).toBeUndefined(); // AI not in results
  });
});
