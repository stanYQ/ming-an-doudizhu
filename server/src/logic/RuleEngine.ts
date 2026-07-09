/**
 * @file RuleEngine.ts
 * @description 游戏规则引擎：出牌合法性校验 + 手牌所有权验证 + 胜负判定
 * @module server/logic
 */

import { CardPattern } from '../../../shared/CardPattern';
import { CardPatternEngine } from './CardPatternEngine';

export type WinnerCamp = 'landlord_camp' | 'civilian_camp';

export interface ValidateResult {
  ok: boolean;
  pattern: CardPattern;
  errorCode?: 1001 | 1002 | 1004;
}

export class RuleEngine {
  static ownsAll(hand: number[], cards: number[]): boolean {
    const pool = [...hand];
    for (const c of cards) {
      const idx = pool.indexOf(c);
      if (idx === -1) return false;
      pool.splice(idx, 1);
    }
    return true;
  }

  static removeCards(hand: number[], cards: number[]): void {
    for (const c of cards) {
      const idx = hand.indexOf(c);
      if (idx !== -1) hand.splice(idx, 1);
    }
  }

  static validatePlay(
    hand: number[],
    cards: number[],
    lastPlay: CardPattern | null,
  ): ValidateResult {
    const invalid = (errorCode: 1001 | 1002 | 1004): ValidateResult =>
      ({ ok: false, pattern: null as unknown as CardPattern, errorCode });

    if (!RuleEngine.ownsAll(hand, cards)) return invalid(1004);

    const pattern = CardPatternEngine.parse(cards);
    if (!pattern) return invalid(1001);

    if (!CardPatternEngine.canBeat(pattern, lastPlay)) return invalid(1002);

    return { ok: true, pattern };
  }

  static determineWinner(
    emptyHandPlayerId: string,
    landlordId: string,
    partnerId: string | null,
  ): WinnerCamp {
    if (emptyHandPlayerId === landlordId) return 'landlord_camp';
    if (partnerId !== null && emptyHandPlayerId === partnerId) return 'landlord_camp';
    return 'civilian_camp';
  }
}
