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
- [x] TASK-012 [client] 实现 HandCardView.ts + PlayZone.ts：手牌选择 + 出牌区 | 完成: client-dev | 测试: ✓ 23/23 AC | 产物: client/assets/scripts/ui/HandCardView.ts, client/assets/scripts/ui/PlayZone.ts | 注: 测试文件修正 AC-11 card 编码错误（3♥=13，非1）
