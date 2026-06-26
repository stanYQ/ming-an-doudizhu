import { CodeCard, CodeCardSelection } from '../logic/CodeCard';
import { encode } from '../../../shared/CardEncoding';

const sel = (suit: number, rank: number): CodeCardSelection => ({ suit, rank });

describe('CodeCard.isValidSelection()', () => {
  it('AC-1: suit 0-3, rank 0-7 → true', () => {
    expect(CodeCard.isValidSelection(sel(0, 0))).toBe(true);
    expect(CodeCard.isValidSelection(sel(3, 7))).toBe(true);
    expect(CodeCard.isValidSelection(sel(2, 4))).toBe(true);
  });

  it('AC-2: rank=8 (J) → false', () => {
    expect(CodeCard.isValidSelection(sel(0, 8))).toBe(false);
  });

  it('AC-3: rank=12 (2) → false', () => {
    expect(CodeCard.isValidSelection(sel(0, 12))).toBe(false);
  });

  it('AC-4: suit=4 (out of range) → false', () => {
    expect(CodeCard.isValidSelection(sel(4, 0))).toBe(false);
  });

  it('AC-5: all 32 valid combinations pass; J/Q/K/A/2 all fail', () => {
    let validCount = 0;
    for (let s = 0; s < 4; s++) {
      for (let r = 0; r < 8; r++) {
        if (CodeCard.isValidSelection(sel(s, r))) validCount++;
      }
    }
    expect(validCount).toBe(32);

    for (const rank of [8, 9, 10, 11, 12]) {
      expect(CodeCard.isValidSelection(sel(0, rank))).toBe(false);
    }
  });
});

describe('CodeCard.resolveTeammate()', () => {
  const landlordId = 'L';
  const p1 = 'P1';
  const p2 = 'P2';
  const code = sel(0, 0); // ♠3

  const deck0card = encode(0, 0, 0); // ♠3 deck-0
  const deck1card = encode(1, 0, 0); // ♠3 deck-1

  it('AC-6: landlord holds deck0, civilian holds deck1 → partnerId=civilian', () => {
    const hands = new Map([
      [landlordId, [deck0card, encode(0, 1, 0)]],
      [p1,         [deck1card, encode(0, 2, 0)]],
      [p2,         [encode(0, 3, 0)]],
    ]);
    const r = CodeCard.resolveTeammate(code, landlordId, hands);
    expect(r.partnerId).toBe(p1);
    expect(r.isLandlordAlone).toBe(false);
  });

  it('AC-7: both code cards in landlord hand → isLandlordAlone=true, partnerId=null', () => {
    const hands = new Map([
      [landlordId, [deck0card, deck1card]],
      [p1,         [encode(0, 1, 1)]],
    ]);
    const r = CodeCard.resolveTeammate(code, landlordId, hands);
    expect(r.partnerId).toBeNull();
    expect(r.isLandlordAlone).toBe(true);
  });

  it('AC-8: landlord holds none, two civilians hold one each → partnerId = first non-landlord holder', () => {
    const hands = new Map([
      [landlordId, [encode(0, 1, 1)]],
      [p1,         [deck0card]],
      [p2,         [deck1card]],
    ]);
    const r = CodeCard.resolveTeammate(code, landlordId, hands);
    expect(r.partnerId).toBe(p1);
    expect(r.isLandlordAlone).toBe(false);
  });

  it('AC-9: landlord holds none, one civilian holds both → partnerId = that civilian', () => {
    const hands = new Map([
      [landlordId, [encode(0, 1, 1)]],
      [p1,         [deck0card, deck1card]],
    ]);
    const r = CodeCard.resolveTeammate(code, landlordId, hands);
    expect(r.partnerId).toBe(p1);
    expect(r.isLandlordAlone).toBe(false);
  });

  it('AC-10: codeCardPair contains exactly the two physical encodings', () => {
    const hands = new Map([[landlordId, [deck0card, deck1card]]]);
    const r = CodeCard.resolveTeammate(code, landlordId, hands);
    expect(r.codeCardPair).toContain(deck0card);
    expect(r.codeCardPair).toContain(deck1card);
    expect(r.codeCardPair.length).toBe(2);
  });
});

describe('CodeCard.containsCodeCard()', () => {
  const pair = [encode(0, 0, 0), encode(1, 0, 0)];

  it('AC-11: played cards contain one of the pair → true', () => {
    expect(CodeCard.containsCodeCard([encode(0, 0, 0), encode(0, 1, 1)], pair)).toBe(true);
  });

  it('AC-12: played cards contain neither → false', () => {
    expect(CodeCard.containsCodeCard([encode(0, 1, 1), encode(0, 2, 2)], pair)).toBe(false);
  });

  it('AC-13: empty played cards → false', () => {
    expect(CodeCard.containsCodeCard([], pair)).toBe(false);
  });
});

describe('CodeCard.describe()', () => {
  it('AC-14: {suit:1, rank:4} → "♥7"', () => {
    expect(CodeCard.describe({ suit: 1, rank: 4 })).toBe('♥7');
  });

  it('AC-15: {suit:0, rank:0} → "♠3"', () => {
    expect(CodeCard.describe({ suit: 0, rank: 0 })).toBe('♠3');
  });
});
