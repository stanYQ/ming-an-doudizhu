# 接下来的工作规划 — Client-Dev & Server-Dev

> 基于 TASK-050s/052 完成后的任务状态

**更新时间**: 2026-07-09  
**规划人**: PM Agent  
**当前状态**: P5.2 收尾阶段 + P1 技术债清理

---

## ✅ 已完成任务（今天）

### Server-Dev

1. ✅ **TASK-052** — 补全核心文件文件头注释（7 个文件）
   - 测试: 407/407 通过
   - 产物: AuthService.ts, MatchService.ts, CardPatternEngine.ts, CodeCard.ts, Deck.ts, RuleEngine.ts, connection.ts

2. ✅ **TASK-050s** — 动画同步修复（服务端）
   - 测试: 412/412 通过（+5 新测试）
   - 产物: CardRoom.ts（dealing_ready handler + 3个定时器）
   - 协议: PROTOCOL.md v2.1（dealing_ready + code_card_reveal）
   - 技术债: SKIP_DEALING_READY=1 环境变量（测试兼容）

---

## 📋 剩余任务（3 个）

| 任务 | 优先级 | 工时 | 分配 | 状态 |
|------|--------|------|------|------|
| **TASK-050c** | P4.7 | 1-2h | client-dev | ⏳ 待认领 |
| **TASK-051B** | P1 | 2.5h | client-dev | ⏳ 待规划（需生成 spec） |
| **TASK-045b** | P5.2 | 0.5h | client-dev | ⏳ 待认领 |

**总工时**: 4-5 小时（全部由 client-dev 负责）

---

## 🎯 Server-Dev 接下来的工作

### 状态：✅ P0-P5.2 阶段全部完成

**已完成**:
- ✅ P0 基础层（shared + infra）
- ✅ P1 服务端核心（CardRoom + 引擎）
- ✅ P2-P4 优化与集成（AI + 匹配 + 结算 + 测试）
- ✅ P4.7 动画同步修复（TASK-050s）
- ✅ P1 技术债（TASK-052 文档规范）

**测试覆盖**: 412/412 tests ✅

---

### 选项 A：等待 Client-Dev 完成（推荐）

**理由**: 
- Server-Dev 当前阶段任务全部完成
- 剩余 3 个任务全部属于 client 侧
- 可利用空闲时间做以下工作：

#### 1. 代码审查与优化（可选）

**工作内容**:
- 运行 `/audit`（project-auditor）验证 P2 问题是否修复
- 优化 P2 中优先级问题：
  - 消除 `any` 类型（15+ 处）
  - 统一日志接口（8 处 console.*）
  - 环境变量集中管理

**工时**: 3-5 小时

---

#### 2. 性能优化与压测（可选）

**工作内容**:
- 运行 10 万局模拟（验证 Gate 稳定性）
- 分析 BattleReport 日志（识别异常局）
- 优化 AI 出牌性能（如有瓶颈）

**工时**: 2-3 小时

---

#### 3. 协助 Client-Dev 测试（推荐）

**工作内容**:
- TASK-050c 完成后：启动服务端配合集成测试
  ```bash
  cd ~/Desktop/game_project/server
  AI_FILL_DELAY=0 npx ts-node src/index.ts
  ```
- TASK-051B 完成后：验证 shared 同步脚本
- 人工联调：完整游戏流程验证（dealing_ready + code_card_reveal 动画）

**工时**: 1-2 小时

---

#### 4. 规划 P5.3 路线图（推荐）

**工作内容**:
- 协助 PM 使用 `/pm-roadmap` 规划 P5.3
- 评估服务端新功能的技术方案：
  - 大厅功能增强（排行榜实时刷新 / 好友列表）
  - 音效资源管理（CDN / 本地缓存）
  - 断网重连优化（AC-12 延缓项）

**工时**: 1 小时

---

### 选项 B：提前开始 P5.3 服务端任务（激进）

**前提**: PM 已完成 P5.3 规划并生成 spec

**可能任务**（预测）:
- GET /api/leaderboard 实时刷新（WebSocket / Server-Sent Events）
- GET /api/friends 好友列表（需设计数据模型）
- 断网重连增强（心跳检测 + 自动重连）

**风险**: P5.3 spec 尚未生成，提前开发可能返工

---

### ⭐ PM 推荐：选项 A-3 + A-4

**今天（剩余时间）**:
- 等待 Client-Dev 完成 TASK-050c
- 启动服务端配合集成测试（1 小时）

**明天**:
- 协助 PM 规划 P5.3 路线图（1 小时）
- 代码审查与优化（可选，3-5 小时）

---

## 🎮 Client-Dev 接下来的工作

### 状态：3 个任务待完成

**优先级排序**:
1. 🔥 **TASK-050c** (1-2h) — P4.7 动画同步修复（配合 TASK-050s）
2. 🔴 **TASK-051B** (2.5h) — P1 技术债清理（预构建脚本）
3. 🟢 **TASK-045b** (0.5h) — P5.2 UI 收尾（Cocos Editor）

**总工时**: 4-5 小时

---

### 任务 1: TASK-050c（优先级最高）

**为什么优先**: 
- 配合 TASK-050s 已完成，可立即联调验证
- 解决动画截断问题，提升用户体验
- 依赖 TASK-050s 的协议变更（dealing_ready + code_card_reveal）

**工作内容**:
1. NetManager 新增 `sendDealingReady()` 方法
2. 发牌动画结束回调中调用
3. 监听 `code_card_reveal` 触发揭晓动画（≤4s）
4. `doubling_result` 展示动画对齐（≤2s）

**验收标准** (6 AC):
- ✅ sendDealingReady() 实现（AC-C1~C3）
- ✅ code_card_reveal 监听 + 动画（AC-C4~C5）
- ✅ doubling_result 动画对齐（AC-C6）

**测试验证**:
```bash
# 1. 启动服务端（Server-Dev 配合）
cd ~/Desktop/game_project/server
AI_FILL_DELAY=0 npx ts-node src/index.ts

# 2. 客户端单元测试
cd ~/Desktop/game_project/client
npm test

# 3. 集成冒烟测试
npm test -- --testPathPattern=GameFlow.integration --forceExit

# 4. Cocos 预览人工验证
# 打开 Cocos Editor → GameScene → 预览
# 验证：发牌动画完整播放 / 暗号牌揭晓动画 4s / 加倍结果展示 2s
```

**Spec**: `specs/animation-sync.md`（已有，TASK-050c 部分）

**工时**: 1-2 小时

---

### 任务 2: TASK-051B（技术债清理）

**为什么第二优先**: 
- P1 高优先级技术债
- TASK-051 原方案已技术阻塞，改为预构建脚本方案
- 消除 shared 层手动同步开销（长期收益）

**工作内容**:
1. 创建同步脚本 `scripts/sync-shared.js`
2. 添加 npm scripts（`sync:shared`, `predev:client`, `prebuild:client`）
3. 配置 `.gitignore`（`client/assets/scripts/shared/*.ts`）
4. 测试验证：`npm run sync:shared` 成功复制 3 个文件

**验收标准** (8 AC):
- ✅ sync-shared.js 脚本实现
- ✅ package.json 添加 npm scripts
- ✅ .gitignore 配置
- ✅ 执行同步脚本成功
- ✅ client 测试 145/145 通过
- ✅ Cocos Creator 预览正常
- ✅ server 改 shared → 运行同步脚本 → client 自动更新
- ✅ 更新 WORKFLOW.md

**Spec**: 需生成 `specs/shared-sync-script.md`（PM 待生成）

**工时**: 2.5 小时

**前置条件**: PM 生成 spec

---

### 任务 3: TASK-045b（UI 收尾）

**为什么最后**: 
- 优先级最低（P5.2 收尾，非阻塞）
- 纯 Cocos Editor 操作，无代码改动
- 可作为"快速胜利"任务调节节奏

**工作内容**:
- 在 Cocos Editor 搭建 SettlementView Prefab 节点树
- PlayerResultCard ×5
- 身份揭晓动画
- 倍率明细节点树

**验收标准**:
- ✅ Prefab 节点树搭建完成
- ✅ Cocos 预览展示正常
- ✅ 身份揭晓动画播放正常

**Spec**: `specs/ui-flow-05-settlement-rematch.md`（已有，TASK-045b 部分）

**工时**: 0.5 小时

---

## 📅 执行时间表

### Day 1（今天，剩余时间）

**Client-Dev**:
- ⏳ TASK-050c (1-2h) — 动画同步修复
- 联调测试（需 Server-Dev 配合启动服务端）

**Server-Dev**:
- 等待 Client-Dev 完成 TASK-050c
- 启动服务端配合集成测试

---

### Day 2（明天）

**Client-Dev**:
- ⏳ TASK-051B (2.5h) — 预构建脚本（需等 PM 生成 spec）
- ⏳ TASK-045b (0.5h) — SettlementView Prefab 补全

**Server-Dev**:
- 协助 PM 规划 P5.3 路线图（1h）
- 代码审查与优化（可选，3-5h）

**PM**:
- 生成 TASK-051B spec（30min）
- 规划 P5.3 路线图（使用 `/pm-roadmap`）

---

### Day 3（后天）

**PM**:
- 验收 3 个任务（TASK-050c/051B/045b）
- 更新 `.tasks/done.md`
- 发布 P5.2 完成报告

**All**:
- 🎉 **P5.2 + P4.7 全部完成**
- 项目完成度：**100%**
- 进入 P5.3 规划与开发阶段

---

## 🎯 里程碑目标

### 完成后成果（Day 3）

| 指标 | 当前 | 完成后 |
|------|------|--------|
| **项目完成度** | 94.8% | **100%** |
| **Server 测试** | 412/412 | **412/412** ✅ |
| **Client 测试** | 145/145 | **145/145** ✅ |
| **Health Score** | 82/100 | **90/100** |
| **技术债** | 2 个 | **0 个** |
| **动画体验** | 有截断 | **流畅** |

---

## 📞 协调需求

### TASK-050c 联调

**需求**: Server-Dev 启动服务端配合测试  
**时间**: Client-Dev 完成 TASK-050c 后（预计今天下午）  
**命令**:
```bash
cd ~/Desktop/game_project/server
AI_FILL_DELAY=0 npx ts-node src/index.ts
```

### TASK-051B 前置

**需求**: PM 生成 spec `specs/shared-sync-script.md`  
**时间**: 今天或明天上午  
**阻塞**: Client-Dev 等待 spec 才能开始 TASK-051B

---

## ✅ PM 待办事项

1. **立即执行**: 生成 TASK-051B spec（30 分钟）
2. **今天或明天**: 更新 `.tasks/blocked.md`（标记 TASK-051 技术决策完成）
3. **明天**: 规划 P5.3 路线图（使用 `/pm-roadmap`）
4. **Day 3**: 验收 3 个任务 + 发布完成报告

---

## 📊 资源分配总结

| Agent | 今天剩余 | 明天 | Day 3 | 总计 |
|-------|---------|------|-------|------|
| **Client-Dev** | 1-2h | 3h | 验收 | 4-5h |
| **Server-Dev** | 1h | 1-5h | 验收 | 2-6h |
| **PM** | 30min | 1h | 1h | 2.5h |

---

**报告生成**: 2026-07-09  
**下次更新**: Day 3（所有任务完成后）  
**维护**: PM Agent
