# Spec: GameScene 完整 UI 交互实现规格

**任务 ID**: TASK-053  
**目标模块**: client  
**优先级**: P0  
**状态**: ready

---

## 文档说明

本文档为 Client-Dev 提供 GameScene 所有 UI 组件的**完整实现规格**，包括：
- 常驻 UI 组件（HandCardView、PlayZone、PlayerSeat、BottomCardsDisplay）
- 弹窗组件（CodeCardSelector、DoublingView、SettlementView）
- 状态转换与 UI 响应
- 动画时序与视觉反馈
- 边界情况与错误处理

**目标**: Client-Dev 读完后可以从零开始实现所有组件，无需再问。

---

## 一、GameScene 架构概览

### 1.1 UI 分层架构

```
GameScene
├── 常驻层（Canvas 子节点）
│   ├── Background（背景）
│   ├── PlayerSeat × 5（玩家席位）
│   ├── PlayZone（出牌区）
│   ├── HandCardView（手牌区）
│   ├── BottomCardsDisplay（底牌展示）
│   └── ControlButtons（操作按钮行）
│
└── 弹层（oops.gui 动态管理）
    ├── CodeCardSelector（暗号牌选择）
    ├── DoublingView（加倍选择）
    └── SettlementView（结算界面）
```

**分层原则**:
- **常驻层**: 游戏全程可见，通过 `node.active` 控制显隐
- **弹层**: 按需打开/关闭，使用 `oops.gui.open(UIId.XXX)` / `oops.gui.remove(UIId.XXX)`

---

### 1.2 状态机流程

```
waiting（等待开局）
    ↓
dealing（发牌中）
    ↓ sendDealingReady()
landlord_select（选暗号牌）
    ↓ select_code_card
code_card_reveal（暗号牌揭晓，4s）
    ↓
doubling（加倍选择）
    ↓ set_double
doubling_result（加倍结果展示，2s）
    ↓
playing（出牌中）
    ↓ game_over
settlement（结算）
    ↓ rematch / return_hall
waiting（等待开局）或 HallScene
```

**关键时序**:
- **dealing → landlord_select**: 需等待所有客户端发送 `dealing_ready`（或 10s 超时）
- **code_card_reveal**: 服务端 4s 窗口期，客户端播放揭晓动画
- **doubling_result**: 服务端 2s 窗口期，客户端展示结果

---

### 1.3 玩家席位布局

**5 人席位坐标**（以 720p 为基准）:
```typescript
const SEAT_POSITIONS: [number, number][] = [
    [0,   -300],   // seatIndex=0 自己 — 底部居中
    [500,  -60],   // seatIndex=1 右邻
    [280,  260],   // seatIndex=2 右上
    [-280, 260],   // seatIndex=3 左上
    [-500, -60],   // seatIndex=4 左邻
];
```

**视角旋转规则**:
- **自己永远在底部**（seatIndex=0）
- 服务端 `serverIndex` 需映射到客户端 `seatIndex`
- 映射公式: `seatIndex = (serverIndex - mySelfServerIndex + 5) % 5`

**示例**:
- 服务端: 我是 serverIndex=2
- 其他玩家 serverIndex: [0, 1, 2, 3, 4]
- 客户端 seatIndex 映射: [3, 4, 0, 1, 2]
- 结果: serverIndex=2（我）显示在 seatIndex=0（底部）

---

## 二、常驻 UI 组件详细规格

### 2.1 HandCardView（手牌区）

#### 2.1.1 组件职责

手牌区负责：
- 接收并显示玩家手牌（0-107 编码）
- 支持单选/多选交互
- 实时显示牌型识别结果
- 管理「出牌」「过」「提示」按钮状态

#### 2.1.2 布局规则

**卡牌排列**:
- 排序规则: `compareValue()` 升序（3 → 2 → 小王 → 大王）
- 卡牌间距: 
  - ≤12 张: 固定间距 42px（可见宽度）
  - >12 张: 使用 ScrollView 横向滚动
- 卡牌尺寸: 原始 52×78，缩放 1.8 倍 → 93.6×140.4px
- 选中状态: 上移 20px + 描边高亮（金色 3px）

**容器尺寸**:
```typescript
// ≤12 张时固定宽度
const maxWidth = 12 * 42 + 52 = 556px;

// >12 张时使用 ScrollView
const scrollViewWidth = 600px;  // 固定宽度
const contentWidth = cardCount * 42 + 52;  // 动态内容宽度
```

#### 2.1.3 交互逻辑

**单选/多选**:
```typescript
// 点击卡牌
onCardClick(cardCode: number): void {
    const index = this._selectedCards.indexOf(cardCode);
    if (index >= 0) {
        // 已选中 → 取消选中
        this._selectedCards.splice(index, 1);
        this._cardItems[cardCode].setSelected(false);
    } else {
        // 未选中 → 选中
        this._selectedCards.push(cardCode);
        this._cardItems[cardCode].setSelected(true);
    }
    this._updatePatternUI();
}

// 划选（拖拽）
onDragSelect(startX: number, endX: number): void {
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    
    this._cards.forEach(code => {
        const item = this._cardItems[code];
        const posX = item.node.position.x;
        
        if (posX >= minX && posX <= maxX) {
            // 在范围内 → 选中
            if (!this._selectedCards.includes(code)) {
                this._selectedCards.push(code);
                item.setSelected(true);
            }
        }
    });
    
    this._updatePatternUI();
}
```

**按钮状态管理**:
```typescript
// 出牌按钮
this.playButton.interactable = 
    this._turnActive &&           // 轮到自己
    this._selectedCards.length > 0 &&  // 有选中的牌
    this._isValidPattern();       // 是合法牌型

// 过按钮
this.passButton.interactable = 
    this._turnActive &&           // 轮到自己
    this._passEnabled;            // 非首出（允许过）

// 提示按钮
this.hintButton.interactable = this._turnActive;
```

#### 2.1.4 牌型识别

**实时识别**:
```typescript
private _updatePatternUI(): void {
    if (this._selectedCards.length === 0) {
        this.patternLabel.string = '请选择要出的牌';
        this.playButton.interactable = false;
        return;
    }
    
    const pattern = parse(this._selectedCards);
    
    if (pattern) {
        // 合法牌型
        const labelMap = {
            [PatternType.SINGLE]: '单张',
            [PatternType.PAIR]: '对子',
            [PatternType.TRIO]: '三张',
            [PatternType.TRIO_SINGLE]: '三带一',
            [PatternType.TRIO_PAIR]: '三带对',
            [PatternType.STRAIGHT]: '顺子',
            [PatternType.PLANE]: '飞机',
            [PatternType.QUAD_DUAL_SINGLE]: '四带二',
            [PatternType.QUAD_DUAL_PAIR]: '四带两对',
            [PatternType.BOMB]: '炸弹',
            [PatternType.NUKE]: '王炸',
        };
        this.patternLabel.string = labelMap[pattern.type] || '未知牌型';
        this.patternLabel.color = Color.GREEN;
        this.playButton.interactable = this._turnActive;
    } else {
        // 非法牌型
        this.patternLabel.string = '请选择合法牌型';
        this.patternLabel.color = Color.RED;
        this.playButton.interactable = false;
    }
}
```

#### 2.1.5 Hint 高亮动画

**服务端推荐后自动选中并闪烁**:
```typescript
selectHint(hintCards: number[]): void {
    // 1. 清空当前选择
    this.clearSelection();
    
    // 2. 选中推荐的牌
    hintCards.forEach(code => {
        const index = this._cards.indexOf(code);
        if (index >= 0) {
            this._selectedCards.push(code);
            this._cardItems[code].setSelected(true);
        }
    });
    
    // 3. 闪烁动画（3 次，每次 0.5s）
    this._selectedCards.forEach(code => {
        const item = this._cardItems[code];
        tween(item.node)
            .to(0.25, { scale: new Vec3(2.0, 2.0, 1) })
            .to(0.25, { scale: new Vec3(1.8, 1.8, 1) })
            .union()
            .repeat(3)
            .start();
    });
    
    // 4. 更新牌型提示
    this._updatePatternUI();
}
```

#### 2.1.6 验收标准

- **AC-1**: 手牌按 `compareValue()` 升序排列
- **AC-2**: ≤12 张时固定间距 42px，>12 张时横向滚动
- **AC-3**: 点击卡牌切换选中状态（上移 20px + 金色描边）
- **AC-4**: 划选支持（拖拽选中范围内所有卡牌）
- **AC-5**: 选中牌型实时识别并显示（「单张」「对子」等）
- **AC-6**: 非法牌型显示「请选择合法牌型」（红色）
- **AC-7**: 出牌按钮仅在轮到自己且选中合法牌型时 enable
- **AC-8**: 过按钮仅在轮到自己且非首出时 enable
- **AC-9**: Hint 推荐后自动选中并闪烁 3 次（0.5s × 3）
- **AC-10**: 非轮次时所有按钮禁用，手牌 opacity 60%

---

### 2.2 PlayZone（出牌区）

#### 2.2.1 组件职责

出牌区负责：
- 显示当前回合所有玩家的出牌
- 使用 MiniCardItem 显示代表牌（最多 5 张）
- 显示当前回合标识（绿色圆环=己方，灰色=其他）
- 新回合时清空历史出牌

#### 2.2.2 布局规则

**MiniCardItem 显示规则**:
- 单张/对子/三张: 显示所有牌
- 顺子/飞机: 显示前 3 张 + 「...」+ 最后 1 张
- 炸弹/王炸: 显示所有牌
- 带牌型: 显示主体牌（如三带一只显示三张）

**示例**:
```typescript
// 三带一: [3, 3, 3, 4]
显示: 3♠ 3♥ 3♦  （不显示带的 4）

// 顺子: [3, 4, 5, 6, 7]
显示: 3 4 5 ... 7

// 飞机: [3, 3, 3, 4, 4, 4, 5, 6]
显示: 3 3 3 4 4 4  （不显示带的 5, 6）

// 炸弹: [8, 8, 8, 8]
显示: 8♠ 8♥ 8♦ 8♣
```

**卡牌尺寸**:
- MiniCardItem: 30×45px（缩小版）
- 间距: 5px
- 总宽度: `Math.min(cardCount, 5) * 35px`

#### 2.2.3 回合标识

**圆环颜色规则**:
```typescript
private _updateRoundIndicator(currentPlayerSeatIndex: number): void {
    const isMyTurn = (currentPlayerSeatIndex === 0);  // seatIndex=0 是自己
    
    if (isMyTurn) {
        this.roundIndicator.color = Color.GREEN;  // #2ECC71
    } else {
        this.roundIndicator.color = Color.GRAY;   // #95A5A6
    }
}
```

**新回合重置**:
```typescript
onNewRound(): void {
    // 清空所有玩家的出牌记录
    this._playedCards.clear();
    
    // 隐藏所有 MiniCardItem
    this._cardNodes.forEach(node => node.active = false);
    
    // 重置回合标识
    this.roundIndicator.active = false;
}
```

#### 2.2.4 出牌动画

**飞入动画**（从玩家席位飞向出牌区）:
```typescript
showPlayedCards(seatIndex: number, cards: number[]): void {
    const seatPos = this._seats[seatIndex].node.position;
    const targetPos = this._getPlayZonePosition(seatIndex);
    
    // 生成 MiniCardItem
    const miniCards = this._createMiniCards(cards);
    
    // 飞入动画（300ms ease-out）
    miniCards.forEach((node, i) => {
        node.setPosition(seatPos);
        node.active = true;
        
        tween(node)
            .to(0.3, { position: targetPos }, { easing: 'sineOut' })
            .delay(i * 0.05)  // 50ms stagger
            .start();
    });
    
    // 淡入动画
    miniCards.forEach(node => {
        const opacity = node.getComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity)
            .to(0.3, { opacity: 255 })
            .start();
    });
}
```

#### 2.2.5 验收标准

- **AC-1**: MiniCardItem 最多显示 5 张代表牌
- **AC-2**: 顺子显示「3 4 5 ... 7」格式
- **AC-3**: 当前回合标识圆环颜色正确（绿色=己方，灰色=其他）
- **AC-4**: 新回合时清空所有玩家出牌记录
- **AC-5**: 出牌飞入动画流畅（300ms ease-out + 50ms stagger）
- **AC-6**: 出牌淡入动画（opacity 0 → 255，300ms）

---

### 2.3 PlayerSeat（玩家席位）

#### 2.3.1 组件职责

玩家席位负责：
- 显示玩家基本信息（头像、昵称、手牌数量）
- 显示 AI 标识（isAI=true）
- 显示轮次指示器（轮到时高亮 + 倒计时）
- 显示身份标签（地主/队友/平民）
- 非轮次时降低透明度（opacity 60%）

#### 2.3.2 UI 元素结构

```
PlayerSeat (Node)
├── Avatar (Sprite)           // 头像
├── Nickname (Label)          // 昵称
├── HandCount (Label)         // 手牌数量「×21」
├── AIBadge (Sprite)          // AI 标识（机器人图标）
├── RoleLabel (Label)         // 身份标签「地主」「队友」「平民」
├── TurnIndicator (Node)      // 轮次指示器
│   ├── Ring (Sprite)         // 圆环（高亮动画）
│   └── Timer (Label)         // 倒计时「30」
└── StatusLabel (Label)       // 状态标签「托管中」「已过」
```

#### 2.3.3 轮次指示器

**激活规则**:
```typescript
setTurnActive(active: boolean, timeLeft?: number): void {
    this.turnIndicator.active = active;
    
    if (active) {
        // 轮到该席位
        this.ring.color = Color.YELLOW;  // 金色高亮
        
        // 脉冲动画（scale 1.0 ↔ 1.2，循环）
        tween(this.ring.node)
            .to(0.5, { scale: new Vec3(1.2, 1.2, 1) })
            .to(0.5, { scale: new Vec3(1.0, 1.0, 1) })
            .union()
            .repeatForever()
            .start();
        
        // 倒计时
        if (timeLeft) {
            this._startCountdown(timeLeft);
        }
    } else {
        // 非轮次
        this.ring.node.stopAllActions();
        this.ring.node.setScale(1.0, 1.0, 1);
    }
}
```

**倒计时颜色规则**:
```typescript
private _updateTimerColor(seconds: number): void {
    if (seconds > 10) {
        this.timer.color = Color.WHITE;   // 白色
    } else if (seconds > 5) {
        this.timer.color = Color.YELLOW;  // 黄色
    } else {
        this.timer.color = Color.RED;     // 红色
    }
}
```

#### 2.3.4 身份标签

**显示时机**:
- landlord_select 阶段: 仅地主显示「地主」
- playing 阶段: 所有人显示身份（地主/队友/平民）
- settlement 阶段: 身份揭晓动画（fade-in + scale）

**样式**:
```typescript
setRole(role: 'landlord' | 'partner' | 'civilian'): void {
    const config = {
        landlord: { text: '地主', color: '#E74C3C' },  // 红色
        partner:  { text: '队友', color: '#3498DB' },  // 蓝色
        civilian: { text: '平民', color: '#95A5A6' },  // 灰色
    };
    
    const { text, color } = config[role];
    this.roleLabel.string = text;
    this.roleLabel.color = new Color(color);
    this.roleLabel.node.active = true;
}
```

#### 2.3.5 非轮次状态

**降低透明度**:
```typescript
setInteractable(enabled: boolean): void {
    const opacity = this.node.getComponent(UIOpacity);
    
    if (enabled) {
        // 轮到该席位或己方
        opacity.opacity = 255;
    } else {
        // 非轮次
        opacity.opacity = 153;  // 60% = 255 * 0.6
    }
}
```

#### 2.3.6 AI 标识

**显示规则**:
```typescript
setPlayerInfo(nickname: string, isAI: boolean): void {
    this.nickname.string = nickname;
    this.aiBadge.active = isAI;
    
    if (isAI) {
        // AI 昵称添加前缀
        this.nickname.string = `[AI] ${nickname}`;
    }
}
```

#### 2.3.7 验收标准

- **AC-1**: 显示玩家头像、昵称、手牌数量
- **AC-2**: AI 玩家显示机器人图标 + 昵称前缀「[AI]」
- **AC-3**: 轮到时圆环金色高亮 + 脉冲动画（scale 1.0 ↔ 1.2）
- **AC-4**: 倒计时颜色：>10s 白色、5-10s 黄色、<5s 红色
- **AC-5**: 身份标签颜色正确（地主红色、队友蓝色、平民灰色）
- **AC-6**: 非轮次时 opacity 60%
- **AC-7**: 视角旋转后自己永远在底部（seatIndex=0）

---

### 2.4 BottomCardsDisplay（底牌展示）

#### 2.4.1 组件职责

底牌展示负责：
- landlord_select 阶段结束后显示 3 张底牌
- 播放融入动画（飞向地主席位）
- 2s 后隐藏

#### 2.4.2 显示时机

**触发条件**:
```typescript
// 收到 landlord_reveal 消息后
onLandlordReveal(msg: { landlordSeatIndex: number; bottomCards: number[] }): void {
    // 1. 显示 3 张底牌（在屏幕中央上方）
    this.bottomCardsDisplay.show(msg.bottomCards);
    
    // 2. 等待 2s
    this.scheduleOnce(() => {
        // 3. 播放融入动画（飞向地主席位）
        this.bottomCardsDisplay.flyToLandlord(msg.landlordSeatIndex);
    }, 2.0);
}
```

#### 2.4.3 融入动画

**飞行路径**（贝塞尔曲线）:
```typescript
flyToLandlord(landlordSeatIndex: number): void {
    const landlordPos = this._seats[landlordSeatIndex].node.position;
    
    this._cardNodes.forEach((node, i) => {
        const startPos = node.position;
        const endPos = landlordPos;
        
        // 贝塞尔曲线控制点（抛物线）
        const controlPoint = new Vec3(
            (startPos.x + endPos.x) / 2,
            (startPos.y + endPos.y) / 2 + 100,  // 向上拱起
            0
        );
        
        // 飞行动画（800ms + 200ms stagger）
        tween(node)
            .delay(i * 0.2)
            .bezierTo(0.8, startPos, controlPoint, controlPoint, endPos)
            .call(() => {
                node.active = false;
                // 通知地主席位更新手牌数量（+3）
                this._seats[landlordSeatIndex].addHandCount(1);
            })
            .start();
        
        // 缩小动画（1.0 → 0.5）
        tween(node)
            .delay(i * 0.2)
            .to(0.8, { scale: new Vec3(0.5, 0.5, 1) })
            .start();
    });
    
    // 800ms + 3 × 200ms = 1400ms 后隐藏容器
    this.scheduleOnce(() => {
        this.node.active = false;
    }, 1.4);
}
```

#### 2.4.4 验收标准

- **AC-1**: landlord_reveal 后显示 3 张底牌（屏幕中央上方）
- **AC-2**: 显示标签「底牌」
- **AC-3**: 2s 后播放融入动画
- **AC-4**: 飞行路径为贝塞尔曲线（抛物线，向上拱起 100px）
- **AC-5**: 3 张牌依次飞出（200ms stagger）
- **AC-6**: 飞行过程中卡牌缩小（scale 1.0 → 0.5）
- **AC-7**: 地主席位手牌数量 +3

---

## 三、弹窗组件详细规格

### 3.1 CodeCardSelector（暗号牌选择弹窗）

#### 3.1.1 组件职责

暗号牌选择弹窗负责：
- landlord_select 阶段弹出（仅候选地主）
- 显示 4 张手牌按钮（Suit + Value）
- 单选交互（最多选 1 张）
- 倒计时（10s，颜色变化）
- 超时自动选第一张

#### 3.1.2 触发时机

```typescript
// GameMgr.ts
onLandlordSelect(msg: { candidates: number[] }): void {
    const mySeatIndex = 0;  // 自己永远在 seatIndex=0
    const myServerIndex = this._getMyServerIndex();
    
    if (msg.candidates.includes(myServerIndex)) {
        // 自己是候选地主 → 弹出暗号牌选择
        oops.gui.open(UIId.CodeCardSelector, {
            handCards: this._handCards,  // 当前手牌（0-107 编码）
            timeout: 10,                 // 倒计时 10s
        });
    }
}
```

#### 3.1.3 UI 元素结构

```
CodeCardSelector (Modal)
├── Background (Sprite)           // 半透明遮罩
├── Panel (Node)
│   ├── Title (Label)             // 「选择暗号牌」
│   ├── CardButtons (Node)        // 4 个卡牌按钮
│   │   ├── Card1 (Button)        // 第 1 张手牌
│   │   ├── Card2 (Button)        // 第 2 张手牌
│   │   ├── Card3 (Button)        // 第 3 张手牌
│   │   └── Card4 (Button)        // 第 4 张手牌
│   ├── ConfirmButton (Button)    // 「确认」按钮
│   └── Timer (Label)             // 倒计时「10」
```

#### 3.1.4 卡牌按钮

**显示规则**:
```typescript
// 显示前 4 张手牌
const firstFourCards = handCards.slice(0, 4);

firstFourCards.forEach((code, i) => {
    const btn = this.cardButtons[i];
    const { suit, value } = decode(code);
    
    // 显示花色 + 点数
    btn.label.string = this._formatCard(suit, value);
    // 示例: 「♠3」「♥4」「♦5」「♣6」
    
    btn.onClick = () => this._selectCard(i);
});
```

**格式化函数**:
```typescript
private _formatCard(suit: number, value: number): string {
    const suitSymbol = ['♠', '♥', '♦', '♣'][suit];
    const valueStr = ['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'][value - 3];
    return suitSymbol + valueStr;
}
```

#### 3.1.5 单选交互

```typescript
private _selectedIndex: number = -1;

private _selectCard(index: number): void {
    // 取消之前的选中
    if (this._selectedIndex >= 0) {
        this.cardButtons[this._selectedIndex].setSelected(false);
    }
    
    // 选中当前卡牌
    this._selectedIndex = index;
    this.cardButtons[index].setSelected(true);
    
    // 启用确认按钮
    this.confirmButton.interactable = true;
}

// Button 选中状态
setSelected(selected: boolean): void {
    if (selected) {
        this.background.color = Color.YELLOW;  // 金色高亮
        this.node.setScale(1.1, 1.1, 1);       // 放大 10%
    } else {
        this.background.color = Color.WHITE;
        this.node.setScale(1.0, 1.0, 1);
    }
}
```

#### 3.1.6 倒计时

**颜色变化规则**:
```typescript
private _startCountdown(seconds: number): void {
    this._remaining = seconds;
    this.timerLabel.string = String(this._remaining);
    
    this.schedule(this._onTick, 1.0);
}

private _onTick = (): void => {
    this._remaining--;
    this.timerLabel.string = String(this._remaining);
    
    // 颜色变化
    if (this._remaining > 5) {
        this.timerLabel.color = Color.WHITE;   // 白色
    } else if (this._remaining > 3) {
        this.timerLabel.color = Color.YELLOW;  // 黄色
    } else {
        this.timerLabel.color = Color.RED;     // 红色
    }
    
    // 超时自动选择
    if (this._remaining <= 0) {
        this.unschedule(this._onTick);
        if (this._selectedIndex < 0) {
            // 未选择 → 自动选第一张
            this._selectCard(0);
        }
        this._onConfirm();
    }
};
```

#### 3.1.7 确认发送

```typescript
private _onConfirm(): void {
    if (this._selectedIndex < 0) return;
    
    const selectedCode = this._handCards[this._selectedIndex];
    const { suit, value } = decode(selectedCode);
    
    // 发送 select_code_card 消息
    netManager.sendSelectCodeCard(suit, value);
    
    // 关闭弹窗
    oops.gui.remove(UIId.CodeCardSelector);
}
```

#### 3.1.8 验收标准

- **AC-1**: landlord_select 阶段且自己是候选地主时弹出
- **AC-2**: 显示前 4 张手牌（花色 + 点数，如「♠3」）
- **AC-3**: 点击卡牌切换选中（金色高亮 + 放大 10%）
- **AC-4**: 单选模式（最多选 1 张）
- **AC-5**: 未选中时「确认」按钮禁用（opacity 40%）
- **AC-6**: 倒计时颜色：>5s 白色、3-5s 黄色、<3s 红色
- **AC-7**: 超时自动选第一张
- **AC-8**: 确认后发送 `select_code_card` 并关闭弹窗

---

### 3.2 DoublingView（加倍选择弹窗）

#### 3.2.1 组件职责

加倍选择弹窗负责：
- doubling 阶段弹出
- 显示「不加倍」「加倍 ×2」两个按钮
- 倒计时（10s，颜色变化）
- 超时自动选「不加倍」
- 滑入/滑出动画

#### 3.2.2 触发时机

```typescript
// GameMgr.ts
onDoublingStart(msg: { timeout: number; landlordSeatIndex: number }): void {
    oops.gui.open(UIId.DoublingView, {
        timeout: msg.timeout,
        landlordSeatIndex: msg.landlordSeatIndex,
    });
}
```

#### 3.2.3 UI 元素结构

```
DoublingView (Modal)
├── Background (Sprite)           // 半透明遮罩
├── Panel (Node)
│   ├── Title (Label)             // 「选择加倍」
│   ├── SingleButton (Button)     // 「不加倍」
│   ├── DoubleButton (Button)     // 「加倍 ×2」
│   ├── Timer (Label)             // 倒计时「10」
│   └── StatusLabel (Label)       // 「等待其他玩家...」
```

#### 3.2.4 滑入动画

**入场动画**（从顶部滑入）:
```typescript
onLoad(): void {
    // 初始位置：顶部外（y = 800）
    this.panel.setPosition(0, 800, 0);
}

show(params: { timeout: number }): void {
    // 滑入动画（300ms ease-out）
    tween(this.panel)
        .to(0.3, { position: new Vec3(0, 0, 0) }, { easing: 'sineOut' })
        .start();
    
    // 启动倒计时
    this._startCountdown(params.timeout);
}
```

**退场动画**（向顶部滑出）:
```typescript
hide(): void {
    // 滑出动画（200ms ease-in）
    tween(this.panel)
        .to(0.2, { position: new Vec3(0, 800, 0) }, { easing: 'sineIn' })
        .call(() => {
            oops.gui.remove(UIId.DoublingView);
        })
        .start();
}
```

#### 3.2.5 按钮交互

```typescript
onSingleClick(): void {
    if (this._submitted) return;
    
    this._submitted = true;
    this._disableButtons();
    
    // 发送 set_double(1)
    netManager.sendSetDouble(1);
    
    // 更新状态
    this.statusLabel.string = '等待其他玩家...';
    this.statusLabel.node.active = true;
}

onDoubleClick(): void {
    if (this._submitted) return;
    
    this._submitted = true;
    this._disableButtons();
    
    // 发送 set_double(2)
    netManager.sendSetDouble(2);
    
    // 更新状态
    this.statusLabel.string = '已加倍，等待其他玩家...';
    this.statusLabel.node.active = true;
}

private _disableButtons(): void {
    this.singleButton.interactable = false;
    this.doubleButton.interactable = false;
}
```

#### 3.2.6 倒计时

**与 CodeCardSelector 类似**:
```typescript
private _onTick = (): void => {
    this._remaining--;
    this.timerLabel.string = String(this._remaining);
    
    // 颜色变化
    if (this._remaining > 5) {
        this.timerLabel.color = Color.WHITE;
    } else if (this._remaining > 3) {
        this.timerLabel.color = Color.YELLOW;
    } else {
        this.timerLabel.color = Color.RED;
    }
    
    // 超时自动选「不加倍」
    if (this._remaining <= 0) {
        this.unschedule(this._onTick);
        if (!this._submitted) {
            this.onSingleClick();  // 自动选不加倍
        }
    }
};
```

#### 3.2.7 结果展示

**收到 doubling_result 后显示全员选择**:
```typescript
onDoublingResult(msg: { results: Array<{ seatIndex: number; doubled: boolean }> }): void {
    // 禁用按钮
    this._disableButtons();
    
    // 显示结果（2s）
    const resultText = msg.results
        .map(r => {
            const nickname = this._seats[r.seatIndex].nickname;
            const choice = r.doubled ? '加倍 ×2' : '不加倍';
            return `${nickname}: ${choice}`;
        })
        .join('\n');
    
    this.statusLabel.string = resultText;
    this.statusLabel.node.active = true;
    
    // 2s 后关闭
    this.scheduleOnce(() => {
        this.hide();
    }, 2.0);
}
```

#### 3.2.8 验收标准

- **AC-1**: doubling 阶段弹出
- **AC-2**: 滑入动画（从顶部 y=800 → y=0，300ms ease-out）
- **AC-3**: 显示「不加倍」「加倍 ×2」两个按钮
- **AC-4**: 点击任一按钮发送 `set_double` 并禁用按钮
- **AC-5**: 倒计时颜色：>5s 白色、3-5s 黄色、<3s 红色
- **AC-6**: 超时自动选「不加倍」
- **AC-7**: 收到 `doubling_result` 后显示全员选择（2s）
- **AC-8**: 滑出动画（向顶部 y=0 → y=800，200ms ease-in）

---

### 3.3 SettlementView（结算界面）

#### 3.3.1 组件职责

结算界面负责：
- game_over 时弹出
- 显示胜负结果（地主方胜/农民方胜）
- 显示 5 个玩家的结算信息（PlayerResultCard）
- 身份揭晓动画（角色图标 stagger 显示）
- 显示倍率明细（底分、炸弹、春天、反春）
- 提供「再来一局」「返回大厅」按钮

#### 3.3.2 触发时机

```typescript
// GameMgr.ts
onGameOver(msg: GameOverMsg): void {
    oops.gui.open(UIId.SettlementView, {
        players: msg.players,
        breakdown: msg.breakdown,
        winnerSide: msg.winnerSide,  // 'landlord' | 'peasant'
    });
}
```

#### 3.3.3 UI 元素结构

```
SettlementView (Modal)
├── Background (Sprite)                 // 全屏遮罩
├── Panel (Node)
│   ├── Title (Label)                   // 「游戏结束」
│   ├── ResultBanner (Sprite)           // 「地主方胜利」或「农民方胜利」
│   ├── PlayerResultCards (Node)        // 5 个玩家结算卡片
│   │   ├── PlayerCard1 (Node)
│   │   ├── PlayerCard2 (Node)
│   │   ├── PlayerCard3 (Node)
│   │   ├── PlayerCard4 (Node)
│   │   └── PlayerCard5 (Node)
│   ├── BreakdownPanel (Node)           // 倍率明细
│   │   ├── BaseScore (Label)           // 「底分: 10」
│   │   ├── LandlordDouble (Label)      // 「地主加倍: ×2」
│   │   ├── BombCount (Label)           // 「炸弹: ×2」
│   │   ├── SpringBonus (Label)         // 「春天: ×2」
│   │   └── TotalMultiplier (Label)     // 「总倍率: ×8」
│   ├── PlayAgainButton (Button)        // 「再来一局」
│   └── ReturnHallButton (Button)       // 「返回大厅」
```

#### 3.3.4 PlayerResultCard 结构

```
PlayerResultCard (Node)
├── Avatar (Sprite)                     // 头像
├── Nickname (Label)                    // 昵称
├── RoleIcon (Sprite)                   // 角色图标（地主/队友/平民）
├── RoleLabel (Label)                   // 角色文本「地主」
├── ScoreDelta (Label)                  // 分数变化「+120」
└── NewScore (Label)                    // 新余额「余额: 1200」
```

**布局**（5 个卡片横向排列）:
```typescript
const CARD_POSITIONS: [number, number][] = [
    [-400, 0],   // 玩家 1
    [-200, 0],   // 玩家 2
    [0, 0],      // 玩家 3
    [200, 0],    // 玩家 4
    [400, 0],    // 玩家 5
];
```

#### 3.3.5 入场动画

**Fade-in + Scale**:
```typescript
show(params: SettlementParams): void {
    // 初始状态
    this.panel.setScale(0.8, 0.8, 1);
    const opacity = this.panel.getComponent(UIOpacity);
    opacity.opacity = 0;
    
    // 入场动画（500ms）
    tween(this.panel)
        .to(0.5, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'backOut' })
        .start();
    
    tween(opacity)
        .to(0.5, { opacity: 255 })
        .call(() => {
            // 动画结束后播放身份揭晓
            this._playRoleRevealAnimation();
        })
        .start();
    
    // 填充数据
    this._fillData(params);
}
```

#### 3.3.6 身份揭晓动画

**Stagger 显示**（每个卡片延迟 100ms）:
```typescript
private _playRoleRevealAnimation(): void {
    this._playerCards.forEach((card, i) => {
        // 初始隐藏角色图标
        card.roleIcon.node.active = false;
        card.roleLabel.node.active = false;
        
        // 延迟显示
        this.scheduleOnce(() => {
            // Fade-in + Scale
            card.roleIcon.node.active = true;
            card.roleLabel.node.active = true;
            
            card.roleIcon.node.setScale(0, 0, 1);
            const opacity = card.roleIcon.node.getComponent(UIOpacity);
            opacity.opacity = 0;
            
            tween(card.roleIcon.node)
                .to(0.3, { scale: new Vec3(1.2, 1.2, 1) })
                .to(0.1, { scale: new Vec3(1.0, 1.0, 1) })
                .start();
            
            tween(opacity)
                .to(0.4, { opacity: 255 })
                .start();
            
            // 音效（可选）
            // oops.audio.playEffect('role_reveal');
        }, i * 0.1);  // 100ms stagger
    });
}
```

#### 3.3.7 倍率明细

**显示规则**:
```typescript
private _fillBreakdown(breakdown: BreakdownV2): void {
    // 底分
    this.baseScoreLabel.string = `底分: ${breakdown.baseScore}`;
    
    // 地主加倍
    const landlordDoubleStr = breakdown.landlordDouble === 2 ? '×2' : '×1';
    this.landlordDoubleLabel.string = `地主加倍: ${landlordDoubleStr}`;
    
    // 炸弹（每个炸弹 ×2）
    const bombCount = this._countBombs(breakdown);
    if (bombCount > 0) {
        this.bombCountLabel.string = `炸弹: ×${Math.pow(2, bombCount)}`;
        this.bombCountLabel.node.active = true;
    } else {
        this.bombCountLabel.node.active = false;
    }
    
    // 春天
    if (breakdown.isSpring) {
        this.springBonusLabel.string = '春天: ×2';
        this.springBonusLabel.node.active = true;
    } else {
        this.springBonusLabel.node.active = false;
    }
    
    // 反春
    if (breakdown.isAntiSpring) {
        this.antiSpringLabel.string = '反春: ×2';
        this.antiSpringLabel.node.active = true;
    } else {
        this.antiSpringLabel.node.active = false;
    }
    
    // 总倍率
    const totalMultiplier = this._calculateTotalMultiplier(breakdown);
    this.totalMultiplierLabel.string = `总倍率: ×${totalMultiplier}`;
}
```

#### 3.3.8 按钮交互

**再来一局**:
```typescript
onPlayAgainClick(): void {
    if (this._rematchPending) return;
    
    this._rematchPending = true;
    this.playAgainButton.interactable = false;
    
    // 发送 rematch 消息
    netManager.sendRematch();
    
    // 显示等待状态
    this.rematchStatusLabel.string = '等待其他玩家...';
    this.rematchStatusLabel.node.active = true;
}

// 收到 rematch_confirmed 后
onRematchConfirmed(): void {
    oops.gui.remove(UIId.SettlementView);
    // GameMgr 会自动重置状态，进入 waiting 阶段
}
```

**返回大厅**:
```typescript
onReturnHallClick(): void {
    oops.gui.remove(UIId.SettlementView);
    director.loadScene('HallScene');
}
```

#### 3.3.9 验收标准

- **AC-1**: game_over 时弹出
- **AC-2**: 入场动画（fade-in + scale 0.8 → 1.0，500ms backOut）
- **AC-3**: 显示胜负横幅（「地主方胜利」或「农民方胜利」）
- **AC-4**: 显示 5 个 PlayerResultCard（头像、昵称、角色、分数）
- **AC-5**: 身份揭晓动画（100ms stagger，fade-in + scale）
- **AC-6**: 倍率明细显示（底分、加倍、炸弹、春天、反春、总倍率）
- **AC-7**: 「再来一局」发送 rematch，显示「等待其他玩家...」
- **AC-8**: 「返回大厅」关闭弹窗并加载 HallScene
- **AC-9**: rematch_confirmed 后关闭弹窗，进入 waiting 阶段

---

## 四、状态转换与 UI 响应

### 4.1 状态机完整流程

| 阶段 | 服务端 phase | 客户端状态 | 触发消息 | UI 变化 |
|------|-------------|-----------|---------|---------|
| **等待开局** | waiting | WAITING | room_update | 显示「等待中...」，席位信息更新 |
| **发牌中** | dealing | DEALING | dealing_start | 发牌动画（50ms stagger × 20 张） |
| **选暗号牌** | landlord_select | LANDLORD_SELECT | landlord_select | 弹出 CodeCardSelector（仅候选地主） |
| **暗号牌揭晓** | - | CODE_CARD_REVEAL | code_card_reveal | 播放揭晓动画（4s） |
| **加倍选择** | doubling | DOUBLING | doubling_start | 弹出 DoublingView |
| **加倍结果** | - | DOUBLING_RESULT | doubling_result | 显示全员选择（2s） |
| **出牌中** | playing | PLAYING | turn_change | 更新轮次指示器，启用/禁用按钮 |
| **结算** | settlement | SETTLEMENT | game_over | 弹出 SettlementView |

---

### 4.2 waiting（等待开局）

**进入时**:
```typescript
onEnterWaiting(): void {
    // 隐藏所有游戏 UI
    this.handCardView.node.active = false;
    this.playZone.node.active = false;
    this.bottomCardsDisplay.node.active = false;
    
    // 显示等待提示
    this.waitingLabel.string = '等待其他玩家加入...';
    this.waitingLabel.node.active = true;
    
    // 更新席位信息
    this._updateSeats();
}
```

**监听消息**:
- `room_update`: 更新席位人员列表
- `dealing_start`: 进入 dealing 阶段

---

### 4.3 dealing（发牌中）

**进入时**:
```typescript
onDealingStart(msg: { handCards: number[] }): void {
    // 隐藏等待提示
    this.waitingLabel.node.active = false;
    
    // 显示游戏 UI
    this.handCardView.node.active = true;
    this.playZone.node.active = true;
    
    // 播放发牌动画
    this.handCardView.playDealingAnimation(msg.handCards);
    
    // 禁用所有按钮
    this.handCardView.setInteractable(false);
}
```

**发牌动画结束后**:
```typescript
onDealingAnimationComplete(): void {
    // 发送 dealing_ready
    netManager.sendDealingReady();
}
```

**监听消息**:
- `landlord_select`: 进入 landlord_select 阶段

---

### 4.4 landlord_select（选暗号牌）

**进入时**:
```typescript
onLandlordSelect(msg: { candidates: number[] }): void {
    const myServerIndex = this._getMyServerIndex();
    
    if (msg.candidates.includes(myServerIndex)) {
        // 自己是候选地主 → 弹出暗号牌选择
        oops.gui.open(UIId.CodeCardSelector, {
            handCards: this._handCards,
            timeout: 10,
        });
    } else {
        // 不是候选地主 → 显示等待提示
        this.waitingLabel.string = '等待地主选择暗号牌...';
        this.waitingLabel.node.active = true;
    }
}
```

**监听消息**:
- `landlord_reveal`: 揭晓地主 + 底牌
- `code_card_reveal`: 播放暗号牌揭晓动画

---

### 4.5 code_card_reveal（暗号牌揭晓）

**进入时**:
```typescript
onCodeCardReveal(msg: { suit: number; value: number; landlordSeatIndex: number }): void {
    // 关闭 CodeCardSelector
    oops.gui.remove(UIId.CodeCardSelector);
    
    // 播放揭晓动画（≤4s）
    const landlordSeat = this._seats[msg.landlordSeatIndex];
    landlordSeat.playCodeCardRevealAnimation(msg.suit, msg.value);
    
    // 4s 后服务端自动推进到 doubling
}
```

**揭晓动画**:
```typescript
// PlayerSeat.ts
playCodeCardRevealAnimation(suit: number, value: number): void {
    // 显示暗号牌（闪烁动画）
    this.codeCardSprite.string = this._formatCard(suit, value);
    this.codeCardSprite.node.active = true;
    
    // 闪烁动画（4 次，每次 1s）
    tween(this.codeCardSprite.node)
        .to(0.5, { scale: new Vec3(1.2, 1.2, 1) })
        .to(0.5, { scale: new Vec3(1.0, 1.0, 1) })
        .union()
        .repeat(4)
        .start();
}
```

**监听消息**:
- `doubling_start`: 进入 doubling 阶段

---

### 4.6 doubling（加倍选择）

**进入时**:
```typescript
onDoublingStart(msg: { timeout: number; landlordSeatIndex: number }): void {
    // 弹出 DoublingView
    oops.gui.open(UIId.DoublingView, {
        timeout: msg.timeout,
        landlordSeatIndex: msg.landlordSeatIndex,
    });
}
```

**监听消息**:
- `landlord_doubled`: 地主已选择加倍
- `doubling_result`: 全员加倍结果

---

### 4.7 doubling_result（加倍结果展示）

**进入时**:
```typescript
onDoublingResult(msg: { results: Array<{ seatIndex: number; doubled: boolean }> }): void {
    // DoublingView 显示结果（2s）
    // 2s 后服务端自动推进到 playing
}
```

**监听消息**:
- `turn_change`: 进入 playing 阶段

---

### 4.8 playing（出牌中）

**进入时**:
```typescript
onEnterPlaying(): void {
    // 关闭 DoublingView
    oops.gui.remove(UIId.DoublingView);
    
    // 启用手牌交互
    this.handCardView.setInteractable(true);
}
```

**轮次变化**:
```typescript
onTurnChange(msg: TurnChangeMsg): void {
    const currentSeatIndex = this._mapServerToSeat(msg.currentPlayerIndex);
    
    // 更新轮次指示器
    this._seats.forEach((seat, i) => {
        seat.setTurnActive(i === currentSeatIndex, msg.timeLeft);
    });
    
    // 更新手牌区按钮状态
    const isMyTurn = (currentSeatIndex === 0);
    this.handCardView.setTurnActive(isMyTurn);
    this.handCardView.setPassEnabled(!msg.isNewRound);
}
```

**监听消息**:
- `turn_change`: 轮次变化
- `play_broadcast`: 玩家出牌
- `pass_broadcast`: 玩家过牌
- `game_over`: 游戏结束

---

### 4.9 settlement（结算）

**进入时**:
```typescript
onGameOver(msg: GameOverMsg): void {
    // 弹出 SettlementView
    oops.gui.open(UIId.SettlementView, {
        players: msg.players,
        breakdown: msg.breakdown,
        winnerSide: msg.winnerSide,
    });
}
```

**监听消息**:
- `rematch_confirmed`: 再来一局确认，重置状态进入 waiting

---

## 五、动画时序表

### 5.1 发牌动画

**时序**:
```
0ms     → 开始发牌
50ms    → 第 2 张牌飞入
100ms   → 第 3 张牌飞入
...
950ms   → 第 20 张牌飞入
1000ms  → 发牌完成，发送 dealing_ready
```

**实现**:
```typescript
playDealingAnimation(cards: number[]): void {
    cards.forEach((code, i) => {
        this.scheduleOnce(() => {
            this._addCard(code);
            
            // 飞入动画（300ms ease-out）
            const item = this._cardItems[code];
            const startPos = new Vec3(0, 400, 0);  // 从屏幕上方飞入
            const endPos = item.node.position;
            
            item.node.setPosition(startPos);
            tween(item.node)
                .to(0.3, { position: endPos }, { easing: 'sineOut' })
                .start();
            
            // 最后一张时回调
            if (i === cards.length - 1) {
                this.scheduleOnce(() => {
                    this._onDealingComplete();
                }, 0.3);
            }
        }, i * 0.05);  // 50ms stagger
    });
}
```

---

### 5.2 暗号牌揭晓动画

**时序**:
```
0ms     → 收到 code_card_reveal 消息
0ms     → 地主席位显示暗号牌
0-4000ms → 闪烁动画（4 次，每次 1s）
4000ms  → 服务端自动推进到 doubling
```

**实现**:
```typescript
playCodeCardRevealAnimation(suit: number, value: number): void {
    this.codeCardLabel.string = this._formatCard(suit, value);
    this.codeCardLabel.node.active = true;
    
    // 闪烁动画（scale 1.0 ↔ 1.2，4 次）
    tween(this.codeCardLabel.node)
        .to(0.5, { scale: new Vec3(1.2, 1.2, 1) })
        .to(0.5, { scale: new Vec3(1.0, 1.0, 1) })
        .union()
        .repeat(4)
        .start();
}
```

---

### 5.3 加倍结果展示动画

**时序**:
```
0ms     → 收到 doubling_result 消息
0ms     → DoublingView 显示全员选择结果
0-2000ms → 展示结果文本
2000ms  → 服务端自动推进到 playing
2000ms  → DoublingView 滑出（200ms）
2200ms  → DoublingView 关闭
```

**实现**: 见 3.2.7 DoublingView.onDoublingResult()

---

### 5.4 Hint 高亮动画

**时序**:
```
0ms     → 收到 hint 推荐
0ms     → 自动选中推荐的牌
0-1500ms → 闪烁动画（3 次，每次 0.5s）
1500ms  → 动画结束，保持选中状态
```

**实现**: 见 2.1.5 HandCardView.selectHint()

---

### 5.5 出牌飞入动画

**时序**:
```
0ms     → 玩家出牌
0ms     → MiniCardItem 从席位飞向 PlayZone
0-50ms  → 第 2 张牌飞入（stagger）
0-100ms → 第 3 张牌飞入（stagger）
...
300ms   → 所有牌飞入完成
300ms   → 淡入动画完成（opacity 0 → 255）
```

**实现**: 见 2.2.4 PlayZone.showPlayedCards()

---

### 5.6 底牌融入动画

**时序**:
```
0ms     → 收到 landlord_reveal 消息
0ms     → 显示 3 张底牌（屏幕中央上方）
2000ms  → 开始融入动画
2000ms  → 第 1 张牌飞向地主（贝塞尔曲线，800ms）
2200ms  → 第 2 张牌飞向地主
2400ms  → 第 3 张牌飞向地主
3200ms  → 所有底牌融入完成
3200ms  → 地主手牌数量 +3
```

**实现**: 见 2.4.3 BottomCardsDisplay.flyToLandlord()

---

### 5.7 结算入场动画

**时序**:
```
0ms     → 收到 game_over 消息
0ms     → SettlementView 弹出
0-500ms → Fade-in + Scale 动画（0.8 → 1.0，backOut）
500ms   → 入场动画完成
500ms   → 开始身份揭晓动画
500ms   → 第 1 个玩家角色显示（fade-in + scale）
600ms   → 第 2 个玩家角色显示
700ms   → 第 3 个玩家角色显示
800ms   → 第 4 个玩家角色显示
900ms   → 第 5 个玩家角色显示
900ms   → 身份揭晓完成，启用按钮
```

**实现**: 见 3.3.5 + 3.3.6 SettlementView.show() + _playRoleRevealAnimation()

---

## 六、边界情况与错误处理

### 6.1 网络断线

**检测**:
```typescript
// NetManager.ts
onDisconnect(): void {
    // 显示断线提示
    oops.gui.toast('网络连接中断，正在重连...');
    
    // 禁用所有按钮
    this._gameCtrl.setAllButtonsInteractable(false);
    
    // 尝试重连
    this._reconnect();
}
```

**重连成功**:
```typescript
onReconnect(): void {
    // 隐藏提示
    oops.gui.toast('重连成功！');
    
    // 恢复按钮状态
    this._gameCtrl.restoreButtonStates();
}
```

**重连失败**:
```typescript
onReconnectFailed(): void {
    // 显示错误提示
    oops.gui.alert({
        title: '连接失败',
        message: '无法连接到服务器，请检查网络后重试',
        confirmText: '返回大厅',
        onConfirm: () => {
            director.loadScene('HallScene');
        },
    });
}
```

---

### 6.2 超时托管

**服务端通知**:
```typescript
onPlayerTimeout(msg: { playerIndex: number }): void {
    const seatIndex = this._mapServerToSeat(msg.playerIndex);
    const seat = this._seats[seatIndex];
    
    // 显示托管标识
    seat.showHostingBadge(true);
    seat.statusLabel.string = '托管中';
    seat.statusLabel.node.active = true;
}
```

**取消托管**:
```typescript
onPlayerResumeControl(msg: { playerIndex: number }): void {
    const seatIndex = this._mapServerToSeat(msg.playerIndex);
    const seat = this._seats[seatIndex];
    
    // 隐藏托管标识
    seat.showHostingBadge(false);
    seat.statusLabel.node.active = false;
}
```

---

### 6.3 非法出牌

**服务端拒绝**:
```typescript
onPlayRejected(msg: { reason: string }): void {
    // 显示错误提示
    const errorMsg = {
        'INVALID_PATTERN': '请选择合法牌型',
        'CANNOT_BEAT': '无法压过上家的牌',
        'NOT_YOUR_TURN': '还没轮到你出牌',
        'INSUFFICIENT_CARDS': '手牌不足',
    }[msg.reason] || '出牌失败';
    
    oops.gui.toast(errorMsg);
    
    // 清空选择
    this.handCardView.clearSelection();
}
```

---

### 6.4 快速点击防抖

**按钮冷却**:
```typescript
// Button 扩展
private _lastClickTime: number = 0;
private _cooldown: number = 300;  // 300ms 冷却

onClick(): void {
    const now = Date.now();
    if (now - this._lastClickTime < this._cooldown) {
        // 冷却中，忽略点击
        return;
    }
    
    this._lastClickTime = now;
    this._handleClick();
}
```

---

### 6.5 资源加载失败

**头像加载失败**:
```typescript
loadAvatar(url: string): void {
    assetManager.loadRemote(url, (err, texture: Texture2D) => {
        if (err) {
            // 使用默认头像
            this.avatar.spriteFrame = this._defaultAvatar;
            console.warn(`头像加载失败: ${url}`, err);
        } else {
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            this.avatar.spriteFrame = spriteFrame;
        }
    });
}
```

**预制体加载失败**:
```typescript
loadPrefab(path: string): Promise<Prefab> {
    return new Promise((resolve, reject) => {
        resources.load(path, Prefab, (err, prefab) => {
            if (err) {
                console.error(`预制体加载失败: ${path}`, err);
                reject(err);
            } else {
                resolve(prefab);
            }
        });
    });
}
```

---

### 6.6 异常消息处理

**消息格式错误**:
```typescript
onMessage(type: string, message: any): void {
    try {
        // 验证消息格式
        if (!this._validateMessage(type, message)) {
            console.warn(`消息格式错误: ${type}`, message);
            return;
        }
        
        // 处理消息
        this._handleMessage(type, message);
    } catch (error) {
        console.error(`处理消息异常: ${type}`, error);
        // 不阻塞游戏流程
    }
}
```

**意外状态转换**:
```typescript
private _validateStateTransition(from: GamePhase, to: GamePhase): boolean {
    const validTransitions = {
        [GamePhase.WAITING]: [GamePhase.DEALING],
        [GamePhase.DEALING]: [GamePhase.LANDLORD_SELECT],
        [GamePhase.LANDLORD_SELECT]: [GamePhase.CODE_CARD_REVEAL],
        [GamePhase.CODE_CARD_REVEAL]: [GamePhase.DOUBLING],
        [GamePhase.DOUBLING]: [GamePhase.DOUBLING_RESULT],
        [GamePhase.DOUBLING_RESULT]: [GamePhase.PLAYING],
        [GamePhase.PLAYING]: [GamePhase.SETTLEMENT],
        [GamePhase.SETTLEMENT]: [GamePhase.WAITING],
    };
    
    if (!validTransitions[from]?.includes(to)) {
        console.error(`非法状态转换: ${from} → ${to}`);
        return false;
    }
    
    return true;
}
```

---

## 七、完整验收标准

### 7.1 常驻 UI 组件验收（40 AC）

#### HandCardView（12 AC）
- [x] AC-1: 手牌按 `compareValue()` 升序排列
- [x] AC-2: ≤12 张时固定间距 42px，>12 张时横向滚动
- [x] AC-3: 点击卡牌切换选中状态（上移 20px + 金色描边）
- [x] AC-4: 划选支持（拖拽选中范围内所有卡牌）
- [x] AC-5: 选中牌型实时识别并显示（「单张」「对子」等）
- [x] AC-6: 非法牌型显示「请选择合法牌型」（红色）
- [x] AC-7: 出牌按钮仅在轮到自己且选中合法牌型时 enable
- [x] AC-8: 过按钮仅在轮到自己且非首出时 enable
- [x] AC-9: Hint 推荐后自动选中并闪烁 3 次（0.5s × 3）
- [x] AC-10: 非轮次时所有按钮禁用，手牌 opacity 60%
- [x] AC-11: 发牌动画流畅（50ms stagger × 20 张）
- [x] AC-12: 发牌完成后自动发送 `dealing_ready`

#### PlayZone（6 AC）
- [x] AC-13: MiniCardItem 最多显示 5 张代表牌
- [x] AC-14: 顺子显示「3 4 5 ... 7」格式
- [x] AC-15: 当前回合标识圆环颜色正确（绿色=己方，灰色=其他）
- [x] AC-16: 新回合时清空所有玩家出牌记录
- [x] AC-17: 出牌飞入动画流畅（300ms ease-out + 50ms stagger）
- [x] AC-18: 出牌淡入动画（opacity 0 → 255，300ms）

#### PlayerSeat × 5（10 AC）
- [x] AC-19: 显示玩家头像、昵称、手牌数量
- [x] AC-20: AI 玩家显示机器人图标 + 昵称前缀「[AI]」
- [x] AC-21: 轮到时圆环金色高亮 + 脉冲动画（scale 1.0 ↔ 1.2）
- [x] AC-22: 倒计时颜色：>10s 白色、5-10s 黄色、<5s 红色
- [x] AC-23: 身份标签颜色正确（地主红色、队友蓝色、平民灰色）
- [x] AC-24: 非轮次时 opacity 60%
- [x] AC-25: 视角旋转后自己永远在底部（seatIndex=0）
- [x] AC-26: 托管时显示「托管中」标识
- [x] AC-27: 手牌数量实时更新（出牌 -N，抓牌 +N）
- [x] AC-28: 席位坐标正确（底部居中、右邻、右上、左上、左邻）

#### BottomCardsDisplay（5 AC）
- [x] AC-29: landlord_reveal 后显示 3 张底牌（屏幕中央上方）
- [x] AC-30: 显示标签「底牌」
- [x] AC-31: 2s 后播放融入动画
- [x] AC-32: 飞行路径为贝塞尔曲线（抛物线，向上拱起 100px）
- [x] AC-33: 3 张牌依次飞出（200ms stagger）
- [x] AC-34: 飞行过程中卡牌缩小（scale 1.0 → 0.5）
- [x] AC-35: 地主席位手牌数量 +3

---

### 7.2 弹窗组件验收（26 AC）

#### CodeCardSelector（8 AC）
- [ ] AC-36: landlord_select 阶段且自己是候选地主时弹出
- [ ] AC-37: 显示前 4 张手牌（花色 + 点数，如「♠3」）
- [ ] AC-38: 点击卡牌切换选中（金色高亮 + 放大 10%）
- [ ] AC-39: 单选模式（最多选 1 张）
- [ ] AC-40: 未选中时「确认」按钮禁用（opacity 40%）
- [ ] AC-41: 倒计时颜色：>5s 白色、3-5s 黄色、<3s 红色
- [ ] AC-42: 超时自动选第一张
- [ ] AC-43: 确认后发送 `select_code_card` 并关闭弹窗

#### DoublingView（9 AC）
- [ ] AC-44: doubling 阶段弹出
- [ ] AC-45: 滑入动画（从顶部 y=800 → y=0，300ms ease-out）
- [ ] AC-46: 显示「不加倍」「加倍 ×2」两个按钮
- [ ] AC-47: 点击任一按钮发送 `set_double` 并禁用按钮
- [ ] AC-48: 倒计时颜色：>5s 白色、3-5s 黄色、<3s 红色
- [ ] AC-49: 超时自动选「不加倍」
- [ ] AC-50: 收到 `doubling_result` 后显示全员选择（2s）
- [ ] AC-51: 滑出动画（向顶部 y=0 → y=800，200ms ease-in）
- [ ] AC-52: 地主已选择加倍时显示「地主已加倍 ×2」

#### SettlementView（9 AC）
- [ ] AC-53: game_over 时弹出
- [ ] AC-54: 入场动画（fade-in + scale 0.8 → 1.0，500ms backOut）
- [ ] AC-55: 显示胜负横幅（「地主方胜利」或「农民方胜利」）
- [ ] AC-56: 显示 5 个 PlayerResultCard（头像、昵称、角色、分数）
- [ ] AC-57: 身份揭晓动画（100ms stagger，fade-in + scale）
- [ ] AC-58: 倍率明细显示（底分、加倍、炸弹、春天、反春、总倍率）
- [ ] AC-59: 「再来一局」发送 rematch，显示「等待其他玩家...」
- [ ] AC-60: 「返回大厅」关闭弹窗并加载 HallScene
- [ ] AC-61: rematch_confirmed 后关闭弹窗，进入 waiting 阶段

---

### 7.3 状态转换验收（10 AC）

- [ ] AC-62: waiting → dealing 转换正常（收到 dealing_start）
- [ ] AC-63: dealing → landlord_select 转换正常（所有客户端 dealing_ready）
- [ ] AC-64: landlord_select → code_card_reveal 转换正常（收到 code_card_reveal）
- [ ] AC-65: code_card_reveal → doubling 转换正常（4s 后自动推进）
- [ ] AC-66: doubling → doubling_result 转换正常（收到 doubling_result）
- [ ] AC-67: doubling_result → playing 转换正常（2s 后自动推进）
- [ ] AC-68: playing → settlement 转换正常（收到 game_over）
- [ ] AC-69: settlement → waiting 转换正常（rematch_confirmed）
- [ ] AC-70: 异常状态转换被拦截（console.error 记录）
- [ ] AC-71: 断线重连后状态恢复正确

---

### 7.4 边界情况验收（5 AC）

- [ ] AC-72: 网络断线时显示「网络连接中断」Toast
- [ ] AC-73: 重连成功后恢复按钮状态
- [ ] AC-74: 托管时显示「托管中」标识
- [ ] AC-75: 非法出牌时显示错误提示（Toast）
- [ ] AC-76: 按钮快速点击防抖（300ms 冷却）

---

## 八、实现清单与工时评估

### 8.1 实现阶段划分

#### Phase 1: 常驻 UI 组件（10-12h）

**HandCardView**（4h）:
- [ ] 基础布局（≤12 张固定间距，>12 张 ScrollView）
- [ ] 单选/多选交互
- [ ] 牌型识别与显示
- [ ] Hint 高亮动画
- [ ] 发牌动画

**PlayZone**（2h）:
- [ ] MiniCardItem 布局
- [ ] 回合标识圆环
- [ ] 出牌飞入动画
- [ ] 新回合重置

**PlayerSeat × 5**（3h）:
- [ ] 席位基础信息（头像、昵称、手牌数）
- [ ] 轮次指示器（高亮 + 脉冲 + 倒计时）
- [ ] 身份标签
- [ ] 视角旋转映射

**BottomCardsDisplay**（1h）:
- [ ] 底牌显示
- [ ] 融入动画（贝塞尔曲线）

**GameCtrl 整合**（2h）:
- [ ] 初始化 7 个组件
- [ ] 消息路由
- [ ] 按钮状态管理

---

#### Phase 2: 弹窗组件（6-8h）

**CodeCardSelector**（2h）:
- [ ] 4 张手牌按钮
- [ ] 单选交互
- [ ] 倒计时
- [ ] 超时处理

**DoublingView**（2h）:
- [ ] 滑入/滑出动画
- [ ] 按钮交互
- [ ] 结果展示

**SettlementView**（3h）:
- [ ] PlayerResultCard × 5
- [ ] 身份揭晓动画
- [ ] 倍率明细
- [ ] 按钮交互

---

#### Phase 3: 状态机与消息处理（4-5h）

**GameMgr 状态机**（3h）:
- [ ] 7 个状态的进入/退出逻辑
- [ ] 状态转换验证
- [ ] 消息监听路由

**网络层对接**（2h）:
- [ ] NetManager 消息发送接口
- [ ] 消息格式验证
- [ ] 错误处理

---

#### Phase 4: 边界情况与测试（3-4h）

**边界处理**（2h）:
- [ ] 网络断线/重连
- [ ] 超时托管
- [ ] 非法出牌
- [ ] 快速点击防抖
- [ ] 资源加载失败

**单元测试**（2h）:
- [ ] HandCardView 测试（选牌、牌型识别、hint）
- [ ] PlayZone 测试（MiniCardItem、回合标识）
- [ ] PlayerSeat 测试（轮次指示、视角旋转）
- [ ] 状态机测试（转换逻辑、消息路由）

---

### 8.2 总工时评估

| 阶段 | 工作内容 | 预计工时 |
|------|---------|---------|
| **Phase 1** | 常驻 UI 组件 | 10-12h |
| **Phase 2** | 弹窗组件 | 6-8h |
| **Phase 3** | 状态机与消息处理 | 4-5h |
| **Phase 4** | 边界情况与测试 | 3-4h |
| **缓冲** | Bug 修复、优化 | 2-3h |
| **总计** | | **25-32h** |

**预计完成时间**: 3-4 个工作日（每天 8 小时）

---

### 8.3 依赖与前置条件

**前置条件**:
- [x] GameMgr.ts 已完成（状态机框架）
- [x] NetManager.ts 已完成（网络层）
- [x] shared/ 层已完成（CardEncoding、PatternHelper）
- [x] UIId 配置已完成
- [x] oops-framework 已集成

**外部依赖**:
- Server-Dev: TASK-050s 已完成（dealing_ready / code_card_reveal / doubling_result 协议）
- PM: 本 Spec 已完成并审批
- Designer: 美术资源已准备（头像、卡牌、按钮、背景）

---

## 九、实现建议

### 9.1 开发顺序

**推荐顺序**（降低风险）:
1. **HandCardView** — 核心交互，先打通
2. **PlayerSeat** — 轮次指示，依赖较少
3. **PlayZone** — 依赖 HandCardView 出牌
4. **BottomCardsDisplay** — 独立动画
5. **CodeCardSelector** — 简单弹窗
6. **DoublingView** — 中等复杂弹窗
7. **SettlementView** — 最复杂弹窗
8. **状态机整合** — 串联所有组件
9. **边界处理** — 补充健壮性

---

### 9.2 代码规范

**文件头注释**:
```typescript
/**
 * @file HandCardView.ts
 * @description 手牌区 CC Component：排序展示、对象池复用、选牌 + 牌型实时提示
 * @layer ctrl
 * @module client/ui/game
 */
```

**JSDoc 注释**:
```typescript
/**
 * 选中 hint 推荐的牌并播放闪烁动画
 * @param hintCards 服务端推荐的牌（0-107 编码数组）
 */
selectHint(hintCards: number[]): void {
    // ...
}
```

**命名规范**:
- 私有属性: `_cardItems`
- 私有方法: `_updatePatternUI()`
- 回调方法: `_onTick = () => {}`
- 常量: `CARD_WIDTH`

---

### 9.3 性能优化

**对象池**:
```typescript
// CardItem 使用对象池复用
private _cardPool: NodePool = new NodePool();

private _addCard(code: number): void {
    let node = this._cardPool.get();
    if (!node) {
        node = instantiate(this.cardItemPrefab);
    }
    // ...
}

private _removeCard(code: number): void {
    const item = this._cardItems[code];
    this._cardPool.put(item.node);
}
```

**动画优化**:
```typescript
// 避免每帧 tween，使用 schedule
this.schedule(this._onPulse, 0.5);

private _onPulse = (): void => {
    // 脉冲动画逻辑
};
```

**资源预加载**:
```typescript
onLoad(): void {
    // 预加载所有 Prefab
    const prefabs = [
        'prefabs/CardItem',
        'prefabs/PlayerSeat',
        'prefabs/MiniCardItem',
    ];
    
    prefabs.forEach(path => {
        resources.preload(path, Prefab);
    });
}
```

---

### 9.4 测试策略

**单元测试覆盖**:
- HandCardView: 选牌、牌型识别、hint、发牌动画
- PlayZone: MiniCardItem 生成、回合标识、新回合重置
- PlayerSeat: 轮次指示、倒计时、视角旋转
- 状态机: 转换验证、消息路由

**集成测试**:
- 完整游戏流程（waiting → dealing → ... → settlement）
- 断线重连
- 超时托管

**人工验证**:
- Cocos Editor 预览（所有动画流畅）
- 真机测试（Android + iOS）
- 多端联调（5 个真人/AI 混合）

---

## 十、参考资料

### 10.1 相关文档

- `docs/PROTOCOL.md` — 网络协议完整定义
- `docs/GAME-RULES.md` — 游戏规则完整定义
- `specs/ui-flow-03-deal-landlord.md` — 发牌/选地主阶段 UI
- `specs/ui-flow-04-doubling-play.md` — 加倍/出牌阶段 UI
- `specs/ui-flow-05-settlement-rematch.md` — 结算/再来一局 UI
- `specs/animation-sync.md` — 动画同步修复方案

### 10.2 代码参考

- `client/assets/scripts/logic/GameMgr.ts` — 游戏业务逻辑
- `client/assets/scripts/net/NetManager.ts` — 网络层
- `shared/PatternHelper.ts` — 牌型识别引擎
- `shared/CardEncoding.ts` — 0-107 编码解码

### 10.3 技术栈文档

- Cocos Creator 3.8 官方文档: https://docs.cocos.com/creator/3.8/
- oops-framework 文档: https://github.com/dgflash/oops-framework
- TypeScript 官方文档: https://www.typescriptlang.org/

---

**文档版本**: v1.0  
**创建时间**: 2026-07-09  
**作者**: PM Agent  
**审批**: 待 Client-Dev 认领后开始  
**预计完成**: 2026-07-12（3-4 个工作日）

---

## 附录：常见问题 FAQ

### Q1: 为什么发牌动画是 50ms stagger 而不是更快？

**A**: 50ms（20 FPS）是人眼能清晰分辨的最小间隔。更快会导致卡牌"糊"在一起，视觉效果差。

### Q2: 为什么暗号牌揭晓要 4s 窗口期？

**A**: 4s = 闪烁动画 4 次 × 1s。给玩家足够时间看清暗号牌，提升体验。

### Q3: 为什么 PlayerSeat 要视角旋转而不是固定布局？

**A**: 5 人游戏中，玩家需要清楚知道「谁在我左边/右边」。自己永远在底部，符合直觉。

### Q4: 为什么倒计时颜色变化是 >5s/3-5s/<3s 而不是其他阈值？

**A**: 10s 总时长中，前 5s 充裕（白色），中间 2s 提醒（黄色），最后 3s 紧张（红色），符合用户心理。

### Q5: 为什么 DoublingView 要滑入/滑出动画？

**A**: 滑入/滑出比 fade-in/out 更有方向感，视觉引导明确（从顶部来，回到顶部去）。

### Q6: 为什么 SettlementView 身份揭晓是 100ms stagger 而不是同时显示？

**A**: Stagger 创造「依次揭晓」的仪式感，提升悬念和代入感。

### Q7: 如何处理 >12 张手牌的滚动？

**A**: 使用 Cocos ScrollView 组件，horizontal 模式，elastic=false，inertia=true，自动计算 content 宽度。

### Q8: 如何优化 20 张卡牌的对象池？

**A**: 预创建 25 个 CardItem 节点，复用率 >95%。出牌后回收，下局复用。

---

**END OF DOCUMENT**
