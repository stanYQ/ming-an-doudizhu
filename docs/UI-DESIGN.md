# 明暗斗地主 — 核心 UI 设计文档 v1.0

**文档类型**: 产品设计 + 视觉规范 + Prefab 架构  
**目标平台**: 微信小程序（主）/ H5（次）  
**基准分辨率**: 1280 × 720 横屏锁定  
**状态**: v1.0 — 视觉搭建阶段基准版本  
**日期**: 2026-06-25  

---

## 一、竞品参考与差异化定位

### 1.1 主流棋牌大厅模式参考

| 产品 | 大厅核心布局 | 活动入口 | 特色 |
|------|------------|---------|------|
| JJ斗地主 | 顶部段位+积分 / 中央模式选择 / 底部导航栏 | 底部 Tab「活动」| 段位体系突出，排行榜社交 |
| 欢乐斗地主 | 顶部头像金币 / 中央三模式大按钮 / 侧边功能宫格 | 浮动红点徽章 | 商城突出，多货币体系 |
| 天天斗地主 | 横幅轮播活动 / 中央快速开局 / 底部四 Tab | 顶部轮播 Banner | 活动驱动，日历签到显眼 |
| 网易斗地主 | 好友列表侧拉 / 中央对战入口 / 顶部公告 | 独立活动页 | 社交属性重，邀请机制 |

### 1.2 本游戏差异化

**明暗斗地主** = 5人 × 隐藏身份 × 暗号机制。视觉语言应强化「神秘感 + 对抗感」：

- **主题**: 暗夜牌桌，中式暗调，金色描边（有别于欢乐斗地主的明亮卡通风）
- **大厅**: 功能精简（Demo 阶段），突出「快速开局」，不做复杂商城/活动系统
- **差异卖点**: 「暗号」机制在大厅入口处做视觉强调（席位身份神秘感）
- **P0 原则**: 大厅克制，核心功能可达，活动区预留占位不实现

---

## 二、信息架构

### 2.1 页面层级

```
App
├── LaunchScene（启动页）
│   └── 资源加载 + Stub 登录 → 自动跳转
│
├── HallScene（主大厅）
│   ├── 顶部栏：头像 / 昵称 / 积分 / 段位
│   ├── 主操作区：快速匹配 / 好友房
│   ├── 功能宫格：排行榜 / 规则说明 / 设置（预留）
│   ├── 活动入口：签到占位 / 限时活动占位（P1 实现）
│   └── MatchView 弹层
│       ├── 快速匹配等待室
│       └── 好友房等待室
│
└── GameScene（游戏桌）
    ├── 桌布背景 + 5席位
    ├── HandCardView（本人手牌）
    ├── PlayZone（出牌区 + 操作按钮）
    ├── CodeCardSelector（暗号牌弹窗，仅地主）
    ├── DoublingView（加倍面板）
    └── SettlementView（结算界面）
```

### 2.2 大厅功能分布优先级

| 优先级 | 功能 | P0 实现 |
|--------|------|---------|
| 核心 | 快速匹配、好友房 | ✅ |
| 次要 | 玩家信息（头像/积分/段位）| ✅ 占位 |
| 预留 | 排行榜、规则说明、设置 | 入口占位，点击无反应 |
| 远期 | 签到、商城、活动、成就 | 视觉占位，不实现 |

---

## 三、设计系统

### 3.1 颜色 Token

```
── 背景 ──────────────────────────────────────────────
bg-table:        #0F2318   // 游戏桌绒面深绿
bg-hall:         #0D1F15   // 大厅背景更深
bg-card:         #FFFFFF   // 卡牌白底
bg-overlay:      rgba(0,0,0,0.75)  // 弹窗遮罩

── 主色 ──────────────────────────────────────────────
primary-gold:    #D4A843   // 金色（按钮主色/标题/描边）
primary-green:   #1A6B3A   // 按钮主绿（快速匹配）
border-brown:    #4A2C1A   // 边框深褐

── 语义色 ────────────────────────────────────────────
success:         #27AE60   // 成功/加分/绿色
danger:          #C0392B   // 错误/减分/炸弹
warning:         #E67E22   // 警告/倒计时紧张
info:            #5B8DEF   // 提示/蓝色高亮（hint推荐牌）

── 文字 ──────────────────────────────────────────────
text-primary:    #FFFFFF   // 主文字
text-secondary:  #B0B8C1   // 次要文字（灰白）
text-gold:       #D4A843   // 金色文字（积分/关键数字）
text-disabled:   #5A6478   // 禁用态文字

── 身份色 ────────────────────────────────────────────
role-landlord:   #D4A843   // 地主（金色）
role-partner:    #E07B39   // 搭档（橙色）
role-civilian:   #B0B8C1   // 平民（灰色）
```

### 3.2 字体规格

| 用途 | 字号 | 字重 | 颜色 |
|------|------|------|------|
| 大标题（胜负横幅）| 32px | Bold | primary-gold |
| 页面标题 | 22px | Bold | text-primary |
| 按钮文字 | 20px | Bold | text-primary |
| 正文 | 16px | Regular | text-primary |
| 辅助信息 | 14px | Regular | text-secondary |
| 小标注 | 12px | Regular | text-secondary |
| 数字（积分/倒计时）| 等宽字体 | Bold | text-gold |

### 3.3 间距 & 圆角系统

```
间距基准: 8px
  xs:  4px    sm:  8px    md: 16px    lg: 24px    xl: 40px

圆角:
  btn-sm:   8px     // 小按钮
  btn-md:   12px    // 标准按钮
  btn-lg:   16px    // 大按钮
  card:     6px     // 卡牌
  panel:    16px    // 弹窗面板
  avatar:   50%     // 圆形头像
```

### 3.4 按钮规格

| 类型 | 尺寸 | 背景 | 说明 |
|------|------|------|------|
| 主操作（快速匹配）| W360×H80 | 主绿渐变 | 大厅核心CTA |
| 次操作（好友房）| W360×H80 | 深色描边 | 同级次要 |
| 游戏操作（出牌）| W120×H48 | primary-gold | 游戏桌操作 |
| 游戏操作（不要/提示）| W120×H48 | 描边 | 游戏桌次操作 |
| 弹窗确认 | W200×H48 | primary-gold | 弹窗主操作 |
| 弹窗取消 | W200×H48 | 描边 | 弹窗次操作 |
| 禁用态 | 同上 | 同上 opacity 40% | 不可点击 |

---

## 四、大厅设计（HallScene）

### 4.1 布局结构

```
┌────────────────────────────────────────────────────────────┐ y=720
│  [头像圆W60]  昵称 16px             [设置⚙] [音效🔊]      │ H=72 顶部栏
│              积分: XXXX (金色)  [段位图标+文字]            │
├────────────────────────────────────────────────────────────┤ y=648
│                                                            │
│         ┌──────────────────────────────────┐              │
│         │   主视觉区：牌桌俯视渲染图          │              │ H=320 中央区
│         │   （1280×320，模糊边缘过渡）       │              │
│         │                                  │              │
│         │   [「明暗斗地主」Logo 金色字]      │              │
│         └──────────────────────────────────┘              │
│                                                            │
├────────────────────────────────────────────────────────────┤ y=328
│  [签到🎁占位]  [活动🎪占位]  [排行榜🏆占位]  [规则📖占位]  │ H=88 功能宫格
│  （灰色，点击无响应，红点徽章预留）                          │
├────────────────────────────────────────────────────────────┤ y=240
│            ┌──────────────┐  ┌──────────────┐             │
│            │  快速匹配     │  │    好友房      │             │ H=120 主操作区
│            │ W360×H80     │  │  W360×H80    │             │
│            │ 最快30秒开局  │  │  与好友同桌   │             │
│            └──────────────┘  └──────────────┘             │
├────────────────────────────────────────────────────────────┤ y=120
│         版本号 v0.1 (demo)        [公告滚动条]             │ H=40 底栏
└────────────────────────────────────────────────────────────┘ y=0
```

### 4.2 功能宫格设计（P0 占位）

4个宫格等宽排列，间距 16px，每格 W240×H80：

| 宫格 | 图标 | 文字 | P0 状态 |
|------|------|------|---------|
| 签到 | 礼盒图标 | 「每日签到」| 灰色占位，不可点 |
| 活动 | 旗帜图标 | 「限时活动」| 灰色占位，不可点 |
| 排行榜 | 奖杯图标 | 「排行榜」| 灰色占位，不可点 |
| 规则 | 书本图标 | 「游戏规则」| 灰色占位，不可点 |

> P1 阶段：签到和规则先实现（成本低），活动和排行榜仍占位。

---

## 五、匹配等待（MatchView）

### 5.1 快速匹配等待室

弹层覆盖大厅，蒙层 opacity 75%，弹窗 W640×H400 居中：

```
┌─────────────────────────────────┐
│         快速匹配              ×  │  ← 标题行 + 关闭按钮
├─────────────────────────────────┤
│                                 │
│      ● ● ●  (跳动动画)          │  ← 等待动画区
│    X / 5 人已加入               │  ← 24px 金色加粗
│    XX 秒后 AI 补位              │  ← 14px 灰白（满员隐藏）
│                                 │
│  [席位进度条：5格，已有人亮起]   │  ← 可选：5格进度显示
│                                 │
│        [取消匹配 W200×H48]      │
└─────────────────────────────────┘
```

### 5.2 好友房等待室

```
┌─────────────────────────────────┐
│         好友房               ×  │
├─────────────────────────────────┤
│   房间码: 123456  [复制]         │  ← 32px 金色
│                                 │
│  ┌──────────────────────────┐   │
│  │ ● 玩家A（房主★）         │   │  ← 席位列表
│  │ ● 玩家B                  │   │    每行 H48，头像W36+昵称
│  │ ○ 等待加入...            │   │    空席灰色
│  │ ○ 等待加入...            │   │
│  │ ○ 等待加入...            │   │
│  └──────────────────────────┘   │
│                                 │
│  [分享给好友]  [开始游戏(房主)]  │
└─────────────────────────────────┘
```

---

## 六、游戏桌设计（GameScene）

### 6.1 整体布局

```
┌────────────────────────────────────────────────────────────┐ y=720
│ [返回大厅X]           [剩余牌数 108]         [设置⚙]       │ H=48 游戏顶栏
├────────────────────────────────────────────────────────────┤ y=672
│                                                            │
│      [席位2 W120×H120]              [席位3 W120×H120]      │ y=550~672
│      左前方                          右前方                 │
│                                                            │
│  [席位1]        ┌────────────────────┐        [席位4]      │ y=350~500
│  W120×H120      │    PlayZone         │        W120×H120   │
│  左侧中          │    W480×H200        │        右侧中       │
│                 │    上家出牌展示      │                    │
│                 │    [出牌者: XX出了]  │                    │
│                 └────────────────────┘                    │
│                                                            │
│                  [席位0 本人 居中]                          │ y=240~360
│                  W120×H120                                 │
│                                                            │
├────────────────────────────────────────────────────────────┤ y=220
│  ┌──────────────────────────────────────────────────────┐  │
│  │              HandCardView  H=140                     │  │ y=80~220
│  │  牌牌牌牌牌牌牌牌牌牌牌牌牌牌牌牌牌（横排/可滑动）    │  │
│  └──────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤ y=80
│     [牌型提示文字 14px]                                     │ H=28
│         [出牌 W120×H48]  [不要 W120×H48]  [提示 W120×H48]  │ H=52 操作按钮行
└────────────────────────────────────────────────────────────┘ y=0
```

### 6.2 席位布局（5人椭圆桌）

椭圆桌中心点: (640, 380)

| 席位 | 含义 | 坐标 (x, y) | 特殊 |
|------|------|------------|------|
| 席位0 | 本人 | (640, 300) | 底部居中，手牌在下方 |
| 席位1 | 左侧 | (160, 420) | 左侧中 |
| 席位2 | 左前 | (280, 600) | 左上 |
| 席位3 | 右前 | (1000, 600) | 右上 |
| 席位4 | 右侧 | (1120, 420) | 右侧中 |

---

## 七、组件规格

### 7.1 PlayerSeat — 玩家席位

**节点尺寸**: W120×H140（含所有子元素垂直排列）

```
PlayerSeat (Node W120×H140)
├── AvatarFrame (Sprite W64×H64, 圆形 mask)
│   ├── Avatar (Sprite W60×H60，头像图)
│   └── TurnRing (圆环动画，当前玩家可见)
├── NameLabel (Label 12px, 最多6字截断, text-primary)
├── CardCountLabel (Label 12px, 「剩X张」, text-secondary)
├── RoleBadge (Node，收到identity_reveal后显示)
│   └── RoleLabel (Label 12px bold, 颜色按阵营)
├── AIBadge (Label 「AI」12px, text-secondary, isAI时可见)
├── FinishBadge (Sprite「出完」badge, 手牌=0时可见)
└── PassBubble (Label「不要」, 500ms显示后隐藏)
```

**计时圆环**: 当前出牌者可见，Tween驱动 stroke-dashoffset 从0→100%，30s，颜色 > 15s 绿色，10-15s 黄色，< 10s 红色。

### 7.2 CardItem — 单张卡牌 Prefab

**节点尺寸**: W52×H78，圆角6

```
CardItem (Node W52×H78)
├── CardBg (Sprite，白色圆角背景)
├── RankLabel (Label，点数，左上角，14px Bold)
├── SuitLabel (Label，花色符号，左上角RankLabel下，12px)
├── CenterRank (Label，大点数居中，20px Bold)
├── SuitIcon (Sprite，花色图标居中，W24×H24)
└── SelectOverlay (Sprite，选中金色描边+向上偏移16px)
```

**特殊牌**:
- 大王: CardBg 红色底 `#8B0000`，CenterRank「大王」金色
- 小王: CardBg 深蓝底 `#1A237E`，CenterRank「小王」白色

**颜色规则**:
- ♠ ♣：text-primary（黑色）
- ♥ ♦：danger（红色 #C0392B）

### 7.3 HandCardView — 手牌区

**节点**: W1200×H140，底部居中，支持横向 ScrollView（牌多时滑动）

**排列**: 卡牌按 compareValue 升序，左小右大；重叠排列时间距 40px（最多24张时缩减至28px）

**选中态**: 
- 单击选中 → 卡牌 y 偏移 +20px，添加金色描边
- 再次点击取消
- 滑动触发 → TouchMove 事件检测经过的卡牌节点

**牌型提示区**: HandCardView 上方 H28，Label 居中：
- 合法: 「单张 / 对子 / 顺子…」text-gold
- 非法: 「请选择合法牌型」danger，2s 后清空
- 空: 隐藏

**底牌展示**: landlord_select 阶段，在手牌上方额外一行展示3张底牌，带「底牌」Label标注，2s 后融入手牌。

### 7.4 PlayZone — 出牌区

**节点**: W480×H200，游戏桌中央

```
PlayZone (Node W480×H200)
├── BgPanel (Sprite，深色半透明圆角面板)
├── PlayerNameLabel (Label，「XX出了:」12px text-secondary)
├── LastPlayContainer (Node，上家出牌横排展示)
│   └── CardItem × N (动态生成，W44×H66 缩小版)
└── PassLabel (Label，「不要」各席位气泡，500ms)
```

**状态**:
- 有上家出牌: 显示牌组 + 玩家名
- 自由轮（isNewRound）: LastPlayContainer 清空，PlayerNameLabel 显示「自由出牌」
- 他人 pass: 对应席位出现「不要」气泡 500ms

### 7.5 CodeCardSelector — 暗号牌弹窗

**节点**: W640×H420，居中弹出，backdrop W1280×H720 opacity 70%

```
CodeCardSelector (Node W640×H420)
├── PanelBg (Sprite，深色背景，圆角16，金色描边2px)
├── TitleLabel (「选择暗号牌」22px gold)
├── HintLabel (「选一张3-10点的牌…」14px text-secondary)
├── CardGrid (GridLayout 4列×8行，间距4px)
│   └── SuitCardItem × 32 (♠♥♦♣ × 3~10，W60×H48)
├── ConfirmBtn (W200×H48，gold，「确认」，未选中时disabled)
└── SelectedDisplay (选中预览：花色+点数，12px)
```

**SuitCardItem** (W60×H48):
- 未选: 白底，♠♣ 黑，♥♦ 红
- 选中: 金色底 + 描边2px
- 点击触发选中状态切换（单选）

### 7.6 DoublingView — 加倍面板

**节点**: W480×H260，顶部居中，y=380（覆盖出牌区上方）

```
DoublingView (Node W480×H260)
├── PanelBg (Sprite，深色半透明，圆角12，描边1px gold)
├── TitleLabel (「加倍选择」18px gold)
├── CountdownLabel (「剩余 XX 秒」16px，>10s white，≤10s danger)
├── StatusLabel (「等待地主选择…」/「选择加倍倍数」14px text-secondary)
├── BtnRow (HorizontalLayout，间距16px)
│   ├── Btn1x (W160×H56，描边风格，「×1 不加倍」)
│   └── Btn2x (W160×H56，gold背景，「×2 加倍！」)
└── ResultList (Node，所有人提交后显示，逐行，1.5s后自动关闭)
    └── ResultItem × 5 (Label，「席位X: ×1/×2」12px)
```

### 7.7 SettlementView — 结算界面

**节点**: W1280×H720，全屏遮罩，z-order 最高

```
SettlementView (Node W1280×H720)
├── Overlay (Sprite W1280×H720，深色渐变，opacity 90%)
├── ResultBanner (Label，「平民阵营胜利！」32px Bold，顶部居中 y=620)
├── PlayerCards (HorizontalLayout，5张卡片，y=420)
│   └── PlayerResultCard × 5 (W160×H200，详见下方)
├── MultiplierDetail (Node，倍率明细区，y=300)
│   └── DetailLabels (底分/地主倍/玩家倍/炸弹/春天)
├── RematchProgress (Label，「X/Y人同意再来一局」，好友房显示)
├── Countdown (Label，「XX秒后房间关闭」12px text-secondary)
├── RematchBtn (W240×H56，gold，「再来一局」，y=100)
└── BackHallBtn (W240×H56，描边，「返回大厅」，y=40)
```

**PlayerResultCard** (W160×H200):
```
PlayerResultCard
├── CardBg (Sprite，深色，圆角12，输者灰色描边，赢者金色描边)
├── Avatar (W56×H56 圆形)
├── NameLabel (14px，最多6字)
├── RoleBadge (「地主」gold / 「搭档」orange / 无标签)
├── ScoreLabel (「+123」success / 「-123」danger，24px Bold)
└── IdentityRevealAnim (淡入动画，收到identity_reveal触发)
```

---

## 八、动效系统

### 8.1 动画总表

| 动画名 | 触发时机 | 时长 | 缓动 | 实现方式 |
|--------|---------|------|------|---------|
| `deal-slide-in` | 发牌（your_hand）| 200ms/张，错开50ms | ease-out | Tween position |
| `card-fly-out` | 出牌（play_cards 确认）| 150ms | ease-in | Tween position + scale |
| `card-select-up` | 手牌选中 | 80ms | ease-out | Tween position y+20 |
| `card-deselect` | 取消选中 | 80ms | ease-in | Tween position y-20 |
| `turn-ring` | 轮到当前玩家 | 30000ms | linear | Tween stroke / ProgressBar |
| `hint-blink` | 收到 hint | 2次闪烁，各200ms | linear | Tween opacity 1→0.3→1 |
| `pass-bubble` | 他人 pass | 500ms 显示后淡出 | ease-out | Tween opacity |
| `identity-reveal` | identity_reveal 消息 | 1500ms | ease-in-out | Animation Clip |
| `settlement-in` | game_over | 遮罩200ms → 横幅300ms → 卡片依次50ms | ease-out | Tween sequence |
| `doubling-result` | 所有人提交加倍 | 1500ms 后自动关闭 | ease-in | Tween opacity |
| `bottom-cards-show` | landlord_select 地主 | 2s 展示后融入手牌 | ease-in-out | Tween sequence |
| `match-dots` | 匹配等待 | 循环，各点错开200ms | sine | Tween position y ±8 |

### 8.2 关键动画详细设计

#### 发牌动画 `deal-slide-in`
```
初始状态: 每张牌从屏幕底部外（y=-80）透明度0
目标状态: 各自目标位置，opacity=1
时长: 每张 200ms，按索引错开 50ms（最后一张约 200+21×50=1250ms）
缓动: easeOut（先快后慢，有「飞入」感）
顺序: 按牌索引0→20依次触发
```

#### 结算入场 `settlement-in`
```
1. 遮罩 Overlay: opacity 0→0.9，200ms ease-out
2. 横幅 ResultBanner: y=800→620，opacity 0→1，300ms ease-out（延迟100ms）
3. 玩家卡片 PlayerResultCard: scale 0→1，opacity 0→1，各延迟 50ms
   i=0: 延迟400ms，i=1: 450ms，…，i=4: 600ms，各100ms ease-out
```

#### 身份揭晓 `identity-reveal`
```
1. 全屏遮罩淡入 200ms
2. 「身份揭晓」大字从中央缩放弹出（scale 0→1.2→1，400ms）
3. 对应席位 RoleBadge 闪光出现（Sprite flash，200ms）
4. 遮罩淡出 300ms（总 1100ms）
不阻塞手牌区和计时器
```

---

## 九、Prefab 架构

### 9.1 Prefab 清单

| Prefab 文件 | 路径 | 复用场景 |
|------------|------|---------|
| `CardItem.prefab` | `assets/bundle/game/prefabs/` | HandCardView、PlayZone、CodeCardSelector |
| `PlayerSeat.prefab` | `assets/bundle/game/prefabs/` | GameScene × 5 |
| `SuitCardItem.prefab` | `assets/bundle/game/prefabs/` | CodeCardSelector × 32 |
| `PlayerResultCard.prefab` | `assets/bundle/game/prefabs/` | SettlementView × 5 |
| `SeatItem.prefab` | `assets/bundle/hall/prefabs/` | MatchView 好友房席位列表 × 5 |
| `Toast.prefab` | `assets/bundle/common/prefabs/` | 全局 Toast 提示 |

### 9.2 Bundle 分包策略

```
assets/bundle/
├── common/         ← 公共资源，主包加载
│   ├── fonts/      ← 系统字体 fallback
│   ├── prefabs/    ← Toast、LoadingMask
│   └── textures/   ← 通用图标（金币、段位）
│
├── hall/           ← 大厅分包，进入大厅时加载
│   ├── prefabs/    ← SeatItem
│   └── textures/   ← 大厅背景、按钮、头像占位
│
└── game/           ← 游戏分包，进入房间时加载
    ├── prefabs/    ← CardItem、PlayerSeat、PlayerResultCard、SuitCardItem
    ├── textures/   ← 卡牌图集（cards.atlas）、游戏UI图集（game-ui.atlas）
    └── animations/ ← identity-reveal.anim、settlement-in.anim
```

**体积控制**（微信小程序 ≤ 2MB 主包）:
- 主包 common 只含必要代码和极少资源
- 卡牌图集合并为单张 Atlas（1024×1024，WebP），约 180KB
- 游戏UI图集合并（512×512，WebP），约 60KB

### 9.3 脚本绑定规范

| 节点名 | 挂载脚本 | 关键公开属性 |
|--------|---------|------------|
| `GameScene/GameController` | `GameController.ts` | handCardView, playZone, playerSeats[5], codeCardSelector, doublingView, settlementView, netManager |
| `GameScene/HandCardView` | `HandCardView.ts` | cardItemPrefab, cardPool |
| `GameScene/PlayZone` | `PlayZone.ts` | lastPlayContainer, passBubblePrefab |
| `GameScene/PlayerSeat_N` | `PlayerSeat.ts` | avatarSprite, nameLabel, cardCountLabel, roleBadge, turnRing |
| `GameScene/CodeCardSelector` | `CodeCardSelector.ts` | gridContainer, confirmBtn, suitCardPrefab |
| `GameScene/DoublingView` | `DoublingView.ts` | countdownLabel, btn1x, btn2x, resultList |
| `GameScene/SettlementView` | `SettlementView.ts` | resultBanner, playerCards[5], rematchBtn, backHallBtn |
| `HallScene/HallController` | `HallView.ts` | quickMatchBtn, friendRoomBtn, matchView |
| `HallScene/MatchView` | `MatchView.ts` | readyCountLabel, countdownLabel, seatList |

---

## 十、资源清单

### 10.1 需要切图的 Sprite

| 资源名 | 尺寸 | 格式 | 说明 |
|--------|------|------|------|
| `bg_hall` | 1600×720 | WebP | 大厅背景（含延伸区） |
| `bg_table` | 1600×720 | WebP | 游戏桌绒面背景 |
| `logo_title` | 480×120 | WebP/PNG | 「明暗斗地主」书法字Logo |
| `avatar_default` | 120×120 | PNG | 默认头像占位 |
| `icon_settings` | 48×48 | PNG | 设置图标 |
| `icon_sound` | 48×48 | PNG | 音效图标 |
| `icon_checkin` | 80×80 | PNG | 签到宫格图标 |
| `icon_activity` | 80×80 | PNG | 活动宫格图标 |
| `icon_ranking` | 80×80 | PNG | 排行榜宫格图标 |
| `icon_rules` | 80×80 | PNG | 规则宫格图标 |
| `badge_landlord` | 80×32 | PNG | 「地主」金色标签 |
| `badge_partner` | 80×32 | PNG | 「搭档」橙色标签 |
| `badge_ai` | 48×24 | PNG | 「AI」灰色标签 |
| `badge_finish` | 60×24 | PNG | 「出完」绿色标签 |
| `card_back` | 52×78 | WebP | 牌背（统一深色花纹）|
| `turn_ring` | 80×80 | PNG | 计时圆环底图 |
| `rank_bronze`~`rank_diamond` | 60×60 | PNG | 段位图标×5 |

### 10.2 图集分组

**cards.atlas**（1024×1024）:
- 全部 54 种正面牌图（含2副牌用同一图集）
- 1张牌背
- 预估 180KB WebP

**game-ui.atlas**（512×512）:
- 游戏桌内所有小图标（段位、角色标签、按钮图标）
- 预估 60KB WebP

**hall-ui.atlas**（512×512）:
- 大厅图标、按钮背景切图
- 预估 80KB WebP

---

## 十一、P0 范围界定

**本阶段实现（视觉搭建阶段）**:
- [ ] LaunchScene：Logo + 进度条 + 自动跳转
- [ ] HallScene：顶部栏 + 主操作按钮 + 功能宫格（占位）
- [ ] MatchView：快速匹配等待室 + 好友房等待室
- [ ] GameScene：完整节点树装配 + 5个席位
- [ ] HandCardView：手牌渲染 + 选牌交互
- [ ] PlayZone：上家出牌展示 + 操作按钮
- [ ] CodeCardSelector：暗号牌弹窗
- [ ] DoublingView：加倍面板
- [ ] SettlementView：结算界面

**占位不实现**:
- 签到、活动、商城、排行榜（入口灰显）
- 真实头像（使用 `avatar_default` 占位）
- 音效背景音乐
- 震动反馈

**视觉资源策略**:
- P0 阶段使用纯色块 + 文字占位（不阻塞开发）
- 图集资源由设计师产出后直接替换 Sprite，不改代码

---

## 十二、下一步

1. **视觉资源**: 按第十章清单输出切图 + 图集（可与开发并行）
2. **Spec 写作**: 按游戏流程出5份 Spec（见文档二级目录）
3. **Client-Dev**: 按 Spec 在 Cocos Creator 搭建节点树 + 挂载脚本 + 对接动画
