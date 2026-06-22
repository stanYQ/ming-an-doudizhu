/**
 * @file AIPlayer.ts
 * @description AIPlayer V2：残手权重（ZhouWeikuan 法）+ 阵营感知。
 *              接口与 V1 完全相同，CardRoom 无需修改（AC-22）。
 * @module server/logic
 * @see specs/smart-ai-player.md
 */

import { CardDecomposer } from './CardDecomposer';
import { parse, canBeat } from '../../../shared/PatternHelper';
import { CardPattern, PatternType } from '../../../shared/CardPattern';
import { compareValue } from '../../../shared/CardEncoding';

export type AIRole = 'unknown' | 'landlord' | 'partner' | 'civilian';

export interface AIContext {
  role: AIRole;
  allyId: string | null;        // 暗队友 sessionId（揭示后）
  isLandlordAlone: boolean;     // true = 一挑四模式
  myHandCount: number;          // 自己当前手牌数
}

const K_ONE_HAND = -150;   // ZhouWeikuan 残手权重常数
const BOMB_BONUS  = 50;    // 每个炸弹的保留奖励

const BOMB_TYPES = new Set<PatternType>([
  PatternType.BOMB,
  PatternType.JOKER_BOMB_SMALL,
  PatternType.JOKER_BOMB_BIG,
]);

function isBombPlay(cards: number[]): boolean {
  return BOMB_TYPES.has(parse(cards).type);
}

function removeCards(hand: number[], played: number[]): number[] {
  const rem = [...hand];
  for (const c of played) {
    const i = rem.indexOf(c);
    if (i >= 0) rem.splice(i, 1);
  }
  return rem;
}

export class AIPlayer {
  /**
   * 残手权重评分。得分越高，手牌越好出完。
   * handPower = -150 × minTurns + Σ compareValue + bombCount × 50
   */
  static handPower(hand: number[]): number {
    if (hand.length === 0) return 0;
    const groups   = CardDecomposer.decompose(hand);
    const minTurns = groups.length;
    const cardSum  = hand.reduce((s, c) => s + compareValue(c), 0);
    const bombCnt  = groups.filter(g => BOMB_TYPES.has(g.pattern.type)).length;
    return K_ONE_HAND * minTurns + cardSum + bombCnt * BOMB_BONUS;
  }

  /**
   * 决策出牌。
   * @param hand     当前手牌（编码整数数组）
   * @param lastPlay 上家出的牌型，null 表示自由出牌轮
   * @param context  可选阵营上下文；不传时退化为自保策略
   * @returns 出牌数组；空数组表示 pass
   */
  static decide(hand: number[], lastPlay: CardPattern | null, context?: AIContext): number[] {
    if (hand.length === 0) return [];

    const candidates = CardDecomposer.generateAll(hand);

    function scoreAfter(cards: number[]): number {
      return AIPlayer.handPower(removeCards(hand, cards));
    }

    function bestBy(pool: number[][]): number[] {
      return pool.reduce((best, c) => (scoreAfter(c) > scoreAfter(best) ? c : best));
    }

    // ── 自由出牌 ──────────────────────────────────────────────────────────────
    if (lastPlay === null) {
      const normals = candidates.filter(c => !isBombPlay(c));

      // 激进模式：一挑四，或地主手牌 ≤ 8 张
      const aggressiveMode =
        context?.isLandlordAlone === true ||
        (context?.role === 'landlord' && hand.length <= 8);

      const pool = normals.length > 0 && !aggressiveMode ? normals : candidates;
      return pool.length > 0 ? bestBy(pool) : AIPlayer.pickSmallestSingle(hand);
    }

    // ── 跟牌 ─────────────────────────────────────────────────────────────────
    const beaters       = candidates.filter(c => canBeat(parse(c), lastPlay));
    const normalBeaters = beaters.filter(c => !isBombPlay(c));
    const bombBeaters   = beaters.filter(c => isBombPlay(c));

    // partner 策略：只有代价超过两个完整组（>300）才让牌
    // 调参记录：threshold=0→40.3%，150→43.9%，300→待测
    if (context?.role === 'partner' && normalBeaters.length > 0) {
      const playScore = scoreAfter(bestBy(normalBeaters));
      if (AIPlayer.handPower(hand) - playScore > 300) return [];
    }

    if (normalBeaters.length > 0) return bestBy(normalBeaters);

    if (bombBeaters.length > 0) {
      // 最小炸弹：primaryValue 最低，次按张数最少
      return bombBeaters.reduce((best, c) => {
        const bp = parse(best), cp = parse(c);
        if (cp.primaryValue !== bp.primaryValue)
          return cp.primaryValue < bp.primaryValue ? c : best;
        return cp.length < bp.length ? c : best;
      });
    }

    return []; // pass
  }

  /**
   * 从手牌中找 compareValue 最小的单张（超时托管紧急模式 / 向后兼容）。
   */
  static pickSmallestSingle(hand: number[]): number[] {
    if (hand.length === 0) return [];
    const smallest = hand.reduce((a, b) => (compareValue(a) <= compareValue(b) ? a : b));
    return [smallest];
  }
}
