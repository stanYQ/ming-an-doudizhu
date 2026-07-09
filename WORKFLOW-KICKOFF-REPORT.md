# 工作流启动报告 — 技术债清理

> 基于项目代码审查结果（Health Score: 82/100）

**启动时间**: 2026-07-09  
**启动人**: PM Agent  
**触发原因**: project-auditor 审查发现 P1 高优先级问题

---

## 📋 已创建任务

### TASK-051: 消除 shared 层代码重复 🔥

**优先级**: P1（高）  
**模块**: client + shared  
**工作量**: 4 小时  
**分配**: 待 client-dev 认领

**问题**:
- `client/assets/scripts/shared/` 完全复制了 `/shared/` 的 3 个文件
- 每次 shared 变更需同步两处 → 违反 DRY 原则
- 历史案例：TASK-007/039 都需要手动同步

**方案**: 
- TypeScript 路径映射 `@shared/*` → `/shared/`
- 删除 `client/assets/scripts/shared/` 目录
- 更新 20+ 处导入语句

**验收标准** (8 AC):
- ✅ tsconfig.json 配置路径映射
- ✅ 所有导入改为 `@shared/*`
- ✅ client/assets/scripts/shared/ 删除
- ✅ npm test 145/145 通过
- ✅ Cocos Creator 预览正常
- ✅ 集成测试通过
- ✅ 文档更新（CLAUDE.md + WORKFLOW.md）

**Spec**: `specs/shared-deduplication.md`

---

### TASK-052: 补全文件头注释 ⚡

**优先级**: P1（高）  
**模块**: server  
**工作量**: 30 分钟  
**分配**: 待 server-dev 认领

**问题**:
- 7 个核心文件缺少文件头注释
- 违反 `server/CLAUDE.md` 红线规范

**缺失文件**:
1. `services/AuthService.ts`
2. `services/MatchService.ts`
3. `logic/CardPatternEngine.ts`
4. `logic/CodeCard.ts`
5. `logic/Deck.ts`
6. `logic/RuleEngine.ts`
7. `db/connection.ts`

**方案**:
- 批量添加标准文件头（每文件 4 行注释）
- 零代码逻辑变更

**验收标准** (9 AC):
- ✅ 7 个文件全部添加文件头
- ✅ grep 检查通过
- ✅ npm test 407/407 通过

**Spec**: `specs/file-header-completion.md`

---

## 🎯 执行顺序建议

### 方案 A：并行执行（推荐）

**理由**: 两个任务独立，无依赖关系

```
┌─────────────────┐         ┌─────────────────┐
│ TASK-052        │         │ TASK-051        │
│ (server-dev)    │         │ (client-dev)    │
│ 30 分钟         │  并行   │ 4 小时          │
└─────────────────┘         └─────────────────┘
```

**优点**: 
- Server-dev 可快速完成 TASK-052（30 分钟）
- Client-dev 专注 TASK-051（4 小时）
- 不阻塞彼此

---

### 方案 B：串行执行

**顺序**: TASK-052 → TASK-051

**理由**: 
- TASK-052 更简单（30 分钟快速胜利）
- 文档规范先完善，再做架构优化

**缺点**: 总时间 4.5 小时（无并行优势）

---

## 📊 任务板状态

### Backlog（新增 2 个）

```markdown
## P1 任务（技术债清理 — 代码审查发现）

- [ ] TASK-051 [client+shared] 消除 shared 层代码重复 → specs/shared-deduplication.md
- [ ] TASK-052 [server] 补全核心文件文件头注释 → specs/file-header-completion.md

## P4.7 任务（动画同步修复）

- [ ] TASK-050s [server] 动画同步修复：dealing_ready ACK + 定时器
- [ ] TASK-050c [client] 动画同步修复：sendDealingReady + code_card_reveal

## P5.2 任务（待 Cocos Editor）

- [ ] TASK-045b [client] SettlementView Prefab 补全
```

---

## 🚀 启动工作流

### Server-Dev 认领 TASK-052

**步骤**:
```bash
cd ~/Desktop/game_project

# 1. 认领任务
# 更新 .tasks/in-progress.md:
# - [ ] TASK-052 [server] 补全核心文件文件头注释 | 认领: server-dev | 开始: 2026-07-09

# 2. 读 spec
cat specs/file-header-completion.md

# 3. 执行（30 分钟）
cd server/src

# 添加 7 个文件头（按 AC-1~7）
# services/AuthService.ts
# services/MatchService.ts
# logic/CardPatternEngine.ts
# logic/CodeCard.ts
# logic/Deck.ts
# logic/RuleEngine.ts
# db/connection.ts

# 4. 验证
npm test  # 407/407 通过

# 5. 提交
git add server/src/services/ server/src/logic/ server/src/db/
git commit -m "docs(server): TASK-052 补全 7 个核心文件文件头

- services/AuthService.ts, MatchService.ts
- logic/CardPatternEngine.ts, CodeCard.ts, Deck.ts, RuleEngine.ts
- db/connection.ts

符合 server/CLAUDE.md 文件头规范要求

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"

# 6. 更新任务板
# .tasks/done.md:
# - [x] TASK-052 [server] 补全核心文件文件头注释 | 完成: server-dev | 测试: ✓ 407/407 | 产物: 7 个文件 +28 行注释
```

---

### Client-Dev 认领 TASK-051

**步骤**:
```bash
cd ~/Desktop/game_project

# 1. 认领任务
# 更新 .tasks/in-progress.md:
# - [ ] TASK-051 [client+shared] 消除 shared 层代码重复 | 认领: client-dev | 开始: 2026-07-09

# 2. 读 spec
cat specs/shared-deduplication.md

# 3. 备份（防止回退）
cp -r client/assets/scripts/shared client/assets/scripts/shared.backup

# 4. 执行（4 小时）
cd client

# AC-1: 配置 tsconfig.json
# 添加 "paths": {"@shared/*": ["../../../shared/*"]}

# AC-2: 替换导入语句（20+ 处）
# 从 './shared/X' → '@shared/X'

# AC-3: 删除 shared/ 目录
rm -rf assets/scripts/shared/

# AC-4: 测试
npm test  # 145/145 通过

# AC-5: Cocos 预览
# 打开 Cocos Editor → LaunchScene → 预览

# AC-6: 集成测试（需服务端启动）
# Terminal 1: cd ../server && AI_FILL_DELAY=0 npx ts-node src/index.ts
# Terminal 2: npm test -- --testPathPattern=integration --forceExit

# AC-7: 更新文档
# client/CLAUDE.md — 更新「我的文件边界」章节

# AC-8: 更新工作流
# WORKFLOW.md — 废弃「场景 2：跨端协调」

# 5. 提交
git add client/tsconfig.json client/assets/scripts/ client/CLAUDE.md ../WORKFLOW.md
git commit -m "refactor(client): TASK-051 消除 shared 层代码重复

- 配置 TypeScript 路径映射 @shared/* → /shared/
- 替换 20+ 处导入语句
- 删除 client/assets/scripts/shared/ 目录
- 更新文档：CLAUDE.md + WORKFLOW.md

修复 P1 技术债，建立 shared 层单一数据源

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"

# 6. 更新任务板
# .tasks/done.md:
# - [x] TASK-051 [client+shared] 消除 shared 层代码重复 | 完成: client-dev | 测试: ✓ 145/145 | 产物: tsconfig.json + 20+ 文件导入修改 - shared/ 目录删除
```

---

## 📈 预期成果

### 代码健康评分提升

| 指标 | 修复前 | 修复后 | 提升 |
|------|--------|--------|------|
| **Overall Health Score** | 82/100 | **88/100** | +6 |
| **P1 High Priority** | 2 | **0** | -2 |
| **代码重复** | 3 文件重复 | **0** | 消除 |
| **文档覆盖率** | 7 文件缺失 | **100%** | +7 |

---

### 工作流优化

**TASK-051 完成后**:
- ✅ 消除 `.tasks/blocked.md` 的 SYNC-NOTICE 工作流
- ✅ Server-dev 改 shared 无需通知 Client-dev
- ✅ 双端自动同步，零协调开销

**TASK-052 完成后**:
- ✅ 所有 server 文件符合文档规范
- ✅ 新人 onboarding 更快（文件职责清晰）

---

## 🎯 后续计划

### 本月执行（P2 中优先级）

1. **定义类型接口** — 消除 15+ 处 `any` 类型（3-5 小时）
2. **统一日志接口** — 替换 8 处 `console.*` 为 `Logger.*`（30 分钟）
3. **配置覆盖率报告** — Jest coverage reporter（30 分钟）

### 下季度优化（P3 低优先级）

4. 补充 public 方法 JSDoc
5. 引入 ESLint `@typescript-eslint/no-explicit-any`
6. 添加 pre-commit hook 强制文件头检查

---

## 📞 联系与协调

**PM Agent**: 负责验收和任务板维护  
**Server-Dev**: 认领 TASK-052（30 分钟）  
**Client-Dev**: 认领 TASK-051（4 小时）

**协调需求**: 
- TASK-051 需 Cocos Editor 验证，确保 client-dev 有 Cocos 环境
- TASK-051 AC-6 需服务端启动配合集成测试

---

**报告生成**: 2026-07-09  
**下次检查**: TASK-051/052 完成后（预计 2026-07-10）  
**维护**: PM Agent
