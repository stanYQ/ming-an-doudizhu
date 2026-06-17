# Spec: 智能 AI 玩家 AIPlayer V2

**任务 ID**: TASK-026  
**目标模块**: server/logic  
**优先级**: P4.1  
**状态**: ready  
**前置依赖**: TASK-025（CardDecomposer）done  
**替换**: TASK-020 的 AIPlayer.ts  
**参考来源**:  
- ZhouWeikuan/DouDiZhu（GitHub）— 残手权重决策法  
- longhuihu《棋牌游戏服务器·斗地主AI设计》— 评分体系  
- 明暗斗地主专项适配（阵营感知、加倍阶段）

---

## 背景

TASK-020 的保守 AI 跟牌永远 pass，导致：  
① 补位/托管体验极差（平民从不出牌，地主轻松获胜）  
② 模拟校准数据失真（地主胜率接近 100%，无法校准数值）

V2 采用 **ZhouWeikuan 残手权重法**：不评估"出什么牌"，而是评估"出完这张之后剩余手牌有多好"。选让残手最好的那个出法。

---

## 核心算法：残手权重（handPower）

来源：ZhouWeikuan/DouDiZhu，常数 `kOneHandPower = -150`

```
handPower(hand):
  if hand.length == 0: return 0
  minTurns = CardDecomposer.minTurns(hand)   // 最少几手清完
  cardSum   = Σ compareValue(card)            // 手牌点数总和
  bombBonus = countBombs(hand) × 50          // 炸弹保留奖励
  return -150 × minTurns + cardSum + bombBonus

决策逻辑:
  candidates = generateCandidates(hand, lastPlay)
  return candidates.maxBy(c => handPower(hand - c))
```

**为什么 -150 有效**：减少 1 手的收益（+150）远大于打出任何一张牌的损失（最大 ≤17）。算法天然优先选"能合并更多牌"的出法（顺子 > 单张，飞机 > 三张）。

---

## 验收标准

### handPower()

- AC-1: `handPower([])` = 0
- AC-2: 手牌越少手数出完，`handPower` 越高（两手牌必优于三手牌，手牌总值相近时）
- AC-3: 同样 minTurns，炸弹多的手牌 handPower 更高（bombBonus）
- AC-4: 全为单张 n 张时，handPower = -150n + Σ compareValue

### 自由出牌（lastPlay = null）

- AC-5: 调用 `CardDecomposer.generateAll(hand)` 获取所有合法候选
- AC-6: 对每个候选 c，计算 `handPower(hand - c)`，选得分最高的
- AC-7: **炸弹保留原则**：若存在非炸弹候选，优先从非炸弹中选；仅当无非炸弹候选时才出炸弹
- AC-8: 手牌只剩 1 张 → 直接出
- AC-9: 手牌为空 → 返回 `[]`（不出错）

### 跟牌（lastPlay ≠ null）

- AC-10: 从 `CardDecomposer.generateAll(hand)` 中筛出能压过 lastPlay 的候选（`PatternHelper.canBeat`）
- AC-11: 非炸弹压法存在时，选其中 `handPower(hand - c)` 最高的
- AC-12: 无非炸弹压法时，使用最小炸弹压（`primaryValue` 最低的炸弹）
- AC-13: 完全无法压 → 返回 `[]`（pass）

### 明暗斗地主阵营适配

- AC-14: AI 玩家初始 `role = 'unknown'`；收到 `identity_reveal` 消息后更新 `role`
- AC-15: `role = 'unknown'` 时：纯自保策略，完全按 handPower 决策，不考虑队友
- AC-16: `role = 'civilian'`，且 `allyId` 不存在（未揭示）：继续自保策略
- AC-17: `role = 'partner'`（暗队友被揭示后）：自由出牌时，若地主刚出牌且自己无法轻松压过，优先 pass（让地主维持出牌权）
- AC-18: `role = 'landlord'`，且确认有暗队友（非一挑四）：炸弹使用阈值降低（手牌剩余 ≤ 8 张时可主动用炸弹）
- AC-19: `isLandlordAlone = true`（一挑四）：地主 AI 激进模式，不再保留炸弹

### 加倍阶段（TASK-023 协议）

- AC-20: AI 在加倍阶段统一选择 d=1（不加倍）；不依赖手牌质量

### 出牌延迟与接口兼容

- AC-21: 决策延迟 500–1500ms，由 CardRoom 的 `clock.setTimeout` 控制，AIPlayer 本身无异步
- AC-22: 接口签名与 TASK-020 完全相同，CardRoom 无需修改：  
  `static decide(hand: number[], lastPlay: CardPattern | null): number[]`
- AC-23: 托管解除逻辑仍在 `CardRoom.onJoin()` 处理，AIPlayer 不负责

---

## 接口 / 数据结构

```typescript
// server/src/logic/AIPlayer.ts（覆盖 TASK-020 产物）

import { CardDecomposer } from "./CardDecomposer";
import { PatternHelper } from "../../../shared/PatternHelper";
import type { CardPattern } from "../../../shared/CardPattern";

export type AIRole = "unknown" | "landlord" | "partner" | "civilian";

export interface AIContext {
  role: AIRole;
  allyId: string | null;        // 暗队友 sessionId（landlord/partner 揭示后）
  isLandlordAlone: boolean;     // 一挑四模式
  myHandCount: number;          // 自己手牌数（用于激进/保守切换）
}

export class AIPlayer {
  /**
   * 决策出牌。接口与 V1 完全相同，CardRoom 无需修改。
   * context 为可选参数；不传时退化为纯 handPower 策略。
   */
  static decide(
    hand: number[],
    lastPlay: CardPattern | null,
    context?: AIContext
  ): number[];

  /**
   * 残手权重评分。得分越高，手牌越好出完。
   * handPower = -150 × minTurns + Σ compareValue + bombBonus
   */
  static handPower(hand: number[]): number;

  /** 向后兼容：从手牌中找 compareValue 最小的单张（超时托管紧急模式）*/
  static pickSmallestSingle(hand: number[]): number[];
}
```

---

## 策略决策流（伪代码，供 dev 参考）

```
decide(hand, lastPlay, context):
  if hand.length == 0: return []

  candidates = CardDecomposer.generateAll(hand)

  if lastPlay == null:  // 自由出牌
    normals = candidates.filter(!isBomb)
    bombs   = candidates.filter(isBomb)

    // 一挑四或手牌≤8张时，炸弹也进入候选池
    aggressiveMode = context?.isLandlordAlone
                  || context?.role == 'landlord' && hand.length <= 8
    pool = (normals.length > 0 && !aggressiveMode) ? normals : candidates

    return pool.maxBy(c => handPower(hand - c))

  else:  // 跟牌
    beaters = candidates.filter(c => PatternHelper.canBeat(parse(c), lastPlay))
    normalBeaters = beaters.filter(!isBomb)
    bombBeaters   = beaters.filter(isBomb)

    // partner 策略：让地主维持出牌权，能 pass 就 pass
    if context?.role == 'partner' && normalBeaters.length > 0:
      bestScore = normalBeaters.maxBy(c => handPower(hand - c)).score
      if bestScore < handPower(hand):  // 打出后反而更差
        return []  // pass

    if normalBeaters.length > 0:
      return normalBeaters.maxBy(c => handPower(hand - c))
    if bombBeaters.length > 0:
      return bombBeaters.minBy(primaryValue)  // 最小炸弹
    return []  // pass
```

---

## 约束

- `decide()` 和 `handPower()` 为纯函数，不访问外部状态
- 不引入任何 ML 库
- context 参数可选，不传时行为与"不知道身份"相同（自保策略）
- 双副牌场景下 `handPower` 中的 `bombBonus` 需识别 4–8 张炸弹

## 不在范围内

- 暗号牌智能选择（补位 AI 随机选合法暗号牌）—— P4.2
- 基于历史出牌的概率推断 —— P4.2
- AI 难度分级 —— P4.2
- MCTS / 强化学习 —— P4.3
- 加倍阶段智能加倍决策 —— P4.2

## 测试要求

- 单元测试覆盖全部 23 条 AC
- 必须包含对比测试：V2 vs V1 各跑 1000 局（含 CardRoom 集成），V2 的地主胜率应在 45%–65% 之间（V1 接近 100%）
- 阵营适配测试：partner 角色在地主出牌后不强行压牌（AC-17）
- 边界：手牌只剩 1 张（AC-8）、全炸弹手牌（AC-7）、一挑四激进模式（AC-19）
