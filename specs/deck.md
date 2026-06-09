# Spec: 洗牌发牌 Deck

**任务 ID**: TASK-009  
**目标模块**: server  
**优先级**: P1  
**状态**: ready  
**前置依赖**: TASK-001（CardEncoding.ts）done

---

## 背景

来源：GAME-RULES.md 第三章（牌局完整流程 3.1 发牌流程）。服务端专用（洗牌须在服务端保证公平）。实现 Fisher-Yates 随机洗牌、5人发牌（每人21张+底牌3张）、随机选取明牌并确定地主席位。

## 验收标准

### shuffle()

- AC-1: 返回数组长度为 108
- AC-2: 返回的 108 个整数与 `[0..107]` 集合完全相同（无重复，无遗漏）
- AC-3: 传入相同 `seed` → 两次调用返回相同顺序（可复现，供测试/回放）
- AC-4: 不传 `seed` → 不同调用结果以极高概率不同（随机性验证：统计分布）

### deal()

- AC-5: 返回 `hands` 数组长度为 5，每个子数组长度为 21
- AC-6: `bottom` 长度为 3
- AC-7: `hands` 中全部牌 + `bottom` = `shuffle` 返回的完整 108 张（无重复、无遗漏）
- AC-8: `faceUpCard` 是 `hands` 中某张牌的编码值（不是底牌中的）
- AC-9: `faceUpCard` 出现在且仅出现在一名玩家的手牌中

### findLandlordSeat()

- AC-10: `faceUpCard` 在 `hands[i]` 中 → 返回 `i`（0-4）
- AC-11: 兜底：若（理论上不可能的）明牌不在任何手牌中 → 返回 `0`（不抛出）

## 接口 / 数据结构

```typescript
export interface DealResult {
  hands: number[][];  // 5 名玩家手牌，每人 21 张
  bottom: number[];   // 3 张底牌
  faceUpCard: number; // 明牌（地主标识）
}

export class Deck {
  /**
   * Fisher-Yates 洗牌。
   * seed 可选：传入时使用可复现伪随机（mulberry32），用于测试/录像回放。
   * 生产环境不传 seed，使用 Math.random()。
   */
  static shuffle(seed?: number): number[];

  /**
   * 发牌：将洗好的 108 张牌分给 5 人，余 3 张底牌，并随机选明牌。
   * 明牌从已发出的 105 张中随机抽取（持有者为地主）。
   */
  static deal(deck: number[]): DealResult;

  /**
   * 根据明牌找出持有者席位（0–4）。
   * 持有明牌的玩家即为地主。
   */
  static findLandlordSeat(hands: number[][], faceUpCard: number): number;
}
```

### 发牌算法

```
for i in 0..104:
    hands[i % 5].push(deck[i])   // 轮流发，5人各21张
bottom = deck[105..107]          // 最后3张
faceUpCard = deck[随机index ∈ [0, 104]]  // 从已发牌中随机标记明牌
```

## 约束

- `shuffle` 不修改任何外部状态，每次调用生成新数组
- `deal` 接受已洗好的牌组，不自己洗牌（职责分离，便于测试）
- 生产环境的随机源使用 `Math.random()`，测试时通过 `seed` 注入确定性随机数
- `hands` 中每个子数组已排序（`sort((a, b) => a - b)`），便于客户端展示

## 不在范围内

- 地主拿走底牌（属 CardRoom 状态机，在 `landlord_select` 阶段处理）
- 手牌私密下发（属 CardRoom 的 `room.send(client, "your_hand", ...)` 调用）
- 明牌广播（属 CardRoom）

## 测试要求

- 单元测试覆盖全部 11 条 AC
- 边界情况：相同 seed 的可复现性（AC-3）、明牌始终在手牌而非底牌（AC-8）
- 错误路径：AC-11 兜底（通过手动构造 faceUpCard 不在任何手牌中的假数据触发）
