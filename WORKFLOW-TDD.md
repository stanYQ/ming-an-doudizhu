# TDD-Guide Skill 集成指南

> 补充到 WORKFLOW.md 的 Server-Dev / Client-Dev 工作流

---

## tdd-guide Skill 概览

**来源**: alirezarezvani/claude-skills  
**安装路径**: `~/.agents/skills/tdd-guide/`  
**核心能力**:
1. ✅ **从需求生成测试** — spec AC → 失败测试骨架（happy path + error + edge cases）
2. ✅ **识别边界遗漏** — 覆盖率报告 → P0/P1/P2 优先级缺口
3. ✅ **引导 TDD 循环** — RED（失败）→ GREEN（通过）→ REFACTOR（简化）

---

## 一、Server-Dev Agent 使用方式

### 标准 TDD 流程（含 tdd-guide）

```bash
# 前置：认领任务，更新 .tasks/in-progress.md
cd ~/Desktop/game_project/server

# Step 1: 读 spec，理解 AC
cat ../specs/animation-sync.md

# Step 2: 调用 tdd-guide 生成测试骨架（RED）
# 方式 1：通过 Skill 工具（推荐，Agent 内部调用）
Skill("tdd-guide", args="Generate tests from ../specs/animation-sync.md AC-S1~S8, framework=Jest, output=src/__tests__/CardRoom.050s.test.ts")

# 方式 2：直接运行脚本（手动调用）
cd ~/.agents/skills/tdd-guide
python scripts/test_generator.py \
  --spec ~/Desktop/game_project/specs/animation-sync.md \
  --framework jest \
  --output ~/Desktop/game_project/server/src/__tests__/CardRoom.050s.test.ts

# Step 3: 验证测试失败（RED）
cd ~/Desktop/game_project/server
npx jest --no-coverage CardRoom.050s.test.ts
# 预期：所有测试 FAIL（功能尚未实现）

# Step 4: 实现最少代码（GREEN）
# 编辑 src/rooms/CardRoom.ts，逐条实现 AC-S1~S8
npx jest --no-coverage CardRoom.050s.test.ts
# 预期：逐个 AC 从 FAIL → PASS

# Step 5: 覆盖率分析（检查遗漏边界）
npx jest --coverage
cd ~/.agents/skills/tdd-guide
python scripts/coverage_analyzer.py \
  --report ~/Desktop/game_project/server/coverage/lcov.info \
  --threshold 100 \
  --priority P0

# 输出示例：
# P0 — Critical gaps:
#   CardRoom.ts:142-158   handleDealingReady() — duplicate sessionId guard   0% covered
#   CardRoom.ts:201-210   onDispose() — timer cleanup   0% covered

# Step 6: 补测试覆盖 P0 缺口
# 根据 coverage_analyzer 输出，补充边界测试

# Step 7: Karpathy 简化检查
/karpathy  # 检查过度抽象、未用代码

# Step 8: 验证
npx jest --no-coverage  # 全套测试通过
/verify  # 对照 spec AC 逐条验证

# Step 9: 完成，更新任务板
# 更新 .tasks/done.md，从 in-progress.md 移除
```

---

## 二、Client-Dev Agent 使用方式

### 标准 TDD 流程（含 tdd-guide）

```bash
# 前置：认领任务，更新 .tasks/in-progress.md
cd ~/Desktop/game_project/client

# Step 1: 读 spec，理解 AC
cat ../specs/animation-sync.md  # 关注 TASK-050c 部分

# Step 2: 调用 tdd-guide 生成测试骨架（RED）
Skill("tdd-guide", args="Generate tests from ../specs/animation-sync.md AC-C1~C6, framework=Jest, layer=logic, output=assets/scripts/__tests__/AnimationSync.test.ts")

# 或手动：
cd ~/.agents/skills/tdd-guide
python scripts/test_generator.py \
  --spec ~/Desktop/game_project/specs/animation-sync.md \
  --framework jest \
  --output ~/Desktop/game_project/client/assets/scripts/__tests__/AnimationSync.test.ts

# Step 3: 验证测试失败（RED）
cd ~/Desktop/game_project/client
npx jest --no-coverage AnimationSync.test.ts
# 预期：所有测试 FAIL

# Step 4: 实现代码（GREEN）
# 编辑 logic/GameMgr.ts, net/NetManager.ts
npx jest --no-coverage AnimationSync.test.ts

# Step 5: 覆盖率分析
npx jest --coverage
cd ~/.agents/skills/tdd-guide
python scripts/coverage_analyzer.py \
  --report ~/Desktop/game_project/client/coverage/lcov.info \
  --threshold 80 \
  --priority P0

# Step 6: 架构红线检查
cd ~/Desktop/game_project/client
grep -r "from 'cc'" assets/scripts/logic/  # 必须无输出

# Step 7: Karpathy 简化检查
/karpathy

# Step 8: 集成冒烟（可选）
npm test -- --testPathPattern=GameFlow.integration --forceExit

# Step 9: 完成，更新任务板
```

---

## 三、tdd-guide 核心工具详解

### 3.1 test_generator.py — 生成测试骨架

**作用**: 从 spec 的验收标准（AC）自动生成测试用例骨架，覆盖 happy path、error cases、edge cases。

**参数**:
```bash
python scripts/test_generator.py \
  --spec <spec文件路径> \        # 必填：spec 文件
  --framework jest|pytest|junit \  # 必填：测试框架
  --output <输出文件路径> \       # 可选：默认输出到 stdout
  --scope unit|integration \      # 可选：测试范围，默认 unit
  --edge-cases                    # 可选：额外生成边界用例
```

**示例输入**（spec/animation-sync.md AC-S1）:
```
AC-S1: After broadcasting `your_hand`, CardRoom waits for 5 `dealing_ready` messages before advancing to `phase='landlord_select'`
```

**生成输出**（Jest TypeScript）:
```typescript
describe("CardRoom - AC-S1: dealing_ready ACK", () => {
  it("should advance to landlord_select after 5 dealing_ready messages", async () => {
    // Arrange
    const room = await createTestRoom(5);
    await room.startDealing();
    
    // Act
    for (let i = 0; i < 5; i++) {
      room.send(clients[i], "dealing_ready");
    }
    
    // Assert
    expect(room.state.phase).toBe("landlord_select");
  });

  it("should NOT advance with only 4 dealing_ready messages", async () => {
    const room = await createTestRoom(5);
    await room.startDealing();
    
    for (let i = 0; i < 4; i++) {
      room.send(clients[i], "dealing_ready");
    }
    
    expect(room.state.phase).toBe("dealing");  // 仍停留在 dealing
  });
});
```

---

### 3.2 coverage_analyzer.py — 覆盖率缺口分析

**作用**: 解析测试覆盖率报告（LCOV/JSON/XML），按优先级（P0/P1/P2）输出未覆盖的代码路径。

**参数**:
```bash
python scripts/coverage_analyzer.py \
  --report <lcov.info 路径> \     # 必填：覆盖率报告文件
  --threshold 80 \                # 可选：目标阈值，默认 80%
  --priority P0|P1|P2 \           # 可选：只显示特定优先级，默认全部
  --format text|json              # 可选：输出格式，默认 text
```

**优先级定义**:
- **P0（Critical）**: 错误路径、异常处理、安全逻辑（auth/payment）
- **P1（High）**: 核心业务分支、状态转换
- **P2（Low）**: 工具函数、格式化、辅助方法

**示例输出**:
```
Coverage Report — Overall: 63% (threshold: 80%)

P0 — Critical gaps (uncovered error paths):
  CardRoom.ts:142-158   handleDealingReady() — duplicate sessionId guard   0% covered
  CardRoom.ts:201-210   onDispose() — timer cleanup                       0% covered

P1 — High-value gaps (core logic branches):
  CardRoom.ts:77        startDealing() — else branch (no players)         0% covered

P2 — Low-risk gaps (utility functions):
  CardRoom.ts:334       formatPlayerName() — emoji handling               0% covered

Recommended: Generate tests for P0 items first to reach 80% threshold.
```

---

### 3.3 tdd_workflow.py — RED-GREEN-REFACTOR 引导

**作用**: 验证当前处于 TDD 的哪个阶段，引导下一步动作。

**参数**:
```bash
python scripts/tdd_workflow.py \
  --phase red|green|refactor \    # 必填：当前阶段
  --test <测试文件路径>            # 必填：要验证的测试
```

**RED 阶段验证**:
```bash
python scripts/tdd_workflow.py \
  --phase red \
  --test server/src/__tests__/CardRoom.050s.test.ts

# 预期输出：
# ✓ RED phase valid: All tests FAIL (0 passed, 8 failed)
# Next: Implement minimal code to make the first test pass
```

**GREEN 阶段验证**:
```bash
python scripts/tdd_workflow.py \
  --phase green \
  --test server/src/__tests__/CardRoom.050s.test.ts

# 预期输出：
# ✓ GREEN phase valid: All tests PASS (8 passed, 0 failed)
# Next: Refactor code while keeping tests green
```

**REFACTOR 阶段验证**:
```bash
python scripts/tdd_workflow.py \
  --phase refactor \
  --test server/src/__tests__/CardRoom.050s.test.ts

# 持续运行测试，确保重构后仍全绿
# ✓ REFACTOR safe: Tests remain green after code changes
```

---

## 四、与现有 Skills 的关系

| Skill | 职责 | 与 tdd-guide 的配合 |
|-------|------|-------------------|
| **tdd-guide** | 生成测试、覆盖分析、TDD 循环 | 核心测试工作流 |
| **/karpathy** | 代码简化检查（Karpathy Rules #1-4）| GREEN 后，REFACTOR 前调用 |
| **/simplify** | 识别过度抽象、未用代码 | REFACTOR 阶段辅助 |
| **/verify** | 对照 spec AC 逐条验证 | 完成后最终验证 |
| **great_cto/qa-engineer** | 生成更多测试用例 + QA 报告 | 补充测试场景 |

**推荐顺序**:
```
1. tdd-guide test_generator     → 生成初始测试骨架（RED）
2. 实现代码                      → 让测试通过（GREEN）
3. tdd-guide coverage_analyzer  → 检查遗漏边界
4. 补充边界测试                  → 覆盖 P0 缺口
5. /karpathy                    → 简化检查
6. /simplify                    → 移除冗余（可选）
7. /verify                      → 最终验证
```

---

## 五、典型场景示例

### 场景：TASK-050s 动画同步修复（完整 TDD 流程）

```bash
# === Phase 0: 准备 ===
cd ~/Desktop/game_project/server
git checkout -b feat/animation-sync
# 更新 .tasks/in-progress.md

# === Phase 1: RED（生成失败测试）===
# 调用 tdd-guide 生成测试
Skill("tdd-guide", args="
Generate tests from ../specs/animation-sync.md AC-S1 to AC-S8
Framework: Jest + TypeScript
Module: server/src/rooms/CardRoom.ts
Edge cases: duplicate dealing_ready, timer cleanup, timeout scenarios
Output: src/__tests__/CardRoom.050s.test.ts
")

# 验证测试失败
npx jest --no-coverage CardRoom.050s.test.ts
# 输出: Tests: 0 passed, 8 failed

# === Phase 2: GREEN（实现代码）===
# 编辑 src/rooms/CardRoom.ts，逐条实现 AC-S1~S8
# ...实现 handleDealingReady(), startDealingReadyTimeout(), 等

# 每实现一条 AC，跑一次测试
npx jest --no-coverage -t "AC-S1"
npx jest --no-coverage -t "AC-S2"
# ...
npx jest --no-coverage CardRoom.050s.test.ts
# 输出: Tests: 8 passed, 0 failed

# === Phase 3: 覆盖率分析（找遗漏）===
npx jest --coverage
cd ~/.agents/skills/tdd-guide
python scripts/coverage_analyzer.py \
  --report ~/Desktop/game_project/server/coverage/lcov.info \
  --threshold 100 \
  --priority P0

# 输出:
# P0 — Critical gaps:
#   CardRoom.ts:142   handleDealingReady() — duplicate check   0%
#   CardRoom.ts:208   onDispose() — timer cleanup              0%

# 补测试：
# test("should not double-count duplicate dealing_ready from same session")
# test("should clear all timers on room dispose")

npx jest --no-coverage CardRoom.050s.test.ts
# 输出: Tests: 10 passed, 0 failed（新增 2 条边界测试）

# === Phase 4: REFACTOR（简化代码）===
/karpathy  # 检查过度抽象
# 输出: ✓ 无过度抽象，代码简洁

/simplify  # 检查未用代码
# 输出: ✓ 无未用变量/函数

# === Phase 5: 验证 ===
/verify  # 对照 spec AC 逐条验证
# 输出:
# ✓ AC-S1: handleDealingReady 5 ACK → landlord_select
# ✓ AC-S2: 10s 超时静默推进
# ✓ AC-S3: 超时后不累计 ACK
# ...
# ✓ AC-S8: PROTOCOL.md 已更新

# 全套测试
npx jest --no-coverage
# 输出: Tests: 407 passed, 0 failed

# === Phase 6: 完成 ===
git add .
git commit -m "feat(server): TASK-050s 动画同步修复 AC-S1~S8

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"

# 更新 .tasks/done.md
```

---

## 六、快速参考

### Server-Dev 快查

```bash
# 生成测试
Skill("tdd-guide", args="Generate tests from specs/<feature>.md, framework=Jest")

# 覆盖分析
npx jest --coverage
cd ~/.agents/skills/tdd-guide && python scripts/coverage_analyzer.py --report ~/Desktop/game_project/server/coverage/lcov.info --threshold 100 --priority P0

# TDD 循环验证
cd ~/.agents/skills/tdd-guide && python scripts/tdd_workflow.py --phase red --test ~/Desktop/game_project/server/src/__tests__/<test>.test.ts

# Karpathy 检查
/karpathy
/simplify
/verify
```

### Client-Dev 快查

```bash
# 生成测试
Skill("tdd-guide", args="Generate tests from specs/<feature>.md, framework=Jest, layer=logic")

# 覆盖分析
npx jest --coverage
cd ~/.agents/skills/tdd-guide && python scripts/coverage_analyzer.py --report ~/Desktop/game_project/client/coverage/lcov.info --threshold 80 --priority P0

# 架构红线
grep -r "from 'cc'" assets/scripts/logic/  # 必须无输出

# Karpathy 检查
/karpathy
/verify
```

---

## 七、注意事项

### ✅ DO

- **先生成测试再写实现** — TDD 的核心，避免事后补测试的低覆盖
- **优先覆盖 P0 缺口** — 错误路径、异常处理必须 100% 覆盖
- **每实现一条 AC 跑一次测试** — 快速反馈，避免大批量失败
- **用 coverage_analyzer 找遗漏** — 人工难发现的边界，工具能识别

### ❌ DON'T

- **跳过 RED 阶段** — 没有失败测试就开始写实现 = 不是 TDD
- **忽略 P0 缺口** — P0 是关键错误路径，必须补测试
- **过早优化** — GREEN 后立即 REFACTOR，不要在 RED 阶段优化
- **覆盖率作假** — 写测试但不 assert = 假覆盖率，用 mutation testing 识别

---

## 八、集成到 WORKFLOW.md

将本文档内容合并到主 `WORKFLOW.md` 的以下位置：

1. **第二章「三 Agent Skills 配置」** → Server-Dev / Client-Dev 的「TDD 核心流程」小节，替换为本文档「一、二」章节内容
2. **第五章「典型场景剧本」** → 新增「场景 5：完整 TDD 流程」，引用本文档「五、典型场景示例」
3. **第六章「Skills 快速索引」** → 新增「tdd-guide 快查」小节，引用本文档「六、快速参考」

---

**版本**: v1.0  
**更新**: 2026-07-09  
**维护**: PM Agent
