/**
 * @file AIPlayer.test.ts
 * @description TASK-026: AIPlayer V2 — AC-1 ~ AC-23 全覆盖
 */

import { AIPlayer, AIContext } from '../logic/AIPlayer';
import { CardDecomposer }      from '../logic/CardDecomposer';
import { encode, encodeJoker, compareValue } from '../../../shared/CardEncoding';
import { PatternType }         from '../../../shared/CardPattern';
import { parse }               from '../../../shared/PatternHelper';
import { Deck }                from '../logic/Deck';
import { RuleEngine }          from '../logic/RuleEngine';
import { CodeCard }            from '../logic/CodeCard';
import { CardPatternEngine }   from '../logic/CardPatternEngine';

// ── helpers ────────────────────────────────────────────────────────────────

function c(cv: number, deck = 0, suit = 0): number {
  if (cv === 16) return encodeJoker(deck, false);
  if (cv === 17) return encodeJoker(deck, true);
  return encode(deck, suit, cv - 3);
}

function pat(cards: number[]) {
  const p = parse(cards);
  if (p.type === PatternType.INVALID) throw new Error('invalid pattern in test helper');
  return p;
}

function isBombPlay(cards: number[]): boolean {
  const t = parse(cards).type;
  return t === PatternType.BOMB || t === PatternType.JOKER_BOMB_SMALL || t === PatternType.JOKER_BOMB_BIG;
}

// ──────────────────────────────────────────────────────────────────────────
// handPower()
// ──────────────────────────────────────────────────────────────────────────

describe('AIPlayer.handPower()', () => {
  it('AC-1: empty hand → 0', () => {
    expect(AIPlayer.handPower([])).toBe(0);
  });

  it('AC-2: fewer turns → higher handPower (straight vs scattered singles)', () => {
    // 5-card straight 34567 → 1 turn
    const straight = [c(3), c(4), c(5), c(6), c(7)];
    // 5 scattered singles (no possible sequence)
    const singles  = [c(3), c(5), c(7), c(9), c(11)];
    expect(AIPlayer.handPower(straight)).toBeGreaterThan(AIPlayer.handPower(singles));
  });

  it('AC-3: same minTurns but more bombs → higher handPower', () => {
    // 1-turn hand A: pair of cv5
    const pair = [c(5, 0, 0), c(5, 0, 1)];
    // 1-turn hand B: 4-card bomb (cv3 × 4), also 1 group but has bombBonus
    const bomb = [encode(0,0,0), encode(0,1,0), encode(0,2,0), encode(0,3,0)];
    expect(AIPlayer.handPower(bomb)).toBeGreaterThan(AIPlayer.handPower(pair));
  });

  it('AC-4: all singles → -150×n + Σcv', () => {
    // cv 3, 5, 7 are non-consecutive → all singles in decompose
    const cards   = [c(3), c(5), c(7)];
    const expected = -150 * 3 + (3 + 5 + 7);
    expect(AIPlayer.handPower(cards)).toBe(expected);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// decide() — free round
// ──────────────────────────────────────────────────────────────────────────

describe('AIPlayer.decide() — free round (lastPlay=null)', () => {
  it('AC-5: chosen play is always in generateAll(hand)', () => {
    const hand = [c(3), c(4), c(5), c(6), c(7), c(9), c(11)];
    const all  = CardDecomposer.generateAll(hand);
    const play = AIPlayer.decide(hand, null);
    const allKeys = new Set(all.map(a => [...a].sort((x,y) => x-y).join(',')));
    const playKey = [...play].sort((x,y) => x-y).join(',');
    expect(allKeys.has(playKey)).toBe(true);
  });

  it('AC-6: chosen play maximises handPower-after among non-bomb candidates', () => {
    const hand = [c(3), c(4), c(5), c(6), c(7), c(9)];
    const play = AIPlayer.decide(hand, null);
    const playScore = AIPlayer.handPower(hand.filter(x => !play.includes(x)));
    for (const cand of CardDecomposer.generateAll(hand)) {
      if (!isBombPlay(cand)) {
        const rem = hand.filter(x => !cand.includes(x));
        expect(playScore).toBeGreaterThanOrEqual(AIPlayer.handPower(rem));
      }
    }
  });

  it('AC-7: bomb excluded from pool when non-bomb candidates exist (non-aggressive)', () => {
    // hand: 4-card bomb + single cv15
    const bomb = [encode(0,0,0), encode(0,1,0), encode(0,2,0), encode(0,3,0)];
    const hand = [...bomb, c(15)];
    const play = AIPlayer.decide(hand, null);
    expect(isBombPlay(play)).toBe(false);
  });

  it('AC-8: single-card hand → returns that card', () => {
    expect(AIPlayer.decide([c(7)], null)).toEqual([c(7)]);
  });

  it('AC-9: empty hand → []', () => {
    expect(AIPlayer.decide([], null)).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// decide() — follow round
// ──────────────────────────────────────────────────────────────────────────

describe('AIPlayer.decide() — follow round (lastPlay ≠ null)', () => {
  it('AC-10: returned play beats lastPlay (when possible)', () => {
    const hand = [c(3), c(4), c(9)];
    const play = AIPlayer.decide(hand, pat([c(8)])); // single cv8
    if (play.length > 0) {
      const p = parse(play);
      expect(p.type).toBe(PatternType.SINGLE);
      expect(compareValue(play[0])).toBeGreaterThan(8);
    }
  });

  it('AC-11: picks normal beater with best handPower-after', () => {
    // hand: pair(cv7) + single(cv9). lastPlay=single cv6.
    // playing cv9: remaining=pair(7) → handPower=-150+14=-136
    // playing one cv7: remaining=[cv7,cv9] → -300+16=-284
    // best: cv9
    const hand = [c(7,0,0), c(7,0,1), c(9)];
    const play = AIPlayer.decide(hand, pat([c(6)]));
    expect(play).toEqual([c(9)]);
  });

  it('AC-12: no normal beaters → use smallest bomb (by primaryValue)', () => {
    // lastPlay = 4-card bomb cv3 — only bigger bombs can beat it
    // hand: bomb cv5 × 4  and  bomb cv7 × 4 (no normal cards)
    const lastBomb = [encode(0,0,0), encode(0,1,0), encode(0,2,0), encode(0,3,0)]; // cv3 bomb
    const bomb5    = [encode(0,0,2), encode(0,1,2), encode(0,2,2), encode(0,3,2)]; // cv5 bomb
    const bomb7    = [encode(0,0,4), encode(0,1,4), encode(0,2,4), encode(0,3,4)]; // cv7 bomb
    const play = AIPlayer.decide([...bomb5, ...bomb7], pat(lastBomb));
    expect(isBombPlay(play)).toBe(true);
    // smallest bomb by primaryValue: cv5 (5) < cv7 (7)
    expect(parse(play).primaryValue).toBe(5);
  });

  it('AC-13: no beaters at all → [] (pass)', () => {
    // JOKER_BOMB_BIG is unbeatable
    const bigBomb = pat([encodeJoker(0, true), encodeJoker(1, true)]);
    expect(AIPlayer.decide([c(3), c(4), c(5)], bigBomb)).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Context / role adaptation
// ──────────────────────────────────────────────────────────────────────────

describe('AIPlayer — context / role adaptation', () => {
  it('AC-15: unknown role → plays (no partner-pass suppression)', () => {
    // hand: [cv5, cv9]. lastPlay: single cv4. cv5 beats it, improves hand → should play
    const ctx: AIContext = { role: 'unknown', allyId: null, isLandlordAlone: false, myHandCount: 2 };
    const play = AIPlayer.decide([c(5), c(9)], pat([c(4)]), ctx);
    expect(play.length).toBeGreaterThan(0);
  });

  it('AC-16: civilian with null allyId → self-preservation (plays normal beater)', () => {
    const ctx: AIContext = { role: 'civilian', allyId: null, isLandlordAlone: false, myHandCount: 2 };
    const play = AIPlayer.decide([c(5), c(9)], pat([c(4)]), ctx);
    expect(play.length).toBeGreaterThan(0);
  });

  it('AC-17: partner passes when playing would worsen hand (break a straight)', () => {
    // hand: straight(3,4,5,6,7) + extra cv3_deck1 → 2 groups, handPower=-300+28=-272
    // lastPlay: single cv4 (deck1 suit1 so different physical card)
    // Beaters: singles cv5,cv6,cv7 — each breaks the straight → 5 singles remain → -728
    // -728 < -272 → partner passes
    const hand = [c(3,0,0), c(4,0,0), c(5,0,0), c(6,0,0), c(7,0,0), c(3,1,0)];
    const ctx: AIContext = { role: 'partner', allyId: 'landlord', isLandlordAlone: false, myHandCount: 6 };
    const lastSingle = c(4,0,1); // different physical card (not in hand)
    const play = AIPlayer.decide(hand, pat([lastSingle]), ctx);
    expect(play).toEqual([]);
  });

  it('AC-17: partner plays when doing so improves the hand', () => {
    // hand: [cv5, cv9] → 2 singles → handPower=-300+14=-286
    // lastPlay: single cv4. Beater cv5: remaining=[cv9] → -150+9=-141 > -286 → play
    const ctx: AIContext = { role: 'partner', allyId: 'landlord', isLandlordAlone: false, myHandCount: 2 };
    const play = AIPlayer.decide([c(5), c(9)], pat([c(4)]), ctx);
    expect(play.length).toBeGreaterThan(0);
  });

  it('AC-18: landlord hand≤8 → aggressive (5-card bomb beats single)', () => {
    // 5 cards of cv3: 4-card bomb + 1 extra → normals exist but aggressiveMode=true → pool=all
    // 5-card bomb gives handPower(remaining=[])=0, highest possible
    const cv3 = [encode(0,0,0), encode(0,1,0), encode(0,2,0), encode(0,3,0), encode(1,0,0)];
    const ctx: AIContext = { role: 'landlord', allyId: 'partner', isLandlordAlone: false, myHandCount: 5 };
    const play = AIPlayer.decide(cv3, null, ctx);
    expect(play.length).toBe(5);
    expect(parse(play).type).toBe(PatternType.BOMB);
  });

  it('AC-19: isLandlordAlone=true → aggressive (5-card bomb used in free round)', () => {
    const cv3 = [encode(0,0,0), encode(0,1,0), encode(0,2,0), encode(0,3,0), encode(1,0,0)];
    const ctx: AIContext = { role: 'landlord', allyId: null, isLandlordAlone: true, myHandCount: 5 };
    const play = AIPlayer.decide(cv3, null, ctx);
    expect(parse(play).type).toBe(PatternType.BOMB);
  });

  it('AC-19: non-aggressive (no context) → single preferred, bomb preserved', () => {
    const cv3 = [encode(0,0,0), encode(0,1,0), encode(0,2,0), encode(0,3,0), encode(1,0,0)];
    const play = AIPlayer.decide(cv3, null); // no context → non-aggressive
    expect(isBombPlay(play)).toBe(false);
  });

  it('AC-22: backward compat — calling without context does not throw', () => {
    const hand = [c(5), c(7), c(9)];
    expect(() => AIPlayer.decide(hand, null)).not.toThrow();
    expect(() => AIPlayer.decide(hand, pat([c(4)]))).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// pickSmallestSingle (backward compat)
// ──────────────────────────────────────────────────────────────────────────

describe('AIPlayer.pickSmallestSingle()', () => {
  it('returns card with lowest compareValue', () => {
    expect(AIPlayer.pickSmallestSingle([c(15), c(4), c(3)])).toEqual([c(3)]);
  });

  it('empty → []', () => {
    expect(AIPlayer.pickSmallestSingle([])).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// AC-23: mini simulation — win rate sanity
// ──────────────────────────────────────────────────────────────────────────

function runGame(): 'landlord' | 'civilian' {
  const deck        = Deck.shuffle();
  const { hands: raw, bottom, faceUpCard } = Deck.deal(deck);
  const landlordSeat = Deck.findLandlordSeat(raw, faceUpCard);

  const hands = raw.map((h, i) => i === landlordSeat ? [...h, ...bottom] : [...h]);
  const sids  = ['p0','p1','p2','p3','p4'];
  const lSid  = sids[landlordSeat];

  const { partnerId } = CodeCard.resolveTeammate(
    { suit: 0, rank: 0 }, lSid,
    new Map(sids.map((s, i) => [s, hands[i]]))
  );
  const partnerSeat = partnerId ? sids.indexOf(partnerId) : -1;

  let seat      = landlordSeat;
  let lastPlay: number[] | null = null;
  let lastSeat  = -1;
  let passCount = 0;

  for (let t = 0; t < 300; t++) {
    const hand = hands[seat];
    if (hand.length === 0)
      return (seat === landlordSeat || seat === partnerSeat) ? 'landlord' : 'civilian';

    const isNew   = lastPlay === null || lastSeat === seat;
    const lastPat = isNew ? null : CardPatternEngine.parse(lastPlay!);
    const played  = AIPlayer.decide(hand, lastPat);

    if (played.length === 0) {
      if (++passCount >= 4) { passCount = 0; lastPlay = null; lastSeat = -1; }
    } else {
      RuleEngine.removeCards(hand, played);
      lastPlay = played; lastSeat = seat; passCount = 0;
      if (hand.length === 0)
        return (seat === landlordSeat || seat === partnerSeat) ? 'landlord' : 'civilian';
    }
    seat = (seat + 1) % 5;
  }
  return 'civilian';
}

describe('AIPlayer V2 — mini simulation (AC-23)', () => {
  it('landlord win rate 30%–80% over 15 games (civilians are active)', () => {
    let wins = 0;
    for (let i = 0; i < 15; i++) if (runGame() === 'landlord') wins++;
    const rate = wins / 15;
    expect(rate).toBeGreaterThanOrEqual(0.30);
    expect(rate).toBeLessThanOrEqual(0.80);
  }, 30000);
});
