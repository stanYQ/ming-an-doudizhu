# Spec: Phase 1 — GameController → GameMgr 架构迁移

**任务 ID**: TASK-049  
**目标模块**: client  
**优先级**: P0  
**状态**: ready  
**前置依赖**: 无（TASK-041 的前置）

---

## 执行流程

```
Step 1  认领
        → 更新 .tasks/in-progress.md

Step 2  新建三个文件
        → logic/GameMgr.ts
        → logic/HandLogic.ts
        → logic/SettlementLogic.ts

Step 3  修改 ui/ctrl/GameCtrl.ts

Step 4  删除旧文件
        → git rm game/GameController.ts

Step 5  红线验证
        → grep -r "from 'cc'" client/assets/scripts/logic/   # 必须为空
        → grep -r "oops\." client/assets/scripts/logic/       # 必须为空
        → cd client && npx jest                               # 全绿

Step 6  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除
```

---

## 背景

`game/GameController.ts` 是 CC Component（`extends Component`），导致游戏核心逻辑无法被 Jest 直接 `new` 实例化测试，是架构漂移的根源。

本任务将其迁移为纯 TS 的 `GameMgr`，同时厘清三层职责：
- **Logic**：只做纯业务计算 + 发网络请求，禁 UI / 禁 oops
- **GameMgr**：总控制器，持子 Logic，可调 `oops.gui.toast` 等框架 API
- **Ctrl**：持有 UI 视图，收集 UI 数据后**以参数**传给 GameMgr

权威参考：`specs/adr-client-arch.md`

---

## 验收标准

- AC-1: `logic/GameMgr.ts` 不含 `extends Component` / `@ccclass` / `import { * } from 'cc'`
- AC-2: `logic/HandLogic.ts` 不含 CC 导入，不含 oops 调用，`validate(cards)` 返回 `{ valid, error? }`
- AC-3: `logic/SettlementLogic.ts` 不含 CC 导入，不含 oops 调用
- AC-4: `GameMgr.requestPlay(cards)` 接收参数，调 `HandLogic.validate`，失败时 `oops.gui.toast()`，成功时 `netManager.playCards(cards)`
- AC-5: `GameMgr` 所有服务端消息处理通过 `this.onRender?.()` 回调通知 Ctrl，不直接操作任何 UI 对象
- AC-6: `GameCtrl` 持有所有 UI 视图（`_handCardView` 等），不将 UI 对象传给 GameMgr
- AC-7: `GameCtrl.onPlayBtnClick()` 先从 `this._handCardView.getSelectedCards()` 取数据，再调 `this._mgr.requestPlay(cards)`
- AC-8: `GameCtrl` 注册 `_mgr.onRender` 回调，在回调内操作节点
- AC-9: `game/GameController.ts` 文件已删除
- AC-10: `npx jest` 全绿，无回归

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
    leaveRoom(net: NetManager): void
}

// logic/GameMgr.ts
export class GameMgr {
    onRender?: (event: string, data: unknown) => void

    init(): void
    destroy(): void
    setConnected(seatIndex: number, sessionId: string): void

    // 从 Ctrl 接收数据参数，不持有 UI 对象
    requestPlay(cards: number[]): void
    requestPass(): void
    selectCodeCard(suit: number, rank: number): void
    setDouble(v: 1 | 2): void
    requestRematch(): void
    returnToHall(): void
}

// ui/ctrl/GameCtrl.ts（onRender 回调内的事件）
type RenderEvent =
    | 'HAND'            // { cards: number[] }
    | 'TURN'            // { seatIndex, deadline, isMyTurn, isNewRound }
    | 'BOTTOM_CARDS'    // { cards }
    | 'HINT'            // { cards }
    | 'REVEAL'          // { playerId, role }
    | 'OVER'            // { winnerCamp, scores, players, breakdown }
    | 'STATE'           // { phase, landlordSeat?, lastPlay? }
    | 'DOUBLING_START'  // { timeout }
    | 'LANDLORD_DOUBLED'| 'DOUBLING_RESULT'
    | 'REMATCH_UPDATE'  | 'REMATCH_START' | 'REMATCH_REDIRECT'
```

---

## 约束

- `logic/` 目录下所有文件禁止 `import { * } from 'cc'` 和 `oops.*` 调用
- GameMgr 不持有任何 UI 视图实例（HandCardView / PlayZone / PlayerSeat 等）
- Ctrl 的 `on*Click` 方法必须先从自身持有的 UI 视图取数据，再作为参数传给 GameMgr
- 错误提示（牌型不合法 / 压不过上家）统一由 GameMgr 调 `oops.gui.toast()`，不经过 Ctrl
- `GameController.ts` 中原有的状态机逻辑（`onStateChange` 各 case）完整迁移到 `GameMgr`，不丢失

## 不在范围内

- MatchLogic / HandLogic 进一步拆分子模块
- ui/view/*.ts 文件重命名（Phase 2 按 TASK 顺序执行）
- oops.gui.toast LayerNotify 配置（P1 任务）
- 任何新的游戏功能
