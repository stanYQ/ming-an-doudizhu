# Spec: 数值模拟与平衡校准

**任务 ID**: TASK-024  
**目标模块**: server（工具脚本，不入生产）  
**优先级**: P1（里程碑验证，TASK-022 实现前完成）  
**状态**: ready  
**前置依赖**: TASK-008（CardRoom/RuleEngine）、TASK-020（AIPlayer）done  
**权威来源**: 项目计划书 V1.1 §6.1 + 第九章 P1 里程碑指标

---

## 背景

计划书 P1 里程碑要求：运行 ≥10万局程序模拟，验证地主方胜率落入 **45%–55%**，并校准一挑四倍数（默认 ×3）与结算权重。模拟结果是 TASK-022 数值参数的决策依据。此任务为工具脚本，不进入生产代码路径。

---

## 验收标准

### 模拟执行

- AC-1: 脚本可独立运行：`npx ts-node server/tools/simulate.ts --games 100000`
- AC-2: 每局使用 AIPlayer.decide() 驱动所有 5 名玩家（无真人输入）
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

- AC-12: 地主方整体胜率落入 **45%–55%** → P1 通过，数值锁定
- AC-13: 若胜率不在范围内 → 脚本输出调参建议（一挑四倍数/结算权重方向），由 PM 拍板后修改规则并重跑

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
├── simulate.ts       ← 主脚本
└── calibration-report.json  ← 输出（gitignore）
```

- `simulate.ts` 复用 `RuleEngine`、`Deck`、`AIPlayer`，不重写业务逻辑
- 工具脚本不引入生产代码的任何外部依赖（mysql2、ioredis 等）
- `calibration-report.json` 加入 `.gitignore`，不提交

## 不在范围内

- 强化学习 AI 训练 —— P4
- 多参数网格搜索自动化 —— 手动跑即可
- 客户端模拟 —— 不需要

## 测试要求

- 无需单元测试（工具脚本）
- **验收方式**：跑完 10万局，`calibration-report.json` 的 `passGate` 为 `true`
- 若需多次调参，每次修改参数后重跑并保留报告（文件名加日期后缀存档）
