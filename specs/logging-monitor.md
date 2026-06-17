# Spec: 结构化日志与监控埋点

**任务 ID**: TASK-021  
**目标模块**: server  
**优先级**: P3  
**状态**: ready  
**前置依赖**: TASK-008（CardRoom）done

---

## 背景

来源：TDD v1.0 第十章（监控与告警、日志规范）。P1 阶段代码未加日志，P3 上线前需统一接入结构化日志和关键埋点，保障可观测性。日志格式为 JSON，含 `roomId`/`userId`/`timestamp` 字段，便于检索。埋点事件对应 GDD 第十章（10.2 关键埋点）。

## 验收标准

### 日志规范

- AC-1: 所有日志输出为 JSON 格式，必含字段：`level`、`timestamp`（ISO 8601）、`msg`
- AC-2: 游戏相关日志含 `roomId`；用户相关日志含 `userId`
- AC-3: 日志分级：`DEBUG`（开发）/ `INFO`（正常流程）/ `WARN`（可恢复异常）/ `ERROR`（需告警）
- AC-4: `NODE_ENV=production` 时，`DEBUG` 级别日志不输出
- AC-5: 不使用 `console.log`；所有日志通过统一 `Logger` 模块输出

### 关键链路埋点（INFO 级）

- AC-6: 玩家登录成功：`{ event: "login", userId, platform }`
- AC-7: 匹配开始：`{ event: "match_start", userId, tier }`
- AC-8: 对局开始：`{ event: "game_start", roomId, landlordId, isLandlordAlone }`
- AC-9: 对局结束：`{ event: "game_end", roomId, winnerCamp, duration, multiplier }`
- AC-10: 出牌异常（错误码 1001–1004）：`{ event: "play_error", roomId, userId, errorCode }`

### 错误日志（ERROR 级）

- AC-11: MySQL 事务失败 → ERROR 含 `{ event: "db_error", roomId, error: message }`
- AC-12: CardRoom 未捕获异常 → ERROR 含完整 stack trace

### PM2 日志输出

- AC-13: 日志写入 stdout（由 PM2 捕获），不自行管理日志文件
- AC-14: 单条日志大小不超过 4KB（超长 stack trace 截断）

## 接口 / 数据结构

```typescript
// server/src/utils/Logger.ts

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  roomId?: string;
  userId?: number;
  event?: string;
  [key: string]: unknown;
}

export class Logger {
  static debug(msg: string, ctx?: LogContext): void;
  static info(msg: string, ctx?: LogContext): void;
  static warn(msg: string, ctx?: LogContext): void;
  static error(msg: string, ctx?: LogContext & { error?: Error }): void;
}
```

### 日志输出示例

```json
{"level":"info","timestamp":"2026-06-09T10:00:00.000Z","msg":"game_end","roomId":"abc123","winnerCamp":1,"duration":480,"multiplier":4}
{"level":"error","timestamp":"2026-06-09T10:01:00.000Z","msg":"db_error","roomId":"abc123","error":"Deadlock found when trying to get lock"}
```

## 约束

- `Logger` 不引入第三方日志库（winston/pino 等）；由 dev 在 Node.js 原生能力内实现，或选用 TDD 已认可的框架
- 埋点字段名与 GDD 10.2 完全一致（`login` / `match_start` / `game_start` / `game_end`），不自行命名
- 生产环境日志由 PM2 + ELK 收集（TDD 10.2），Logger 只负责输出到 stdout

## 不在范围内

- Prometheus metrics 接入 —— P4
- 告警规则配置（CPU > 80%）—— P4（运维配置，非代码）
- 前端埋点（客户端行为日志）—— P4

## 测试要求

- 单元测试覆盖全部 14 条 AC
- 边界情况：`NODE_ENV=production` 时 DEBUG 不输出（AC-4）、超长 stack trace 截断（AC-14）
- 错误路径：Logger 自身抛出异常时不能影响主流程（静默降级）
