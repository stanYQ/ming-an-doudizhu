/**
 * @file CardDecomposer.ts
 * @description 手牌拆分引擎：最优拆牌（decompose）+ 最少手数（minTurns）+ 合法出法枚举（generateAll）
 * @module server/logic
 * @see specs/card-decomposer.md
 */

import { CardPattern, PatternType } from '../../../shared/CardPattern';
import { parse } from '../../../shared/PatternHelper';
import { compareValue, isJoker, isLargeJoker, isSmallJoker } from '../../../shared/CardEncoding';

export interface CardGroup {
  cards: number[];
  pattern: CardPattern;
}

export class CardDecomposer {
  /**
   * 将手牌拆成最少组数的最优方案。
   * 算法分层（按优先级）：王炸 → 炸弹 → 2/A → 飞机 → 顺子 → 连对 → 三张 → 对子 → 单张
   */
  static decompose(hand: number[]): CardGroup[] {
    if (hand.length === 0) return [];

    const pool = [...hand];
    const result: CardGroup[] = [];

    /** 将 pool 中指定 cards 移除并返回 CardGroup */
    function commit(cards: number[]): CardGroup {
      for (const c of cards) {
        const i = pool.indexOf(c);
        if (i >= 0) pool.splice(i, 1);
      }
      return { cards, pattern: parse(cards) };
    }

    /** 从 pool 中按 cv 分组（排除 joker） */
    function groupRegular(): Map<number, number[]> {
      const map = new Map<number, number[]>();
      for (const c of pool) {
        if (isJoker(c)) continue;
        const cv = compareValue(c);
        if (!map.has(cv)) map.set(cv, []);
        map.get(cv)!.push(c);
      }
      return map;
    }

    /**
     * 贪心提取连续序列：每轮找最长满足条件的序列并 commit。
     * @param perCv  每个 cv 取几张（3=飞机核心，2=连对，1=顺子）
     * @param minLen 序列最短长度（以 cv 数计）
     */
    function extractSeq(perCv: number, minLen: number): void {
      let found = true;
      while (found) {
        found = false;
        const map = new Map<number, number[]>();
        for (const c of pool) {
          if (isJoker(c)) continue;
          const cv = compareValue(c);
          if (cv < 3 || cv > 13) continue; // 顺子/连对/飞机不含 A(14)/2(15)/王
          if (!map.has(cv)) map.set(cv, []);
          map.get(cv)!.push(c);
        }

        const eligible = [...map.entries()]
          .filter(([, cs]) => cs.length >= perCv)
          .map(([cv]) => cv)
          .sort((a, b) => a - b);

        let bestStart = -1, bestLen = 0;
        for (let i = 0; i < eligible.length; i++) {
          let len = 1;
          while (i + len < eligible.length && eligible[i + len] === eligible[i] + len) len++;
          if (len >= minLen && len > bestLen) {
            bestLen = len;
            bestStart = eligible[i];
          }
        }

        if (bestLen >= minLen) {
          const cards: number[] = [];
          for (let cv = bestStart; cv < bestStart + bestLen; cv++) {
            cards.push(...map.get(cv)!.slice(0, perCv));
          }
          result.push(commit(cards));
          found = true;
        }
      }
    }

    // ── 1. 王炸 ─────────────────────────────────────────────────────────────
    const largeJ = pool.filter(isLargeJoker);
    if (largeJ.length >= 2) result.push(commit(largeJ.slice(0, 2)));

    const smallJ = pool.filter(isSmallJoker);
    if (smallJ.length >= 2) result.push(commit(smallJ.slice(0, 2)));

    // 孤立王 → 单张
    for (const c of [...pool].filter(isJoker)) result.push(commit([c]));

    // ── 2. 普通炸弹（4+ 同点，整组取走，张数越多越好） ─────────────────────
    {
      const map = groupRegular();
      [...map.entries()]
        .filter(([, cs]) => cs.length >= 4)
        .forEach(([, cs]) => result.push(commit(cs)));
    }

    // ── 3. 2 和 A 不进顺子/连对/飞机，单独处理 ─────────────────────────────
    for (const specialCv of [15, 14]) {
      const map = groupRegular();
      const cs = map.get(specialCv) ?? [];
      if (cs.length === 0) continue;
      // 尽量合并：3张→三张，2张→对子，1张→单张
      result.push(commit(cs.slice(0, Math.min(3, cs.length))));
      for (const c of cs.slice(3)) result.push(commit([c]));
    }

    // ── 4. 飞机（≥2 连续三张，贪心最长） ──────────────────────────────────
    extractSeq(3, 2);

    // ── 5. 顺子（≥5 连续单张，贪心最长） ──────────────────────────────────
    extractSeq(1, 5);

    // ── 6. 连对（≥3 连续对子，贪心最长） ──────────────────────────────────
    extractSeq(2, 3);

    // ── 7. 剩余三张 ──────────────────────────────────────────────────────────
    {
      const map = groupRegular();
      [...map.entries()]
        .filter(([cv, cs]) => cv <= 13 && cs.length >= 3)
        .sort(([a], [b]) => a - b)
        .forEach(([, cs]) => result.push(commit(cs.slice(0, 3))));
    }

    // ── 8. 剩余对子 ──────────────────────────────────────────────────────────
    {
      const map = groupRegular();
      [...map.entries()]
        .filter(([cv, cs]) => cv <= 13 && cs.length >= 2)
        .sort(([a], [b]) => a - b)
        .forEach(([, cs]) => result.push(commit(cs.slice(0, 2))));
    }

    // ── 9. 剩余单张 ──────────────────────────────────────────────────────────
    for (const c of [...pool]) result.push(commit([c]));

    return result;
  }

  /**
   * 最少需要多少手出完手牌（无对手干扰）。
   */
  static minTurns(hand: number[]): number {
    return CardDecomposer.decompose(hand).length;
  }

  /**
   * 枚举手牌中所有合法的单次出法（不含带翅膀牌型）。
   * 用于 AIPlayer V2 候选集构建。
   */
  static generateAll(hand: number[]): number[][] {
    if (hand.length === 0) return [];

    const results: number[][] = [];
    const seen = new Set<string>();

    function add(cards: number[]): void {
      const sorted = [...cards].sort((a, b) => a - b);
      const key = sorted.join(',');
      if (seen.has(key)) return;
      seen.add(key);
      if (parse(sorted).type !== PatternType.INVALID) {
        results.push(sorted);
      }
    }

    // cv → 手中该 cv 的物理牌列表
    const cvMap = new Map<number, number[]>();
    for (const c of hand) {
      const cv = compareValue(c);
      if (!cvMap.has(cv)) cvMap.set(cv, []);
      cvMap.get(cv)!.push(c);
    }

    // 王炸
    const smallJ = hand.filter(isSmallJoker);
    const largeJ = hand.filter(isLargeJoker);
    if (largeJ.length >= 2) add(largeJ.slice(0, 2));
    if (smallJ.length >= 2) add(smallJ.slice(0, 2));

    // 每个 cv：单张、对子、三张、炸弹（4–8张）
    for (const [, cards] of cvMap.entries()) {
      add([cards[0]]);
      if (cards.length >= 2) add(cards.slice(0, 2));
      if (cards.length >= 3) add(cards.slice(0, 3));
      for (let n = 4; n <= Math.min(8, cards.length); n++) add(cards.slice(0, n));
    }

    // 顺子 / 连对 / 飞机的候选 cv（3–13 范围）
    const seqEntries = [...cvMap.entries()]
      .filter(([cv]) => cv >= 3 && cv <= 13)
      .sort(([a], [b]) => a - b);

    // 顺子：连续单张 ≥5
    for (let i = 0; i < seqEntries.length; i++) {
      const strCards = [seqEntries[i][1][0]];
      let prevCv = seqEntries[i][0];
      for (let j = i + 1; j < seqEntries.length; j++) {
        if (seqEntries[j][0] !== prevCv + 1) break;
        prevCv = seqEntries[j][0];
        strCards.push(seqEntries[j][1][0]);
        if (strCards.length >= 5) add([...strCards]);
      }
    }

    // 连对：连续对子 ≥3 对
    const pairEntries = seqEntries.filter(([, cs]) => cs.length >= 2);
    for (let i = 0; i < pairEntries.length; i++) {
      const cpCards = [...pairEntries[i][1].slice(0, 2)];
      let prevCv = pairEntries[i][0];
      for (let j = i + 1; j < pairEntries.length; j++) {
        if (pairEntries[j][0] !== prevCv + 1) break;
        prevCv = pairEntries[j][0];
        cpCards.push(...pairEntries[j][1].slice(0, 2));
        if (cpCards.length >= 6) add([...cpCards]);
      }
    }

    // 飞机（无翅膀）：连续三张 ≥2 组
    const tripleEntries = seqEntries.filter(([, cs]) => cs.length >= 3);
    for (let i = 0; i < tripleEntries.length; i++) {
      const apCards = [...tripleEntries[i][1].slice(0, 3)];
      let prevCv = tripleEntries[i][0];
      for (let j = i + 1; j < tripleEntries.length; j++) {
        if (tripleEntries[j][0] !== prevCv + 1) break;
        prevCv = tripleEntries[j][0];
        apCards.push(...tripleEntries[j][1].slice(0, 3));
        if (apCards.length >= 6) add([...apCards]);
      }
    }

    return results;
  }
}
