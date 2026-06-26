import { RuleEngine } from '../logic/RuleEngine';
import { CardPatternEngine } from '../logic/CardPatternEngine';
import { encode, encodeJoker } from '../../../shared/CardEncoding';

const sp = (r: number) => encode(0, 0, r);
const ht = (r: number) => encode(0, 1, r);
const dm = (r: number) => encode(0, 2, r);
const cl = (r: number) => encode(0, 3, r);
const sp2 = (r: number) => encode(1, 0, r);
const SJ  = encodeJoker(0, false);
const LJ  = encodeJoker(0, true);

describe('RuleEngine.ownsAll()', () => {
  it('AC-1: hand contains all submitted cards → true', () => {
    expect(RuleEngine.ownsAll([sp(0), sp(1), sp(2)], [sp(0), sp(2)])).toBe(true);
  });

  it('AC-2: submitted card not in hand → false', () => {
    expect(RuleEngine.ownsAll([sp(0), sp(1)], [sp(0), sp(2)])).toBe(false);
  });

  it('AC-3: hand has 1×♠3, submits 2×♠3 → false', () => {
    expect(RuleEngine.ownsAll([sp(0), sp(1)], [sp(0), sp(0)])).toBe(false);
  });

  it('AC-4: empty submission → true', () => {
    expect(RuleEngine.ownsAll([sp(0), sp(1)], [])).toBe(true);
  });
});

describe('RuleEngine.removeCards()', () => {
  it('AC-5: hand length decreases by cards played', () => {
    const hand = [sp(0), sp(1), sp(2), sp(3)];
    RuleEngine.removeCards(hand, [sp(0), sp(2)]);
    expect(hand.length).toBe(2);
  });

  it('AC-6: only removes first match (hand has 2×♠3, remove 1 → 1 remains)', () => {
    const hand = [sp(0), sp(0), sp(1)];
    RuleEngine.removeCards(hand, [sp(0)]);
    expect(hand.filter(c => c === sp(0)).length).toBe(1);
    expect(hand.length).toBe(2);
  });

  it('AC-7: card not in hand → silently skipped, no throw', () => {
    const hand = [sp(0), sp(1)];
    expect(() => RuleEngine.removeCards(hand, [sp(5)])).not.toThrow();
    expect(hand.length).toBe(2);
  });
});

describe('RuleEngine.validatePlay()', () => {
  const hand = [sp(0), ht(0), dm(0), cl(0), sp(1), ht(1), sp(2)];
  const lastSingle = CardPatternEngine.parse([sp(1)])!; // single 4

  it('AC-8: ownsAll fails → { ok:false, errorCode:1004 }', () => {
    const r = RuleEngine.validatePlay(hand, [sp(5)], lastSingle);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe(1004);
  });

  it('AC-9: invalid pattern → { ok:false, errorCode:1001 }', () => {
    const r = RuleEngine.validatePlay([SJ, LJ], [SJ, LJ], null);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe(1001);
  });

  it('AC-10: valid pattern but cannot beat last → { ok:false, errorCode:1002 }', () => {
    // last play is single rank-1 (4, cv=4); try to beat with single rank-0 (3, cv=3)
    const r = RuleEngine.validatePlay(hand, [sp(0)], lastSingle);
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe(1002);
  });

  it('AC-11: all checks pass → { ok:true, pattern }', () => {
    // single rank-2 (5, cv=5) beats single rank-1 (4, cv=4)
    const r = RuleEngine.validatePlay(hand, [sp(2)], lastSingle);
    expect(r.ok).toBe(true);
    expect(r.pattern).toBeDefined();
  });

  it('AC-12: lastPlay=null (new round) → any valid pattern passes', () => {
    const r = RuleEngine.validatePlay(hand, [sp(0)], null);
    expect(r.ok).toBe(true);
    expect(r.errorCode).toBeUndefined();
  });
});

describe('RuleEngine.determineWinner()', () => {
  const landlord  = 'p1';
  const partner   = 'p2';

  it('AC-13: standard mode, empty hand = landlord → landlord_camp', () => {
    expect(RuleEngine.determineWinner(landlord, landlord, partner)).toBe('landlord_camp');
  });

  it('AC-14: standard mode, empty hand = partner → landlord_camp', () => {
    expect(RuleEngine.determineWinner(partner, landlord, partner)).toBe('landlord_camp');
  });

  it('AC-15: standard mode, empty hand = civilian → civilian_camp', () => {
    expect(RuleEngine.determineWinner('p3', landlord, partner)).toBe('civilian_camp');
  });

  it('AC-16: alone mode, empty hand = landlord → landlord_camp', () => {
    expect(RuleEngine.determineWinner(landlord, landlord, null)).toBe('landlord_camp');
  });

  it('AC-17: alone mode, empty hand ≠ landlord → civilian_camp', () => {
    expect(RuleEngine.determineWinner('p3', landlord, null)).toBe('civilian_camp');
  });
});
