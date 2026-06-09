# Spec: 游戏房间状态机 CardRoom

**任务 ID**: TASK-008  
**目标模块**: server  
**优先级**: P1  
**状态**: ready  
**前置依赖**: TASK-005、TASK-006、TASK-007、TASK-009 全部 done

---

## 背景

来源：TDD v1.0 第四章（4.3 房间主逻辑、4.5 状态转移表）+ GAME-RULES.md 第三章（对局流程）。CardRoom 是 Colyseus Room 的核心子类，管理完整的对局生命周期：从 5 人就位到结算结束。状态机不得增减状态，消息协议不得增删字段。

## 状态机

```
waiting → dealing → landlord_select → playing → settlement → disposed
```

| 当前状态 | 触发事件 | 下一状态 | 服务端动作 |
|---------|---------|---------|-----------|
| waiting | 第 5 人加入 | dealing | 洗牌、发牌、广播明牌、私密下发手牌 |
| dealing | 发牌完成 | landlord_select | 定地主、发底牌给地主 |
| landlord_select | 地主发送 `select_code_card` | playing | 确认队友/一挑四，地主先出 |
| playing | 合法 `play_cards` | playing | 更新状态、轮转、检测身份公开、检测胜负 |
| playing | 出牌超时（30s）| playing | 自动 pass，累计超时计数 |
| playing | 连续 3 次超时 | playing | 进入托管，AI 代打 |
| playing | 手牌清空 | settlement | 判定阵营胜负，计算积分 |
| playing | 全员断线 | disposed | 回收房间 |
| settlement | 结算完成 | disposed | 写库、广播 `game_over`、回收 |

## 验收标准

### 房间生命周期

- AC-1: 第 5 名客户端 join 后，`GameState.phase` 变为 `"dealing"`，并向每人私密下发 `your_hand`
- AC-2: 发牌完成后，`phase` 变为 `"landlord_select"`，地主收到 `bottom_cards`
- AC-3: 地主发送合法 `select_code_card` 后，`phase` 变为 `"playing"`，`currentTurnSeat` 指向地主席位
- AC-4: 非地主发送 `select_code_card` → 服务端静默忽略（不广播任何错误）
- AC-5: 地主发送非法暗号牌（rank > 7）→ 广播 `error { code: 1001 }`

### 出牌流程

- AC-6: 合法 `play_cards` 被接受后，`GameState.lastPlay` 更新，`lastPlayerId` 更新，下一回合 `currentTurnSeat` 按 `turnDirection` 轮转
- AC-7: 非当前回合玩家发送 `play_cards` → 广播 `error { code: 1003 }`，状态不变
- AC-8: 手牌不含提交的牌 → 广播 `error { code: 1004 }`，状态不变
- AC-9: 牌型非法 → 广播 `error { code: 1001 }`，状态不变
- AC-10: 压不过上家 → 广播 `error { code: 1002 }`，状态不变
- AC-11: 出牌中包含暗号牌 → 广播 `identity_reveal { playerId, role }`，**然后**继续正常出牌流程
- AC-12: 一轮中所有其他玩家 `pass` → 最后出牌者获得新一轮自由出牌权（`lastPlay` 重置为空）

### 出牌超时与托管

- AC-13: 出牌限时 30 秒，超时自动 `pass`
- AC-14: 单人连续 3 次超时 → 该玩家进入托管模式
- AC-15: 托管玩家在自由出牌轮 → 出手中 `compareValue` 最小的单张
- AC-16: 托管玩家在跟牌轮 → 直接 `pass`

### 胜负与结算

- AC-17: 某玩家手牌数归零 → `RuleEngine.determineWinner` 判定阵营，`phase` 变为 `"settlement"`
- AC-18: 身份未公开的暗队友先出完 → 服务端内部状态判定（不依赖 `revealed` 字段）
- AC-19: 结算后广播 `game_over { winnerCamp, scores }`，写入数据库后进入 `disposed`

### 断线重连

- AC-20: 玩家断线后 60 秒内重连 → 恢复 `GameState`、重发 `your_hand`、重发 `turn_change`
- AC-21: 60 秒内未重连 → 席位作废，该玩家按托管处理

### Schema 安全

- AC-22: `GameState` 中不存在任何玩家手牌数据（`hands` Map 只在 CardRoom 内存中）
- AC-23: `Player.handCount` 同步的是张数，不是牌面值

## 接口 / 数据结构

```typescript
import { Room, Client } from "@colyseus/core";
import { GameState } from "./schema/GameState";
import { CardPatternEngine } from "../logic/CardPatternEngine";
import { RuleEngine } from "../logic/RuleEngine";
import { CodeCard } from "../logic/CodeCard";
import { Deck } from "../logic/Deck";

export class CardRoom extends Room<GameState> {
  maxClients = 5;
  private hands = new Map<string, number[]>();   // 私密手牌，绝不入 Schema
  private timeoutCount = new Map<string, number>(); // 超时计数
  private managed = new Set<string>();           // 托管中的玩家

  onCreate(options: any): void;
  onJoin(client: Client, options: any): void;
  onLeave(client: Client, consented: boolean): void;

  // 消息处理（onMessage 注册在 onCreate 中）
  private onReady(client: Client): void;
  private onSelectCode(client: Client, msg: { suit: number; value: number }): void;
  private onPlay(client: Client, msg: { cards: number[] }): void;
  private onPass(client: Client): void;
  private onReconnectSync(client: Client): void;
}
```

### 消息协议（锁定，不增删字段）

**客户端 → 服务端**

| 消息 | 参数 | 触发条件 |
|------|------|---------|
| `ready` | `{}` | 玩家进入等待就绪 |
| `select_code_card` | `{ suit: number, value: number }` | 地主指定暗号牌 |
| `play_cards` | `{ cards: number[] }` | 出牌 |
| `pass` | `{}` | 不要 |
| `reconnect_sync` | `{}` | 重连后请求手牌重发 |

**服务端 → 客户端**

| 消息 | 数据 | 触发时机 |
|------|------|---------|
| `your_hand` | `{ cards: number[] }` | 发牌后 / 重连时 |
| `bottom_cards` | `{ cards: number[] }` | 地主身份确认后 |
| `identity_reveal` | `{ playerId: string, role: string }` | 暗号牌被打出 |
| `turn_change` | `{ seatIndex: number, deadline: number }` | 每次轮转 / 重连时 |
| `game_over` | `{ winnerCamp: number, scores: object }` | 结算完成 |
| `error` | `{ code: number, msg: string }` | 非法操作 |

## 约束

- 状态机严格按转移表执行，不允许跳跃或增加中间状态
- `hands` Map 只在 CardRoom 内存中，任何情况下不得入 Schema、不得广播
- 超时计时器通过 `this.clock.setTimeout` 管理，不使用 `setInterval`
- 托管 AI 只做两件事：出最小单张（自由轮）或 pass（跟牌轮）

## 不在范围内

- 积分计算公式（BaseScore × 总倍率，P3 单独实现）
- 好友房（房间码生成，P3）
- 匹配服务（MatchMaker 按段位分桶，P3）
- AI 补位（匹配超时补 AI，P3）

## 测试要求

- 单元测试覆盖全部 23 条 AC
- 集成测试：模拟 5 个 Colyseus 测试客户端跑完一局（从 waiting 到 settlement）
- 边界情况：
  - 暗队友出完手牌时身份未公开（AC-18）
  - 一挑四模式平民先出完（AC-17）
  - 第 3 次超时恰好触发托管（AC-14）
- 错误路径：AC-5/7/8/9/10 各错误码有独立用例
