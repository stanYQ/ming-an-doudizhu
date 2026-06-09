# Spec: 牌值编码 CardEncoding

**任务 ID**: TASK-001  
**目标模块**: shared  
**优先级**: P0  
**状态**: ready

---

## 背景

来源：GAME-RULES.md 第二章。两副牌共 108 张，用 0–107 整数唯一标识每张牌，并为每张牌提供用于大小比较的 `compareValue`（3–17）。所有引擎模块均依赖此编码，是 shared 层的最底层原子。

## 验收标准

- AC-1: `encode(0, 0, 0)` 返回 `0`（♠3 第一副）
- AC-2: `encode(1, 0, 0)` 返回 `54`（♠3 第二副）
- AC-3: `encode(0, 3, 12)` 返回 `51`（♣2 第一副，suit=3, rank=12）
- AC-4: `encodeJoker(0, false)` 返回 `52`（小王第一副）
- AC-5: `encodeJoker(0, true)` 返回 `53`（大王第一副）
- AC-6: `encodeJoker(1, true)` 返回 `107`（大王第二副）
- AC-7: `compareValue` 对 rank=12（点数 2）的任意牌返回 `15`
- AC-8: `compareValue` 对 rank=11（A）的任意牌返回 `14`
- AC-9: `compareValue` 对 rank=0（3）的任意牌返回 `3`
- AC-10: `compareValue` 对小王（`encodeJoker(_, false)`）返回 `16`
- AC-11: `compareValue` 对大王（`encodeJoker(_, true)`）返回 `17`
- AC-12: 同点数两副牌（如 encode(0,0,0) 与 encode(1,0,0)）`compareValue` 相同
- AC-13: `decode(encode(d, s, r))` 精确还原 `{ deck: d, suit: s, rank: r }`
- AC-14: `decode` 对小王/大王返回 `{ deck, isJoker: true, isLarge: bool }`
- AC-15: 全部 108 个编码值（0–107）互不重复

## 接口 / 数据结构

```typescript
// 普通牌：deck × 54 + suit × 13 + rank
// deck ∈ {0, 1}  suit ∈ {0=♠,1=♥,2=♦,3=♣}  rank ∈ {0=3,...,12=2}
// 小王：deck × 54 + 52
// 大王：deck × 54 + 53

function encode(deck: number, suit: number, rank: number): number;
function encodeJoker(deck: number, isLarge: boolean): number;

type DecodeResult =
  | { deck: number; suit: number; rank: number; isJoker: false }
  | { deck: number; isJoker: true; isLarge: boolean };

function decode(card: number): DecodeResult;

// compareValue 映射：大王=17, 小王=16, 2=15, A=14, K=13, Q=12,
//   J=11, 10=10, 9=9, 8=8, 7=7, 6=6, 5=5, 4=4, 3=3
function compareValue(card: number): number;

function isJoker(card: number): boolean;
function isLargeJoker(card: number): boolean;
function isSmallJoker(card: number): boolean;
function getDeck(card: number): number;   // 0 | 1
function getSuit(card: number): number;   // 0–3，大小王调用结果无意义
function getRank(card: number): number;   // 0–12，大小王调用结果无意义
```

## 约束

- 输入 `deck` 必须为 0 或 1，`suit` 为 0–3，`rank` 为 0–12；调用方保证合法，函数内不做校验
- `compareValue` 返回值域固定为整数 3–17，外部代码不得 hardcode 此映射
- `decode` 与 `encode`/`encodeJoker` 必须互为逆运算，覆盖 0–107 全域

## 不在范围内

- 牌型识别（PatternType 识别）
- 压牌逻辑（canBeat）
- 洗牌、发牌顺序

## 测试要求

- 单元测试覆盖全部 15 条 AC
- 边界情况：card=0（最小），card=107（最大），deck=1 的小王/大王
- 错误路径：不需测试非法输入（调用方保证合法，见约束）
