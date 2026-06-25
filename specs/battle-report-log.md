# Spec: 测试阶段战报日志

**任务 ID**: TASK-038  
**目标模块**: server  
**优先级**: P4.6  
**状态**: ready  

---

## 执行流程

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

Step 5  Diff 审查
        → /karpathy

Step 6  验证
        → npm test 全套，确认测试数全绿零警告
        → AI_FILL_DELAY=0 npm run dev 跑一局，确认终端出现 [BATTLE] JSON 行

Step 7  完成
        → 更新 .tasks/done.md，从 in-progress.md 移除
```

---

## 背景

测试阶段需要分析牌局是否正常推进：出牌序列是否合法、身份揭晓是否触发、倍率计算是否正确。现有 `[PLAY][TURN][FINISH]` log 是离散行，无法在一局结束后整体核查。

本任务在 `finishGame` 时组装完整 `BattleReport` 并用 Logger 输出为单行 JSON，不落库，不新增接口。测试者通过 `grep '[BATTLE]'` 提取单局完整战报进行分析。

上线阶段回放功能（落库 + 查询 API）单独立项（P5），本任务数据结构须对齐，方便复用。

---

## 验收标准

- AC-1: `CardRoom` 新增私有字段 `private battlePlays: BattlePlay[]`，在每次 `handlePlay` / `handlePass` 成功执行后追加一条记录
- AC-2: `BattlePlay` 包含 `{ turn: number; seatIndex: number; sessionId: string; cards: number[]; isPass: boolean; patternType: string | null }`；pass 时 `cards=[]`、`isPass=true`、`patternType=null`
- AC-3: `partnerRevealedAtTurn` 字段记录身份揭晓发生在第几手（从 1 计数）；未触发时为 `null`
- AC-4: `finishGame` 末尾调用私有方法 `logBattleReport(winnerId)`，组装 `BattleReport` 并调用 `Logger.info('[BATTLE]', JSON.stringify(report))`
- AC-5: `BattleReport` 包含 `doubling` 字段：`{ landlordDouble: 1|2; partnerDoubled: boolean; otherDoubledSeats: number[] }`，数据来自已有 `doublingSubmits`
- AC-6: `BattleReport` 包含 `result` 字段：`{ winnerCamp; isSpring; isAntiSpring; bombCount; scores: Record<string, number> }`，数据来自已有 `buildGameSummary` 计算结果
- AC-7: 输出的 JSON 可被 `JSON.parse` 无异常解析
- AC-8: 现有测试数不减少（新增字段不破坏任何已有测试）

---

## 接口 / 数据结构

```typescript
type BattlePlay = {
  turn:        number;       // 从 1 计数
  seatIndex:   number;
  sessionId:   string;
  cards:       number[];     // 空数组 = pass
  isPass:      boolean;
  patternType: string | null;
};

type BattleReport = {
  roomId:               string;
  startAt:              number;  // ms timestamp，onCreate 时记录
  endAt:                number;  // ms timestamp，finishGame 时记录
  landlordSeat:         number;
  partnerSeat:          number | null;
  partnerRevealedAtTurn: number | null;
  plays:                BattlePlay[];
  doubling: {
    landlordDouble:    1 | 2;
    partnerDoubled:    boolean;
    otherDoubledSeats: number[];
  };
  result: {
    winnerCamp:   "landlord_camp" | "civilian_camp";
    isSpring:     boolean;
    isAntiSpring: boolean;
    bombCount:    number;
    scores:       Record<string, number>;
  };
};
```

---

## 约束

- 只在 `finishGame` 输出一次；不在其他阶段输出
- 使用现有 `Logger.info`，不引入新日志库
- `battlePlays` 数组只追加，不修改历史记录
- `resetForRematch` 时清空 `battlePlays` 和 `startAt`，重置 `turnCount`
- 不新增任何客户端协议消息、不新增数据库表

---

## 不在范围内

- 落库（P5 任务）
- 查询 / 回放 API（P5 任务）
- AI 决策详情（`AIPlayer.decide` 内部评分）
- 压力测试下的 log 聚合

---

## 测试要求

- 单元测试：`CardRoom` 打完一局后，捕获 `Logger.info` 调用，验证 AC-1 ～ AC-8
- 边界：春天局（平民方全程未出牌）、炸弹局（bombCount > 0）、身份揭晓触发 vs 未触发
- 错误路径：`doublingSubmits` 为空时 `otherDoubledSeats` 为 `[]` 不崩溃
