# Blocked

> Dev 遇到阻塞时写这里，等 PM 决策或跨模块协调。

## 格式

```
- [ ] TASK-{id} 阻塞原因: {描述} | 需要: {PM决策|shared变更|跨模块协调} | 报告人: {角色}
```

## 已解决（历史记录）

- [x] TASK-HAND-UPDATE [server] 出牌/pass 后服务端未发送 `your_hand` → 已修复：handlePlay 成功后发送 client.send("your_hand")，412/412 | server-dev | 日期: 2026-07-09
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

（无）
