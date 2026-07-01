# Integration Issues

> PM 每日查看，决策处理方式（修 bug / 改 spec / 更新协议）。

## 格式

```
- [ ] ISSUE-{id} [{严重度}] {一句话描述}
  - 复现步骤: ...
  - 期望行为: ...
  - 实际行为: ...
  - 报告人: | 日期:
```

严重度：🔴 阻塞（测试无法继续）/ 🟡 异常（行为不符合协议）/ 🟢 疑问（需要 PM 澄清）

---

## 待处理

- [ ] ISSUE-C008 [🟡] 阶段推进未等客户端 ACK：dealing→landlord_select 发牌动画被截断
  - **根因**: 服务端 `startDealing()` 发完 `your_hand` 后立即同步推进 `phase='landlord_select'`，客户端发牌动画（预计 1~2s）尚未播完即被强制切换
  - **复现步骤**: 快速匹配进入游戏，观察发牌动画是否被截断；或 AI_FILL_DELAY=0 时客户端甚至在 GameScene 加载完成前服务端就已进入 landlord_select
  - **期望行为**: 服务端等所有5名玩家各自发送 `dealing_ready` 消息后，再推进至 `landlord_select`；设超时兜底防止客户端崩溃卡全局
  - **实际行为**: `phase` 在同一 server tick 内从 `dealing` 跳至 `landlord_select`，客户端动画无法正常播放
  - **PM 决策（2026-06-30）**: 🟡 打包进 TASK-050s/TASK-050c。① 超时兜底 **10s**；② 超时策略：**静默跳过**（发牌阶段非关键互动，网络抖动不应打扰其他玩家，静默推进体验更优）。PROTOCOL.md 新增 `dealing_ready` C→S 消息定义。
  - **任务拆分**: server-dev（CardRoom 等待5个 `dealing_ready` ACK + 10s 超时静默跳过，TASK-050s） + client-dev（发牌动画结束后发 `dealing_ready`，TASK-050c）
  - 报告人: client-dev 联调 | 日期: 2026-06-30

- [ ] ISSUE-C009 [🟡] 阶段推进未等客户端动画：landlord_select→doubling 暗号牌揭晓动画被截断
  - **根因**: 服务端收到地主 `select_code_card` 后立即推进 `phase='doubling'`，其余4名玩家的暗号牌揭晓动画（预计 3~5s）被截断
  - **复现步骤**: 进入游戏，地主选完暗号牌后观察其他玩家是否有时间看到揭晓动画
  - **期望行为**: 服务端收到 `select_code_card` 后，先广播 `code_card_reveal`，等待固定 N 秒（GDD 决定）再推进 `doubling`；无需客户端 ACK，服务端定时器控制
  - **实际行为**: 地主选完即切相位，非地主玩家无时间观看揭晓动效
  - **PM 决策（2026-06-30）**: 🟡 打包进 TASK-050s/TASK-050c。① N = **4s**（3-5s 居中，足够玩家看清暗号牌花色/点数）；② `code_card_reveal` 是**新增消息**（PROTOCOL.md 未定义），需 server-dev 在 TASK-050s 中新增广播 + 同步更新 PROTOCOL.md，client-dev 在 TASK-050c 中新增 handler。payload：`{ suit, value, landlordSeatIndex }`。
  - **任务拆分**: server-dev（`select_code_card` 后广播 `code_card_reveal` + 4s 定时器再推进 `doubling`，TASK-050s） + client-dev（`code_card_reveal` handler + 揭晓动画 4s，TASK-050c）
  - 报告人: client-dev 联调 | 日期: 2026-06-30

- [ ] ISSUE-C010 [🟡] 阶段推进未等客户端动画：doubling_result→playing 加倍结果展示被截断
  - **根因**: 服务端所有玩家 `set_double` 提交完毕后立即广播 `doubling_result` 并推进 `phase='playing'`，客户端加倍结果展示动画（预计 2~3s）被截断
  - **复现步骤**: 进入加倍阶段，全员提交后观察结果是否有足够展示时间再切出牌阶段
  - **期望行为**: 服务端广播 `doubling_result` 后等待固定 M 秒（GDD 决定）再推进 `playing`；无需 ACK
  - **实际行为**: `doubling_result` 与 `turn_change` 几乎同帧到达，玩家来不及看结果
  - **PM 决策（2026-06-30）**: 🟡 打包进 TASK-050s/TASK-050c。① M = **2s**（2s 足够展示结果，避免拖慢节奏；动效时长紧凑比宽松体验更好）。server-dev 在 `checkDoublingComplete` 里广播后加 2s 定时器再推进，client-dev 动画时长对齐 2s。
  - **任务拆分**: server-dev（`doubling_result` 后 2s 定时器再推进 `playing`，TASK-050s） + client-dev（结果动画时长对齐 2s，TASK-050c）
  - 报告人: client-dev 联调 | 日期: 2026-06-30

- [ ] ISSUE-S007 [🔴] GameFlow 完成后 Colyseus matchmaking 返回 503，后续所有 `create('game',...)` 立即失败，ProtocolCoverage AC-5~27 全部 skip
  - **PM 决策（2026-06-24）**: 🔴 根因：realPlayerCount=0 后 AI fake clients 未从 this.clients 移除，Colyseus 视旧房间仍存活，新 create() 被拒 503。分配 server-dev TASK-040：onLeave 里 realPlayerCount=0 时清除所有 aiSessionIds fake client 并调用 disconnect()。client-dev 临时绕过：非出牌 AC（7~14、16~24）可先推进，每 suite 间加 3s delay。
  - 复现步骤: ① `npm test -- --testPathPattern=GameFlow.integration --forceExit`（9/9 通过，62s）→ ② 立即运行 `npm test -- --testPathPattern=ProtocolCoverage.integration --forceExit` → AC-5~27 全部 503 skip；或直接 Node 脚本 `client.create('game', { aiFillEnabled: true })` 在 GameFlow 完成后立即失败
  - 期望行为: 一局游戏完成并 `room.leave()` 后，服务端应立即能接受新的房间创建请求
  - 实际行为: `client.create('game',...)` 返回 `{ name: "ServerError", code: 503 }`；HTTP auth（`/auth/login`）正常；仅 Colyseus matchmaking endpoint 失败
  - 排查线索: ① GameFlow 结束后 AI fake client（4 个）是否仍挂在 Colyseus clients 列表中导致房间未释放；② rematch 窗口期（30s）是否与 dispose 逻辑冲突；③ TASK-039 改动后 `onCreate` / `onLeave` 是否有未捕获异常导致 matchmaking handler 崩溃；④ 服务端日志中 GameFlow leave 后是否有 `[ERROR]` 输出
  - 影响: TASK-036 ProtocolCoverage AC-5~27（28 个 WS 测试用例）全部无法验证
  - 报告人: client-dev 冒烟测试 | 日期: 2026-06-24

- [ ] ISSUE-S004 [🔴] server 对 hint 推荐的单张牌（card=58，♠7 deck-1）在自由轮返回 1001 "invalid play"，GameFlow 9/9 全失败
  - **PM 决策（2026-06-24）**: 🔴 server-dev 排查：① `PatternHelper.parse([58])` 单元测试确认是否返回 INVALID；② AIPlayer.decide 确认推荐的牌是否真实在手牌里。打包进 TASK-039。
  - 复现步骤: `AI_FILL_DELAY=0 AUTH_MODE=stub` 启动服务端 → 运行 `npm test -- --testPathPattern=GameFlow.integration --forceExit`
  - 错误现象: `turn_change(seat=0)` → `request_hint` → 收到 `hint.cards=[58]` → `play_cards { cards:[58] }` → server 返回 `error { code:1001, msg:"invalid play" }`
  - 期望行为: card 58（♠7，deck-1 非王牌，58%54=4 不触发 isJoker）应被 PatternHelper.parse() 识别为 SINGLE，validatePlay 返回 ok
  - 实际行为: server 返回 1001，客户端降级 pass → server 返回 1002（自由轮不可 pass）× 3 → fatal，9/9 全部失败
  - 排查线索: ① PatternHelper.parse([58]) 是否在某些 JIT 路径返回 INVALID；② 是否存在 race condition 导致 handlePlay 收到 cards=[] 或 cards=[非法值]；③ server 运行时日志 [PLAY] / [AI] 有无出现
  - 报告人: client-dev 冒烟测试 | 日期: 2026-06-24

- [ ] ISSUE-S005 [🟡] `turn_change` 协议缺 `isNewRound` 字段 — 客户端在 Schema delta（≤50ms）到达前无法判断是否自由轮，导致发送无效 pass
  - **PM 决策（2026-06-24）**: 采用协议补丁方案。server-dev 在 TASK-039 中：`turn_change` payload 加 `isNewRound: boolean` + 更新 PROTOCOL.md。client-dev 在 TASK-036 中：`turn_change` handler 用 `isNewRound` 控制 pass 状态，不等 Schema delta。
  - 复现步骤: 4 人全 pass → lastPlay 清空 → server 立即广播 `turn_change` → 客户端收到 `turn_change` 但 Schema delta 尚未到达 → 客户端仍见旧 lastPlay（非空）→ 误判为可 pass → 发送 pass → server 1002
  - 期望行为: 客户端收到 `turn_change` 时即可确定是否自由轮，不依赖 Schema delta 时序
  - 实际行为: `turn_change` 仅含 `{ seatIndex, deadline }`；`lastPlay` 清空通过 Schema delta 下发，最多晚到 50ms（`DEFAULT_PATCH_RATE=1000/20`）；窗口期内客户端状态不一致，可能连续发出 N 次无效 pass
  - 根因: Colyseus 的 `broadcast()` 与 `broadcastPatch()` 是两条独立通道，前者立即发送，后者定时发送；`startTurnTimer` 在 Schema 写入后立即调用 `broadcast("turn_change")`，导致协议消息先于 Schema delta 到达客户端
  - 修复方向: `turn_change` payload 新增 `isNewRound: this.state.lastPlay.length === 0`；客户端优先用此字段判断 pass 按钮状态，不等 Schema delta（需同步更新 PROTOCOL.md）
  - 报告人: server-dev 牌局日志分析 | 日期: 2026-06-24

- [ ] ISSUE-S006 [🟢] TASK-037 引入回归：`[PASS]` 日志在 isNewRound 守卫前打印，被拒绝的无效 pass 也会出现在日志中
  - **PM 决策（2026-06-24）**: 🟢 一行移动，打包进 TASK-039。
  - 复现步骤: 自由轮时客户端发送 `pass` → 日志打印 `[PASS]` → isNewRound 守卫返回 error 1002；日志显示 pass 被执行，实际被拒绝
  - 期望行为: `[PASS]` 只在 pass 真正通过守卫后打印（与 `[PLAY]` 对称）
  - 实际行为: `CardRoom.ts handlePass` 中 `console.log("[PASS]...")` 在 isNewRound check 之前，每次拒绝都产生误导性日志
  - 根因: TASK-037 实现时 log 位置放错，应在 `if (isNewRound) return` 之后
  - 修复方向: 将 `console.log("[PASS]...")` 移到 isNewRound 守卫之后、`battlePlays.push()` 之前（一行移动）
  - 报告人: server-dev 牌局日志分析 | 日期: 2026-06-24

- [ ] ISSUE-C011 [🟡] GameFlow test 错误恢复策略：error 1001 后盲目 pass，自由轮下级联触发 1002 fatal
  - **PM 决策（2026-06-24）**: 🟡 client-dev 在 TASK-036 期间处理。error 1001 后 `awaitingPlayResult=false`，不发 pass，等下一个 turn_change 重新驱动 hint 流程。
  - 文件: `client/tests/__tests__/GameFlow.integration.test.ts:265`
  - 复现步骤: server 对某次出牌返回 1001 → test error handler 执行 `room.send('pass')` → server 返回 1002（自由轮不可 pass）→ error handler 再 pass → 连续 >3 次 → fatal
  - 期望行为: error 1001 后应等待下一个 turn_change 重新请求 hint，而非立即 pass
  - 实际行为: 直接 pass，若为自由轮则必然 1002 级联
  - 修复方向: error handler 收到 1001 后将 `awaitingPlayResult=false`、`recoverableErrorCount++`，**不发 pass**；等下一个 turn_change 重新驱动 hint 流程
  - 报告人: client-dev 冒烟测试 | 日期: 2026-06-24

- [ ] ISSUE-009 [🔴] CardRoom: rematch 窗口期到期 `disconnect()` 崩溃 — 客户端已离线时 `_forciblyCloseClient` 访问 `undefined.removeAllListeners()`
  - 复现步骤: 5人打完一局到 `[FINISH]`，客户端调用 `.leave()` 离开，30s 后 `startRematchWindow` 定时器触发 `this.disconnect()`
  - 期望行为: `disconnect()` 正常执行，房间销毁，无异常
  - 实际行为: `CardRoom.ts:870` → `_forciblyCloseClient()` → `TypeError: Cannot read properties of undefined (reading 'removeAllListeners')`；触发两次（每个已离线客户端各一次）
  - 根因: 客户端 `.leave()` 后 WebSocket 连接对象销毁，`_forciblyCloseClient` 未判断连接是否存活；`startRematchWindow` 未在 `onLeave` 时检查在线人数
  - 修复方向: `onLeave` 中判断在线人数为 0 时提前 `clearTimeout(rematchWindow)`；或 `disconnect()` 前 guard `client.readyState`
  - 报告人: server-dev 牌局日志分析 | 日期: 2026-06-24
  - **PM 决策（2026-06-24）**: 🔴 优先修，影响 TASK-036 AC-10/11（rematch 重连测试）。分配给 server-dev，TASK-037 批次二一并处理。

- [ ] ISSUE-010 [🟡] `handlePass` 无日志 — pass 行为在服务端日志不可见
  - 实际行为: `[TURN] seat=0` 后直接出现 `[TURN] seat=1`，无法判断是 pass 还是静默异常
  - 修复方向: `handlePass` 首行加 `console.log('[PASS] sid=%s seat=%d', client.sessionId, this.state.currentTurnSeat)`
  - 报告人: server-dev 牌局日志分析 | 日期: 2026-06-24
  - **PM 决策（2026-06-24）**: 🟡 一行修复，打包进 TASK-037。

- [ ] ISSUE-003 [🟢] `src/index.ts` 和 `src/routes/authRoutes.ts` 缺少文件头 JSDoc（`@file @description @module`）
  - 报告人: server-dev code-review | 日期: 2026-06-23
  - **PM 决策（2026-06-24）**: 🟢 打包进 TASK-037。


- [ ] ISSUE-002 [🟢] CardRoom `checkDoublingComplete` / `advanceTurn` 硬编码魔法数字 `5`，未引用 `seatMap.length`
  - 验证结论: 当前逻辑正确，纯维护风险
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-004 [🟢] `executeManagedAction` 与 `executeAIAction` 存在重复逻辑，维护成本双倍
  - 修复方向: 提取公共 `playFallback(sessionId)` 函数
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-C008 [🟢] `ClientGameState.IN_LOBBY` 声明后从未转换，dead state
  - 文件: `GameController.ts:14`
  - 报告人: client-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-C009 [🟢] `API_ENDPOINT` 在 `HallSceneManager.ts:18` 和 `GameSceneManager.ts:22` 重复声明
  - 报告人: client-dev code-review | 日期: 2026-06-23

- [x] ISSUE-C013 [🔴] ProtocolCoverage AC-18/19/20/22 方案A实施后仍全部 null — handleTurn 内部哪条分支未执行待确认
  - **已解决（2026-06-25）**: 根因是 `makeMsgQueue.waitFor` 超时后未从 `pending` 移除旧 waiter。AC-24/AC-23 的 `waitFor('error', 1s)` 各自 timeout 但留下 stale waiter，后续真实 error 被消耗掉。修复：timeout 回调中先从 `pending` splice 移除自身再 reject。

- [ ] ISSUE-C014 [🔴] ProtocolCoverage AC-18 无法可靠触发 1003 — 服务端 AI 同步执行导致单客户端无窗口
  - 复现: `AC-18` 在 `handleTurn(seatIndex !== mySeat)` 分支发 `play_cards`，服务端已在同一 JS tick 同步执行完所有 AI 回合，`currentTurnSeat` 回到 0；消息到达时被当作 seat=0 的合法操作处理，返回非 1003 的错误或静默接受
  - 根因: `startTurnTimer` line 601-603 — AI `executeAIAction` 同步调用，无 setTimeout；5 条 `turn_change` 消息在同一 tick 全部入发送缓冲区；客户端收到 seat=1 的 turn_change 时服务端 `currentTurnSeat` 已经是 0
  - 已排除方案: 
    - 双发合法牌（方案A）：第二发到达时 turn 已回到 seat=0，得到 1004 不是 1003
    - 非我方回合直接发：同上，服务端已同步完成
  - 当前结果: `ec.ac18_error=null`（waitFor 3s 超时），AC-18 持续失败
  - 需要 PM 决策（三选一）:
    - **A**: `AI_FILL_DELAY=0` 改为 `AI_FILL_DELAY=1`（1ms setTimeout），给客户端一个窗口 — 改 server 启动脚本，不改逻辑
    - **B**: 双客户端 — beforeAll 里建第二个连接，在第一个客户端回合时由第二个发 `play_cards` → 100% 1003；复杂度高
    - **C**: AC-18 改为「条件性」— 能捕到 1003 则断言，捕不到则 warn+skip（与 AC-21 同级处理）
  - 报告人: client-dev | 日期: 2026-06-25

- [ ] ISSUE-C013 [🔴] ProtocolCoverage AC-18/19/20/22 方案A实施后仍全部 null — handleTurn 内部哪条分支未执行待确认
  - 复现: 方案A已实施（等我方回合→合法出牌→立刻再发→waitFor error 1003），`npm test -- --testPathPattern=ProtocolCoverage.integration --forceExit` → AC-18/19/20/22 仍 undefined
  - 期望: AC-18: 1003 / AC-19: 1004 / AC-20: 1001 / AC-22: 1002
  - 实际: 四者均 null（waitFor 3_000ms 超时）
  - 已排除: 原竞态问题（handleTurn 现在顶部 guard `if (msg.seatIndex !== mySeat) return`，只在自己回合执行）
  - 三个候选根因（无 debug 输出，无法确认哪个）：
    - A: **hint18 为空**——AC-18 的 `if (cards18.length > 0)` 分支从未进入；hint18 可能在某种局面下返回 `cards:[]`，导致 test player 既不出牌也不 pass，整轮静默超时；需确认 `request_hint` 在自由轮 / 跟牌局面下是否可能返回空
    - B: **isNewRound 字段缺失**——服务端运行实例未包含 TASK-039 的 turn_change 补丁，msg.isNewRound 始终 undefined → isNewRound=false，AC-22/AC-20（依赖 isNewRound=true）永远跳过；AC-18/19 不依赖此字段，若仍 null 说明同时存在 A 或 C
    - C: **mySeat 解析错误**——waitForSeat 返回错误值，guard 过滤掉所有 turn_change，handleTurn 主体从未执行；需确认 `players.get(room.sessionId)` 在 Colyseus 0.15 MapSchema 中的行为
  - 需要 PM/server-dev 确认:
    1. 当前运行的服务端是否包含 TASK-039 的 `isNewRound` 补丁？（验证：服务端日志中 turn_change broadcast 是否带 isNewRound 字段）
    2. `request_hint` 在跟牌局面（lastPlay 非空）且我方无法压过时，返回 `cards:[]` 还是仍然返回一个 fallback card？
    3. 是否允许 client-dev 加一行 `console.log` debug 日志（带 mySeat 和 msg.seatIndex）确认 guard 行为，跑一次后立删？
  - 报告人: client-dev | 日期: 2026-06-25

- [ ] ISSUE-C012 [🔴] ProtocolCoverage AC-18/19/20/22 全部 null — 错误码测试竞态导致错误未被捕获
  - 复现: `npm test -- --testPathPattern=ProtocolCoverage.integration --forceExit` → AC-18/19/20/22 failed, received: undefined
  - 根因（已确认）: 服务端把 4 个 AI 席位的出牌在同一 JS tick 同步完成，5 条 `turn_change` 消息作为一批到达客户端。`handleTurn` 对每条 turn_change 异步并发执行。发给 AC-18 测试的 `play_cards({ cards:[0] })` 消息到达服务端时，`currentTurnSeat` 已经是人类玩家席位，服务端把它当作"自己的回合"处理（卡合法则成功出牌，卡不在手牌则返回 1004），**不返回期望的 1003**。后续 AC-19/20/22 依赖"此时仍是自己回合且 lastPlay 为空"的假设，被上述意外出牌打乱，错误同样捕获失败。
  - 期望: `ec.ac18_error.code === 1003`、`ec.ac19_error.code === 1004`、`ec.ac20_error.code === 1001`、`ec.ac22_error.code === 1002`
  - 实际: 四者均为 null（`q.waitFor('error', 2_500)` 全部超时）
  - 修复方向（需 PM 确认）：
    - A: **出牌后立刻再发一次**——测试玩家合法出牌后立即发 `play_cards`，此时回合已推进给 AI，服务端必然返回 1003。AC-18 用这个时机测试，不再依赖"对方回合"的消息窗口。
    - B: **双客户端**——引入第二个人类客户端，在第一个客户端回合时由第二个发 `play_cards`，100% 触发 1003；复杂度较高。
    - C: **推迟 AC-18 到已知非我方回合**——在 AC-15~24 beforeAll 中，先让游戏跑完第一轮（`game_over` 或达到某个 turn 数）再测试错误码；改动量大。
    - 推荐方案 A：改动最小，时序可靠。
  - 影响: ProtocolCoverage AC-18/19/20/22 持续 FAIL，TASK-036 未完成
  - 报告人: client-dev | 日期: 2026-06-25

---

## 已处理

- [x] ISSUE-S004 [🔴] hint 返回单张Joker → 1001 | 根因: CardDecomposer.generateAll返回[], pickSmallestSingle([106])=[106]（单张王原规则非法）| 处理: TASK-039 shared/PatternHelper.ts 单张王→合法SINGLE | 测试: 395/395 + 9/9 | 2026-06-24
- [x] ISSUE-S005 [🟡] turn_change 缺 isNewRound 字段 | 处理: TASK-039 CardRoom.ts startTurnTimer加isNewRound + PROTOCOL.md更新 | 测试: 395/395 | 2026-06-24
- [x] ISSUE-S006 [🟢] [PASS] log 在守卫前打印 | 处理: TASK-039 CardRoom.ts handlePass log移至守卫后 | 测试: 395/395 | 2026-06-24

- [x] ISSUE-001 [🟡] realPlayerCount 全阶段递减 | 处理: TASK-034 CardRoom.ts onLeave 移出 waiting 守卫 | 测试: AC-8/9/10 ✓ | 2026-06-23
- [x] ISSUE-005 [🔴] handlePass 自由轮守卫 | 处理: TASK-034 CardRoom.ts handlePass isNewRound guard | 测试: AC-1/2/3 ✓ | 2026-06-23
- [x] ISSUE-006 [🔴] landlord_select 无超时兜底 | 处理: TASK-034 CardRoom.ts landlordSelectTimer + env LANDLORD_SELECT_TIMEOUT | 测试: AC-4/5/6/7 ✓ | 2026-06-23
- [x] ISSUE-007 [🟡] handleReconnectSync 缺 landlord_select 分支 | 处理: TASK-034 CardRoom.ts 补 landlord_select 分支 + bottomCards 存储 | 测试: AC-11/12/13 ✓ | 2026-06-23
- [x] ISSUE-008 [🟢] finishGame 注释与实现相悖 | 处理: CardRoom.ts finishGame JSDoc 更新，明确 fire-and-forget 契约 | server-dev | 2026-06-24
- [x] ISSUE-C001 [🔴] setConnected 未调用 → mySeatIndex=-1 | 处理: TASK-035 GameSceneManager.ts 加调用 | 测试: 256/256 ✓ | 2026-06-23
- [x] ISSUE-C002 [🟡] netManager.init() 重复调用 | 处理: TASK-035 避免重复 init | 测试: 256/256 ✓ | 2026-06-23
- [x] ISSUE-C003 [🟡] onStateChange 缺 doubling case | 处理: TASK-035 GameController.ts 补 doubling case | 测试: 256/256 ✓ | 2026-06-23
- [x] ISSUE-C004 [🟡] onStateChange 缺 waiting case | 处理: TASK-035 GameController.ts 补 waiting case | 测试: 256/256 ✓ | 2026-06-23
- [x] ISSUE-C005 [🟡] showLastPlay 重复调用 + clear() 未调用 | 处理: TASK-035 lastPlay 快照比较后复制 | 测试: 256/256 ✓ | 2026-06-23
- [x] ISSUE-C006 [🟡] setToken null 守卫缺失 | 处理: TASK-035 NetManager.ts 加 null 守卫 | 测试: 256/256 ✓ | 2026-06-23
- [x] ISSUE-C007 [🟡] Quick Match 双击防重入缺失 | 处理: TASK-035 MatchView.ts _withJoining helper | 测试: 256/256 ✓ | 2026-06-23
- [x] ISSUE-S001 [🔴] your_hand 10s 超时 | 根因: AI_FILL_DELAY 未设为 0 | 处理: 环境配置，无需改代码 | 2026-06-23
- [x] ISSUE-S002 [🔴] doubling_start 未到达 | 根因: client-dev 自行排查解决 | 2026-06-23
- [x] ISSUE-S003 [🔴] game_over 60s 内未到达 | 处理: TASK-032c-fix 升级出牌代理（seat-gated + request_hint 驱动）+ server enqueueRaw no-op 修复 | 验收: 冒烟 9/9 全通，32s 完成，[FINISH] 出现 | 2026-06-24
- [x] ISSUE-C010 [🟢] jest.config.js ts-jest globals 废弃警告 | 处理: globals→transform 写法迁移 | 产物: client/jest.config.js | 2026-06-24
- [x] ISSUE-009 [🔴] rematch 窗口期 disconnect() 崩溃 | 处理: CardRoom.ts onLeave 中 realPlayerCount=0 时提前 clear(rematchWindow) | 测试: 369/369 ✓ | 2026-06-24
- [x] ISSUE-010 [🟡] handlePass 无日志 | 处理: CardRoom.ts handlePass 加 [PASS] console.log | 测试: 369/369 ✓ | 2026-06-24
- [x] ISSUE-003 [🟢] index.ts / authRoutes.ts 缺文件头 JSDoc | 处理: 补 @file @description @module | 2026-06-24
