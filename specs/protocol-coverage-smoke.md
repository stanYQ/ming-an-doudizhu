# Spec: PROTOCOL.md 协议全覆盖冒烟

**任务 ID**: TASK-036  
**目标模块**: client + server（client-dev 主导，server-dev 配合）  
**优先级**: P4.5  
**状态**: ready  

---

## 执行流程

> 认领任务后按 Step 顺序执行，不得跳步。

```
Step 1  认领
        → 更新 .tasks/in-progress.md

Step 2  建覆盖矩阵
        → 从 docs/PROTOCOL.md 第 5/6/9/10/11 章列出所有消息、错误码、HTTP 接口

Step 3  生成失败测试（RED）
        → 在 client 集成测试中新增 ProtocolCoverage.integration.test.ts
        → 按本 spec AC 分组，先让缺失覆盖项失败

Step 4  实现测试代理 / 测试夹具
        → 只写测试和必要测试辅助；不改业务协议，除非发现真实 bug

Step 5  覆盖率检查
        → 对照覆盖矩阵确认每个 PROTOCOL.md 条目有至少 1 条测试覆盖

Step 6  验证
        → server: AI_FILL_DELAY=0 AUTH_MODE=stub npm run dev
        → client: npm test -- --testPathPattern=ProtocolCoverage.integration

Step 7  阻塞处理
        → 发现协议实现与 PROTOCOL.md 不一致，写入 .tasks/integration-issues.md，由 PM 判定改文档还是改代码

Step 8  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除
```

---

## 背景

`TASK-032c-fix` 负责一条完整自然牌局，验证真实网络下主链路可打完。但主链路无法稳定覆盖 `docs/PROTOCOL.md` 的所有分支，例如好友房、重连、错误码、超时兜底、`/auth/me`。

本任务是 P1 协议全覆盖冒烟：以 `docs/PROTOCOL.md` 为权威，建立覆盖矩阵，用多条集成测试覆盖所有客户端→服务端消息、服务端→客户端消息、错误码、重连响应、HTTP 接口。

---

## 验收标准

### 覆盖矩阵

- AC-1: 测试文件内维护 `PROTOCOL_COVERAGE` 覆盖矩阵，列出每个协议项、对应测试名、覆盖状态
- AC-2: 覆盖矩阵包含客户端→服务端消息：`ready`、`select_code_card`、`play_cards`、`pass`、`set_double`、`force_start`、`request_rematch`、`request_hint`、`reconnect_sync`
- AC-3: 覆盖矩阵包含服务端→客户端消息：`your_hand`、`bottom_cards`、`hint`、`rematch_redirect`、`error`、`waiting_update`、`room_update`、`doubling_start`、`landlord_doubled`、`doubling_result`、`turn_change`、`identity_reveal`、`game_over`、`rematch_update`、`rematch_start`
- AC-4: 覆盖矩阵包含 HTTP 接口：`POST /auth/login` 成功、`POST /auth/login` 缺少 code、`GET /auth/me` 成功、`GET /auth/me` 无效 token

### 主流程与出牌

- AC-5: 快速匹配 1 真人 + AI 补位完整打一局，覆盖 `waiting_update`、`your_hand`、`bottom_cards`、`select_code_card`、`doubling_start`、`set_double`、`landlord_doubled`、`doubling_result`、`turn_change`、`request_hint`、`hint`、`play_cards`、`pass`、`game_over`、`request_rematch`、`rematch_redirect`
- AC-6: 若本局打出暗号牌，验证 `identity_reveal` 结构；若未自然触发，不得强行判失败，需由 AC-15 的定向用例覆盖

### 好友房

- AC-7: 创建好友房后收到 `room_update`，结构包含 `players[]` 与 `ownerSeatIndex`
- AC-8: 好友房 1 真人发送 `force_start` 返回 `error { code: 2003 }`
- AC-9: 好友房至少 2 真人时，房主发送 `force_start` 后 AI 补位并进入发牌
- AC-10: 好友房结算后，每个真实玩家发送 `request_rematch` 会广播 `rematch_update`
- AC-11: 好友房真实玩家全员同意后广播 `rematch_start`，并重新收到下一局 `your_hand`

### 重连

- AC-12: `playing` 阶段断线重连后发送 `reconnect_sync`，收到 `your_hand` 与 `turn_change`
- AC-13: `doubling` 阶段断线重连后发送 `reconnect_sync`，收到 `your_hand` 与 `doubling_start`
- AC-14: `landlord_select` 阶段地主断线重连后发送 `reconnect_sync`，收到 `your_hand`、`bottom_cards`、`landlord_select_start`

### 定向分支与错误码

- AC-15: 定向构造暗号牌被打出的局面，验证 `identity_reveal { playerId, role: "partner" }`
- AC-16: 非地主在 `landlord_select` 阶段发送 `select_code_card` 被静默忽略，阶段不变化
- AC-17: 地主选择非法暗号牌（`value >= 8`）返回 `error { code: 1001 }`
- AC-18: 非当前玩家发送 `play_cards` 返回 `error { code: 1003 }`
- AC-19: 当前玩家发送不在手牌中的牌返回 `error { code: 1004 }`
- AC-20: 当前玩家发送非法牌型返回 `error { code: 1001 }`
- AC-21: 当前玩家发送压不过上家的牌返回 `error { code: 1002 }`
- AC-22: 自由出牌轮发送 `pass` 返回 `error { code: 1002 }`
- AC-23: `set_double` 重复提交时行为与当前服务端实现一致；若 PROTOCOL.md 与实现不一致，记录 issue 给 PM 判定
- AC-24: `ready` 消息发送后不报错、不改变当前关键状态

### 超时兜底

- AC-25: `landlord_select` 超时后自动进入 `doubling`
- AC-26: `doubling` 超时后未提交玩家按不加倍处理，并进入 `playing`
- AC-27: 出牌超时后自动推进回合；连续 3 次超时后进入托管并继续推进

---

## 接口 / 数据结构

```typescript
type ProtocolCoverageItem = {
  id: string;
  section: "client_to_server" | "server_to_client" | "http" | "schema" | "error";
  protocol: string;
  testName: string;
  covered: boolean;
};

type RecentProtocolTrace = {
  turns: Array<{ seatIndex: number; deadline: number }>;
  hints: number[][];
  errors: Array<{ code: number; msg: string }>;
  messages: Array<{ type: string; data: unknown }>;
};
```

---

## 约束

- 以 `docs/PROTOCOL.md` 为覆盖权威；发现文档与实现不一致时，不静默改测试绕过
- 允许用多条集成测试覆盖协议全集；禁止把所有分支塞进单条超长测试
- 不新增业务协议、不新增运行时依赖
- 不使用 `TEST_FAST_WIN` 跳过出牌、加倍、结算等协议链路
- 可以使用测试超时环境变量（如 `AI_FILL_DELAY=0`、`LANDLORD_SELECT_TIMEOUT=0`）触发已有协议分支
- 测试失败必须输出最近 `turn_change`、`hint`、`error`、关键消息队列，方便定位

---

## 不在范围内

- Cocos UI 渲染与场景装配
- 压力测试、性能测试、弱网测试
- 微信真实 OAuth
- 修改牌型规则或 AI 策略
- 数据库积分落库准确性深验；本任务只验证 `game_over.scores` 广播结构

---

## 测试要求

- 新增或扩展 client 集成测试，建议文件：`client/tests/__tests__/ProtocolCoverage.integration.test.ts`
- 覆盖所有 AC-1 至 AC-27
- 边界情况：地主/非地主、快速匹配/好友房、playing/doubling/landlord_select 重连
- 错误路径：`1001`、`1002`、`1003`、`1004`、`2003`、`3001`、HTTP `400/401`
