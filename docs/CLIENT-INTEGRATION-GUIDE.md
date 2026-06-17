# 明暗斗地主 — 客户端对接指南 v1.0

> 权威来源：`server/src/` 实现，266/266 集成测试通过。  
> 面向 Cocos Creator 3.8 + colyseus.js 客户端开发者。

---

## 目录

1. [快速接入](#1-快速接入)
2. [牌编码参考](#2-牌编码参考)
3. [共享类型](#3-共享类型)
4. [完整游戏流程（时序）](#4-完整游戏流程时序)
5. [客户端→服务端：完整消息表](#5-客户端→服务端完整消息表)
6. [服务端→客户端：完整消息表](#6-服务端→客户端完整消息表)
7. [Schema 状态（实时同步）](#7-schema-状态实时同步)
8. [本地预校验（可选）](#8-本地预校验可选)
9. [错误处理](#9-错误处理)
10. [断线重连](#10-断线重连)
11. [HTTP 接口](#11-http-接口)
12. [环境与启动](#12-环境与启动)

---

## 1. 快速接入

### 安装

```bash
npm install colyseus.js
```

### 连接与认证

```typescript
import { Client } from "colyseus.js";

const client = new Client("ws://localhost:3000");

// 1. 登录，拿到 JWT
const res = await fetch("http://localhost:3000/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: "wx_auth_code" }),
});
const { token } = await res.json();

// 2. 设置 token — 必须在 create/joinById 之前设置
//    colyseus.js 会自动将其放入 Authorization: Bearer <token> 头
client.auth.token = token;

// 3. 创建/加入房间
const room = await client.create("card_room");
// 或加入已有房间：
// const room = await client.joinById(roomId);
```

> **关键**：`client.auth.token = token` 必须在每次 `create` / `joinById` 前设置，否则服务端报 `3001` 鉴权失败。

---

## 2. 牌编码参考

服务端所有消息中的手牌、底牌、出牌均为 `number[]`，每个整数编码一张牌。

### 编码规则（`shared/CardEncoding.ts`）

```
普通牌:  card = deck × 54 + suit × 13 + rank
小王:    card = deck × 54 + 52
大王:    card = deck × 54 + 53
```

| 参数 | 含义 | 取值 |
|------|------|------|
| `deck` | 副牌索引 | 0 或 1（双副牌，共 108 张） |
| `suit` | 花色 | 0=♠  1=♥  2=♦  3=♣ |
| `rank` | 点数 | 0=3  1=4  …  9=Q  10=K  11=A  12=2 |

### 解码工具函数（引入 shared/CardEncoding）

```typescript
import { decode, compareValue, isJoker, isLargeJoker, isSmallJoker } from "../../shared/CardEncoding";

function cardToDisplay(card: number): string {
  if (isLargeJoker(card)) return "大王";
  if (isSmallJoker(card)) return "小王";

  const { suit, rank } = decode(card) as { suit: number; rank: number; isJoker: false };
  const SUITS  = ["♠", "♥", "♦", "♣"];
  const RANKS  = ["3","4","5","6","7","8","9","10","J","Q","K","A","2"];
  return `${SUITS[suit]}${RANKS[rank]}`;
}

// 例：decode(0)  → { deck:0, suit:0, rank:0, isJoker:false } → ♠3
// 例：decode(52) → { deck:0, isJoker:true, isLarge:false }   → 小王
// 例：decode(53) → { deck:0, isJoker:true, isLarge:true }    → 大王
```

### compareValue 映射表

| 牌 | compareValue |
|----|-------------|
| 3 | 3 |
| 4 | 4 |
| … | … |
| K | 13 |
| A | 14 |
| 2 | 15 |
| 小王 | 16 |
| 大王 | 17 |

> 用于排序手牌显示。炸弹/牌型压制逻辑由服务端权威判断，客户端可用 `shared/PatternHelper.canBeat()` 做预检。

---

## 3. 共享类型

从 `shared/` 引入（纯 TS，无 Node.js 依赖，客户端可直接使用）：

```typescript
// shared/CardPattern.ts
export enum PatternType {
  SINGLE              = 'SINGLE',
  PAIR                = 'PAIR',
  TRIPLE              = 'TRIPLE',
  TRIPLE_SOLO         = 'TRIPLE_SOLO',
  TRIPLE_PAIR         = 'TRIPLE_PAIR',
  STRAIGHT            = 'STRAIGHT',
  CONSECUTIVE_PAIRS   = 'CONSECUTIVE_PAIRS',
  AIRPLANE            = 'AIRPLANE',
  AIRPLANE_SOLO_WINGS = 'AIRPLANE_SOLO_WINGS',
  AIRPLANE_PAIR_WINGS = 'AIRPLANE_PAIR_WINGS',
  BOMB                = 'BOMB',
  JOKER_BOMB_SMALL    = 'JOKER_BOMB_SMALL',
  JOKER_BOMB_BIG      = 'JOKER_BOMB_BIG',
  INVALID             = 'INVALID',
}

export interface CardPattern {
  type:         PatternType;
  cards:        number[];   // 原始编码整数，保持输入顺序
  primaryValue: number;     // 用于大小比较的主牌权重
  length:       number;     // 张数
}
```

---

## 4. 完整游戏流程（时序）

```
客户端 × 5                                    服务端 (CardRoom)
─────────────────────────────────────────────────────────────────
[所有玩家] client.auth.token = token
[所有玩家] client.create("card_room")  ──────→ onAuth(token)  →  phase: waiting
                                                第 5 位加入后自动发牌
                                        ←────  Schema delta: phase → "dealing"
                                        ←────  [私发] your_hand { cards: number[] }    ← 每人收到自己的 20 张
                                        ←────  [私发] bottom_cards { cards: number[] } ← 仅地主收到 3 张底牌
                                        ←────  Schema delta: phase → "landlord_select"
                                                         landlordSeat = N
                                                         players[*].role = "" (未揭露)

[地主] room.send("select_code_card", { suit, value })
                                        ←────  Schema delta: phase → "playing"
                                                         players[*].role 写入
                                                         isAlone = true/false
                                        ←────  [广播] turn_change { seatIndex, deadline }

── 出牌循环 ────────────────────────────────────────────────────
[当前玩家] room.send("play_cards", { cards })
                                        ←────  Schema delta: lastPlay / lastPlayerId / handCount
                                        ←────  [广播] turn_change { seatIndex, deadline }
                              （如打出暗号牌）
                                        ←────  [广播] identity_reveal { playerId, role: "partner" }
                                        ←────  Schema delta: players[id].revealed = true

[其他玩家] room.send("pass")
                                        ←────  [广播] turn_change { seatIndex, deadline }

── 结算 ────────────────────────────────────────────────────────
（某玩家出完手牌）
                                        ←────  [广播] game_over { winnerCamp, scores }
                                                房间关闭，Schema 停止更新
```

---

## 5. 客户端→服务端：完整消息表

### `ready`

预留消息，当前版本空实现。

```typescript
room.send("ready");
```

---

### `select_code_card`

仅地主在 `landlord_select` 阶段可发送。其他玩家发送后静默忽略。

```typescript
room.send("select_code_card", {
  suit:  number,  // 花色 0=♠  1=♥  2=♦  3=♣
  value: number,  // 点数 rank：0=3 … 7=10（暗号牌只能选 3–10，rank 0–7）
});
```

**约束**：
- `suit` ∈ [0, 3]
- `value` ∈ [0, 7]（对应 3、4、5、6、7、8、9、10）
- 王牌不可选（`rank` ≥ 8 会触发 `error {code: 1001}`）

---

### `play_cards`

仅当前回合玩家（`currentTurnSeat === 本玩家 seatIndex`）可发送。

```typescript
room.send("play_cards", {
  cards: number[],  // 从 your_hand 收到的牌的编码整数子集
});
```

**服务端校验顺序**（任一失败返回对应错误码）：

| 顺序 | 检查 | 错误码 |
|------|------|--------|
| 1 | 是否当前回合 | `1003` |
| 2 | 手牌是否包含这些牌 | `1004` |
| 3 | 牌型是否合法（非 INVALID） | `1001` |
| 4 | 是否能压住上家 | `1002` |

---

### `pass`

```typescript
room.send("pass");
```

只有在跟牌轮（`state.lastPlay.length > 0` 且上次出牌不是自己）才有意义。  
连续 4 次 pass → 清空 `lastPlay`，下家获得自由出牌权（`turn_change` 广播）。

---

### `reconnect_sync`

断线重连后请求补发当前手牌和回合状态。

```typescript
room.send("reconnect_sync");
```

服务端响应：私发 `your_hand`；若在 `playing` 阶段则私发 `turn_change`。

---

## 6. 服务端→客户端：完整消息表

### 私发（仅接收者本人可见）

#### `your_hand`

```typescript
room.onMessage("your_hand", (data: { cards: number[] }) => {
  // 初始发牌 20 张；断线重连后重发
  // 地主收到 select_code_card 后 handCount 变 24（含 3 张底牌）
  myHand = data.cards;
});
```

#### `bottom_cards`

```typescript
room.onMessage("bottom_cards", (data: { cards: number[] }) => {
  // 仅地主收到，3 张底牌
  // 此时地主手牌已是 23 张（your_hand 20 张 + bottom 3 张）
  // Schema 中 players[landlordSessionId].handCount === 23
  bottomCards = data.cards;
});
```

#### `error`

```typescript
room.onMessage("error", (data: { code: number; msg: string }) => {
  // 仅因本玩家操作触发，非广播
  console.error(`错误 ${data.code}: ${data.msg}`);
});
```

---

### 广播（所有玩家收到）

#### `turn_change`

```typescript
room.onMessage("turn_change", (data: {
  seatIndex: number,  // 0–4，当前出牌席位
  deadline:  number,  // Unix 时间戳 (ms)，= Date.now() + 30000
}) => {
  currentSeat = data.seatIndex;
  // 用 deadline 显示倒计时
});
```

#### `identity_reveal`

```typescript
room.onMessage("identity_reveal", (data: {
  playerId: string,     // 被揭露玩家的 sessionId
  role:     "partner",  // 当前版本仅揭露搭档
}) => {
  // Schema 中 players[playerId].revealed 也会同步变 true
});
```

#### `game_over`

```typescript
room.onMessage("game_over", (data: {
  winnerCamp: 0 | 1,  // 0 = 平民阵营胜  1 = 地主阵营胜
  scores:     {},     // P3 待填充，当前为空对象
}) => {
  // 房间即将关闭
});
```

---

## 7. Schema 状态（实时同步）

通过 `room.onStateChange` 或直接访问 `room.state` 获取。

### GameState

```typescript
interface GameState {
  phase:           string;            // "waiting" | "dealing" | "landlord_select" | "playing" | "settlement"
  players:         MapSchema<Player>; // key = sessionId
  currentTurnSeat: number;            // 0–4，-1=未开始
  lastPlayerId:    string;            // 上次出牌者 sessionId，空串=自由回合
  lastPlay:        ArraySchema<number>; // 上次出的牌，空=自由回合
  landlordSeat:    number;            // 0–4
  isAlone:         boolean;           // true=地主一挑四
}
```

### Player

```typescript
interface Player {
  sessionId: string;
  handCount: number;    // 手牌张数（不含具体牌面）
  role:      string;    // "" | "landlord" | "partner" | "civilian"
  revealed:  boolean;   // 搭档暗号牌是否已揭露
  seatIndex: number;    // 0–4，按加入顺序
}
```

**监听示例**：

```typescript
room.state.players.onAdd((player, sessionId) => {
  console.log(`玩家加入 seat=${player.seatIndex}`);
  player.listen("handCount", (count) => {
    updateHandCountUI(sessionId, count);
  });
});

room.state.listen("phase", (phase) => {
  handlePhaseChange(phase);
});

room.state.listen("currentTurnSeat", (seat) => {
  highlightCurrentPlayer(seat);
});
```

---

## 8. 本地预校验（可选）

用 `shared/PatternHelper` 在客户端做出牌预检，减少无效请求到服务端。

```typescript
import { parse, canBeat } from "../../shared/PatternHelper";
import { PatternType }     from "../../shared/CardPattern";

function tryPlayCards(selected: number[]): void {
  const pat = parse(selected);
  if (pat.type === PatternType.INVALID) {
    showError("牌型非法");
    return;
  }

  const lastPlay = [...room.state.lastPlay];  // ArraySchema → array
  if (lastPlay.length > 0) {
    const lastPat = parse(lastPlay);
    if (!canBeat(pat, lastPat)) {
      showError("压不过上家");
      return;
    }
  }

  room.send("play_cards", { cards: selected });
}
```

> 服务端是权威，客户端预检仅用于 UI 反馈提速，不能跳过服务端校验。

---

## 9. 错误处理

### WebSocket 操作错误（服务端私发 `error`）

| 错误码 | 触发场景 | 建议处理 |
|--------|---------|---------|
| `1001` | 牌型非法 / 暗号牌超范围 | 提示玩家重新选牌 |
| `1002` | 出的牌无法压住上家 | 提示"压不过"，恢复选牌状态 |
| `1003` | 非当前回合出牌 | 提示"还没轮到你" |
| `1004` | 手牌不含所出牌（客户端状态不同步） | 触发 `reconnect_sync` |
| `2001` | 房间已满 | Colyseus 内置错误，不走 `error` 消息 |
| `3001` | JWT 无效或过期 | Colyseus `MatchMakeError`，引导重新登录 |

### MatchMake 错误（连接层）

```typescript
try {
  const room = await client.create("card_room");
} catch (e: any) {
  if (e.code === 3001) {
    // token 过期，重新登录
    await refreshToken();
    client.auth.token = newToken;
    // 重试
  }
}
```

---

## 10. 断线重连

```typescript
room.onLeave((code) => {
  if (code > 1000) {
    // 非正常断线，尝试重连
    reconnect();
  }
});

async function reconnect(): Promise<void> {
  client.auth.token = storedToken;  // 必须重新设置
  const room = await client.reconnect(storedRoomId, storedSessionId);
  room.send("reconnect_sync");      // 请求补发手牌
}
```

`reconnect_sync` 响应：
- 私发 `your_hand { cards }`：补发当前手牌
- 若 `phase === "playing"`：私发 `turn_change { seatIndex, deadline }`

---

## 11. HTTP 接口

### POST /auth/login

```typescript
const res = await fetch("http://host:3000/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: wxCode }),
});
// 200
const { token, user } = await res.json();
// user: { userId, openid, nickname, avatarUrl, score, rankLevel }

// 400: 缺少 code 字段
// 500: 服务器内部错误
```

**幂等**：同一 `code` 多次登录返回相同 `userId`，不重复建用户。

### GET /auth/me

```typescript
const res = await fetch("http://host:3000/auth/me", {
  headers: { "Authorization": `Bearer ${token}` },
});
// 200: { userId, openid, nickname, avatarUrl, score, rankLevel }
// 401: token 无效/过期
// 404: 用户不存在（极端情况）
```

---

## 12. 环境与启动

### 服务端环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 监听端口 |
| `JWT_SECRET` | `dev_secret_change_me` | JWT 签名密钥 |
| `AUTH_MODE` | `stub` | `stub`=跳过微信 OAuth，`wechat`=生产模式 |
| `DB_NAME` | `game_db` | MySQL 数据库名（开发用 `mingandoudizhu`） |
| `DB_HOST` | `localhost` | MySQL 主机 |
| `DB_PASSWORD` | `` | MySQL 密码 |
| `REDIS_HOST` | `localhost` | Redis 主机 |

### 开发模式启动

```bash
# 需要 MySQL 和 Redis 在线
DB_NAME=mingandoudizhu AUTH_MODE=stub JWT_SECRET=dev_secret npm run dev
# 服务监听 ws://localhost:3000
```

### 客户端连接地址

| 环境 | 地址 |
|------|------|
| 本地开发 | `ws://localhost:3000` |
| HTTP 接口 | `http://localhost:3000` |

---

## 附录：暗号牌 rank 速查表

| `value` 字段值 | 对应点数 |
|---------------|---------|
| 0 | 3 |
| 1 | 4 |
| 2 | 5 |
| 3 | 6 |
| 4 | 7 |
| 5 | 8 |
| 6 | 9 |
| 7 | 10 |

> 暗号牌只能选 3–10（`value` 0–7），J/Q/K/A/2 及王牌均不可作为暗号牌。  
> 花色可选任意 0–3。
