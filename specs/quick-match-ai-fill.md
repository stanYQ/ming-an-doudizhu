# Spec: 快速匹配 + AI 补位（Demo 串联）

**任务 ID**: TASK-029s（server）/ TASK-029c（client）  
**目标模块**: server + client（可并行开发）  
**优先级**: P4.3 Demo  
**状态**: ready  
**前置依赖**: TASK-018（MatchMaker）done；TASK-026（AIPlayer V2）done；TASK-015（MatchView）done  
**权威来源**: specs/matchmaker.md AC-5–7（AI 补位定义）

---

## 背景

MatchMaker spec AC-5 定义了"30 秒未满 5 人 → AI 补位开局"，但：
1. 30 秒对 Demo 演示过长
2. CardRoom 当前仅在第 5 个**真实玩家**加入时才触发 `dealing`，AI 注入路径未串联
3. 客户端等待界面无倒计时，玩家不知道 AI 何时补位

TASK-029 串联这三处缺口，使快速匹配可完整跑通。

---

## 验收标准

### TASK-029s — 服务端：超时可配置

- AC-1: `CardRoom` 接受初始化选项 `{ aiFillDelay: number }`（秒），默认 30，Demo 模式可设为 10
- AC-2: 房间创建后启动 `aiFillDelay` 倒计时；倒计时内若已满 5 人，取消计时器（不触发补位）
- AC-3: 倒计时结束时人数 < 5 → 注入 `5 - currentPlayers` 个 AIPlayer V2 实例，立即触发 `dealing`
- AC-4: AI 玩家的 sessionId 格式为 `ai_<uuid4前8位>`，`Player.isAI = true`
- AC-5: AI 玩家不写 `users` 表，`game_players.user_id = 0` 占位（与 TASK-022 约束一致）

### TASK-029s — 服务端：等待状态广播

- AC-6: 每当有真实玩家加入/离开，广播 `waiting_update { readyCount, total: 5, aiSeconds: number }`
  - `readyCount`：当前真实玩家数
  - `aiSeconds`：AI 补位剩余秒数（整数，倒计时期间每秒更新）
- AC-7: 满 5 人后停止广播 `waiting_update`，进入正常发牌流程

### TASK-029c — 客户端：等待界面更新（MatchView 扩展）

- AC-8: 收到 `waiting_update` → 更新「X/5 人」数字和 AI 补位倒计时「X 秒后 AI 补位」
- AC-9: 倒计时归零显示「AI 补位中…」，随后收到 `STATE phase=dealing` 时切换到游戏桌
- AC-10: 真实玩家数已达 5 人时，倒计时区域隐藏（不显示"AI 补位"）
- AC-11: 点击「取消匹配」→ 断开连接，返回大厅；若已进入 `dealing` 阶段，取消按钮禁用

---

## 协议新增

```typescript
// Server → Client（广播）
interface WaitingUpdateMsg {
  type: "waiting_update";
  readyCount: number;   // 当前真实玩家数
  total: 5;
  aiSeconds: number;    // 剩余补位倒计时（秒），满员后为 0
}
```

---

## 约束

- `aiFillDelay` 仅通过服务端环境变量或 Colyseus `roomOptions` 配置，不暴露给客户端
- Demo 启动命令：`AI_FILL_DELAY=10 npm run dev`
- AI 注入后不可取消（玩家无法踢出 AI）
- 此任务不修改 MatchMaker 的段位分桶逻辑

## 不在范围内

- AI 难度设置 —— P4.4
- 好友房 AI 补位 —— 见 TASK-030
- 匹配等待时显示其他玩家头像 —— P4.3 视觉优化

## 测试要求

**TASK-029s（server）**
- 单元测试：AC-1–7，共 7 条
- 集成测试：1 个真实玩家 + 等待 10s → AI 补满 4 人 → `dealing` 正常触发

**TASK-029c（client）**
- 单元测试：AC-8–11，共 4 条
