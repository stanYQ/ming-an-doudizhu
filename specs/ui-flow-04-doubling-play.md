# Spec: UI Flow 04 — 加倍阶段 + 出牌阶段

**任务 ID**: TASK-044  
**目标模块**: client  
**优先级**: P0  
**状态**: ready  
**前置依赖**: TASK-043 完成（GameScene 节点树 + HandCardView 已装配）  

---

## 执行流程

```
Step 1  认领 → 更新 .tasks/in-progress.md

Step 2  搭建 DoublingView 节点树
        → 挂在 GameScene Canvas 下，默认 active=false

Step 3  搭建 PlayZone 节点树
        → 上家出牌展示 + PASS 气泡 + 操作按钮行交互

Step 4  实现 DoublingView 逻辑
        → 接入 doubling_start / landlord_doubled / doubling_result 消息

Step 5  实现出牌阶段交互
        → 出牌按钮 → play_cards
        → 不要按钮 → pass（isNewRound 时禁用）
        → 提示按钮 → request_hint → 高亮推荐牌

Step 6  实现出牌飞出动画 + 上家出牌展示

Step 7  /verify
        → 从发牌阶段进入加倍 → 出牌 → 打完一局
        → 全程目视确认 AC

Step 8  完成 → 更新 .tasks/done.md
```

---

## 背景

来源：`docs/UI-DESIGN.md` §七（DoublingView、PlayZone）、`docs/FUNCTIONAL-DESIGN.md` §七（加倍阶段、出牌交互）。  
加倍阶段和出牌阶段是游戏核心体验，脚本逻辑（GameController.ts）已全部实现，本 Spec 聚焦节点树搭建、消息路由确认、动效实现。

---

## 验收标准

### DoublingView — 加倍阶段

- AC-1: 进入 `doubling` 状态后，DoublingView 从屏幕顶部滑入，覆盖 PlayZone 上方
- AC-2: 收到 `doubling_start` 后：显示「剩余 XX 秒」倒计时（15s 倒数）
- AC-3: 地主先选：非地主的 ×1 / ×2 按钮禁用，显示「等待地主选择…」
- AC-4: 收到 `landlord_doubled`：显示地主选择结果，非地主按钮激活
- AC-5: 点击 ×1 或 ×2 → 发送 `set_double`，本人按钮禁用（已选状态）
- AC-6: 收到 `doubling_result` → 显示所有人选择汇总（逐行，1.5s 后自动关闭）
- AC-7: 倒计时 ≤ 10s 时计时文字变为 danger 红色
- AC-8: DoublingView 关闭后，游戏桌恢复正常显示（进入 playing 阶段）

### PlayZone — 上家出牌展示

- AC-9: 有玩家出牌时，PlayZone 中央显示该玩家出的牌（缩小版 CardItem，W44×H66）
- AC-10: 出牌区上方显示「XX 出了：」（出牌者昵称，12px text-secondary）
- AC-11: 自由轮（isNewRound=true）时，出牌区清空，显示「自由出牌」
- AC-12: 其他玩家 pass 时，对应席位出现「不要」气泡（白色 Label），500ms 后消失

### 出牌交互

- AC-13: 轮到本人回合（turn_change 且 seatIndex=mySeat）时，出牌/不要/提示按钮激活
- AC-14: 非本人回合，三个按钮全部禁用（opacity=40%）
- AC-15: isNewRound=true 时，「不要」按钮额外禁用（自由轮不可 pass）
- AC-16: 本人出牌：选好牌后点「出牌」→ 发送 play_cards → 牌从手牌区飞向 PlayZone（150ms 动画）
- AC-17: 服务端返回 error 1001（牌型不合法）→ Toast「牌型不合法，请重新选择」，手牌保持选中
- AC-18: 服务端返回 error 1002（压不过上家）→ Toast「压不过上家，请出更大的牌或不要」
- AC-19: 本人不要：点「不要」→ 发送 pass → 本人席位出现「不要」气泡 500ms

### 提示功能

- AC-20: 点「提示」→ 发送 `request_hint`
- AC-21: 收到 `hint` 后，推荐牌蓝色描边闪烁 2 次（200ms/次）
- AC-22: hint.cards 为空时（无推荐牌），提示按钮保持可用，不报错

### 出牌倒计时

- AC-23: 轮到本人回合时，本人席位（Seat0）计时圆环开始倒数（30s）
- AC-24: 圆环颜色：>15s 金色，10-15s 黄色，<10s 红色
- AC-25: 回合结束（收到下一个 turn_change）时圆环立即停止并隐藏

---

## 节点树

### DoublingView

```
DoublingView (Node W480×H260, x=640, y=500, 默认 active=false)
├── PanelBg (Sprite W480×H260, 圆角12, #1A2E20 opacity=230, 金色描边1px)
├── TitleLabel (Label 18px Bold gold, y=104)         「加倍选择」
├── CountdownLabel (Label 16px white, y=72)          「剩余 15 秒」
├── StatusLabel (Label 14px text-secondary, y=44)    「等待地主选择…」/「选择加倍倍数」
├── BtnRow (Node HorizontalLayout 间距16px, y=0)
│   ├── Btn1x (Button W160×H56, 描边风格)            「×1 不加倍」
│   └── Btn2x (Button W160×H56, gold背景)            「×2 加倍！」
└── ResultList (Node VerticalLayout, y=-60, 默认隐藏)
    └── ResultItem × 5 (Label 12px)                  「席位X: ×1/×2」
```

---

### PlayZone

```
PlayZone (Node W480×H200, x=640, y=460)
├── PanelBg (Sprite W480×H200, 深色半透明圆角, opacity=120)
├── PlayerNameLabel (Label 12px text-secondary, y=88) 「XX 出了：」
├── LastPlayContainer (Node, HorizontalLayout, y=20)
│   └── MiniCardItem × N (CardItem Prefab 缩小版 W44×H66, 动态)
├── FreeRoundLabel (Label 14px text-secondary, y=20)  「自由出牌」，默认隐藏
└── [PassBubble 在各 PlayerSeat 节点上，不在 PlayZone 内]
```

---

## 脚本绑定

| 节点 | 脚本 | 关键属性 |
|------|------|---------|
| `DoublingView` | `DoublingView.ts` | countdownLabel, statusLabel, btn1x, btn2x, resultList, resultItems[5] |
| `PlayZone` | `PlayZone.ts` | playerNameLabel, lastPlayContainer, freeRoundLabel, miniCardPrefab |
| `ActionRow/PlayBtn` | → `GameController.onPlayButtonClick` | Button 事件绑定 |
| `ActionRow/PassBtn` | → `GameController.onPassButtonClick` | Button 事件绑定 |
| `ActionRow/HintBtn` | → `netManager.requestHint` | Button 事件绑定 |

**GameController.ts 节点引用补全**（本 Spec 重点）:
- `this.playZone` → PlayZone 节点
- `this.doublingView` → DoublingView 节点
- `this.netManager` → NetManager 节点

---

## 动效

### DoublingView 滑入/滑出

```typescript
// DoublingView.ts
show(msg: any) {
  this.node.active = true;
  this.node.setPosition(640, 800); // 从屏幕上方外
  tween(this.node)
    .to(0.25, { position: new Vec3(640, 500, 0) }, { easing: 'backOut' })
    .start();
  this.startCountdown(msg.timeout);
}
hide() {
  tween(this.node)
    .to(0.2, { position: new Vec3(640, 800, 0) }, { easing: 'backIn' })
    .call(() => { this.node.active = false; })
    .start();
}
```

### 加倍倒计时

```typescript
startCountdown(seconds: number) {
  let remaining = seconds;
  this._countdownTimer = setInterval(() => {
    remaining--;
    this.countdownLabel.string = `剩余 ${remaining} 秒`;
    this.countdownLabel.color = remaining <= 10
      ? new Color('#C0392B') : new Color('#FFFFFF');
    if (remaining <= 0) { clearInterval(this._countdownTimer); }
  }, 1000);
}
```

### 出牌飞出动画

```typescript
// PlayZone.ts — 收到 Schema lastPlay 更新时触发
showLastPlay(playerId: string, cards: number[]) {
  this.playerNameLabel.string = `${playerName} 出了：`;
  this.freeRoundLabel.active = false;
  // 清空旧牌
  this.lastPlayContainer.removeAllChildren();
  // 实例化新牌，从手牌区位置飞入
  cards.forEach((code, i) => {
    const cardNode = instantiate(this.miniCardPrefab);
    cardNode.setPosition(0, -100); // 起点（屏幕下方）
    this.lastPlayContainer.addChild(cardNode);
    tween(cardNode)
      .delay(i * 0.03)
      .to(0.15, { position: new Vec3(0, 0, 0) }, { easing: 'sineOut' })
      .start();
  });
}
clearLastPlay() {
  this.freeRoundLabel.active = true;
  this.playerNameLabel.string = '';
  this.lastPlayContainer.removeAllChildren();
}
```

### hint 推荐牌高亮闪烁

```typescript
// HandCardView.ts
showHint(cards: number[]) {
  this._cardNodes.forEach(node => {
    const cardItem = node.getComponent(CardItem);
    if (cards.includes(cardItem.cardCode)) {
      // 蓝色描边闪烁 2 次
      tween(node)
        .to(0.2, { scale: new Vec3(1.05, 1.05, 1) })
        .to(0.2, { scale: new Vec3(1, 1, 1) })
        .to(0.2, { scale: new Vec3(1.05, 1.05, 1) })
        .to(0.2, { scale: new Vec3(1, 1, 1) })
        .start();
      cardItem.setHintHighlight(true); // 蓝色描边
    }
  });
}
```

### 加倍结果汇总后自动关闭

```typescript
// DoublingView.ts
onResult(msg: any) {
  this.resultList.active = true;
  msg.results.forEach((r: any, i: number) => {
    this.resultItems[i].string = `席位${r.seatIndex}: ×${r.value}`;
  });
  setTimeout(() => { this.hide(); }, 1500);
}
```

---

## oops-framework 集成

| 功能 | 当前 | oops 替换 |
|------|------|----------|
| 错误 Toast（1001/1002） | 手写 Tween | 手写 Tween（同 TASK-041 P0 说明，P1 升级） |
| 消息总线 | `message.on/off` | 已使用，不变 |
| miniCardItem 临时节点 | `instantiate(this.miniCardPrefab)` | `instantiate`（数量≤8，无需池） |

```typescript
// GameController.ts — 出牌错误处理（AC-17/18）
// P0 用 HallScene 同款手写 Toast，P1 改 oops.gui.toast()
onError(msg: { code: number; message: string }) {
  const text = msg.code === 1001
    ? '牌型不合法，请重新选择'
    : '压不过上家，请出更大的牌或不要';
  // TODO P1: oops.gui.toast(text);
  this._showToast(text);
}
```

## 约束

- DoublingView 不阻塞手牌区（z-order 低于 CodeCardSelector，高于 PlayZone）
- PlayZone 的 lastPlay 更新来自 Schema delta（GameController.onStateChange），不重复监听
- 出牌飞出动画的 miniCardItem 用临时 instantiate（数量少，≤8张，不需要对象池）
- 「不要」按钮的 isNewRound 禁用逻辑由 GameController.onTurn 驱动（已实现 TASK-039c）

## 不在范围内

- 结算界面（见 TASK-045）
- 炸弹特效（P1）
- 春天/反春动画（P1）
- 聊天/表情（P1）
