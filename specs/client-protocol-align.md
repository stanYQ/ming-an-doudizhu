# Spec: Client ↔ PROTOCOL.md 对齐修复

**任务 ID**: TASK-033  
**目标模块**: client  
**优先级**: P4.4  
**状态**: ready  
**权威来源**: docs/PROTOCOL.md v2.0

---

## 执行流程（client-dev 必须按顺序走）

```
Step 1  认领任务
        → 更新 .tasks/in-progress.md（已由 PM 填写，确认即可）

Step 2  生成失败测试（RED）
        → /tdd-gen
        → 对照本 spec 19 条 AC 生成测试用例，确认全部失败后再写实现

Step 3  按 Gap 顺序实现（G7 是前置，必须最先改）
        G7 → G1 → G2 → G3 → G4 → G5 → G6
        每改完一个 Gap 立即跑 npm test，不要攒到最后

Step 4  覆盖率检查
        → /tdd-coverage
        → 确认 19 条 AC 全部有对应测试，无遗漏

Step 5  Diff 审查
        → /karpathy
        → 确认无过度实现、无未被要求的改动

Step 6  代码质量
        → /simplify
        → 如有冗余逻辑主动精简

Step 7  真实服务端验证
        → /verify
        → 启动 infra + server，跑 GameFlow.integration 冒烟测试
        → 确认 9/9 AC 全部通过（非 skip）

Step 8  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除 TASK-033
        → 格式：- [x] TASK-033 [client] ... | 完成: client-dev | 测试: ✓ | 产物: {改动文件列表}
```

---

## 背景

TASK-032c 集成冒烟通过后，对照 PROTOCOL.md v2.0 逐条审查客户端实现，发现 7 处协议对接偏差（G1–G7）。这些偏差在纯单元测试环境下不会暴露（因为 Colyseus room 是 mock），但在真实服务端联调时会导致：
- 登录 JWT 未传递 → 所有 WebSocket 连接被服务端拒绝（MatchMakeError 3001）
- 出牌结果永远不触发（监听了不存在的 `play_broadcast` 消息）
- 地主无法正确识别（Schema 字段名用错）
- 场景切换后房间连接丢失（NetManager 未共享）

---

## 验收标准

### G7 — NetManager 模块单例（其他 AC 的前提）

- AC-1: `NetManager.ts` 导出模块级单例 `export const netManager = new NetManager()`
- AC-2: `HallSceneManager` 和 `GameSceneManager` 均 `import { netManager }` 而非各自 `new NetManager()`
- AC-3: HallScene joinRoom 建立的房间连接，在 GameScene 加载后仍可通过 `netManager` 收发消息

### G1 — Auth token 注入（PROTOCOL.md §1）

- AC-4: `NetManager` 新增 `setToken(token: string): void`，实现为 `this.client.auth.token = token`
- AC-5: `HallSceneManager.onLoad()` 从 `sys.localStorage.getItem('ddz_token')` 读取 token，在调用 `joinRoom` 前调用 `netManager.setToken(token)`
- AC-6: token 为 null 时 `setToken` 静默忽略（不抛异常），不影响现有 stub 登录测试

### G2 — 移除 `play_broadcast`，改用 Schema delta（PROTOCOL.md §4/§7）

- AC-7: `NetManager._registerHandlers()` 移除 `r.onMessage('play_broadcast', ...)` 及对应 `PLAY` 事件派发
- AC-8: `GameController.onStateChange()` 新增对 `state.lastPlay` 和 `state.lastPlayerId` 的处理：当 `lastPlay` 非空时调用 `playZone?.showLastPlay(state.lastPlayerId, [...state.lastPlay])`
- AC-9: `GameController.onLoad()` / `onDestroy()` 移除 `PLAY` 事件的注册与注销

### G3 — 地主判断字段修正（PROTOCOL.md §7 Schema）

- AC-10: `GameController.onStateChange()` 中 `landlord_select` 分支，将 `state.landlordSessionId === this.mySessionId` 改为 `state.landlordSeat === this.mySeatIndex`

### G4 — `selectCodeCard` suit 类型 string → number（PROTOCOL.md §5）

- AC-11: `NetManager.selectCodeCard(suit: number, value: number)` 参数类型改为 `number`，发送 `{ suit, value }` 不做类型转换
- AC-12: `GameController.onCodeCardSelect(suit: number, value: number)` 参数类型同步改为 `number`
- AC-13: `GameSceneManager._buildCodeSelector()` 中 `onConfirm` 回调移除 `String(choice.suit)` 转换，直接传 `choice.suit`（已是 number）

### G5 — `bottom_cards` 路由（PROTOCOL.md §6）

- AC-14: `NetManager._registerHandlers()` 新增 `r.onMessage('bottom_cards', msg => message.dispatchEvent('BOTTOM_CARDS', msg))`
- AC-15: `GameController.onLoad()` 注册 `BOTTOM_CARDS` → `onBottomCards`；`onDestroy()` 同步注销
- AC-16: `GameController.onBottomCards(msg: { cards: number[] })` 调用 `handCardView?.showBottomCards?.(msg.cards)`（HandCardView 已有或新增此方法的空实现即可）

### G6 — `hint` 路由（PROTOCOL.md §6）

- AC-17: `NetManager._registerHandlers()` 新增 `r.onMessage('hint', msg => message.dispatchEvent('HINT', msg))`
- AC-18: `GameController.onLoad()` 注册 `HINT` → `onHint`；`onDestroy()` 同步注销
- AC-19: `GameController.onHint(msg: { cards: number[] })` 调用 `playZone?.showHint?.(msg.cards)`（PlayZone 已有或新增此方法的空实现即可）

---

## 接口变更

```typescript
// NetManager.ts — 新增 / 修改
export const netManager = new NetManager();          // 新增：模块单例

setToken(token: string): void                         // 新增
selectCodeCard(suit: number, value: number): void     // 修改：suit string → number

// GameController.ts — 修改
onCodeCardSelect(suit: number, value: number): void   // 修改：suit string → number
```

---

## 约束

- 只改 `client/` 目录下的文件
- 不改 `shared/` 任何文件
- 不新增第三方依赖
- 现有测试 225/225 全部保持通过（部分测试需同步更新 mock 调用参数类型）
- `HandCardView.showBottomCards` / `PlayZone.showHint` 如不存在，新增空实现即可，不要求完整 UI 实现（UI 渲染是后续任务）

---

## 不在范围内

- HandCardView 底牌展示 UI 渲染（仅接线，不要求视觉效果）
- PlayZone 出牌提示 UI 高亮（仅接线）
- 生产环境地址切换（保持 `ws://localhost:2567`）
- WeChat OAuth 真实登录流程

---

## 测试要求

- 所有 AC 对应单元测试更新或新增，测试总数 ≥ 225
- AC-1/2/3（单例）：在两个 SceneManager 测试中 mock 同一 `netManager` 实例，验证 room 引用共享
- AC-4/5/6（setToken）：验证 token 写入 `client.auth.token`；null 时不抛异常
- AC-7/8/9（play_broadcast 移除）：验证 `play_broadcast` 消息到达后 `showLastPlay` 不被调用；`onStateChange` 中 `lastPlay` 非空时 `showLastPlay` 被调用
- AC-10（landlordSeat）：`state.landlordSeat = 2, mySeatIndex = 2` → `codeCardSelector.show()` 被调用；`= 3` 时不调用
- AC-11/12/13（suit number）：发送的 WebSocket 消息中 `suit` 为 `number` 类型
- AC-14/15/16（bottom_cards）：收到 `bottom_cards` 后 `handCardView.showBottomCards` 被调用
- AC-17/18/19（hint）：收到 `hint` 后 `playZone.showHint` 被调用
