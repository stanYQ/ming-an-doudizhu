import { PatternType, CardPattern } from '../../../shared/CardPattern';

describe('CardPattern', () => {
  describe('AC-1: PatternType enum contains exactly the required values', () => {
    it('has all 14 required string values', () => {
      const required = [
        'SINGLE', 'PAIR', 'TRIPLE', 'TRIPLE_SOLO', 'TRIPLE_PAIR',
        'STRAIGHT', 'CONSECUTIVE_PAIRS', 'AIRPLANE',
        'AIRPLANE_SOLO_WINGS', 'AIRPLANE_PAIR_WINGS',
        'BOMB', 'JOKER_BOMB_SMALL', 'JOKER_BOMB_BIG', 'INVALID',
      ];
      expect(Object.values(PatternType).sort()).toEqual(required.sort());
    });

    it('enum values are strings (serializable)', () => {
      expect(PatternType.SINGLE).toBe('SINGLE');
      expect(PatternType.PAIR).toBe('PAIR');
      expect(PatternType.TRIPLE).toBe('TRIPLE');
      expect(PatternType.TRIPLE_SOLO).toBe('TRIPLE_SOLO');
      expect(PatternType.TRIPLE_PAIR).toBe('TRIPLE_PAIR');
      expect(PatternType.STRAIGHT).toBe('STRAIGHT');
      expect(PatternType.CONSECUTIVE_PAIRS).toBe('CONSECUTIVE_PAIRS');
      expect(PatternType.AIRPLANE).toBe('AIRPLANE');
      expect(PatternType.AIRPLANE_SOLO_WINGS).toBe('AIRPLANE_SOLO_WINGS');
      expect(PatternType.AIRPLANE_PAIR_WINGS).toBe('AIRPLANE_PAIR_WINGS');
      expect(PatternType.BOMB).toBe('BOMB');
      expect(PatternType.JOKER_BOMB_SMALL).toBe('JOKER_BOMB_SMALL');
      expect(PatternType.JOKER_BOMB_BIG).toBe('JOKER_BOMB_BIG');
      expect(PatternType.INVALID).toBe('INVALID');
    });
  });

  describe('AC-2: CardPattern interface shape', () => {
    it('accepts a valid CardPattern object with all required fields', () => {
      const pattern: CardPattern = {
        type: PatternType.SINGLE,
        cards: [0],
        primaryValue: 3,
        length: 1,
      };
      expect(pattern.type).toBe(PatternType.SINGLE);
      expect(Array.isArray(pattern.cards)).toBe(true);
      expect(typeof pattern.primaryValue).toBe('number');
      expect(typeof pattern.length).toBe('number');
    });

    it('INVALID pattern has primaryValue=0', () => {
      const inv: CardPattern = {
        type: PatternType.INVALID,
        cards: [],
        primaryValue: 0,
        length: 0,
      };
      expect(inv.primaryValue).toBe(0);
    });
  });
});
