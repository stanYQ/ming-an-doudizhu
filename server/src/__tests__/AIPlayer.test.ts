import { AIPlayer } from "../logic/AIPlayer";
import { encode, encodeJoker } from "../../../shared/CardEncoding";
import type { CardPattern } from "../../../shared/CardPattern";
import { PatternType } from "../../../shared/CardPattern";

// ── helpers ────────────────────────────────────────────────────────────────

/** A minimal non-null CardPattern to represent "last play exists" */
function dummyPattern(): CardPattern {
  return { type: PatternType.SINGLE, cards: [0], primaryValue: 3, length: 1 };
}

// rank 0=3, rank 9=Q, rank 10=K, rank 11=A, rank 12=2
const card3  = encode(0, 0, 0);   // 3♠ deck0 — compareValue=3
const card4  = encode(0, 0, 1);   // 4♠ — compareValue=4
const card2  = encode(0, 0, 12);  // 2♠ — compareValue=15
const smallJ = encodeJoker(0, false); // 小王 — compareValue=16
const bigJ   = encodeJoker(0, true);  // 大王 — compareValue=17

// ══════════════════════════════════════════════════════════════════════════════
// AC-1: 自由出牌轮 → 最小单张
// ══════════════════════════════════════════════════════════════════════════════

describe("AIPlayer.decide() — free round (lastPlay=null)", () => {
  it("AC-1: plays smallest single from a normal hand", () => {
    const hand = [card4, card3, card2]; // 3=cv3, 4=cv4, 2=cv15
    expect(AIPlayer.decide(hand, null)).toEqual([card3]);
  });

  it("AC-1: single card in hand → returns that card", () => {
    expect(AIPlayer.decide([card4], null)).toEqual([card4]);
  });

  it("AC-3: hand with only jokers → returns smallest joker (小王 < 大王)", () => {
    expect(AIPlayer.decide([bigJ, smallJ], null)).toEqual([smallJ]);
  });

  it("AC-3: hand with only 2s → returns the 2", () => {
    const card2b = encode(1, 0, 12); // second deck 2♠ — same compareValue
    expect(AIPlayer.decide([card2, card2b], null)).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-2: 跟牌轮 → pass
// ══════════════════════════════════════════════════════════════════════════════

describe("AIPlayer.decide() — follow round (lastPlay≠null)", () => {
  it("AC-2: always passes regardless of hand", () => {
    const hand = [card3, card4, card2];
    expect(AIPlayer.decide(hand, dummyPattern())).toEqual([]);
  });

  it("AC-2: passes even when AI could theoretically beat", () => {
    expect(AIPlayer.decide([bigJ, smallJ], dummyPattern())).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ══════════════════════════════════════════════════════════════════════════════

describe("AIPlayer.decide() — edge cases", () => {
  it("empty hand returns [] (no throw)", () => {
    expect(AIPlayer.decide([], null)).toEqual([]);
    expect(AIPlayer.decide([], dummyPattern())).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// pickSmallestSingle
// ══════════════════════════════════════════════════════════════════════════════

describe("AIPlayer.pickSmallestSingle()", () => {
  it("returns card with lowest compareValue", () => {
    expect(AIPlayer.pickSmallestSingle([card2, card4, card3])).toEqual([card3]);
  });

  it("empty array → []", () => {
    expect(AIPlayer.pickSmallestSingle([])).toEqual([]);
  });

  it("single element → that element", () => {
    expect(AIPlayer.pickSmallestSingle([card2])).toEqual([card2]);
  });

  it("big joker vs small joker → small joker wins", () => {
    expect(AIPlayer.pickSmallestSingle([bigJ, smallJ])).toEqual([smallJ]);
  });
});
