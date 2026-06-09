/**
 * @file CardPattern.ts
 * @description 牌型枚举与数据结构定义。供客户端渲染和服务端校验共同使用。
 *              仅含类型定义，不含识别逻辑（识别逻辑见 PatternHelper.ts）。
 * @module shared/CardPattern
 * @see GAME-RULES §6 牌型系统
 */

// 0=♠ 1=♥ 2=♦ 3=♣
export type Suit = number;

/** 所有合法牌型枚举（字符串值，便于序列化调试）。@see GAME-RULES §6.1 */
export enum PatternType {
  SINGLE              = 'SINGLE',              // 单张
  PAIR                = 'PAIR',                // 对子
  TRIPLE              = 'TRIPLE',              // 三张
  TRIPLE_SOLO         = 'TRIPLE_SOLO',         // 三带一
  TRIPLE_PAIR         = 'TRIPLE_PAIR',         // 三带二
  STRAIGHT            = 'STRAIGHT',            // 顺子（≥5张，3–K）
  CONSECUTIVE_PAIRS   = 'CONSECUTIVE_PAIRS',   // 连对（≥3组，3–K）
  AIRPLANE            = 'AIRPLANE',            // 飞机核心（≥2组三张，无翅膀）
  AIRPLANE_SOLO_WINGS = 'AIRPLANE_SOLO_WINGS', // 飞机带单张翅膀
  AIRPLANE_PAIR_WINGS = 'AIRPLANE_PAIR_WINGS', // 飞机带对子翅膀
  BOMB                = 'BOMB',                // 炸弹（同点数 4–8 张）
  JOKER_BOMB_SMALL    = 'JOKER_BOMB_SMALL',    // 双小王炸
  JOKER_BOMB_BIG      = 'JOKER_BOMB_BIG',      // 双大王炸（天炸，最强牌型）
  INVALID             = 'INVALID',             // 非法牌型
}

/** 识别后的牌型对象，贯穿客户端预检与服务端权威校验全流程。 */
export interface CardPattern {
  type: PatternType;
  cards: number[];      // 原始编码整数数组，保持输入顺序
  primaryValue: number; // 用于 canBeat 比较的主牌 compareValue；INVALID=0
  length: number;       // cards.length；BOMB 比张数时使用
}
