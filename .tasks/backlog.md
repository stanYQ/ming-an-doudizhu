# Backlog

> PM 写，Client/Server 读。每条任务包含：ID、目标模块、优先级、spec 链接。

## 格式

```
- [ ] TASK-{id} [{模块}] {一句话描述} → spec: specs/{feature}.md
```

## 当前任务

- [x] TASK-001 [shared] 实现 CardEncoding.ts：0-107 编码/解码 + compareValue → spec: specs/card-encoding.md **[ready]**
- [x] TASK-002 [shared] 实现 CardPattern.ts：PatternType 枚举 + CardPattern 接口 → spec: specs/card-pattern.md **[ready]**
- [x] TASK-003 [shared] 实现 PatternHelper.ts：parse() + canBeat() → spec: specs/pattern-helper.md **[ready]**
- [x] TASK-004 [infra] MySQL DDL 建表 + Docker Compose 骨架 → spec: specs/infra-setup.md **[ready]**

## P1 任务（依赖 P0 shared 完成）

- [ ] TASK-005 [server] 实现 CardPatternEngine.ts：服务端权威识别，parse 返回 null，canBeat 支持 null 新一轮 → spec: specs/card-pattern-engine.md **[ready]**
- [ ] TASK-006 [server] 实现 RuleEngine.ts：ownsAll + removeCards + validatePlay + determineWinner → spec: specs/rule-engine.md **[ready]**
- [ ] TASK-007 [server] 实现 CodeCard.ts：暗号牌校验 + 队友确认 + 一挑四判定 → spec: specs/code-card.md **[ready]**
- [ ] TASK-009 [server] 实现 Deck.ts：Fisher-Yates 洗牌 + 5人发牌 + 明牌地主确认 → spec: specs/deck.md **[ready]**
- [ ] TASK-008 [server] 实现 CardRoom.ts：状态机 + 消息处理 + 超时托管 + 断线重连 → spec: specs/card-room.md **[ready]** （前置：TASK-005/006/007/009）
