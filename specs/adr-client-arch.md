# ADR: Client 架构分层方案

**文档类型**: 架构决策记录（Architecture Decision Record）  
**提出方**: client-dev  
**决策方**: PM  
**状态**: **已决策 ✅ — 方案 A**  
**提出日期**: 2026-06-26  
**决策日期**: 2026-06-26（修订 2026-06-26）  
**影响范围**: `client/assets/scripts/` 全部

---

## 决策结论（先看结论）

**选方案 A（Logic / UI / Manager 三层）**，实际迁移成本约 **0.5 天**（非 3 天）。

原因：`ui/view/*.ts` 已无 CC 导入（已是 Logic 层实现）；`ui/ctrl/*.ts` 已是 Ctrl 层。  
唯一需要迁移的文件：`game/GameController.ts`（移除 `extends Component`，纯化为 Logic）。

---

## 三层定义（精确边界，不可模糊）

```
GameMgr 层（游戏级协调者，单例）
  scripts/logic/GameMgr.ts        ← 持有所有子 Logic 实例，是 Ctrl 的唯一入口
    ├── matchLogic: MatchLogic
    ├── handLogic:  HandLogic
    ├── settlementLogic: SettlementLogic
    └── ...
  NetManager.ts                   ← 网络单例，已有，不变
  oops.storage / oops.res          ← 框架提供，不变

Logic 层（纯 TS，零 CC 依赖，可 Jest 直接测试）
  scripts/logic/MatchLogic.ts     ← MatchView.ts 重命名（TASK-042 时执行）
  scripts/logic/HandLogic.ts      ← HandCardView.ts 重命名（TASK-043 时执行）
  scripts/ui/view/*.ts             ← 保留路径，视为 Logic 层的延伸（已无 CC 导入）

Ctrl 层（CC Component，只负责节点注入 + 渲染，不含业务逻辑）
  scripts/ui/ctrl/LaunchCtrl.ts   已有
  scripts/ui/ctrl/HallCtrl.ts     已有
  scripts/ui/ctrl/GameCtrl.ts     已有（改为引用 GameMgr 替代 GameController）
  新 Prefab 脚本                   如 CardItem.ts / SeatItem.ts（直接挂节点）
```

---

## 调用方向（单向向下）

```
Ctrl
 │  ① UI 事件触发，直接调用 GameMgr 方法
 ▼
GameMgr
 │  ② 委托给对应子 Logic 处理
 ▼
Logic（MatchLogic / HandLogic / ...）
 │  ③ 处理完成，通知 Ctrl 更新渲染
 │     方式 A：Logic 持有 callback（由 Ctrl 在 init 时注册）
 │     方式 B：oops.message.emit（适合广播型通知，如服务端消息）
 ▼
Ctrl（渲染/更新节点）
```

**规则**：
- Ctrl → GameMgr：直接方法调用 ✅
- GameMgr → Logic：直接方法调用 ✅
- Logic → Ctrl：callback 或 oops.message，禁止持有 Ctrl 引用 ✅
- Ctrl 不能绕过 GameMgr 直接持有 Logic 实例 ❌

---

## 防漂移护栏（Anti-Drift Guardrails）

这是选 A 的核心价值——每条规则都是可机械检查的：

### 规则 1：Logic 层零 CC 导入（硬红线）

```typescript
// ✅ 合法 — Logic 文件
import { message } from 'db://oops-framework/...'   // oops message 允许
import { PatternHelper } from '../shared/...'        // shared 允许

// ❌ 违规 — Logic 文件里出现任何以下导入，立即 fix
import { Component, Node, Label, tween } from 'cc';
```

**检测命令**（client-dev 每次 commit 前跑）:
```bash
grep -r "from 'cc'" client/assets/scripts/logic/ client/assets/scripts/ui/view/
# 输出必须为空
```

### 规则 2：Ctrl 层不含 message.on 业务处理（软红线）

```typescript
// ✅ 合法 — Ctrl 文件的 onLoad()
onLoad() {
    this._logic = new GameLogic();
    this._logic.init(nodeRefs);           // 注入节点引用
}
onPlayButtonClick() {
    this._logic.onPlayButtonClick();      // 纯代理，无业务判断
}

// ❌ 违规 — Ctrl 文件里出现状态机逻辑
message.on('TURN', (data) => {
    if (data.seatIndex === this.mySeat) { // 业务判断 = Logic 层
        this.enableButtons();
    }
}, this);
```

### 规则 3：每个 Logic 文件必须有层标识

```typescript
/**
 * @file GameLogic.ts
 * @description ...
 * @layer logic          ← 必须有此行，值为 logic | ctrl | manager
 * @module client/logic
 */
```

**检测命令**:
```bash
grep "@layer ctrl" client/assets/scripts/logic/    # 结果必须为空
grep "@layer logic" client/assets/scripts/ui/ctrl/ # 结果必须为空
```

### 规则 4：新文件归层决策树

写任何新 `.ts` 文件前，先走这棵决策树：

```
需要 @property 或 extends Component？
  是 → Ctrl 层，放 ui/ctrl/，文件名 *Ctrl.ts 或 *SceneManager.ts
  否 → 有 Jest 测试业务逻辑需求？
        是 → Logic 层，放 logic/（新文件）或 ui/view/（兼容旧文件）
        否 → 是全局单例？→ Manager 层，放 net/ 或 core/
```

---

## 迁移计划（执行顺序）

### Phase 1 — GameController 脱 CC，升级为 GameMgr（0.5天，TASK-041 开始前）

**目标文件**: `game/GameController.ts` → 迁移为 `logic/GameMgr.ts`

当前问题：
```typescript
@ccclass('GameController')
export class GameController extends Component {  // 不应 extend Component
```

迁移后 `logic/GameMgr.ts`：
```typescript
/**
 * @file GameMgr.ts
 * @description 游戏级协调者，持有所有子Logic实例，是Ctrl层的唯一调用入口。
 * @layer logic
 * @module client/logic
 */
export class GameMgr {
    // 子 Logic 模块（Phase 2 逐步拆出）
    readonly matchLogic      = new MatchLogic();
    readonly handLogic       = new HandLogic();
    readonly settlementLogic = new SettlementLogic();

    // 渲染回调（由 GameCtrl.onLoad 注册）
    onRenderNeeded?: (event: string, data: unknown) => void;

    private state: ClientGameState = ClientGameState.CONNECTING;

    init(netManager: NetManager): void {
        this._net = netManager;
        this._registerMessages();    // 监听服务端消息，委托给子 Logic
    }

    destroy(): void {
        this._unregisterMessages();
    }

    // ── Ctrl 调用的公开方法 ──────────────────────────────────────────────────
    onPlayButtonClick(): void { this.handLogic.confirmPlay(this._net); }
    onPassButtonClick(): void { this._net.pass(); }
    setConnected(seatIndex: number, sessionId: string): void { /* ... */ }
}
```

`GameCtrl.ts` 配套修改（移除 `@property(GameController)`，改持有 `GameMgr`）：
```typescript
private _mgr!: GameMgr;

onLoad() {
    this._mgr = new GameMgr();

    // 注册渲染回调：Logic 通知 Ctrl 更新节点
    this._mgr.onRenderNeeded = (event, data) => this._render(event, data);

    // 把节点引用注入子 Logic（替代原来的属性注入）
    this._mgr.handLogic.init({
        playButton:   this.playButton,
        patternLabel: this.patternLabel,
    });
    this._mgr.settlementLogic.init({
        rootNode:    this.settlementRoot,
        bannerLabel: this.bannerLabel,
        // ...
    });

    this._mgr.init(netManager);

    const room = netManager.room;
    if (room) {
        const myPlayer = (room.state?.players as any)?.get?.(room.sessionId);
        this._mgr.setConnected((myPlayer?.seatIndex as number) ?? -1, room.sessionId as string);
    }
}
onDestroy()            { this._mgr.destroy(); }
onPlayButtonClick()    { this._mgr.onPlayButtonClick(); }
onPassButtonClick()    { this._mgr.onPassButtonClick(); }
// ... 其余按钮代理不变
```

### Phase 2 — 视图文件重命名（按 TASK 顺序，不提前）

| 时机 | 操作 |
|------|------|
| TASK-042 认领时 | `ui/view/MatchView.ts` → `logic/MatchLogic.ts` |
| TASK-043 认领时 | `ui/view/HandCardView.ts` → `logic/HandLogic.ts`（同时 mkdir `logic/`） |
| 其余 view 文件 | 保留原路径，P5 完成后评估 |

> 重命名前在 `.tasks/blocked.md` 报告 → PM 确认 → 执行

---

## 当前文件层归属（基准快照，2026-06-26）

| 文件 | 现状 | 目标 | 迁移动作 |
|------|------|------|----------|
| `game/GameController.ts` | ⚠️ 混层（CC + Logic） | Logic | Phase 1：脱 CC，迁至 `logic/GameMgr.ts` |
| `ui/ctrl/GameCtrl.ts` | ✅ Ctrl | Ctrl | Phase 1 配套：改持有 GameMgr |
| `ui/ctrl/HallCtrl.ts` | ✅ Ctrl | Ctrl | 不动 |
| `ui/ctrl/LaunchCtrl.ts` | ✅ Ctrl | Ctrl | 不动 |
| `ui/view/MatchView.ts` | ✅ Logic（无 CC） | Logic | Phase 2：重命名 |
| `ui/view/HallView.ts` | ✅ Logic（无 CC） | Logic | 暂保留路径 |
| `ui/view/HandCardView.ts` | ✅ Logic（无 CC） | Logic | Phase 2：重命名 |
| `ui/view/DoublingView.ts` | ✅ Logic（无 CC） | Logic | 暂保留路径 |
| `ui/view/SettlementView.ts` | ✅ Logic（无 CC） | Logic | 暂保留路径 |
| `ui/view/PlayerSeat.ts` | ✅ Logic（无 CC） | Logic | 暂保留路径 |
| `ui/view/PlayZone.ts` | ✅ Logic（无 CC） | Logic | 暂保留路径 |
| `ui/view/LaunchView.ts` | ✅ Logic（无 CC） | Logic | 暂保留路径 |
| `ui/view/CodeCardSelector.ts` | ✅ Logic（无 CC） | Logic | 暂保留路径 |
| `net/NetManager.ts` | ✅ Manager | Manager | 不动 |
| `core/AppRoot.ts` | ✅ Ctrl（CC Component） | Ctrl | 不动 |

---

## 新建文件规则（P5 起全部遵守）

| 场景 | 放哪里 | 层标识 | CC 导入 |
|------|--------|--------|---------|
| 游戏/大厅/匹配状态机 | `scripts/logic/` | `@layer logic` | ❌ 禁止 |
| Prefab 根节点脚本 | `scripts/ui/ctrl/` | `@layer ctrl` | ✅ 必须 |
| 子节点 Prefab 脚本（CardItem 等）| `scripts/ui/ctrl/` | `@layer ctrl` | ✅ 必须 |
| SceneManager 类 | `scripts/scenes/` | `@layer ctrl` | ✅ 必须 |

---

## 为什么是方案 A 不是方案 C

PM 之前的决策（方案 C 变体）有一个关键错误：

`GameController.ts` extends CC `Component`，意味着它**必须挂在节点上**，无法被 Jest 直接 `new GameController()` 实例化。随着游戏功能变复杂（断线重连、AI 提示、积分动画、春天判定），Logic 层的 Jest 覆盖率会越来越难维持——这正是架构漂移的根源。

方案 A 的核心不是"目录叫什么"，而是：**Logic 不能 extend Component**。  
这一条规则可以被 `grep` 机械检查，任何漂移在 commit 前即可发现。

---

## oops 集成边界（不变）

| 能力 | 使用方式 | 说明 |
|------|---------|------|
| `message` | **全量使用** | Logic→Ctrl 通信唯一通道 |
| `oops.res` | **使用** | Prefab/Bundle 加载，在 Ctrl 层调用 |
| `oops.storage` | **使用** | 替代 sys.localStorage，在 Logic 层可用（无 CC 依赖） |
| `oops.gui.open/remove` | **不使用** | 多场景架构，保留 director.loadScene |
| `oops.gui.toast` | **P1 使用** | 需配置 LayerNotify |
| `oops.pool` | **不使用于 CardItem** | EffectSingleCase 专用于动画特效 |

---

## 不在此次决策范围内

- `ui/view/*.ts` 全量重命名 — Phase 2 按需执行
- Logic 层再拆分（HandLogic vs CardSelectionLogic）— 视规模决定
- oops.gui.toast P1 升级 — 另立任务

---

## 参考

- `specs/ui-flow-01~05.md` — P5 UI Spec（Phase 1 完成后更新 GameMgr 引用路径）
- `client/CLAUDE.md` — client-dev 工作规范
- `client/assets/scripts/ui/ctrl/GameCtrl.ts` — Phase 1 改动主体
- `client/assets/scripts/game/GameController.ts` — Phase 1 迁移源
