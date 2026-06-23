# Integration Issues

> TASK-032c 冒烟测试期间，client-dev 遇到任何问题写这里。
> PM 每日查看，决策处理方式（修 bug / 改 spec / 更新协议）。

## 格式

```
- [ ] ISSUE-{id} [{严重度}] {一句话描述}
  - 复现步骤: {AC-? 阶段，做了什么}
  - 期望行为: {按 PROTOCOL.md 应该发生什么}
  - 实际行为: {实际发生了什么，附错误信息}
  - 报告人: client-dev | 日期: {日期}
```

严重度：🔴 阻塞（测试无法继续）/ 🟡 异常（行为不符合协议）/ 🟢 疑问（需要 PM 澄清）

---

## 待处理

- [ ] ISSUE-001 [🟡] CardRoom: `realPlayerCount` 在 settlement 阶段玩家离线时不递减，导致再来一局票数永远无法达标
  - 复现步骤: 5人正常结束一局游戏，进入 settlement 阶段后任意1名真实玩家断线，其余4人全部发送 `request_rematch`
  - 期望行为: 按在线人数计算阈值，4/4 应触发 `doRematch`
  - 实际行为: `total = this.realPlayerCount = 5`（未递减），`rematchAgreed.size(4) < 5`，再来一局永远不触发；30s 窗口期到期后房间强制 `disconnect`
  - 根因: `onLeave`（CardRoom.ts:144）仅在 `phase === "waiting"` 时才递减 `realPlayerCount`，其他阶段跳过
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-002 [🟢] CardRoom: `checkDoublingComplete`（line 396）和 `advanceTurn`（line 451）硬编码 `5`，未引用 `seatMap.length`
  - 复现步骤: 当前 5 人固定局不触发（`maxClients=5` + `fillWithAI` 保证始终 5 人）
  - 期望行为: 当前实现正确；若未来扩展非5人局则需修改
  - 实际行为: 无现网 bug，纯维护风险
  - 根因: 魔法数字 `5` 与 `this.seatMap.length` 语义等价但未引用后者
  - 验证结论: PLAUSIBLE（未来扩展风险），当前逻辑正确，降级为 🟢
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-003 [🟢] 注释规范违反（CLAUDE.md server 规定）：`src/index.ts` 和 `src/routes/authRoutes.ts` 缺少 `@file` / `@description` / `@module` 文件头 JSDoc
  - 复现步骤: 查看 src/index.ts:1、src/routes/authRoutes.ts:1，均以 `import` 开头无文件头注释
  - 期望行为: server/CLAUDE.md 规定"每个 .ts 文件必须有文件头，缺注释 = 未完成"
  - 实际行为: 两个文件均无 `@file @description @module` 三行 JSDoc
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-004 [🟢] `executeManagedAction`（CardRoom.ts:503）与 `executeAIAction`（CardRoom.ts:720）存在重复逻辑：`isNewRound` 判断 + 最低单牌托底出牌，维护成本双倍
  - 复现步骤: 代码阅读即可发现；修改其一逻辑时另一处易遗漏
  - 期望行为: 提取公共 `playFallback(sessionId)` 函数
  - 实际行为: 两处独立实现，任一修改不同步则行为分叉
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-005 [🔴] `handlePass`（CardRoom.ts:300）未校验是否为自由出牌轮，客户端可在 `lastPlay` 为空时发送 `pass` 跳过出牌义务
  - 复现步骤: playing 阶段，当 `state.lastPlay.length === 0`（或 `lastPlayerId === client.sessionId`）时，轮到该玩家，发送 `pass` 消息
  - 期望行为: 服务端拒绝并返回 error { code: 1002 }；自由出牌轮不可 pass
  - 实际行为: `handlePass` 只检查 phase 和 seatIndex，无自由轮判断；pass 被接受，`passCount++`，连续4次后错误清空 `lastPlay`，游戏状态被破坏
  - 根因: CardRoom.ts:300 缺少 `if (this.state.lastPlay.length === 0 || this.state.lastPlayerId === client.sessionId) return;` 守卫
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-006 [🔴] `landlord_select` 阶段无超时兜底：地主断线后游戏永久挂起
  - 复现步骤: 5人到齐发牌，进入 `landlord_select` 阶段后地主断线，`allowReconnection(60)` 超时失败
  - 期望行为: 超时后自动为地主选默认暗号牌（如 suit:0, value:0），游戏继续
  - 实际行为: `onLeave` catch 块只调用 `managed.add(sessionId)`；`managed` 仅在 `handleTimeout` 中被消费，而 `landlord_select` 阶段无 `turnTimer`；60s 后游戏无任何触发机制，永久卡死
  - 根因: `handleSelectCode`（CardRoom.ts:209）未设置超时定时器；`landlord_select` 阶段缺少断线处理路径
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-007 [🟡] `handleReconnectSync`（CardRoom.ts:320）不处理 `landlord_select` 阶段：地主重连后无法得知需选暗号牌
  - 复现步骤: 地主在 `landlord_select` 阶段短暂断线后重连（60s 内），服务端调用 `handleReconnectSync`
  - 期望行为: 应补发 `your_hand` + `landlord_select_start`（含底牌信息），让客户端重新展示暗号牌选择弹窗
  - 实际行为: `handleReconnectSync` 只处理 `doubling` 和 `playing` 两种阶段；地主仅收到 `your_hand`，客户端不知当前需要操作，UI 无响应
  - 根因: CardRoom.ts:323-334 的 `if-else if` 链缺少 `phase === "landlord_select"` 分支
  - 报告人: server-dev code-review | 日期: 2026-06-23

- [ ] ISSUE-008 [🟢] `SettleService.settle` 注释（line 157）与实际行为相悖：注释称"事务失败后 CardRoom 不广播 game_over"，但 game_over 在 settle 调用前已广播
  - 复现步骤: 阅读 CardRoom.ts:578-584：先 `broadcast("game_over", ...)` 再 `SettleService.settle(...).catch(...)`
  - 期望行为: 注释应准确描述实际契约："settle 异步执行，失败仅打日志，不影响 game_over 投递"
  - 实际行为: 注释声明的"失败→不广播"契约与代码实现完全相反，误导后续开发者
  - 根因: TASK-022 实现时将 settle 改为 fire-and-forget，但 SettleService.ts:157 的 AC-22 注释未同步更新
  - 报告人: server-dev code-review | 日期: 2026-06-23

---

## Client 端 Issues (code-review high, 2026-06-23)

> 범위: `client/assets/scripts/` TASK-033 diff  
> 중점: ①프로토콜 정렬 ②상태기계 ③씬 전환 메모리 누수  
> 자체 수정 금지 — PM 결정 대기

- [ ] ISSUE-C001 [🔴] `GameSceneManager.onLoad()` 에서 `gameController.setConnected()` 미호출 → `mySeatIndex=-1` → 게임 조작 전체 불가
  - 복현 단계: 5인 입장 후 게임 시작 → 지주 선택 단계에서 지주 본인에게 암호 카드 선택 UI 미표시 → 출패 단계에서 본인 차례에 버튼 비활성 → 출패/패스 버튼 클릭 무반응
  - 기대 동작: `onLoad` 내 `joinRoom` 완료 콜백에서 `gameController.setConnected(room.sessionId, mySeatIndex)` 호출해야 함
  - 실제 동작: `GameSceneManager.ts:65-81` → `setConnected()` 호출 없음 → `mySeatIndex` 초기값 `-1` 유지 → `currentSeat === mySeatIndex` 항상 false
  - 보고자: client-dev code-review | 날짜: 2026-06-23

- [ ] ISSUE-C002 [🟡] `GameSceneManager.onLoad()` 가 singleton `netManager.init()` 재호출 → 인증 토큰 없는 새 Client 생성, WebSocket 재연결 시 인증 실패
  - 복현 단계: HallScene에서 로그인 후 방 입장 → GameScene 로드 → 네트워크 순단 후 Colyseus SDK 재연결 시도
  - 기대 동작: `init()` 는 앱 시작 시 한 번만 호출 / 또는 GameScene은 이미 설정된 client를 재사용
  - 실제 동작: `GameSceneManager.ts:66` `this._net.init(API_ENDPOINT)` → `netManager.client = new Client(...)` (토큰 없음) → 재연결 시 `onAuth` 실패(JWT 미첨부) → 플레이어 강제 퇴장
  - 보고자: client-dev code-review | 날짜: 2026-06-23

- [ ] ISSUE-C003 [🟡] `onStateChange` switch에 `'doubling'` case 누락 → 가중 단계 중 재연결 시 doublingView 미표시
  - 복현 단계: 가중 단계(phase='doubling') 중 플레이어 순단 후 재연결 → 서버 `STATE { phase:'doubling' }` 전송
  - 기대 동작: doublingView 표시 및 가중 선택 UI 활성화
  - 실제 동작: `GameController.ts:99` switch에 `'doubling'` case 없음 → 클라이언트 상태 LANDLORD_SELECT 유지, doublingView 미표시 → 타임아웃 후 강제 기본값 처리
  - 보고자: client-dev code-review | 날짜: 2026-06-23

- [ ] ISSUE-C004 [🟡] `onStateChange` switch에 `'waiting'` case 누락 → 재매치 후 결산 UI 잔류
  - 복현 단계: 재매치 동의 후 서버 room 상태 리셋 → `STATE { phase:'waiting' }` 브로드캐스트
  - 기대 동작: settlementView hide, 대기 UI 전환
  - 실제 동작: `GameController.ts:99` switch에 `'waiting'` case 없음 → settlementView 계속 표시 → 이후 `'dealing'` 도착 시 결산 UI와 발패 애니메이션 동시 렌더링
  - 보고자: client-dev code-review | 날짜: 2026-06-23

- [ ] ISSUE-C005 [🟡] `showLastPlay` 가 `STATE` 매 delta마다 중복 호출 (출패 시만이 아님) + `lastPlay=[]` 시 `clear()` 미호출로 이전 출패 UI 잔류
  - 복현 단계: ①첫 출패 후 다음 차례 turn_change delta 도착 / ②3인 pass 후 새 라운드 시작(`lastPlay=[]`)
  - 기대 동작: ①새로운 `lastPlay` 변경 시에만 showLastPlay 호출 ②라운드 리셋 시 PlayZone 클리어
  - 실제 동작: `GameController.ts:119` — `onStateChange` 는 매 schema delta에 호출, `state.lastPlay?.length > 0` 이면(첫 출패 후 항상 true) 매번 `showLastPlay` 재호출; `lastPlay=[]` 시 length=0으로 분기 스킵되나 clear()도 없음
  - 보고자: client-dev code-review | 날짜: 2026-06-23

- [ ] ISSUE-C006 [🟡] `setToken()` 에 `this.client === null` 가드 없음 → `init()` 전 호출 시 TypeError
  - 복현 단계: `netManager.setToken(token)` 을 `netManager.init()` 이전에 호출
  - 기대 동작: 조용히 무시하거나 큐에 보관
  - 실제 동작: `NetManager.ts:35` `this.client.auth.token = token` → client가 null이면 `TypeError: Cannot set properties of null (setting 'token')`
  - 보고자: client-dev code-review | 날짜: 2026-06-23

- [ ] ISSUE-C007 [🟡] Quick Match 버튼 이중 탭 방어 없음 → `joinRoom` 두 번 동시 호출, 첫 번째 방 서버에 고아로 남음
  - 복현 단계: 빠른 이중 탭으로 Quick Match / Create Room 버튼 연속 클릭
  - 기대 동작: 첫 번째 joinRoom 진행 중에는 버튼 비활성(로딩 상태)
  - 실제 동작: `HallSceneManager.ts` 이중 호출 방어 없음 → 두 개의 `joinOrCreate` 병렬 실행 → `netManager.room` 나중에 완료된 것으로 덮어씀 → 첫 번째 방은 `leaveRoom()` 없이 서버에 잔류
  - 보고자: client-dev code-review | 날짜: 2026-06-23

- [ ] ISSUE-C008 [🟢] `ClientGameState.IN_LOBBY` 선언됐으나 어디서도 전환되지 않는 dead state
  - 파일: `GameController.ts:14`
  - 보고자: client-dev code-review | 날짜: 2026-06-23

- [ ] ISSUE-C009 [🟢] `API_ENDPOINT = 'ws://localhost:2567'` 가 `HallSceneManager.ts:18` 과 `GameSceneManager.ts:22` 에 중복 선언 — 프로덕션 배포 시 한 곳만 수정하면 불일치 발생
  - 보고자: client-dev code-review | 날짜: 2026-06-23

---

## 已处理

- [x] ISSUE-001 [🟡] realPlayerCount 全阶段递减 | 处理: TASK-034 CardRoom.ts onLeave 移出 waiting 守卫 | 测试: AC-8/9/10 ✓ | 2026-06-23
- [x] ISSUE-005 [🔴] handlePass 自由轮守卫 | 处理: TASK-034 CardRoom.ts handlePass isNewRound guard | 测试: AC-1/2/3 ✓ | 2026-06-23
- [x] ISSUE-006 [🔴] landlord_select 无超时兜底 | 处理: TASK-034 CardRoom.ts landlordSelectTimer + env LANDLORD_SELECT_TIMEOUT | 测试: AC-4/5/6/7 ✓ | 2026-06-23
- [x] ISSUE-007 [🟡] handleReconnectSync 缺 landlord_select 分支 | 处理: TASK-034 CardRoom.ts 补 landlord_select 分支 + bottomCards 存储 | 测试: AC-11/12/13 ✓ | 2026-06-23
