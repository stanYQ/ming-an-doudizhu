# Spec: 好友房完整流程（Demo）

**任务 ID**: TASK-030s（server）/ TASK-030c（client）  
**目标模块**: server + client（可并行开发）  
**优先级**: P4.3 Demo  
**状态**: ready  
**前置依赖**: TASK-018（MatchMaker roomCode）done；TASK-015（MatchView 基础 UI）done  
**权威来源**: specs/matchmaker.md AC-11–13；specs/hall-match-view.md AC-11–16

---

## 背景

TASK-015 完成了好友房的基础 UI 骨架（创建/加入/展示房间码）。Demo 阶段需要补全两处缺口：
1. **等待室人员列表**：显示已进房玩家昵称/头像，而非只显示数字"X/5"
2. **房主强制开局**：Demo 演示中不一定有 5 个真人，房主应能手动触发 AI 补满剩余席位

---

## 验收标准

### TASK-030s — 服务端：等待室状态广播

- AC-1: 每当有玩家加入/离开好友房，广播 `room_update { players: PlayerSlot[] }`
- AC-2: `PlayerSlot` 包含 `{ seatIndex, nickname, avatarUrl, isReady: false }`（好友房无"准备"步骤，`isReady` 预留字段，恒为 false）
- AC-3: 房间内所有人收到同一份 `room_update`，无私发

### TASK-030s — 服务端：房主强制开局

- AC-4: 好友房创建者（第一个加入的玩家）为房主，`GameState` 中新增 `ownerSessionId: string` 字段
- AC-5: 房主可在 `waiting` 阶段发送 `force_start` 消息
- AC-6: 收到 `force_start` 时人数 ≥ 2 → 用 AI 补满剩余席位，立即触发 `dealing`
- AC-7: 收到 `force_start` 时人数 < 2（房主独自一人）→ 返回 `error { code: 2003, msg: "至少需要2名真实玩家才能开局" }`
- AC-8: 非房主发送 `force_start` → 静默忽略

### TASK-030c — 客户端：等待室 UI 更新（MatchView 扩展）

- AC-9: 收到 `room_update` → 渲染玩家列表（已进房玩家显示昵称 + 头像占位，空席显示「等待加入…」）
- AC-10: 本机是房主 → 显示「开始游戏」按钮（灰色）；人数 ≥ 2 时按钮变为可点击
- AC-11: 点击「开始游戏」→ 发送 `force_start`；收到 `error 2003` 时显示提示文字
- AC-12: 本机不是房主 → 不显示「开始游戏」按钮，显示「等待房主开始…」
- AC-13: 收到 `STATE phase=dealing` → 隐藏等待室，进入游戏桌场景

### TASK-030c — 客户端：房间码分享

- AC-14: 房间码展示区新增「分享」按钮（原有「复制」按钮保留）
- AC-15: 点击「分享」→ 调用平台分享 API，分享文案为「我在玩明暗斗地主，房间码：{code}，快来加入！」
  - 微信小程序：`wx.shareAppMessage`
  - H5：调用系统原生 share API（`navigator.share`），不可用时降级为复制文案到剪贴板
- AC-16: 分享失败（用户取消或 API 不支持）→ 静默处理，不报错

---

## 协议新增

```typescript
// Server → Client（广播）
interface RoomUpdateMsg {
  type: "room_update";
  players: Array<{
    seatIndex:  number;
    nickname:   string;
    avatarUrl:  string;
    isReady:    boolean;  // 预留，当前恒 false
  }>;
  ownerSeatIndex: number;  // 房主席位，客户端据此判断是否显示开始按钮
}

// Client → Server
interface ForceStartMsg {
  type: "force_start";
}
```

---

## 约束

- `force_start` 仅在 `waiting` 阶段有效；`dealing` 后发送 → 静默忽略
- AI 补位逻辑复用 TASK-029 的注入机制，不重复实现
- 好友房 `aiFillDelay` 不启动自动倒计时（好友房不自动补位，只有房主手动触发）
- 新增错误码 `2003`（人数不足无法开局）

## 不在范围内

- 房主转让 —— P4.4
- 踢出玩家 —— P4.4
- 观战席位 —— P4.4
- 分享图片/卡片 —— P4.3 视觉优化

## 测试要求

**TASK-030s（server）**
- 单元测试：AC-1–8，共 8 条
- 集成测试：房主 `force_start`（2人）→ AI 补满 3 人 → `dealing` 正常触发

**TASK-030c（client）**
- 单元测试：AC-9–16，共 8 条
