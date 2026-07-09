/**
 * @file CardPatternEngine.ts
 * @description 牌型识别引擎：权威版牌型解析（单张/对子/顺子/炸弹/王炸）
 * @module server/logic
 */

import { CardPattern, PatternType } from '../../../shared/CardPattern';
import { parse, canBeat } from '../../../shared/PatternHelper';

export class CardPatternEngine {
  static parse(cards: number[]): CardPattern | null {
    const p = parse(cards);
    return p.type === PatternType.INVALID ? null : p;
  }

  static canBeat(challenger: CardPattern | null, current: CardPattern | null): boolean {
    if (challenger === null) return false;
    if (current === null) return true;
    return canBeat(challenger, current);
  }
}
