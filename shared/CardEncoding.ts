/**
 * @file CardEncoding.ts
 * @description 双副牌（108张）编码 / 解码工具。将每张牌映射为 0–107 的唯一整数，
 *              并提供 compareValue 供牌型引擎做大小比较。
 * @module shared/CardEncoding
 * @see GAME-RULES §2 牌值编码
 */

// deck ∈ {0,1}  suit ∈ {0=♠,1=♥,2=♦,3=♣}  rank ∈ {0=3,...,12=2}
// 普通牌: deck×54 + suit×13 + rank
// 小王:   deck×54 + 52
// 大王:   deck×54 + 53

/** decode 的返回值类型：普通牌或大/小王 */
export type DecodeResult =
  | { deck: number; suit: number; rank: number; isJoker: false }
  | { deck: number; isJoker: true; isLarge: boolean };

/**
 * 将普通牌编码为 0–107 整数。
 * @param deck  副牌索引，0 或 1
 * @param suit  花色，0=♠ 1=♥ 2=♦ 3=♣
 * @param rank  点数，0=3 … 12=2
 * @returns 编码整数，范围 [0,53] ∪ [54,107]（非王牌部分）
 */
export function encode(deck: number, suit: number, rank: number): number {
  return deck * 54 + suit * 13 + rank;
}

/**
 * 将大王或小王编码为 0–107 整数。
 * @param deck    副牌索引，0 或 1
 * @param isLarge true=大王，false=小王
 * @returns 编码整数；小王=deck×54+52，大王=deck×54+53
 */
export function encodeJoker(deck: number, isLarge: boolean): number {
  return deck * 54 + (isLarge ? 53 : 52);
}

/**
 * 将编码整数还原为牌的属性（encode / encodeJoker 的逆运算）。
 * @param card 编码整数 0–107
 * @returns 普通牌返回 { deck, suit, rank, isJoker:false }；
 *          大/小王返回 { deck, isJoker:true, isLarge }
 */
export function decode(card: number): DecodeResult {
  const deck = Math.floor(card / 54);
  const within = card % 54;
  if (within >= 52) {
    return { deck, isJoker: true, isLarge: within === 53 };
  }
  return { deck, suit: Math.floor(within / 13), rank: within % 13, isJoker: false };
}

/**
 * 返回牌的比较权重，用于 PatternHelper / RuleEngine 判断大小。
 *
 * 映射表（来自 GAME-RULES §2.2）：
 *   大王=17  小王=16  2=15  A=14  K=13  Q=12  J=11
 *   10=10  9=9  8=8  7=7  6=6  5=5  4=4  3=3
 *
 * 普通牌规律：compareValue = rank + 3（rank 0–12 → value 3–15）
 *
 * @param card 编码整数 0–107
 * @returns 比较权重，整数域 [3, 17]
 */
export function compareValue(card: number): number {
  if (isLargeJoker(card)) return 17;
  if (isSmallJoker(card)) return 16;
  return getRank(card) + 3;
}

/**
 * 判断是否为大王或小王。
 * @param card 编码整数 0–107
 */
export function isJoker(card: number): boolean {
  return card % 54 >= 52;
}

/**
 * 判断是否为大王（card % 54 === 53）。
 * @param card 编码整数 0–107
 */
export function isLargeJoker(card: number): boolean {
  return card % 54 === 53;
}

/**
 * 判断是否为小王（card % 54 === 52）。
 * @param card 编码整数 0–107
 */
export function isSmallJoker(card: number): boolean {
  return card % 54 === 52;
}

/**
 * 返回副牌索引（0 或 1）。
 * @param card 编码整数 0–107
 */
export function getDeck(card: number): number {
  return Math.floor(card / 54);
}

/**
 * 返回花色（0–3）。大/小王调用结果无意义。
 * @param card 编码整数 0–107
 */
export function getSuit(card: number): number {
  return Math.floor((card % 54) / 13);
}

/**
 * 返回点数索引（0–12）。大/小王调用结果无意义。
 * @param card 编码整数 0–107
 */
export function getRank(card: number): number {
  return (card % 54) % 13;
}
