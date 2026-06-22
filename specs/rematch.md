# Spec: 结算后再来一局

**任务 ID**: TASK-031s（server）/ TASK-031c（client）  
**目标模块**: server + client（可并行开发）  
**优先级**: P4.3 Demo  
**状态**: ready  
**前置依赖**: TASK-022（SettleService V2）done；TASK-028（SettlementView V2）done  
**权威来源**: GDD v1.0 第六章（6.3 局后流程）

---

## 背景

结算后玩家只有「返回大厅」一条路，Demo 体验断裂。需要在结算界面增加「再来一局」，让玩家不用重走匹配流程即可继续游戏。

两种场景行为不同：
- **好友房**：原房重开（房主发起，全员留下，重新发牌）
- **快速匹配**：直接重新进入匹配队列（不等其他玩家）

---

## 验收标准

### TASK-031s — 服务端：好友房重开

- AC-1: 结算广播 `game_over` 后，CardRoom 进入 `disposed` 前有 30 秒「重开窗口期」；窗口期内房间不销毁
- AC-2: 窗口期内任意玩家可发送 `request_rematch`，服务端记录该玩家已同意
- AC-3: 好友房场景：所有真实玩家均发送 `request_rematch` → 服务端重置 CardRoom 状态机回 `waiting`，重新走发牌流程
- AC-4: 好友房：30 秒窗口期结束仍有玩家未同意 → 房间正常进入 `disposed`，未同意玩家断开连接
- AC-5: 每次有玩家同意，广播 `rematch_update { agreedCount, total: <真实玩家数> }`
- AC-6: 全员同意后广播 `rematch_start`，房间状态重置，重新发牌

### TASK-031s — 服务端：快速匹配重新排队

- AC-7: 快速匹配场景（非好友房）：`request_rematch` 不触发房间重置；服务端返回 `rematch_redirect { action: "requeue" }`，提示客户端重新排队
- AC-8: 重新排队时保留原玩家的 `rankLevel`，排队逻辑与首次匹配相同

### TASK-031c — 客户端：结算界面扩展（SettlementView 扩展）

- AC-9: 结算界面底部增加「再来一局」和「返回大厅」两个按钮（原「返回大厅」保留）
- AC-10: 点击「再来一局」→ 发送 `request_rematch`；按钮变为「等待中…」并禁用
- AC-11: 收到 `rematch_update` → 更新「X/Y 人同意再来一局」提示（Y = 真实玩家总数）
- AC-12: 收到 `rematch_start` → 隐藏结算界面，游戏桌场景重新进入 `DEALING` 状态
- AC-13: 收到 `rematch_redirect { action: "requeue" }` → 断开当前房间，自动进入快速匹配等待界面（跳过大厅）
- AC-14: 30 秒内未收到 `rematch_start` 或 `rematch_redirect` → 「再来一局」按钮恢复可点击，显示「有玩家未同意」提示
- AC-15: 点击「返回大厅」→ 断开房间连接，跳转大厅（不发送 `request_rematch`）

---

## 协议新增

```typescript
// Client → Server
interface RequestRematchMsg {
  type: "request_rematch";
}

// Server → Client（广播）
interface RematchUpdateMsg {
  type: "rematch_update";
  agreedCount: number;
  total:       number;  // 真实玩家总数（不含 AI）
}

interface RematchStartMsg {
  type: "rematch_start";  // 全员同意，房间重置，即将重新发牌
}

interface RematchRedirectMsg {
  type: "rematch_redirect";
  action: "requeue";  // 快速匹配场景，客户端重新排队
}
```

---

## 约束

- `request_rematch` 仅在 `settlement` 阶段（30 秒窗口期内）有效；其他阶段发送静默忽略
- 好友房重开时 AI 补位玩家自动重新注入（沿用 TASK-029 注入逻辑），无需真实玩家同意
- 快速匹配场景的 AI 补位玩家不参与「全员同意」计数（只计真实玩家）
- 房间重置不清空 `ownerSessionId`（好友房房主不变）
- 重开最多允许连续 10 局，超出后强制返回大厅（防止无限循环）

## 不在范围内

- 局后聊天 / 表情互动 —— P4.4
- 好友房房主变更后的重开逻辑 —— P4.4
- 积分历史记录展示 —— P4.4

## 测试要求

**TASK-031s（server）**
- 单元测试：AC-1–8，共 8 条
- 集成测试：好友房全员同意 → 房间重置 → 第二局正常完成

**TASK-031c（client）**
- 单元测试：AC-9–15，共 7 条
