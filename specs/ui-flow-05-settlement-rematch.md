# Spec: UI Flow 05 — 结算界面 + 身份揭晓 + 再来一局

**任务 ID**: TASK-045  
**目标模块**: client  
**优先级**: P0  
**状态**: ready  
**前置依赖**: TASK-044 完成（出牌阶段可跑通至 game_over）  

---

## 执行流程

```
Step 1  认领 → 更新 .tasks/in-progress.md

Step 2  搭建 SettlementView 节点树
        → 全屏遮罩 + 胜负横幅 + 5张玩家卡片 + 倍率明细 + 操作按钮

Step 3  实现 PlayerResultCard Prefab

Step 4  实现身份揭晓动画（identity_reveal）

Step 5  实现结算入场动画序列

Step 6  接入消息：game_over / identity_reveal / rematch_update / rematch_redirect / rematch_start

Step 7  /verify
        → 跑完一局，进入结算界面
        → 观察入场动画 + 身份揭晓 + 积分展示 + 再来一局流程
        → 对照 AC 逐条目视确认

Step 8  完成 → 更新 .tasks/done.md
```

---

## 背景

来源：`docs/UI-DESIGN.md` §七（SettlementView）、`docs/FUNCTIONAL-DESIGN.md` §七（结算界面）。  
结算界面是本局终点，「身份揭晓」是明暗斗地主的核心情绪高潮——玩家终于看清谁是搭档、谁是敌人。  
动效质量直接决定玩家是否愿意「再来一局」。

---

## 验收标准

### 结算界面 — 入场

- AC-1: 收到 `game_over` 消息后，全屏遮罩淡入（200ms，opacity 0→90%）
- AC-2: 胜负横幅从上方滑入（300ms，延迟 100ms）：「平民阵营胜利！」或「地主阵营胜利！」
- AC-3: 5张玩家结果卡片依次弹出（缩放 0→1，各延迟 50ms，从第 400ms 开始）
- AC-4: 玩家所在阵营胜利 → 卡片金色描边；失败 → 灰色描边

### 玩家结果卡片

- AC-5: 每张卡片显示：头像（圆形）+ 昵称 + 积分变化（+/- 数字）
- AC-6: 积分增加 → 绿色「+XXX」；积分减少 → 红色「-XXX」，24px Bold
- AC-7: 身份标签默认隐藏，收到 `identity_reveal` 后显示（「地主」金色 / 「搭档」橙色 / 「平民」灰色）
- AC-8: 地主玩家的卡片有金色底色加深（区别于其他玩家）

### 身份揭晓动画

- AC-9: 收到 `identity_reveal` 时触发全屏遮罩短暂弹出动画（1.5s 总时长）：
  - 遮罩淡入 200ms
  - 「身份揭晓」大字从中央缩放弹出（scale 0→1.2→1，400ms）
  - 对应席位 RoleBadge 闪光出现（200ms）
  - 遮罩淡出 300ms
- AC-10: 揭晓动画不阻塞计时器（游戏进行中揭晓时不暂停游戏）
- AC-11: 结算界面内，5张卡片的身份标签在结算入场时同步揭晓（不需要二次动画）

### 倍率明细

- AC-12: 结算界面中部显示倍率明细区：底分 × 地主加倍 × 玩家加倍 × 炸弹系数 × 是否春天
- AC-13: 数据来自 `game_over.breakdown`（若服务端无此字段则显示「---」占位）

### 再来一局

- AC-14: 底部显示「再来一局」（金色，W240×H56）和「返回大厅」（描边，W240×H56）
- AC-15: 快速匹配场景：点击「再来一局」→ 发送 `request_rematch` → 重新排队，不等其他人
- AC-16: 好友房场景：「再来一局」上方显示「X/Y 人同意」进度
- AC-17: 收到 `rematch_redirect { action: 'requeue' }` → 隐藏结算界面 → 跳回大厅并自动打开 MatchView
- AC-18: 收到 `rematch_start` → 隐藏结算界面 → 游戏桌重置，进入新一局发牌
- AC-19: 30s 窗口倒计时：「XX 秒后房间关闭」，归零后自动返回大厅

### 返回大厅

- AC-20: 点击「返回大厅」→ 发送 room.leave() → 跳转 HallScene

---

## 节点树

```
SettlementView (Node W1280×H720, z=200, 默认 active=false)
│
├── Overlay (Sprite W1280×H720, #000 opacity=0→230 Tween)
│
├── ResultBanner (Label 32px Bold, x=640 y=640, 默认 scale=0)
│   「平民阵营胜利！」gold / 「地主阵营胜利！」text-primary
│
├── PlayerCards (Node HorizontalLayout 间距16px, x=640 y=420)
│   └── PlayerResultCard × 5 (Prefab W160×H200)
│
├── MultiplierDetail (Node, x=640 y=280)
│   ├── DetailBg (Sprite W640×H80, 深色半透明圆角8)
│   └── DetailLabel (Label 12px text-secondary)
│       「底分:X × 地主×Y × 玩家×Z × 炸弹×A × 春天」
│
├── RematchProgress (Label 14px text-secondary, x=640 y=160) 「X/Y 人同意再来一局」，默认隐藏
├── Countdown (Label 12px text-secondary, x=640 y=140)        「XX 秒后房间关闭」
│
├── BtnRow (Node HorizontalLayout 间距24px, x=640 y=90)
│   ├── RematchBtn (Button W240×H56, gold)                    「再来一局」
│   └── BackHallBtn (Button W240×H56, 描边)                   「返回大厅」
│
└── IdentityRevealOverlay (Node W1280×H720, z=300, 默认 active=false)
    ├── RevealMask (Sprite W1280×H720, #000 opacity=0)
    └── RevealLabel (Label 48px Bold gold, 居中)              「身份揭晓」
        default scale=0
```

---

## Prefab：PlayerResultCard

**路径**: `assets/bundle/game/prefabs/PlayerResultCard.prefab`  
**尺寸**: W160×H200

```
PlayerResultCard (Node W160×H200)
├── CardBg (Sprite W160×H200, 圆角12, #1A2E20)
│   └── [胜者: 金色描边2px / 败者: 灰色描边1px]
├── Avatar (Sprite W56×H56, 圆形, y=72)
├── NameLabel (Label 14px, y=32, 最多6字截断)
├── RoleBadge (Node, y=14, 默认隐藏)
│   └── RoleLabel (Label 12px Bold)                「地主」/「搭档」/「平民」
├── ScoreLabel (Label 24px Bold, y=-24)             「+123」success / 「-123」danger
└── ScoreChangeTween (动画挂点, 结算入场时数字滚动)
```

**PlayerResultCard.ts**:
```typescript
setup(data: {
  nickname: string;
  scoreChange: number;
  role: 'landlord' | 'partner' | 'civilian';
  isWinner: boolean;
}) {
  this.nameLabel.string = data.nickname;
  this.scoreLabel.string = `${data.scoreChange > 0 ? '+' : ''}${data.scoreChange}`;
  this.scoreLabel.color = data.scoreChange > 0
    ? new Color('#27AE60') : new Color('#C0392B');
  // 胜负描边
  this.cardBg.getComponent(UIRenderer).setMaterialProperty(
    'borderColor', data.isWinner ? new Color('#D4A843') : new Color('#5A6478')
  );
  this.roleBadge.active = true; // 结算时直接显示，无需等揭晓动画
  this.roleLabel.string = { landlord: '地主', partner: '搭档', civilian: '平民' }[data.role];
  this.roleLabel.color = {
    landlord: new Color('#D4A843'),
    partner:  new Color('#E07B39'),
    civilian: new Color('#B0B8C1'),
  }[data.role];
}
```

---

## 脚本绑定

| 节点 | 脚本 | 关键属性 |
|------|------|---------|
| `SettlementView` | `SettlementView.ts` | resultBanner, playerCards[5], detailLabel, rematchProgress, countdown, rematchBtn, backHallBtn, overlay, identityRevealOverlay, revealMask, revealLabel |

**SettlementView.ts 已有逻辑**（确认引用正确）:
- `showResult(msg)` → 入场动画序列 → 填充数据
- `onRematchUpdate(msg)` → 更新 rematchProgress
- `onRematchStart()` → 隐藏结算，游戏重置
- `onRematchRedirect(msg)` → 跳回大厅

---

## 动效

### 结算入场序列

```typescript
// SettlementView.ts — showResult(msg)
show(msg: any) {
  this.node.active = true;

  // 1. 遮罩淡入 200ms
  tween(this.overlay).to(0.2, { opacity: 230 }).start();

  // 2. 横幅滑入（延迟 100ms）
  this.resultBanner.setPosition(640, 800);
  this.resultBanner.string = msg.winnerCamp === 'civilian_camp'
    ? '平民阵营胜利！' : '地主阵营胜利！';
  tween(this.resultBanner)
    .delay(0.1)
    .to(0.3, { position: new Vec3(640, 640, 0) }, { easing: 'backOut' })
    .start();

  // 3. 玩家卡片依次弹出（从 400ms 开始，各间隔 50ms）
  this.playerCards.forEach((card, i) => {
    card.node.setScale(0, 0, 1);
    card.setup(msg.players[i]);
    tween(card.node)
      .delay(0.4 + i * 0.05)
      .to(0.1, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'backOut' })
      .to(0.05, { scale: new Vec3(1, 1, 1) })
      .start();
  });

  // 4. 30s 倒计时
  this.startCountdown(30);
}
```

### 身份揭晓动画（游戏进行中）

```typescript
// SettlementView.ts（或 GameController 调用）
playIdentityReveal(role: string, playerName: string) {
  const overlay = this.identityRevealOverlay;
  overlay.active = true;

  // 遮罩淡入
  tween(this.revealMask).to(0.2, { opacity: 180 }).start();

  // 「身份揭晓」大字弹出
  tween(this.revealLabel)
    .delay(0.1)
    .to(0.2, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
    .to(0.1, { scale: new Vec3(1, 1, 1) })
    .delay(0.6)
    // 遮罩淡出
    .call(() => { tween(this.revealMask).to(0.3, { opacity: 0 }).start(); })
    .delay(0.3)
    .call(() => { overlay.active = false; })
    .start();
}
```

### 积分数字滚动效果（可选，P0 简化版）

```typescript
// P0 简化：直接显示最终数字，不做滚动
// P1 可升级为从 0 滚动到最终值的 Tween
this.scoreLabel.string = `${scoreChange > 0 ? '+' : ''}${scoreChange}`;
```

### 再来一局倒计时

```typescript
startCountdown(seconds: number) {
  let remaining = seconds;
  this._timer = setInterval(() => {
    remaining--;
    this.countdown.string = `${remaining} 秒后房间关闭`;
    if (remaining <= 0) {
      clearInterval(this._timer);
      this.onBackHallClick(); // 自动返回大厅
    }
  }, 1000);
}
```

---

## oops-framework 集成

| 功能 | 当前 | oops 替换 |
|------|------|----------|
| PlayerResultCard 加载 | `bundle.load('prefabs/PlayerResultCard', Prefab, cb)` | `await oops.res.load('game', 'prefabs/PlayerResultCard', Prefab)` |
| 错误 Toast | 手写 Tween | 手写 Tween（P0），P1 改 `oops.gui.toast()` |
| 返回大厅前清理 | - | `oops.res.removeBundle('game')` 释放 game 分包内存 |
| 积分数据持久化 | `sys.localStorage` | `oops.storage.set('ddz_score', newScore)` |

```typescript
// SettlementView.ts — 返回大厅（AC-20）
async onBackHallClick() {
  clearInterval(this._timer);
  await this._net.leaveRoom();
  // 释放 game 分包资源（回到大厅不再需要）
  oops.res.removeBundle('game');
  director.loadScene('HallScene');
}

// game_over 数据校验（若数据不完整）
show(msg: any) {
  if (!msg?.players || msg.players.length < 5) {
    // P0 手写 Toast，P1 改 oops.gui.toast('数据异常，返回大厅')
    this._showToast('数据异常，返回大厅');
    setTimeout(() => this.onBackHallClick(), 1500);
    return;
  }
  // ... 正常入场动画
}
```

## 约束

- SettlementView z-order 最高（200），覆盖所有游戏桌内容
- IdentityRevealOverlay z-order 300（在 SettlementView 内层时不冲突）
- PlayerResultCard 5个在结算界面加载时一次性实例化（`oops.res.load` 加载 prefab），不使用对象池
- 身份揭晓动画在游戏进行中触发（结算前的 identity_reveal 消息），需同时对 PlayerSeat 显示 RoleBadge
- 结算界面的 `game_over` 数据必须包含 `players` 数组（5人信息）才能渲染，若数据不完整显示错误 Toast 并返回大厅
- 返回大厅时调用 `oops.res.removeBundle('game')` 释放 game 分包，减少内存占用

## 不在范围内

- 积分数字滚动动画（P1）
- 炸弹/春天特效（P1）
- 战绩详情页（P1）
- 分享结算截图（P1）
