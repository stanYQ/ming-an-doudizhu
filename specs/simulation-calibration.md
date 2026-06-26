# Spec: 数值模拟与平衡校准

**任务 ID**: TASK-024  
**目标模块**: server（工具脚本，不入生产）  
**优先级**: P1（里程碑验证，TASK-022 实现前完成）  
**状态**: ready（AC 更新：新增 AC-15–18，--sample 诊断选项）  
**前置依赖**: TASK-026（AIPlayer V2）done  
**权威来源**: 项目计划书 V1.1 §6.1 + 第九章 P1 里程碑指标

---

## 背景

计划书 P1 里程碑要求：运行 ≥10万局程序模拟，验证地主方胜率落入 **45%–55%**，并校准一挑四倍数（默认 ×3）与结算权重。模拟结果是 TASK-022 数值参数的决策依据。此任务为工具脚本，不进入生产代码路径。

**模拟结构**：脚本创建 CardRoom 实例（不启动 Colyseus 网络层），注入 5 个 AIPlayer V2（TASK-026）实例，通过 Room 的内部方法驱动对局，收集胜负数据。不直接调用 AIPlayer.decide()，而是走完整的 Room 消息流，确保规则引擎、超时、状态机均被覆盖。

---

## 验收标准

### 模拟执行

- AC-1: 脚本可独立运行：`npx ts-node server/tools/simulate.ts --games 100000`
- AC-2: 创建 CardRoom 实例，注入 5 个 AIPlayer V2 实例（`isAI: true`）驱动对局；不启动网络层，直接调用 Room 内部方法
- AC-3: 每局独立随机洗牌（Deck.shuffle()，无固定 seed）
- AC-4: 暗号牌由模拟器在合法范围（rank 0–7，suit 0–3）内随机选取
- AC-5: 支持 `--games <n>` 参数，最小 1000，默认 100000
- AC-6: 模拟进度每 10000 局输出一次（stdout）

### 统计指标

- AC-7: 输出**地主方整体胜率**（2v3 + 1v4 合计）
- AC-8: 分别输出 2v3 模式胜率与 1v4 模式胜率
- AC-9: 输出一挑四**触发率**（一挑四局数 / 总局数）
- AC-10: 输出平均单局倍数 M（不含个人加倍）
- AC-11: 输出炸弹分布（平均每局炸弹数、王炸数）

### 通过标准（P1 里程碑 Gate）

- AC-12: 地主方整体胜率落入 **42%–55%** → P1 通过，数值锁定  
  （PM 2026-06-18 决策：5v2 结构不对称使天花板≈44.7%，属博弈机制预期结果，Gate 从 45% 下调至 42%）
- AC-13: 若胜率不在范围内 → 脚本输出调参建议（一挑四倍数/结算权重方向），由 PM 拍板后修改规则并重跑

### 调参诊断（可选）

- AC-15: 支持 `--sample <n>` 参数（默认 0，不输出）；`n` 最大 20
- AC-16: `--sample n` 时，从所有已完成局中均匀抽取 n 局，每局输出完整出牌序列到 `server/tools/sample-games.json`
- AC-17: 每局记录格式：局号、模式（2v3/1v4）、胜方阵营、总手数、每手记录（seat / cards / pattern / isPass）
- AC-18: `--sample` 不影响统计指标计算，不影响 Gate 判定

### 输出格式

- AC-14: 结果写入 `server/tools/calibration-report.json`，格式见下

---

## 输出格式

```json
{
  "totalGames": 100000,
  "landlordWinRate": 0.503,
  "mode2v3": {
    "games": 87234,
    "winRate": 0.512
  },
  "mode1v4": {
    "games": 12766,
    "winRate": 0.441
  },
  "landlordAloneRate": 0.128,
  "avgMultiplier": 3.7,
  "avgBombsPerGame": 1.4,
  "avgRocketsPerGame": 0.3,
  "passGate": true,
  "recommendation": null
}
```

若 `passGate: false`，`recommendation` 字段输出文字建议，如：
`"地主方胜率偏低（44.1%），建议将一挑四倍数从 ×3 降至 ×2.5 后重跑"`

---

## 工具位置与约束

```
server/tools/
├── simulate.ts              ← 主脚本
├── calibration-report.json  ← 统计输出（gitignore）
└── sample-games.json        ← 诊断样本（gitignore，仅 --sample 时生成）
```

- `simulate.ts` 复用 `CardRoom`、`RuleEngine`、`Deck`、`AIPlayer V2`，不重写业务逻辑
- 模拟循环：创建 Room → 加入 5 个 AI → 自动跑完一局 → 记录结果 → 销毁 Room → 重复
- 工具脚本不引入生产代码的任何外部依赖（mysql2、ioredis 等）
- `calibration-report.json` 和 `sample-games.json` 加入 `.gitignore`，不提交

## 不在范围内

- 强化学习 AI 训练 —— P4
- 多参数网格搜索自动化 —— 手动跑即可
- 客户端模拟 —— 不需要

## 测试要求

- 无需单元测试（工具脚本）
- **验收方式**：跑完 10万局，`calibration-report.json` 的 `passGate` 为 `true`
- 若需多次调参，每次修改参数后重跑并保留报告（文件名加日期后缀存档）
