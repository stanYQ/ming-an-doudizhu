# Spec: 牌型辅助工具 PatternHelper

**任务 ID**: TASK-003  
**目标模块**: shared  
**优先级**: P0  
**状态**: ready

---

## 背景

来源：GAME-RULES.md 第五章（压牌规则）+ 第六章（牌型系统）。提供两个核心函数：`parse()` 将手牌编码数组识别为 `CardPattern`，`canBeat()` 判断挑战方是否能压过当前场上牌型。定位为 **shared 层预检工具**，客户端用于出牌前本地验证，服务端可复用此逻辑做权威校验。

## 验收标准

### parse()

- AC-1: 空数组输入 → 返回 `type: INVALID`
- AC-2: 单张普通牌 → `SINGLE`，`primaryValue` = 该牌 compareValue
- AC-3: 合法顺子（如 [3,4,5,6,7]）→ `STRAIGHT`，`primaryValue` = 最高牌 compareValue
- AC-4: 含重复点数的5张（如 [3,3,4,5,6]）→ `INVALID`
- AC-5: 含2的顺子（如 [J,Q,K,A,2]）→ `INVALID`
- AC-6: 含王的顺子 → `INVALID`
- AC-7: 4张同点数 → `BOMB`，`length=4`
- AC-8: 8张同点数 → `BOMB`，`length=8`
- AC-9: 2张小王 → `JOKER_BOMB_SMALL`
- AC-10: 2张大王 → `JOKER_BOMB_BIG`
- AC-11: 1小王 + 1大王 → `INVALID`
- AC-12: 3张同类型王 → `INVALID`（2张可识别为王炸，第3张无牌型）
- AC-13: `TRIPLE_PAIR`（三带二）中的两张不构成对子 → `INVALID`
- AC-14: 飞机核心（2组三张）+ 等组数单张翅膀 → `AIRPLANE_SOLO_WINGS`
- AC-15: 飞机核心（2组三张）+ 等组数对子翅膀 → `AIRPLANE_PAIR_WINGS`
- AC-16: 飞机核心（2组三张）但翅膀数量不等于核心组数 → `INVALID`

### canBeat()

- AC-17: 任意牌型无法压过 `JOKER_BOMB_BIG`（包括 `JOKER_BOMB_BIG` 自身）
- AC-18: `JOKER_BOMB_BIG` 可压 `JOKER_BOMB_SMALL`
- AC-19: `JOKER_BOMB_SMALL` 可压任意普通炸弹
- AC-20: `JOKER_BOMB_SMALL` 无法压另一个 `JOKER_BOMB_SMALL`（相同不算压）
- AC-21: 炸弹（张数多）压炸弹（张数少）→ true（如6张炸压4张炸）
- AC-22: 同张数炸弹比 primaryValue（高者胜）
- AC-23: 炸弹压任意普通牌型 → true
- AC-24: 普通牌型压炸弹 → false
- AC-25: 相同类型 + 相同 length + 更高 primaryValue → true
- AC-26: 相同类型 + 相同 length + 相同或更低 primaryValue → false
- AC-27: 类型不同的普通牌型互压 → false（如 PAIR 压 SINGLE）
- AC-28: 长度不同的普通同类型互压 → false（如6张顺子压5张顺子）
- AC-29: challenger 或 current 为 `INVALID` → false

## 接口 / 数据结构

```typescript
// 依赖 TASK-001 CardEncoding，TASK-002 CardPattern / PatternType

import { CardPattern, PatternType } from "./CardPattern";

/**
 * 将编码整数数组识别为 CardPattern。
 * 永不抛出异常，非法输入返回 { type: INVALID, ... }。
 */
export function parse(cards: number[]): CardPattern;

/**
 * 判断 challenger 是否能压过 current。
 * 返回 true 仅当 challenger 严格大于 current。
 */
export function canBeat(challenger: CardPattern, current: CardPattern): boolean;
```

### canBeat 完整优先级顺序

```
双大王炸 > 双小王炸 > 八张炸 > 七张炸 > 六张炸 > 五张炸 > 四张炸 > 普通牌型

普通牌型之间：类型相同 + length 相同 + primaryValue 更高 → 可压
```

炸弹详细比较：
1. 先比 `length`（多者胜）
2. `length` 相同再比 `primaryValue`（高者胜）
3. 王炸永远在普通炸弹之上（JOKER_BOMB_BIG > JOKER_BOMB_SMALL > BOMB(任意张数)）

## 约束

- `parse` 内部可对 `cards` 排序用于识别，但 `CardPattern.cards` 字段保留原始输入顺序
- `canBeat` 不修改任何状态，纯函数
- PatternHelper 仅做客户端预检和 shared 层逻辑；**服务端权威判定**（含 `ownsAll` 手牌校验）在 `server/logic/RuleEngine.ts` 中实现，不在本 spec 范围
- 不依赖任何运行时环境（浏览器 / Node.js），可在两端直接 import

## 不在范围内

- 服务端权威判定（RuleEngine.canBeat + ownsAll）
- 出牌提示/AI 建议（`request_hint`）
- 托管 AI 逻辑

## 测试要求

- 单元测试覆盖全部 29 条 AC
- 边界情况：
  - 最短合法顺子（5张）vs 4张（INVALID）
  - 8张同点数炸弹（最大普通炸）
  - 飞机组数为2、3时翅膀数量匹配 / 不匹配
  - 同 primaryValue 炸弹（不同 length）
- 错误路径：
  - 空数组（AC-1）
  - 小王+大王混搭（AC-11）
  - challenger=INVALID（AC-29）
