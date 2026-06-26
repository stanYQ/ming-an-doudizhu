import { CardPatternEngine } from '../logic/CardPatternEngine';
import { PatternType } from '../../../shared/CardPattern';
import { encode, encodeJoker } from '../../../shared/CardEncoding';

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

describe('CardPatternEngine.parse()', () => {
  it('AC-1: valid single → CardPattern (SINGLE)', () => {
    const p = CardPatternEngine.parse([sp(0)]);
    expect(p).not.toBeNull();
    expect(p!.type).toBe(PatternType.SINGLE);
  });

  it('AC-2: valid bomb 4 cards → CardPattern, length=4', () => {
    const p = CardPatternEngine.parse([sp(5), ht(5), dm(5), cl(5)]);
    expect(p).not.toBeNull();
    expect(p!.type).toBe(PatternType.BOMB);
    expect(p!.length).toBe(4);
  });

  it('AC-2: valid bomb 8 cards → CardPattern, length=8', () => {
    const p = CardPatternEngine.parse([sp(5),ht(5),dm(5),cl(5),sp2(5),ht2(5),dm2(5),cl2(5)]);
    expect(p).not.toBeNull();
    expect(p!.type).toBe(PatternType.BOMB);
    expect(p!.length).toBe(8);
  });

  it('AC-3: invalid pattern (small+large joker) → null', () => {
    expect(CardPatternEngine.parse([SJ, LJ])).toBeNull();
  });

  it('AC-4: empty array → null', () => {
    expect(CardPatternEngine.parse([])).toBeNull();
  });

  it('AC-5: result consistent with PatternHelper (valid straight)', () => {
    const p = CardPatternEngine.parse([sp(0),ht(1),dm(2),cl(3),sp(4)]);
    expect(p).not.toBeNull();
    expect(p!.type).toBe(PatternType.STRAIGHT);
  });

  it('AC-5: result consistent with PatternHelper (invalid → null)', () => {
    expect(CardPatternEngine.parse([sp(0),ht(0),dm(1),cl(2),sp(3)])).toBeNull();
  });
});

describe('CardPatternEngine.canBeat()', () => {
  const single3 = CardPatternEngine.parse([sp(0)])!;
  const single5 = CardPatternEngine.parse([sp(2)])!;
  const bomb4   = CardPatternEngine.parse([sp(5),ht(5),dm(5),cl(5)])!;
  const bomb8   = CardPatternEngine.parse([sp(5),ht(5),dm(5),cl(5),sp2(5),ht2(5),dm2(5),cl2(5)])!;
  const bomb4lo = CardPatternEngine.parse([sp(3),ht(3),dm(3),cl(3)])!;
  const jokerSm = CardPatternEngine.parse([SJ, SJ2])!;
  const jokerBg = CardPatternEngine.parse([LJ, LJ2])!;

  it('AC-6: current=null (new round) → any valid pattern returns true', () => {
    expect(CardPatternEngine.canBeat(single3, null)).toBe(true);
    expect(CardPatternEngine.canBeat(bomb4, null)).toBe(true);
    expect(CardPatternEngine.canBeat(jokerBg, null)).toBe(true);
  });

  it('AC-7: challenger=null → false', () => {
    expect(CardPatternEngine.canBeat(null, single3)).toBe(false);
    expect(CardPatternEngine.canBeat(null, null)).toBe(false);
  });

  it('AC-8: bomb beats regular pattern', () => {
    expect(CardPatternEngine.canBeat(bomb4, single3)).toBe(true);
  });

  it('AC-9: JOKER_BOMB_BIG beats JOKER_BOMB_SMALL', () => {
    expect(CardPatternEngine.canBeat(jokerBg, jokerSm)).toBe(true);
  });

  it('AC-10: 8-card bomb beats 4-card bomb', () => {
    expect(CardPatternEngine.canBeat(bomb8, bomb4)).toBe(true);
  });

  it('AC-11: same type + same length + lower primaryValue → false', () => {
    expect(CardPatternEngine.canBeat(single3, single5)).toBe(false);
  });

  it('AC-12: different regular types → false', () => {
    const pair = CardPatternEngine.parse([sp(3),ht(3)])!;
    expect(CardPatternEngine.canBeat(pair, single3)).toBe(false);
  });

  it('AC-13: canBeat(null, null) → false', () => {
    expect(CardPatternEngine.canBeat(null, null)).toBe(false);
  });
});
