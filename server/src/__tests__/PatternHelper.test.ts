import { parse, canBeat } from '../../../shared/PatternHelper';
import { PatternType } from '../../../shared/CardPattern';
import { encode, encodeJoker } from '../../../shared/CardEncoding';

// Card constructors: suit 0=♠ 1=♥ 2=♦ 3=♣, rank 0=3 … 12=2
const sp = (r: number) => encode(0, 0, r);
const ht = (r: number) => encode(0, 1, r);
const dm = (r: number) => encode(0, 2, r);
const cl = (r: number) => encode(0, 3, r);
const sp2 = (r: number) => encode(1, 0, r);
const ht2 = (r: number) => encode(1, 1, r);
const dm2 = (r: number) => encode(1, 2, r);
const cl2 = (r: number) => encode(1, 3, r);

const SJ  = encodeJoker(0, false);
const LJ  = encodeJoker(0, true);
const SJ2 = encodeJoker(1, false);
const LJ2 = encodeJoker(1, true);

describe('parse()', () => {
  // ── basic types ──────────────────────────────────────────────────────────

  it('AC-1: empty array → INVALID', () => {
    const p = parse([]);
    expect(p.type).toBe(PatternType.INVALID);
    expect(p.primaryValue).toBe(0);
  });

  it('AC-2 / CardPattern-AC-3: single card → SINGLE, correct primaryValue', () => {
    const p = parse([sp(0)]); // 3
    expect(p.type).toBe(PatternType.SINGLE);
    expect(p.primaryValue).toBe(3);
    expect(p.length).toBe(1);
    expect(p.cards).toEqual([sp(0)]);
  });

  it('CardPattern-AC-4: 2 same → PAIR', () => {
    const p = parse([sp(4), ht(4)]); // two 7s
    expect(p.type).toBe(PatternType.PAIR);
    expect(p.primaryValue).toBe(7);
    expect(p.length).toBe(2);
  });

  it('CardPattern-AC-5: 3 same → TRIPLE', () => {
    const p = parse([sp(5), ht(5), dm(5)]); // three 8s
    expect(p.type).toBe(PatternType.TRIPLE);
    expect(p.primaryValue).toBe(8);
    expect(p.length).toBe(3);
  });

  it('CardPattern-AC-6: 3 same + 1 any → TRIPLE_SOLO', () => {
    const p = parse([sp(0), ht(0), dm(0), cl(5)]); // 3×3 + one 8
    expect(p.type).toBe(PatternType.TRIPLE_SOLO);
    expect(p.primaryValue).toBe(3); // triple of 3s
    expect(p.length).toBe(4);
  });

  it('CardPattern-AC-7: 3 same + 2 same (different) → TRIPLE_PAIR', () => {
    const p = parse([sp(0), ht(0), dm(0), cl(5), sp(5)]); // 3×3 + pair of 8s
    expect(p.type).toBe(PatternType.TRIPLE_PAIR);
    expect(p.primaryValue).toBe(3);
    expect(p.length).toBe(5);
  });

  // ── straights ────────────────────────────────────────────────────────────

  it('AC-3 / CardPattern-AC-8: 5-card straight → STRAIGHT, primaryValue=highest', () => {
    const p = parse([sp(0), ht(1), dm(2), cl(3), sp(4)]); // 3-4-5-6-7
    expect(p.type).toBe(PatternType.STRAIGHT);
    expect(p.primaryValue).toBe(7);
    expect(p.length).toBe(5);
  });

  it('6-card straight', () => {
    const p = parse([sp(0), ht(1), dm(2), cl(3), sp(4), ht(5)]); // 3-4-5-6-7-8
    expect(p.type).toBe(PatternType.STRAIGHT);
    expect(p.primaryValue).toBe(8);
  });

  it('AC-4: duplicate in 5-card run → INVALID', () => {
    expect(parse([sp(0), ht(0), dm(1), cl(2), sp(3)]).type).toBe(PatternType.INVALID);
  });

  it('AC-5: straight ending in 2 [J,Q,K,A,2] → INVALID', () => {
    expect(parse([sp(8), ht(9), dm(10), cl(11), sp(12)]).type).toBe(PatternType.INVALID);
  });

  it('AC-6: straight containing joker → INVALID', () => {
    expect(parse([sp(0), ht(1), SJ, dm(2), cl(3)]).type).toBe(PatternType.INVALID);
  });

  // ── bombs ─────────────────────────────────────────────────────────────────

  it('AC-7 / CardPattern-AC-13: 4 same → BOMB, length=4', () => {
    const p = parse([sp(5), ht(5), dm(5), cl(5)]); // four 8s
    expect(p.type).toBe(PatternType.BOMB);
    expect(p.length).toBe(4);
    expect(p.primaryValue).toBe(8);
  });

  it('AC-8: 8 same → BOMB, length=8', () => {
    const p = parse([sp(5), ht(5), dm(5), cl(5), sp2(5), ht2(5), dm2(5), cl2(5)]);
    expect(p.type).toBe(PatternType.BOMB);
    expect(p.length).toBe(8);
    expect(p.primaryValue).toBe(8);
  });

  it('5-card BOMB', () => {
    const p = parse([sp(3), ht(3), dm(3), cl(3), sp2(3)]);
    expect(p.type).toBe(PatternType.BOMB);
    expect(p.length).toBe(5);
  });

  // ── joker bombs ───────────────────────────────────────────────────────────

  it('AC-9 / CardPattern-AC-14: 2 small jokers → JOKER_BOMB_SMALL', () => {
    const p = parse([SJ, SJ2]);
    expect(p.type).toBe(PatternType.JOKER_BOMB_SMALL);
    expect(p.primaryValue).toBe(16);
    expect(p.length).toBe(2);
  });

  it('AC-10 / CardPattern-AC-15: 2 large jokers → JOKER_BOMB_BIG', () => {
    const p = parse([LJ, LJ2]);
    expect(p.type).toBe(PatternType.JOKER_BOMB_BIG);
    expect(p.primaryValue).toBe(17);
    expect(p.length).toBe(2);
  });

  it('AC-11 / CardPattern-AC-16: 1 small + 1 large joker → INVALID', () => {
    expect(parse([SJ, LJ]).type).toBe(PatternType.INVALID);
  });

  it('AC-12 / CardPattern-AC-17: 3 jokers → INVALID', () => {
    expect(parse([SJ, SJ2, LJ]).type).toBe(PatternType.INVALID);
    expect(parse([SJ, LJ, LJ2]).type).toBe(PatternType.INVALID);
  });

  // ── single joker (GAME-RULES §6.3 更新：单张王合法出牌） ─────────────────
  it('AC-13: single small joker → SINGLE, primaryValue=16', () => {
    const p = parse([SJ]);
    expect(p.type).toBe(PatternType.SINGLE);
    expect(p.primaryValue).toBe(16);
    expect(p.length).toBe(1);
  });

  it('AC-14: single large joker → SINGLE, primaryValue=17', () => {
    const p = parse([LJ]);
    expect(p.type).toBe(PatternType.SINGLE);
    expect(p.primaryValue).toBe(17);
    expect(p.length).toBe(1);
  });

  it('AC-15: single small joker deck-1 (card 106) → SINGLE', () => {
    expect(parse([SJ2]).type).toBe(PatternType.SINGLE);
    expect(parse([SJ2]).primaryValue).toBe(16);
  });

  it('AC-16: joker + regular card → INVALID', () => {
    expect(parse([SJ, encode(0, 0, 0)]).type).toBe(PatternType.INVALID);
  });

  // ── consecutive pairs ─────────────────────────────────────────────────────

  it('CardPattern-AC-9: 6-card consecutive pairs → CONSECUTIVE_PAIRS', () => {
    const p = parse([sp(0), ht(0), sp(1), ht(1), sp(2), ht(2)]); // 3,3,4,4,5,5
    expect(p.type).toBe(PatternType.CONSECUTIVE_PAIRS);
    expect(p.primaryValue).toBe(5);
    expect(p.length).toBe(6);
  });

  it('8-card consecutive pairs', () => {
    const p = parse([sp(0),ht(0), sp(1),ht(1), sp(2),ht(2), sp(3),ht(3)]);
    expect(p.type).toBe(PatternType.CONSECUTIVE_PAIRS);
    expect(p.primaryValue).toBe(6);
  });

  it('CardPattern-AC-18: duplicate rank in straight → INVALID', () => {
    // [3,3,4,5,6,7] - count(3)=2, not a valid straight
    expect(parse([sp(0),ht(0), sp(1),sp(2),sp(3),sp(4)]).type).toBe(PatternType.INVALID);
  });

  it('CardPattern-AC-19: straight containing A → INVALID (A > K, above range)', () => {
    // [9,10,J,Q,K,A] - A has cv=14 > 13
    expect(parse([sp(6),ht(7),dm(8),cl(9),sp(10),ht(11)]).type).toBe(PatternType.INVALID);
  });

  // ── airplane ──────────────────────────────────────────────────────────────

  it('CardPattern-AC-10: 2 consecutive triples → AIRPLANE', () => {
    const p = parse([sp(0),ht(0),dm(0), sp(1),ht(1),dm(1)]); // 3×3 + 3×4
    expect(p.type).toBe(PatternType.AIRPLANE);
    expect(p.primaryValue).toBe(4);
    expect(p.length).toBe(6);
  });

  it('3-group AIRPLANE', () => {
    const p = parse([sp(0),ht(0),dm(0), sp(1),ht(1),dm(1), sp(2),ht(2),dm(2)]);
    expect(p.type).toBe(PatternType.AIRPLANE);
    expect(p.primaryValue).toBe(5);
  });

  it('AC-14 / CardPattern-AC-11: 2 consecutive triples + 2 solo wings → AIRPLANE_SOLO_WINGS', () => {
    // 3×3, 3×4, single 5, single 6
    const p = parse([sp(0),ht(0),dm(0), sp(1),ht(1),dm(1), sp(2), sp(3)]);
    expect(p.type).toBe(PatternType.AIRPLANE_SOLO_WINGS);
    expect(p.primaryValue).toBe(4);
    expect(p.length).toBe(8);
  });

  it('AC-15 / CardPattern-AC-12: 2 consecutive triples + 2 pair wings → AIRPLANE_PAIR_WINGS', () => {
    // 3×3, 3×4, pair(5), pair(6)
    const p = parse([sp(0),ht(0),dm(0), sp(1),ht(1),dm(1), sp(2),ht(2), sp(3),ht(3)]);
    expect(p.type).toBe(PatternType.AIRPLANE_PAIR_WINGS);
    expect(p.primaryValue).toBe(4);
    expect(p.length).toBe(10);
  });

  it('AC-16: airplane with wrong wing count → INVALID', () => {
    // 2 triples + only 1 solo wing (need 2)
    expect(parse([sp(0),ht(0),dm(0), sp(1),ht(1),dm(1), sp(2)]).type).toBe(PatternType.INVALID);
    // 2 triples + only 1 pair wing (need 2 pairs)
    expect(parse([sp(0),ht(0),dm(0), sp(1),ht(1),dm(1), sp(2),ht(2)]).type).toBe(PatternType.INVALID);
  });

  it('AC-13: triple + two different singles (not a pair) → INVALID', () => {
    // [3,3,3,4,5] uniqueCount=3, not TRIPLE_PAIR
    expect(parse([sp(0),ht(0),dm(0), sp(1), sp(2)]).type).toBe(PatternType.INVALID);
  });

  // ── cards array preserves input order ─────────────────────────────────────

  it('cards field preserves original input order', () => {
    const input = [cl(4), sp(4)]; // reversed order
    const p = parse(input);
    expect(p.cards).toEqual(input);
  });
});

describe('canBeat()', () => {
  const single = (r: number) => parse([sp(r)]);
  const pair   = (r: number) => parse([sp(r), ht(r)]);
  const bomb4  = (r: number) => parse([sp(r), ht(r), dm(r), cl(r)]);
  const bomb6  = (r: number) => parse([sp(r), ht(r), dm(r), cl(r), sp2(r), ht2(r)]);

  const jokerSmall = parse([SJ, SJ2]);
  const jokerBig   = parse([LJ, LJ2]);

  it('AC-17: nothing beats JOKER_BOMB_BIG (including itself)', () => {
    expect(canBeat(jokerBig, jokerBig)).toBe(false);
    expect(canBeat(jokerSmall, jokerBig)).toBe(false);
    expect(canBeat(bomb4(12), jokerBig)).toBe(false);
    expect(canBeat(single(12), jokerBig)).toBe(false);
  });

  it('AC-18: JOKER_BOMB_BIG beats JOKER_BOMB_SMALL', () => {
    expect(canBeat(jokerBig, jokerSmall)).toBe(true);
  });

  it('AC-19: JOKER_BOMB_SMALL beats any regular bomb', () => {
    expect(canBeat(jokerSmall, bomb4(12))).toBe(true);
    expect(canBeat(jokerSmall, bomb6(5))).toBe(true);
  });

  it('AC-20: JOKER_BOMB_SMALL cannot beat another JOKER_BOMB_SMALL', () => {
    expect(canBeat(jokerSmall, jokerSmall)).toBe(false);
  });

  it('AC-21: bomb with more cards beats bomb with fewer (regardless of rank)', () => {
    expect(canBeat(bomb6(0), bomb4(12))).toBe(true); // 6-bomb of 3s beats 4-bomb of 2s
  });

  it('AC-22: same-length bombs compare by primaryValue', () => {
    expect(canBeat(bomb4(5), bomb4(3))).toBe(true);
    expect(canBeat(bomb4(3), bomb4(5))).toBe(false);
  });

  it('AC-23: bomb beats any regular pattern', () => {
    expect(canBeat(bomb4(0), single(12))).toBe(true);
    expect(canBeat(bomb4(0), pair(12))).toBe(true);
  });

  it('AC-24: regular pattern cannot beat a bomb', () => {
    expect(canBeat(single(12), bomb4(0))).toBe(false);
    expect(canBeat(pair(12), bomb4(0))).toBe(false);
  });

  it('AC-25: same type + same length + higher primaryValue → true', () => {
    expect(canBeat(single(5), single(3))).toBe(true);
    expect(canBeat(pair(10), pair(7))).toBe(true);
  });

  it('AC-26: same type + same length + equal or lower primaryValue → false', () => {
    expect(canBeat(single(3), single(5))).toBe(false);
    expect(canBeat(single(3), single(3))).toBe(false);
  });

  it('AC-27: different type regular patterns → false', () => {
    expect(canBeat(pair(5), single(3))).toBe(false);
    expect(canBeat(single(12), pair(0))).toBe(false);
  });

  it('AC-28: same type but different length → false', () => {
    const st6 = parse([sp(0),ht(1),dm(2),cl(3),sp(4),ht(5)]);
    const st5 = parse([sp(1),ht(2),dm(3),cl(4),sp(5)]);
    expect(canBeat(st6, st5)).toBe(false);
    expect(canBeat(st5, st6)).toBe(false);
  });

  it('AC-29: INVALID challenger or current → always false', () => {
    const inv = parse([]);
    expect(canBeat(inv, single(0))).toBe(false);
    expect(canBeat(single(12), inv)).toBe(false);
    expect(canBeat(inv, inv)).toBe(false);
  });

  it('AC-30: single joker pressure — small joker > 2, large joker > small joker', () => {
    const singleSmallJ = parse([SJ]);
    const singleLargeJ = parse([LJ]);
    const single2      = parse([sp(12)]); // 2, pv=15
    expect(canBeat(singleSmallJ, single2)).toBe(true);      // 16 > 15
    expect(canBeat(singleLargeJ, singleSmallJ)).toBe(true); // 17 > 16
    expect(canBeat(singleSmallJ, singleLargeJ)).toBe(false);// 16 < 17
    expect(canBeat(single2, singleSmallJ)).toBe(false);     // 15 < 16
  });
});
