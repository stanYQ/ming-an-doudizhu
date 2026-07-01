# Spec: 动画同步修复（C008 / C009 / C010）

**任务 ID**: TASK-050s（server）/ TASK-050c（client）  
**目标模块**: server + client  
**优先级**: P2  
**状态**: ready

---

## 执行流程

```
Step 1  认领
        → 更新 .tasks/in-progress.md

Step 2  生成失败测试（RED）
        → /tdd-gen
        → 对照本 spec AC 生成测试用例，确认全部失败后再写实现

Step 3  实现
        → 按 AC 顺序逐条实现，每完成一条跑一次测试

Step 4  覆盖率检查
        → /tdd-coverage

Step 5  Diff 审查
        → /karpathy

Step 6  代码质量（可选）
        → /simplify

Step 7  验证
        [server] → npm test 全套，确认全绿零警告
        [client] → /verify，接真实 server 跑 GameFlow.integration 冒烟

        ⚠️ 冒烟阻塞处理：写入 .tasks/integration-issues.md，通知 PM

Step 8  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除
```

---

## 背景

联调发现三处阶段推进"提前截断"动画的问题（ISSUE-C008/C009/C010）：

1. **C008**：`startDealing()` 发完 `your_hand` 后立即推进 `landlord_select`，客户端 1-2s 发牌动画被截断
2. **C009**：`select_code_card` 处理完后立即推进 `doubling`，4 名玩家暗号牌揭晓动画（预计 3-5s）被截断
3. **C010**：`doubling_result` 广播后立即推进 `playing`，加倍结果展示（预计 2-3s）被截断

PM 决策时长：C008 超时 10s 静默跳过 | C009 停留 4s | C010 停留 2s

---

## TASK-050s — 服务端

### 验收标准

- AC-S1：`startDealing()` 广播 `your_hand` 后，CardRoom 进入等待状态，收到5个 `dealing_ready` 消息后才推进 `phase='landlord_select'`
- AC-S2：等待 `dealing_ready` 超过 10s 时，静默推进（不广播异常提示），计时器清除
- AC-S3：`dealing_ready` 超时后立即推进，不累计未到达的 ACK
- AC-S4：`handleSelectCodeCard` 处理成功后，先广播 `code_card_reveal { suit, value, landlordSeatIndex }`，再等 4s，再推进 `phase='doubling'`（写入 Schema + 广播 `doubling_start`）
- AC-S5：4s 定时器使用 `setTimeout`，ref 存入 `dealingRevealTimer`，`onDispose` 时清除
- AC-S6：`checkDoublingComplete` 所有玩家提交后，广播 `doubling_result` 后等 2s，再推进 `phase='playing'`（`startTurnTimer` 延迟调用）
- AC-S7：2s 定时器 ref 存入 `doublingResultTimer`，`onDispose` 时清除
- AC-S8：PROTOCOL.md 新增 `dealing_ready`（C→S，无 payload）和 `code_card_reveal`（S→C，payload 见接口章节）

### 接口 / 数据结构

```typescript
// C→S：新增消息
room.send("dealing_ready");  // 无 payload，客户端发牌动画结束后发送

// S→C：新增广播
broadcast("code_card_reveal", {
  suit:              number,   // 0=♠ 1=♥ 2=♦ 3=♣
  value:             number,   // rank 0-7（对应 3-10）
  landlordSeatIndex: number,
});

// CardRoom 新增定时器字段（与 landlordSelectTimer 同级）
private dealingReadyCount: number = 0;
private dealingReadyTimer: ReturnType<typeof setTimeout> | null = null;
private dealingRevealTimer: ReturnType<typeof setTimeout> | null = null;
private doublingResultTimer: ReturnType<typeof setTimeout> | null = null;
```

### 约束

- `dealing_ready` 超时策略：静默跳过，不广播任何错误提示
- C009 定时器开始点：`code_card_reveal` 广播**之后**立即开始计时（不是 `select_code_card` 收到时）
- C010 定时器开始点：`doubling_result` 广播**之后**立即开始计时
- 所有定时器必须在 `onDispose` 中 `clearTimeout`

### 不在范围内

- 重连时 `dealing_ready` 的幂等处理（重连玩家不补发，直接静默）
- C009/C010 的客户端 ACK（纯服务端定时器控制，无需 ACK）
- 超时时间的运行时配置化（硬编码常量即可）

---

## TASK-050c — 客户端

### 验收标准

- AC-C1：`NetManager` 新增 `sendDealingReady()` 方法，发送 `dealing_ready` 消息
- AC-C2：发牌动画（`DealingAnimation`）播放完成回调中调用 `sendDealingReady()`
- AC-C3：若无发牌动画（GameScene 尚未加载完 / 首次进入无动画），`onYourHand` handler 中直接调用 `sendDealingReady()`（兜底，不等动画）
- AC-C4：`NetManager` 新增 `code_card_reveal` 消息监听，回调参数 `{ suit, value, landlordSeatIndex }`
- AC-C5：收到 `code_card_reveal` 后触发揭晓动画，动画时长 ≤ 4s（与服务端 4s 窗口对齐，不得超出）
- AC-C6：`doubling_result` handler 收到后展示结果动画，时长 ≤ 2s（与服务端 2s 窗口对齐）

### 接口 / 数据结构

```typescript
// NetManager 新增
sendDealingReady(): void;

// 新增事件监听类型（补充到 NetManager 事件枚举）
on("code_card_reveal", (data: { suit: number; value: number; landlordSeatIndex: number }) => void): void;
```

### 约束

- AC-C3 兜底逻辑必须存在：P5 UI 尚未集成时，若无动画回调则直接发 `dealing_ready`，否则服务端永远卡在等待
- 动画时长必须 **严格小于等于** 服务端窗口（C009: 4s，C010: 2s），不可超出
- 不修改 `GameMgr` 以外的状态机逻辑

### 不在范围内

- 发牌动画的具体实现（属于 TASK-043 范围）；本任务只接入回调触发点
- `code_card_reveal` 揭晓动画的视觉实现（属于 TASK-043 范围）；本任务只接入 handler 框架

---

## 测试要求

**server（TASK-050s）**：
- 单元测试：5x `dealing_ready` → 立即推进；4x `dealing_ready` + 10s 超时 → 静默推进
- 单元测试：`select_code_card` → `code_card_reveal` 广播 → 4s 后 phase=doubling
- 单元测试：最后一个 `set_double` → `doubling_result` 广播 → 2s 后 phase=playing
- 边界：`dealing_ready` 重复发送（同一 sessionId）不累计计数
- 全套测试绿通后 `/verify` 联调确认三段动画不再截断

**client（TASK-050c）**：
- `sendDealingReady()` 单元测试：调用后 room.send 收到 "dealing_ready"
- `code_card_reveal` handler 单元测试：收到消息后正确解析 suit/value/landlordSeatIndex
- GameFlow.integration 冒烟：全流程跑通，无阶段截断错误日志
