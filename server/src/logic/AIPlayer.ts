/**
 * @file AIPlayer.ts
 * @description 补位 AI / 托管模式的纯函数出牌决策。策略刻意保守，不干扰对局结果。
 * @module server/AIPlayer
 * @see specs/ai-player.md
 */

import { compareValue } from "../../../shared/CardEncoding";
import type { CardPattern } from "../../../shared/CardPattern";

export class AIPlayer {
  /**
   * 决策出牌。
   * @param hand     当前手牌（编码整数数组）
   * @param lastPlay 上家出的牌型，null 表示自由出牌轮
   * @returns 出牌数组；空数组表示 pass
   */
  static decide(hand: number[], lastPlay: CardPattern | null): number[] {
    if (hand.length === 0) return [];

    // AC-2: 跟牌轮 → 直接 pass
    if (lastPlay !== null) return [];

    // AC-1/AC-3: 自由出牌轮 → 出 compareValue 最小的单张
    return AIPlayer.pickSmallestSingle(hand);
  }

  /**
   * 从手牌中找 compareValue 最小的单张并返回（长度 1 的数组）。
   * AC-3: 手牌全为王/炸弹时也照常返回最小单张。
   */
  static pickSmallestSingle(hand: number[]): number[] {
    if (hand.length === 0) return [];
    const smallest = hand.reduce((a, b) => (compareValue(a) <= compareValue(b) ? a : b));
    return [smallest];
  }
}
