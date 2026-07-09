# Backlog

> PM 写，Client/Server 读。每条任务包含：ID、目标模块、优先级、spec 链接。

## 格式

```
- [ ] TASK-{id} [{模块}] {一句话描述} → spec: specs/{feature}.md
```

---

## 🔥 当前待认领（优先级排序）

### P0 — GameScene UI 完整实现（基于完整 SPEC）

- [ ] TASK-053 [client] GameScene UI 完整实现：按照 SPEC 从零实现所有组件（4 个常驻 UI + 3 个弹窗 + 状态机 + 动画 + 边界处理）→ spec: specs/gamescene-ui-implementation-complete.md **[ready]** | 工时: 25-32h | 分配: client-dev

### P1 — 技术债清理（代码审查发现，本周完成）

- [ ] TASK-051B [client] 预构建脚本自动同步 shared 层：scripts/sync-shared.js + npm scripts + .gitignore 配置 → spec: specs/shared-deduplication-buildscript.md **[ready]** | 工时: 2.5h | 分配: client-dev

### P4.7 — 动画同步修复（解除阻塞，可并行）

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
<summary>📦 P1-P5 全部已完成任务（见原 backlog.md.backup）</summary>

P1-P5 共 49 个任务全部完成，详见备份文件

</details>
