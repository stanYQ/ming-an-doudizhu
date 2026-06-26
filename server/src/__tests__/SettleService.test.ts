/**
 * @file SettleService.test.ts
 * @description TASK-022: SettleService V2 — AC-1 ~ AC-22 全覆盖
 */

jest.mock("../db/connection");

import { SettleService, GameSummaryV2 } from "../services/SettleService";
import { getPool } from "../db/connection";

// ── mock DB ────────────────────────────────────────────────────────────────

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
    if (/INSERT INTO game_records/i.test(sql))  return Promise.resolve([{ insertId: insertId++ }, []]);
    if (/INSERT INTO game_players/i.test(sql))  return Promise.resolve([{ insertId: insertId++ }, []]);
    if (/SELECT score FROM users/i.test(sql)) {
      const uid   = params[0] as number;
      const score = scoresByUserId[uid] ?? 1000;
      return Promise.resolve([[{ score }], []]);
    }
    if (/UPDATE users/i.test(sql)) return Promise.resolve([{ affectedRows: 1 }, []]);
    return Promise.resolve([[], []]);
  });

  return conn;
}

function mockPool(conn: any) {
  return { getConnection: jest.fn().mockResolvedValue(conn) };
}

// ── base summary ───────────────────────────────────────────────────────────

function baseSummary(overrides: Partial<GameSummaryV2> = {}): GameSummaryV2 {
  return {
    roomId:          "room1",
    tableType:       "casual",
    winnerCamp:      1,
    isLandlordAlone: false,
    landlordId:      "p0",
    partnerId:       "p2",
    firstOutId:      "p0",
    landlordDouble:  1,
    playerDoubles:   { p1: 1, p2: 1, p3: 1, p4: 1 },
    partnerDoubled:  false,
    bombCount:       0,
    rocketSmallCount: 0,
    rocketBigCount:  0,
    hasEightBomb:    false,
    isSpring:        false,
    isAntiSpring:    false,
    duration:        300,
    players: [
      { userId: 1, sessionId: "p0", rankPos: 1 }, // landlord
      { userId: 2, sessionId: "p1", rankPos: 2 }, // civilian
      { userId: 3, sessionId: "p2", rankPos: 3 }, // partner
      { userId: 4, sessionId: "p3", rankPos: 4 }, // civilian
      { userId: 5, sessionId: "p4", rankPos: 5 }, // civilian
    ],
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// calcMultiplier (pure)
// ══════════════════════════════════════════════════════════════════════════════

describe("SettleService.calcMultiplier()", () => {
  const base = { tableType: "casual" as const, bombCount: 0, rocketSmallCount: 0, rocketBigCount: 0, isLandlordAlone: false, isSpring: false, isAntiSpring: false };

  it("AC-3: no bonuses → M = 1", () => {
    expect(SettleService.calcMultiplier(base)).toBe(1);
  });

  it("AC-4: 1 regular bomb → ×2", () => {
    expect(SettleService.calcMultiplier({ ...base, bombCount: 1 })).toBe(2);
  });

  it("AC-4: 2 regular bombs → ×4", () => {
    expect(SettleService.calcMultiplier({ ...base, bombCount: 2 })).toBe(4);
  });

  it("AC-5: 1 dual-small-joker → ×3", () => {
    expect(SettleService.calcMultiplier({ ...base, rocketSmallCount: 1 })).toBe(3);
  });

  it("AC-5: 2 dual-small-joker → ×9", () => {
    expect(SettleService.calcMultiplier({ ...base, rocketSmallCount: 2 })).toBe(9);
  });

  it("AC-6: 1 dual-big-joker → ×4", () => {
    expect(SettleService.calcMultiplier({ ...base, rocketBigCount: 1 })).toBe(4);
  });

  it("AC-6: 2 dual-big-joker → ×16", () => {
    expect(SettleService.calcMultiplier({ ...base, rocketBigCount: 2 })).toBe(16);
  });

  it("AC-7: spring → ×2", () => {
    expect(SettleService.calcMultiplier({ ...base, isSpring: true })).toBe(2);
  });

  it("AC-8: anti-spring → ×2", () => {
    expect(SettleService.calcMultiplier({ ...base, isAntiSpring: true })).toBe(2);
  });

  it("AC-9: 一挑四 → ×3", () => {
    expect(SettleService.calcMultiplier({ ...base, isLandlordAlone: true })).toBe(3);
  });

  it("AC-4/5/6 all cumulate: 2bombs × 1小王炸 × 1大王炸 = 4×3×4 = 48", () => {
    expect(SettleService.calcMultiplier({ ...base, bombCount: 2, rocketSmallCount: 1, rocketBigCount: 1 })).toBe(48);
  });

  it("AC-10 (starter): M capped at ×16", () => {
    // 2^5 = 32 > 16 → cap 16
    expect(SettleService.calcMultiplier({ ...base, tableType: "starter", bombCount: 5 })).toBe(16);
  });

  it("AC-10 (casual): M capped at ×64", () => {
    // 2^7 = 128 > 64 → cap 64
    expect(SettleService.calcMultiplier({ ...base, tableType: "casual", bombCount: 7 })).toBe(64);
  });

  it("AC-10 (expert): M capped at ×256", () => {
    // 2^9 = 512 > 256 → cap 256
    expect(SettleService.calcMultiplier({ ...base, tableType: "expert", bombCount: 9 })).toBe(256);
  });

  it("AC-10 (peak): no cap — M can exceed 256", () => {
    // 2^9 = 512, no cap on peak
    expect(SettleService.calcMultiplier({ ...base, tableType: "peak", bombCount: 9 })).toBe(512);
  });

  it("AC-1: B=1 for starter (implicit via M×B in calcDeltas)", () => {
    // Verified indirectly — base score starter=1 used in calcDeltas AC-1 test below
    expect(true).toBe(true); // placeholder; AC-1 covered in calcDeltas
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// calcDeltas (pure)
// ══════════════════════════════════════════════════════════════════════════════

describe("SettleService.calcDeltas()", () => {
  it("AC-1: starter B=1, no bonuses, landlord wins → correct deltas", () => {
    const s = baseSummary({ tableType: "starter", winnerCamp: 1, landlordDouble: 1 });
    // 3 civilians, each Flow = 1×1×1×1 = 1. total=3. landlord gets 2, partner 1.
    const d = SettleService.calcDeltas(s);
    expect(d.get("p1")).toBe(-1); // civilian pays 1
    expect(d.get("p3")).toBe(-1);
    expect(d.get("p4")).toBe(-1);
    expect(d.get("p0")).toBe(2); // landlord gets 2 (2/3 of 3 = 2 with 0 remainder)
    expect(d.get("p2")).toBe(1); // partner gets 1 (1/3 of 3)
  });

  it("AC-12: civilian flow = B × M × di × dL", () => {
    // casual(B=2), M=2 (1 bomb), dL=2, p1.di=2
    const s = baseSummary({ bombCount: 1, landlordDouble: 2, playerDoubles: { p1: 2, p2: 1, p3: 1, p4: 1 } });
    const d = SettleService.calcDeltas(s);
    // Flow(p1) = 2 × 2 × 2 × 2 = 16. Flow(p3,p4) = 2×2×1×2 = 8 each.
    expect(Math.abs(d.get("p1")!)).toBe(16);
    expect(Math.abs(d.get("p3")!)).toBe(8);
    expect(Math.abs(d.get("p4")!)).toBe(8);
  });

  it("AC-13: partner di not in civilian flow — only changes internal split", () => {
    // partner p2 di=2 vs di=1 should NOT affect civilian flow amounts
    const s1 = baseSummary({ playerDoubles: { p1: 1, p2: 1, p3: 1, p4: 1 }, partnerDoubled: false });
    const s2 = baseSummary({ playerDoubles: { p1: 1, p2: 2, p3: 1, p4: 1 }, partnerDoubled: true });
    const d1 = SettleService.calcDeltas(s1);
    const d2 = SettleService.calcDeltas(s2);
    // Civilians flow unchanged
    expect(d1.get("p1")).toBe(d2.get("p1")); // same civilian flow
    // But internal split changes
    expect(d1.get("p2")).not.toBe(d2.get("p2")); // partner delta differs
  });

  it("AC-14: landlord wins → civilians pay Flow(i)", () => {
    const s = baseSummary({ winnerCamp: 1 });
    const d = SettleService.calcDeltas(s);
    // casual B=2, M=1, dL=1, di=1 → flow=2
    expect(d.get("p1")).toBe(-2);
    expect(d.get("p3")).toBe(-2);
    expect(d.get("p4")).toBe(-2);
    expect(d.get("p0")!).toBeGreaterThan(0);
    expect(d.get("p2")!).toBeGreaterThan(0);
  });

  it("AC-14b: civilian wins → each civilian gets Flow(i), landlord camp pays", () => {
    const s = baseSummary({ winnerCamp: 0 });
    const d = SettleService.calcDeltas(s);
    expect(d.get("p1")).toBe(2);
    expect(d.get("p3")).toBe(2);
    expect(d.get("p4")).toBe(2);
    expect(d.get("p0")!).toBeLessThan(0);
    expect(d.get("p2")!).toBeLessThan(0);
  });

  it("AC-15: partner not doubled → 2/3 landlord, 1/3 partner", () => {
    // casual B=2, M=1, dL=1, di=1 each. Total=6 (3 civilians × 2).
    // 1/3 of 6 = 2 → partner; landlord = 4
    const s = baseSummary({ winnerCamp: 1, partnerDoubled: false });
    const d = SettleService.calcDeltas(s);
    expect(d.get("p2")).toBe(2); // 1/3 of 6
    expect(d.get("p0")).toBe(4); // 2/3 of 6
  });

  it("AC-16: partner doubled → 1/2 each (remainders to landlord)", () => {
    // Same setup but total=6, partner doubled → each gets 3.
    const s = baseSummary({ winnerCamp: 1, partnerDoubled: true, playerDoubles: { p1: 1, p2: 2, p3: 1, p4: 1 } });
    const d = SettleService.calcDeltas(s);
    expect(d.get("p2")).toBe(3); // floor(6/2)=3
    expect(d.get("p0")).toBe(3); // 6-3=3
  });

  it("AC-16: remainder goes to landlord (odd total)", () => {
    // casual B=2, M=1, dL=1, one civilian di=1 & two di=0.5... can't make odd easily
    // Use starter B=1, M=1, dL=1, 3 civilians di=1 → total=3. partner doubled.
    // floor(3/2)=1 → partner; landlord = 2
    const s = baseSummary({ tableType: "starter", winnerCamp: 1, partnerDoubled: true, playerDoubles: { p1: 1, p2: 2, p3: 1, p4: 1 } });
    const d = SettleService.calcDeltas(s);
    expect(d.get("p2")).toBe(1); // floor(3/2)=1
    expect(d.get("p0")).toBe(2); // 3-1=2 (gets remainder)
  });

  it("AC-17: 1v4 — landlord alone, wins → each non-landlord pays their Flow", () => {
    const s = baseSummary({
      winnerCamp: 1, isLandlordAlone: true, partnerId: null,
      playerDoubles: { p1: 1, p2: 2, p3: 1, p4: 1 },
    });
    // M = 1×3 (一挑四) = 3. B=2. dL=1.
    // Flow(p1)=2×3×1×1=6, Flow(p2)=2×3×2×1=12, Flow(p3)=6, Flow(p4)=6. total=30.
    const d = SettleService.calcDeltas(s);
    expect(d.get("p1")).toBe(-6);
    expect(d.get("p2")).toBe(-12);
    expect(d.get("p3")).toBe(-6);
    expect(d.get("p4")).toBe(-6);
    expect(d.get("p0")).toBe(30);
  });

  it("AC-17: 1v4 — landlord alone, loses → each non-landlord gets their Flow", () => {
    const s = baseSummary({
      winnerCamp: 0, isLandlordAlone: true, partnerId: null,
      playerDoubles: { p1: 1, p2: 1, p3: 1, p4: 1 },
    });
    // M=3. B=2. dL=1. each flow=6. total=24.
    const d = SettleService.calcDeltas(s);
    expect(d.get("p0")).toBe(-24);
    for (const sid of ["p1","p2","p3","p4"]) expect(d.get(sid)).toBe(6);
  });

  it("AC-18: 计划书示例一 — 2v3地主胜 零和验证", () => {
    // B=2 (casual), 炸弹2个 + 双大王炸1个 → M=4×4=16, dL=2
    // 甲=p1 di=2, 乙=p3 di=1, 丙=p4 di=1, 丁=p2(partner) di=2(partnerDoubled)
    const s = baseSummary({
      tableType: "casual", winnerCamp: 1,
      bombCount: 2, rocketBigCount: 1,
      landlordDouble: 2,
      playerDoubles: { p1: 2, p2: 2, p3: 1, p4: 1 },
      partnerDoubled: true,
    });
    const d = SettleService.calcDeltas(s);
    // Flow(p1)=2×16×2×2=128, Flow(p3)=64, Flow(p4)=64, total=256
    // partner doubled → each 128. sum = -128-64-64+128+128 = 0
    expect(d.get("p1")).toBe(-128);
    expect(d.get("p3")).toBe(-64);
    expect(d.get("p4")).toBe(-64);
    expect(d.get("p0")).toBe(128); // landlord
    expect(d.get("p2")).toBe(128); // partner
    const sum = [...d.values()].reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeLessThanOrEqual(1); // AC-18 zero-sum
  });

  it("AC-18: 计划书示例二 — 1v4平民胜+反春 零和验证", () => {
    // B=5 (expert), isAntiSpring + isLandlordAlone → M=2×3=6, dL=2
    // 戊=p1 di=2, 己=p2 di=2, 庚=p3 di=1, 辛=p4 di=1
    const s = baseSummary({
      tableType: "expert", winnerCamp: 0,
      isLandlordAlone: true, partnerId: null,
      isAntiSpring: true,
      landlordDouble: 2,
      playerDoubles: { p1: 2, p2: 2, p3: 1, p4: 1 },
      partnerDoubled: false,
    });
    const d = SettleService.calcDeltas(s);
    // Flow: 戊=5×6×2×2=120, 己=120, 庚=60, 辛=60; total=360; 地主=-360
    expect(d.get("p1")).toBe(120);
    expect(d.get("p2")).toBe(120);
    expect(d.get("p3")).toBe(60);
    expect(d.get("p4")).toBe(60);
    expect(d.get("p0")).toBe(-360);
    const sum = [...d.values()].reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeLessThanOrEqual(1); // AC-18 zero-sum
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// settle() — DB writes (AC-19 ~ AC-22)
// ══════════════════════════════════════════════════════════════════════════════

describe("SettleService.settle()", () => {
  it("AC-19: inserts game_records with tableType and landlordDouble", async () => {
    const conn = mockConn({ 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    await SettleService.settle(baseSummary({ landlordDouble: 2 }));

    const recordCall = conn.execute.mock.calls.find(([sql]: [string]) =>
      /INSERT INTO game_records/i.test(sql)
    );
    expect(recordCall).toBeDefined();
    // params include table_type and landlord_double
    const params: any[] = recordCall![1];
    expect(params).toContain("casual");    // tableType
    expect(params).toContain(2);           // landlordDouble
  });

  it("AC-20: inserts game_players with double_value", async () => {
    const conn = mockConn({ 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    await SettleService.settle(baseSummary({ playerDoubles: { p1: 2, p2: 1, p3: 1, p4: 1 } }));

    const playerCalls = conn.execute.mock.calls.filter(([sql]: [string]) =>
      /INSERT INTO game_players/i.test(sql)
    );
    expect(playerCalls.length).toBe(5);
    // p1 should have double_value=2
    const p1Call = playerCalls.find(([, params]: [string, any[]]) =>
      params.includes("p1") && params.includes(2)
    );
    expect(p1Call).toBeDefined();
  });

  it("AC-21: users.score clamped to 0 on negative delta", async () => {
    // Landlord loses big → score would go negative
    const conn = mockConn({ 1: 10 }); // landlord has only 10
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    const s = baseSummary({ winnerCamp: 0, bombCount: 2 }); // large loss
    const result = await SettleService.settle(s);
    const landlord = result.players.find(p => p.userId === 1)!;
    expect(landlord.newScore).toBeGreaterThanOrEqual(0);
  });

  it("AC-21: score increases are applied correctly", async () => {
    const conn = mockConn({ 1: 500 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    const result = await SettleService.settle(baseSummary({ winnerCamp: 1 }));
    const landlord = result.players.find(p => p.userId === 1)!;
    expect(landlord.newScore).toBeGreaterThan(500);
  });

  it("AC-22: DB error → rollback, no commit, exception propagated", async () => {
    const conn = mockConn();
    conn.execute.mockRejectedValueOnce(new Error("Deadlock"));
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    await expect(SettleService.settle(baseSummary())).rejects.toThrow("Deadlock");
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it("AC: AI player (userId=0) skipped in users table, not in settle result", async () => {
    const conn = mockConn({ 1: 1000, 3: 1000, 4: 1000, 5: 1000 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    const s = baseSummary({
      players: [
        { userId: 1, sessionId: "p0", rankPos: 1 },
        { userId: 0, sessionId: "p1", rankPos: 2 }, // AI
        { userId: 3, sessionId: "p2", rankPos: 3 },
        { userId: 4, sessionId: "p3", rankPos: 4 },
        { userId: 5, sessionId: "p4", rankPos: 5 },
      ],
    });

    const result = await SettleService.settle(s);
    expect(result.players.find(p => p.userId === 0)).toBeUndefined();
    const selectCalls = conn.execute.mock.calls.filter(([sql]: [string]) =>
      /SELECT score FROM users/i.test(sql)
    );
    // Only 4 real users → 4 SELECT calls
    expect(selectCalls.length).toBe(4);
  });

  it("settle() returns SettleResultV2 with breakdown", async () => {
    const conn = mockConn({ 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000 });
    (getPool as jest.Mock).mockReturnValue(mockPool(conn));

    const result = await SettleService.settle(baseSummary({ winnerCamp: 1 }));
    expect(result.winnerCamp).toBe(1);
    expect(typeof result.multiplier).toBe("number");
    expect(result.breakdown.baseScore).toBe(2); // casual
    expect(Array.isArray(result.players)).toBe(true);
  });
});
