# Backlog

> PM 写，Client/Server 读。每条任务包含：ID、目标模块、优先级、spec 链接。

## 格式

```
- [ ] TASK-{id} [{模块}] {一句话描述} → spec: specs/{feature}.md
```

---

## 🔥 当前待认领（优先级排序）

### P1 — 技术债清理（代码审查发现，本周完成）

- [ ] TASK-051B [client+构建] shared 层自动同步（预构建脚本方案）→ spec: specs/shared-deduplication-buildscript.md **[ready]** | 工时: 2.5h | 分配: client-dev
- [x] TASK-052 [server] 补全核心文件文件头注释：7 个文件添加标准文件头 → spec: specs/file-header-completion.md **[done: 412/412]** | 完成: 2026-07-09

### P4.7 — 动画同步修复（解除阻塞，可并行）

- [x] TASK-050s [server] 动画同步修复：dealing_ready ACK 等待 + code_card_reveal 广播 + doubling_result 定时器 → spec: specs/animation-sync.md **[done: 412/412]** | 完成: 2026-07-09
- [ ] TASK-050c [client] 动画同步修复：sendDealingReady + code_card_reveal 监听 + doubling_result 动画对齐 → spec: specs/animation-sync.md **[ready]** | 工时: 1-2h | 分配: client-dev

### P5.2 — UI 收尾（需 Cocos Editor）

- [ ] TASK-045b [client] SettlementView Prefab 补全：PlayerResultCard ×5 + 身份揭晓动画 + 倍率明细节点树 → spec: specs/ui-flow-05-settlement-rematch.md **[ready]** | 工时: 0.5h | 分配: client-dev

---

## ✅ 已完成任务归档

<details>
<summary>📦 P0 基础层（2026-06 完成）</summary>

- [x] TASK-001 [shared] CardEncoding.ts：0-107 编码/解码
- [x] TASK-002 [shared] CardPattern.ts：PatternType 枚举
- [x] TASK-003 [shared] PatternHelper.ts：parse() + canBeat()
- [x] TASK-004 [infra] MySQL DDL 建表 + Docker Compose

</details>

<details>
<summary>📦 P1 服务端核心（2026-06 完成）</summary>

- [x] TASK-005 [server] CardPatternEngine.ts
- [x] TASK-006 [server] RuleEngine.ts
- [x] TASK-007 [server] CodeCard.ts
- [x] TASK-009 [server] Deck.ts
- [x] TASK-008 [server] CardRoom.ts：状态机 + 消息处理

</details>

<details>
<summary>📦 P2 客户端 UI（2026-06 完成）</summary>

- [x] TASK-017 [server] AuthService Stub
- [x] TASK-016 [client] 横屏适配
- [x] TASK-010 [client] NetManager.ts
- [x] TASK-011 [client] GameController.ts
- [x] TASK-010b [client] LaunchView.ts
- [x] TASK-012 [client] HandCardView.ts + PlayZone.ts
- [x] TASK-013 [client] PlayerSeat.ts + CodeCardSelector.ts
- [x] TASK-014 [client] SettlementView.ts
- [x] TASK-015 [client] HallView.ts + MatchView.ts

</details>

<details>
<summary>📦 P3 服务端优化（2026-06 完成）</summary>

- [x] TASK-018 [server] MatchMaker
- [x] TASK-021 [server] Logger + 埋点
- [x] TASK-020 [server] AIPlayer：补位/托管

</details>

<details>
<summary>📦 P4.1 AI 升级 + 数值（2026-06 完成）</summary>

- [x] TASK-025 [server] CardDecomposer
- [x] TASK-026 [server] AIPlayer V2
- [x] TASK-024 [server] 数值模拟校准（10万局，Gate 通过）
- [x] TASK-023 [server] 加倍阶段
- [x] TASK-022 [server] SettleService V2

</details>

<details>
<summary>📦 P4.2-P4.6 客户端补全 + 集成测试（2026-06-07 完成）</summary>

- [x] TASK-027 [client] DoublingView
- [x] TASK-028 [client] SettlementView V2
- [x] TASK-029s/c [server+client] 快速匹配 AI 补位
- [x] TASK-030s/c [server+client] 好友房流程
- [x] TASK-031s/c [server+client] 再来一局
- [x] TASK-032s/c [server+client] 集成冒烟测试
- [x] TASK-036 [client] P1 协议全覆盖冒烟（36/36）
- [x] TASK-033 [client] Client ↔ PROTOCOL.md 对齐
- [x] TASK-034/035 [server+client] Bug 修复批次一
- [x] TASK-037/038/039/040 [server] Bug 修复批次二、三

</details>

<details>
<summary>📦 P5.0-P5.1 UI 视觉搭建（2026-07-08 完成）✨</summary>

**架构迁移**:
- [x] TASK-049 [client] GameController → GameMgr 架构迁移

**oops-framework 集成**:
- [x] TASK-041 [client] LaunchScene + HallScene 节点树搭建
- [x] TASK-042 [client] MatchView 弹层搭建

**游戏桌 + 交互**:
- [x] TASK-043 [client] GameScene 节点树 + Prefabs（CardItem/PlayerSeat/HandCardView/CodeCardSelector）
- [x] TASK-043b [client] GameScene 交互补全（AI 标识/发牌动画/ScrollView/划选/hint 闪烁）
- [x] TASK-044 [client] DoublingView + PlayZone 交互 + hint 高亮
- [x] TASK-045 [client] SettlementView 代码层完成

**服务端协议增强**:
- [x] TASK-046 [server] game_over 消息增强（players[] + breakdown）
- [x] TASK-047 [server] GET /api/leaderboard（排行榜）
- [x] TASK-048 [server] POST /api/checkin（每日签到）

</details>

---

## 📊 阶段进度总览

| 阶段 | 状态 | 完成任务 | 测试覆盖 |
|------|------|---------|---------|
| **P0 基础层** | ✅ 100% | 4/4 | shared 100% |
| **P1 服务端核心** | ✅ 100% | 5/5 | 157/157 tests |
| **P2 客户端 UI** | ✅ 100% | 9/9 | 145/145 tests |
| **P3 服务端优化** | ✅ 100% | 3/3 | 241/241 tests |
| **P4 数值 + 集成** | ✅ 100% | 18/18 | 407/407 tests |
| **P5.0-P5.1 UI** | ✅ 100% | 10/10 | Cocos 预览通过 |
| **P5.2 UI 收尾** | 🟡 80% | 4/5 | 1 个 Prefab 待补全 |
| **P4.7 动画修复** | ⏳ 0% | 0/2 | 待认领 |
| **P1 技术债** | ⏳ 0% | 0/2 | 待认领 |

**当前阶段**: P5.2 收尾 + P1 技术债清理 + P4.7 动画修复  
**下一阶段**: P5.3（大厅增强 + 音效系统）待规划

---

## 🎯 推荐认领顺序

### 快速胜利（本周完成）

1. **TASK-052** (30min) — Server 文件头注释，快速提升文档规范
2. **TASK-045b** (0.5h) — SettlementView Prefab，P5.2 收尾

### 重点优化（本周-下周）

3. **TASK-051** (4h) — 消除 shared 层重复，提升代码健康度至 88/100
4. **TASK-050s/c** (3-5h) — 动画同步修复，解决客户端截断问题

---

## 📝 备注

- P5.0-P5.1 UI 视觉搭建已全部完成（2026-07-08），代码层 100% 就绪
- TASK-045b 仅需 Cocos Editor 操作，无代码改动
- TASK-050s/c 已解除阻塞（TASK-043 完成），可立即认领
- 所有归档任务测试全绿：Server 407/407, Client 145/145
