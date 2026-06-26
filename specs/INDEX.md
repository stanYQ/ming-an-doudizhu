# Specs 索引

> 最后更新：2026-06-26  
> 格式：`[文件名](path)` — 任务ID · 状态 · 说明

---

## 一、架构决策（长期参考）

| 文件 | 说明 |
|------|------|
| [adr-client-arch.md](adr-client-arch.md) | Client 三层架构决策（v3，最终版）|
| [_template.md](_template.md) | Spec 模板 |

---

## 二、待执行（Active）

> 按执行顺序排列

| 文件 | 任务 | 模块 | 前置 |
|------|------|------|------|
| [arch-phase1-gamemgr.md](arch-phase1-gamemgr.md) | TASK-049 | client | — |
| [ui-flow-01-launch-hall.md](ui-flow-01-launch-hall.md) | TASK-041 | client | TASK-049 |
| [ui-flow-02-match-wait.md](ui-flow-02-match-wait.md) | TASK-042 | client | TASK-041 |
| [ui-flow-03-deal-landlord.md](ui-flow-03-deal-landlord.md) | TASK-043 | client | TASK-042 |
| [ui-flow-04-doubling-play.md](ui-flow-04-doubling-play.md) | TASK-044 | client | TASK-043 |
| [ui-flow-05-settlement-rematch.md](ui-flow-05-settlement-rematch.md) | TASK-045 | client | TASK-044 |
| _(待写)_ | TASK-047 GET /api/leaderboard | server | — |
| _(待写)_ | TASK-048 POST /api/checkin | server | — |

---

## 三、已完成（Done）

### P0 — 共享层

| 文件 | 任务 | 产物 |
|------|------|------|
| [card-encoding.md](card-encoding.md) | TASK-001 | shared/CardEncoding.ts |
| [card-pattern.md](card-pattern.md) | TASK-002 | shared/CardPattern.ts |
| [pattern-helper.md](pattern-helper.md) | TASK-003 | shared/PatternHelper.ts |
| [infra-setup.md](infra-setup.md) | TASK-004 | infra/mysql + docker-compose |

### P1 — 服务端核心

| 文件 | 任务 | 产物 |
|------|------|------|
| [card-pattern-engine.md](card-pattern-engine.md) | TASK-005 | server/logic/CardPatternEngine.ts |
| [rule-engine.md](rule-engine.md) | TASK-006 | server/logic/RuleEngine.ts |
| [code-card.md](code-card.md) | TASK-007 | server/logic/CodeCard.ts |
| [deck.md](deck.md) | TASK-009 | server/logic/Deck.ts |
| [card-room.md](card-room.md) | TASK-008 | server/rooms/CardRoom.ts |
| [auth-service-stub.md](auth-service-stub.md) | TASK-017 | server/services/AuthService.ts |
| [logging-monitor.md](logging-monitor.md) | TASK-021 | server/utils/Logger.ts |

### P2 — 客户端核心

| 文件 | 任务 | 产物 |
|------|------|------|
| [screen-adaptation.md](screen-adaptation.md) | TASK-016 | core/ScreenAdapter.ts |
| [net-manager.md](net-manager.md) | TASK-010 | net/NetManager.ts |
| [game-controller.md](game-controller.md) | TASK-011 | game/GameController.ts ⚠️ TASK-049 迁移中 |
| [launch-login.md](launch-login.md) | TASK-010b | ui/view/LaunchView.ts |
| [hall-match-view.md](hall-match-view.md) | TASK-015 | ui/view/HallView.ts + MatchView.ts |
| [game-table-ui.md](game-table-ui.md) | TASK-012 | ui/view/HandCardView.ts + PlayZone.ts |
| [player-seat-ui.md](player-seat-ui.md) | TASK-013 | ui/view/PlayerSeat.ts + CodeCardSelector.ts |
| [settlement-view.md](settlement-view.md) | TASK-014 | ui/view/SettlementView.ts V1 |

### P3/P4 — 服务端功能

| 文件 | 任务 | 产物 |
|------|------|------|
| [matchmaker.md](matchmaker.md) | TASK-018 | server/services/MatchService.ts |
| [settle-service.md](settle-service.md) | TASK-019 | ⚠️ 已废弃，见 scoring-v2.md |
| [ai-player.md](ai-player.md) | TASK-020 | server/logic/AIPlayer.ts V1 |
| [card-decomposer.md](card-decomposer.md) | TASK-025 | server/logic/CardDecomposer.ts |
| [smart-ai-player.md](smart-ai-player.md) | TASK-026 | server/logic/AIPlayer.ts V2 |
| [simulation-calibration.md](simulation-calibration.md) | TASK-024 | Gate 42%–55% ✓ |
| [doubling-phase.md](doubling-phase.md) | TASK-023 | CardRoom doubling 状态 |
| [scoring-v2.md](scoring-v2.md) | TASK-022 | SettleService V2 零和公式 |
| [battle-report-log.md](battle-report-log.md) | TASK-038 | CardRoom.logBattleReport |
| [server-game-over-enhance.md](server-game-over-enhance.md) | TASK-046 | game_over players[]+breakdown ✓ |

### P4 — 客户端功能

| 文件 | 任务 | 产物 |
|------|------|------|
| [doubling-view.md](doubling-view.md) | TASK-027 | ui/view/DoublingView.ts |
| [settlement-view-v2.md](settlement-view-v2.md) | TASK-028 | SettlementView V2 倍率明细 |
| [quick-match-ai-fill.md](quick-match-ai-fill.md) | TASK-029s/c | AI 补位 + 等待界面 |
| [friend-room-flow.md](friend-room-flow.md) | TASK-030s/c | 好友房 |
| [rematch.md](rematch.md) | TASK-031s/c | 再来一局 |
| [client-protocol-align.md](client-protocol-align.md) | TASK-033 | 协议对齐 |
| [bugfix-server-034.md](bugfix-server-034.md) | TASK-034 | Server Bug 批次一 |
| [bugfix-client-035.md](bugfix-client-035.md) | TASK-035 | Client Bug 批次一 |

### P4.4 — 集成冒烟 / QA

| 文件 | 任务 | 产物 |
|------|------|------|
| [integration-smoke.md](integration-smoke.md) | TASK-032s/c | GameFlow.integration.test.ts |
| [protocol-coverage-smoke.md](protocol-coverage-smoke.md) | TASK-036 | ProtocolCoverage.integration.test.ts |

---

## 四、已废弃

| 文件 | 原因 |
|------|------|
| [settle-service.md](settle-service.md) | V1 积分公式，被 scoring-v2.md（TASK-022）完全替换 |

---

## 五、注意事项

- `game-controller.md`（TASK-011）的产物 `GameController.ts` 正在被 TASK-049 迁移为 `GameMgr.ts`，spec 本身归档保留
- `settlement-view.md`（V1）被 `settlement-view-v2.md` 扩展，非替换，两者均有效
- UI 流程 spec（`ui-flow-01~05`）是 P5 的权威来源，早期同主题 spec（hall-match-view / game-table-ui 等）仅做历史参考
