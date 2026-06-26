# Spec: 积分结算服务 SettleService

**任务 ID**: TASK-019  
**目标模块**: server  
**优先级**: P3  
**状态**: ready  
**前置依赖**: TASK-008（CardRoom）、TASK-017（AuthService）done

---

## 背景

来源：GAME-RULES.md 第九章（结算积分）。CardRoom 当前在 `settlement` 阶段仅广播 `game_over`，不做积分计算和写库。本任务实现完整的积分结算逻辑：计算每名玩家的 `scoreDelta`、更新 `users` 表、写入 `game_records` + `game_players`，并将结果回传 CardRoom 用于广播。

## 验收标准

### 积分计算

- AC-1: `计算公式：scoreDelta = BaseScore × 总倍率 × 阵营系数`
- AC-2: BaseScore 按段位取值：青铜=100, 白银=120, 黄金=150, 铂金=180, 钻石=220, 王者=260
- AC-3: 总倍率 = 模式倍率 × 炸弹倍率 × 王炸倍率（累乘）
- AC-4: 模式倍率：标准×1，一挑四×2
- AC-5: 每出一个炸弹（4–7张）×2 累乘；八张炸弹当次 ×4（替换 ×2）
- AC-6: 每出一个王炸 ×3 累乘
- AC-7: 胜方阵营系数 = +1，负方 = -1

### 分配规则

- AC-8: 标准·地主阵营胜：地主 +2份，暗队友 +2份，平民（每人）-1份
- AC-9: 标准·平民胜：地主 -2份，暗队友 -2份，平民（每人）+4/3份（浮点存储，展示四舍五入）
- AC-10: 一挑四·地主胜：地主 +8份，平民（每人）-2份
- AC-11: 一挑四·地主负：地主 -4份，平民（每人）+1份
- AC-12: 1份 = BaseScore × 总倍率；`scoreDelta = round(份数 × 1份)` 展示时四舍五入

### 段位更新

- AC-13: 结算后按新积分更新 `users.rank_level`，晋级/降级即时生效
- AC-14: 积分不低于 0（跌至 0 停止，不为负数）

### 写库

- AC-15: 写入 `game_records` 一条记录（含 multiplier、winner_camp、duration 等）
- AC-16: 写入 `game_players` 每名玩家一条记录（含 score_delta、rank_pos）
- AC-17: 更新 `users.score`、`users.rank_level`、`users.total_games`、`users.win_games`
- AC-18: 以上三步在同一 MySQL 事务中执行；任意失败则全部回滚，不广播结算结果

### 结果回传

- AC-19: 返回 `SettleResult`，CardRoom 用此数据构造 `game_over` 消息广播给客户端

## 接口 / 数据结构

```typescript
// server/src/services/SettleService.ts

export interface GameSummary {
  roomId: string;
  winnerCamp: 0 | 1;           // 0=平民 1=地主阵营
  isLandlordAlone: boolean;
  landlordId: string;
  partnerId: string | null;
  firstOutId: string;
  multiplier: number;          // 最终总倍率（CardRoom 累计）
  bombCount: number;
  rocketCount: number;
  hasEightBomb: boolean;       // 是否出过八张炸
  duration: number;            // 对局秒数
  players: Array<{
    userId: number;
    sessionId: string;
    rankLevel: string;         // 结算前的段位
    rankPos: number;           // 出完名次 1-5
  }>;
}

export interface PlayerSettleResult {
  userId: number;
  scoreDelta: number;          // 正负整数（展示用，已 round）
  newScore: number;
  newRankLevel: string;
}

export interface SettleResult {
  players: PlayerSettleResult[];
  multiplier: number;
  winnerCamp: 0 | 1;
}

export class SettleService {
  /** 执行结算：计算积分、写库、返回结果 */
  static async settle(summary: GameSummary): Promise<SettleResult>;

  /** 纯函数：计算总倍率（不写库，供测试和 CardRoom 实时展示）*/
  static calcMultiplier(summary: Pick<GameSummary, "isLandlordAlone" | "bombCount" | "rocketCount" | "hasEightBomb">): number;

  /** 纯函数：计算各玩家 scoreDelta（不写库）*/
  static calcDeltas(summary: GameSummary): Map<string, number>;
}
```

## 约束

- `settle()` 必须在事务中执行写库（AC-18），事务失败时 CardRoom 收到异常，不广播 `game_over`
- `calcMultiplier` 和 `calcDeltas` 为纯函数，无副作用，可在 CardRoom 对局中实时计算当前倍率展示
- AI 补位玩家没有 `userId`，不写 `users` 表，但写 `game_players`（`user_id` 填 0 占位）
- 积分下限为 0（AC-14）：计算后若 `newScore < 0` 则置为 0

## 不在范围内

- 货币（金币/钻石）变动 —— P4
- 赛季积分重置 —— P4
- 战绩详情回放 —— P4

## 测试要求

- 单元测试覆盖全部 19 条 AC
- 边界情况：
  - 积分跌至 0 不为负（AC-14）
  - 八张炸弹倍率 ×4 替换 ×2（AC-5）
  - 平民 +4/3 份的浮点精度（AC-9/AC-12）
- 错误路径：AC-18（MySQL 事务回滚，CardRoom 不广播）
