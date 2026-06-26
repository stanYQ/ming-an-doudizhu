# Spec: 结算界面 SettlementView

**任务 ID**: TASK-014  
**目标模块**: client  
**优先级**: P2  
**状态**: ready  
**前置依赖**: TASK-011（GameController）done

---

## 背景

来源：GDD v1.0 第七章（7.1 界面清单 — 结算）+ 第四章（4.3 结算分配规则）。对局结束后展示胜负结果、阵营揭晓（公开所有身份）、每名玩家的积分变动。结算界面是用户最后接触的界面，影响复玩意愿，需有足够的视觉反馈。

## 验收标准

### 显示结果

- AC-1: `show(data)` 展示胜负横幅：地主阵营胜 → 「地主阵营获胜」（红色）；平民阵营胜 → 「平民阵营获胜」（蓝色）
- AC-2: 展示全部 5 名玩家的最终身份标签（地主 / 暗队友 / 平民）——无论游戏中是否已公开
- AC-3: 每名玩家头像下方展示积分变动：正数绿色「+NNN」，负数红色「-NNN」
- AC-4: 当前用户的行标高亮显示（区别于其他玩家）
- AC-5: 展示本局总倍率（如「× 4 倍」），鼠标/点击可展开倍率明细（炸弹次数 + 王炸次数）

### 动画流程

- AC-6: `show()` 调用后先播放 0.5s 黑幕淡入，再逐步展示结果（顺序：横幅 → 阵营列表 → 积分跳动）
- AC-7: 积分数字有「从 0 跳到最终值」的滚动动画，时长 1s

### 操作按钮

- AC-8: 「再来一局」按钮 → 调用 `GameController.onPlayAgain()`，返回大厅或自动匹配
- AC-9: 「返回大厅」按钮 → 调用 `GameController.onReturnHall()`，场景切换到大厅
- AC-10: 两个按钮在积分动画播完后才可点击（动画期间禁用）

## 接口 / 数据结构

```typescript
// client/assets/scripts/ui/SettlementView.ts

export interface PlayerResult {
  playerId: string;
  nickname: string;
  role: "landlord" | "partner" | "civilian";
  scoreDelta: number;   // 正负整数，来自 game_over.scores
  isMe: boolean;
}

export interface SettlementData {
  winnerCamp: 0 | 1;              // 0=平民阵营胜 1=地主阵营胜
  players: PlayerResult[];        // 5人，顺序与席位一致
  multiplier: number;             // 总倍率
  multiplierDetail: {
    mode: number;                 // 模式倍率 1 or 2
    bombCount: number;            // 炸弹次数
    rocketCount: number;          // 王炸次数
  };
}

export class SettlementView {
  show(data: SettlementData): void;
  hide(): void;
  onPlayAgain: () => void;         // 由 GameController 注入
  onReturnHall: () => void;
}
```

## 约束

- `SettlementData` 完全来自服务端 `game_over` 消息，客户端不自行计算积分
- 积分数字滚动动画时长 ≤ 1s；具体实现方式由 dev 在 FairyGUI + Cocos Creator 3.8 框架内决定
- 阵营公开不依赖 `Player.revealed` Schema 字段；服务端 `game_over.players` 中直接携带 `role`
- `show()` 幂等：重复调用只更新数据不重播动画（防止 STATE 事件重复触发）

## 不在范围内

- 战报分享（生成对局海报一键分享微信）—— P3
- 详细战绩（出牌记录回放）—— P3
- 段位升降动画 —— P3

## 测试要求

- 单元测试覆盖全部 10 条 AC
- 边界情况：
  - 一挑四胜利（`partner` 字段为 null，结算列表无暗队友行）
  - `scoreDelta = 0`（理论边界，展示「+0」而非负号）
- 错误路径：AC-10（动画未完成前按钮点击无效）
