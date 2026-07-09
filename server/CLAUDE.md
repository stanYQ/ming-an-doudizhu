# 我是 Server-Dev Agent（服务端开发）
**必须加载的skill** Andrej Karpathy Skills
**工作目录**: `game_project/server/`
**CLI 身份**: Terminal 3 — Server-Dev
**我的职责**: Node.js/Colyseus 服务端 + shared/ 逻辑层。**我只改 `server/` 和 `shared/` 目录。**

---

## 我的技术栈

> 权威来源：`项目文档/明暗斗地主_技术开发文档_v1.0.docx` 第一章。以下为唯一允许使用的技术和包，**不得自行引入任何未列出的依赖**。

| 层 | 技术 | npm 包名 | 版本 |
|----|------|---------|------|
| 运行时 | Node.js | — | 20 LTS |
| 语言 | TypeScript | `typescript` | ^5.0 |
| 游戏框架 | Colyseus | `colyseus` + `@colyseus/schema` | ^0.15 |
| 数据库客户端 | MySQL2 | `mysql2` | ^3.0 |
| 缓存客户端 | ioredis | `ioredis` | ^5.0 |
| 鉴权 | jsonwebtoken | `jsonwebtoken` + `@types/jsonwebtoken` | ^9.0 |
| 测试 | Jest + ts-jest | `jest` + `ts-jest` | ^29.0 |

**禁止引入的替代方案**（不论理由）：
- ✗ Socket.io / ws / uWebSockets（替代 Colyseus WebSocket）
- ✗ TypeORM / Prisma / Sequelize（替代原生 mysql2）
- ✗ Mongoose / PostgreSQL（替代 MySQL）
- ✗ node-redis（替代 ioredis）

**引入新依赖的流程**：在 `.tasks/blocked.md` 报告 → PM 确认 → 才能 `npm install`

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

## 注释红线（覆盖全局"不加注释"原则）

> 全局 CLAUDE.md 的"不加注释"规则**在此目录不适用**。server/ 和 shared/ 的所有 .ts 文件必须按以下规范写注释，**缺注释 = 未完成**。

**1. 文件头（每个 .ts 文件必须有）**
```typescript
/**
 * @file 文件名.ts
 * @description 这个文件做什么，属于哪个层（shared/server/infra）
 * @module 模块名（如 shared, CardRoom, RuleEngine）
 */
```

**2. public 函数 JSDoc**
```typescript
/**
 * 判断 challenger 是否能压过 current。
 * @param challenger 挑战方牌型
 * @param current 当前桌面牌型
 * @returns true 表示可以压，false 表示不能
 */
export function canBeat(challenger: CardPattern, current: CardPattern): boolean
```

**3. 业务规则内联注释**（非直觉 / 来自 GAME-RULES.md 的规则）
```typescript
// 3张王不构成任何特殊牌型，必须拆开单出（GAME-RULES.md D-05）
// 双大王炸无敌，任何牌型都无法压制
```

**4. WHY 注释**（约束来源不明显时）
```typescript
// 手牌绝不入 Schema —— Schema 是公开广播的，入了等于告诉所有人手牌
private hands = new Map<string, number[]>();
```

**不需要写**：显而易见的赋值、测试文件里的辅助函数、重复函数签名的注释。

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

```bash
# 测试
npx jest --no-coverage                      # 全量
npx jest --no-coverage <file>               # 单文件
npx jest --no-coverage -t "<pattern>"       # 按名称筛选

# 启动
npx ts-node --project tsconfig.json src/index.ts    # 启动服务端（ws://localhost:2567）
npx ts-node tools/simulate.ts                        # 跑模拟局

# 进程
lsof -i :2567                    # 查端口占用
kill $(lsof -t -i :2567)         # 杀掉占用端口的进程

# 日志
node tools/battle-report.js      # 提取最近一局 [BATTLE] JSON
```

---

## TDD Guide Skill

> 已安装：`~/.agents/skills/tdd-guide/SKILL.md`。覆盖 Jest / Pytest / Vitest / Mocha。
> 对准 Karpathy 规则 #4（可验证目标）：验收标准先于代码，边界不遗漏。

### 核心工作流

| 动作 | 触发时机 | 效果 |
|------|---------|------|
| **生成测试** | 写完函数 / 写好 spec 后 | 从代码/AC 自动生成 happy path + error + edge case |
| **覆盖分析** | `npx jest --coverage` 后 | 解析 lcov 报告，按 P0/P1/P2 排序缺口 |
| **TDD 循环** | 写新引擎逻辑（CardPatternEngine/RuleEngine/CodeCard） | RED→GREEN→REFACTOR 引导 |

### 本项目用法

```bash
# 写完新逻辑后生成测试骨架（覆盖：P0 引擎逻辑 100%）
npx jest --no-coverage                     # 先确认现有测试全绿
npx jest --coverage                        # 生成 lcov 报告 → 分析缺口
# 对照 spec AC 逐条补 P0 缺口
```

**覆盖硬要求**：`CardPatternEngine` + `RuleEngine` + `CodeCard` 100%。

---

## great_cto Agent 调用时机

> 已安装：`~/.claude/plugins/cache/local/great_cto/2.56.0/`。以下 agent 可通过 `runSubagent` 调用。

| Agent | 触发时机 | 对准的 Karpathy 规则 |
|-------|---------|:---:|
| **architect** | 开始任何新 feature / 架构变更 | #2 最少代码（防过度设计） |
| **qa-engineer** | senior-dev 实现完成后 | #4 可验证目标（强制测试） |
| **project-auditor** | 定期（每 sprint）或 `PROJECT.md` 缺失时 | #3 外科手术（发现技术债） |
| **senior-dev** | 从 `.tasks/backlog.md` 认领任务 | #1-4 全部 |

### 标准流水线

```
architect → senior-dev → qa-engineer → project-auditor（定期）
   ↓            ↓             ↓
 ADR/doc     TDD实现      QA报告+bug
```

### 调用示例

```
/architect   → 新 feature 的架构决策 + ADR
/audit       → 全项目代码健康审查
```
