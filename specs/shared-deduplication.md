# Spec: 消除 shared 层代码重复

**任务 ID**: TASK-051  
**目标模块**: client + shared  
**优先级**: P1（高优先级 — 技术债）  
**状态**: ready

---

## 执行流程

```
Step 1  认领
        → 更新 .tasks/in-progress.md

Step 2  生成失败测试（RED）
        → /tdd-gen（可选，主要是配置验证）
        → 确认现有 145 个测试全绿作为基线

Step 3  实现
        → 按 AC 顺序逐条实现，每完成一条跑一次测试

Step 4  覆盖率检查
        → npm test 全套通过

Step 5  Diff 审查
        → /karpathy

Step 6  验证
        → npm test 145/145 通过
        → Cocos Creator 预览正常
        → GameFlow.integration.test.ts 通过

Step 7  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除
```

---

## 背景

**来源**: 项目代码审查（project-auditor）发现的 P1 高优先级问题

**现状**: `client/assets/scripts/shared/` 包含 `/shared/` 的完整副本：
- `CardEncoding.ts`（168 行）
- `PatternHelper.ts`（156 行）
- `CardPattern.ts`（45 行）

**问题**:
1. **违反 DRY 原则** — 每次 shared 变更需同步两处
2. **协调开销高** — server-dev 改 shared → blocked.md 通知 → client-dev 手动同步
3. **Bug 风险** — TASK-039 单张王规则修复时差点遗漏客户端同步
4. **Review 负担** — 同一改动在 diff 中出现两次

**历史案例**:
- TASK-007: server-dev 改 `CardPattern.ts` → client-dev 同步
- TASK-039: server-dev 改 `PatternHelper.ts` 单张王规则 → client-dev 同步
- 每次 shared 变更都需要在 `.tasks/blocked.md` 记录同步通知

---

## 目标

**建立单一数据源**: Client 直接引用 `/shared/`，不再维护副本。

**技术方案**: 使用 TypeScript 路径映射（path mapping）让 client 编译器解析 `@shared/*` 到根目录 `/shared/`。

**成功标准**:
1. ✅ `client/assets/scripts/shared/` 目录删除
2. ✅ Client 编译器正确解析 `@shared/*` 导入
3. ✅ 所有 145 个客户端测试通过
4. ✅ Cocos Creator 预览和构建正常
5. ✅ 无 shared 层代码重复

---

## 验收标准

### AC-1: 配置 TypeScript 路径映射

**文件**: `client/tsconfig.json`

**修改**:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../../../shared/*"]
    }
  }
}
```

**验证**:
```bash
cd client
npx tsc --noEmit  # 应无类型错误
```

---

### AC-2: 更新所有 shared 导入语句

**影响文件**（预计 20+ 处）:
- `client/assets/scripts/logic/GameMgr.ts`
- `client/assets/scripts/logic/HandLogic.ts`
- `client/assets/scripts/ui/ctrl/*`
- `client/assets/scripts/__tests__/*`

**修改前**:
```typescript
import { CardEncoding } from '../shared/CardEncoding';
import { PatternHelper } from '../shared/PatternHelper';
```

**修改后**:
```typescript
import { CardEncoding } from '@shared/CardEncoding';
import { PatternHelper } from '@shared/PatternHelper';
```

**验证**:
```bash
# 确认所有旧导入已替换
grep -r "from.*shared/" client/assets/scripts/ --exclude-dir=shared
# 应无输出（除了 shared/ 目录本身）
```

---

### AC-3: 删除 client/assets/scripts/shared/ 目录

**操作**:
```bash
cd client/assets/scripts
rm -rf shared/
```

**注意**: 保留 `.meta` 文件可能导致 Cocos Creator 资源索引异常，建议一并删除相关 `.meta`。

**验证**:
```bash
ls client/assets/scripts/shared/
# 应报错: No such file or directory
```

---

### AC-4: 客户端测试全部通过

**命令**:
```bash
cd client
npm test
```

**预期输出**:
```
Test Suites: 15 passed, 15 total
Tests:       145 passed, 145 total
```

**关键测试**:
- `PatternHelper.test.ts` — 验证 shared 逻辑引用正确
- `GameMgr.test.ts` — 验证业务逻辑无断裂
- `CardEncoding.test.ts` — 验证编码解码功能

---

### AC-5: Cocos Creator 预览正常

**操作**:
1. 打开 Cocos Dashboard
2. 打开项目 → Editor
3. 打开 LaunchScene
4. 点击「预览」按钮

**预期**: 场景正常加载，无 console 报错

**关键检查**:
- 浏览器 Console 无 `Cannot find module '@shared/...'` 错误
- 游戏逻辑正常（手牌显示、出牌交互）

---

### AC-6: 集成冒烟测试通过

**命令**:
```bash
# 前置: 启动服务端
cd server
AI_FILL_DELAY=0 npx ts-node --project tsconfig.json src/index.ts

# 客户端集成测试
cd client
npm test -- --testPathPattern=GameFlow.integration --forceExit
```

**预期输出**:
```
✓ should complete full game flow from join to settlement (9 AC)
```

**验证**: shared 层逻辑在真实网络环境下运行正常

---

### AC-7: 更新 client/CLAUDE.md 文档

**修改**: `client/CLAUDE.md` 第 149-172 行「我的文件边界」章节

**新增说明**:
```markdown
## 我的文件边界

```
client/assets/
├── scripts/
│   ├── logic/       <- GameMgr（唯一入口）+ *Logic（零 CC 依赖）
│   ├── ui/ctrl/     <- CC Component Ctrl（Ctrl 层）
│   └── shared/      <- ❌ 已删除！使用 @shared/* 导入根目录 /shared/
```

**shared 层导入规则**:
- ✅ 使用: `import { CardEncoding } from '@shared/CardEncoding';`
- ❌ 禁止: `import { CardEncoding } from '../shared/CardEncoding';`
- **原因**: shared 层为单一数据源，client 不维护副本
```

---

### AC-8: 移除 shared 同步工作流

**修改**: 更新 `WORKFLOW.md` 第 372-393 行「场景 2：跨端协调」

**删除内容**:
```markdown
### 场景 2：跨端协调（shared/ 变更）
（此工作流已废弃，shared 层现为单一数据源，无需同步）
```

**新增说明**:
```markdown
### 场景 2：shared/ 变更（单一数据源）

**现状**: TASK-051 消除代码重复后，client 直接引用 `/shared/`，无需同步。

**流程**:
1. **Server-Dev**: 需改 `shared/PatternHelper.ts`
2. **Server-Dev**: 直接改动 + 补测试（无需 blocked.md 报告）
3. **Server-Dev**: 更新 `.tasks/done.md`
4. **Client-Dev**: 无需操作（自动生效）

**验证**: 双端测试全绿即可（server 407/407, client 145/145）
```

---

## 接口 / 数据结构

**新增 TypeScript 配置**:
```json
// client/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../../../shared/*"]
    }
  }
}
```

**导入语句变更**:
```typescript
// 旧（删除前）
import { CardEncoding } from './shared/CardEncoding';
import { PatternHelper } from '../shared/PatternHelper';

// 新（迁移后）
import { CardEncoding } from '@shared/CardEncoding';
import { PatternHelper } from '@shared/PatternHelper';
```

---

## 约束

### 技术约束

1. **Cocos Creator 构建系统兼容性**  
   路径映射必须在 Cocos Creator 3.8 的 TypeScript 编译器中正常工作

2. **零运行时依赖**  
   shared 层保持纯 TypeScript，不引入 Node.js 专有模块

3. **测试环境兼容**  
   Jest 必须能正确解析 `@shared/*`（可能需要在 `jest.config.js` 添加 `moduleNameMapper`）

### 风险约束

1. **不可回退风险**  
   删除 `client/assets/scripts/shared/` 后，Cocos Creator 可能无法识别资源引用  
   **缓解**: 先提交前备份，验证无误后再删除

2. **构建失败风险**  
   路径映射在开发环境（`npm test`）可用，但在 Cocos 构建（微信小程序）可能失败  
   **缓解**: AC-5 强制验证 Cocos 预览，AC-6 验证运行时行为

---

## 不在范围内

- ❌ 重构 shared 逻辑（只消除重复，不改代码）
- ❌ 添加新 shared 模块
- ❌ 转换为 npm workspace 或 monorepo
- ❌ 修改 server 端代码（server 已正确引用 `/shared/`）
- ❌ 修改 shared 层文件本身（保持原样）

---

## 测试要求

### 单元测试

**client 测试套件**（145 个测试）:
- `PatternHelper.test.ts` — 验证 shared 逻辑引用正确
- `CardEncoding.test.ts` — 验证 0-107 编码解码
- `GameMgr.test.ts` — 验证业务逻辑无断裂
- `HandLogic.test.ts` — 验证手牌管理逻辑

**关键验证**:
```bash
# 所有测试必须通过
npm test
# Tests: 145 passed, 145 total
```

### 集成测试

**GameFlow.integration.test.ts**（9 个 AC）:
- AC-1~9: join → dealing → landlord → doubling → playing → settlement → rematch

**关键验证**:
```bash
# 前置: 启动 server
cd server && AI_FILL_DELAY=0 npx ts-node src/index.ts

# 集成测试
cd client && npm test -- --testPathPattern=integration --forceExit
# ✓ should complete full game flow (9 AC)
```

### 手动测试

**Cocos Creator 预览**:
1. 打开 LaunchScene → 预览
2. 完成登录 → 进入大厅
3. 快速匹配 → 进入游戏桌
4. 出牌交互 → 结算界面
5. 验证无 console 报错

---

## 影响范围

### 文件变更（预计）

| 文件 | 操作 | 影响 |
|------|------|------|
| `client/tsconfig.json` | 新增 paths 配置 | 1 行 |
| `client/assets/scripts/**/*.ts` | 替换导入语句 | 20+ 处 |
| `client/assets/scripts/shared/` | 删除目录 | -3 文件 |
| `client/CLAUDE.md` | 更新文档 | 10 行 |
| `WORKFLOW.md` | 更新跨端协调流程 | 20 行 |
| `.tasks/blocked.md` | 移除 SYNC-NOTICE 模板 | -5 行 |

### 模块影响

| 模块 | 影响程度 | 说明 |
|------|---------|------|
| `client/logic/` | 高 | 所有业务逻辑文件需改导入 |
| `client/ui/ctrl/` | 高 | 所有 Ctrl 层文件需改导入 |
| `client/__tests__/` | 高 | 所有测试文件需改导入 |
| `shared/` | 无 | 代码不变，只是引用方式改变 |
| `server/` | 无 | 已正确引用 `/shared/`，不受影响 |

---

## 风险与缓解

### 风险 1: Cocos Creator 构建失败

**风险等级**: 🟡 中

**描述**: TypeScript 路径映射在 `npm test` 通过，但 Cocos Creator 构建时可能无法解析 `@shared/*`

**缓解措施**:
1. AC-5 强制验证 Cocos 预览（开发环境）
2. 如构建失败，回退方案：使用相对路径 `../../../shared/`（保留目录结构，但不重复文件）

**回退时间**: 1 小时

---

### 风险 2: Jest 无法解析 @shared/*

**风险等级**: 🟢 低

**描述**: Jest 默认不读取 `tsconfig.json` 的 `paths`，可能导致测试失败

**缓解措施**:
```javascript
// client/jest.config.js 添加
module.exports = {
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
};
```

**验证**: AC-4 测试通过即可

---

### 风险 3: .meta 文件冲突

**风险等级**: 🟢 低

**描述**: 删除 `client/assets/scripts/shared/` 后，残留的 `.meta` 文件可能导致 Cocos 资源索引异常

**缓解措施**:
1. 删除目录时一并删除 `.meta` 文件
2. 在 Cocos Editor 中刷新资源（右键 → 刷新）

---

## 预计工时

| 阶段 | 工作内容 | 预计工时 |
|------|---------|---------|
| **配置** | AC-1: tsconfig.json 路径映射 | 15 分钟 |
| **重构** | AC-2: 替换 20+ 处导入语句 | 1 小时 |
| **清理** | AC-3: 删除 shared/ 目录 | 5 分钟 |
| **测试** | AC-4~6: 单元/集成/手动测试 | 1 小时 |
| **文档** | AC-7~8: 更新 CLAUDE.md + WORKFLOW.md | 30 分钟 |
| **缓冲** | 处理 Cocos 构建兼容性问题 | 1 小时 |
| **总计** | | **4 小时** |

---

## 依赖关系

**前置任务**: 无（独立任务）

**后续任务**: 
- 未来所有 shared 层变更，server-dev 和 client-dev 无需协调同步
- `.tasks/blocked.md` 的 SYNC-NOTICE 工作流可废弃

**阻塞任务**: 无

---

## 成功定义

**完成标准**:
1. ✅ `client/assets/scripts/shared/` 目录不存在
2. ✅ 所有 client 导入使用 `@shared/*` 格式
3. ✅ `npm test` 145/145 通过
4. ✅ Cocos Creator 预览无报错
5. ✅ GameFlow.integration.test.ts 通过
6. ✅ 文档已更新（CLAUDE.md + WORKFLOW.md）

**验收人**: PM Agent

---

**版本**: v1.0  
**创建**: 2026-07-09  
**作者**: PM Agent  
**审批**: 待 client-dev 认领后开始
