import { CardPattern, PatternType } from './CardPattern';
import { compareValue, isJoker, isLargeJoker, isSmallJoker } from './CardEncoding';

function invalid(cards: number[]): CardPattern {
  return { type: PatternType.INVALID, cards, primaryValue: 0, length: cards.length };
}

function isConsecutive(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

/**
 * 将编码整数数组识别为 CardPattern。
 * 永不抛出异常，非法输入返回 { type: INVALID, ... }。
 */
export function parse(cards: number[]): CardPattern {
  if (cards.length === 0) return invalid(cards);

  const jokers   = cards.filter(c => isJoker(c));
  const regulars = cards.filter(c => !isJoker(c));

  // ── joker-only patterns ───────────────────────────────────────────────────
  if (jokers.length === 2 && regulars.length === 0) {
    const largeCount = jokers.filter(c => isLargeJoker(c)).length;
    const smallCount = jokers.filter(c => isSmallJoker(c)).length;
    if (largeCount === 2) return { type: PatternType.JOKER_BOMB_BIG,   cards, primaryValue: 17, length: 2 };
    if (smallCount === 2) return { type: PatternType.JOKER_BOMB_SMALL, cards, primaryValue: 16, length: 2 };
    return invalid(cards); // 1 small + 1 large
  }

  // any remaining joker combination (mixed, 1, 3+, joker+regular) → INVALID
  if (jokers.length > 0) return invalid(cards);

  // ── group regular cards by compareValue (sorted ascending) ───────────────
  const cvMap = new Map<number, number[]>();
  for (const c of regulars) {
    const cv = compareValue(c);
    if (!cvMap.has(cv)) cvMap.set(cv, []);
    cvMap.get(cv)!.push(c);
  }

  const groups  = [...cvMap.entries()].sort((a, b) => a[0] - b[0]);
  const counts  = groups.map(([, cs]) => cs.length);
  const values  = groups.map(([cv]) => cv);
  const n       = cards.length;

  // ── single ────────────────────────────────────────────────────────────────
  if (n === 1) {
    return { type: PatternType.SINGLE, cards, primaryValue: compareValue(cards[0]), length: 1 };
  }

  // ── pair ──────────────────────────────────────────────────────────────────
  if (n === 2 && groups.length === 1 && counts[0] === 2) {
    return { type: PatternType.PAIR, cards, primaryValue: values[0], length: 2 };
  }

  // ── triple ────────────────────────────────────────────────────────────────
  if (n === 3 && groups.length === 1 && counts[0] === 3) {
    return { type: PatternType.TRIPLE, cards, primaryValue: values[0], length: 3 };
  }

  // ── bomb (4-8 same) ───────────────────────────────────────────────────────
  if (groups.length === 1 && n >= 4 && n <= 8) {
    return { type: PatternType.BOMB, cards, primaryValue: values[0], length: n };
  }

  // ── triple + solo (3+1) ───────────────────────────────────────────────────
  if (n === 4 && groups.length === 2) {
    const ti = counts.findIndex(c => c === 3);
    if (ti !== -1) {
      return { type: PatternType.TRIPLE_SOLO, cards, primaryValue: values[ti], length: 4 };
    }
  }

  // ── triple + pair (3+2) ───────────────────────────────────────────────────
  if (n === 5 && groups.length === 2) {
    const ti = counts.findIndex(c => c === 3);
    const pi = counts.findIndex(c => c === 2);
    if (ti !== -1 && pi !== -1) {
      return { type: PatternType.TRIPLE_PAIR, cards, primaryValue: values[ti], length: 5 };
    }
    return invalid(cards);
  }

  // ── straight (≥5, all unique, consecutive, rank 3-K) ─────────────────────
  if (n >= 5 && counts.every(c => c === 1)) {
    if (values.every(v => v <= 13) && isConsecutive(values)) {
      return { type: PatternType.STRAIGHT, cards, primaryValue: values[values.length - 1], length: n };
    }
    return invalid(cards);
  }

  // ── consecutive pairs (≥6 even, ≥3 pairs, consecutive, rank 3-K) ─────────
  if (n >= 6 && n % 2 === 0 && counts.every(c => c === 2)) {
    if (values.length >= 3 && values.every(v => v <= 13) && isConsecutive(values)) {
      return { type: PatternType.CONSECUTIVE_PAIRS, cards, primaryValue: values[values.length - 1], length: n };
    }
    return invalid(cards);
  }

  // ── airplane variants (≥2 consecutive triples, rank 3-K) ──────────────────
  const tripleValues = groups.filter(([, cs]) => cs.length === 3).map(([cv]) => cv);
  const wingGroups   = groups.filter(([, cs]) => cs.length !== 3);

  if (tripleValues.length >= 2 && tripleValues.every(v => v <= 13) && isConsecutive(tripleValues)) {
    const coreCount = tripleValues.length * 3;
    const wingCount = wingGroups.reduce((s, [, cs]) => s + cs.length, 0);
    const primaryValue = tripleValues[tripleValues.length - 1];

    if (wingCount === 0 && n === coreCount) {
      return { type: PatternType.AIRPLANE, cards, primaryValue, length: n };
    }
    if (
      wingGroups.length === tripleValues.length &&
      wingGroups.every(([, cs]) => cs.length === 1)
    ) {
      return { type: PatternType.AIRPLANE_SOLO_WINGS, cards, primaryValue, length: n };
    }
    if (
      wingGroups.length === tripleValues.length &&
      wingGroups.every(([, cs]) => cs.length === 2)
    ) {
      return { type: PatternType.AIRPLANE_PAIR_WINGS, cards, primaryValue, length: n };
    }
    return invalid(cards);
  }

  return invalid(cards);
}

/**
 * 判断 challenger 是否能严格压过 current。
 */
export function canBeat(challenger: CardPattern, current: CardPattern): boolean {
  if (challenger.type === PatternType.INVALID || current.type === PatternType.INVALID) return false;

  // 双大王炸无敌
  if (current.type === PatternType.JOKER_BOMB_BIG) return false;
  if (challenger.type === PatternType.JOKER_BOMB_BIG) return true;

  // 双小王炸 > 任意普通炸弹/普通牌型，但不压另一双小王炸
  if (challenger.type === PatternType.JOKER_BOMB_SMALL) {
    return current.type !== PatternType.JOKER_BOMB_SMALL;
  }

  // 普通炸弹 vs 普通炸弹：先比张数，再比点数
  if (challenger.type === PatternType.BOMB && current.type === PatternType.BOMB) {
    if (challenger.length !== current.length) return challenger.length > current.length;
    return challenger.primaryValue > current.primaryValue;
  }

  // 普通炸弹压普通牌型
  if (challenger.type === PatternType.BOMB) return true;
  if (current.type === PatternType.BOMB)    return false;

  // 普通牌型：类型相同 + 长度相同 + 点数更高
  if (challenger.type !== current.type)     return false;
  if (challenger.length !== current.length) return false;
  return challenger.primaryValue > current.primaryValue;
}
