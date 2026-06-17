# Blocked

> Dev 遇到阻塞时写这里，等 PM 决策或跨模块协调。

## 格式

```
- [ ] TASK-{id} 阻塞原因: {描述} | 需要: {PM决策|shared变更|跨模块协调} | 报告人: {角色}
```

## 当前阻塞

- [x] SHARED-CHANGE TASK-001/002/003 新建 shared/CardEncoding.ts, CardPattern.ts, PatternHelper.ts | 需要: PM确认 | 报告人: server-dev | 状态: 已确认（PM 2026-06-09 直接分配任务）
- [x] SHARED-CHANGE TASK-007 在 shared/CardPattern.ts 中追加 `export type Suit = number` | 需要: PM确认 | 报告人: server-dev | 状态: 已确认（PM 2026-06-09 P1 任务分配中包含）| client-dev 需同步
- [x] NEW-DEP TASK-008 新增 devDependency `@colyseus/testing@^0.15` 用于 CardRoom 集成测试 | 需要: PM确认 | 报告人: server-dev | 状态: 已确认（spec 明确要求集成测试，PM 分配 TASK-008 即隐式批准）

- [ ] SYNC-NOTICE [client-dev] shared/CardPattern.ts 新增 `export type Suit = number`（TASK-007 产物）| 需要: client-dev 确认已知晓，开始 P2 任务前须引用此类型 | 报告人: PM
