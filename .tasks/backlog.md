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

- [ ] TASK-025 [server] 实现 CardDecomposer：手牌拆分引擎（枚举所有合法牌型）→ spec: specs/card-decomposer.md **[ready]**
- [ ] TASK-026 [server] 实现 AIPlayer V2：Tier 1 启发式策略（替换保守 AI）→ spec: specs/smart-ai-player.md **[ready]** （前置：TASK-025）
- [ ] TASK-024 [server] 数值模拟校准：5-AI 房间跑 ≥10万局，Gate 胜率 45%–55% → spec: specs/simulation-calibration.md **[ready]** （前置：TASK-026）⚠️ Gate 通过后解锁 TASK-023/022

## P4.1+ 任务（数值体系，依赖 TASK-024 Gate 通过）

- [ ] TASK-023 [server] CardRoom 加倍阶段：新增 doubling 状态 + 协议消息 → spec: specs/doubling-phase.md **[ready]** （前置：TASK-024 ✅）
- [ ] TASK-022 [server] SettleService V2：零和倍数公式 + 场次底分 + 个人加倍 → spec: specs/scoring-v2.md **[ready]** （前置：TASK-023 done）
