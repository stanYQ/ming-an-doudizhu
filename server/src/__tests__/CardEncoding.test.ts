import {
  encode, encodeJoker, decode, compareValue,
  isJoker, isLargeJoker, isSmallJoker,
  getDeck, getSuit, getRank,
} from '../../../shared/CardEncoding';

describe('CardEncoding', () => {
  describe('encode', () => {
    it('AC-1: encode(0,0,0) = 0', () => {
      expect(encode(0, 0, 0)).toBe(0);
    });
    it('AC-2: encode(1,0,0) = 54', () => {
      expect(encode(1, 0, 0)).toBe(54);
    });
    it('AC-3: encode(0,3,12) = 51', () => {
      expect(encode(0, 3, 12)).toBe(51);
    });
  });

  describe('encodeJoker', () => {
    it('AC-4: encodeJoker(0,false) = 52', () => {
      expect(encodeJoker(0, false)).toBe(52);
    });
    it('AC-5: encodeJoker(0,true) = 53', () => {
      expect(encodeJoker(0, true)).toBe(53);
    });
    it('AC-6: encodeJoker(1,true) = 107', () => {
      expect(encodeJoker(1, true)).toBe(107);
    });
  });

  describe('compareValue', () => {
    it('AC-7: rank=12 (2) → 15', () => {
      expect(compareValue(encode(0, 0, 12))).toBe(15);
      expect(compareValue(encode(0, 2, 12))).toBe(15);
    });
    it('AC-8: rank=11 (A) → 14', () => {
      expect(compareValue(encode(0, 0, 11))).toBe(14);
    });
    it('AC-9: rank=0 (3) → 3', () => {
      expect(compareValue(encode(0, 0, 0))).toBe(3);
    });
    it('AC-10: small joker → 16', () => {
      expect(compareValue(encodeJoker(0, false))).toBe(16);
      expect(compareValue(encodeJoker(1, false))).toBe(16);
    });
    it('AC-11: large joker → 17', () => {
      expect(compareValue(encodeJoker(0, true))).toBe(17);
      expect(compareValue(encodeJoker(1, true))).toBe(17);
    });
    it('AC-12: same rank different decks have same compareValue', () => {
      expect(compareValue(encode(0, 0, 0))).toBe(compareValue(encode(1, 0, 0)));
      expect(compareValue(encode(0, 2, 7))).toBe(compareValue(encode(1, 2, 7)));
    });
  });

  describe('decode', () => {
    it('AC-13: round-trips for regular cards', () => {
      expect(decode(encode(0, 0, 0))).toEqual({ deck: 0, suit: 0, rank: 0, isJoker: false });
      expect(decode(encode(1, 3, 12))).toEqual({ deck: 1, suit: 3, rank: 12, isJoker: false });
      expect(decode(encode(0, 2, 7))).toEqual({ deck: 0, suit: 2, rank: 7, isJoker: false });
    });
    it('AC-14: decode joker returns {deck, isJoker:true, isLarge:bool}', () => {
      expect(decode(encodeJoker(0, false))).toEqual({ deck: 0, isJoker: true, isLarge: false });
      expect(decode(encodeJoker(0, true))).toEqual({ deck: 0, isJoker: true, isLarge: true });
      expect(decode(encodeJoker(1, false))).toEqual({ deck: 1, isJoker: true, isLarge: false });
      expect(decode(encodeJoker(1, true))).toEqual({ deck: 1, isJoker: true, isLarge: true });
    });
    it('AC-15: all 108 encoded values are unique', () => {
      const values = new Set<number>();
      for (let d = 0; d < 2; d++) {
        for (let s = 0; s < 4; s++) {
          for (let r = 0; r < 13; r++) values.add(encode(d, s, r));
        }
        values.add(encodeJoker(d, false));
        values.add(encodeJoker(d, true));
      }
      expect(values.size).toBe(108);
    });
  });

  describe('helper predicates', () => {
    it('isJoker', () => {
      expect(isJoker(encodeJoker(0, false))).toBe(true);
      expect(isJoker(encodeJoker(1, true))).toBe(true);
      expect(isJoker(encode(0, 0, 0))).toBe(false);
    });
    it('isLargeJoker / isSmallJoker', () => {
      expect(isLargeJoker(encodeJoker(0, true))).toBe(true);
      expect(isLargeJoker(encodeJoker(0, false))).toBe(false);
      expect(isSmallJoker(encodeJoker(0, false))).toBe(true);
      expect(isSmallJoker(encodeJoker(0, true))).toBe(false);
    });
    it('getDeck', () => {
      expect(getDeck(encode(0, 2, 5))).toBe(0);
      expect(getDeck(encode(1, 2, 5))).toBe(1);
      expect(getDeck(encodeJoker(1, true))).toBe(1);
    });
    it('getSuit', () => {
      expect(getSuit(encode(0, 3, 5))).toBe(3);
      expect(getSuit(encode(1, 1, 0))).toBe(1);
    });
    it('getRank', () => {
      expect(getRank(encode(0, 2, 12))).toBe(12);
      expect(getRank(encode(1, 0, 0))).toBe(0);
    });
  });

  describe('boundaries', () => {
    it('card=0 minimum', () => {
      expect(decode(0)).toEqual({ deck: 0, suit: 0, rank: 0, isJoker: false });
    });
    it('card=107 maximum (large joker deck 1)', () => {
      expect(decode(107)).toEqual({ deck: 1, isJoker: true, isLarge: true });
      expect(compareValue(107)).toBe(17);
    });
    it('card=106 (small joker deck 1)', () => {
      expect(decode(106)).toEqual({ deck: 1, isJoker: true, isLarge: false });
      expect(compareValue(106)).toBe(16);
    });
  });
});
