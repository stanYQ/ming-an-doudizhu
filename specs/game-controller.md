# Spec: 客户端游戏状态机 GameController

**任务 ID**: TASK-011  
**目标模块**: client  
**优先级**: P2  
**状态**: ready  
**前置依赖**: TASK-010（NetManager）done

---

## 背景

来源：TDD v1.0 第三章（3.3 客户端类设计、3.5 客户端状态机）。GameController 是客户端对局总控，监听服务端 `GameState.phase` 变化，驱动本地状态机切换，协调各 UI 模块的显示/隐藏。不持有游戏业务逻辑，只做状态路由和事件分发。

## 客户端状态机（不得增减状态）

```
CONNECTING → IN_LOBBY → IN_ROOM_WAIT → DEALING → LANDLORD_SELECT → PLAYING → SETTLEMENT
```

| 服务端 phase | 客户端状态切换 | 触发动作 |
|-------------|--------------|---------|
| —（join 成功）| → IN_ROOM_WAIT | 显示等待界面，隐藏大厅 |
| `"dealing"` | → DEALING | 发牌动画 |
| `"landlord_select"` | → LANDLORD_SELECT | 地主显示暗号牌选择弹窗 |
| `"playing"` | → PLAYING | 激活手牌区，显示计时圆环 |
| `"settlement"` | → SETTLEMENT | 显示结算界面 |

## 验收标准

### 状态初始化

- AC-1: 构造时状态为 `CONNECTING`，所有 UI 不可交互
- AC-2: `NetManager.joinRoom` 完成后状态切换为 `IN_ROOM_WAIT`

### onStateChange 驱动

- AC-3: `STATE` 事件中 `phase === "dealing"` → 状态变为 `DEALING`，触发 `showDealAnimation()`
- AC-4: `phase === "landlord_select"` → 状态变为 `LANDLORD_SELECT`；若本人是地主，调用 `codeCardSelector.show()`
- AC-5: `phase === "playing"` → 状态变为 `PLAYING`，手牌区可交互
- AC-6: `phase === "settlement"` → 状态变为 `SETTLEMENT`，出牌区禁用，调用 `settlementView.show()`

### 消息响应

- AC-7: 收到 `HAND` 事件 → 调用 `handCardView.render(cards)`
- AC-8: 收到 `TURN` 事件 → 更新 `currentSeat`；若轮到本人，激活出牌按钮并启动计时倒计时
- AC-9: 收到 `PLAY` 事件 → 调用 `playZone.showLastPlay(playerId, cards)`
- AC-10: 收到 `REVEAL` 事件 → 调用 `playerSeat.showIdentity(playerId, role)`，触发全屏揭晓动画
- AC-11: 收到 `OVER` 事件 → 调用 `settlementView.showResult(data)`
- AC-12: 收到 `ERROR { code: 1001 }` → 出牌区提示「牌型不合法」
- AC-13: 收到 `ERROR { code: 1002 }` → 出牌区提示「压不过上家」
- AC-14: 收到 `ERROR { code: 1003 }` → 静默忽略（非当前回合误触）

### 出牌交互

- AC-15: 点击「出牌」按钮 → 调用 `PatternHelper.parse(selectedCards)` 预检；非法则提示，不发送请求
- AC-16: 预检通过 → 调用 `netManager.playCards(selectedCards)`
- AC-17: 点击「不要」按钮 → 调用 `netManager.pass()`
- AC-18: 非本人回合时，「出牌」和「不要」按钮不可点击（disabled）

### 暗号牌选择（仅地主）

- AC-19: 地主在 `LANDLORD_SELECT` 状态下选择合法暗号牌 → 调用 `netManager.selectCodeCard(suit, value)`
- AC-20: 选择非法点数（J/Q/K/A/2/王）→ 选择器过滤，按钮置灰，不可提交

## 接口 / 数据结构

```typescript
// client/assets/scripts/game/GameController.ts
import { PatternHelper } from "../shared/PatternHelper"; // 只读引用
import { NetManager } from "../net/NetManager";
import { EventManager } from "../core/EventManager";

enum ClientGameState {
  CONNECTING,
  IN_LOBBY,
  IN_ROOM_WAIT,
  DEALING,
  LANDLORD_SELECT,
  PLAYING,
  SETTLEMENT,
}

export class GameController {
  private state: ClientGameState = ClientGameState.CONNECTING;
  private currentSeat: number = -1;
  private mySeatIndex: number = -1;
  private mySessionId: string = "";

  // UI 组件引用（由场景注入）
  private handCardView: HandCardView;
  private playZone: PlayZone;
  private playerSeats: PlayerSeat[];        // 5个席位
  private codeCardSelector: CodeCardSelector;
  private settlementView: SettlementView;

  onLoad(): void;                            // 注册 EventManager 监听
  onDestroy(): void;                         // 注销监听，避免内存泄漏

  private onStateChange(state: any): void;   // 处理 "STATE" 事件
  private onHand(msg: { cards: number[] }): void;
  private onTurn(msg: { seatIndex: number; deadline: number }): void;
  private onPlay(msg: { playerId: string; cards: number[] }): void;
  private onReveal(msg: { playerId: string; role: string }): void;
  private onOver(msg: { winnerCamp: number; scores: object }): void;
  private onError(msg: { code: number; msg: string }): void;

  onPlayButtonClick(): void;
  onPassButtonClick(): void;
}
```

## 约束

- `PatternHelper` 只用于客户端出牌预检（AC-15），不做权威判定
- `GameController` 不直接操作 Colyseus Schema 字段，所有数据来自 EventManager 事件
- 状态切换严格按状态机转移表，不允许跳跃（如 CONNECTING 不能直接到 PLAYING）
- `onDestroy` 必须注销所有 `EventManager` 监听，防止场景切换后内存泄漏

## 不在范围内

- 重连恢复逻辑的 UI 流程（`reconnectSync` 由 NetManager 自动处理）
- 托管模式的客户端标记（服务端直接推状态，客户端无需感知托管）
- 积分结算计算（由服务端推送 `game_over.scores`，客户端只展示）

## 测试要求

- 单元测试覆盖全部 20 条 AC
- 测试方法：mock EventManager + mock UI 组件，验证状态切换和回调调用
- 边界情况：非当前回合出牌（AC-18）、REVEAL 在 PLAYING 中间触发（AC-10）
- 错误路径：AC-12 / AC-13 / AC-14 各有独立用例
