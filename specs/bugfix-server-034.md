# Spec: Server Bug 修复批次一

**任务 ID**: TASK-034  
**目标模块**: server  
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
        ISSUE-005 → ISSUE-006 → ISSUE-001 → ISSUE-007
        每修完一个 Issue 立即跑 npm test，确认无回归

Step 4  覆盖率检查
        → /tdd-coverage

Step 5  Diff 审查
        → /karpathy

Step 6  完成
        → npm test 全套（含 integration），当前测试数全绿零警告
        → 更新 .tasks/done.md，从 in-progress.md 移除 TASK-034
```

---

## 背景

server code-review 发现 4 处 bug（2 个 🔴 阻塞 + 2 个 🟡 Demo 前必修），详见 `.tasks/integration-issues.md` ISSUE-001/005/006/007。

---

## 验收标准

### ISSUE-005 — `handlePass` 自由轮守卫

- AC-1: `handlePass` 在 `state.lastPlay.length === 0` 时拒绝 pass，返回 `error { code: 1002, msg: '自由出牌轮不可 pass' }`
- AC-2: `handlePass` 在 `state.lastPlayerId === client.sessionId` 时拒绝 pass，返回同上错误
- AC-3: 正常跟牌轮（lastPlay 非空且上家非本人）pass 仍正常接受

### ISSUE-006 — `landlord_select` 断线超时兜底

- AC-4: 进入 `landlord_select` 阶段时，服务端启动超时定时器（默认 30s，可由 env `LANDLORD_SELECT_TIMEOUT` 覆盖）
- AC-5: 超时触发时，自动以 `{ suit: 0, value: 0 }` 执行 `handleSelectCode`，游戏继续推进到 `doubling` 阶段
- AC-6: 地主在超时前正常提交 `select_code_card`，定时器清除，不触发自动选牌
- AC-7: 地主断线后在超时窗口内重连，定时器不清除，超时后仍自动选牌

### ISSUE-001 — `realPlayerCount` 断线递减

- AC-8: 任意阶段（非 `waiting`）真实玩家离开（`onLeave`），`realPlayerCount` 递减
- AC-9: `settlement` 阶段 1 人离线后，其余 N-1 人全部发送 `request_rematch`，`rematchAgreed.size === realPlayerCount` 时正常触发 `doRematch`
- AC-10: AI 玩家离开不影响 `realPlayerCount`（AI 的 `isAI === true`，守卫跳过）

### ISSUE-007 — `handleReconnectSync` 补全 `landlord_select` 分支

- AC-11: `phase === 'landlord_select'` 时，`handleReconnectSync` 向重连玩家私发 `your_hand { cards }`
- AC-12: 若重连玩家是地主（`seatIndex === landlordSeat`），额外私发 `bottom_cards { cards }` 和 `landlord_select_start {}`（或等效触发信号，客户端据此重新弹出暗号牌选择器）
- AC-13: 非地主重连，仅收到 `your_hand`，不收到 `bottom_cards`

---

## 约束

- 只改 `server/src/rooms/CardRoom.ts`（及对应测试文件）
- `LANDLORD_SELECT_TIMEOUT` 默认 30，单位秒；测试中可注入 0 快速触发
- 不改 shared/ 任何文件

---

## 不在范围内

- ISSUE-002 / 004 / 008（🟢 延后维护）
- 客户端对应 UI 适配（由 TASK-035 覆盖）

---

## 测试要求

- 新增测试覆盖全部 13 条 AC
- 测试总数 ≥ 356（当前基准），全绿零警告
