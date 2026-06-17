# Spec: 游戏桌 UI — 手牌区 + 出牌区

**任务 ID**: TASK-012  
**目标模块**: client  
**优先级**: P2  
**状态**: ready  
**前置依赖**: TASK-011（GameController）done

---

## 背景

来源：GDD v1.0 第七章（7.3 游戏桌布局规范、7.4 关键交互）。游戏桌的两个核心 UI 组件：`HandCardView`（本人手牌渲染与选牌交互）和 `PlayZone`（中央出牌区，展示上一手牌）。这两个组件是对局体验的核心，直接影响操作流畅性。

## 验收标准

### HandCardView — 手牌渲染

- AC-1: `render(cards)` 将编码整数数组渲染为对应卡牌节点，横向排列于底部手牌区
- AC-2: 手牌数量变化时（出牌后调用 `render`）节点使用对象池复用，禁止裸 `instantiate`
- AC-3: 手牌按 `compareValue` 从小到大排序展示（左小右大）
- AC-4: 单击一张牌 → 选中状态（卡牌上移 20px 高亮），再次单击取消选中
- AC-5: 滑动选牌 → 手指经过的牌全部选中（支持快速划选多张）
- AC-6: `getSelected()` 返回当前选中的编码整数数组
- AC-7: `clearSelection()` 取消全部选中并还原位置
- AC-8: 牌数 > 10 时支持横向滑动，不压缩卡牌宽度
- AC-9: `setInteractable(false)` 后点击/滑动无效（非本人回合）

### HandCardView — 实时牌型提示

- AC-10: 选牌变化时调用 `PatternHelper.parse(selected)`，结果合法则出牌按钮高亮可点，非法则置灰
- AC-11: 牌型名称展示在出牌按钮上方（如「顺子」「炸弹」），INVALID 时显示「请选择合法牌型」

### PlayZone — 出牌区

- AC-12: `showLastPlay(playerId, cards)` 在中央区域展示上一手牌的卡牌节点 + 玩家昵称标签
- AC-13: 获得新一轮自由出牌权时（`lastPlay` 清空）调用 `clear()`，中央区域清空
- AC-14: `clear()` 时有淡出动画（0.3s），不阻塞后续出牌

## 接口 / 数据结构

```typescript
// client/assets/scripts/ui/HandCardView.ts
import { PatternHelper } from "../shared/PatternHelper";

export class HandCardView {
  render(cards: number[]): void;          // 接收编码整数，渲染手牌
  getSelected(): number[];                // 返回当前选中的编码整数
  clearSelection(): void;
  setInteractable(enabled: boolean): void;
}

// client/assets/scripts/ui/PlayZone.ts
export class PlayZone {
  showLastPlay(playerId: string, cards: number[]): void;
  clear(): void;
}
```

### 卡牌节点对象池规范

```
CardPool.get()   → 复用或创建卡牌节点
CardPool.put(node) → 回收节点（不销毁）
render() 调用前 put 全部旧节点，再 get 新节点
```

## 约束

- **禁止裸 `node.instantiate`**：卡牌节点必须走对象池（性能红线）
- `PatternHelper` 只引用 `shared/PatternHelper.ts`，不调用任何服务端逻辑
- 手牌排序在 `render()` 内部处理，不修改传入数组顺序
- 出牌按钮的启用/禁用状态由 `HandCardView` 控制，`GameController` 通过 `setInteractable` 设置回合权限

## 不在范围内

- 出牌飞牌动画（从手牌飞向中央），P3 优化
- 炸弹爆炸特效 + 震动，P3
- 牌背面展示（其他玩家手牌数量展示在 `PlayerSeat`，非此组件）

## 测试要求

- 单元测试覆盖全部 14 条 AC
- 测试方法：Cocos Creator 单元测试环境（或 mock cc.Node），验证选牌状态与事件回调
- 边界情况：手牌为空（render([])）、全选后出牌再 render、24 张地主手牌超出显示区
- 错误路径：AC-9（非本人回合滑动无效）、AC-10/11（选了非法牌型时的提示）
