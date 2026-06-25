# Backlog

> PM 写，Client/Server 读。每条任务包含：ID、目标模块、优先级、spec 链接。

## 格式

```
- [ ] TASK-{id} [{模块}] {一句话描述} → spec: specs/{feature}.md
```

## 当前任务

- [x] TASK-001 [shared] 实现 CardEncoding.ts：0-107 编码/解码 + compareValue → spec: specs/card-encoding.md **[ready]**
- [x] TASK-002 [shared] 实现 CardPattern.ts：PatternType 枚举 + CardPattern 接口 → spec: specs/card-pattern.md **[ready]**
- [x] TASK-003 [shared] 实现 PatternHelper.ts：parse() + canBeat() → spec: specs/pattern-helper.md **[ready]**
- [x] TASK-004 [infra] MySQL DDL 建表 + Docker Compose 骨架 → spec: specs/infra-setup.md **[ready]**

## P1 任务（依赖 P0 shared 完成）

- [x] TASK-005 [server] 实现 CardPatternEngine.ts → spec: specs/card-pattern-engine.md **[done]**
- [x] TASK-006 [server] 实现 RuleEngine.ts → spec: specs/rule-engine.md **[done]**
- [x] TASK-007 [server] 实现 CodeCard.ts → spec: specs/code-card.md **[done]**
- [x] TASK-009 [server] 实现 Deck.ts → spec: specs/deck.md **[done]**
- [x] TASK-008 [server] 实现 CardRoom.ts：状态机 + 消息处理 + 超时托管 + 断线重连 → spec: specs/card-room.md **[done]**

## P2 任务（客户端 UI，依赖 P1 server 协议稳定）

- [x] TASK-017 [server] 实现 AuthService Stub：占位登录 + JWT + /auth/login + /auth/me → spec: specs/auth-service-stub.md **[done]**

- [x] TASK-016 [client] 横屏适配基础配置：方向锁定 + 1280×720 基准 + 安全区 + 多端验证 → spec: specs/screen-adaptation.md **[done]**
- [x] TASK-010 [client] 实现 NetManager.ts：Colyseus 连接封装 + EventManager 消息路由 → spec: specs/net-manager.md **[done]**
- [x] TASK-011 [client] 实现 GameController.ts：客户端状态机（7状态）+ 消息驱动 **[done]**
- [x] TASK-010b [client] 实现 LaunchView.ts：启动页 + 占位登录 + token 缓存 **[done]**
- [x] TASK-012 [client] 实现 HandCardView.ts + PlayZone.ts：手牌选择 + 出牌区 **[done]**
- [x] TASK-013 [client] 实现 PlayerSeat.ts + CodeCardSelector.ts：席位展示 + 暗号牌选择弹窗 **[done]**
- [x] TASK-014 [client] 实现 SettlementView.ts：结算界面 + 身份揭晓动画 **[done]**
- [x] TASK-015 [client] 实现 HallView.ts + MatchView.ts：主大厅 + 快速匹配/好友房 **[done]**

## P3 任务（服务端优化，P2 client 联调期间并行）

- [x] TASK-018 [server] 实现 MatchMaker：段位分桶 + 容忍度扩展 + 好友房 roomCode → spec: specs/matchmaker.md **[done]**
- [x] TASK-019 [server] 实现 SettleService V1（已废弃，被 TASK-022 替换）→ spec: specs/settle-service.md **[deprecated]**
- [x] TASK-021 [server] 实现 Logger + 埋点：结构化日志 + 关键事件埋点 → spec: specs/logging-monitor.md **[done]**
- [x] TASK-020 [server] 实现 AIPlayer：补位/托管出牌策略 → spec: specs/ai-player.md **[done]** 241/241 tests

## P4.1 任务（AI 升级 + 数值校准，串行执行）

- [x] TASK-025 [server] 实现 CardDecomposer：手牌拆分引擎（枚举所有合法牌型）→ spec: specs/card-decomposer.md **[done]**
- [x] TASK-026 [server] 实现 AIPlayer V2：Tier 1 启发式策略（替换保守 AI）→ spec: specs/smart-ai-player.md **[done]**
- [x] TASK-024 [server] 数值模拟校准：5-AI 房间跑 ≥10万局，Gate 胜率 45%–55% → spec: specs/simulation-calibration.md **[done]**

## P4.1+ 任务（数值体系）

- [x] TASK-023 [server] CardRoom 加倍阶段：新增 doubling 状态 + 协议消息 → spec: specs/doubling-phase.md **[done]**
- [x] TASK-022 [server] SettleService V2：零和倍数公式 + 场次底分 + 个人加倍 → spec: specs/scoring-v2.md **[done]**

## P4.2 任务（客户端 UI 补全）

- [x] TASK-027 [client] 加倍阶段 UI：DoublingView + GameController DOUBLING 状态 + NetManager.setDouble → spec: specs/doubling-view.md **[done]**
- [x] TASK-028 [client] SettlementView V2：倍率明细区 + 个人加倍展示 + V1 降级兼容 → spec: specs/settlement-view-v2.md **[done]**

## P4.3 任务（Demo 功能，server/client 可并行）

- [x] TASK-029s [server] 快速匹配 AI 补位：可配置等待超时 + AI 注入 + `waiting_update` 广播 → spec: specs/quick-match-ai-fill.md **[done]**
- [x] TASK-029c [client] 快速匹配等待界面：倒计时 + AI 补位提示 + MatchView 扩展 → spec: specs/quick-match-ai-fill.md **[done]**
- [x] TASK-030s [server] 好友房服务端：`room_update` 广播 + `force_start` + `ownerSessionId` → spec: specs/friend-room-flow.md **[done]**
- [x] TASK-030c [client] 好友房客户端：等待室人员列表 + 开始按钮 + 平台分享 → spec: specs/friend-room-flow.md **[done]**
- [x] TASK-031s [server] 再来一局服务端：rematch 窗口期 + 好友房重开 + 快速匹配重排队 → spec: specs/rematch.md **[done]**
- [x] TASK-031c [client] 再来一局客户端：SettlementView「再来一局」按钮 + 状态处理 → spec: specs/rematch.md **[done]**

## P4.4 任务（集成冒烟 + Demo 准备）

- [x] TASK-032s [server] 集成冒烟准备：修 BUG-001/002/003/004 + 启动环境验证 → spec: specs/integration-smoke.md **[done: 356/356]**
- [x] TASK-032c [client] 全流程集成冒烟测试：Node.js 直连真实 server，跑完整游戏流程 → spec: specs/integration-smoke.md **[done: 9/9 AC]**
- [x] TASK-032c-fix [client] 修复 ISSUE-S003：升级冒烟测试出牌代理，按 hint 完整自然打一局直到 game_over → spec: specs/integration-smoke.md **[done: 9/9 AC，32s 完成]**
- [x] TASK-036 [client] P1 协议全覆盖冒烟：按 PROTOCOL.md 覆盖所有消息、错误码、重连、HTTP 接口 → spec: specs/protocol-coverage-smoke.md **[done: 36/36]**

## P4.6 任务（Bug 修复批次二，与 TASK-036 并行）

- [x] TASK-037 [server] Bug 修复批次二：ISSUE-009 rematch disconnect崩溃 + ISSUE-010 handlePass log + ISSUE-003 文件头注释 **[done: 369/369]**
- [x] TASK-038 [server] 测试阶段战报日志：finishGame 输出完整 BattleReport JSON（出牌序列 + 身份揭晓 + 倍率明细 + 结果），不落库 → spec: specs/battle-report-log.md **[done: 390/390]**
- [x] TASK-039 [server+shared] Bug 修复批次三：① shared/PatternHelper.ts 单张王合法 SINGLE + 补测试 + GAME-RULES.md 更正 ② ISSUE-S004 根因排查（含 AIPlayer hint 推荐 Joker 单张场景）③ ISSUE-S005 turn_change 加 isNewRound + PROTOCOL.md 更新 ④ ISSUE-S006 [PASS] log 移位 **[done: 395/395]**
- [x] TASK-039c [client+shared] 同步 TASK-039 shared 变更：client/assets/scripts/shared/PatternHelper.ts 同步单张王修复 + ISSUE-S005 turn_change handler 读 isNewRound + C011 error 1001 不 pass **[done]**
- [x] TASK-040 [server] ISSUE-S007：realPlayerCount=0 时清除 AI fake clients + disconnect()，修复 GameFlow 后 503 **[done: 398/398]**

## P5 任务（UI 视觉搭建，core 已验证）

### P5.0 — oops-framework 集成 + 场景骨架

- [ ] TASK-041 [client] LaunchScene + HallScene 节点树搭建 + AppRoot 初始化 + oops.res/storage 接入 → spec: specs/ui-flow-01-launch-hall.md **[ready]**
- [ ] TASK-042 [client] MatchView（快速匹配 + 好友房）弹层搭建 + SeatItem Prefab + 等待动画 → spec: specs/ui-flow-02-match-wait.md **[ready]**

### P5.1 — 游戏桌（依赖 TASK-041/042）

- [ ] TASK-043 [client] GameScene 节点树 + CardItem Prefab + PlayerSeat Prefab + HandCardView + CodeCardSelector → spec: specs/ui-flow-03-deal-landlord.md **[ready]**
- [ ] TASK-044 [client] DoublingView + PlayZone + 出牌交互 + hint 高亮 → spec: specs/ui-flow-04-doubling-play.md **[ready]**
- [ ] TASK-045 [client] SettlementView + PlayerResultCard Prefab + 身份揭晓动画 + 再来一局 → spec: specs/ui-flow-05-settlement-rematch.md **[ready]**

### P5.2 — 服务端协议补全（与 P5.1 并行）

- [ ] TASK-046 [server] game_over 消息增强：添加 players[] + breakdown，供结算 UI 渲染 → spec: specs/server-game-over-enhance.md **[ready]**

### P5.3 — P1 大厅功能（P5.0 上线后）

- [ ] TASK-047 [server] GET /api/leaderboard：全服 Top 50 积分榜，Redis 缓存 60s → spec: 待写
- [ ] TASK-048 [server] POST /api/checkin：每日签到 + 连续签到奖励积分（50/100/200/300/500/500/1000） → spec: 待写

---

## P4.5 任务（协议对齐）

- [x] TASK-033 [client] Client ↔ PROTOCOL.md 对齐：NetManager 单例 + auth token + play_broadcast 移除 + landlordSeat 修正 + suit 类型 + bottom_cards/hint 路由 → spec: specs/client-protocol-align.md **[done: 233/233]**

- [x] TASK-034 [server] Bug 修复批次一：ISSUE-005 handlePass守卫 + ISSUE-006 landlord_select超时 + ISSUE-001 realPlayerCount递减 + ISSUE-007 重连补全 → spec: specs/bugfix-server-034.md **[done: 369/369]**
- [x] TASK-035 [client] Bug 修复批次一：ISSUE-C001 setConnected + ISSUE-C002~C007 → spec: specs/bugfix-client-035.md **[done: 256/256]**
