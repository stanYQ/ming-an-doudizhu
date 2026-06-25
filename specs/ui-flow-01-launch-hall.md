# Spec: UI Flow 01 — 启动页 + 主大厅

**任务 ID**: TASK-041  
**目标模块**: client  
**优先级**: P0  
**状态**: ready  
**前置依赖**: TASK-036 完成（协议全覆盖），`docs/UI-DESIGN.md`，`docs/FUNCTIONAL-DESIGN.md`  

---

## 执行流程

```
Step 0  oops Root 初始化（本任务独有，后续 TASK 复用）
        → 创建 resources/config.json（见「oops 初始化」章节）
        → 在 LaunchScene 根节点挂载 AppRoot.ts（继承 Root）
        → 确认 oops.res / oops.storage / oops.gui.toast 可用

Step 1  认领
        → 更新 .tasks/in-progress.md

Step 2  搭建节点树
        → 按本 spec「节点树」章节在 Cocos Creator 创建场景和节点
        → 先搭结构，纯色块占位，不需要美术资源

Step 3  挂载脚本
        → 按「脚本绑定」章节将已有 .ts 脚本挂到对应节点
        → 在编辑器 Inspector 填写公开属性引用

Step 4  实现动画
        → 按「动效」章节实现 Tween / Animation Clip
        → 先跑通逻辑，曲线和时长按 UI-DESIGN.md §8 标准

Step 5  接入脚本逻辑
        → 确认 LaunchView.ts 的加载流程能跳转到 HallScene
        → 确认 HallView.ts 的按钮事件能打开 MatchView

Step 6  /verify
        → 启动服务端（AI_FILL_DELAY=1 AUTH_MODE=stub）
        → 在 Cocos Preview 中跑完：启动 → 大厅 → 看到玩家信息
        → 对照 AC 逐条目视确认

Step 7  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除
```

---

## oops 初始化（TASK-041 独有前置，后续任务复用）

### resources/config.json

```json
{
  "localDataKey": "ddz",
  "localDataIv": "ddz_iv_2024",
  "bundleDefault": "common",
  "frameRate": 60,
  "stats": false,
  "mobileSafeArea": false,
  "gui": []
}
```

> `gui` 数组留空：项目采用多场景架构（LaunchScene→HallScene→GameScene），不使用 oops 单场景 LayerManager 层。`oops.gui.toast()` 是唯一用到的 gui 能力，通过 LayerNotify 单独初始化（见下方 AppRoot.ts）。

### client/assets/scripts/core/AppRoot.ts

```typescript
/**
 * @file AppRoot.ts
 * @description oops-framework 根组件，挂载在 LaunchScene 根节点，常驻整个游戏生命周期。
 * @module client/core
 */
import { _decorator, Node } from 'cc';
import { Root } from 'db://oops-framework/core/Root';

const { ccclass, property } = _decorator;

@ccclass('AppRoot')
export class AppRoot extends Root {
    // 挂在 LaunchScene Canvas 根节点
    // 在 CC 编辑器把本脚本拖到根节点，gui 属性留空（不使用 LayerManager 层）
}
```

**挂载说明**：
- LaunchScene → Canvas 根节点 → 挂 `AppRoot` 组件
- `@property gui` 留空（无 gui 节点）
- `director.addPersistRootNode` 由父类 Root 自动处理，组件跨场景常驻

### 使用方式

| 能力 | API | 可用时机 |
|------|-----|---------|
| 资源加载 | `oops.res.load(bundleName, path, Type)` | Root.onLoad 后 |
| 本地存储 | `oops.storage.get/set/getJson` | config.json 加载后 |
| Toast 提示 | `oops.gui.toast(msg)` | Root 初始化后（需 Notify 层） |
| 事件总线 | `message.on/off/dispatchEvent` | 随时（已直接 import） |

> **P0 简化**：`oops.gui.toast()` 依赖 LayerNotify，需要 gui 配置层。P0 阶段在 HallScene 继续使用手写 Toast（手动 Tween），待 Root gui 层配置后统一切换。`oops.res` 和 `oops.storage` 可在 Root loadConfig 完成后立即使用。

---

## 背景

来源：`docs/FUNCTIONAL-DESIGN.md` §二（玩家旅程）、§三（登录）、§五（大厅功能）。  
LaunchScene 是玩家接触游戏的第一个界面，目标是 < 5s 无感知完成 Stub 登录并进入大厅。  
HallScene 是玩家的决策枢纽，必须在 30 秒内让玩家理解能做什么。

---

## 验收标准

### LaunchScene

- AC-1: 进入 App 显示游戏 Logo（「明暗斗地主」文字）+ 全屏背景图（可用纯色占位）
- AC-2: 底部进度条从 0% 动态增长到 100%（模拟加载，1–3s）
- AC-3: 进度条下方显示「加载中… XX%」文字，百分比与进度条同步
- AC-4: 加载完成后自动跳转 HallScene，无需用户操作
- AC-5: 跳转前完成 Stub 登录（调用 `/auth/login`），拿到 JWT 缓存到本地

### HallScene — 顶部栏

- AC-6: 顶部栏显示玩家头像（圆形占位图）+ 昵称 + 积分（金色）+ 段位图标
- AC-7: 昵称来自服务端登录响应（P0 格式：「神秘玩家 XXXX」）
- AC-8: 积分来自服务端玩家数据（初始 1000）

### HallScene — 主操作区

- AC-9: 页面中央有「快速匹配」按钮（W360×H80，绿色）和「好友房」按钮（W360×H80，描边）
- AC-10: 点击「快速匹配」打开 MatchView（快速匹配模式）
- AC-11: 点击「好友房」打开 MatchView（好友房模式）
- AC-12: 网络不可达时两个按钮禁用，顶部显示「网络已断开」红色横幅

### HallScene — 功能宫格

- AC-13: 展示 4 个宫格（签到 / 活动 / 排行榜 / 规则）
- AC-14: 「游戏规则」点击后跳转规则说明页（静态 ScrollView + Label）
- AC-15: 其余 3 个宫格点击后显示 Toast「功能即将上线」，按钮灰色 opacity 40%

---

## 节点树

### LaunchScene

```
LaunchScene (Scene)
└── Canvas (Canvas, W1280×H720)
    ├── Background (Sprite)                    W1600×H720，锚点居中，bg_hall 纯色占位 #0D1F15
    ├── Logo (Label)                           「明暗斗地主」32px Bold gold，居中 y=200
    ├── ProgressBarBg (Sprite)                 W400×H8，底部居中 y=80，深灰色
    │   └── ProgressBarFill (Sprite)           W=0→400 Tween，金色 #D4A843，锚点左对齐
    ├── ProgressLabel (Label)                  「加载中… 0%」14px text-secondary，y=60
    └── LaunchController (Node, 空节点)
        └── [脚本: LaunchView.ts]
```

**LaunchView.ts 已有逻辑**（不改脚本，仅确认节点引用正确）:
- `progressBar`: 引用 `ProgressBarFill`
- `progressLabel`: 引用 `ProgressLabel`
- `onLoadComplete` → `director.loadScene('HallScene')`

---

### HallScene

```
HallScene (Scene)
└── Canvas (Canvas, W1280×H720)
    ├── Background (Sprite)                    W1600×H720，bg_hall 占位
    │
    ├── TopBar (Node, W1280×H72, y=684)
    │   ├── AvatarFrame (Sprite W64×H64)       圆形 mask，头像占位
    │   │   └── Avatar (Sprite W60×H60)
    │   ├── PlayerInfo (Node)
    │   │   ├── NicknameLabel (Label 16px)
    │   │   └── ScoreLabel (Label 14px gold)   「积分: 1000」
    │   ├── RankBadge (Node)
    │   │   ├── RankIcon (Sprite W32×H32)      段位图标占位
    │   │   └── RankLabel (Label 12px)
    │   ├── SettingsBtn (Button W44×H44)        右上
    │   └── SoundBtn (Button W44×H44)           右上次位
    │
    ├── MainVisual (Sprite)                    W800×H280，中央，牌桌渲染占位
    │
    ├── FeatureGrid (Node, y=328)              4宫格容器 HorizontalLayout
    │   ├── BtnCheckin (Button W240×H80)       签到，灰色 opacity=0.4
    │   ├── BtnActivity (Button W240×H80)      活动，灰色 opacity=0.4
    │   ├── BtnRanking (Button W240×H80)       排行榜，灰色 opacity=0.4
    │   └── BtnRules (Button W240×H80)         规则，正常可点
    │
    ├── ActionArea (Node, y=160)               主操作按钮容器 HorizontalLayout 间距24
    │   ├── BtnQuickMatch (Button W360×H80)    绿色渐变
    │   └── BtnFriendRoom (Button W360×H80)    描边风格
    │
    ├── MatchView (Node, W1280×H720)           默认隐藏 active=false
    │   └── [见 ui-flow-02-match-wait.md]
    │
    ├── RulesView (Node, W1280×H720)           默认隐藏 active=false
    │   ├── Overlay (Sprite W1280×H720 opacity=0.8)
    │   ├── Panel (Sprite W800×H560 圆角16)
    │   │   ├── Title (Label「游戏规则」22px)
    │   │   ├── CloseBtn (Button W44×H44)
    │   │   └── ContentScroll (ScrollView W760×H460)
    │   │       └── ContentLabel (Label 14px，GAME-RULES.md 摘要文本)
    │   └── [点击 Overlay 关闭]
    │
    ├── Toast (Node)                           [见 Toast Prefab]
    └── NetworkBanner (Node, W1280×H40, y=700) 默认隐藏，红色横幅
        └── BannerLabel (Label「网络已断开，尝试重连…」14px)
```

---

## 脚本绑定

| 节点 | 脚本 | 关键属性填写 |
|------|------|------------|
| `LaunchScene/Canvas/LaunchController` | `LaunchView.ts` | progressBarFill → ProgressBarFill; progressLabel → ProgressLabel |
| `HallScene/Canvas` | `HallView.ts` | quickMatchBtn → BtnQuickMatch; friendRoomBtn → BtnFriendRoom; matchView → MatchView; nicknameLabel → NicknameLabel; scoreLabel → ScoreLabel; rankIcon → RankIcon |

**HallView.ts 已有逻辑**（确认引用正确）:
- `onQuickMatchClick` → `matchView.showQuickMatch()`
- `onFriendRoomClick` → `matchView.showFriendRoom()`
- `onRulesClick` → `rulesView.active = true`
- `onFeatureGridClick`（其余3个）→ Toast「功能即将上线」

---

## 动效

### LaunchScene 进度条 + oops 资源预加载

```typescript
// LaunchView.ts — onLoad
// 使用 oops.res.loadBundle 预加载分包，进度驱动进度条（真实加载）
async onLoad() {
  // 先加载 hall 分包（进入大厅前必须完成）
  await oops.res.loadBundle('hall');
  this._runProgress();
}

private _runProgress() {
  // 预加载 game 分包（后台进行，不阻塞进度条）
  oops.res.loadBundle('game');

  // 模拟进度（hall 已完成 → game 后台加载中）
  let progress = 0;
  const timer = setInterval(() => {
    progress += Math.random() * 12 + 3;
    if (progress >= 100) { progress = 100; clearInterval(timer); this.onLoadComplete(); }
    tween(this.progressBarFill)
      .to(0.08, { contentSize: new Size(progress / 100 * 400, 8) })
      .start();
    this.progressLabel.string = `加载中… ${Math.floor(progress)}%`;
  }, 120);
}

private async onLoadComplete() {
  // Stub 登录
  await this._stubLogin();
  director.loadScene('HallScene');
}

private async _stubLogin() {
  // 如果 oops.storage 已初始化（Root config.json 加载完毕），用 oops.storage
  const stored = oops.storage?.get('ddz_token');
  if (stored) return;

  const res = await fetch('/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'stub' }) });
  const { token, user } = await res.json();
  oops.storage?.set('ddz_token', token);
  oops.storage?.set('ddz_user', user);
}
```

### HallScene — 本地存储读取（oops.storage）

```typescript
// HallSceneManager.ts — onLoad
// 用 oops.storage 替代 sys.localStorage（自动 JSON parse + 加密）
const info = oops.storage?.getJson('ddz_user', null);
hallView.show(info);

// 旧写法（移除）：
// const raw = sys.localStorage.getItem(CACHE_KEY_USER);
// const info = raw ? JSON.parse(raw) : null;
```

### HallScene Toast（P0 过渡方案）

```typescript
// P0：oops.gui.toast 需要 LayerNotify 层配置，暂用手写 Toast
// P1 升级：配置 gui 层后改为 oops.gui.toast('功能即将上线')
showToast(msg: string, duration = 2000) {
  this.toastLabel.string = msg;
  this.toast.active = true;
  tween(this.toast).to(0.15, { opacity: 255 })
    .delay(duration / 1000)
    .to(0.15, { opacity: 0 })
    .call(() => { this.toast.active = false; })
    .start();
}
```

---

## 约束

- 进度条为模拟加载（P0 无真实资源预加载），< 3s 完成
- RulesView 内容为静态文本，直接硬编码 GAME-RULES.md 摘要，不从服务端读取
- 头像 P0 使用纯色圆形占位（8色随机），不接入微信头像
- 背景图 P0 用纯色 `#0D1F15` 占位，资源到位后替换 Sprite

## 不在范围内

- 真实微信登录（P1）
- 签到、活动、排行榜功能实现（P1）
- 背景音乐、音效
- 设置页面实现
