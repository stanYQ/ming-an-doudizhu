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
- [~] TASK-011 [client] 实现 GameController.ts：客户端状态机（7状态）+ 消息驱动 → spec: specs/game-controller.md **[in-progress]** （client-dev 认领 2026-06-09）
- [ ] TASK-010b [client] 实现 LaunchView.ts：启动页 + 占位登录 + token 缓存 → spec: specs/launch-login.md **[ready]** （前置：TASK-017 ✅）
- [ ] TASK-012 [client] 实现 HandCardView.ts + PlayZone.ts：手牌选择 + 出牌区 → spec: specs/game-table-ui.md **[ready]** （前置：TASK-011）
- [ ] TASK-013 [client] 实现 PlayerSeat.ts + CodeCardSelector.ts：席位展示 + 暗号牌选择弹窗 → spec: specs/player-seat-ui.md **[ready]** （前置：TASK-011）
- [ ] TASK-014 [client] 实现 SettlementView.ts：结算界面 + 身份揭晓动画 → spec: specs/settlement-view.md **[ready]** （前置：TASK-011）
- [ ] TASK-015 [client] 实现 HallView.ts + MatchView.ts：主大厅 + 快速匹配/好友房 → spec: specs/hall-match-view.md **[ready]** （前置：TASK-010 ✅）

## P3 任务（服务端优化，P2 client 联调期间并行）

- [x] TASK-018 [server] 实现 MatchMaker：段位分桶 + 容忍度扩展 + 好友房 roomCode → spec: specs/matchmaker.md **[done]**
- [x] TASK-019 [server] 实现 SettleService：完整积分公式 + 分配规则 + 写库事务 → spec: specs/settle-service.md **[done]**
- [x] TASK-021 [server] 实现 Logger + 埋点：结构化日志 + 关键事件埋点 → spec: specs/logging-monitor.md **[done]**
- [ ] TASK-020 [server] 实现 AIPlayer：补位/托管出牌策略 → spec: specs/ai-player.md **[ready]** （前置：TASK-018 ✅）
