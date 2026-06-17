import { Deck } from '../logic/Deck';

describe('Deck.shuffle()', () => {
  it('AC-1: returns array of length 108', () => {
    expect(Deck.shuffle().length).toBe(108);
  });

  it('AC-2: contains exactly the integers 0-107, no duplicates', () => {
    const deck = Deck.shuffle();
    const set = new Set(deck);
    expect(set.size).toBe(108);
    for (let i = 0; i < 108; i++) expect(set.has(i)).toBe(true);
  });

  it('AC-3: same seed produces same order', () => {
    const a = Deck.shuffle(42);
    const b = Deck.shuffle(42);
    expect(a).toEqual(b);
  });

  it('AC-4: different calls without seed produce different results (with high probability)', () => {
    const a = Deck.shuffle();
    const b = Deck.shuffle();
    // probability of identical shuffle: 1/108! ≈ 0
    expect(a).not.toEqual(b);
  });
});

describe('Deck.deal()', () => {
  const deck = Deck.shuffle(1);
  const result = Deck.deal(deck);

  it('AC-5: returns 5 hands, each with 21 cards', () => {
    expect(result.hands.length).toBe(5);
    result.hands.forEach(h => expect(h.length).toBe(21));
  });

  it('AC-6: bottom has 3 cards', () => {
    expect(result.bottom.length).toBe(3);
  });

  it('AC-7: all 108 cards accounted for, no duplicates', () => {
    const all = [...result.hands.flat(), ...result.bottom];
    const set = new Set(all);
    expect(all.length).toBe(108);
    expect(set.size).toBe(108);
  });

  it('AC-8: faceUpCard is in one of the hands (not in bottom)', () => {
    expect(result.bottom.includes(result.faceUpCard)).toBe(false);
    const inHand = result.hands.some(h => h.includes(result.faceUpCard));
    expect(inHand).toBe(true);
  });

  it('AC-9: faceUpCard appears in exactly one hand', () => {
    const count = result.hands.filter(h => h.includes(result.faceUpCard)).length;
    expect(count).toBe(1);
  });
});

describe('Deck.findLandlordSeat()', () => {
  const deck = Deck.shuffle(99);
  const { hands, faceUpCard } = Deck.deal(deck);

  it('AC-10: returns the index of the hand containing faceUpCard', () => {
    const seat = Deck.findLandlordSeat(hands, faceUpCard);
    expect(hands[seat].includes(faceUpCard)).toBe(true);
  });

  it('AC-11: faceUpCard not in any hand → returns 0 (no throw)', () => {
    const emptyHands = [[], [], [], [], []];
    expect(() => Deck.findLandlordSeat(emptyHands, 0)).not.toThrow();
    expect(Deck.findLandlordSeat(emptyHands, 0)).toBe(0);
  });
});
