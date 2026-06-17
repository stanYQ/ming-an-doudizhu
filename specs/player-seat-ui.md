# Spec: 玩家席位 + 暗号牌选择弹窗

**任务 ID**: TASK-013  
**目标模块**: client  
**优先级**: P2  
**状态**: ready  
**前置依赖**: TASK-011（GameController）done

---

## 背景

来源：GDD v1.0 第七章（7.3 游戏桌布局规范）。`PlayerSeat` 展示游戏桌上其余 4 名玩家的公开信息（头像、手牌数、身份标签、计时圆环）。`CodeCardSelector` 是地主专属弹窗，用于选择暗号牌，需过滤非法点数、实时展示可选组合。

## 验收标准

### PlayerSeat

- AC-1: `update(data)` 更新头像、昵称、手牌数量（数字标签）
- AC-2: 当前出牌玩家的席位显示计时圆环动画（30s 倒计时），非当前玩家隐藏圆环
- AC-3: `showIdentity(role)` 调用后席位上出现阵营标签：`"landlord"` → 金冠、`"partner"` → 暗纹徽章、`"civilian"` → 无标签
- AC-4: 手牌数归零时，席位显示「出完」状态（置灰 + 完成图标）
- AC-5: 5 个席位按固定布局排列：本人在底部，其余 4 人分布顶部与两侧（GDD 7.3 规范）

### PlayerSeat — 身份揭晓动画

- AC-6: 收到 `showIdentity` 时触发全屏遮罩弹出「身份揭晓」动画（时长 1.5s），动画结束后席位标签持续显示
- AC-7: 动画期间玩家仍可看到手牌区，不阻塞计时器

### CodeCardSelector

- AC-8: `show()` 弹出选择器，展示 4 × 8 的花色-点数网格（4 花色 × 8 点数 = 32 个合法格子）
- AC-9: 点数 J/Q/K/A/2 和王的格子不在网格中（从源头过滤，不展示非法选项）
- AC-10: 点击合法格子 → 选中高亮，「确定」按钮可点
- AC-11: 未选中任何格子时，「确定」按钮禁用
- AC-12: 点击「确定」→ 调用 `GameController.onCodeCardConfirm(suit, rank)`
- AC-13: `hide()` 关闭弹窗，清除选中状态

## 接口 / 数据结构

```typescript
// client/assets/scripts/ui/PlayerSeat.ts
export interface SeatData {
  playerId: string;
  nickname: string;
  handCount: number;
  isCurrentTurn: boolean;
  turnDeadline?: number;   // unix timestamp，用于计时圆环
}

export class PlayerSeat {
  seatIndex: number;
  update(data: SeatData): void;
  showIdentity(role: "landlord" | "partner" | "civilian"): void;
  showFinished(): void;                      // 手牌数归零时调用
}

// client/assets/scripts/ui/CodeCardSelector.ts
export interface CodeCardChoice {
  suit: number;   // 0=♠ 1=♥ 2=♦ 3=♣
  rank: number;   // 0=3 ... 7=10
}

export class CodeCardSelector {
  show(): void;
  hide(): void;
  onConfirm: (choice: CodeCardChoice) => void;  // 由 GameController 注入
}
```

### 席位布局（5人桌）

```
        [对面 seat2]
[左 seat1]        [右 seat3]
  [左前 seat4] [右前 seat0本人]（底部）
```

实际排列以 GDD 7.3 为准（本人在底部居中，其余环绕）。

## 约束

- `PlayerSeat` 不持有服务端 `role` 字段的原始值；`showIdentity` 只接受三种 string 字面量
- `CodeCardSelector` 展示 32 个合法格子；UI 实现方式（静态/动态）由 dev 在 FairyGUI 框架内决定
- 身份揭晓全屏动画时长 1.5s，期间手牌区仍可见；具体动画实现由 dev 决定
- 计时圆环通过 `turnDeadline`（绝对时间戳）计算剩余秒数，而非由服务端推送剩余秒数

## 不在范围内

- 观战模式下的席位扩展
- 旁观者看牌功能
- 好友头像加载失败时的默认头像兜底（使用 oops ResManager 的默认资源）

## 测试要求

- 单元测试覆盖全部 13 条 AC
- 边界情况：
  - 手牌数从 1 变 0（AC-4 触发时机）
  - `showIdentity` 在 PLAYING 阶段中途调用（AC-6/AC-7 不阻塞计时）
- 错误路径：AC-11（未选择时点击确定按钮无效）
