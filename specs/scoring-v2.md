# Spec: 积分结算服务 V2（SettleService 重写）

**任务 ID**: TASK-022  
**目标模块**: server  
**优先级**: P3（替换 TASK-019）  
**状态**: ready  
**前置依赖**: TASK-023（CardRoom 加倍阶段）done；TASK-019 实现废弃  
**权威来源**: 项目计划书 V1.1 第七章

---

## 背景

TASK-019 的 SettleService 基于规则 V1，与计划书 V1.1 第七章的倍数计分体系不兼容，需整体重写。核心变化：
1. 底分 B 由段位决定 → 改为由**场次类型**决定
2. 引入**个人加倍** di（开局加倍阶段各玩家选择）与**地主加倍** dL
3. 内部分配改为**份数制**（2v3：地主2份/暗队友1份）
4. 严格**零和**：五人总积分变动之和恒为 0
5. 一挑四倍数 ×2 → **×3**；春天/反春天均为 ×2

---

## 验收标准

### 底分与场次

- AC-1: 场次映射：`starter` → B=1；`casual` → B=2；`expert` → B=5；`peak` → B=10
- AC-2: 全局倍数 M 封顶：`starter` ≤×16；`casual` ≤×64；`expert` ≤×256；`peak` 不封顶

### 全局倍数 M（乘法累积）

- AC-3: 对局基础 M=1
- AC-4: 每打出一个普通炸弹（4–8张同点）→ M ×2（累乘，每炸独立计算）
- AC-5: 打出双小王炸 → M ×3
- AC-6: 打出双大王炸 → M ×4
- AC-7: 春天（终局判定：地主方胜，且三名平民全程未出任何一手牌）→ M ×2
- AC-8: 反春天（终局判定：平民方胜，且地主发牌后除首手外再未获出牌权）→ M ×2
- AC-9: 一挑四（终局方才公开）→ M ×3；对局过程中 M 不含此系数
- AC-10: M 超出场次封顶 → 截断至封顶值（`peak` 场无上限）

### 个人加倍与地主加倍

- AC-11: 地主加倍 dL ∈ {1, 2}；其余四名玩家 di ∈ {1, 2}（含暗队友）
- AC-12: 每名**平民** i 的流水：`流水(i) = B × M × di × dL`
- AC-13: 暗队友的 di 不直接参与流水公式；仅影响内部份数分配（见 AC-15/16）

### 结算方向

- AC-14: **地主方胜**：每名平民 i 支付 流水(i)；地主方合计收取 Σ 流水(i)（3名平民之和）
- AC-14b: **平民方胜**：地主方向每名平民 i 支付 流水(i)；地主方合计支付 Σ 流水(i)

### 内部份数分配（2v3 模式）

- AC-15: 暗队友**未加倍**（di=1）→ 地主得 2/3 总额，暗队友得 1/3 总额；除不尽的零头归地主
- AC-16: 暗队友**加倍**（di=2）→ 地主与暗队友各得 1/2 总额；除不尽的零头归地主
- AC-17: 1v4 模式（`isLandlordAlone: true`）→ 地主独得/独付全部总额，无暗队友分配

### 零和约束

- AC-18: 五名玩家 scoreDelta 之和恒为 0（误差不超过 1，由零头处理导致）

### 写库

- AC-19: 写入 `game_records`（含 tableType、multiplier、winnerCamp、duration、landlordDouble）
- AC-20: 写入 `game_players`（每人一条，含 scoreDelta、double 值）
- AC-21: 更新 `users.score`（不为负，最低为 0）
- AC-22: 以上三步在同一 MySQL 事务中；任意失败全部回滚，不广播结算结果

---

## 接口 / 数据结构

```typescript
// server/src/services/SettleService.ts

export type TableType = "starter" | "casual" | "expert" | "peak";

export interface GameSummaryV2 {
  roomId: string;
  tableType: TableType;
  winnerCamp: 0 | 1;              // 0=平民 1=地主方
  isLandlordAlone: boolean;
  landlordId: string;
  partnerId: string | null;
  firstOutId: string;
  landlordDouble: 1 | 2;          // dL
  playerDoubles: Record<string, 1 | 2>;  // sessionId → di（含暗队友）
  partnerDoubled: boolean;        // 暗队友是否加倍（影响内部分配）
  bombCount: number;
  rocketSmallCount: number;       // 双小王炸出现次数
  rocketBigCount: number;         // 双大王炸出现次数
  hasEightBomb: boolean;
  isSpring: boolean;              // 春天
  isAntiSpring: boolean;          // 反春天
  duration: number;
  players: Array<{
    userId: number;
    sessionId: string;
    rankPos: number;
  }>;
}

export interface PlayerSettleResultV2 {
  userId: number;
  scoreDelta: number;
  newScore: number;
}

export interface SettleResultV2 {
  players: PlayerSettleResultV2[];
  multiplier: number;
  winnerCamp: 0 | 1;
  breakdown: {
    baseScore: number;
    landlordDouble: 1 | 2;
    playerDoubles: Record<string, 1 | 2>;
    isLandlordAlone: boolean;
    isSpring: boolean;
    isAntiSpring: boolean;
  };
}

export class SettleService {
  static async settle(summary: GameSummaryV2): Promise<SettleResultV2>;

  /** 纯函数：计算全局倍数 M（不含个人加倍） */
  static calcMultiplier(
    summary: Pick<GameSummaryV2, "tableType" | "bombCount" | "rocketSmallCount" | "rocketBigCount" | "isLandlordAlone" | "isSpring" | "isAntiSpring">
  ): number;

  /** 纯函数：计算每名玩家的 scoreDelta（含个人加倍，不写库） */
  static calcDeltas(summary: GameSummaryV2): Map<string, number>;
}
```

---

## 结算示例（来自计划书）

**示例一**：2v3，地主方胜，休闲场（B=2）  
炸弹 2个 + 双大王炸 1个 → M = 2×2×4 = 16；dL=2；甲 d=2，乙/丙 d=1；暗队友丁 d=2（对半）  
流水：甲=2×16×2×2=128，乙=64，丙=64；总额=256  
内部（丁加倍→对半）：地主+128，丁+128  
零和：-128-64-64+128+128 = 0 ✓

**示例二**：1v4，平民方胜+反春，高手场（B=5）  
M = 反春×2 × 一挑四×3 = 6；dL=2；戊/己 d=2，庚/辛 d=1  
流水：戊=5×6×2×2=120，己=120，庚=60，辛=60  
地主支付：-360；四平民分别+120/+120/+60/+60  
零和：-360+360 = 0 ✓

---

## 约束

- `settle()` 事务失败时 CardRoom 收到异常，不广播 `game_over`
- `calcMultiplier` 和 `calcDeltas` 为纯函数，无副作用
- AI 补位玩家没有 `userId`，不写 `users` 表，`game_players.user_id` 填 0 占位
- 积分不为负：`Math.max(0, newScore)`
- 此 spec 替换 TASK-019 的 SettleService；TASK-019 产物废弃

## 不在范围内

- 金币经济、道具消耗 —— P4
- 赛季积分重置 —— P4
- 场次底分热更新接口 —— P4

## 测试要求

- 单元测试覆盖全部 22 条 AC
- 必须覆盖两个示例的完整数字验证（AC-18 零和校验）
- 边界：M 封顶截断（AC-10）、一挑四零头归地主（AC-17）、积分不为负（AC-21）
