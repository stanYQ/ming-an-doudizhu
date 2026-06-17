# 明暗斗地主 — 服务端协议文档 v1.0

> 权威来源：`server/src/` 实现 + 集成测试 266/266 通过。  
> 所有协议已通过真实 Colyseus + MySQL 验证。

---

## 目录

1. [运行环境](#1-运行环境)
2. [HTTP 接口](#2-http-接口)
3. [WebSocket 房间协议](#3-websocket-房间协议)
4. [状态机](#4-状态机)
5. [Schema（公开同步状态）](#5-schema公开同步状态)
6. [客户端→服务端消息](#6-客户端→服务端消息)
7. [服务端→客户端消息](#7-服务端→客户端消息)
8. [错误码](#8-错误码)
9. [安全约束](#9-安全约束)
10. [启动命令](#10-启动命令)

---

## 1. 运行环境

| 项 | 值 |
|----|---|
| 运行时 | Node.js 20 LTS |
| 框架 | Colyseus 0.15 |
| 默认端口 | `3000`（`$PORT` 覆盖） |
| WebSocket 端点 | `ws://host:3000` |
| HTTP 端点 | `http://host:3000` |
| 认证方式 | JWT，`Authorization: Bearer <token>` |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 监听端口 |
| `JWT_SECRET` | `dev_secret_change_me` | JWT 签名密钥（生产必须覆盖） |
| `AUTH_MODE` | `stub` | `stub` = 跳过微信 OAuth，直接用 code 生成 openid |
| `DB_HOST` | `localhost` | MySQL 主机 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `root` | MySQL 用户 |
| `DB_PASSWORD` | `` | MySQL 密码 |
| `DB_NAME` | `game_db` | 数据库名（开发用 `mingandoudizhu`） |
| `REDIS_HOST` | `localhost` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |

---

## 2. HTTP 接口

### POST /auth/login

占位登录。`AUTH_MODE=stub` 时不调微信 API，直接以 `stub_{code}` 作为 openid。

**请求**

```http
POST /auth/login
Content-Type: application/json

{
  "code": "string"   // 微信登录码（stub 模式可填任意字符串）
}
```

**响应 200**

```json
{
  "token": "eyJhbGci...",          // JWT，有效期 24h
  "user": {
    "userId":    1,
    "openid":    "stub_abc123",
    "nickname":  "Player_abc123",
    "avatarUrl": "",
    "score":     1000,
    "rankLevel": "bronze"
  }
}
```

**错误**

| HTTP | 说明 |
|------|------|
| `400` | 请求体缺少 `code` 字段 |
| `500` | 服务器内部错误（DB 不可用等） |

**幂等性**：同一 `code` 多次登录返回相同 `userId`，不重复建用户。

---

### GET /auth/me

查询当前登录用户的完整档案。

**请求**

```http
GET /auth/me
Authorization: Bearer <token>
```

**响应 200**

```json
{
  "userId":    1,
  "openid":    "stub_abc123",
  "nickname":  "Player_abc123",
  "avatarUrl": "",
  "score":     1000,
  "rankLevel": "bronze"
}
```

**错误**

| HTTP | 说明 |
|------|------|
| `401` | 无 token / token 无效 / token 过期 |
| `404` | token 有效但用户不存在（极端情况） |

---

## 3. WebSocket 房间协议

### 连接与认证

客户端必须在 HTTP matchmaking 请求的 `Authorization` 头中携带 JWT：

```
Authorization: Bearer <token>
```

在 `colyseus.js` 客户端中：

```typescript
import { Client } from "colyseus.js";
const client = new Client("ws://host:3000");
client.auth.token = "eyJhbGci...";   // 设置后所有 matchmake 请求自动附带 Authorization 头

const room = await client.create("card_room");
// 或加入已有房间
const room = await client.joinById(roomId);
```

认证失败时服务端抛出错误码 `3001`，客户端收到 `MatchMakeError`。

### 房间名

```
card_room
```

### 最大玩家数

5 人。满 5 人后自动进入发牌流程，无需发送额外消息。

---

## 4. 状态机

```
waiting
  │ (5人加入)
  ▼
dealing           ← 内部过渡，对外不可见
  │ (发牌完成)
  ▼
landlord_select   ← 地主选暗号牌
  │ (select_code_card)
  ▼
playing           ← 出牌循环
  │ (某玩家出完手牌)
  ▼
settlement        ← 广播 game_over，房间关闭
```

超时规则：每回合 30 秒。连续 3 次超时 → 该玩家进入**托管模式**（AI 代打）。

---

## 5. Schema（公开同步状态）

所有客户端通过 Colyseus Schema delta 同步以下状态。**手牌绝不出现在 Schema 中。**

### GameState

| 字段 | 类型 | 说明 |
|------|------|------|
| `phase` | `string` | 当前阶段（见状态机） |
| `players` | `MapSchema<Player>` | key=sessionId |
| `currentTurnSeat` | `number` | 当前出牌席位（0-4），-1=未开始 |
| `lastPlayerId` | `string` | 上次出牌玩家的 sessionId，空串=自由回合 |
| `lastPlay` | `ArraySchema<number>` | 上次出的牌（编码整数数组），空=自由回合 |
| `landlordSeat` | `number` | 地主席位（0-4） |
| `isAlone` | `boolean` | true=地主一挑四，false=有搭档 |

### Player（每名玩家的公开状态）

| 字段 | 类型 | 说明 |
|------|------|------|
| `sessionId` | `string` | Colyseus 分配的 session ID |
| `handCount` | `number` | 手牌张数（不含具体牌面） |
| `role` | `string` | `""` / `"landlord"` / `"partner"` / `"civilian"` |
| `revealed` | `boolean` | 搭档身份是否已揭露 |
| `seatIndex` | `number` | 席位（0-4，按加入顺序） |

---

## 6. 客户端→服务端消息

所有消息通过 `room.send(type, data)` 发送。

### `ready`

预留，当前版本为空实现。

```typescript
room.send("ready");
```

---

### `select_code_card`

地主选择暗号牌。只有处于 `landlord_select` 阶段的地主可以发送，其他人发送被静默忽略。

```typescript
room.send("select_code_card", {
  suit:  number,  // 花色 0=♠ 1=♥ 2=♦ 3=♣
  value: number,  // 点数 rank（0=3 … 12=2），王不可选
});
```

成功后：phase 变 `playing`，广播 `turn_change`，身份分配写入 Schema。  
失败（非法暗号牌）：返回 `error {code: 1001}`。

---

### `play_cards`

出牌。只有当前回合玩家（`currentTurnSeat`）可以发送。

```typescript
room.send("play_cards", {
  cards: number[],  // 牌的编码整数数组（来自 your_hand 消息）
});
```

**服务端校验顺序：**
1. 是否为当前回合 → 否则 `error {code: 1003}`
2. 手牌是否包含这些牌 → 否则 `error {code: 1004}`
3. 牌型是否合法 → 否则 `error {code: 1001}`
4. 是否能压住上家 → 否则 `error {code: 1002}`

成功后：更新 Schema `lastPlay`/`lastPlayerId`/`handCount`；广播 `turn_change`；若出暗号牌则广播 `identity_reveal`；若手牌清空则广播 `game_over`。

---

### `pass`

过牌。只有跟牌轮（`lastPlay` 不为空且不是自己出的）可以 pass；自由轮 pass 按规则处理。

```typescript
room.send("pass");
```

连续 4 次 pass → `lastPlay` 清空，下家获得自由出牌权。

---

### `reconnect_sync`

重连后请求同步当前手牌和回合状态。

```typescript
room.send("reconnect_sync");
```

服务端响应：私发 `your_hand`；若处于 `playing` 阶段则私发 `turn_change`。

---

## 7. 服务端→客户端消息

### 私发（仅本人收到）

#### `your_hand`

发牌完成后私发给每位玩家，以及断线重连后响应 `reconnect_sync`。

```typescript
// 接收
room.onMessage("your_hand", ({ cards }: { cards: number[] }) => {
  // cards: 手牌的编码整数数组
  // 使用 shared/CardEncoding.ts 的 decode() 解析
});
```

#### `bottom_cards`

仅发给地主，包含 3 张底牌（已追加到地主手牌中）。

```typescript
room.onMessage("bottom_cards", ({ cards }: { cards: number[] }) => {
  // cards: 3 张底牌的编码整数
});
```

#### `error`

针对本玩家的操作错误，见[错误码](#8-错误码)。

```typescript
room.onMessage("error", ({ code, msg }: { code: number; msg: string }) => {});
```

---

### 广播（所有玩家收到）

#### `turn_change`

每次出牌/pass/超时后广播，通知所有玩家当前出牌席位和截止时间。

```typescript
room.onMessage("turn_change", (data: {
  seatIndex: number,  // 当前出牌席位（0-4）
  deadline:  number,  // Unix 时间戳（ms），截止时间 = now + 30000
}) => {});
```

#### `identity_reveal`

当有玩家打出暗号牌时广播，揭露 partner 身份。

```typescript
room.onMessage("identity_reveal", (data: {
  playerId: string,  // 被揭露玩家的 sessionId
  role:     "partner",
}) => {});
```

#### `game_over`

游戏结束时广播。

```typescript
room.onMessage("game_over", (data: {
  winnerCamp: 0 | 1,  // 0=平民阵营获胜  1=地主阵营获胜
  scores:     {},     // P3 待填充（当前为空对象）
}) => {});
```

---

## 8. 错误码

| 错误码 | 触发场景 | 消息 |
|--------|---------|------|
| `1001` | 牌型非法 / 暗号牌选择无效 | `"invalid play"` / `"invalid code card"` |
| `1002` | 出的牌型无法压住上家 | `"invalid play"` |
| `1003` | 非当前回合玩家尝试出牌 | `"not your turn"` |
| `1004` | 手牌中不包含所出的牌 | `"invalid play"` |
| `2001` | 房间已满（maxClients=5） | Colyseus 内置 |
| `3001` | JWT 认证失败 / 未提供 token | Colyseus MatchMakeError |

---

## 9. 安全约束

1. **手牌绝不入 Schema**：服务端内存中保存 `Map<sessionId, number[]>`，通过私发 `your_hand` 下发，不广播。
2. **角色/身份延迟揭露**：`role` 字段在 `select_code_card` 完成后才写入 Schema；`revealed` 在打出暗号牌后才变 true。
3. **JWT 强制校验**：每次 WebSocket 连接都经过 `CardRoom.static.onAuth` 验证，无效 token 直接拒绝。
4. **回合强制**：服务端验证 `seatIndex === currentTurnSeat`，客户端无法绕过。

---

## 10. 启动命令

```bash
# 开发模式（ts-node，需要 MySQL + Redis）
DB_NAME=mingandoudizhu AUTH_MODE=stub JWT_SECRET=dev_secret npm run dev

# 生产模式（先编译）
npm run build
DB_NAME=mingandoudizhu JWT_SECRET=<strong_secret> AUTH_MODE=wechat npm start
```

### 集成测试

```bash
# 单独跑集成测试（需要 MySQL 和 Redis 在线）
npx jest --testPathPattern="integration" --no-coverage --forceExit

# 全套（单元 + 集成）
npx jest --no-coverage --forceExit
# 当前结果：266/266 通过
```
