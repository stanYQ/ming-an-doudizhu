# Spec: UI Flow 03 — 游戏桌装配 + 发牌 + 暗号牌选择

**任务 ID**: TASK-043  
**目标模块**: client  
**优先级**: P0  
**状态**: ready  
**前置依赖**: TASK-042 完成（MatchView 可跳转 GameScene）  

---

## 执行流程

```
Step 1  认领 → 更新 .tasks/in-progress.md

Step 2  搭建 GameScene 节点树骨架
        → Canvas → Background → 5个 PlayerSeat → PlayZone → HandCardView → 操作按钮行
        → 先纯色块占位，确认布局坐标正确

Step 3  实现 CardItem Prefab
        → 单张卡牌节点 + 正反面 + 选中态

Step 4  实现 PlayerSeat Prefab
        → 头像 + 昵称 + 手牌数 + 计时圆环 + 身份标签

Step 5  实现 HandCardView
        → 接收 your_hand 消息 → 渲染手牌 → 选牌交互

Step 6  实现 CodeCardSelector 弹窗
        → 4列×8行 SuitCardItem 网格 + 确认按钮

Step 7  接入脚本对接
        → GameController.ts 节点引用全部填写
        → 确认 your_hand / bottom_cards / landlord_select 消息路由正确

Step 8  /verify
        → 启动服务端，从大厅进入游戏桌
        → 观察发牌动画、手牌显示、地主暗号牌弹窗
        → 对照 AC 逐条目视确认

Step 9  完成 → 更新 .tasks/done.md
```

---

## 背景

来源：`docs/UI-DESIGN.md` §六（游戏桌）、§七（组件规格）、`docs/FUNCTIONAL-DESIGN.md` §七（游戏内功能）。  
本 Spec 覆盖游戏桌的静态装配和发牌阶段，是所有游戏体验的基础节点树。  
出牌阶段交互见 TASK-044，结算界面见 TASK-045。

---

## 验收标准

### GameScene 布局

- AC-1: 5个玩家席位按椭圆桌布局正确排列（坐标见 UI-DESIGN.md §6.2）
- AC-2: 本人席位（席位0）底部居中，手牌区在席位下方
- AC-3: PlayZone 居于屏幕中央，尺寸 W480×H200
- AC-4: 操作按钮行（出牌/不要/提示）位于屏幕底部，y=16–64

### PlayerSeat

- AC-5: 每个席位显示头像（圆形占位）、昵称、「剩 X 张」手牌数
- AC-6: 收到 Schema delta 更新时，手牌数实时变化
- AC-7: 当前出牌者席位头像外圈显示金色计时圆环，非当前者圆环隐藏
- AC-8: `isAI=true` 的席位显示灰色「AI」小标
- AC-9: 手牌数 = 0 时席位显示「出完」绿色 badge，圆环隐藏

### HandCardView — 发牌

- AC-10: 收到 `your_hand` 消息后，手牌从屏幕外滑入，每张错开 50ms（发牌动画）
- AC-11: 手牌按 compareValue 升序排列（左小右大）
- AC-12: 最多 24 张牌（地主含底牌后），超过 12 张时启用横向 ScrollView
- AC-13: 单张牌显示正确的点数和花色（♠♣黑色，♥♦红色，大王红底，小王深蓝底）
- AC-14: 手牌区在非本人回合时所有牌 opacity=60%，不可点击（`setInteractable(false)`）

### HandCardView — 选牌

- AC-15: 点击一张牌 → 上移 20px + 金色描边（选中态）
- AC-16: 再次点击已选中的牌 → 取消选中，回到原位
- AC-17: 滑动手指经过多张牌 → 经过的牌全部选中（划选）
- AC-18: 选中后顶部牌型提示区实时显示识别结果（「单张」/「对子」/「顺子」…）
- AC-19: 无法识别的选牌组合显示「请选择合法牌型」（danger 色）

### 底牌展示（地主）

- AC-20: 收到 `bottom_cards` 后，在手牌区上方单独显示 3 张底牌，标注「底牌」
- AC-21: 底牌展示 2s 后以动画融入手牌排列（手牌总数从21增至24）

### CodeCardSelector

- AC-22: 进入 `landlord_select` 阶段且本人是地主时，弹出暗号牌选择弹窗
- AC-23: 弹窗显示 4列（♠♥♦♣）×8行（3-10点）共 32 个 SuitCardItem
- AC-24: 点击一个 SuitCardItem → 该格选中（金色底），之前选中的格取消
- AC-25: 未选中任何格时「确认」按钮禁用（opacity=40%）
- AC-26: 选中后点「确认」→ 发送 `select_code_card`，弹窗关闭
- AC-27: 30s 超时无操作 → 服务端自动选择，弹窗直接关闭

---

## 节点树

### GameScene

```
GameScene (Scene)
└── Canvas (Canvas, W1280×H720)
    ├── Background (Sprite W1600×H720)               bg_table 占位 #0F2318
    │
    ├── TopBar (Node W1280×H48, y=696)
    │   ├── BackBtn (Button W80×H40)                 「返回大厅」
    │   ├── RemainingLabel (Label 14px)               「剩余 108 张」（可选）
    │   └── SettingsBtn (Button W44×H44)
    │
    ├── Seat2 (PlayerSeat Prefab, x=280, y=608)      左前
    ├── Seat3 (PlayerSeat Prefab, x=1000, y=608)     右前
    ├── Seat1 (PlayerSeat Prefab, x=160, y=420)      左侧
    ├── Seat4 (PlayerSeat Prefab, x=1120, y=420)     右侧
    ├── Seat0 (PlayerSeat Prefab, x=640, y=300)      本人（底部居中）
    │
    ├── PlayZone (Node W480×H200, x=640, y=460)
    │   └── [见 ui-flow-04-doubling-play.md]
    │
    ├── HandCardView (Node W1200×H140, x=640, y=150)
    │   ├── ScrollView (ScrollView W1200×H140, 横向)
    │   │   └── CardContainer (Node, HorizontalLayout 间距-12px)
    │   │       └── CardItem × N (Prefab, 动态实例化)
    │   └── PatternHintLabel (Label 14px, y=155)     手牌区上方牌型提示
    │
    ├── ActionRow (Node W480×H48, x=640, y=16)       操作按钮行
    │   ├── PlayBtn (Button W120×H48, gold)           「出牌」
    │   ├── PassBtn (Button W120×H48, 描边)           「不要」
    │   └── HintBtn (Button W120×H48, 描边)           「提示」
    │
    ├── BottomCardsDisplay (Node, 默认隐藏)
    │   ├── BottomLabel (Label 12px「底牌」)
    │   └── BottomCardContainer (Node, HorizontalLayout)
    │       └── CardItem × 3 (Prefab)
    │
    ├── CodeCardSelector (Node W1280×H720, 默认隐藏)
    │   └── [见下方 CodeCardSelector 节点树]
    │
    ├── DoublingView (Node, 默认隐藏)
    │   └── [见 ui-flow-04-doubling-play.md]
    │
    ├── SettlementView (Node W1280×H720, 默认隐藏)
    │   └── [见 ui-flow-05-settlement-rematch.md]
    │
    ├── NetworkBanner (Node W1280×H40, 默认隐藏)
    └── Toast (Node)
        └── [GameController 节点]
            └── [脚本: GameController.ts]
```

---

## Prefab：CardItem

**路径**: `assets/bundle/game/prefabs/CardItem.prefab`  
**尺寸**: W52×H78

```
CardItem (Node W52×H78)
├── CardBg (Sprite W52×H78, 圆角6)                  白色底，大王红#8B0000，小王深蓝#1A237E
├── RankLabel (Label 14px Bold, 左上 x=6 y=32)      点数（3-A-2-小王-大王）
├── SuitLabel (Label 12px, 左上 x=6 y=18)           ♠♥♦♣
├── CenterSuit (Sprite W24×H24, 居中)               花色图标（可用 Label 替代）
├── CenterRank (Label 20px Bold, 居中)              大点数
└── SelectOverlay (Sprite W52×H78, 金色描边+透明底)  选中时显示，active=false
```

**CardItem.ts**（轻量脚本）:
```typescript
setup(cardCode: number) {
  const { rank, suit } = decodeCard(cardCode); // 用 CardEncoding.ts
  // 设置花色、点数、颜色
}
setSelected(selected: boolean) {
  this.selectOverlay.active = selected;
  tween(this.node).to(0.08, { position: new Vec3(0, selected ? 20 : 0, 0) }).start();
}
```

---

## Prefab：PlayerSeat

**路径**: `assets/bundle/game/prefabs/PlayerSeat.prefab`  
**尺寸**: W120×H140

```
PlayerSeat (Node W120×H140)
├── AvatarFrame (Sprite W64×H64, 圆形)
│   ├── Avatar (Sprite W60×H60)                    头像占位（8色随机圆）
│   └── TurnRingAnim (Node)                        计时圆环，默认隐藏
│       ├── RingBg (Sprite, 灰色圆环底)
│       └── RingFill (Sprite, 金→黄→红，progressBar 或 Tween)
├── NameLabel (Label 12px, y=-36)                  昵称（最多6字截断）
├── CardCountLabel (Label 12px text-secondary, y=-50) 「剩 X 张」
├── RoleBadge (Node, y=-62, 默认隐藏)
│   └── RoleLabel (Label 12px Bold)                「地主」/「搭档」
├── AIBadge (Label 「AI」12px text-secondary, 默认隐藏)
├── FinishBadge (Label 「出完」12px success, 默认隐藏)
└── PassBubble (Label 「不要」14px white, y=40, 默认隐藏) 出现500ms后隐藏
```

**PlayerSeat.ts 关键方法**（已存在，确认节点引用）:
- `update(data)` → 更新头像/昵称/手牌数
- `startTurnRing(deadline)` → 圆环倒计时动画
- `stopTurnRing()` → 隐藏圆环
- `showIdentity(role)` → 显示 RoleBadge
- `showPassBubble()` → 显示500ms后自动隐藏

---

## CodeCardSelector 节点树

```
CodeCardSelector (Node W1280×H720, z=100)
├── Overlay (Sprite W1280×H720, #000 opacity=178)
├── Panel (Sprite W640×H420, 圆角16, #1A2E20, 金色描边2px)
│   ├── TitleLabel (Label 22px Bold gold, y=180)   「选择暗号牌」
│   ├── HintLabel (Label 14px text-secondary, y=148) 「选一张3-10点的牌…」
│   ├── CardGrid (GridLayout W580×H320, 4列×8行, 间距4px)
│   │   └── SuitCardItem × 32 (Prefab)             ♠♥♦♣ × 3~10
│   ├── ConfirmBtn (Button W200×H48, gold, y=-170) 「确认」，disabled=true
│   └── SelectedPreview (Label 12px text-secondary) 「已选：♠ 7」
```

**Prefab：SuitCardItem**（W60×H48）:
```
SuitCardItem
├── CardBg (Sprite W60×H48, 圆角4, 白色底)
├── SuitLabel (Label 12px, 花色颜色)
└── RankLabel (Label 14px Bold)
```

**SuitCardItem.ts**:
```typescript
setup(suit: number, value: number) { /* 0=♠ 1=♥ 2=♦ 3=♣, value: 0=3...7=10 */ }
setSelected(selected: boolean) {
  this.cardBg.color = selected ? new Color('#D4A843') : Color.WHITE;
}
```

---

## 脚本绑定

| 节点 | 脚本 | 关键属性 |
|------|------|---------|
| `GameScene/Canvas/[GameController]` | `GameController.ts` | handCardView, playZone, playerSeats[5]（Seat0~Seat4），codeCardSelector, doublingView, settlementView, netManager |
| `GameScene/Canvas/HandCardView` | `HandCardView.ts` | cardItemPrefab → CardItem.prefab; scrollView; cardContainer; patternHintLabel |
| `Seat0~Seat4` (各 PlayerSeat Prefab 实例) | `PlayerSeat.ts` | avatarSprite, nameLabel, cardCountLabel, roleBadge, turnRingAnim, aiBadge, finishBadge, passBubble |
| `CodeCardSelector` | `CodeCardSelector.ts` | gridContainer, confirmBtn, suitCardPrefab → SuitCardItem.prefab, selectedPreview |

---

## 动效

### 发牌动画

```typescript
// HandCardView.ts — render(cards) 调用后触发
dealCards(cards: number[]) {
  cards.forEach((code, i) => {
    const cardNode = this.cardPool.get(); // 对象池
    cardNode.setPosition(0, -120); // 从屏幕外
    cardNode.setScale(0.8, 0.8);
    this.cardContainer.addChild(cardNode);
    cardNode.getComponent(CardItem).setup(code);

    tween(cardNode)
      .delay(i * 0.05)
      .to(0.2, { position: new Vec3(targetX, 0, 0), scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
  });
}
```

### 计时圆环

```typescript
// PlayerSeat.ts
startTurnRing(deadline: number) {
  this.turnRingAnim.active = true;
  const remaining = (deadline - Date.now()) / 1000;
  tween(this.ringFill)
    .to(remaining, { fillRange: 0 }, { easing: 'linear' })
    .start();
  // 颜色变化：>15s gold, 10-15s warning, <10s danger
}
```

### 底牌融入手牌

```typescript
// 2s 展示后滑入 handCardView
async showBottomCards(cards: number[]) {
  this.bottomCardsDisplay.active = true;
  await new Promise(r => setTimeout(r, 2000));
  tween(this.bottomCardsDisplay).to(0.3, { opacity: 0 })
    .call(() => {
      this.bottomCardsDisplay.active = false;
      this.addCardsToHand(cards); // 融入手牌重排
    }).start();
}
```

---

## oops-framework 集成

| 功能 | 当前写法 | oops 替换方案 |
|------|---------|-------------|
| CardItem prefab 加载 | `bundle.load('prefabs/CardItem', Prefab, cb)` | `await oops.res.load('game', 'prefabs/CardItem', Prefab)` |
| SuitCardItem 加载 | `bundle.load('prefabs/SuitCardItem', Prefab, cb)` | `await oops.res.load('game', 'prefabs/SuitCardItem', Prefab)` |
| CardItem 对象池 | CC 原生 `NodePool` | **保留 `NodePool`**（oops.pool 是特效动画池，不适用于 CardItem） |
| 消息总线 | `message.on/off` | 已使用，不变 |
| 本地 token 读取 | `sys.localStorage.getItem('ddz_token')` | `oops.storage.get('ddz_token')` |

```typescript
// GameSceneManager.ts — onLoad 前先加载 prefab
async onLoad() {
  // 使用 oops.res 加载 game 分包中的 prefab
  const cardPrefab = await oops.res.load('game', 'prefabs/CardItem', Prefab);
  const suitPrefab = await oops.res.load('game', 'prefabs/SuitCardItem', Prefab);

  // HandCardView 对象池（CC NodePool，不是 oops.pool）
  // oops.pool 专为 Spine/Animation/Particle 特效设计，CardItem 不带动画组件
  this._cardPool = new NodePool();
  for (let i = 0; i < 24; i++) {
    this._cardPool.put(instantiate(cardPrefab));
  }

  // 其余节点注入 ...
  this._buildAll(cardPrefab, suitPrefab);
}
```

**为什么不用 oops.pool**：`EffectSingleCase`（oops.pool）会在 get/put 时调用 `setSpeed()`，查找 sp.Skeleton / Animation / ParticleSystem 组件。CardItem 没有这些组件，使用 oops.pool 会产生无效遍历，直接用 CC 原生 `NodePool` 更轻。

## 约束

- CardItem 必须使用对象池（`NodePool`），禁止裸 `instantiate`（微信小程序 GC 敏感）
- CardItem prefab 通过 `oops.res.load('game', 'prefabs/CardItem', Prefab)` 加载（LaunchView 中已预加载 game 分包）
- 席位坐标硬编码（5人桌固定布局），不做动态布局
- SuitCardItem 32个在 CodeCardSelector 打开时全部实例化，关闭时不销毁（仅 active=false）
- GameController.ts 不修改，只填写节点引用

## 不在范围内

- 出牌阶段的 PlayZone 交互（见 TASK-044）
- 其他玩家出牌动画（见 TASK-044）
- 结算界面（见 TASK-045）
- 真实头像（占位圆形）
