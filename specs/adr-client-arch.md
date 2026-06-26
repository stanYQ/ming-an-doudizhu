# ADR: Client 架构分层方案

**文档类型**: 架构决策记录（Architecture Decision Record）  
**提出方**: client-dev  
**决策方**: PM  
**状态**: **已决策 ✅**  
**提出日期**: 2026-06-26  
**决策日期**: 2026-06-26  
**影响范围**: `client/assets/scripts/` 全部

---

## 背景

当前 client 代码经历了从多场景（director.loadScene）到单场景（oops.gui.open）的架构迁移，
遗留了一套 **view/ctrl 二层结构**：

- `ui/view/*.ts` — 纯 TS 逻辑类，无 CC 依赖，可 Jest 测试
- `ui/ctrl/*.ts` — CC Component，把 @property 节点注入 view 实例

**问题**：每个 UI 屏幕维护两个文件（HallView + HallCtrl），
注入代码机械冗长，实际测试价值不高（大部分 view 逻辑只是字符串赋值）。

在准备新建 main.scene 和各 prefab 的当下，需要确定后续架构风格，
避免在错误方向上继续叠加文件。

---

## 三个方案（来自 client-dev）

### 方案 A — Logic / UI / Manager 三层（Dev 推荐，~3天迁移）

新建 `scripts/logic/` 目录，MatchLogic / GameLogic / HandLogic 做纯 TS 状态机；
UI 层 CC Component 只渲染，不含业务判断。

### 方案 B — 轻量 ViewModel（~1.5天）

ViewModel 层只做数据转换，状态机散在各消息处理器。

### 方案 C — 最小改动（~0.5天）

扁平化 Hall/Launch，保留 Game 端 view 层。风格不一致。

---

## PM 决策

**选方案 C 的变体 — 不扁平化，定名为「SceneManager + View/Controller 统一架构」**，即 **当前架构规范化**，不做迁移。

### 决策理由

**1. 现有架构已是方案 A 的工作实现**

client-dev 提出方案 A 时，项目里已经存在：

| 方案 A 术语 | 现有文件 | 说明 |
|-------------|---------|------|
| GameLogic   | `game/GameController.ts` | 纯 TS，完整状态机，256/256 有测试 |
| MatchLogic  | `ui/MatchView.ts` | 纯 TS，匹配状态 + 好友房逻辑 |
| HallLogic   | `ui/HallView.ts` | 纯 TS，大厅交互 |
| UI Ctrl     | `scenes/HallSceneManager.ts` | CC Component，@property 注入 |
| UI Ctrl     | `scenes/GameSceneManager.ts` | CC Component，@property 注入 |

方案 A 所描述的三层结构**已经存在**，只是名字不叫 Logic/Ctrl。新建 `logic/` 目录是无效重命名，不产生业务价值。

**2. P5 UI Spec 已全部按当前架构写完**

TASK-041 ～ TASK-045 的 5 份 Spec 明确指定：
- `HallSceneManager.ts` → 注入 HallView + MatchView
- `GameSceneManager.ts` → 注入 GameController + 各 UI 组件
- `LaunchSceneManager.ts` → 注入 LaunchView

切换为方案 A 需要重写全部 5 份 Spec，迁移成本从 3 天变成 3+2 = 5 天，而功能不变。

**3. 扁平化（方案 C 原始定义）反而变差**

将 HallView 合并进 HallSceneManager 会使：
- 纯 TS 逻辑混入 CC 依赖，失去 Jest 可测试性
- 文件膨胀（HallSceneManager 已 ~185 行，吸收 HallView 后达 ~350 行）

所以方案 C 的「扁平化」部分**不执行**，但「最小改动」的精神保留。

---

## 决策结论：规范化现有架构

### 架构名称

```
SceneManager + View/Controller 分层架构
```

### 分层定义（终态）

```
scenes/           CC Component 层（可在编辑器编辑，@property 注入）
  LaunchSceneManager.ts   → 注入 LaunchView
  HallSceneManager.ts     → 注入 HallView + MatchView
  GameSceneManager.ts     → 注入 GameController + UI 子组件

ui/               View 层（纯 TS，无 CC 运行时依赖，可 Jest 测试）
  LaunchView.ts   启动加载 + stub 登录
  HallView.ts     大厅展示 + 按钮事件
  MatchView.ts    匹配状态机（快速匹配 / 好友房）
  DoublingView.ts 加倍阶段
  HandCardView.ts 手牌 + 选牌 + 对象池
  PlayZone.ts     出牌区展示
  PlayerSeat.ts   席位展示 + 计时圆环
  CodeCardSelector.ts 暗号牌弹窗
  SettlementView.ts   结算 + 再来一局

game/             Controller 层（纯 TS，游戏状态机）
  GameController.ts   状态机 7 态 + 消息处理 + 调度 view

net/              网络层（纯 TS）
  NetManager.ts   Colyseus ↔ oops.message 桥接

core/             框架初始化
  AppRoot.ts      oops Root 根组件（挂 LaunchScene）
  SafeAreaWidget.ts
  ScreenAdapter.ts

shared/           只读（来自 server shared/）
```

### 数据流（不变）

```
Server → NetManager._registerHandlers()
              ↓ message.dispatchEvent('TURN' / 'HAND' / ...)
         GameController / MatchView / HallView 各自 message.on 订阅
              ↓ 调用 View 方法（render / show / update）
         SceneManager 中的 @property 节点执行渲染
```

### 命名规则（新文件必须遵守）

| 层 | 文件命名 | 超类 | CC 依赖 |
|----|---------|------|--------|
| SceneManager | `*SceneManager.ts` | `Component` | 必须有 |
| View | `*View.ts` | 无 | 禁止（`import { Node } from 'cc'` 除外用于注入签名） |
| Controller | `*Controller.ts` | 无 | 禁止 |
| Prefab 脚本 | `*.ts`（直接命名） | `Component` | 必须有（需挂节点） |

### oops 集成边界（确认）

| 能力 | 使用方式 | 不用的原因 |
|------|---------|----------|
| `message` | **全量使用**（跨层解耦核心）| — |
| `oops.res` | **使用**（Prefab/Bundle 加载）| — |
| `oops.storage` | **使用**（替代 sys.localStorage）| — |
| `oops.gui.open/remove` | **不使用** | 项目是多场景架构，gui 管 panel 层，不替换 director.loadScene |
| `oops.gui.toast` | **P1 使用**（需先配置 LayerNotify 层）| P0 手写 Tween 过渡 |
| `oops.pool` | **不使用于 CardItem** | EffectSingleCase 专为动画特效，CardItem 用 CC NodePool |
| `director.loadScene` | **保留**（LaunchScene→HallScene→GameScene）| 三个场景边界清晰，不适合单场景 Panel 架构 |

---

## 执行要求（TASK-041 起生效）

1. **新 Prefab 脚本**（CardItem / PlayerSeat / SeatItem 等）直接继承 `Component`，不新建 View 层
2. **SceneManager 只做注入**，不含业务逻辑；业务逻辑写在对应 View/Controller
3. **禁止在 View 层 import CC 运行时模块**（`import { tween, Vec3 } from 'cc'` 等），这些只能出现在 SceneManager 或 Prefab 脚本中
4. **不新建 `logic/` 目录**，已有 GameController 就是 Logic 层
5. `AppRoot.ts` 必须是 LaunchScene 第一个 onLoad 的组件，确保 oops 模块在任何 View 使用前初始化

---

## 不在此次决策范围内

- Logic 层进一步拆分（HandLogic 等）— P6 视规模决定，不提前
- oops.gui.toast P1 升级 — 单独任务
- 历史 view 文件重命名 — 成本无收益，保持现状

---

## 参考

- `docs/UI-DESIGN.md` — 组件规格与 Prefab 架构
- `specs/ui-flow-01~05.md` — 按此架构写成的 5 份 UI Spec
- `client/CLAUDE.md` — client-dev 工作规范
- `client/assets/scripts/core/AppRoot.ts` — oops 初始化实现
