# Spec: 牌型系统 CardPattern

**任务 ID**: TASK-002  
**目标模块**: shared  
**优先级**: P0  
**状态**: ready

---

## 背景

来源：GAME-RULES.md 第六章。定义所有合法牌型的枚举、数据结构与识别条件。是 PatternHelper（parse/canBeat）的数据基础，也是客户端渲染和服务端校验的共同语言。

## 验收标准

- AC-1: `PatternType` 枚举包含且仅包含以下值：`SINGLE` `PAIR` `TRIPLE` `TRIPLE_SOLO` `TRIPLE_PAIR` `STRAIGHT` `CONSECUTIVE_PAIRS` `AIRPLANE` `AIRPLANE_SOLO_WINGS` `AIRPLANE_PAIR_WINGS` `BOMB` `JOKER_BOMB_SMALL` `JOKER_BOMB_BIG` `INVALID`
- AC-2: `CardPattern` 接口包含字段 `type` `cards` `primaryValue` `length`，类型如下节所示
- AC-3: 1张任意牌 → `SINGLE`
- AC-4: 2张相同点数的普通牌 → `PAIR`（如两张 ♠5）
- AC-5: 3张相同点数的普通牌 → `TRIPLE`
- AC-6: 3张同点 + 1张任意 → `TRIPLE_SOLO`
- AC-7: 3张同点 + 2张同点（且两组点数不同）→ `TRIPLE_PAIR`
- AC-8: ≥5张连续点数（3–K），每点数恰好1张，不含2和王 → `STRAIGHT`；`primaryValue` 为最高牌的 compareValue
- AC-9: ≥6张（偶数），≥3组连续点数的对子（3–K），每点数恰好2张 → `CONSECUTIVE_PAIRS`
- AC-10: ≥2组连续点数三张（3–K），每点数恰好3张 → `AIRPLANE`（飞机核心无翅膀）
- AC-11: 飞机核心 + 等组数的单张翅膀 → `AIRPLANE_SOLO_WINGS`
- AC-12: 飞机核心 + 等组数的对子翅膀 → `AIRPLANE_PAIR_WINGS`
- AC-13: 同点数4–8张（非王）→ `BOMB`；`length` 记录张数，`primaryValue` 为该点数 compareValue
- AC-14: 恰好2张小王 → `JOKER_BOMB_SMALL`
- AC-15: 恰好2张大王 → `JOKER_BOMB_BIG`
- AC-16: 小王+大王（各1张）→ `INVALID`（GDD 明确禁止）
- AC-17: 3张同类型王（如3张小王）→ 该组合识别为 `INVALID`（不存在三王牌型）
- AC-18: 顺子/连对/飞机中出现重复点数 → `INVALID`（如 3 3 4 5 6 7 含2张3）
- AC-19: 顺子/连对/飞机含2或王 → `INVALID`

## 接口 / 数据结构

```typescript
export enum PatternType {
  SINGLE            = "SINGLE",
  PAIR              = "PAIR",
  TRIPLE            = "TRIPLE",
  TRIPLE_SOLO       = "TRIPLE_SOLO",       // 三带一
  TRIPLE_PAIR       = "TRIPLE_PAIR",       // 三带二
  STRAIGHT          = "STRAIGHT",          // 顺子 ≥5
  CONSECUTIVE_PAIRS = "CONSECUTIVE_PAIRS", // 连对 ≥6
  AIRPLANE          = "AIRPLANE",          // 飞机 ≥6（无翅膀）
  AIRPLANE_SOLO_WINGS = "AIRPLANE_SOLO_WINGS", // 飞机带单张
  AIRPLANE_PAIR_WINGS = "AIRPLANE_PAIR_WINGS", // 飞机带对子
  BOMB              = "BOMB",              // 同点数 4–8 张
  JOKER_BOMB_SMALL  = "JOKER_BOMB_SMALL",  // 双小王
  JOKER_BOMB_BIG    = "JOKER_BOMB_BIG",    // 双大王
  INVALID           = "INVALID",
}

export interface CardPattern {
  type: PatternType;
  cards: number[];       // 原始编码整数数组（保持输入顺序）
  primaryValue: number;  // 用于 canBeat 比较的主牌 compareValue
                         // STRAIGHT/CONSECUTIVE_PAIRS/AIRPLANE: 最高点 compareValue
                         // AIRPLANE_*_WINGS: 飞机核心最高点 compareValue
                         // INVALID: 0
  length: number;        // cards.length（BOMB 比张数时使用）
}
```

### 各牌型 primaryValue 说明

| 牌型 | primaryValue |
|------|-------------|
| SINGLE / PAIR / TRIPLE | 该点数的 compareValue |
| TRIPLE_SOLO / TRIPLE_PAIR | 三张部分的 compareValue |
| STRAIGHT | 顺子中最高牌的 compareValue |
| CONSECUTIVE_PAIRS | 最高对子的 compareValue |
| AIRPLANE / AIRPLANE_*_WINGS | 飞机核心中最高三张的 compareValue |
| BOMB | 该点数的 compareValue |
| JOKER_BOMB_SMALL | 16 |
| JOKER_BOMB_BIG | 17 |
| INVALID | 0 |

## 约束

- `PatternType` 枚举值使用字符串形式，便于序列化调试
- `cards` 保持调用方传入顺序，不排序；识别逻辑内部排序不修改输出字段
- 顺子/连对/飞机的点数范围上限：compareValue ≤ 13（K），不含 A(14) / 2(15) / 王(16/17)
- 此文件只定义类型，不含识别函数（识别逻辑属 TASK-003 PatternHelper）

## 不在范围内

- `canBeat` 比较逻辑
- UI 展示（牌型名称的多语言字符串等）
- 识别函数 `parse()` 的实现

## 测试要求

- 单元测试覆盖全部 19 条 AC（对应 CardPattern 对象的 type / primaryValue / length 字段值）
- 边界情况：最短顺子（5张），最长炸弹（8张），飞机带单张 vs 带对子
- 错误路径：AC-16（小王+大王）、AC-17（3张王）、AC-18（重复点数顺子）、AC-19（含2/王的顺子）均返回 INVALID
