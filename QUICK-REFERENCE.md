# 明暗斗地主 — 快捷指令手册

> 主 agent 调度手册。所有子 agent 和 skill 的入口、用途、典型用法。

---

## 一、项目启动 & 规划

| 命令 | 用途 | 典型用法 |
|------|------|---------|
| `/start` | 新项目初始化，自动检测技术栈，生成 PROJECT.md | 在游戏项目根目录运行 |
| `/spec` | Spec 驱动开发：需求访谈 → requirements + design + tasks | `/spec 暗号牌选择功能` |
| `/prd` | 产品需求文档，8节结构化输出 | `/prd 断线重连功能` |
| `/rfc` | 跨模块技术决策，自动生成 ADR | `/rfc Colyseus vs 自研 WebSocket` |

---

## 二、日常开发循环

| 命令 | 用途 | 典型用法 |
|------|------|---------|
| `/tdd-gen` | **写代码前**生成测试（RED 阶段） | `/tdd-gen CardPatternEngine 炸弹识别4-8张` |
| `/tdd-coverage` | **写完后**审查覆盖漏洞，输出 P0/P1/P2 | `/tdd-coverage server/src/logic/RuleEngine.ts` |
| `/karpathy` | 审查计划/diff 是否违反四条约束规则 | `/karpathy 我打算给牌型引擎加一层缓存` |
| `/review` | 代码 review，找 bug 和简化机会 | git diff 后运行 `/review` |

### 标准功能开发流程

```
/tdd-gen <功能描述>
  ↓ 得到失败测试（RED）
senior-dev agent 实现代码
  ↓ 测试通过（GREEN）
/tdd-coverage <源文件路径>
  ↓ P0/P1 漏洞修补
/review
  ↓ bug 和简化确认
qa-engineer agent
  ↓ QA 报告
security-officer agent
  ↓ gate:ship 签字
devops agent 部署
```

---

## 三、子 Agent 调度

> 调用方式：`使用 [agent名] agent 来...`

### 核心开发 Agent

| Agent | 调用名 | 职责 | 触发时机 |
|-------|-------|------|---------|
| architect | `great_cto-architect` | 架构决策、ADR、成本估算、Well-Architected 审查 | 新功能设计、技术选型 |
| senior-dev | `great_cto-senior-dev` | TDD 编码、认领任务、实现逻辑 | 架构确认后开始编码 |
| qa-engineer | `great_cto-qa-engineer` | QA 报告、测试分析，不允许跳过 | senior-dev 完成后 |
| security-officer | `great_cto-security-officer` | OWASP 安全审计，控制 gate:ship | QA 通过后 |
| devops | `great_cto-devops` | Docker/CI/CD 部署 | gate:ship 通过后 |

### 专项 Agent

| Agent | 调用名 | 职责 | 触发时机 |
|-------|-------|------|---------|
| game-reviewer | `great_cto-game-reviewer` | IAP/年龄分级/COPPA/ESRB，输出威胁模型 | 上线前必跑、IAP 相关功能 |
| project-auditor | `great_cto-project-auditor` | 代码健康度审查，检测架构债务 | 每月定期、迭代结束 |
| performance-engineer | `great_cto-performance-engineer` | SLO/SLA、load test、火焰图、容量规划 | P3 压测阶段 |
| l3-support | `great_cto-l3-support` | 生产问题 P0 响应，日志分析，写 postmortem | 线上报警触发 |
| coordinator | `great_cto-coordinator` | 并行调度 3+ 独立工作流 | 多模块同时开工 |
| pm | `great_cto-pm` | 任务分解、Gantt 规划、并行分析 | architect 出 ARCH 文档后 |
| continuous-learner | `great_cto-continuous-learner` | 提取 session 模式，写入 lessons.md | session 结束时 |

---

## 四、项目状态 & 运维

| 命令 | 用途 |
|------|------|
| `/inbox` | 查看待决策的 gate、阻塞项、待办决策 |
| `/doctor` | great_cto 健康检查，pipeline 状态，缺失产物 |
| `/audit` | 代码库全量审计，生成/更新 PROJECT.md |
| `/cost` | LLM 成本、功能 ROI、部署费用、WoW 趋势 |
| `/digest` | 交付进度 + DORA 指标摘要 |
| `/discover` | 完整 Discovery 周期（不确定做什么时用） |

---

## 五、PM 工作流

| 命令 | 用途 | 典型用法 |
|------|------|---------|
| `/pm-story` | 用户故事 + Gherkin AC | `/pm-story 玩家断线后重连恢复手牌` |
| `/pm-prd` | 问题驱动 PRD，Phase 分步 | `/pm-prd 暗号牌系统` |
| `/pm-problem` | 框定问题陈述，含范围边界 | `/pm-problem 玩家在结算时不知道自己的阵营` |
| `/pm-epic` | Lawrence 拆解法拆 Epic | `/pm-epic 用户账号系统 — 注册/登录/SSO/重置密码` |
| `/pm-prioritize` | 上下文感知优先级框架 | `/pm-prioritize Q1 backlog，硬截止日期` |
| `/pm-discover` | 结构化 Discovery 流程 | `/pm-discover 降低新用户首局流失率` |
| `/pm-plan-roadmap` | 路线图规划，带权衡分析 | `/pm-plan-roadmap P0-P4 里程碑排期` |

---

## 六、代码质量约束

### Karpathy 四条规则（所有 agent 强制执行）

| 规则 | 内容 | 违反时用 |
|------|------|---------|
| Think Before Coding | 有歧义先列出来，不要静默选择 | `/karpathy` 审查 |
| Simplicity First | 200行能写50行的必须重写 | `/karpathy` + `/simplify` |
| Surgical Changes | 只动任务要求的代码 | `/karpathy` 审查 diff |
| Goal-Driven | 先定可验证目标再动手 | `/tdd-gen` 强制先写测试 |

---

## 七、游戏项目 P0 测试检查点

`/tdd-coverage` 自动检查以下项，任何 P0 未覆盖即阻塞发布：

| 检查点 | 位置 | 优先级 |
|--------|------|--------|
| `ownsAll()` 手牌所有权校验 | `RuleEngine.ts` | P0 |
| 炸弹张数边界 4/5/6/7/8 | `CardPatternEngine.ts` | P0 |
| 暗号牌合法性 rank 0-7, suit 0-3 | `CodeCard.ts` | P0 |
| 回合顺序强制执行 | `CardRoom.ts` | P0 |
| Schema 不含手牌数据 | `GameState.ts` | P0 |
| 断线重连状态一致性 | `CardRoom.ts` | P1 |
| 一挑四触发条件 | `CodeCard.ts` | P1 |

---

## 八、上线前必跑清单

```
□ game-reviewer agent  — IAP/年龄分级/COPPA 威胁模型
□ security-officer agent — OWASP 审计，gate:ship 签字
□ /tdd-coverage — P0 全覆盖确认
□ performance-engineer agent — 150ms P95 延迟验证
□ /audit — PROJECT.md 更新
□ devops agent — 多端构建验证（小程序/H5/Android/iOS）
```

---

## 九、安装的 Skill 来源

| Skill / Plugin | 来源 | 说明 |
|----------------|------|------|
| PM Skills（10条命令） | `deanpeters/Product-Manager-Skills` | PM 框架，49个方法论 |
| great_cto（12个 agent + 14条命令） | `avelikiy/great_cto` v2.56.0 | 完整 SDLC 流水线 |
| Karpathy Rules | `multica-ai/andrej-karpathy-skills` | 四条硬约束，注入项目 CLAUDE.md |
| tdd-guide | `alirezarezvani/claude-skills` | TDD 工作流 + 8个 Python 脚本 |
| Hooks（3条） | `~/.claude/settings.json` | 危险命令拦截 / Secret 扫描 / 写入日志 |
