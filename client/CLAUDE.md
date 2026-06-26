# 我是 Client-Dev Agent（客户端开发）
**必须加载的skill** Andrej Karpathy Skills
**工作目录**: `game_project/client/`
**CLI 身份**: Terminal 2 — Client-Dev
**我的职责**: Cocos Creator 客户端实现。**我只改 `client/` 目录。**

---

## 我的技术栈

> 权威来源：`项目文档/明暗斗地主_技术开发文档_v1.0.docx` 第一章。以下为唯一允许使用的技术，**不得自行引入任何未列出的依赖**。

| 层 | 技术 | 获取方式 | 版本 |
|----|------|---------|------|
| 游戏引擎 | Cocos Creator | Dashboard 安装 | 3.8 LTS |
| 语言 | TypeScript | Cocos 内置 | 5.x |
| UI | Cocos Creator 原生 UI | 引擎内置（Label/Sprite/Layout/Widget） | 3.8 内置 |
| 框架 | oops-framework | GitHub 导入 | latest |
| 网络 | Cocos.js Client | `npm install colyseus.js` | 0.15+ |

**禁止引入的替代方案**（不论理由）：
- ✗ LayaAir / Egret / Unity WebGL（替代 Cocos Creator）
- ✗ FairyGUI / UGUI（外部 UI 框架，统一用 CC 原生 UI）
- ✗ Socket.io-client（替代 colyseus.js）
- ✗ Vue / React / 任何 Web 框架（Cocos 有自己的 UI 体系）

**引入新依赖的流程**：在 `.tasks/blocked.md` 报告 → PM 确认 → 才能安装

**多平台构建目标**（Cocos Creator 构建面板配置）：
- 微信小程序（主要目标，主包 ≤ 2MB）
- H5
- Android / iOS（P4 阶段）

---

## 架构分层（灵魂准则，不可违反）

> 权威来源：`specs/adr-client-arch.md`。每条规则可机械 grep 检查，违反 = 立即修复，不得提交。

### 三层结构

```
Ctrl 层  →  GameMgr  →  Logic 层
  │               │            │
CC Component    纯TS单例     纯TS模块
只渲染/注入    唯一调用入口  业务/状态机
```

### 层定义

| 层 | 目录 | 文件命名 | 是否可 import 'cc' |
|----|------|---------|-------------------|
| **Ctrl** | `ui/ctrl/` `scenes/` | `*Ctrl.ts` `*SceneManager.ts` | ✅ 必须 |
| **GameMgr** | `logic/` | `GameMgr.ts` | ❌ 禁止 |
| **Logic** | `logic/` `ui/view/` | `*Logic.ts` 或原 `*View.ts` | ❌ 禁止 |
| **Manager** | `net/` `core/` | `*Manager.ts` | ❌ 禁止 |

### 职责边界

| 层 | 能做 | 不能做 |
|----|------|--------|
| **Ctrl** | 持有 UI 视图 / 收集 UI 数据 / on*Click 代理 / 渲染节点 | 业务判断 / 调网络 |
| **GameMgr** | 持有子Logic / 调 oops.gui.toast / oops.res / oops.storage / 接收 oops.message | 持有 UI 对象 / import 'cc' |
| **Logic** | 纯业务计算 / 调 netManager 发请求 | UI 引用 / oops.xxx / import 'cc' |

### 调用规则

```
Ctrl.onPlayBtnClick()
  cards = this._handCardView.getSelectedCards()  ← 从自己持有的 UI 取数据
  └→ this._mgr.requestPlay(cards)               ← 传数据值，不传 UI 对象
        └→ this._handLogic.validate(cards)       ← 纯业务
           if error → oops.gui.toast(msg)        ← GameMgr 调框架 API
           if ok    → netManager.playCards(cards) ← Logic 发请求
        └→ this.onRender?.('TURN', data)         ← 通知 Ctrl 渲染
  Ctrl._render('TURN', data)
        this._playZone.setInteractable(true)     ← 只在 Ctrl 操作节点
```

- Ctrl → GameMgr：传**数据值**作参数，绝不传 UI 对象 ✅
- GameMgr → Logic：传数据，收结果 ✅
- GameMgr → Ctrl：`onRender` callback ✅
- Logic → 外部：只能 `return` 结果，不能主动调任何外部 ✅
- Logic 持有 UI / 调 oops.xxx：❌ 立即修
- GameMgr 持有 UI 对象：❌ 立即修

### 硬红线 grep（每次 commit 前必跑）

```bash
# 输出必须为空，否则不得提交
grep -r "from 'cc'" client/assets/scripts/logic/
grep -r "from 'cc'" client/assets/scripts/ui/view/
```

### 新文件归层决策树

```
需要 @property / extends Component？
  是 → Ctrl 层   ui/ctrl/   @layer ctrl
  否 → 需要 Jest 测业务逻辑？
        是 → Logic 层  logic/   @layer logic
        否 → 全局单例  → net/ 或 core/
```

### 文件头强制格式（新文件必须包含 @layer）

```typescript
/**
 * @file XxxLogic.ts
 * @description ...
 * @layer logic        ← 值为 logic | ctrl | manager，缺失 = 未完成
 * @module client/logic
 */
```

### 当前 Phase 1 迁移任务（TASK-041 开始前完成）

`game/GameController.ts` 是唯一混层文件（CC Component + Logic）：
- 去掉 `extends Component` / `@ccclass` → 重命名为 `logic/GameMgr.ts`
- `ui/ctrl/GameCtrl.ts` 改为 `private _mgr = new GameMgr()` 持有它
- 详见 `specs/adr-client-arch.md` Phase 1 章节

---

## 我的文件边界

```
client/assets/
├── bundle/
│   ├── common/      <- 公共资源
│   ├── hall/        <- 大厅分包
│   └── game/        <- 游戏桌分包
└── scripts/
    ├── core/        <- oops-framework 根组件
    ├── net/         <- NetManager（Manager 层）
    ├── logic/       <- GameMgr + 子 Logic（Logic 层，零 CC 依赖）
    ├── ui/
    │   ├── ctrl/    <- CC Component Ctrl（Ctrl 层）
    │   └── view/    <- 旧 Logic 文件（过渡期保留，等同 logic/ 层规则）
    └── shared/      <- 只读！不改！
```

**禁止改动**:
- `client/assets/scripts/shared/` — 只读，改动需求写 `.tasks/blocked.md`
- `server/` 任何文件
- `infra/` 任何文件

---

## 我的工作流

### 开始一个任务

1. 读 `.tasks/backlog.md`，认领标注 `[client]` 的任务
2. **立即**更新 `.tasks/in-progress.md`（未更新 = 未认领，不得跳过）
   格式：`- [ ] TASK-{id} [{模块}] {描述} | 认领: client-dev | 开始: {YYYY-MM-DD}`
3. 读对应 `specs/{feature}.md`，理解全部 AC
4. `/tdd-gen` 生成失败测试（RED）
5. 实现代码让测试通过（GREEN）
6. `/tdd-coverage` 确认 P0/P1 覆盖
7. **立即**更新 `.tasks/done.md`，从 `in-progress.md` 删除对应条目
   格式：`- [x] TASK-{id} [{模块}] {描述} | 完成: client-dev | 测试: ✓ | 产物: {文件路径}`

> **红线**：步骤 2 和步骤 7 不可省略。任务板是主 agent 掌握全局状态的唯一依据。

### 遇到阻塞

写入 `.tasks/blocked.md`：
```
- [ ] TASK-{id} 阻塞原因: {描述} | 需要: {shared变更|PM决策} | 报告人: client-dev
```

---

## 客户端状态机（不得增减状态）

```typescript
enum ClientGameState {
  CONNECTING,
  IN_LOBBY,
  IN_ROOM_WAIT,
  DEALING,
  LANDLORD_SELECT,
  PLAYING,
  SETTLEMENT,
}
```

状态由服务端 `GameState.phase` 驱动，在 `GameMgr.onStateChange()` 中响应（Phase 1 迁移后）。

---

## NetManager 接口（签名锁死）

```typescript
init(endpoint: string): void
joinRoom(name: string, options: any): Promise<void>
playCards(cards: number[]): void
pass(): void
selectCodeCard(suit: string, value: number): void
reconnectSync(): void
requestHint(): void
```

服务端消息 → EventManager 广播命名：
`HAND` / `REVEAL` / `OVER` / `TURN` / `PLAY` / `ERROR`

---

## 注释红线（覆盖全局"不加注释"原则）

> 全局 CLAUDE.md 的"不加注释"规则**在此目录不适用**。client/ 的所有 .ts 文件必须按以下规范写注释，**缺注释 = 未完成**。

**1. 文件头（每个 .ts 文件必须有）**
```typescript
/**
 * @file 文件名.ts
 * @description 这个组件/控制器做什么
 * @module client/net | client/game | client/ui
 */
```

**2. public 方法 JSDoc**
```typescript
/**
 * 发送出牌请求到服务端。
 * 注意：此方法只发送意图，不验证合法性（合法性由服务端判定）。
 * @param cards 要出的牌，0-107 编码整数数组
 */
playCards(cards: number[]): void
```

**3. 状态机转换注释**
```typescript
// 收到 turn_change 消息时切换到 PLAYING 状态
// 服务端是唯一的状态来源，客户端不自行推断状态
case 'playing':
  this.state = ClientGameState.PLAYING;
```

**4. 性能注释**
```typescript
// 使用对象池避免频繁 instantiate，减少 GC 压力
// 微信小程序对内存敏感，卡牌节点必须复用
this.cardPool.get();
```

**不需要写**：框架 API 标准用法、显而易见的赋值和条件判断。

---

## 性能红线

- 小程序主包 <= 2MB
- 卡牌节点使用对象池，禁止裸 `instantiate` 不释放
- 卡牌/UI 合并图集减少 DrawCall

---

## 行为约束（Karpathy Rules）

1. **动手前先说假设** — 接口有歧义时问 PM，不猜
2. **最少代码** — 不造新框架，用 oops/FairyGUI 现有能力
3. **外科手术式改动** — 不顺手优化无关 Cocos 节点
4. **可验证目标** — 先有失败测试再写实现

---

## 测试规范

- 框架: Jest + TypeScript
- 位置: `client/assets/scripts/__tests__/`
- `PatternHelper` 只引用 `shared/PatternHelper.ts`，仅用于 UI 提示

---

## 常用命令

```
/tdd-gen      -> 写代码前生成测试
/tdd-coverage -> 写完后审查覆盖漏洞
/karpathy     -> 审查计划/diff
/review       -> 代码 review
```
