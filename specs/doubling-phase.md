# Spec: CardRoom 加倍阶段

**任务 ID**: TASK-023  
**目标模块**: server  
**优先级**: P3（前置于 TASK-022）  
**状态**: ready  
**前置依赖**: TASK-008（CardRoom）done  
**权威来源**: 项目计划书 V1.1 第七章 §7.3

---

## 背景

计划书 V1.1 在发牌完成、出牌开始前增加了**加倍阶段**。原 CardRoom 状态机缺少此状态；CardRoom 需要新增 `doubling` 状态、相关协议消息以及超时处理，并将 dL / di 结果传入结算数据（GameSummaryV2）。

---

## 状态机变更

原状态机：`waiting → dealing → landlord_select → playing → settlement → disposed`

新状态机：`waiting → dealing → landlord_select → **doubling** → playing → settlement → disposed`

---

## 验收标准

### 状态转换

- AC-1: 地主完成暗号牌选择后，状态从 `landlord_select` 切换到 `doubling`
- AC-2: 所有玩家（包括地主）的加倍选择均到达后，状态立即切换到 `playing`
- AC-3: 加倍阶段超时（30秒）→ 未选择的玩家自动取 di=1；进入 `playing`

### 加倍流程

- AC-4: 进入 `doubling` 后，服务端立即向全场广播 `doubling_start` 消息
- AC-5: 地主先通过 `set_double` 提交 dL（1 或 2）；提交前其余玩家可以选择但不能提交
- AC-6: 地主提交 dL 后，服务端广播 `landlord_doubled`（仅公开 dL 值），其余4人开始秘密提交
- AC-7: 其余4人秘密、独立提交 di（1 或 2），无顺序要求
- AC-8: 全部5人提交完成后，服务端广播 `doubling_result`：公开每个座位「已加倍/未加倍」，**不泄露身份**（暗队友与平民加倍在消息中无区分）
- AC-9: `doubling_result` 中 `doubled` 字段仅为 boolean，不含玩家角色信息

### 数据传递

- AC-10: `landlordDouble` 和 `playerDoubles`（含暗队友）写入 `GameSummaryV2`，传给 SettleService
- AC-11: `partnerDoubled`（暗队友是否加倍）由 `CodeCard.resolveTeammate()` 结果与 `playerDoubles` 组合得出，写入 `GameSummaryV2`

### 断线与重连

- AC-12: 加倍阶段断线玩家重连后，若阶段仍在进行，收到 `doubling_start` 重播消息
- AC-13: 断线玩家未在超时前重连，视为 di=1（AC-3 规则适用）

---

## 协议消息

```typescript
// Server → Client

interface DoublingStartMsg {
  type: "doubling_start";
  timeout: number;           // 秒，倒计时
  landlordSeatIndex: number; // 地主座位（先选）
}

interface LandlordDoubledMsg {
  type: "landlord_doubled";
  value: 1 | 2;              // dL 公开
}

interface DoublingResultMsg {
  type: "doubling_result";
  results: Array<{
    seatIndex: number;
    doubled: boolean;        // 仅 true/false，不含身份
  }>;
}

// Client → Server

interface SetDoubleMsg {
  type: "set_double";
  value: 1 | 2;
}
```

---

## 约束

- 加倍阶段 `GameState` 新增字段：`doublingPhase: boolean`、`landlordDoubleValue: 0|1|2`（0=未选）
- 服务端校验：非当前轮次的 `set_double` 消息直接丢弃（不报错）
- 地主未提交 dL 前，其余玩家的 `set_double` 消息接收并暂存，dL 提交后立即处理队列
- 暗队友身份在加倍阶段不向客户端泄露（`doubling_result` 只有 `doubled: boolean`）

## 不在范围内

- 客户端加倍 UI（属 client-dev，随 TASK-011 扩展）
- 明保规则（详见计划书 §7.7）—— P4 可选规则，当前不实现

## 测试要求

- 单元测试覆盖全部 13 条 AC
- 边界：全员选 d=1 / 全员选 d=2 / 部分超时
- 错误路径：重复提交 `set_double`（取最后一次还是第一次，dev 决定并在测试中固定）
- 集成：doubling → playing 状态转换后，GameSummaryV2 的 dL/di 字段正确
