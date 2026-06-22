# Done

> 任务完成后移到这里，注明完成者、测试状态、产物路径。

## 格式

```
- [x] TASK-{id} [{模块}] {描述} | 完成: {client-dev|server-dev} | 测试: ✓/✗ | 产物: {文件路径}
```

## 已完成

- [x] TASK-001 [shared] 实现 CardEncoding.ts：0-107 编码/解码 + compareValue | 完成: server-dev | 测试: ✓ | 产物: shared/CardEncoding.ts, server/src/__tests__/CardEncoding.test.ts
- [x] TASK-002 [shared] 实现 CardPattern.ts：PatternType 枚举 + CardPattern 接口 | 完成: server-dev | 测试: ✓ | 产物: shared/CardPattern.ts, server/src/__tests__/CardPattern.test.ts
- [x] TASK-003 [shared] 实现 PatternHelper.ts：parse() + canBeat() | 完成: server-dev | 测试: ✓ | 产物: shared/PatternHelper.ts, server/src/__tests__/PatternHelper.test.ts
- [x] TASK-004 [infra] MySQL DDL 建表 + Docker Compose 骨架 | 完成: server-dev | 测试: ✓ | 产物: infra/mysql/init.sql, infra/docker-compose.yml, infra/nginx.conf
- [x] TASK-005 [server] 实现 CardPatternEngine.ts：服务端权威识别 | 完成: server-dev | 测试: ✓ | 产物: server/src/logic/CardPatternEngine.ts, server/src/__tests__/CardPatternEngine.test.ts
- [x] TASK-006 [server] 实现 RuleEngine.ts：ownsAll + removeCards + validatePlay + determineWinner | 完成: server-dev | 测试: ✓ | 产物: server/src/logic/RuleEngine.ts, server/src/__tests__/RuleEngine.test.ts
- [x] TASK-007 [server] 实现 CodeCard.ts：暗号牌校验 + 队友确认 + 一挑四判定 | 完成: server-dev | 测试: ✓ | 产物: server/src/logic/CodeCard.ts, server/src/__tests__/CodeCard.test.ts | client-dev 需同步（shared/CardPattern.ts 新增 Suit 类型）
- [x] TASK-009 [server] 实现 Deck.ts：Fisher-Yates 洗牌 + 5人发牌 + 明牌地主确认 | 完成: server-dev | 测试: ✓ | 产物: server/src/logic/Deck.ts, server/src/__tests__/Deck.test.ts
- [x] TASK-004b [server] 实现 RedisKeys.ts：Redis 键名常量（来自 TASK-004 infra spec）| 完成: server-dev | 测试: ✓ | 产物: server/src/cache/RedisKeys.ts, server/src/__tests__/RedisKeys.test.ts
- [x] TASK-008 [server] 实现 CardRoom.ts：状态机 + 消息处理 + 超时托管 + 断线重连 | 完成: server-dev | 测试: ✓ 24/24 AC | 产物: server/src/rooms/CardRoom.ts, server/src/rooms/schema/Player.ts, server/src/rooms/schema/GameState.ts, server/src/__tests__/CardRoom.test.ts | 总测试: 157/157
- [x] TASK-010 [client] 实现 NetManager.ts：Colyseus 连接封装 + oops.message 消息路由 | 完成: client-dev | 测试: ✓ 16/16 AC | 产物: client/assets/scripts/net/NetManager.ts, client/assets/scripts/__tests__/NetManager.test.ts
- [x] TASK-011 [client] 实现 GameController.ts：客户端状态机（7状态）+ 消息驱动 | 完成: client-dev | 测试: ✓ 24/24 AC | 产物: client/assets/scripts/game/GameController.ts, client/assets/scripts/__tests__/GameController.test.ts
- [x] TASK-016 [client] 横屏适配基础配置：方向锁定 + 1280×720 基准 + 安全区 + 多端验证 | 完成: client-dev | 测试: ✓ 3/3 | 产物: client/assets/scripts/core/ScreenAdapter.ts, client/assets/scripts/core/SafeAreaWidget.ts, client/settings/v2/packages/builder.json
- [x] TASK-017 [server] 实现 AuthService Stub：占位登录 + JWT + /auth/login + /auth/me | 完成: server-dev | 测试: ✓ 19/19 AC | 产物: server/src/services/AuthService.ts, server/src/routes/authRoutes.ts, server/src/db/connection.ts, server/src/index.ts, server/src/__tests__/AuthService.test.ts | 总测试: 176/176
- [x] TASK-021 [server] 实现 Logger + 埋点：结构化日志 + 关键事件埋点 | 完成: server-dev | 测试: ✓ 17/17 AC | 产物: server/src/utils/Logger.ts, server/src/__tests__/Logger.test.ts | 总测试: 193/193
- [x] TASK-019 [server] 实现 SettleService：完整积分公式 + 分配规则 + 写库事务 | 完成: server-dev | 测试: ✓ 21/21 AC | 产物: server/src/services/SettleService.ts, server/src/__tests__/SettleService.test.ts | 总测试: 214/214
- [x] TASK-018 [server] 实现 MatchMaker：段位分桶 + 容忍度扩展 + 好友房 roomCode | 完成: server-dev | 测试: ✓ 16/16 AC | 产物: server/src/services/MatchService.ts, server/src/cache/redisClient.ts, server/src/__tests__/MatchService.test.ts | 总测试: 230/230
- [x] TASK-020 [server] 实现 AIPlayer：补位/托管出牌策略 | 完成: server-dev | 测试: ✓ 11/11 AC | 产物: server/src/logic/AIPlayer.ts, server/src/__tests__/AIPlayer.test.ts | 总测试: 241/241
- [x] TASK-013 [client] 实现 PlayerSeat.ts + CodeCardSelector.ts：席位展示 + 暗号牌选择弹窗 | 完成: client-dev | 测试: ✓ 22/22 AC | 产物: client/assets/scripts/ui/PlayerSeat.ts, client/assets/scripts/ui/CodeCardSelector.ts
- [x] TASK-014 [client] 实现 SettlementView.ts：结算界面 + 积分展示 + 倍率明细 | 完成: client-dev | 测试: ✓ 18/18 AC | 产物: client/assets/scripts/ui/SettlementView.ts
- [x] TASK-010b [client] 实现 LaunchView.ts：启动页 + Stub 登录 + JWT 缓存 + 跳转大厅 | 完成: client-dev | 测试: ✓ 9/9 AC | 产物: client/assets/scripts/ui/LaunchView.ts
- [x] TASK-015 [client] 实现 HallView.ts + MatchView.ts：主大厅 + 快速匹配/好友房 | 完成: client-dev | 测试: ✓ 16/16 AC | 产物: client/assets/scripts/ui/HallView.ts, client/assets/scripts/ui/MatchView.ts
- [x] TASK-012 [client] 实现 HandCardView.ts + PlayZone.ts：手牌选择 + 出牌区 | 完成: client-dev | 测试: ✓ 23/23 AC | 产物: client/assets/scripts/ui/HandCardView.ts, client/assets/scripts/ui/PlayZone.ts | 注: 测试文件修正 AC-11 card 编码错误（3♥=13，非1）
- [x] TASK-025 [server] 实现 CardDecomposer：手牌拆分引擎（decompose / minTurns / generateAll）| 完成: server-dev | 测试: ✓ 25/25 AC | 产物: server/src/logic/CardDecomposer.ts, server/src/__tests__/CardDecomposer.test.ts | 总测试: 266/266
- [x] TASK-026 [server] 实现 AIPlayer V2：残手权重策略 + 阵营感知 | 完成: server-dev | 测试: ✓ 24/24 AC（含 15 局模拟 141ms） | 产物: server/src/logic/AIPlayer.ts, server/src/__tests__/AIPlayer.test.ts | 总测试: 279/279
- [x] TASK-023 [server] CardRoom 加倍阶段：doubling 状态 + 协议消息 | 完成: server-dev | 测试: ✓ 40 tests（23 unit + 新增 17 doubling AC）| 产物: server/src/rooms/CardRoom.ts, server/src/rooms/schema/GameState.ts, server/src/__tests__/CardRoom.test.ts, server/src/__tests__/integration/CardRoom.integration.test.ts | 总测试: 319/319
- [x] TASK-022 [server] SettleService V2：零和倍数公式 + 场次底分 + 个人加倍 | 完成: server-dev | 测试: ✓ 35/35 AC（含两个计划书示例零和验证）| 产物: server/src/services/SettleService.ts, server/src/__tests__/SettleService.test.ts, infra/mysql/init.sql（新增 table_type/landlord_double/double_value 列）| 总测试: 333/333
- [x] TASK-027 [client] 加倍阶段 UI：DoublingView + GameController DOUBLING 状态 + NetManager.setDouble | 完成: client-dev | 测试: ✓ 161/161 | 产物: client/assets/scripts/ui/DoublingView.ts, client/assets/scripts/game/GameController.ts（DOUBLING 状态 + 3个新消息处理器）, client/assets/scripts/net/NetManager.ts（setDouble + 3条消息路由）
- [x] TASK-028 [client] SettlementView V2：倍率明细区 + 个人加倍展示 + V1 降级兼容 | 完成: client-dev | 测试: ✓ 193/193 | 产物: client/assets/scripts/ui/SettlementView.ts（BreakdownV2 + 8个新方法 + showResult）
- [x] TASK-024 [server] 数值模拟校准：10万局 Gate 通过 | 完成: server-dev | 测试: ✓ passGate=true | 结果: 整体 44.79% ✓ (Gate 42%–55%)，2v3 45.62%，1v4 28.02%，均值 M=×28.13 | 产物: server/tools/simulate.ts, server/tools/calibration-report.json, specs/simulation-calibration.md（Gate 从 45% 下调至 42%，PM 决策 2026-06-18）| 总测试: 333/333
- [x] BUG-B1~B5 [server] 自检缺陷修复 | 完成: server-dev | 测试: ✓ 333/333 零 SDK warn | 产物: server/src/rooms/CardRoom.ts（request_hint+SettleService接入+onDispose+炸弹/春天跟踪），server/src/__tests__/integration/CardRoom.integration.test.ts（landlord_doubled/doubling_result/bottom_cards 监听补全）
- [x] TASK-029s [server] 快速匹配 AI 补位：可配置等待超时 + AI 注入 + `waiting_update` 广播 | 完成: server-dev | 测试: ✓ 7/7 AC | 产物: server/src/rooms/CardRoom.ts（aiFillEnabled+fillWithAI+startAiFillCountdown+broadcastWaitingUpdate），server/src/rooms/schema/Player.ts（isAI），server/src/__tests__/CardRoom.029s.test.ts | 总测试: 356/356
- [x] TASK-030s [server] 好友房服务端：`room_update` 广播 + `force_start` + `ownerSessionId` | 完成: server-dev | 测试: ✓ 8/8 AC | 产物: server/src/rooms/CardRoom.ts（isFriendRoom+broadcastRoomUpdate+handleForceStart），server/src/rooms/schema/GameState.ts（ownerSessionId），server/src/__tests__/CardRoom.030s.test.ts | 总测试: 356/356
- [x] TASK-031s [server] 再来一局服务端：rematch 窗口期 + 好友房重开 + 快速匹配重排队 | 完成: server-dev | 测试: ✓ 8/8 AC | 产物: server/src/rooms/CardRoom.ts（startRematchWindow+handleRequestRematch+doRematch+resetForRematch），server/src/__tests__/CardRoom.031s.test.ts | 总测试: 356/356
- [x] TASK-029c [client] 快速匹配等待界面：倒计时 + AI 补位提示 + MatchView 扩展 | 完成: client-dev | 测试: ✓ 225/225 | 产物: MatchView.ts（onWaitingUpdate+onGameStarted）, NetManager.ts（waiting_update路由）
- [x] TASK-030c [client] 好友房客户端：等待室人员列表 + 开始按钮 + 平台分享 | 完成: client-dev | 测试: ✓ 225/225 | 产物: MatchView.ts（onRoomUpdate+onForceStartClick+onShareClick+error 2003）, NetManager.ts（room_update路由+forceStart）
- [x] TASK-031c [client] 再来一局客户端：SettlementView「再来一局」+ 状态处理 | 完成: client-dev | 测试: ✓ 225/225 | 产物: SettlementView.ts（onRematchUpdate+onRematchStart+onRematchRedirect+超时处理）, GameController.ts（REMATCH_*路由）, NetManager.ts（rematch_*路由+requestRematch+leaveRoom）
- [x] TASK-032s [server] 集成冒烟准备：修 BUG-001/002/003/004 + 启动环境验证 | 完成: server-dev | 测试: ✓ 356/356 零警告 | 产物: server/src/db/connection.ts（charset utf8mb4，BUG-001），server/jest.config.js（transform写法+maxWorkers:1，BUG-002/003），server/src/__tests__/integration/CardRoom.integration.test.ts（httpServer提升+closeAllConnections），server/src/index.ts（PORT默认2567），server/src/rooms/CardRoom.ts（AI_FILL_DELAY env），server/.env.test.example（AC-5），server/src/__tests__/CardRoom.test.ts+CardRoom.031s.test.ts（jest.mock SettleService，BUG-004）
- [x] TASK-032c [client] 全流程集成冒烟测试：Node.js 直连真实 Colyseus，走完 join→deal→landlord→doubling→play→settle→rematch | 完成: client-dev | 测试: ✓ 9/9 AC（服务端不可达时自动跳过）| 产物: client/tests/__tests__/GameFlow.integration.test.ts, jest.config.js（testPathIgnorePatterns 排除 .integration.test.ts）| 运行：npm test -- --testPathPattern=integration --forceExit
