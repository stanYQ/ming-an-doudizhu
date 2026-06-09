export enum PatternType {
  SINGLE              = 'SINGLE',
  PAIR                = 'PAIR',
  TRIPLE              = 'TRIPLE',
  TRIPLE_SOLO         = 'TRIPLE_SOLO',
  TRIPLE_PAIR         = 'TRIPLE_PAIR',
  STRAIGHT            = 'STRAIGHT',
  CONSECUTIVE_PAIRS   = 'CONSECUTIVE_PAIRS',
  AIRPLANE            = 'AIRPLANE',
  AIRPLANE_SOLO_WINGS = 'AIRPLANE_SOLO_WINGS',
  AIRPLANE_PAIR_WINGS = 'AIRPLANE_PAIR_WINGS',
  BOMB                = 'BOMB',
  JOKER_BOMB_SMALL    = 'JOKER_BOMB_SMALL',
  JOKER_BOMB_BIG      = 'JOKER_BOMB_BIG',
  INVALID             = 'INVALID',
}

export interface CardPattern {
  type: PatternType;
  cards: number[];      // 原始编码整数数组，保持输入顺序
  primaryValue: number; // 用于 canBeat 比较的主牌 compareValue；INVALID=0
  length: number;       // cards.length；BOMB 比张数时使用
}
