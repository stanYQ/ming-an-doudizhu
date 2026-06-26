# Spec: AI 补位玩家 AIPlayer

**任务 ID**: TASK-020  
**目标模块**: server  
**优先级**: P3  
**状态**: ready  
**前置依赖**: TASK-018（MatchMaker）done

---

## 背景

来源：GAME-RULES.md 第十章（托管规则）+ 第十一章（AI 补位）。AI 玩家有两种触发场景：① 匹配超时补位（从开局即为 AI）；② 真实玩家连续 3 次超时后进入托管模式。两者共用同一套出牌策略，行为刻意保守——目的是不干扰对局结果，让真实玩家重连后能继续。

## 验收标准

### 出牌策略

- AC-1: **自由出牌轮**（该玩家赢得出牌权，`lastPlay` 为空）→ 出手牌中 `compareValue` 最小的**单张**
- AC-2: **跟牌轮**（上家出了牌，需压或 pass）→ 直接 **pass**
- AC-3: 自由出牌轮时，若手牌只剩王炸或炸弹（无普通单张）→ 出最小单张（王/2 也出）
- AC-4: AI 出牌的响应时间在 500ms–1500ms 之间随机（避免即时响应暴露 AI 身份）

### 托管模式触发

- AC-5: 同一玩家连续 3 次出牌超时（30s）→ `CardRoom` 将该玩家标记为托管，后续由 AIPlayer 代打
- AC-6: 托管标记在玩家重连后**自动解除**，玩家恢复手动控制
- AC-7: 玩家重连时，若当前是托管玩家的回合，立即中止 AI 计时，等待真实玩家操作

### 补位 AI（匹配超时）

- AC-8: 补位 AI 全程托管，不会因「重连」解除（无真实玩家）
- AC-9: 补位 AI 的 `Player.isAI = true`，客户端可据此展示「AI」标签

## 接口 / 数据结构

```typescript
// server/src/logic/AIPlayer.ts

export class AIPlayer {
  /**
   * 决策出牌。
   * @param hand      当前手牌（编码整数数组）
   * @param lastPlay  上家出的 CardPattern，null 表示自由出牌轮
   * @returns 出牌数组（空数组表示 pass）
   */
  static decide(hand: number[], lastPlay: CardPattern | null): number[];

  /** 从手牌中找 compareValue 最小的单张 */
  static pickSmallestSingle(hand: number[]): number[];
}
```

### 调用时序（CardRoom 内）

```typescript
// CardRoom.ts 超时处理
if (++timeoutCount[sessionId] >= 3) {
  managed.add(sessionId);
}
if (managed.has(currentTurnSessionId)) {
  const cards = AIPlayer.decide(hand, lastPlayPattern);
  // 延迟 500–1500ms 后执行出牌
  this.clock.setTimeout(() => this.executePlay(sessionId, cards), randomDelay());
}
```

## 约束

- `AIPlayer.decide` 为纯函数，不访问任何外部状态
- 响应延迟（AC-4）由 `CardRoom` 的 `clock.setTimeout` 控制，不在 `AIPlayer` 内部 sleep
- 托管解除（AC-6）在 `CardRoom.onJoin`（重连）时执行，不在 `AIPlayer` 中处理

## 不在范围内

- 智能出牌策略（看牌型选最优解）—— P4
- AI 难度分级 —— P4
- AI 选暗号牌逻辑（补位 AI 成为地主时）—— P4，暂时随机选合法暗号牌

## 测试要求

- 单元测试覆盖全部 9 条 AC
- 边界情况：
  - 手牌只剩 1 张（AC-1，直接出）
  - 手牌只剩王炸（AC-3，仍出单张）
- 错误路径：手牌为空时调用 `decide` → 返回空数组（不抛出）
