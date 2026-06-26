# Spec: 匹配服务 MatchMaker

**任务 ID**: TASK-018  
**目标模块**: server  
**优先级**: P3  
**状态**: ready  
**前置依赖**: TASK-008（CardRoom）、TASK-017（AuthService）done

---

## 背景

来源：GAME-RULES.md 第十一章（匹配规则）+ TDD v1.0 第四章（匹配服务）。快速匹配按段位区间分桶，超时 30 秒未满 5 人则 AI 补位开局。匹配队列存 Redis LIST（键名 `match:queue:{tier}`），Colyseus 内置 `matchMaker.filterBy` 按段位字段路由房间。

## 验收标准

### 段位分桶

- AC-1: 玩家加入快速匹配时，按 `rankLevel` 映射到对应 tier 桶

| rankLevel | tier |
|-----------|------|
| bronze | tier_1 |
| silver | tier_2 |
| gold | tier_3 |
| platinum | tier_4 |
| diamond / master | tier_5 |

- AC-2: 0–15 秒内，只从同 tier 桶匹配
- AC-3: 15–30 秒，扩展到相邻 ±1 tier（tier_2 可匹配 tier_1 和 tier_3）
- AC-4: tier_1 向下扩展不越界（无 tier_0）；tier_5 向上扩展不越界

### 超时与 AI 补位

- AC-5: 30 秒到达时房间人数 < 5 → 用 AI 玩家补满 5 人，立即开局
- AC-6: AI 玩家在 `GameState.players` 中有完整 `Player` Schema 记录，`isAI: boolean = true`
- AC-7: 补位 AI 数量 = 5 - 当前真实玩家数（最少补 1 人，最多补 4 人）

### 队列管理

- AC-8: 玩家加入匹配时，sessionId 写入 Redis `match:queue:{tier}`（LIST RPUSH）
- AC-9: 玩家取消匹配时，从队列中移除对应 sessionId（LIST LREM）
- AC-10: 玩家断线超过 10 秒未重连，自动从匹配队列移除

### 好友房

- AC-11: 好友房不经过匹配队列，直接由 `joinOrCreate` + roomCode 参数路由
- AC-12: 好友房 roomCode 为 6 位纯数字，由服务端生成，全局唯一（Redis SET 去重）
- AC-13: roomCode 有效期 30 分钟，过期后不可加入

## 接口 / 数据结构

```typescript
// server/src/services/MatchService.ts

export type Tier = "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5";

export class MatchService {
  /** 将玩家加入对应段位匹配队列，返回预计等待信息 */
  static async joinQueue(sessionId: string, rankLevel: string): Promise<void>;

  /** 取消匹配，从队列移除 */
  static async leaveQueue(sessionId: string): Promise<void>;

  /** 按段位确定 tier，含容忍度扩展逻辑 */
  static resolveTier(rankLevel: string, waitSeconds: number): Tier[];

  /** 生成唯一 6 位好友房 roomCode */
  static async generateRoomCode(): Promise<string>;

  /** 校验 roomCode 有效性 */
  static async validateRoomCode(code: string): Promise<boolean>;
}
```

### Colyseus matchMaker 集成

```typescript
// server/src/index.ts
gameServer.define("game", CardRoom, {
  filterBy: ["tier"]   // Colyseus 按 tier 字段过滤房间
});
```

## 约束

- 队列操作必须原子化（使用 Redis MULTI/EXEC 或 Lua 脚本），防止并发重复入队
- AI 补位玩家的 sessionId 格式为 `ai_{uuid}`，与真实玩家 sessionId 区分
- `MatchService` 不直接操作 Colyseus Room，通过 `matchMaker` API 交互

## 不在范围内

- AI 玩家的出牌策略（属 TASK-020）
- 段位赛专属匹配（P4）
- 跨服匹配（P4）

## 测试要求

- 单元测试覆盖全部 13 条 AC
- 边界情况：tier_1 向下扩展不越界（AC-4）、满房时加入（返回新房间而非报错）
- 错误路径：AC-13（过期 roomCode 加入失败）、AC-9（取消不存在的匹配）
