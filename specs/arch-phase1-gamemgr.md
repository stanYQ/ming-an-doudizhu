# Spec: TASK-049 — 客户端三层架构全面对齐

**任务 ID**: TASK-049  
**目标模块**: client  
**优先级**: P0  
**状态**: ready  
**前置依赖**: 无（TASK-041~045 的共同前置，必须先完成）

---

## 执行流程

```
Step 1  认领 → 更新 .tasks/in-progress.md

Step 2  建立 logic/ 目录结构
        → 新建 logic/GameMgr.ts
        → 新建 logic/HandLogic.ts
        → 新建 logic/SettlementLogic.ts

Step 3  修改 ui/ctrl/GameCtrl.ts
        → UI 视图留在 Ctrl，onRender 回调模式

Step 4  修改 ui/ctrl/HallCtrl.ts
        → 移除 _onState 内的业务判断，委托给 MatchView

Step 5  新建 logic/LaunchMgr.ts（轻量）
        → 负责 token 读写 / 登录请求 / 页面跳转决策
        → LaunchCtrl 只保留 oops.res.loadBundle 进度条 + 节点操作

Step 6  迁移测试文件
        → git mv tests/__tests__/GameController.test.ts tests/__tests__/GameMgr.test.ts
        → 更新 import 路径指向 logic/GameMgr.ts

Step 7  删除旧文件
        → git rm game/GameController.ts

Step 8  红线验证
        → grep -r "from 'cc'" client/assets/scripts/logic/      # 必须为空
        → grep -r "oops\." client/assets/scripts/logic/          # 必须为空
        → 检查三个 Ctrl 的 message.on 处理，不含 if/switch 业务判断
        → cd client && npx jest                                   # 全绿

Step 9  完成 → 更新 .tasks/done.md
```

---

## 背景

P5 UI 搭建（TASK-041~045）直接在此架构上叠加，不提前对齐则后续所有任务都会带着坏味道执行。

**三个需要对齐的问题：**

1. `game/GameController.ts` — `extends Component`（Logic 层不应继承 CC）
2. `ui/ctrl/HallCtrl.ts` — `_onState` 内含业务判断 `if (state.phase === 'dealing')`（业务逻辑在 Ctrl）
3. `ui/ctrl/LaunchCtrl.ts` — `oops.res.loadBundle` 和登录逻辑混在 Ctrl（没有对应 Logic 层）

权威参考：`specs/adr-client-arch.md`（三层职责 + 防漂移护栏）

---

## 验收标准

### 1. logic/GameMgr.ts

- AC-1: 不含 `extends Component` / `@ccclass` / `import { * } from 'cc'`
- AC-2: 不含 `oops.*` 调用（`oops.gui.toast` 除外，toast 是 GameMgr 的合法调用）
- AC-3: 不持有任何 UI 视图对象（HandCardView / PlayZone / PlayerSeat 等）
- AC-4: `init()` 注册所有服务端消息，`destroy()` 注销
- AC-5: 所有服务端消息处理通过 `this.onRender?.('EVENT', data)` 通知 Ctrl
- AC-6: 错误提示（1001/1002）通过 `oops.gui.toast()` 输出，不经过 Ctrl
- AC-7: 公开方法使用业务意图命名，接收参数而非 UI 对象：
  - `requestPlay(cards: number[])`
  - `requestPass()`
  - `selectCodeCard(suit: number, rank: number)`
  - `setDouble(v: 1 | 2)`
  - `requestRematch()`
  - `returnToHall()`

### 2. logic/HandLogic.ts

- AC-8: 不含 `import { * } from 'cc'`，不含 `oops.*`
- AC-9: `validate(cards): { valid: boolean; error?: string }` — 纯业务，无副作用

### 3. logic/SettlementLogic.ts

- AC-10: 不含 `import { * } from 'cc'`，不含 `oops.*`
- AC-11: `requestRematch(net)` 和 `leaveRoom(net)` 只调用 netManager

### 4. logic/LaunchMgr.ts（轻量）

- AC-12: 不含 `import { * } from 'cc'`，不含 `oops.*`
- AC-13: `getStoredToken(): string | null` — 从参数读取，不自己调 oops.storage
- AC-14: `fetchLogin(code, apiBase): Promise<Response>` — 纯 fetch，无副作用
- AC-15: `decideNextPage(token): 'hall' | 'login'` — 纯逻辑判断

### 5. ui/ctrl/GameCtrl.ts

- AC-16: 移除 `@property(GameController)`，改为 `private _mgr!: GameMgr`
- AC-17: 所有 UI 视图实例（`_handCardView` / `_playZone` 等）保留在 Ctrl 自身
- AC-18: `on*Click` 方法先从 UI 视图取数据，再以参数形式传给 `_mgr`：
  ```typescript
  onPlayBtnClick() { this._mgr.requestPlay(this._handCardView.getSelectedCards()); }
  ```
- AC-19: 注册 `_mgr.onRender` 回调，在回调内操作 CC 节点

### 6. ui/ctrl/HallCtrl.ts

- AC-20: `_onState` 不含业务判断，改为直接委托：
  ```typescript
  private _onState(_e: string, state: any) { this._matchView.onStateChange(state); }
  ```
- AC-21: `MatchView` 内新增 `onStateChange(state)` 处理 `phase === 'dealing'` 逻辑

### 7. ui/ctrl/LaunchCtrl.ts

- AC-22: `_preloadWithProgress` 保留（CC 节点操作 + oops.res.loadBundle 合法在 Ctrl）
- AC-23: 登录决策逻辑（token 判断 / fetch login）委托给 LaunchMgr：
  ```typescript
  // LaunchCtrl.onLoad()
  const mgr = new LaunchMgr();
  const token = mgr.getStoredToken(oops.storage?.get('ddz_token'));
  if (token) { oops.gui.open(UIId.Hall); return; }
  // 否则走登录流程
  ```

### 8. 全局

- AC-24: `game/GameController.ts` 文件已删除（`git rm`）
- AC-25: `client/assets/scripts/logic/` 目录存在，含以上四个文件
- AC-26: `npx jest` 全绿，无回归
- AC-27: `tests/__tests__/GameController.test.ts` 已 `git mv` 为 `GameMgr.test.ts`，import 路径更新，`npx jest GameMgr` 单独绿

---

## 接口定义

```typescript
// logic/HandLogic.ts
export class HandLogic {
    validate(cards: number[]): { valid: boolean; error?: string }
}

// logic/SettlementLogic.ts
export class SettlementLogic {
    requestRematch(net: NetManager): void
    leaveRoom(net: NetManager): Promise<void>
}

// logic/LaunchMgr.ts
export class LaunchMgr {
    getStoredToken(rawToken: string | null): string | null
    fetchLogin(code: string, apiBase: string): Promise<Response>
    decideNextPage(token: string | null): 'hall' | 'login'
}

// logic/GameMgr.ts（onRender 回调事件类型）
type RenderEvent =
    | 'HAND'             // { cards: number[] }
    | 'TURN'             // { seatIndex, deadline, isMyTurn, isNewRound }
    | 'BOTTOM_CARDS'     // { cards }
    | 'HINT'             // { cards }
    | 'REVEAL'           // { playerId, role }
    | 'OVER'             // { winnerCamp, scores, players, breakdown }
    | 'STATE'            // { phase, landlordSeat?, lastPlay? }
    | 'DOUBLING_START'   // { timeout }
    | 'LANDLORD_DOUBLED' // { ... }
    | 'DOUBLING_RESULT'  // { results[] }
    | 'REMATCH_UPDATE'   // { ... }
    | 'REMATCH_START'    // {}
    | 'REMATCH_REDIRECT' // { action }
```

---

## 各层调用示意

```
LaunchCtrl
  oops.res.loadBundle(...)         ← Ctrl 调框架资源，合法
  mgr = new LaunchMgr()
  mgr.decideNextPage(token)        ← Ctrl 调 Logic，得到决策结果
  oops.gui.open(UIId.Hall)         ← Ctrl 执行跳转

HallCtrl
  message.on('STATE') → this._matchView.onStateChange(state)   ← 直接委托 Logic
  onQuickMatchClick() → this._matchView.showQuickMatch()        ← Ctrl 调 Logic

GameCtrl
  onPlayBtnClick()
    cards = this._handCardView.getSelectedCards()   ← 从 UI 取数据
    this._mgr.requestPlay(cards)                   ← 传参给 GameMgr

GameMgr.requestPlay(cards)
    result = this._handLogic.validate(cards)        ← 委托子 Logic
    if !result.valid → oops.gui.toast(result.error) ← GameMgr 调框架
    else → netManager.playCards(cards)              ← Logic 发请求
    → this.onRender?.('TURN', data)                 ← 通知 Ctrl 渲染
```

---

## 约束

- `logic/` 目录下所有文件：禁止 `import { * } from 'cc'`，禁止除 `oops.gui.toast` 外的 `oops.*` 调用
- HallCtrl 的 `on*Click` 方法可以直接调用 `_matchView` 的业务方法（HallCtrl 不需要 HallMgr，MatchView 即 Logic 层）
- LaunchMgr 是轻量 Logic，只做纯函数；Ctrl 持有 oops API 调用权
- GameCtrl 的 `_render(event, data)` 回调内只做节点操作，不含业务判断

## 不在范围内

- `ui/view/*.ts` 文件重命名（Phase 2，TASK-042/043 时执行）
- HallMgr / LaunchMgr 的进一步子模块拆分
- oops.gui.toast LayerNotify 配置（P1）
- 任何新游戏功能
