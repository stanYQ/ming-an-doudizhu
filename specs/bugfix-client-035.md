# Spec: Client Bug 修复批次一

**任务 ID**: TASK-035  
**目标模块**: client  
**优先级**: P4.5  
**状态**: ready  
**权威来源**: docs/PROTOCOL.md v2.0 / .tasks/integration-issues.md

---

## 执行流程

```
Step 1  认领
        → 更新 .tasks/in-progress.md

Step 2  生成失败测试（RED）
        → /tdd-gen
        → 对照下方 AC 生成测试用例，确认全部失败后再写实现

Step 3  按 Issue 顺序实现
        ISSUE-C001 → ISSUE-C006 → ISSUE-C002 → ISSUE-C003 → ISSUE-C004 → ISSUE-C005 → ISSUE-C007
        每修完一个 Issue 立即跑 npm test，确认无回归

Step 4  覆盖率检查
        → /tdd-coverage

Step 5  Diff 审查
        → /karpathy

Step 6  代码质量（可选）
        → /simplify

Step 7  真实服务端验证（等 TASK-034 完成后执行）
        → /verify
        → 启动 infra + server，跑 GameFlow.integration 冒烟测试
        → 确认 9/9 AC 全部通过（非 skip）

        ⚠️ 冒烟阻塞处理（重要）：
        遇到任何阻塞，禁止自行排查超过 10 分钟。
        立即将问题写入 .tasks/integration-issues.md，格式：

        - [ ] ISSUE-Cxxx [🔴] 一句话描述
          - 复现步骤: 做了什么
          - 期望行为: 按 PROTOCOL.md 应该发生什么
          - 实际行为: 实际发生了什么（附错误信息）
          - 报告人: client-dev | 日期: YYYY-MM-DD

        写完后通知 PM，由 PM 判断根因并分配修复方。
        不要自行判断是 server 还是 client 的问题，只描述现象。

Step 8  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除 TASK-035
```

---

## 背景

client code-review 发现 7 处 bug（1 个 🔴 + 6 个 🟡 Demo 前必修），详见 `.tasks/integration-issues.md` ISSUE-C001~C007。Step 7 冒烟测试需等 TASK-034（server bug 修复）完成后再执行。

---

## 验收标准

### ISSUE-C001 — `setConnected()` 调用缺失（🔴）

- AC-1: `GameSceneManager.onLoad()` 在 `joinRoom` 完成后（或场景加载时从 `netManager.room` 获取 sessionId 和 seatIndex），调用 `gameController.setConnected(mySeatIndex, mySessionId)`
- AC-2: 调用后 `gameController.getState()` 返回 `IN_ROOM_WAIT`（非 `CONNECTING`）
- AC-3: 地主阶段 `state.landlordSeat === mySeatIndex` 时，`codeCardSelector.show()` 被调用

### ISSUE-C006 — `setToken()` null 守卫

- AC-4: `netManager.init()` 之前调用 `netManager.setToken(token)` 不抛异常，静默忽略
- AC-5: `netManager.init()` 之后调用 `setToken(token)` 正常写入 `this.client.auth.token`

### ISSUE-C002 — GameScene 避免重复 `init()`

- AC-6: `GameSceneManager.onLoad()` 不调用 `netManager.init()`（init 仅在 LaunchScene / HallScene 调用一次）
- AC-7: GameScene 加载后 `netManager.client` 仍是 HallScene 设置的有 token 的同一实例

### ISSUE-C003 — `onStateChange` 补 `doubling` case

- AC-8: `state.phase === 'doubling'` 时，`GameController.onStateChange` 将客户端状态切换到 `DOUBLING` 并调用 `doublingView?.show()`（与 `onDoublingStart` 协同，避免重连时 UI 不显示）

### ISSUE-C004 — `onStateChange` 补 `waiting` case

- AC-9: `state.phase === 'waiting'` 时，`settlementView?.hide()` 被调用，客户端状态切回 `IN_ROOM_WAIT`

### ISSUE-C005 — `showLastPlay` 仅在 lastPlay 变化时触发 + 新轮清空

- AC-10: `onStateChange` 中，仅当 `state.lastPlay.length > 0` 且与上次 lastPlay 不同时，调用 `playZone?.showLastPlay()`
- AC-11: `state.lastPlay.length === 0` 时，调用 `playZone?.clearLastPlay?.()` 清空上一轮出牌展示

### ISSUE-C007 — 快速匹配按钮防重复点击

- AC-12: `MatchView.showQuickMatch()` 和 `onCreateRoomClick()` 执行期间，若再次调用则静默忽略（加 `_joining` 标志位）
- AC-13: `joinRoom` 完成或失败后，`_joining` 标志复位，允许重试

---

## 接口变更

```typescript
// GameSceneManager.ts
// onLoad() 中新增（从 netManager.room 获取）:
gameController.setConnected(mySeatIndex: number, mySessionId: string)

// NetManager.ts
// setToken() 补 null 守卫:
setToken(token: string): void  // this.client 为 null 时静默返回

// MatchView.ts
// 新增标志位:
private _joining = false
```

---

## 约束

- 只改 `client/` 目录
- 不改 `shared/` 任何文件
- 现有测试 233/233 保持通过，新增测试后总数 ≥ 233

---

## 不在范围内

- ISSUE-C008（`IN_LOBBY` dead state，🟢 延后）
- ISSUE-C009（`API_ENDPOINT` 重复声明，🟢 延后）
- server 端修复（由 TASK-034 覆盖）

---

## 测试要求

- 新增测试覆盖全部 13 条 AC
- 测试总数 ≥ 233，全绿
- Step 7 冒烟：GameFlow.integration 9/9 AC 真实通过（非 skip）
