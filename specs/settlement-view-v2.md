# Spec: 结算界面 V2（SettlementView 更新）

**任务 ID**: TASK-028  
**目标模块**: client  
**优先级**: P4.2  
**状态**: ready  
**前置依赖**: TASK-022（SettleService V2）done；TASK-014（SettlementView V1）done  
**权威来源**: specs/scoring-v2.md 的 `SettleResultV2` 接口

---

## 背景

TASK-014 的 `SettlementView.ts` 基于 V1 结算格式（仅显示胜负和积分变化）。TASK-022 引入了 V2 结算格式：底分 B、全局倍数 M 的明细拆分、地主加倍 dL、个人加倍 di。客户端需在结算界面展示完整的倍率明细，让玩家理解积分从何而来。

**V2 新增展示内容**（相比 V1）：
- 场次底分（B = starter/casual/expert/peak 对应值）
- 倍数明细（炸弹 ×2、王炸 ×3/×4、春天 ×2、一挑四 ×3）
- 地主加倍 dL、各玩家个人加倍 di
- 每名平民的「流水」= B × M × di × dL

---

## 验收标准

### game_over 消息适配

- AC-1: `game_over` 消息新增 `breakdown` 字段（`SettleResultV2.breakdown`），`SettlementView` 读取此字段渲染明细
- AC-2: 若 `breakdown` 字段不存在（旧协议兼容），降级显示 V1 格式（仅胜负 + scoreDelta），不报错

### 倍率明细区

- AC-3: 展示底分 B（如「底分 ×2（休闲场）」）
- AC-4: 逐项展示全局倍数来源：每个普通炸弹「炸弹 ×2」、双小王「双小王 ×3」、双大王「双大王 ×4」、春天「春天 ×2」、反春天「反春天 ×2」、一挑四「一挑四 ×3」
- AC-5: 若某项倍数未触发，不显示该行（倍率明细区仅显示实际生效的项）
- AC-6: 倍率明细末行显示「全局倍数 M = ×{n}」（合计值）
- AC-7: 展示地主加倍 dL：「地主加倍 ×{dL}」（dL=1 时显示「地主未加倍」）

### 玩家积分明细

- AC-8: 每个座位显示该玩家的个人加倍 di（「加倍 ×2」或「未加倍」）
- AC-9: 每名平民座位显示流水计算式（如「2 × 16 × 2 × 2 = 128」）
- AC-10: 每名玩家显示最终 scoreDelta（正为绿色「+n」，负为红色「-n」）
- AC-11: 一挑四（`isLandlordAlone: true`）场景：隐藏暗队友份数分配行，改显示「地主独挑四人」标签

### 身份揭晓（继承 TASK-014，不退化）

- AC-12: 身份揭晓动画（地主 / 暗队友 / 平民标签）保留，在倍率明细之前播放
- AC-13: 暗队友揭示后，其座位额外显示「内部分配：{比例}」（未加倍 2:1，加倍 1:1）

### 布局与交互

- AC-14: 明细区在积分展示之上，可滚动（倍率明细条目可能超过 5 行）
- AC-15: 「再来一局」和「返回大厅」按钮保留，位置不变

---

## 接口 / 数据结构

```typescript
// 更新 client/assets/scripts/ui/SettlementView.ts

// game_over 消息新增字段（与服务端 SettleResultV2 对齐）
interface GameOverMsg {
  winnerCamp: 0 | 1;
  scores: Array<{
    sessionId: string;
    scoreDelta: number;
    newScore: number;
  }>;
  // V2 新增
  breakdown?: {
    baseScore: number;
    landlordDouble: 1 | 2;
    playerDoubles: Record<string, 1 | 2>;
    isLandlordAlone: boolean;
    isSpring: boolean;
    isAntiSpring: boolean;
  };
  multiplier?: number;
}
```

---

## 约束

- 向后兼容：`breakdown` 为可选字段，缺失时不崩溃（AC-2）
- 流水计算式仅用于展示，不在客户端重新计算积分（以服务端 `scoreDelta` 为准）
- 倍率明细区不超过 8 行；超出时仍可滚动，不截断

## 不在范围内

- 结算动画特效（金币飞溅等）—— P4.3
- 历史战绩查询 —— P4
- 分享截图功能 —— P4

## 测试要求

- 单元测试覆盖全部 15 条 AC
- 关键路径：完整 V2 breakdown 渲染（AC-3–AC-10）、V1 降级兼容（AC-2）
- 边界：一挑四模式（AC-11）、全员加倍（AC-8/9）、倍数未触发不显示（AC-5）
- 复用 TASK-022 的两个计划书示例数据驱动测试
