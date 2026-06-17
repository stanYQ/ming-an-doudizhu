# Spec: 手牌拆分引擎 CardDecomposer

**任务 ID**: TASK-025  
**目标模块**: server/logic  
**优先级**: P4.1  
**状态**: ready  
**前置依赖**: TASK-003（PatternHelper）done  
**参考来源**: longhuihu《棋牌游戏服务器·斗地主AI设计》博客园

---

## 背景

AIPlayer V2 需要两种能力：
1. **最优拆牌**：把手牌拆成最少组数（用于评估手牌质量 `handPower`）
2. **枚举合法出法**：列出手牌中所有可以合法打出的牌型（用于决策选择）

这两个能力抽为 `CardDecomposer`，供 AIPlayer 和未来 MCTS 复用。

**双副牌说明**：108 张牌，每名玩家 21–24 张，同一点数最多 8 张（两副各一对），炸弹可为 4–8 张。

---

## 核心算法：最优拆牌（按优先级顺序）

来源：longhuihu 的分层规则，按以下顺序识别，先识别的不再参与后续：

```
1. 王炸（双小王 / 双大王）
2. 炸弹（4–8 张同点）
3. 所有的 2（不进入顺子/连对/飞机）
4. 飞机（2组+连续三张，尽量长）
5. 顺子（5张+连续单张，尽量长；A 可作最大；2/王不入）
6. 连对（3对+连续对子，尽量长；2/王不入）
7. 三张
8. 对子
9. 剩余全部 → 单张
```

优化迭代：完成初次分解后，尝试以下调整并重新计算组数，取组数最少的方案：
- 拆开一个顺子，释放中间牌加入飞机
- 合并两段顺子（补中间缺牌）
- 拆散一个飞机，释放三张加入更长顺子

---

## 验收标准

### decompose()

- AC-1: `decompose(hand)` 返回将手牌拆成最少组数的方案（`CardGroup[]`）
- AC-2: 王炸优先保留不拆（AC 1级）
- AC-3: 炸弹优先保留不拆（AC 2级）
- AC-4: 2 不参与顺子/连对/飞机
- AC-5: 顺子取最长可能长度（如 34567 优先于 3456）
- AC-6: 飞机取最长可能长度
- AC-7: 返回的每个 `CardGroup.cards` 均能被 `PatternHelper.parse()` 识别为非 INVALID
- AC-8: 所有返回牌型的 cards 合并后恰好等于输入 hand（无重无漏）

### minTurns()

- AC-9: `minTurns(hand)` 返回 `decompose(hand).length`
- AC-10: 手牌为空 → `minTurns([])` = 0
- AC-11: 手牌全为单张 n 张 → minTurns = n
- AC-12: 存在顺子 34567 → minTurns ≤ hand.length - 4（顺子压缩了4手）

### generateAll()

- AC-13: `generateAll(hand)` 返回手牌中所有合法单次出法（不只是最优拆法）
- AC-14: 包含：所有单张、对子、三张、炸弹（4–8张）、顺子（各长度）、连对、飞机（各长度）、王炸
- AC-15: 不含带翅膀牌型（三带一/飞机带翅膀）——由 AIPlayer 按需附加
- AC-16: 每个返回项均能被 `PatternHelper.parse()` 识别为非 INVALID
- AC-17: 返回结果去重（相同物理编码组合只出现一次）
- AC-18: 手牌为空 → 返回 `[]`

---

## 接口 / 数据结构

```typescript
// server/src/logic/CardDecomposer.ts

export interface CardGroup {
  cards: number[];      // 物理编码数组
  pattern: CardPattern; // PatternHelper.parse() 结果
}

export class CardDecomposer {
  /**
   * 将手牌拆成最少组数的最优方案。
   * 用于 handPower 评估，不用于直接出牌决策。
   */
  static decompose(hand: number[]): CardGroup[];

  /**
   * 最少需要多少手出完手牌（无对手干扰）。
   * = decompose(hand).length
   */
  static minTurns(hand: number[]): number;

  /**
   * 枚举手牌中所有合法的单次出法。
   * 用于出牌决策候选集，不含带翅膀牌型。
   */
  static generateAll(hand: number[]): number[][];
}
```

---

## 约束

- 所有方法纯函数，不修改入参 `hand`
- 不引入新依赖；使用 `CardEncoding.decode()` / `compareValue()`
- 带翅膀牌型（三带一、飞机带翅膀）不在此枚举（避免组合爆炸，由 AIPlayer 拼装）
- 双副牌同点最多 8 张，炸弹枚举 4、5、6、7、8 张所有变体

## 不在范围内

- 出牌策略（属 AIPlayer）
- 带翅膀牌型枚举
- 最优拆牌的 NP-hard 全局最优（当前贪心+迭代优化即可）

## 测试要求

- 单元测试覆盖全部 18 条 AC
- 关键边界：双副牌 8 张同点炸弹（AC-14）、2 不入顺（AC-4）、顺子最长化（AC-5）
- 验证示例（来自 longhuihu）：
  - `22AAKQJ9987776654` → decompose 结果组数 ≤ 9
  - `33334444` → 识别为 8 张炸弹（1组）或两个 4 张炸弹（2组），取组数少的
