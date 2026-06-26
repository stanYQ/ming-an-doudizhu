/**
 * @file CardDecomposer.test.ts
 * @description TASK-025: AC-1 ~ AC-18 全覆盖
 */

import { CardDecomposer, CardGroup } from '../logic/CardDecomposer';
import { encode, encodeJoker, compareValue } from '../../../shared/CardEncoding';
import { PatternType } from '../../../shared/CardPattern';
import { parse } from '../../../shared/PatternHelper';

// ── helpers ────────────────────────────────────────────────────────────────

/** cv → physical card (deck=0, suit=0); cv16=小王, cv17=大王 */
function c(cv: number, deck = 0, suit = 0): number {
  if (cv === 16) return encodeJoker(deck, false);
  if (cv === 17) return encodeJoker(deck, true);
  return encode(deck, suit, cv - 3);
}

/** multiple cvs → card array */
function h(...cvs: number[]): number[] {
  return cvs.map(v => c(v));
}

/** second copy of same cv (deck=1) */
function c2(cv: number, suit = 0): number {
  if (cv === 16) return encodeJoker(1, false);
  if (cv === 17) return encodeJoker(1, true);
  return encode(1, suit, cv - 3);
}

function getCvs(cards: number[]): number[] {
  return cards.map(compareValue).sort((a, b) => a - b);
}

function allCards(groups: CardGroup[]): number[] {
  return groups.flatMap(g => g.cards).sort((a, b) => a - b);
}

// ── AC-7 / AC-8 helpers ───────────────────────────────────────────────────

function checkGroups(hand: number[], groups: CardGroup[]): void {
  // AC-7: all patterns valid
  for (const g of groups) {
    expect(g.pattern.type).not.toBe(PatternType.INVALID);
  }
  // AC-8: union = input, no missing/extra
  expect(allCards(groups)).toEqual([...hand].sort((a, b) => a - b));
}

// ──────────────────────────────────────────────────────────────────────────
// decompose()
// ──────────────────────────────────────────────────────────────────────────

describe('CardDecomposer.decompose()', () => {
  it('AC-1: returns CardGroup[] that covers all input cards', () => {
    const hand = h(3, 4, 5, 6, 7, 9, 10, 11);
    const groups = CardDecomposer.decompose(hand);
    checkGroups(hand, groups);
  });

  it('AC-2: joker bomb (双大王) preserved as single group', () => {
    const hand = [c(17, 0), c(17, 1), c(3)]; // 2 large jokers + one card
    const groups = CardDecomposer.decompose(hand);
    const bomb = groups.find(g => g.pattern.type === PatternType.JOKER_BOMB_BIG);
    expect(bomb).toBeDefined();
    expect(bomb!.cards).toHaveLength(2);
    checkGroups(hand, groups);
  });

  it('AC-2: joker bomb (双小王) preserved as single group', () => {
    const hand = [c(16, 0), c(16, 1), c(5)];
    const groups = CardDecomposer.decompose(hand);
    const bomb = groups.find(g => g.pattern.type === PatternType.JOKER_BOMB_SMALL);
    expect(bomb).toBeDefined();
    checkGroups(hand, groups);
  });

  it('AC-3: 4-card bomb preserved as single group', () => {
    // Four 3s (both decks, two suits each)
    const hand = [c(3, 0, 0), c(3, 0, 1), c2(3, 0), c2(3, 1), c(5)];
    const groups = CardDecomposer.decompose(hand);
    const bomb = groups.find(g => g.pattern.type === PatternType.BOMB);
    expect(bomb).toBeDefined();
    expect(bomb!.cards).toHaveLength(4);
    checkGroups(hand, groups);
  });

  it('AC-3: 8-card bomb (same cv double deck) is 1 group not 2', () => {
    // 8 cards of cv=3 (max per double deck): deck0 suit0-3 + deck1 suit0-3
    const hand = [
      encode(0, 0, 0), encode(0, 1, 0), encode(0, 2, 0), encode(0, 3, 0),
      encode(1, 0, 0), encode(1, 1, 0), encode(1, 2, 0), encode(1, 3, 0),
    ];
    const groups = CardDecomposer.decompose(hand);
    checkGroups(hand, groups);
    // Should be 1 group (8-card bomb) < 2 groups (two 4-bombs)
    expect(groups.length).toBe(1);
    expect(groups[0].pattern.type).toBe(PatternType.BOMB);
    expect(groups[0].cards).toHaveLength(8);
  });

  it('AC-4: 2s do not enter sequences', () => {
    // 2 (cv15) + sequence cards 3-7
    const hand = h(15, 3, 4, 5, 6, 7);
    const groups = CardDecomposer.decompose(hand);
    checkGroups(hand, groups);
    // The straight 34567 should be 1 group; 2 is separate
    const straight = groups.find(g => g.pattern.type === PatternType.STRAIGHT);
    expect(straight).toBeDefined();
    // 2 must not appear in the straight
    const twoCv = compareValue(c(15));
    expect(getCvs(straight!.cards)).not.toContain(twoCv);
  });

  it('AC-5: straight takes longest possible length', () => {
    // Cards 3-9 available → longest straight is 3456789 (7 cards)
    const hand = h(3, 4, 5, 6, 7, 8, 9);
    const groups = CardDecomposer.decompose(hand);
    checkGroups(hand, groups);
    expect(groups.length).toBe(1);
    expect(groups[0].pattern.type).toBe(PatternType.STRAIGHT);
    expect(groups[0].cards).toHaveLength(7);
  });

  it('AC-5: greedy does not split a 7-card run into two shorter straights', () => {
    const hand = h(3, 4, 5, 6, 7, 8, 9, 11); // 3-9 straight + J single
    const groups = CardDecomposer.decompose(hand);
    checkGroups(hand, groups);
    const straights = groups.filter(g => g.pattern.type === PatternType.STRAIGHT);
    // Should be 1 straight of length 7, not 2 shorter ones
    expect(straights.length).toBe(1);
    expect(straights[0].cards.length).toBeGreaterThanOrEqual(7);
  });

  it('AC-6: airplane takes longest possible length', () => {
    // Triples of 3,4,5,6 → airplane of length 4
    const hand = [
      c(3,0,0), c(3,0,1), c(3,0,2),
      c(4,0,0), c(4,0,1), c(4,0,2),
      c(5,0,0), c(5,0,1), c(5,0,2),
      c(6,0,0), c(6,0,1), c(6,0,2),
    ];
    const groups = CardDecomposer.decompose(hand);
    checkGroups(hand, groups);
    expect(groups.length).toBe(1);
    expect(groups[0].pattern.type).toBe(PatternType.AIRPLANE);
    expect(groups[0].cards).toHaveLength(12);
  });

  it('AC-7 + AC-8: all patterns valid; all cards accounted for (complex hand)', () => {
    // 22AAKQJ9987776654 (17 cards, see spec)
    const hand = [
      c(15,0,0), c(15,0,1),   // 2×2
      c(14,0,0), c(14,0,1),   // 2×A
      c(13,0,0),               // K
      c(12,0,0),               // Q
      c(11,0,0),               // J
      c(9,0,0),  c(9,0,1),   // 2×9
      c(8,0,0),                // 8
      c(7,0,0),  c(7,0,1), c(7,0,2), // 3×7
      c(6,0,0),  c(6,0,1),   // 2×6
      c(5,0,0),                // 5
      c(4,0,0),                // 4
    ];
    const groups = CardDecomposer.decompose(hand);
    checkGroups(hand, groups);
    // Spec requires ≤ 9 groups
    expect(groups.length).toBeLessThanOrEqual(9);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// minTurns()
// ──────────────────────────────────────────────────────────────────────────

describe('CardDecomposer.minTurns()', () => {
  it('AC-9: equals decompose().length', () => {
    const hand = h(3, 4, 5, 6, 7, 9, 11, 12);
    expect(CardDecomposer.minTurns(hand)).toBe(CardDecomposer.decompose(hand).length);
  });

  it('AC-10: empty hand → 0', () => {
    expect(CardDecomposer.minTurns([])).toBe(0);
  });

  it('AC-11: n singles → minTurns = n', () => {
    const hand = h(3, 5, 7, 9, 11); // all different cv, all singles
    expect(CardDecomposer.minTurns(hand)).toBe(5);
  });

  it('AC-12: hand containing 34567 → minTurns ≤ hand.length - 4', () => {
    const hand = h(3, 4, 5, 6, 7, 9, 11, 12, 13); // 9 cards
    const mt = CardDecomposer.minTurns(hand);
    expect(mt).toBeLessThanOrEqual(hand.length - 4);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// generateAll()
// ──────────────────────────────────────────────────────────────────────────

describe('CardDecomposer.generateAll()', () => {
  it('AC-13: returns all legal single plays', () => {
    // Hand with a single, pair, triple, bomb, straight, consecutive pair
    const hand = [
      c(3,0,0), c(3,0,1), c(3,0,2), c(3,0,3), // 4×3 → bomb + triple + pair + single
      c(4,0,0), c(4,0,1), c(4,0,2),             // 3×4 → triple + pair + single (also for str/cp)
      c(5,0,0), c(5,0,1),                        // 2×5 → pair + single
      c(6,0,0),                                  // 1×6 → single
      c(7,0,0),                                  // 1×7
    ];
    const all = CardDecomposer.generateAll(hand);
    const types = new Set(all.map(cards => parse(cards).type));
    expect(types.has(PatternType.SINGLE)).toBe(true);
    expect(types.has(PatternType.PAIR)).toBe(true);
    expect(types.has(PatternType.TRIPLE)).toBe(true);
    expect(types.has(PatternType.BOMB)).toBe(true);
    expect(types.has(PatternType.STRAIGHT)).toBe(true);
  });

  it('AC-14: includes bombs of sizes 4-8 when available', () => {
    // 8 cards of cv=3
    const hand = [
      encode(0,0,0), encode(0,1,0), encode(0,2,0), encode(0,3,0),
      encode(1,0,0), encode(1,1,0), encode(1,2,0), encode(1,3,0),
    ];
    const all = CardDecomposer.generateAll(hand);
    const bombs = all.filter(cards => parse(cards).type === PatternType.BOMB);
    const bombSizes = new Set(bombs.map(b => b.length));
    expect(bombSizes.has(4)).toBe(true);
    expect(bombSizes.has(5)).toBe(true);
    expect(bombSizes.has(6)).toBe(true);
    expect(bombSizes.has(7)).toBe(true);
    expect(bombSizes.has(8)).toBe(true);
  });

  it('AC-14: includes joker bomb (双大王)', () => {
    const hand = [c(17, 0), c(17, 1), c(3)];
    const all = CardDecomposer.generateAll(hand);
    const types = all.map(cards => parse(cards).type);
    expect(types).toContain(PatternType.JOKER_BOMB_BIG);
  });

  it('AC-14: includes joker bomb (双小王)', () => {
    const hand = [c(16, 0), c(16, 1), c(3)];
    const all = CardDecomposer.generateAll(hand);
    const types = all.map(cards => parse(cards).type);
    expect(types).toContain(PatternType.JOKER_BOMB_SMALL);
  });

  it('AC-14: includes consecutive pairs at each valid length', () => {
    // pairs at 3,4,5,6 → can form 3-pair and 4-pair sequences
    const hand = [
      c(3,0,0), c(3,0,1),
      c(4,0,0), c(4,0,1),
      c(5,0,0), c(5,0,1),
      c(6,0,0), c(6,0,1),
    ];
    const all = CardDecomposer.generateAll(hand);
    const cps = all.filter(cards => parse(cards).type === PatternType.CONSECUTIVE_PAIRS);
    const lengths = new Set(cps.map(cp => cp.length));
    expect(lengths.has(6)).toBe(true);  // 3 pairs
    expect(lengths.has(8)).toBe(true);  // 4 pairs
  });

  it('AC-14: includes straights at multiple lengths', () => {
    const hand = h(3, 4, 5, 6, 7, 8); // can form 5,6,7-card straights from start
    const all = CardDecomposer.generateAll(hand);
    const strs = all.filter(cards => parse(cards).type === PatternType.STRAIGHT);
    const lengths = new Set(strs.map(s => s.length));
    expect(lengths.has(5)).toBe(true);
    expect(lengths.has(6)).toBe(true);
  });

  it('AC-14: includes airplanes at multiple lengths', () => {
    // triples at 3,4,5 → airplane of 2 (6 cards) and 3 (9 cards)
    const hand = [
      c(3,0,0), c(3,0,1), c(3,0,2),
      c(4,0,0), c(4,0,1), c(4,0,2),
      c(5,0,0), c(5,0,1), c(5,0,2),
    ];
    const all = CardDecomposer.generateAll(hand);
    const aps = all.filter(cards => parse(cards).type === PatternType.AIRPLANE);
    const lengths = new Set(aps.map(a => a.length));
    expect(lengths.has(6)).toBe(true);  // 2 triples
    expect(lengths.has(9)).toBe(true);  // 3 triples
  });

  it('AC-15: no wing patterns in generateAll', () => {
    const hand = [
      c(3,0,0), c(3,0,1), c(3,0,2),  // triple
      c(4,0,0),                        // wing candidate
      c(5,0,0), c(5,0,1),             // wing candidate pair
    ];
    const all = CardDecomposer.generateAll(hand);
    const wingTypes = [
      PatternType.TRIPLE_SOLO,
      PatternType.TRIPLE_PAIR,
      PatternType.AIRPLANE_SOLO_WINGS,
      PatternType.AIRPLANE_PAIR_WINGS,
    ];
    for (const cards of all) {
      const t = parse(cards).type;
      expect(wingTypes).not.toContain(t);
    }
  });

  it('AC-16: all generateAll results are valid (non-INVALID)', () => {
    const hand = h(3, 3, 4, 5, 6, 7, 8, 9, 11);
    const all = CardDecomposer.generateAll(hand);
    for (const cards of all) {
      expect(parse(cards).type).not.toBe(PatternType.INVALID);
    }
  });

  it('AC-17: no duplicate entries', () => {
    const hand = [
      c(3,0,0), c(3,0,1), c(3,0,2),
      c(4,0,0), c(4,0,1),
      c(5,0,0),
    ];
    const all = CardDecomposer.generateAll(hand);
    const keys = all.map(cards => [...cards].sort((a, b) => a - b).join(','));
    const unique = new Set(keys);
    expect(unique.size).toBe(all.length);
  });

  it('AC-18: empty hand → []', () => {
    expect(CardDecomposer.generateAll([])).toEqual([]);
  });
});
