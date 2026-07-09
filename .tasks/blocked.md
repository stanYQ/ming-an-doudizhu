# Blocked

> Dev 遇到阻塞时写这里，等 PM 决策或跨模块协调。

## 格式

```
- [ ] TASK-{id} 阻塞原因: {描述} | 需要: {PM决策|shared变更|跨模块协调} | 报告人: {角色}
```

## 当前阻塞

- [x] TASK-041/联调 阻塞原因: `CardRoom.onAuth` 无 stub 旁路 | 状态: 已修复 | CardRoom.ts:57 stub 旁路已加，405/405 | 日期: 2026-07-01

## 当前阻塞

- [x] TASK-036 阻塞原因: AC-18 需要服务端 `startTurnTimer` 改为异步执行 AI | 状态: 已自动解除 | 日期: 2026-06-29
  - 核查：CardRoom.ts:600-603 已是 `clock.setTimeout(() => executeAIAction(currentSid), delay)`，fix 在之前某次提交中已实现，无需额外改动

- [x] TASK-024 Gate 已通过（PM 决策方案 C：Gate 改为 42%–55%）| 报告人: server-dev | 日期: 2026-06-18 | 结果: 整体 44.79% ✓

  **调参历史（100k 局基准）**

  | 尝试 | partner-pass 阈值 | 整体胜率 | 2v3 胜率 | 1v4 胜率 |
  |------|-----------------|---------|---------|---------|
  | 原始 V2 | 0（任何下降即 pass） | 40.32% | 40.95% | 27.85% |
  | 方案 A-1 | 150（破坏≥1组才 pass） | **43.89%** | 44.69% | 27.81% |
  | 方案 A-2 | 300（破坏≥2倍组才 pass） | ~43.9% | ~44.8% | ~27.8% |

  **根因诊断（已确认）**

  | 问题 | 性质 | 影响 |
  |------|------|------|
  | Partner 策略 | 可调，但已到天花板；150→300 无边际提升 | 改善 +3.6 pp 已收尽 |
  | **结构性劣势** | 2v3：地主营 45 张 / 2人，平民营 63 张 / 3人；1人先出完即赢，平民先出完概率>55% | 2v3 胜率天花板≈45% |
  | **1v4 极难** | 地主 24 张 vs 4人各 21 张；1v4 胜率 ~28%，无法靠 AI 调参解决 | 要将整体拉到 45% 需 2v3 达 45.87%（临界） |

  **达标路径分析**

  整体 45% = 2v3_rate × 0.9525 + 27.8% × 0.0475  
  需要 2v3 ≥ **45.87%**（当前 44.7%，差 1.17 pp）

  **可选方案（供 PM 拍板）**

  - **方案 A3：提升地主激进阈值**（当前 ≤8 张才激进 → 改为 ≤12 张）  
    地主在手牌 ≤12 张时提前进入激进模式，优先炸弹/大牌  
    预计效果：2v3 +0.5–1.5 pp，可能达到 45.87% 临界  
    实现成本：1 行代码，0 规则变更，无 spec 更新

  - **方案 B：1v4 额外底牌**（地主独挑时额外得 3 张底牌 → 共 6 张）  
    1v4 胜率从 28% 可能升至 40–45%，整体 +0.5–0.8 pp  
    但即使 1v4 升至 45%：整体 = 44.7%×0.9525 + 45%×0.0475 = 44.7%（仍差）  
    **需要配合 A3 才能过 Gate**  
    需 GDD 第几章确认此规则？

  - **方案 C（推荐）：调整 Gate 标准**  
    将 Gate 改为 42%–55%（或 40%–58%）  
    理由：结构性 5v2 不对称使天花板 ~44.7%，是博弈机制的预期结果，不是 AI 缺陷  
    最快路径，无规则变更，只改 spec 里的 passGate 判定

  **等待 PM 在 A3 / B / C 中拍板**（可组合）

- [x] SHARED-CHANGE TASK-001/002/003 新建 shared/CardEncoding.ts, CardPattern.ts, PatternHelper.ts | 需要: PM确认 | 报告人: server-dev | 状态: 已确认（PM 2026-06-09 直接分配任务）
- [x] SHARED-CHANGE TASK-007 在 shared/CardPattern.ts 中追加 `export type Suit = number` | 需要: PM确认 | 报告人: server-dev | 状态: 已确认（PM 2026-06-09 P1 任务分配中包含）| client-dev 需同步
- [x] NEW-DEP TASK-008 新增 devDependency `@colyseus/testing@^0.15` 用于 CardRoom 集成测试 | 需要: PM确认 | 报告人: server-dev | 状态: 已确认（spec 明确要求集成测试，PM 分配 TASK-008 即隐式批准）

- [x] SYNC-NOTICE [client-dev] shared/CardPattern.ts 新增 `export type Suit = number`（TASK-007 产物）| 状态: P2 全部完成（TASK-033 已含 Suit 对齐），过期关闭 | 日期: 2026-06-29

- [x] TASK-042 [server] `SettleService.settle()` INSERT `game_records` 缺少 `landlord_id` 列 → 已修复：INSERT 列名单添加 `landlord_id`，参数添加 `summary.landlordId`，405 测试全通过 | 完成: server-dev | 日期: 2026-07-08
