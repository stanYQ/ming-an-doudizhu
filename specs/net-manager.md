# Spec: 网络管理器 NetManager

**任务 ID**: TASK-010  
**目标模块**: client  
**优先级**: P2  
**状态**: ready  
**前置依赖**: 无（接口签名已在 client/CLAUDE.md 锁定）

---

## 背景

来源：TDD v1.0 第三章（3.4 网络封装示例）。封装 Colyseus.js 客户端，统一管理 WebSocket 连接、房间加入、消息发送与接收。所有游戏消息通过 `EventManager` 全局事件总线广播，使上层模块（GameController）与网络层解耦。

## 验收标准

### 初始化与连接

- AC-1: `init(endpoint)` 创建 Colyseus `Client` 实例，不立即建立 WebSocket 连接
- AC-2: `joinRoom(name, options)` 调用 `client.joinOrCreate`，成功后将 room 存入实例变量
- AC-3: `joinRoom` 失败（服务器不可达）→ 抛出错误，调用方可 catch 并展示提示

### 消息接收 → EventManager 广播

- AC-4: 收到 `your_hand` → `EventManager.emit("HAND", msg)`
- AC-5: 收到 `identity_reveal` → `EventManager.emit("REVEAL", msg)`
- AC-6: 收到 `game_over` → `EventManager.emit("OVER", msg)`
- AC-7: 收到 `turn_change` → `EventManager.emit("TURN", msg)`
- AC-8: 收到 `play_broadcast` → `EventManager.emit("PLAY", msg)`
- AC-9: 收到 `error` → `EventManager.emit("ERROR", msg)`
- AC-10: `room.onStateChange` → `EventManager.emit("STATE", state)`

### 消息发送

- AC-11: `playCards(cards)` → 向服务端发送 `{ type: "play_cards", cards }`
- AC-12: `pass()` → 发送 `{ type: "pass" }`
- AC-13: `selectCodeCard(suit, value)` → 发送 `{ type: "select_code_card", suit, value }`
- AC-14: `reconnectSync()` → 发送 `{ type: "reconnect_sync" }`
- AC-15: `requestHint()` → 发送 `{ type: "request_hint" }`
- AC-16: `room` 为 `null` 时调用任意 send 方法 → 静默忽略（不抛出）

## 接口 / 数据结构

```typescript
// client/assets/scripts/net/NetManager.ts
import { Client, Room } from "colyseus.js";
import { EventManager } from "../core/EventManager";

export class NetManager {
  private client: Client;
  private room: Room | null = null;

  // 接口签名锁定（来自 client/CLAUDE.md，不得修改）
  init(endpoint: string): void;
  joinRoom(name: string, options: any): Promise<void>;
  playCards(cards: number[]): void;
  pass(): void;
  selectCodeCard(suit: string, value: number): void;
  reconnectSync(): void;
  requestHint(): void;
}

// EventManager 广播事件名（客户端内部约定）
// "STATE"  → Colyseus GameState schema diff
// "HAND"   → { cards: number[] }
// "REVEAL" → { playerId: string, role: string }
// "OVER"   → { winnerCamp: number, scores: object }
// "TURN"   → { seatIndex: number, deadline: number }
// "PLAY"   → { playerId: string, cards: number[] }
// "ERROR"  → { code: number, msg: string }
```

## 约束

- `NetManager` 为单例，通过 oops-framework 的全局管理器注册
- `room.onStateChange` 注册在 `joinRoom` 成功后，不在 `init` 中注册
- 不直接持有任何游戏状态，只做消息转发
- `suit` 参数类型为 `string`（如 `"heart"`），由 `CodeCardSelector` 转换后传入；不在此处做枚举转换

## 不在范围内

- 断线重连自动恢复（Colyseus 框架 `allowReconnection` 由服务端控制，客户端只需发 `reconnect_sync`）
- 房间列表查询
- 鉴权 token 的生成（属登录模块）

## 测试要求

- 单元测试覆盖全部 16 条 AC
- 测试方法：mock Colyseus Client/Room，验证消息路由正确
- 边界情况：`room = null` 时的 send（AC-16）
- 错误路径：AC-3（joinRoom 失败）
