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
- AC-10: 进入 `playing` 后由测试代理按服务端协议持续行动，直到整局自然结束；每个本方回合必须先 `request_hint`，再根据 `hint.cards` 发送 `play_cards` 或 `pass`
- AC-11: 完整牌局结束后收到 `game_over` 消息，验证：`winnerCamp` 为 `"landlord_camp"` 或 `"civilian_camp"`，`scores` 为 Record 且包含本玩家 sessionId，`Object.keys(scores).length === 5`（`multiplier`/`breakdown` 不在广播中，仅写 DB，不验证）
- AC-12: 发送 `request_rematch`，收到 `rematch_redirect { action: "requeue" }`（快速匹配场景）
- AC-13: 全程无未捕获异常，无 WebSocket 非预期断开

---

## 实现约束

- client-dev 使用 `import { Client } from 'colyseus.js'`（npm 包），**不通过 CC IIFE bundle**
- server 必须提前由 server-dev 启动（非 mock）；client 测试直接连接真实进程
- MySQL / Redis 测试实例可用 Docker：`docker compose -f infra/docker-compose.yml up -d`
- 测试代理不能只验证 3 张牌；必须走完整牌局直到 `game_over`
- 测试代理不能在非本方回合发送 `play_cards`；必须用 `turn_change.seatIndex` 与本客户端座位匹配后再行动
- 本方回合优先使用服务端 `request_hint` 产出的 `hint.cards`，避免测试端重复实现牌型/压制逻辑
- `game_over` 等待超时可设为 60 秒作为保护上限；超时代表 ISSUE-S003 未解决，不能通过单纯拉长时间关闭

## 不在范围内

- UI 渲染、Cocos 场景装配 —— P4.4 实机测试
- WeChat OAuth 真实登录 —— P4.4
- 多客户端并发压力测试 —— P4.5
- 好友房完整集成冒烟 —— 可在 TASK-032 通过后作为 TASK-033 追加

## 测试要求

- **server-dev**: AC-1–5，BUG 修复后跑 `npm test`，356/356 + 零警告
- **client-dev**: AC-6–13，8 条集成 AC，`npm test` 中集成测试标记 `@integration` 可单独执行  
  执行命令：`npm test -- --testPathPattern=integration`

## ISSUE-S003 处理要求

`ISSUE-S003` 的阻塞点是测试代理没有按完整牌局目标推进：真实玩家客户端只尝试最小单张，失败后长期 pass，导致 60 秒内未自然结算。处理方式：

- 记录本客户端 `seatIndex`：从 `room.state.players` 中用当前 `sessionId` 找到座位；若 schema 初始化有竞态，等待 state 同步后再进入出牌代理
- `turn_change` 到达时，只有 `msg.seatIndex === mySeatIndex` 才行动；否则仅记录状态，不发送任何出牌消息
- 本方回合发送 `request_hint`
- 收到 `hint { cards }`：`cards.length > 0` 则发送 `play_cards { cards }`；否则发送 `pass`
- 收到 `error 1001/1002`：本回合降级为 `pass`，并记录错误计数；若连续错误超过 3 次，测试失败并输出最近 turn/hint/error
- 收到 `error 1003`：视为测试代理座位判断错误，测试失败，不吞掉继续跑
- 验收通过条件：`AI_FILL_DELAY=0` 下完整收到 `game_over` 与后续 `rematch_redirect` 或 `rematch_start`，且 server log 出现 `[FINISH]`
