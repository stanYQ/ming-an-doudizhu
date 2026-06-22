# Spec: 全流程集成冒烟测试

**任务 ID**: TASK-032（server-dev 准备环境 + client-dev 写测试）  
**目标模块**: server + client（协作完成）  
**优先级**: P4.4 Demo 准备  
**状态**: ready  
**前置依赖**: P4.3 全部完成（TASK-029s/c, 030s/c, 031s/c 均 done）  
**权威来源**: docs/PROTOCOL.md（消息协议权威）

---

## 背景

P4.3 代码全绿（Server 356/356，Client 225/225），但 server 与 client 从未在真实网络下跑过完整游戏流程。所有测试均为单侧单元测试或 @colyseus/testing mock 测试，协议层双向对接未经端到端验证。

此任务不依赖 Cocos 引擎，不测试 UI。目标是验证：
1. 双端协议消息格式匹配
2. 全游戏流程 state 双向同步正确
3. 结算数值 server 与 client 接收一致

---

## 验收标准

### server-dev — 环境准备

- AC-1: 修复 BUG-001：`server/src/db/connection.ts` 连接池加 `charset: 'utf8mb4'`，集成测试日志中 `cesu8` 警告消失
- AC-2: 修复 BUG-002：`server/jest.config.js` 迁移到 `transform` 写法，`globals ts-jest deprecated` 警告消失
- AC-3: 修复 BUG-003：CardRoom 测试 `afterEach` 清理计时器，无 `worker force exit` 警告
- AC-4: `AI_FILL_DELAY=0 npm run dev` 可正常启动，Colyseus 监听 `ws://localhost:2567`，无报错退出
- AC-5: 提供 `.env.test` 示例，含 `AI_FILL_DELAY=0`、`AUTH_MODE=stub`、测试用 MySQL/Redis 连接串

### client-dev — 集成冒烟测试

> 使用 Node.js + `colyseus.js` npm 包直连（不启动 Cocos 引擎，不依赖 CC 注入）。  
> 测试文件路径：`client/assets/scripts/__tests__/integration/GameFlow.integration.test.ts`

- AC-6: 1 个真实客户端加入快速匹配房间，`AI_FILL_DELAY=0` 触发 AI 立即补位，收到 `phase=dealing` 状态变更
- AC-7: 收到发牌消息，验证手牌总数为 21（1v4 地主 24 张，但客户端普通席位 21 张）；底牌 3 张在 `landlordCards` 字段
- AC-8: 走完叫地主流程（`bid` 消息 → 收到 `phase=landlord_select` → `phase=doubling`）
- AC-9: 走完加倍流程（`set_double` 消息 → 收到 `doubling_result` → `phase=playing`）
- AC-10: 出 3 张合法牌（`play_cards` 消息），收到 `phase=playing` 且 `currentPlayerIndex` 轮转
- AC-11: 游戏结束后收到 `game_over` 消息，验证：`scores` 数组长度=5，`multiplier ≥ 1`，`breakdown` 字段存在
- AC-12: 发送 `request_rematch`，收到 `rematch_redirect { action: "requeue" }`（快速匹配场景）
- AC-13: 全程无未捕获异常，无 WebSocket 非预期断开

---

## 实现约束

- client-dev 使用 `import { Client } from 'colyseus.js'`（npm 包），**不通过 CC IIFE bundle**
- server 必须提前由 server-dev 启动（非 mock）；client 测试直接连接真实进程
- MySQL / Redis 测试实例可用 Docker：`docker compose -f infra/docker-compose.yml up -d`
- 测试中涉及的出牌不需要是最优策略，只需是合法牌型（如出手牌中任意 3 张单张凑顺子，或直接出一张单牌）
- 测试超时设置为 30 秒（AI 响应 + 网络延迟）

## 不在范围内

- UI 渲染、Cocos 场景装配 —— P4.4 实机测试
- WeChat OAuth 真实登录 —— P4.4
- 多客户端并发压力测试 —— P4.5
- 好友房完整集成冒烟 —— 可在 TASK-032 通过后作为 TASK-033 追加

## 测试要求

- **server-dev**: AC-1–5，BUG 修复后跑 `npm test`，356/356 + 零警告
- **client-dev**: AC-6–13，8 条集成 AC，`npm test` 中集成测试标记 `@integration` 可单独执行  
  执行命令：`npm test -- --testPathPattern=integration`
