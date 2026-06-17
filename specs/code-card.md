# Spec: 暗号牌与队友确认 CodeCard

**任务 ID**: TASK-007  
**目标模块**: server  
**优先级**: P1  
**状态**: ready  
**前置依赖**: TASK-001（CardEncoding.ts）done

---

## 背景

来源：GAME-RULES.md 第七章（暗号牌规则）+ 第四章（阵营规则）。地主从 3–10 之间指定一张具体花色的牌作为暗号牌；系统找出另一张同名牌的持有者，该人为暗队友（身份隐藏）。若两张同名牌都在地主手中，触发一挑四（无队友，倍率×2）。暗队友打出暗号牌时系统立即公开其身份。

**机制要点**（来自源码文档 1.1 节）：
- 地主「主动指定」，不是系统随机
- 判定规则始终为「另一张同名牌在谁手里，谁就是队友」
- 地主自己是否持有该牌不影响判定逻辑，只看「另一张」在哪

## 验收标准

### isValidSelection()

- AC-1: suit ∈ {0,1,2,3} 且 rank ∈ {0..7}（点数 3–10）→ `true`
- AC-2: rank = 8（J）→ `false`（错误码 1001）
- AC-3: rank = 12（2）→ `false`
- AC-4: suit = 4（越界）→ `false`
- AC-5: 合法组合共 32 种（8点数 × 4花色），全部通过；J/Q/K/A/2 全部拒绝

### resolveTeammate()

- AC-6: 地主持有第1副，另一张（第2副）在某平民手中 → `partnerId` = 该平民，`isLandlordAlone: false`
- AC-7: 两张同名牌都在地主手中 → `partnerId: null`，`isLandlordAlone: true`
- AC-8: 地主未持有任何一张，两张都在两名不同平民手中 → `partnerId` = 第一个非地主持有者
- AC-9: 地主未持有，两张都在同一名平民手中 → `partnerId` = 该平民
- AC-10: `codeCardPair` 字段包含且仅包含该花色+点数对应的两张物理编码（deck0 和 deck1 各一张）

### containsCodeCard()

- AC-11: 出牌中包含 `codeCardPair` 任意一张 → `true`
- AC-12: 出牌中不包含 `codeCardPair` 任何一张 → `false`
- AC-13: 出牌为空数组 → `false`

### describe()（可选，用于结算公示）

- AC-14: `{ suit: 1, rank: 4 }` → 返回字符串 `"♥7"`
- AC-15: `{ suit: 0, rank: 0 }` → 返回字符串 `"♠3"`

## 接口 / 数据结构

```typescript
import { Suit } from "../../shared/CardPattern"; // 复用花色枚举

export interface CodeCardSelection {
  suit: Suit;   // 0=♠ 1=♥ 2=♦ 3=♣
  rank: number; // 0=3 ... 7=10（仅允许 0–7）
}

export interface TeammateResult {
  partnerId: string | null;     // null = 一挑四
  isLandlordAlone: boolean;
  codeCardPair: number[];       // 两张物理编码 [deck0card, deck1card]
}

export class CodeCard {
  /** 校验暗号牌选择合法性 */
  static isValidSelection(sel: CodeCardSelection): boolean;

  /**
   * 确认暗队友。
   * hands: 全体玩家手牌 Map<playerId, number[]>（服务端内存数据）
   * 规则：找第一个非地主持有者；若无则触发一挑四。
   */
  static resolveTeammate(
    sel: CodeCardSelection,
    landlordId: string,
    hands: Map<string, number[]>
  ): TeammateResult;

  /**
   * 检测本次出牌是否包含暗号牌（触发身份公开）。
   * codeCardPair 来自 resolveTeammate 的返回值。
   */
  static containsCodeCard(
    playedCards: number[],
    codeCardPair: number[]
  ): boolean;

  /** 暗号牌可读描述，如 "♥7"。用于日志和结算广播。 */
  static describe(sel: CodeCardSelection): string;
}
```

### 暗号牌编码计算

```
deck0 card = 0 × 54 + sel.suit × 13 + sel.rank
deck1 card = 1 × 54 + sel.suit × 13 + sel.rank
```

两者合称 `codeCardPair`，用于全局身份检测。

## 约束

- `resolveTeammate` 只读 `hands`，不修改任何数据
- `hands` 是服务端内存数据，此模块不得暴露给客户端（放 `server/logic/`，不放 `shared/`）
- 一挑四判定：「无非地主持有者」即触发，与地主自己持有几张无关

## 不在范围内

- 一挑四的积分倍率（×3）计算（属结算逻辑，见 specs/scoring-v2.md）
- 身份公开的广播消息发送（属 CardRoom，响应 `containsCodeCard` 结果）
- 地主选择暗号牌的 UI 交互流程

## 测试要求

- 单元测试覆盖全部 15 条 AC
- 边界情况（源码文档三大场景全覆盖）：
  - 场景 A：地主持有1张，平民持有1张（AC-6）
  - 场景 B：两张都在地主（AC-7）
  - 场景 C：地主未持有，两张在两名不同平民（AC-8）
- 错误路径：非法 rank（AC-2、AC-3）、越界 suit（AC-4）
