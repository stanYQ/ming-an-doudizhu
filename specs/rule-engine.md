# Spec: 服务端规则引擎 RuleEngine

**任务 ID**: TASK-006  
**目标模块**: server  
**优先级**: P1  
**状态**: ready  
**前置依赖**: TASK-005（CardPatternEngine）done

---

## 背景

来源：TDD v1.0 第四章（CardRoom 出牌校验）+ GAME-RULES.md 第八章（胜负判定）。处理服务端三大权威校验：① 玩家是否真正持有出牌（防伪造）；② 出牌是否合法且能压过上家（综合校验）；③ 手牌清空后的胜负阵营判定。与 `CardPatternEngine` 分离：后者只管识别，本模块管持有权和规则判定。

## 验收标准

### ownsAll()

- AC-1: 手牌中包含全部提交的牌（含重复）→ `true`
- AC-2: 提交牌中有一张手牌不持有 → `false`
- AC-3: 重复牌：手牌有 1 张 ♠3，提交 2 张 ♠3 → `false`
- AC-4: 空提交数组 → `true`（出牌 0 张视为持有）

### removeCards()

- AC-5: 从手牌中移除出牌后，手牌长度减少对应张数
- AC-6: 只移除第一个匹配项（手牌有 2 张 ♠3，移除 1 张 ♠3 后还剩 1 张）
- AC-7: 提交的牌不在手牌中 → 静默跳过（不抛出）

### validatePlay()

- AC-8: `ownsAll` 失败 → `{ ok: false, errorCode: 1004 }`
- AC-9: 牌型非法（`parse` 返回 null）→ `{ ok: false, errorCode: 1001 }`
- AC-10: 牌型合法但压不过上家 → `{ ok: false, errorCode: 1002 }`
- AC-11: 全部校验通过 → `{ ok: true, pattern: CardPattern }`
- AC-12: `lastPlay` 为 `null`（新一轮）→ 任意合法牌型均通过（`errorCode` 不为 1002）

### determineWinner()

- AC-13: 标准模式，出完者 = 地主 → 返回 `'landlord_camp'`
- AC-14: 标准模式，出完者 = 暗队友 → 返回 `'landlord_camp'`
- AC-15: 标准模式，出完者 = 普通平民 → 返回 `'civilian_camp'`
- AC-16: 一挑四模式（`partnerId` 为 `null`），出完者 = 地主 → 返回 `'landlord_camp'`
- AC-17: 一挑四模式，出完者 ≠ 地主 → 返回 `'civilian_camp'`

## 接口 / 数据结构

```typescript
import { CardPattern } from "../../shared/CardPattern";
import { CardPatternEngine } from "./CardPatternEngine";

export type WinnerCamp = "landlord_camp" | "civilian_camp";

export interface ValidateResult {
  ok: boolean;
  pattern: CardPattern;
  errorCode?: 1001 | 1002 | 1004;
}

export class RuleEngine {
  /**
   * 校验玩家手中是否真正持有 cards 中的每一张（防伪造）。
   * 考虑重复牌：pool 中每张只能用一次。
   */
  static ownsAll(hand: number[], cards: number[]): boolean;

  /**
   * 从 hand 中就地移除 cards。每张只移除一次首个匹配。
   */
  static removeCards(hand: number[], cards: number[]): void;

  /**
   * 综合出牌校验：ownsAll + parse + canBeat（三关全通才算合法）。
   * lastPlay 为 null 表示新一轮，跳过压牌校验。
   */
  static validatePlay(
    hand: number[],
    cards: number[],
    lastPlay: CardPattern | null
  ): ValidateResult;

  /**
   * 某玩家手牌清空，判定胜利阵营。
   * partnerId 为 null 表示一挑四模式。
   */
  static determineWinner(
    emptyHandPlayerId: string,
    landlordId: string,
    partnerId: string | null
  ): WinnerCamp;
}
```

## 约束

- `removeCards` 就地修改传入的 `hand` 数组（调用方知晓）
- `ownsAll` 不修改任何状态，纯函数
- `validatePlay` 内部调用 `CardPatternEngine`，不直接调用 `PatternHelper`
- 胜负判定逻辑以 GAME-RULES.md 第八章为准，不依赖任何 Schema 字段

## 不在范围内

- 积分结算计算（BaseScore × 总倍率 × 阵营系数）
- 连续超时托管触发（属 CardRoom 状态机）
- 断线重连逻辑

## 测试要求

- 单元测试覆盖全部 17 条 AC
- 边界情况：重复牌的 ownsAll（AC-3）、空提交（AC-4）、新一轮 lastPlay=null（AC-12）
- 错误路径：AC-8 / AC-9 / AC-10 各有独立用例，errorCode 必须精确匹配
