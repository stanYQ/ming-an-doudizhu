# Spec: 服务端牌型识别引擎 CardPatternEngine

**任务 ID**: TASK-005  
**目标模块**: server  
**优先级**: P1  
**状态**: ready  
**前置依赖**: TASK-002（CardPattern.ts）、TASK-003（PatternHelper.ts）done

---

## 背景

来源：TDD v1.0 第四章（CardRoom 出牌逻辑）。服务端权威版牌型识别器，供 `CardRoom.ts` 和 `RuleEngine.ts` 调用。与 shared 层 `PatternHelper` 的区别有两点：① 返回 `null`（非法）而非 INVALID sentinel，调用方可用 `if (!pattern)` 快速拦截；② `canBeat` 接受 `null` 作为 `current`，表示「新一轮自由出牌」。

## 验收标准

### parse()

- AC-1: 合法单张 → 返回 `CardPattern`（type=SINGLE）
- AC-2: 合法炸弹（4–8 张）→ 返回正确 CardPattern，`length` 等于张数
- AC-3: 非法牌型（如小王+大王）→ 返回 `null`
- AC-4: 空数组 → 返回 `null`
- AC-5: `parse(cards)` 的识别结果与 `PatternHelper.parse(cards).type !== INVALID` 保持一致——二者识别结论不得矛盾

### canBeat()

- AC-6: `current` 为 `null`（新一轮）→ 任意合法牌型返回 `true`
- AC-7: `challenger` 为 `null` → 返回 `false`（不得出牌）
- AC-8: 炸弹压普通牌 → `true`
- AC-9: 双大王压双小王 → `true`
- AC-10: 八张炸压四张炸 → `true`
- AC-11: 同类型同长度但 primaryValue 更低 → `false`
- AC-12: 类型不同的普通牌互压 → `false`
- AC-13: `canBeat(pattern, null)` 中 pattern 为非法（null）→ `false`

## 接口 / 数据结构

```typescript
import { CardPattern } from "../../shared/CardPattern";
import { PatternHelper } from "../../shared/PatternHelper";

export class CardPatternEngine {
  /**
   * 服务端权威识别。合法返回 CardPattern，非法返回 null。
   * 内部调用 PatternHelper.parse()。
   */
  static parse(cards: number[]): CardPattern | null;

  /**
   * 判断 challenger 是否能压 current。
   * current 为 null 表示新一轮自由出牌，任意合法牌型均可出。
   * challenger 为 null 表示出牌非法，返回 false。
   */
  static canBeat(
    challenger: CardPattern | null,
    current: CardPattern | null
  ): boolean;
}
```

### 与 PatternHelper 的关系

```
PatternHelper.parse(cards)
  → type === INVALID  =>  CardPatternEngine.parse returns null
  → type !== INVALID  =>  CardPatternEngine.parse returns CardPattern

PatternHelper.canBeat(challenger, current)
  → CardPatternEngine.canBeat 在 current != null 时直接委托
  → current == null  =>  return challenger != null（任意合法均可）
```

## 约束

- 不得自行重新实现识别逻辑；算法来自 `PatternHelper`，保持单一真相源
- 纯静态类，无实例状态，线程安全
- 不做日志，调用方（CardRoom）决定是否记录

## 不在范围内

- `ownsAll` / `removeCards` 等手牌管理（属 RuleEngine，TASK-006）
- 结算计算（属 CardRoom 或独立 SettleService）

## 测试要求

- 单元测试覆盖全部 13 条 AC
- 边界情况：4 张炸、8 张炸、null 入参、空数组
- 错误路径：小王+大王（AC-3）、challenger=null（AC-7、AC-13）
