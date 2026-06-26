import { Suit } from '../../../shared/CardPattern';
import { encode } from '../../../shared/CardEncoding';

export interface CodeCardSelection {
  suit: Suit;
  rank: number; // 0=3 … 7=10
}

export interface TeammateResult {
  partnerId: string | null;
  isLandlordAlone: boolean;
  codeCardPair: number[];
}

const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
const RANK_NAMES   = ['3','4','5','6','7','8','9','10'];

export class CodeCard {
  static isValidSelection(sel: CodeCardSelection): boolean {
    return sel.suit >= 0 && sel.suit <= 3 && sel.rank >= 0 && sel.rank <= 7;
  }

  static resolveTeammate(
    sel: CodeCardSelection,
    landlordId: string,
    hands: Map<string, number[]>,
  ): TeammateResult {
    const pair = [encode(0, sel.suit, sel.rank), encode(1, sel.suit, sel.rank)];

    // find first non-landlord player who holds at least one card of the pair
    for (const [playerId, hand] of hands) {
      if (playerId === landlordId) continue;
      if (pair.some(c => hand.includes(c))) {
        return { partnerId: playerId, isLandlordAlone: false, codeCardPair: pair };
      }
    }

    return { partnerId: null, isLandlordAlone: true, codeCardPair: pair };
  }

  static containsCodeCard(playedCards: number[], codeCardPair: number[]): boolean {
    return playedCards.some(c => codeCardPair.includes(c));
  }

  static describe(sel: CodeCardSelection): string {
    return `${SUIT_SYMBOLS[sel.suit]}${RANK_NAMES[sel.rank]}`;
  }
}
