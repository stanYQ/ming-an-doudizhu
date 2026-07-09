# Spec: 补全核心文件文件头注释

**任务 ID**: TASK-052  
**目标模块**: server  
**优先级**: P1（高优先级 — 文档规范）  
**状态**: ready

---

## 执行流程

```
Step 1  认领
        → 更新 .tasks/in-progress.md

Step 2  实现（无需测试生成，纯文档修复）
        → 按 AC 顺序逐个文件添加文件头

Step 3  验证
        → grep 检查所有文件已补全
        → npm test 407/407 通过（确保无语法错误）

Step 4  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除
```

---

## 背景

**来源**: 项目代码审查（project-auditor）发现的 P1 高优先级问题

**现状**: 7 个核心服务端文件缺少文件头注释，违反项目规范：
- `server/CLAUDE.md` 第 86-120 行明确规定：**所有 .ts 文件必须有文件头**
- Client 侧已全部符合，Server 侧遗漏 7 个文件

**问题**:
1. **违反项目规范** — CLAUDE.md 红线要求
2. **代码可读性差** — 新人无法快速理解文件职责
3. **团队协作障碍** — 缺少模块归属和功能描述

---

## 目标

为 7 个核心文件添加标准文件头注释，符合项目规范。

---

## 验收标准

### AC-1: AuthService.ts 添加文件头

**文件**: `server/src/services/AuthService.ts`

**位置**: 文件第 1 行（import 语句之前）

**内容**:
```typescript
/**
 * @file AuthService.ts
 * @description 认证服务：Stub 模式占位登录 + JWT 签发与验证
 * @module server/services
 */
```

---

### AC-2: MatchService.ts 添加文件头

**文件**: `server/src/services/MatchService.ts`

**内容**:
```typescript
/**
 * @file MatchService.ts
 * @description 匹配服务：段位分桶匹配 + 好友房创建 + Redis 队列管理
 * @module server/services
 */
```

---

### AC-3: CardPatternEngine.ts 添加文件头

**文件**: `server/src/logic/CardPatternEngine.ts`

**内容**:
```typescript
/**
 * @file CardPatternEngine.ts
 * @description 牌型识别引擎：权威版牌型解析（单张/对子/顺子/炸弹/王炸）
 * @module server/logic
 */
```

---

### AC-4: CodeCard.ts 添加文件头

**文件**: `server/src/logic/CodeCard.ts`

**内容**:
```typescript
/**
 * @file CodeCard.ts
 * @description 暗号牌逻辑：队友确认 + 一挑四判定 + rank/suit 校验
 * @module server/logic
 */
```

---

### AC-5: Deck.ts 添加文件头

**文件**: `server/src/logic/Deck.ts`

**内容**:
```typescript
/**
 * @file Deck.ts
 * @description 发牌引擎：Fisher-Yates 洗牌 + 5人发牌 + 明牌地主确认
 * @module server/logic
 */
```

---

### AC-6: RuleEngine.ts 添加文件头

**文件**: `server/src/logic/RuleEngine.ts`

**内容**:
```typescript
/**
 * @file RuleEngine.ts
 * @description 游戏规则引擎：出牌合法性校验 + 手牌所有权验证 + 胜负判定
 * @module server/logic
 */
```

---

### AC-7: connection.ts 添加文件头

**文件**: `server/src/db/connection.ts`

**内容**:
```typescript
/**
 * @file connection.ts
 * @description 数据库连接池：MySQL 连接管理 + charset utf8mb4 配置
 * @module server/db
 */
```

---

### AC-8: 验证所有文件头完整

**检查命令**:
```bash
cd server/src
# 检查 services/
head -5 services/AuthService.ts | grep "@file AuthService.ts"
head -5 services/MatchService.ts | grep "@file MatchService.ts"

# 检查 logic/
head -5 logic/CardPatternEngine.ts | grep "@file CardPatternEngine.ts"
head -5 logic/CodeCard.ts | grep "@file CodeCard.ts"
head -5 logic/Deck.ts | grep "@file Deck.ts"
head -5 logic/RuleEngine.ts | grep "@file RuleEngine.ts"

# 检查 db/
head -5 db/connection.ts | grep "@file connection.ts"
```

**预期**: 所有命令都有输出（找到 @file 标记）

---

### AC-9: 测试通过（确保无语法错误）

**命令**:
```bash
cd server
npm test
```

**预期输出**:
```
Test Suites: 20 passed, 20 total
Tests:       407 passed, 407 total
```

---

## 标准文件头格式

**模板**:
```typescript
/**
 * @file 文件名.ts
 * @description 这个文件做什么，属于哪个层（shared/server/infra）
 * @module 模块名（如 shared, CardRoom, RuleEngine）
 */
```

**字段说明**:
- `@file` — 文件名（必须与实际文件名一致）
- `@description` — 一句话说明文件职责（20-50 字）
- `@module` — 模块归属（server/services, server/logic, server/db 等）

**示例**（已有规范的文件）:
```typescript
// server/src/rooms/CardRoom.ts
/**
 * @file CardRoom.ts
 * @description Colyseus 房间主逻辑：状态机（waiting→dealing→playing→settlement）+ 消息处理 + 超时托管
 * @module server/rooms
 */
```

---

## 约束

### 规范约束

1. **文件头必须在第一行** — import 语句之前
2. **@file 必须与文件名完全一致** — 包括 .ts 后缀
3. **@description 一句话说明** — 不超过 80 字
4. **@module 必须准确** — 反映文件在项目中的位置

### 风险约束

1. **零代码逻辑变更** — 只添加注释，不改代码
2. **测试必须全绿** — 添加注释不应影响编译和测试

---

## 不在范围内

- ❌ 添加 public 方法 JSDoc（留待后续优化）
- ❌ 添加业务规则内联注释（已有的保持原样）
- ❌ 重构文件代码逻辑
- ❌ 修改已有文件头（保持现有格式）

---

## 测试要求

**编译验证**:
```bash
cd server
npx tsc --noEmit
# 应无错误输出
```

**测试验证**:
```bash
cd server
npm test
# Tests: 407 passed, 407 total
```

---

## 影响范围

### 文件变更

| 文件 | 操作 | 影响 |
|------|------|------|
| `server/src/services/AuthService.ts` | 添加文件头 | +4 行 |
| `server/src/services/MatchService.ts` | 添加文件头 | +4 行 |
| `server/src/logic/CardPatternEngine.ts` | 添加文件头 | +4 行 |
| `server/src/logic/CodeCard.ts` | 添加文件头 | +4 行 |
| `server/src/logic/Deck.ts` | 添加文件头 | +4 行 |
| `server/src/logic/RuleEngine.ts` | 添加文件头 | +4 行 |
| `server/src/db/connection.ts` | 添加文件头 | +4 行 |

**总计**: +28 行注释

---

## 预计工时

| 阶段 | 工作内容 | 预计工时 |
|------|---------|---------|
| **添加注释** | AC-1~7: 7 个文件 × 4 行 | 20 分钟 |
| **验证** | AC-8~9: grep 检查 + npm test | 5 分钟 |
| **提交** | git commit | 5 分钟 |
| **总计** | | **30 分钟** |

---

## 依赖关系

**前置任务**: 无（独立任务）

**后续任务**: 
- 可选：为所有 public 方法添加 JSDoc（P2 优化）

**阻塞任务**: 无

---

## 成功定义

**完成标准**:
1. ✅ 7 个文件全部有标准文件头
2. ✅ `grep "@file"` 检查通过
3. ✅ `npm test` 407/407 通过
4. ✅ git commit 提交完成

**验收人**: PM Agent

---

**版本**: v1.0  
**创建**: 2026-07-09  
**作者**: PM Agent  
**审批**: 待 server-dev 认领后开始
