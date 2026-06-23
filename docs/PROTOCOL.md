# 明暗斗地主 — 协议参考手册 v2.0

> 权威来源：`server/src/` 实现，356/356 集成测试通过。  
> 适用范围：client-dev（对接指南）+ server-dev（协议规范）。  
> 最后更新：TASK-032s（BUG 修复 + 环境）+ TASK-031s（再来一局）+ TASK-030s（好友房）+ TASK-029s（AI 补位）+ TASK-023（加倍阶段）+ TASK-022（SettleService V2）

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
13. [安全约束](#13-安全约束)
14. [集成测试命令](#14-集成测试命令)

---

## 1. 快速接入

### 安装

```bash
npm install colyseus.js
```

### 连接与认证

```typescript
import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");

// 1. 登录，拿到 JWT
const res = await fetch("http://localhost:2567/auth/login", {
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

### 房间类型

| 选项 | 说明 |
|------|------|
| `client.create("card_room")` | 快速匹配（默认），5 人满则开局，不足时 AI 补位 |
| `client.create("card_room", { isFriendRoom: true })` | 好友房，房主手动 `force_start` |

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
                                        ←────  [广播] waiting_update { readyCount, total:5, aiSeconds }  ← 每次有人加入/离开
                                                第 5 位加入（或 force_start / AI 补位）后自动发牌
                                        ←────  Schema delta: phase → "dealing"
                                        ←────  [私发] your_hand { cards: number[] }    ← 每人收到自己的 20 张
                                        ←────  [私发] bottom_cards { cards: number[] } ← 仅地主收到 3 张底牌
                                        ←────  Schema delta: phase → "landlord_select"
                                                         landlordSeat = N
                                                         players[*].role = "" (未揭露)

[地主] room.send("select_code_card", { suit, value })
                                        ←────  Schema delta: phase → "doubling"
                                                         players[*].role 写入
                                                         isAlone = true/false
                                        ←────  [广播] doubling_start { timeout, landlordSeatIndex }

── 加倍阶段 ─────────────────────────────────────────────────────
[地主] room.send("set_double", { value: 1|2 })     ← 地主先提交 dL
                                        ←────  [广播] landlord_doubled { value: 1|2 }

[其余4人各自] room.send("set_double", { value: 1|2 })  ← 秘密独立提交
（全部提交或超时后）
                                        ←────  [广播] doubling_result { results: [{seatIndex, doubled}] }
                                        ←────  Schema delta: phase → "playing"
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
                                                         winnerCamp: "landlord_camp" | "civilian_camp"
                                                         scores: { [sessionId]: scoreDelta }

── 再来一局（结算后 30 秒窗口期）───────────────────────────────
[玩家] room.send("request_rematch")
                                        ←────  [广播] rematch_update { agreedCount, total }
（全员同意 — 好友房）
                                        ←────  [广播] rematch_start {}  → 房间重置，重新发牌
（快速匹配场景）
                                        ←────  [私发] rematch_redirect { action: "requeue" }
（30s 窗口到期）                         → 房间关闭
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

### `set_double`

仅在 `doubling` 阶段有效。地主可立即提交；其余玩家须等地主提交后才能提交（服务端暂存提前到达的消息）。

```typescript
room.send("set_double", {
  value: 1 | 2,  // 1 = 不加倍，2 = 加倍
});
```

**约束**：
- 超出 `doubling` 阶段发送 → 静默忽略
- 重复提交 → 以最后一次为准

---

### `force_start`

仅好友房（`isFriendRoom: true`）的**房主**可发送，仅在 `waiting` 阶段有效。

```typescript
room.send("force_start");
```

**约束**：
- 真实玩家数 ≥ 2 → AI 补满剩余席位，立即进入发牌
- 真实玩家数 < 2 → `error { code: 2003, msg: "至少需要2名真实玩家才能开局" }`
- 非房主发送 → 静默忽略
- `dealing` 阶段后发送 → 静默忽略

---

### `request_rematch`

结算后 30 秒窗口期内发送，表示同意再来一局。

```typescript
room.send("request_rematch");
```

- 好友房：全员同意 → `rematch_start` 广播，房间重置重新发牌
- 快速匹配：服务端私发 `rematch_redirect { action: "requeue" }`，客户端自行重新排队
- 30s 窗口过期 → 服务端关闭房间

---

### `request_hint`

在 `playing` 阶段请求出牌提示（AI 推荐）。

```typescript
room.send("request_hint");
```

服务端私发 `hint { cards }` 返回推荐牌组。

---

### `reconnect_sync`

断线重连后请求补发当前手牌和回合状态。

```typescript
room.send("reconnect_sync");
```

服务端响应：
- 私发 `your_hand { cards }`：补发当前手牌
- 若 `phase === "playing"`：私发 `turn_change { seatIndex, deadline }`
- 若 `phase === "doubling"`：重播 `doubling_start { timeout, landlordSeatIndex }`

---

## 6. 服务端→客户端：完整消息表

### 私发（仅接收者本人可见）

#### `your_hand`

```typescript
room.onMessage("your_hand", (data: { cards: number[] }) => {
  // 初始发牌 20 张；断线重连后重发
  // 地主收到 select_code_card 后 handCount 变 23（含 3 张底牌）
  myHand = data.cards;
});
```

#### `bottom_cards`

```typescript
room.onMessage("bottom_cards", (data: { cards: number[] }) => {
  // 仅地主收到，3 张底牌
  // 此时地主手牌已是 23 张（your_hand 20 张 + bottom 3 张）
  bottomCards = data.cards;
});
```

#### `hint`

```typescript
room.onMessage("hint", (data: { cards: number[] }) => {
  // AI 推荐出牌，高亮展示给当前玩家
  highlightHintCards(data.cards);
});
```

#### `rematch_redirect`

```typescript
room.onMessage("rematch_redirect", (data: { action: "requeue" }) => {
  // 快速匹配再来一局：断开当前房间，跳转快速匹配界面重新排队
  leaveRoom();
  gotoQuickMatch();
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

#### `waiting_update`

快速匹配等待阶段，每当有真实玩家加入或离开时广播。

```typescript
room.onMessage("waiting_update", (data: {
  readyCount: number,  // 当前真实玩家数
  total:      5,       // 恒为 5
  aiSeconds:  number,  // 剩余 AI 补位倒计时（秒）；满员后为 0
}) => {
  updateWaitingUI(data.readyCount, data.aiSeconds);
});
```

---

#### `room_update`

好友房专用，每当有玩家加入/离开时广播。

```typescript
room.onMessage("room_update", (data: {
  players: Array<{
    seatIndex:  number,
    nickname:   string,
    avatarUrl:  string,
    isReady:    boolean,  // 预留，当前恒 false
  }>,
  ownerSeatIndex: number,  // 房主席位，客户端据此判断是否显示「开始游戏」按钮
}) => {
  renderRoomSlots(data.players, data.ownerSeatIndex);
});
```

---

#### `doubling_start`

进入加倍阶段时广播。地主先选，其余玩家初始锁定。

```typescript
room.onMessage("doubling_start", (data: {
  timeout:           number,  // 倒计时秒数（默认 30）
  landlordSeatIndex: number,  // 地主座位，先提交
}) => {
  showDoublingUI(data);
});
```

---

#### `landlord_doubled`

地主提交 `set_double` 后广播，其余玩家的加倍按钮此时解锁。

```typescript
room.onMessage("landlord_doubled", (data: {
  value: 1 | 2,  // 地主的选择（公开）
}) => {
  showLandlordChoice(data.value);
  enableDoublingButtons();
});
```

---

#### `doubling_result`

全员提交完毕或超时后广播。仅公开布尔值，**不泄露身份**。

```typescript
room.onMessage("doubling_result", (data: {
  results: Array<{
    seatIndex: number,
    doubled:   boolean,  // true = 已加倍，false = 未加倍；不含角色信息
  }>,
}) => {
  showDoublingResult(data.results);
});
```

---

#### `turn_change`

```typescript
room.onMessage("turn_change", (data: {
  seatIndex: number,  // 0–4，当前出牌席位
  deadline:  number,  // Unix 时间戳 (ms)，= Date.now() + 30000
}) => {
  currentSeat = data.seatIndex;
});
```

---

#### `identity_reveal`

```typescript
room.onMessage("identity_reveal", (data: {
  playerId: string,     // 被揭露玩家的 sessionId
  role:     "partner",  // 当前版本仅揭露搭档
}) => {
  // Schema 中 players[playerId].revealed 也会同步变 true
});
```

---

#### `game_over`

```typescript
room.onMessage("game_over", (data: {
  winnerCamp: "landlord_camp" | "civilian_camp",
  scores:     Record<string, number>,  // { [sessionId]: scoreDelta }，正=赢分，负=输分
}) => {
  showSettlement(data);
  // multiplier / breakdown 不在广播中，仅写入 DB
});
```

> `scoreDelta` 为本局积分变化量，客户端如需展示新积分，需将其叠加到本地缓存的 `score`。

---

#### `rematch_update`

结算后每次有玩家同意再来一局时广播。

```typescript
room.onMessage("rematch_update", (data: {
  agreedCount: number,  // 已同意玩家数
  total:       number,  // 真实玩家总数（不含 AI）
}) => {
  updateRematchProgress(data.agreedCount, data.total);
});
```

---

#### `rematch_start`

好友房全员同意后广播，房间状态重置，即将重新发牌。

```typescript
room.onMessage("rematch_start", (_data: {}) => {
  hideSettlementView();
  // 等待新一轮 your_hand 私发
});
```

---

## 7. Schema 状态（实时同步）

通过 `room.onStateChange` 或直接访问 `room.state` 获取。

### GameState

```typescript
interface GameState {
  phase:               string;              // "waiting" | "dealing" | "landlord_select" | "doubling" | "playing" | "settlement"
  players:             MapSchema<Player>;   // key = sessionId
  currentTurnSeat:     number;              // 0–4，-1=未开始
  lastPlayerId:        string;              // 上次出牌者 sessionId，空串=自由回合
  lastPlay:            ArraySchema<number>; // 上次出的牌，空=自由回合
  landlordSeat:        number;              // 0–4
  isAlone:             boolean;             // true=地主一挑四
  // 加倍阶段
  doublingPhase:       boolean;             // true = 当前在加倍阶段
  landlordDoubleValue: 0 | 1 | 2;          // 0=未选，1=不加倍，2=加倍
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

  const lastPlay = [...room.state.lastPlay];
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
| `2003` | `force_start` 时真实玩家数 < 2 | 提示"至少需要2名真实玩家才能开局" |
| `3001` | JWT 无效或过期 | Colyseus `MatchMakeError`，引导重新登录 |

### MatchMake 错误（连接层）

```typescript
try {
  const room = await client.create("card_room");
} catch (e: any) {
  if (e.code === 3001) {
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
- 私发 `your_hand { cards }`
- 若 `phase === "playing"`：私发 `turn_change { seatIndex, deadline }`
- 若 `phase === "doubling"`：重播 `doubling_start { timeout, landlordSeatIndex }`

---

## 11. HTTP 接口

### POST /auth/login

```typescript
const res = await fetch("http://localhost:2567/auth/login", {
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
const res = await fetch("http://localhost:2567/auth/me", {
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
| `PORT` | `2567` | 监听端口 |
| `JWT_SECRET` | `dev_secret_change_me` | JWT 签名密钥 |
| `AUTH_MODE` | `stub` | `stub`=跳过微信 OAuth，`wechat`=生产模式 |
| `AI_FILL_DELAY` | `30` | AI 补位等待秒数；设 `0` 可即时补位（Demo 模式） |
| `DB_HOST` | `localhost` | MySQL 主机 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `root` | MySQL 用户 |
| `DB_PASSWORD` | `` | MySQL 密码 |
| `DB_NAME` | `game_db` | MySQL 数据库名 |
| `REDIS_HOST` | `localhost` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |

### 本地开发启动（推荐使用 .env 文件）

```bash
# server/.env（参考 .env.test.example）
AUTH_MODE=stub
JWT_SECRET=dev_secret_change_before_prod
AI_FILL_DELAY=0
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=changeme
DB_NAME=ddz
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
PORT=2567

# 启动（需要 MySQL + Redis 在线，推荐 Docker via infra/docker-compose.yml）
cd infra && docker compose up -d mysql redis
cd ../server && npx ts-node --project tsconfig.json src/index.ts
# 或
npm run dev   # 等同于上面，需全局安装 ts-node
```

### 客户端连接地址

| 环境 | 地址 |
|------|------|
| 本地开发 | `ws://localhost:2567` |
| HTTP 接口 | `http://localhost:2567` |

---

## 13. 安全约束

1. **手牌绝不入 Schema**：服务端内存保存 `Map<sessionId, number[]>`，通过私发 `your_hand` 下发，不广播，不出现在 Colyseus Schema 中。
2. **角色/身份延迟揭露**：`role` 字段在 `select_code_card` 完成后才写入 Schema；`revealed` 在打出暗号牌后才变 `true`。任何时候客户端都无法提前获知暗队友身份。
3. **JWT 强制校验**：每次 WebSocket 连接都经过 `CardRoom.static.onAuth` 验证，无效 token 直接拒绝连接（`MatchMakeError {code: 3001}`）。
4. **回合强制**：服务端验证 `seatIndex === currentTurnSeat`，客户端无法绕过（error 1003）。

---

## 14. 集成测试命令

```bash
# 仅跑集成测试（需要 MySQL + Redis 在线）
npx jest --testPathPattern="integration" --no-coverage

# 全套（单元 + 集成）
npx jest --no-coverage
# 当前结果：356/356 通过

# 数值模拟校准（不需要 MySQL/Redis）
npx ts-node server/tools/simulate.ts --games 100000
npx ts-node server/tools/simulate.ts --games 10000 --sample 5
```

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
