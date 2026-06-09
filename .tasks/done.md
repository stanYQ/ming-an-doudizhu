# Done

> 任务完成后移到这里，注明完成者、测试状态、产物路径。

## 格式

```
- [x] TASK-{id} [{模块}] {描述} | 完成: {client-dev|server-dev} | 测试: ✓/✗ | 产物: {文件路径}
```

## 已完成

- [x] TASK-001 [shared] 实现 CardEncoding.ts：0-107 编码/解码 + compareValue | 完成: server-dev | 测试: ✓ 23/23 | 产物: shared/CardEncoding.ts | client-dev 需同步
- [x] TASK-002 [shared] 实现 CardPattern.ts：PatternType 枚举 + CardPattern 接口 | 完成: server-dev | 测试: ✓ 4/4 | 产物: shared/CardPattern.ts | client-dev 需同步
- [x] TASK-003 [shared] 实现 PatternHelper.ts：parse() + canBeat() | 完成: server-dev | 测试: ✓ 42/42 | 产物: shared/PatternHelper.ts | client-dev 需同步
- [x] TASK-004 [infra] MySQL DDL 建表 + Docker Compose 骨架 | 完成: server-dev | 测试: ✓ 6/6 (RedisKeys) + 手动验收待 | 产物: infra/mysql/init.sql, infra/docker-compose.yml, infra/nginx.conf, server/src/cache/RedisKeys.ts
