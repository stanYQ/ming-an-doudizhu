# Bugs

> PM 归档，Dev 认领后打 [x] 并在括号内标注修复 commit 或 PR。

## 格式

```
- [ ] BUG-{id} [{模块}] [{优先级}] {一句话描述} | 负责人: {角色} | 发现: {日期}
```

优先级：🔴 高（Demo 前必修）/ 🟡 中（上线前必修）/ 🟢 低（不阻塞）

---

## 待修复

---

## 已修复

- [x] BUG-004 [server] 🔴 `SettleService.settle()` 异步回调跨测试边界触发 "Cannot log after tests are done" | 修复: server-dev | 日期: 2026-06-22
  - 修复: `CardRoom.test.ts` + `CardRoom.031s.test.ts` 各加 `jest.mock('../services/SettleService', ...)` 阻断真实 mysql2 调用
  - 验证: 356/356 通过，无 "Cannot log" 警告

- [x] BUG-002 [server] `ts-jest` 迁移到 `transform` 写法 | 修复: server-dev | 日期: 2026-06-22

## 修复中

- [ ] BUG-001 [server] 🟡 `charset: 'utf8mb4'` 已加入 `connection.ts` 但 cesu8 仍出现 — charset 配置对 mysql2 编解码器无效，需改用 `connectionString` 或修改 MySQL server 字符集；当前被 BUG-004 掩盖，先解 BUG-004 再验证
- [ ] BUG-003 [server] 🟢 `maxWorkers:1` 缓解了 worker 不退出问题，但引发 BUG-004；待 BUG-004 修复后重新评估是否还需要单独处理
