# Blocked

> Dev 遇到阻塞时写这里，等 PM 决策或跨模块协调。

## 格式

```
- [ ] TASK-{id} 阻塞原因: {描述} | 需要: {PM决策|shared变更|跨模块协调} | 报告人: {角色}
```

## 已解决（历史记录）

- [x] TASK-051 [client+shared] 技术障碍：Cocos Creator 跨目录引用 → 已解决：采用预构建脚本方案（TASK-051B）| 日期: 2026-07-09
- [x] TASK-041/联调 `CardRoom.onAuth` 无 stub 旁路 → 已修复：CardRoom.ts:57 stub 旁路已加 | 日期: 2026-07-01
- [x] TASK-036 AC-18 需服务端 `startTurnTimer` 异步执行 AI → 已自动解除 | 日期: 2026-06-29
- [x] TASK-024 Gate 已通过（方案 C：Gate 改为 42%–55%）| 日期: 2026-06-18 | 整体胜率 44.79% ✓
- [x] SHARED-CHANGE TASK-001/002/003 新建 shared/ | 已确认（PM 直接分配）
- [x] SHARED-CHANGE TASK-007 `export type Suit = number` | 已确认 | client-dev 需同步
- [x] NEW-DEP TASK-008 `@colyseus/testing@^0.15` | 已确认
- [x] SYNC-NOTICE [client-dev] shared/CardPattern.ts Suit 新增 | P2 全部完成，过期关闭 | 日期: 2026-06-29
- [x] TASK-042 [server] SettleService INSERT 缺 `landlord_id` → 已修复：INSERT 列名单添加 `landlord_id`，参数添加 `summary.landlordId`，407/407 | server-dev | 日期: 2026-07-08

## 当前阻塞

- [ ] TASK-051 [client+shared] 技术障碍：Cocos Creator 不支持跨目录引用 /shared/ | 需要: PM决策技术方案 | 报告人: client-dev | 日期: 2026-07-09
  - **问题**: Cocos Creator 要求所有代码在 `assets/` 内，不支持 TypeScript 路径映射 `@shared/*`，也不支持跨目录相对路径 `../../../shared/`
  - **已尝试方案**:
    1. ❌ TypeScript 路径映射 `@shared/*` — Cocos 运行时不识别
    2. ❌ 相对路径 `../../../shared/` — TypeScript 编译失败
    3. ❌ 符号链接 `client/assets/scripts/shared → /shared/` — Cocos 要求导入添加 `.ts` 扩展名，破坏 server 端（Node.js 不需要扩展名）
  - **可行方案**:
    - 方案 A: **保持副本**（回退 TASK-051）— 维持现状，接受手动同步开销
    - 方案 B: **预构建脚本** — npm script 自动同步 `/shared/` → `client/assets/scripts/shared/`
    - 方案 C: **重构为 npm package** — 将 shared 发布为独立包，双端引用
  - **建议**: 方案 A（副本）成本最低；方案 B 可作为增量优化（5min/次同步 → 自动化）
  - **影响**: 当前有未提交改动（符号链接 + 导入语句修改），需回退或继续推进
