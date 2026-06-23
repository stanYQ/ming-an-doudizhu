# Spec: {功能名称}

**任务 ID**: TASK-{id}  
**目标模块**: {shared | client | server | infra}  
**优先级**: {P0 | P1 | P2}  
**状态**: {draft | ready | in-dev | done}

---

## 执行流程

> 认领任务后按 Step 顺序执行，不得跳步。

```
Step 1  认领
        → 更新 .tasks/in-progress.md

Step 2  生成失败测试（RED）
        → /tdd-gen
        → 对照本 spec AC 生成测试用例，确认全部失败后再写实现

Step 3  实现
        → 按 AC 顺序逐条实现，每完成一条跑一次测试

Step 4  覆盖率检查
        → /tdd-coverage
        → 确认所有 AC 有对应测试覆盖，无遗漏

Step 5  Diff 审查
        → /karpathy
        → 确认无过度实现、无未被要求的改动

Step 6  代码质量（可选）
        → /simplify
        → 如有冗余逻辑主动精简

Step 7  验证（{模块专属，见下}）
        [client] → /verify  接真实 server 跑 GameFlow.integration 冒烟
        [server] → npm test 全套（含 integration），确认当前测试数全绿零警告
        [shared] → npm test，两端均无回归

Step 8  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除
        → 格式：- [x] TASK-{id} [{模块}] {描述} | 完成: {dev} | 测试: ✓ {N/N} | 产物: {文件列表}
```

---

## 背景

{为什么需要这个功能，来自 GDD/TDD 哪一章}

---

## 验收标准

- AC-1: {具体可测试的标准}
- AC-2: {具体可测试的标准}
- AC-3: {具体可测试的标准}

---

## 接口 / 数据结构

```typescript
// 输入输出定义，或函数签名
```

---

## 约束

- {不能做什么}
- {性能要求}
- {与其他模块的边界}

---

## 不在范围内

- {明确排除的内容，防止 scope creep}

---

## 测试要求

- 单元测试覆盖所有 AC
- 边界情况: {列举}
- 错误路径: {列举}
