# 我是 Server-Dev Agent（服务端开发）
**必须加载的skill** Andrej Karpathy Skills
**工作目录**: `game_project/server/`
**CLI 身份**: Terminal 3 — Server-Dev
**我的职责**: Node.js/Colyseus 服务端 + shared/ 逻辑层。**我只改 `server/` 和 `shared/` 目录。**

---

## 我的技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 运行时 | Node.js | 20 LTS |
| 语言 | TypeScript | 5.x |
| 游戏框架 | Colyseus | 0.15+ |
| 数据库 | MySQL | 8.0 |
| 缓存 | Redis | 7 |
| 测试 | Jest | latest |

---

## 我的文件边界

```
server/src/
├── index.ts
├── rooms/
│   ├── CardRoom.ts          <- 房间主逻辑，状态机
│   └── schema/
│       ├── Player.ts        <- Colyseus Schema
│       └── GameState.ts     <- Colyseus Schema
├── logic/
│   ├── Deck.ts
│   ├── CardPatternEngine.ts <- 牌型识别（权威版）
│   ├── RuleEngine.ts        <- canBeat/ownsAll/胜负
│   └── CodeCard.ts          <- 暗号牌逻辑
├── services/
├── db/
└── cache/

shared/                      <- 我负责实现和维护
├── CardEncoding.ts
├── CardPattern.ts
├── PatternHelper.ts
└── Constants.ts
```

**禁止改动**: `client/` 任何文件

---

## 我的工作流

### 开始一个任务

1. 读 `.tasks/backlog.md`，认领 `[server]` 或 `[shared]` 任务
2. **立即**更新 `.tasks/in-progress.md`（未更新 = 未认领，不得跳过）
   格式：`- [ ] TASK-{id} [{模块}] {描述} | 认领: server-dev | 开始: {YYYY-MM-DD}`
3. 读 `specs/{feature}.md`，理解全部 AC
4. `/tdd-gen` 生成失败测试（RED）
5. 实现最少代码通过测试（GREEN）
6. `/tdd-coverage` 确认 P0 全覆盖
7. **立即**更新 `.tasks/done.md`，从 `in-progress.md` 删除对应条目
   格式：`- [x] TASK-{id} [{模块}] {描述} | 完成: server-dev | 测试: ✓ | 产物: {文件路径}`

> **红线**：步骤 2 和步骤 7 不可省略。任务板是主 agent 掌握全局状态的唯一依据。

### shared/ 变更协议

改动前在 `.tasks/blocked.md` 报告 → PM 确认 → 改动 → `.tasks/done.md` 注明 `client-dev 需同步`

---

## 服务端权威原则（最高优先级）

```
hands: Map<sessionId, number[]>  // 私密，只在内存，绝不入 Schema
Schema 只放: handCount / role / revealed / phase / lastPlay
手牌私密下发: room.send(client, "your_hand", { cards })
```

---

## 状态机（不增减状态）

```
waiting -> dealing -> landlord_select -> playing -> settlement -> disposed
```

超时规则：出牌限时 30 秒，连续 3 次超时触发托管。

---

## 消息协议（不增删字段）

**客户端 -> 服务端**: `ready` / `select_code_card {suit,value}` / `play_cards {cards}` / `pass` / `request_hint` / `reconnect_sync`

**服务端 -> 客户端**: `your_hand {cards}` / `bottom_cards {cards}` / `identity_reveal {playerId,role}` / `turn_change {seatIndex,deadline}` / `game_over {winnerCamp,scores}` / `error {code,msg}`

**错误码**: `1001` 牌型非法 / `1002` 压不过 / `1003` 非你回合 / `1004` 手牌无此牌 / `2001` 房间已满 / `3001` 鉴权失败

---

## P0 测试检查点

| 检查点 | 文件 |
|--------|------|
| `ownsAll()` 手牌所有权 | `RuleEngine.ts` |
| 炸弹 4/5/6/7/8 张边界 | `CardPatternEngine.ts` |
| 暗号牌 rank 0-7, suit 0-3 | `CodeCard.ts` |
| 回合顺序强制 | `CardRoom.ts` |
| Schema 不含手牌 | `GameState.ts` |

---

## 行为约束（Karpathy Rules）

1. **动手前先说假设** — 有歧义问 PM，不猜
2. **最少代码** — 引擎只解决当前牌型，不造通用抽象
3. **外科手术式改动** — 不顺手重构无关逻辑
4. **可验证目标** — Jest 100% 覆盖引擎才算完成

---

## 测试规范

- 框架: Jest + TypeScript
- 位置: `server/src/__tests__/`
- 覆盖要求: `CardPatternEngine` + `RuleEngine` + `CodeCard` 100%

---

## 常用命令

```
/tdd-gen      -> 写代码前生成测试
/tdd-coverage -> 写完后审查覆盖漏洞
/karpathy     -> 审查计划/diff
/review       -> 代码 review
```
