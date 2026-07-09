# Client-Dev 任务交付 — TASK-053 GameScene UI 完整实现

> PM → Client-Dev 任务交付文档

**交付时间**: 2026-07-09  
**交付人**: PM Agent  
**接收人**: Client-Dev  
**任务 ID**: TASK-053  
**优先级**: P0（最高优先级）

---

## 📋 任务概述

**任务名称**: GameScene UI 完整实现

**任务目标**: 按照完整 Spec 从零实现 GameScene 所有 UI 组件、动画、状态机和边界处理。

**工作量**: 25-32 小时（3-4 个工作日）

**预计完成**: 2026-07-12（本周五）

---

## 📄 核心交付物

### 1. 完整实现规格文档 ⭐

**文件**: `specs/gamescene-ui-implementation-complete.md`  
**篇幅**: 15,000+ 字  
**内容**: 7 个章节 + 76 个验收标准

**章节目录**:
```
一、GameScene 架构概览
    1.1 UI 分层架构
    1.2 状态机流程
    1.3 玩家席位布局

二、常驻 UI 组件详细规格
    2.1 HandCardView（手牌区）
    2.2 PlayZone（出牌区）
    2.3 PlayerSeat（玩家席位）
    2.4 BottomCardsDisplay（底牌展示）

三、弹窗组件详细规格
    3.1 CodeCardSelector（暗号牌选择弹窗）
    3.2 DoublingView（加倍选择弹窗）
    3.3 SettlementView（结算界面）

四、状态转换与 UI 响应
    4.1-4.9 七个阶段完整流程

五、动画时序表
    5.1-5.7 七个关键动画时序

六、边界情况与错误处理
    6.1-6.6 六种边界场景

七、完整验收标准
    7.1-7.4 76 个验收标准（AC）

八、实现清单与工时评估
    8.1-8.3 四个阶段实现计划

九、实现建议
    9.1-9.4 开发顺序、代码规范、性能优化、测试策略

十、参考资料
```

**阅读建议**: 
- **第一遍**: 通读一、二、三章（理解架构和组件职责）
- **第二遍**: 精读需要实现的组件章节（对照代码示例）
- **第三遍**: 查阅四、五、六章（实现时遇到问题时参考）

---

## 🎯 实现范围

### 常驻 UI 组件（4 个）

#### 1. HandCardView（手牌区）— 4h

**职责**:
- 接收并显示玩家手牌（0-107 编码）
- 支持单选/多选交互
- 实时显示牌型识别结果
- 管理「出牌」「过」「提示」按钮状态
- 发牌动画（50ms stagger × 20 张）
- Hint 高亮闪烁（0.5s × 3 次）

**关键技术**:
- ≤12 张: 固定间距 42px
- >12 张: ScrollView 横向滚动
- 选中状态: 上移 20px + 金色描边 3px
- 牌型识别: `parse(selectedCards)` 实时验证

**验收标准**: 12 个 AC（AC-1 ~ AC-12）

---

#### 2. PlayZone（出牌区）— 2h

**职责**:
- 显示当前回合所有玩家的出牌
- 使用 MiniCardItem 显示代表牌（最多 5 张）
- 显示当前回合标识（绿色圆环=己方，灰色=其他）
- 新回合时清空历史出牌
- 出牌飞入动画（300ms ease-out + 50ms stagger）

**关键技术**:
- MiniCardItem 尺寸: 30×45px
- 顺子显示: 「3 4 5 ... 7」格式
- 飞入动画: 从席位飞向出牌区（贝塞尔曲线）

**验收标准**: 6 个 AC（AC-13 ~ AC-18）

---

#### 3. PlayerSeat × 5（玩家席位）— 3h

**职责**:
- 显示玩家基本信息（头像、昵称、手牌数量）
- 显示 AI 标识（isAI=true）
- 显示轮次指示器（轮到时高亮 + 倒计时）
- 显示身份标签（地主/队友/平民）
- 非轮次时降低透明度（opacity 60%）
- 视角旋转（自己永远在底部）

**关键技术**:
- 5 人席位坐标: `[0, -300]`, `[500, -60]`, `[280, 260]`, `[-280, 260]`, `[-500, -60]`
- 视角旋转公式: `seatIndex = (serverIndex - mySelfServerIndex + 5) % 5`
- 轮次指示器: 脉冲动画（scale 1.0 ↔ 1.2，循环）
- 倒计时颜色: >10s 白色 | 5-10s 黄色 | <5s 红色

**验收标准**: 10 个 AC（AC-19 ~ AC-28）

---

#### 4. BottomCardsDisplay（底牌展示）— 1h

**职责**:
- landlord_select 阶段结束后显示 3 张底牌
- 播放融入动画（飞向地主席位）
- 2s 后隐藏

**关键技术**:
- 飞行路径: 贝塞尔曲线（抛物线，向上拱起 100px）
- 3 张牌依次飞出（200ms stagger）
- 飞行过程缩小（scale 1.0 → 0.5）

**验收标准**: 7 个 AC（AC-29 ~ AC-35）

---

### 弹窗组件（3 个）

#### 5. CodeCardSelector（暗号牌选择弹窗）— 2h

**职责**:
- landlord_select 阶段弹出（仅候选地主）
- 显示 4 张手牌按钮（Suit + Value）
- 单选交互（最多选 1 张）
- 倒计时（10s，颜色变化）
- 超时自动选第一张

**关键技术**:
- 卡牌格式化: `♠3`, `♥4`, `♦5`, `♣6`
- 选中状态: 金色高亮 + 放大 10%
- 倒计时颜色: >5s 白色 | 3-5s 黄色 | <3s 红色

**验收标准**: 8 个 AC（AC-36 ~ AC-43）

---

#### 6. DoublingView（加倍选择弹窗）— 2h

**职责**:
- doubling 阶段弹出
- 显示「不加倍」「加倍 ×2」两个按钮
- 倒计时（10s，颜色变化）
- 超时自动选「不加倍」
- 滑入/滑出动画

**关键技术**:
- 滑入动画: 从顶部 y=800 → y=0（300ms ease-out）
- 滑出动画: 向顶部 y=0 → y=800（200ms ease-in）
- 结果展示: 显示全员选择（2s）

**验收标准**: 9 个 AC（AC-44 ~ AC-52）

---

#### 7. SettlementView（结算界面）— 3h

**职责**:
- game_over 时弹出
- 显示胜负结果（地主方胜/农民方胜）
- 显示 5 个玩家的结算信息（PlayerResultCard）
- 身份揭晓动画（角色图标 stagger 显示）
- 显示倍率明细（底分、炸弹、春天、反春）
- 提供「再来一局」「返回大厅」按钮

**关键技术**:
- 入场动画: fade-in + scale 0.8 → 1.0（500ms backOut）
- 身份揭晓: 100ms stagger，fade-in + scale
- 倍率明细: 底分 × 地主加倍 × 炸弹 × 春天/反春

**验收标准**: 9 个 AC（AC-53 ~ AC-61）

---

### 状态机与消息处理（4-5h）

#### 8. GameMgr 状态机 — 3h

**职责**:
- 7 个状态的进入/退出逻辑
- 状态转换验证
- 消息监听路由

**关键技术**:
- 状态枚举: waiting | dealing | landlord_select | code_card_reveal | doubling | doubling_result | playing | settlement
- 转换验证: `_validateStateTransition(from, to)`
- 消息路由: `onMessage(type, message)`

**验收标准**: 10 个 AC（AC-62 ~ AC-71）

---

#### 9. NetManager 对接 — 2h

**职责**:
- 消息发送接口
- 消息格式验证
- 错误处理

**关键技术**:
- 发送接口: `sendDealingReady()`, `sendSelectCodeCard()`, `sendSetDouble()`, `sendPlay()`, `sendPass()`, `sendRematch()`
- 格式验证: JSON Schema 验证
- 重连机制: 断线自动重连

---

### 边界情况与测试（3-4h）

#### 10. 边界处理 — 2h

**职责**:
- 网络断线/重连
- 超时托管
- 非法出牌
- 快速点击防抖
- 资源加载失败

**验收标准**: 5 个 AC（AC-72 ~ AC-76）

---

#### 11. 单元测试 — 2h

**职责**:
- HandCardView 测试（选牌、牌型识别、hint）
- PlayZone 测试（MiniCardItem、回合标识）
- PlayerSeat 测试（轮次指示、视角旋转）
- 状态机测试（转换逻辑、消息路由）

**目标**: 测试覆盖率从 145 → 160+

---

## 📅 实现计划（4 阶段）

### Phase 1: 常驻 UI 组件（10-12h）— Day 1-2

**Day 1 上午（4h）**: HandCardView
- 基础布局（≤12 张固定间距，>12 张 ScrollView）
- 单选/多选交互
- 牌型识别与显示

**Day 1 下午（4h）**: HandCardView + PlayerSeat
- Hint 高亮动画
- 发牌动画
- PlayerSeat 基础信息

**Day 2 上午（3h）**: PlayerSeat + PlayZone
- 轮次指示器（高亮 + 脉冲 + 倒计时）
- 身份标签
- PlayZone 基础布局

**Day 2 下午（2h）**: PlayZone + BottomCardsDisplay
- 出牌飞入动画
- 底牌融入动画

---

### Phase 2: 弹窗组件（6-8h）— Day 2-3

**Day 2 下午（2h）**: CodeCardSelector
- 4 张手牌按钮
- 单选交互
- 倒计时

**Day 3 上午（2h）**: DoublingView
- 滑入/滑出动画
- 按钮交互
- 结果展示

**Day 3 下午（3h）**: SettlementView
- PlayerResultCard × 5
- 身份揭晓动画
- 倍率明细

---

### Phase 3: 状态机与消息处理（4-5h）— Day 3-4

**Day 3 下午（3h）**: GameMgr 状态机
- 7 个状态的进入/退出逻辑
- 状态转换验证
- 消息监听路由

**Day 4 上午（2h）**: NetManager 对接
- 消息发送接口
- 消息格式验证
- 错误处理

---

### Phase 4: 边界情况与测试（3-4h）— Day 4

**Day 4 上午（2h）**: 边界处理
- 网络断线/重连
- 超时托管
- 非法出牌

**Day 4 下午（2h）**: 单元测试
- HandCardView 测试
- PlayZone 测试
- PlayerSeat 测试
- 状态机测试

---

## ✅ 验收流程

### 自验收（Client-Dev）

**步骤 1**: 运行单元测试
```bash
cd ~/Desktop/game_project/client
npm test
# 预期: 160+ tests passed（从 145 增加到 160+）
```

**步骤 2**: 运行集成测试
```bash
# Terminal 1: 启动服务端
cd ~/Desktop/game_project/server
AI_FILL_DELAY=0 npx ts-node src/index.ts

# Terminal 2: 集成测试
cd ~/Desktop/game_project/client
npm test -- --testPathPattern=GameFlow.integration --forceExit
# 预期: 9/9 AC passed
```

**步骤 3**: Cocos Editor 预览
```
1. 打开 Cocos Dashboard
2. 打开项目 → Editor
3. 打开 GameScene
4. 点击「预览」按钮
5. 验证: 所有 UI 显示正常、动画流畅、无 console 报错
```

**步骤 4**: 人工验证
- 完整游戏流程（waiting → dealing → ... → settlement）
- 所有动画播放流畅
- 所有按钮交互正常
- 所有弹窗显示正常

---

### PM 验收

**验收人**: PM Agent  
**验收时间**: Day 4 下午  
**验收方式**: 对照 76 个 AC 逐条验收

**验收标准**:
- [ ] 常驻 UI 组件 40 AC 全部通过
- [ ] 弹窗组件 26 AC 全部通过
- [ ] 状态转换 10 AC 全部通过
- [ ] 边界情况 5 AC 全部通过
- [ ] 单元测试 160+ 通过
- [ ] 集成测试 9/9 通过
- [ ] Cocos 预览无报错

**验收通过后**:
- 更新 `.tasks/done.md`
- 标记 TASK-053 完成
- 生成完成报告

---

## 🔧 开发环境准备

### 前置条件检查

**代码依赖**:
- [x] GameMgr.ts 已完成（状态机框架）
- [x] NetManager.ts 已完成（网络层）
- [x] shared/（CardEncoding、PatternHelper）已完成
- [x] UIId 配置已完成
- [x] oops-framework 已集成

**服务端协议**:
- [x] TASK-050s 已完成（dealing_ready / code_card_reveal / doubling_result 协议）

**开发工具**:
- [ ] Cocos Creator 3.8 已安装
- [ ] Node.js 16+ 已安装
- [ ] npm 包依赖已安装（`cd client && npm install`）

---

## 📚 参考资料

### 核心文档（必读）

1. **specs/gamescene-ui-implementation-complete.md** ⭐⭐⭐⭐⭐
   - 完整实现规格（15,000+ 字）
   - 76 个验收标准
   - 代码示例

2. **docs/PROTOCOL.md**
   - 网络协议完整定义
   - 消息格式

3. **docs/GAME-RULES.md**
   - 游戏规则完整定义
   - 牌型定义

### 辅助文档（可选）

4. **specs/ui-flow-03-deal-landlord.md**
   - 发牌/选地主阶段 UI（已过时，参考用）

5. **specs/ui-flow-04-doubling-play.md**
   - 加倍/出牌阶段 UI（已过时，参考用）

6. **specs/ui-flow-05-settlement-rematch.md**
   - 结算/再来一局 UI（已过时，参考用）

7. **specs/animation-sync.md**
   - 动画同步修复方案

### 代码参考

- `client/assets/scripts/logic/GameMgr.ts` — 游戏业务逻辑
- `client/assets/scripts/net/NetManager.ts` — 网络层
- `shared/PatternHelper.ts` — 牌型识别引擎
- `shared/CardEncoding.ts` — 0-107 编码解码

---

## 💬 沟通与协调

### 日常沟通

**方式**: GitHub Issues / 项目群聊 / 每日站会

**频率**:
- 每日站会: 上午 10:00（同步进度、阻塞问题）
- 问题咨询: 随时（GitHub Issues 或群聊）

### 阻塞上报

**遇到阻塞时**:
1. 记录到 `.tasks/blocked.md`
2. 格式: `- [ ] TASK-053 阻塞原因: {描述} | 需要: {PM决策|协调} | 报告人: client-dev`
3. @PM Agent 在群聊通知

**阻塞类型**:
- 技术方案不明确 → PM 决策
- 协议定义缺失 → Server-Dev 协调
- 美术资源缺失 → Designer 协调

---

## 🎉 完成后里程碑

### 项目完成度提升

| 指标 | 当前 | 完成后 |
|------|------|--------|
| **GameScene 完成度** | 0% | **100%** ✅ |
| **Client 测试** | 145 | **160+** ✅ |
| **P0-P5.2 完成度** | 91.4% | **95%+** ✅ |

### 下一步任务

TASK-053 完成后，Client-Dev 可继续：
- TASK-051B（预构建脚本自动同步，2.5h）
- TASK-050c（动画同步修复，1-2h）
- TASK-045b（SettlementView Prefab 补全，0.5h）

预计再花 4-5h 完成所有剩余任务，达到 **100% 完成度**。

---

## 📞 联系方式

**PM Agent**: 负责任务验收、阻塞协调  
**Server-Dev**: 负责服务端协议支持、联调测试  
**Designer**: 负责美术资源提供

---

**交付确认**: 请 Client-Dev 阅读本文档后回复「已阅读，开始实现」

**祝开发顺利！** 🚀

---

**文档版本**: v1.0  
**创建时间**: 2026-07-09  
**维护人**: PM Agent
