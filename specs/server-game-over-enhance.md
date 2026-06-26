# Spec: game_over 消息增强 — 结算 UI 完整数据

**任务 ID**: TASK-046  
**目标模块**: server  
**优先级**: P0  
**状态**: ready  
**前置依赖**: TASK-044/045 完成（结算 UI 需要此消息数据）

---

## 执行流程

```
Step 1  认领 → 更新 .tasks/in-progress.md

Step 2  /tdd-gen
        → 生成 CardRoom.038.test.ts 中 game_over 结构验证测试（RED）

Step 3  实现
        → 修改 CardRoom.ts finishGame()：在 broadcast("game_over", ...) 中补充 players[] 和 breakdown
        → 同步更新 PROTOCOL.md §game_over

Step 4  /tdd-coverage
        → 确认 AC-1~AC-6 均有测试覆盖

Step 5  /karpathy → diff 审查，确认只改 finishGame() 和测试

Step 6  npm test 全绿（398/398+）

Step 7  完成 → 更新 .tasks/done.md
```

---

## 背景

来源：`docs/UI-DESIGN.md` §七（SettlementView）、`specs/ui-flow-05-settlement-rematch.md`（TASK-045）。

当前 `game_over` 消息仅包含：
```typescript
{ winnerCamp: "landlord_camp"|"civilian_camp", scores: { [sessionId]: scoreDelta } }
```

结算 UI 需要渲染 5 张玩家结果卡片，需要：
- 每个玩家的昵称、角色（地主/搭档/平民）、胜负、积分变化、新积分
- 倍率明细（baseScore × landlordDouble × playerDoubles × bomb × spring）

所有数据已在 `SettleService.calcDeltas(summary)` 和 `buildGameSummary()` 中计算，仅需整合到广播 payload。

---

## 验收标准

### game_over payload

- AC-1: `game_over.winnerCamp` 保持原字段，值为 `"landlord_camp"` | `"civilian_camp"`
- AC-2: `game_over.scores` 保持原字段，格式 `{ [sessionId]: scoreDelta }`（兼容旧客户端）
- AC-3: `game_over.players` 为 5 元素数组，顺序与 `state.players` seatIndex 升序对齐：
  ```typescript
  players: Array<{
    sessionId: string;
    nickname:  string;
    role:      "landlord" | "partner" | "civilian";
    isWinner:  boolean;
    scoreDelta: number;       // 与 scores[sessionId] 相同，方便客户端直接取
    newScore:  number | null; // AI 补位玩家为 null
    seatIndex: number;
  }>
  ```
- AC-4: `game_over.breakdown` 包含倍率明细：
  ```typescript
  breakdown: {
    baseScore:       number;          // 场次底分（1/2/5/10）
    multiplier:      number;          // 全局倍数 M（炸弹+春天+独挑）
    landlordDouble:  1 | 2;
    partnerDoubled:  boolean;
    bombCount:       number;
    isSpring:        boolean;
    isAntiSpring:    boolean;
    isLandlordAlone: boolean;
  }
  ```
- AC-5: AI 补位玩家（userId=0）包含在 `players[]` 中，`nickname` 为 `"AI"`，`newScore` 为 `null`
- AC-6: PROTOCOL.md §game_over 更新，与实现保持一致

### 兼容性

- AC-7: `scores` 字段保留（不删除），旧客户端代码无需修改
- AC-8: `SettleService.settle()` 仍为 fire-and-forget，失败不影响广播（同现行契约）

---

## 实现指南

### CardRoom.ts — finishGame() 修改

```typescript
private finishGame(winnerId: string): void {
  this.cancelTurnTimer();
  const winnerCamp  = RuleEngine.determineWinner(winnerId, this.landlordId, this.partnerId);
  const summary     = this.buildGameSummary(winnerId, winnerCamp);
  const deltas      = SettleService.calcDeltas(summary);
  const multiplier  = SettleService.calcMultiplier(summary);

  // 兼容旧字段
  const scores: Record<string, number> = {};
  for (const [psid, d] of deltas) scores[psid] = d;

  // 新增：players 数组（seatIndex 升序）
  const landlordWins = winnerCamp === "landlord_camp";
  const playerList = [...this.state.players.entries()]
    .map(([sid, p]) => ({
      sessionId:  sid,
      nickname:   p.nickname,
      role:       sid === this.landlordId ? "landlord"
                : sid === this.partnerId  ? "partner"
                : "civilian",
      isWinner:   landlordWins
                  ? (sid === this.landlordId || sid === this.partnerId)
                  : (sid !== this.landlordId && sid !== this.partnerId),
      scoreDelta: deltas.get(sid) ?? 0,
      newScore:   p.userId === 0 ? null : null, // server 不读 DB，客户端自行叠加
      seatIndex:  p.seatIndex,
    }))
    .sort((a, b) => a.seatIndex - b.seatIndex);

  // 新增：breakdown
  const breakdown = {
    baseScore:       summary.tableType === "starter" ? 1
                   : summary.tableType === "casual"  ? 2
                   : summary.tableType === "expert"  ? 5 : 10,
    multiplier,
    landlordDouble:  summary.landlordDouble,
    partnerDoubled:  summary.partnerDoubled,
    bombCount:       summary.bombCount,
    isSpring:        summary.isSpring,
    isAntiSpring:    summary.isAntiSpring,
    isLandlordAlone: summary.isLandlordAlone,
  };

  this.state.phase = "settlement";
  this.broadcast("game_over", { winnerCamp, scores, players: playerList, breakdown });

  SettleService.settle(summary).catch(e =>
    console.error("[CardRoom] settle failed:", (e as Error).message)
  );
  this.logBattleReport(winnerId, winnerCamp, summary, scores);
  this.startRematchWindow();
}
```

> **注意**：`newScore` 服务端不查库（保持 fire-and-forget 契约），设为 `null`。客户端用 `storedScore + scoreDelta` 计算新积分后写 `oops.storage`。

---

## PROTOCOL.md 更新

在 `game_over` 章节替换 TypeScript 类型定义：

```typescript
room.onMessage("game_over", (data: {
  winnerCamp: "landlord_camp" | "civilian_camp";
  scores:     Record<string, number>;   // { [sessionId]: scoreDelta }（兼容字段，保留）
  players: Array<{
    sessionId:  string;
    nickname:   string;
    role:       "landlord" | "partner" | "civilian";
    isWinner:   boolean;
    scoreDelta: number;
    newScore:   null;                   // 服务端不查库，客户端自行叠加
    seatIndex:  number;
  }>;
  breakdown: {
    baseScore:       number;
    multiplier:      number;
    landlordDouble:  1 | 2;
    partnerDoubled:  boolean;
    bombCount:       number;
    isSpring:        boolean;
    isAntiSpring:    boolean;
    isLandlordAlone: boolean;
  };
}) => { /* ... */ });
```

---

## 约束

- 只修改 `finishGame()` 函数（约 15 行增量）和 `PROTOCOL.md`
- 不修改 `SettleService`、`buildGameSummary`、Schema 定义
- `scores` 兼容字段必须保留（协议版本平滑升级）
- `newScore` 统一为 `null`，明确告知客户端需自行计算

## 不在范围内

- DB 查询返回 `newScore`（写库是 fire-and-forget，增加同步查询会引入延迟）
- 战绩历史记录（P1+，另立 spec）
- 积分排行榜（P1，见 backlog TASK-047）
