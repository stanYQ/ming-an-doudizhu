# ADR: Client 架构分层方案

**状态**: 已决策 ✅ — 方案 A（v3，2026-06-26）  
**影响范围**: `client/assets/scripts/` 全部

---

## 一、三层结构总览

```
┌──────────────────────────────────────────────────────┐
│  Ctrl 层（CC Component）                               │
│  职责：@property 节点绑定 / 持有 UI 视图 / 收集 UI 数据  │
│        / 渲染节点 / 注册回调 / on*Click 事件代理          │
└────────────────────┬─────────────────────────────────┘
                     │ 把 UI 数据作为参数传入，不传 UI 对象
                     ▼
┌──────────────────────────────────────────────────────┐
│  GameMgr（总控制器，纯 TS 单例）                         │
│  职责：持有子 Logic 实例 / 接收服务端消息 / 业务调度        │
│        / 可调用框架 API（oops.gui.toast / oops.res /    │
│          oops.storage）/ 通知 Ctrl 更新渲染              │
└────────────────────┬─────────────────────────────────┘
                     │ 纯业务委托，不传 UI 对象
                     ▼
┌──────────────────────────────────────────────────────┐
│  Logic 层（各子模块，纯 TS）                              │
│  HandLogic / MatchLogic / SettlementLogic / ...       │
│  职责：只管 ① 纯业务计算 ② 发网络请求                     │
│  禁止：持有 UI 引用 / 调用框架 API / import 'cc'          │
└──────────────────────────────────────────────────────┘
```

---

## 二、各层精确职责

### Ctrl（`ui/ctrl/*.ts`, `scenes/*.ts`）

- 持有所有 CC 节点（`@property Label / Button / Node`）
- 持有所有 UI 视图实例（`HandCardView`, `PlayZone`, `PlayerSeat[]` 等）
- `on*Click()` 事件：**从 UI 视图收集数据，作为参数传给 GameMgr**
- 注册 GameMgr 的渲染回调，收到通知后更新节点
- 不含任何业务判断

```typescript
// ✅ Ctrl 正确写法
onPlayBtnClick() {
    const cards = this._handCardView.getSelectedCards(); // 从UI取数据
    this._mgr.requestPlay(cards);                        // 作为参数传入
}

// ❌ Ctrl 错误写法
onPlayBtnClick() {
    this._mgr.requestPlay(); // GameMgr 自己去取 UI 数据 — 违规
}
```

---

### GameMgr（`logic/GameMgr.ts`）

- 持有 `NetManager` 引用
- 持有各子 Logic 实例（`handLogic`, `matchLogic`, `settlementLogic`...）
- **公开方法接收来自 Ctrl 的参数**（不持有 UI 对象）
- **可以调用框架 API**：`oops.gui.toast()` / `oops.res` / `oops.storage`
- 接收服务端 `oops.message`，委托给子 Logic，再通知 Ctrl 渲染

```typescript
// ✅ GameMgr 正确写法
requestPlay(cards: number[]) {                // 数据从 Ctrl 传入
    const result = this._handLogic.validate(cards);
    if (!result.valid) {
        oops.gui.toast(result.error);         // 框架 API ✅
        return;
    }
    this._net.playCards(cards);
}

// ❌ GameMgr 错误写法
requestPlay() {
    const cards = this._handCardView.getSelectedCards(); // 持有 UI 对象 — 违规
    this._playZone.showError('...');                     // 调用 UI — 违规
}
```

---

### Logic 子模块（`logic/HandLogic.ts` 等）

- **只做两件事**：纯业务计算 + 发网络请求
- 不持有任何 UI 引用
- 不调用任何框架 API（oops.xxx 全部禁止）
- 返回结果给 GameMgr，由 GameMgr 决定如何响应

```typescript
// ✅ HandLogic 正确写法
export class HandLogic {
    validate(cards: number[]): { valid: boolean; error?: string } {
        const pattern = parse(cards);
        if (pattern.type === PatternType.INVALID)
            return { valid: false, error: '牌型不合法' };
        return { valid: true };
    }
    play(cards: number[], net: NetManager): void {
        net.playCards(cards);
    }
    pass(net: NetManager): void {
        net.pass();
    }
}

// ❌ HandLogic 错误写法
export class HandLogic {
    play(cards: number[]) {
        oops.gui.toast('出牌成功');   // 调用框架 — 违规
        this._playZone.clear();       // 持有 UI — 违规
    }
}
```

---

## 三、通信方向（单向向下）

```
Ctrl.on*Click(event)
  │ 收集 UI 数据
  │ cards = this._handCardView.getSelectedCards()
  ↓
GameMgr.requestPlay(cards)           ← 参数传数据，不传 UI 对象
  │ result = this._handLogic.validate(cards)
  │ if error → oops.gui.toast(error) ← 框架 API 在 GameMgr 层调用
  │ if ok    → this._net.playCards(cards)
  │
  │ 服务端响应后（oops.message 或 onStateChange）
  ↓
GameMgr 通知 Ctrl 渲染：
  方式 A（推荐）: this._onRender?.('TURN_CHANGED', data)  ← Ctrl 注册的 callback
  方式 B: oops.message.emit('TURN_CHANGED', data)         ← 广播型（多处订阅时用）
  ↓
Ctrl._onRender(event, data)
  this._playZone.setInteractable(true)   ← 只在 Ctrl 里操作 UI
```

---

## 四、防漂移护栏

### 硬红线（grep 机械检查，commit 前必跑）

```bash
# Logic 层零 CC 导入，输出必须为空
grep -r "from 'cc'" client/assets/scripts/logic/
grep -r "from 'cc'" client/assets/scripts/ui/view/

# Logic 层零 oops 框架调用，输出必须为空
grep -r "oops\." client/assets/scripts/logic/
```

### 场景导航规则（硬规定）

本项目为多场景架构，`AppRoot` 的 `config.json` 中 `gui: []`（LayerManager 层未初始化）。

| 操作 | 正确 | 禁止 |
|------|------|------|
| 场景跳转 | `director.loadScene('HallScene')` | `oops.gui.open(UIId.Hall)` |
| 错误提示 | `oops.gui.toast(msg)` | 手写 Label 节点 |
| 弹层/面板 | `node.active = true/false` | `oops.gui.open/remove` |

```bash
# 红线：Ctrl/Logic 不得使用 oops.gui.open / oops.gui.remove
grep -r "oops\.gui\.open\|oops\.gui\.remove" client/assets/scripts/ui/
grep -r "oops\.gui\.open\|oops\.gui\.remove" client/assets/scripts/logic/
```

### 方法命名边界

| 层 | 允许命名 | 禁止命名 |
|----|---------|---------|
| Ctrl | `on*Click` `on*Tap` `on*Btn` | 业务意图词汇 |
| GameMgr | `requestPlay()` `returnToHall()` `setDouble()` | `on*Click/Tap/Btn` |
| Logic | `validate()` `play()` `pass()` `join()` | `on*Click/Tap` / `show*` / `render*` |

### 参数传递规则

| 场景 | 正确 | 错误 |
|------|------|------|
| Ctrl 调 GameMgr | 传数据值 `requestPlay(cards)` | 传 UI 对象 `requestPlay(handCardView)` |
| GameMgr 调 Logic | 传数据值 `validate(cards)` | 传 netManager 以外的任何对象 |
| Logic 返回 | 返回数据结果 `{ valid, error }` | 直接操作 UI / 调 toast |

### 新文件归层决策树

```
需要 @property / extends Component？
  是 → Ctrl 层  ui/ctrl/  @layer ctrl
  否 → 需要调用框架 API（oops.xxx）？
        是 → GameMgr 职责，写在 logic/GameMgr.ts
        否 → 纯业务/请求？→ Logic 层  logic/  @layer logic
```

---

## 五、文件结构（终态）

```
scripts/
├── logic/
│   ├── GameMgr.ts          ← 总控制器（纯TS，可调oops框架API）
│   ├── HandLogic.ts        ← 出牌验证 + 请求
│   ├── MatchLogic.ts       ← 匹配请求 + 状态
│   └── SettlementLogic.ts  ← 结算请求
├── ui/
│   ├── ctrl/
│   │   ├── GameCtrl.ts     ← CC Component，持有全部UI视图，注册回调
│   │   ├── HallCtrl.ts
│   │   └── LaunchCtrl.ts
│   └── view/               ← 过渡期保留，视同 Logic 层规则（禁 CC 导入）
│       ├── HallView.ts
│       ├── DoublingView.ts
│       └── ...
├── net/
│   └── NetManager.ts       ← 网络单例
└── core/
    └── AppRoot.ts          ← oops Root 组件
```

---

## 六、Phase 1 迁移方案（GameController → GameMgr）

### 变化对比

| 旧（GameController.ts） | 新（GameMgr.ts） |
|------------------------|----------------|
| `extends Component` | 纯 TS class |
| 持有 `handCardView` 等 UI 对象 | 不持有任何 UI 对象 |
| `onLoad()` / `onDestroy()` | `init()` / `destroy()` |
| `onPlayButtonClick()` | `requestPlay(cards: number[])` |
| `this.playZone?.showError()` | `oops.gui.toast(msg)` |
| `this.handCardView?.getSelectedCards()` | 从参数取（Ctrl 传入） |

### GameMgr.ts 骨架

```typescript
/**
 * @file GameMgr.ts
 * @description 游戏级总控制器：持有子Logic，调度业务，可调用oops框架API。
 * @layer logic
 * @module client/logic
 */
import { oops } from 'db://oops-framework/core/Oops';
import { message } from 'db://oops-framework/core/common/event/MessageManager';
import { netManager } from '../net/NetManager';
import { HandLogic } from './HandLogic';
import { SettlementLogic } from './SettlementLogic';
import { parse } from '../shared/PatternHelper';
import { PatternType } from '../shared/CardPattern';

export class GameMgr {
    private _handLogic      = new HandLogic();
    private _settlementLogic = new SettlementLogic();

    // Ctrl 注册的渲染回调
    onRender?: (event: string, data: unknown) => void;

    private _mySeatIndex  = -1;
    private _mySessionId  = '';
    private _currentSeat  = -1;
    private _state        = ClientGameState.CONNECTING;

    init(): void {
        message.on('STATE',            this._onStateChange,     this);
        message.on('HAND',             this._onHand,            this);
        message.on('TURN',             this._onTurn,            this);
        message.on('BOTTOM_CARDS',     this._onBottomCards,     this);
        message.on('HINT',             this._onHint,            this);
        message.on('REVEAL',           this._onReveal,          this);
        message.on('OVER',             this._onOver,            this);
        message.on('ERROR',            this._onError,           this);
        message.on('DOUBLING_START',   this._onDoublingStart,   this);
        message.on('LANDLORD_DOUBLED', this._onLandlordDoubled, this);
        message.on('DOUBLING_RESULT',  this._onDoublingResult,  this);
        message.on('REMATCH_UPDATE',   this._onRematchUpdate,   this);
        message.on('REMATCH_START',    this._onRematchStart,    this);
        message.on('REMATCH_REDIRECT', this._onRematchRedirect, this);
    }

    destroy(): void {
        message.off('STATE',            this._onStateChange,     this);
        // ... 其余 off
    }

    setConnected(seatIndex: number, sessionId: string): void {
        this._mySeatIndex = seatIndex;
        this._mySessionId = sessionId;
        this._state       = ClientGameState.IN_ROOM_WAIT;
    }

    // ── Ctrl 调用（参数从 Ctrl 传入，不持有 UI 对象）─────────────────────────

    requestPlay(cards: number[]): void {
        const result = this._handLogic.validate(cards);
        if (!result.valid) {
            oops.gui.toast(result.error!);   // 框架 toast 在 GameMgr 调用
            return;
        }
        netManager.playCards(cards);
    }

    requestPass(): void {
        netManager.pass();
    }

    selectCodeCard(suit: number, rank: number): void {
        netManager.selectCodeCard(suit, rank);
    }

    setDouble(v: 1 | 2): void {
        netManager.setDouble(v);
    }

    requestRematch(): void {
        this._settlementLogic.requestRematch(netManager);
    }

    returnToHall(): void {
        this._settlementLogic.leaveRoom(netManager);
    }

    // ── 服务端消息处理（内部，通知 Ctrl 渲染）──────────────────────────────────

    private _onStateChange(_e: string, state: any): void {
        // 状态机转换逻辑保留
        // 通知 Ctrl 渲染
        this.onRender?.('STATE', state);
    }

    private _onTurn(_e: string, msg: any): void {
        this._currentSeat = msg.seatIndex;
        this.onRender?.('TURN', { ...msg, isMyTurn: msg.seatIndex === this._mySeatIndex });
    }

    private _onHand(_e: string, msg: any): void { this.onRender?.('HAND', msg); }
    private _onBottomCards(_e: string, msg: any): void { this.onRender?.('BOTTOM_CARDS', msg); }
    private _onHint(_e: string, msg: any): void { this.onRender?.('HINT', msg); }
    private _onReveal(_e: string, msg: any): void { this.onRender?.('REVEAL', msg); }
    private _onOver(_e: string, msg: any): void { this.onRender?.('OVER', msg); }

    private _onError(_e: string, msg: { code: number }): void {
        const text = msg.code === 1001 ? '牌型不合法，请重选'
                   : msg.code === 1002 ? '压不过上家'
                   : '';
        if (text) oops.gui.toast(text);   // 错误提示由 GameMgr 用框架 toast
    }

    private _onDoublingStart(_e: string, msg: any): void { this.onRender?.('DOUBLING_START', msg); }
    private _onLandlordDoubled(_e: string, msg: any): void { this.onRender?.('LANDLORD_DOUBLED', msg); }
    private _onDoublingResult(_e: string, msg: any): void { this.onRender?.('DOUBLING_RESULT', msg); }
    private _onRematchUpdate(_e: string, msg: any): void { this.onRender?.('REMATCH_UPDATE', msg); }
    private _onRematchStart(_e: string, msg: any): void { this.onRender?.('REMATCH_START', msg); }
    private _onRematchRedirect(_e: string, msg: any): void { this.onRender?.('REMATCH_REDIRECT', msg); }
}
```

### GameCtrl.ts 骨架

```typescript
export class GameCtrl extends Component {
    // @property 节点引用（CC 编辑器拖拽）
    @property(Button) playBtn!: Button;
    @property(Button) passBtn!: Button;
    // ... 其余 @property 不变

    // UI 视图实例（留在 Ctrl，不传给 GameMgr）
    private _handCardView!:   HandCardView;
    private _playZone!:       PlayZone;
    private _playerSeats!:    PlayerSeat[];
    private _codeSelector!:   CodeCardSelector;
    private _settlementView!: SettlementView;
    private _doublingView!:   DoublingView;

    private _mgr!: GameMgr;

    onLoad() {
        // 1. 构建 UI 视图实例（视图留在 Ctrl）
        this._handCardView   = this._buildHandCardView();
        this._playZone       = this._buildPlayZone();
        this._playerSeats    = this._buildSeats();
        this._codeSelector   = this._buildCodeSelector();
        this._settlementView = this._buildSettlementView();
        this._doublingView   = this._buildDoublingView();

        // 2. 创建 GameMgr，注册渲染回调
        this._mgr = new GameMgr();
        this._mgr.onRender = (event, data) => this._render(event, data);
        this._mgr.init();

        // 3. 连接信息
        const room = netManager.room;
        if (room) {
            const myPlayer = (room.state?.players as any)?.get?.(room.sessionId);
            this._mgr.setConnected((myPlayer?.seatIndex as number) ?? -1, room.sessionId as string);
        }
    }

    onDestroy() { this._mgr.destroy(); }

    // ── Button 代理（on*Click 只在 Ctrl，收集 UI 数据后传参）──────────────────
    onPlayBtnClick()       { this._mgr.requestPlay(this._handCardView.getSelectedCards()); }
    onPassBtnClick()       { this._mgr.requestPass(); }
    onConfirmCodeClick()   { const c = this._codeSelector.getSelection();
                             this._mgr.selectCodeCard(c.suit, c.rank); }
    onSingleBtnClick()     { this._mgr.setDouble(1); }
    onDoubleBtnClick()     { this._mgr.setDouble(2); }
    onPlayAgainClick()     { this._mgr.requestRematch(); }
    onReturnHallClick()    { this._mgr.returnToHall(); }

    // ── 渲染回调（GameMgr 通知，Ctrl 更新节点）────────────────────────────────
    private _render(event: string, data: any): void {
        switch (event) {
            case 'HAND':           this._handCardView.render(data.cards); break;
            case 'TURN':           this._playZone.setInteractable(data.isMyTurn);
                                   if (data.isMyTurn) this._playZone.startCountdown(data.deadline); break;
            case 'BOTTOM_CARDS':   this._handCardView.showBottomCards?.(data.cards); break;
            case 'HINT':           this._playZone.showHint?.(data.cards); break;
            case 'REVEAL':         this._playerSeats.forEach(s => s.showIdentity(data.playerId, data.role)); break;
            case 'OVER':           this._settlementView.showResult(data); break;
            case 'DOUBLING_START': this._doublingView.show(data); break;
            case 'STATE':          this._onStateRender(data); break;
            // ... 其余 event
        }
    }

    private _onStateRender(state: any): void {
        switch (state.phase) {
            case 'doubling':    this._doublingView.show({}); break;
            case 'playing':     this._doublingView.hide();
                                this._playZone.setInteractable(true); break;
            case 'settlement':  this._playZone.setInteractable(false);
                                this._settlementView.show(); break;
            case 'waiting':     this._settlementView.hide?.(); break;
        }
    }
}
```

---

## 七、当前文件层归属快照

| 文件 | 现状 | 动作 |
|------|------|------|
| `game/GameController.ts` | ⚠️ CC+Logic 混层，持有 UI 对象 | Phase 1：迁移为 `logic/GameMgr.ts` |
| `ui/ctrl/GameCtrl.ts` | ✅ Ctrl | Phase 1 配套：改持有 GameMgr，UI 视图留在自身 |
| `ui/ctrl/HallCtrl.ts` | ✅ Ctrl | 不动 |
| `ui/ctrl/LaunchCtrl.ts` | ✅ Ctrl | 不动 |
| `ui/view/*.ts` × 9 | ✅ Logic（无 CC 导入） | 过渡期原地保留 |
| `net/NetManager.ts` | ✅ Manager | 不动 |

---

## 八、不在范围

- Logic 子模块进一步拆分 — P5 完成后按实际规模决定
- oops.gui.toast P1 LayerNotify 配置 — 另立任务
- `ui/view/*.ts` 全量重命名 — Phase 2 按 TASK 顺序执行
