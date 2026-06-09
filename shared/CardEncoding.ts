// deck ∈ {0,1}  suit ∈ {0=♠,1=♥,2=♦,3=♣}  rank ∈ {0=3,...,12=2}
// 普通牌: deck×54 + suit×13 + rank
// 小王:   deck×54 + 52
// 大王:   deck×54 + 53

export type DecodeResult =
  | { deck: number; suit: number; rank: number; isJoker: false }
  | { deck: number; isJoker: true; isLarge: boolean };

export function encode(deck: number, suit: number, rank: number): number {
  return deck * 54 + suit * 13 + rank;
}

export function encodeJoker(deck: number, isLarge: boolean): number {
  return deck * 54 + (isLarge ? 53 : 52);
}

export function decode(card: number): DecodeResult {
  const deck = Math.floor(card / 54);
  const within = card % 54;
  if (within >= 52) {
    return { deck, isJoker: true, isLarge: within === 53 };
  }
  return { deck, suit: Math.floor(within / 13), rank: within % 13, isJoker: false };
}

// compareValue 映射: 大王=17, 小王=16, 2=15, A=14, K=13, ..., 3=3
export function compareValue(card: number): number {
  if (isLargeJoker(card)) return 17;
  if (isSmallJoker(card)) return 16;
  return getRank(card) + 3;
}

export function isJoker(card: number): boolean {
  return card % 54 >= 52;
}

export function isLargeJoker(card: number): boolean {
  return card % 54 === 53;
}

export function isSmallJoker(card: number): boolean {
  return card % 54 === 52;
}

export function getDeck(card: number): number {
  return Math.floor(card / 54);
}

export function getSuit(card: number): number {
  return Math.floor((card % 54) / 13);
}

export function getRank(card: number): number {
  return (card % 54) % 13;
}
