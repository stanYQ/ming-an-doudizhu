# Spec: UI Flow 02 — 匹配等待（快速匹配 + 好友房）

**任务 ID**: TASK-042  
**目标模块**: client  
**优先级**: P0  
**状态**: ready  
**前置依赖**: TASK-041 完成（HallScene 搭建）  

---

## 执行流程

```
Step 1  认领 → 更新 .tasks/in-progress.md

Step 2  搭建 MatchView 节点树（弹层，挂在 HallScene Canvas 下）
        → 快速匹配模式 + 好友房模式共用同一节点树，按 mode 切换显示

Step 3  挂载脚本 + 填写节点引用

Step 4  实现等待动画（3点跳动）

Step 5  接入消息：waiting_update / room_update / game_started

Step 6  /verify
        → 服务端启动（AI_FILL_DELAY=1 AUTH_MODE=stub）
        → 点击快速匹配，观察等待室倒计时和 AI 补位流程
        → 点击好友房，观察房间码显示和席位列表
        → 对照 AC 逐条目视确认

Step 7  完成 → 更新 .tasks/done.md
```

---

## 背景

来源：`docs/FUNCTIONAL-DESIGN.md` §六（匹配系统）。  
MatchView 是玩家进入游戏前的过渡界面，需要传达等待进度、减少焦虑感，并在满员时无缝跳转游戏桌。

---

## 验收标准

### 公共

- AC-1: 点击大厅「快速匹配」后 MatchView 以淡入动画覆盖大厅（200ms）
- AC-2: 点击大厅「好友房」后 MatchView 同样淡入，但显示好友房模式内容
- AC-3: MatchView 内有「×」关闭按钮，点击后淡出返回大厅，取消匹配/离开房间

### 快速匹配模式

- AC-4: 顶部显示「快速匹配」标题
- AC-5: 中央显示「X / 5 人已加入」（X 来自 `waiting_update.readyCount`），金色加粗 24px
- AC-6: 显示「XX 秒后 AI 补位」倒计时，秒数由 `waiting_update.aiSeconds` 驱动
- AC-7: `aiSeconds = 0` 时倒计时区显示「AI 补位中…」替代秒数
- AC-8: `readyCount = 5` 时隐藏 AI 倒计时区，显示「即将开始…」
- AC-9: 收到 `game_started` 消息后，MatchView 淡出并跳转 GameScene
- AC-10: 3个金色圆点持续跳动动画（循环，各点错开 200ms）

### 好友房模式

- AC-11: 顶部显示「好友房」标题
- AC-12: 显示房间码（32px 金色），格式「房间码：XXXXXX」，右侧有「复制」按钮
- AC-13: 点击「复制」→ 复制房间码到剪贴板 + Toast「已复制」
- AC-14: 席位列表 5 行，已加入显示昵称，空席显示「等待加入…」灰色
- AC-15: 席位列表由 `room_update.players` 数组驱动实时更新
- AC-16: 「分享给好友」按钮调用平台分享（H5: 复制分享文案；微信: `wx.shareAppMessage`）
- AC-17: 「开始游戏」按钮仅 `isOwner=true` 时可见，人数 < 2 时禁用
- AC-18: 点击「开始游戏」发送 `force_start` 消息
- AC-19: 非房主显示「等待房主开始…」替代开始按钮
- AC-20: 收到 `game_started` 跳转 GameScene（同 AC-9）

### 错误处理

- AC-21: 收到 error 2002（房间已满）显示 Toast「房间已满（5/5）」
- AC-22: 收到 error 2003（无权限）显示 Toast「只有房主可以执行此操作」

---

## 节点树

```
MatchView (Node W1280×H720, active=false)
├── Overlay (Sprite W1280×H720, #000000 opacity=0→192 淡入)
│
├── Panel (Sprite W640×H440, 圆角16, 深色背景 #1A2E20, 金色描边1px)
│   │   居中 x=640 y=360
│   │
│   ├── TitleLabel (Label 20px Bold white)           「快速匹配」/「好友房」按 mode 切换
│   ├── CloseBtn (Button W44×H44, 右上角 x=600 y=200) 「×」
│   │
│   ├── QuickMatchContent (Node, active按mode)
│   │   ├── DotsAnim (Node, 3个子圆点)
│   │   │   ├── Dot0 (Sprite W16×H16 圆形 gold)
│   │   │   ├── Dot1 (Sprite W16×H16 圆形 gold)
│   │   │   └── Dot2 (Sprite W16×H16 圆形 gold)
│   │   ├── ReadyCountLabel (Label 24px Bold gold)    「X / 5 人已加入」
│   │   ├── AiCountdownNode (Node)
│   │   │   └── AiCountdownLabel (Label 14px text-secondary)
│   │   └── StartingLabel (Label 16px gold, 默认隐藏)  「即将开始…」
│   │
│   ├── FriendRoomContent (Node, active按mode)
│   │   ├── RoomCodeRow (Node, HorizontalLayout)
│   │   │   ├── RoomCodeLabel (Label 32px Bold gold)  「房间码：XXXXXX」
│   │   │   └── CopyBtn (Button W80×H36)              「复制」
│   │   ├── SeatList (Node, VerticalLayout 间距4px)
│   │   │   └── SeatItem × 5 (Prefab, W560×H52)      [见 Prefab 章节]
│   │   ├── ShareBtn (Button W200×H48, 描边)          「分享给好友」
│   │   └── StartBtn (Button W200×H48, gold)          「开始游戏」（房主可见）
│   │       WaitLabel (Label 14px text-secondary)     「等待房主开始…」（非房主可见）
│   │
│   └── CancelBtn (Button W200×H48, 描边)             「取消匹配」（快速匹配模式）
│
└── Toast (Node, 复用 HallScene Toast)
```

---

## Prefab：SeatItem

**路径**: `assets/bundle/hall/prefabs/SeatItem.prefab`  
**尺寸**: W560×H52

```
SeatItem (Node W560×H52)
├── AvatarCircle (Sprite W36×H36, 圆形占位)
├── NameLabel (Label 14px white, 已加入显示昵称)
├── EmptyLabel (Label 14px text-secondary, 「等待加入…」, 空席显示)
└── OwnerBadge (Label 12px gold「★房主」, 仅房主席位显示)
```

**脚本控制**（由 MatchView.ts 动态更新）:
```typescript
updateSeat(index: number, player: { nickname: string; isOwner: boolean } | null) {
  if (player) {
    this.nameLabel.string = player.nickname;
    this.nameLabel.active = true;
    this.emptyLabel.active = false;
    this.ownerBadge.active = player.isOwner;
  } else {
    this.nameLabel.active = false;
    this.emptyLabel.active = true;
    this.ownerBadge.active = false;
  }
}
```

---

## 脚本绑定

| 节点 | 脚本 | 关键属性 |
|------|------|---------|
| `MatchView` | `MatchView.ts` | readyCountLabel, aiCountdownLabel, startingLabel, seatItems[5], roomCodeLabel, startBtn, waitLabel, cancelBtn, shareBtn, copyBtn |

**MatchView.ts 已有逻辑**（确认引用正确）:
- `showQuickMatch()` → `quickMatchContent.active = true`, `friendRoomContent.active = false`, `titleLabel.string = '快速匹配'`
- `showFriendRoom()` → 反之
- `onWaitingUpdate(msg)` → 更新 readyCountLabel / aiCountdownLabel
- `onRoomUpdate(msg)` → 更新 seatItems
- `onGameStarted()` → 淡出 → `director.loadScene('GameScene')`

---

## 动效

### MatchView 淡入/淡出

```typescript
show() {
  this.node.active = true;
  tween(this.overlay).to(0.2, { opacity: 192 }).start();
  tween(this.panel).from({ scale: new Vec3(0.9, 0.9, 1) }).to(0.2, { scale: new Vec3(1, 1, 1) }).start();
}
hide() {
  tween(this.overlay).to(0.15, { opacity: 0 })
    .call(() => { this.node.active = false; }).start();
}
```

### 3点跳动动画（循环）

```typescript
startDotsAnim() {
  [this.dot0, this.dot1, this.dot2].forEach((dot, i) => {
    tween(dot).delay(i * 0.2)
      .repeatForever(
        tween().to(0.3, { position: new Vec3(0, 8, 0) }, { easing: 'sineOut' })
               .to(0.3, { position: new Vec3(0, 0, 0) }, { easing: 'sineIn' })
      ).start();
  });
}
```

---

## oops-framework 集成

| 功能 | 当前 | oops 用法 |
|------|------|----------|
| SeatItem Prefab 加载 | `bundle.load('prefabs/SeatItem', Prefab, cb)` | `await oops.res.load('hall', 'prefabs/SeatItem', Prefab)` |
| Toast（已复制） | 手写 Tween | 手写 Tween（P0，见 TASK-041 说明） |
| 消息总线 | `message.on/off` | 已使用，保持不变 |

```typescript
// MatchView.ts — SeatItem prefab 初始化（在 onLoad 调用一次）
private async _loadSeatItemPrefab() {
  this._seatItemPrefab = await oops.res.load('hall', 'prefabs/SeatItem', Prefab);
  // 预实例化 5 个
  for (let i = 0; i < 5; i++) {
    const node = instantiate(this._seatItemPrefab);
    this.seatList.addChild(node);
    this._seatItems.push(node.getComponent(SeatItem)!);
  }
}
```

## 约束

- MatchView 挂在 HallScene Canvas 下，不是独立场景
- SeatItem 使用 Prefab 实例化（`oops.res.load` 加载 prefab），最多 5 个，不动态创建销毁
- 好友房席位列表由 `room_update` 消息驱动，不从 Schema 读

## 不在范围内

- 输入房间码加入好友房的 UI（P0 仅通过分享链接/码加入，不做输入框）
- 房主转让
- 踢人功能
