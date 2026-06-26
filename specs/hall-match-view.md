# Spec: 主大厅 + 匹配/好友房

**任务 ID**: TASK-015  
**目标模块**: client  
**优先级**: P2  
**状态**: ready  
**前置依赖**: TASK-010（NetManager）done

---

## 背景

来源：GDD v1.0 第六章（6.1 房间与匹配）+ 第七章（7.1 界面清单、7.2 主流程跳转）。主大厅是游戏的核心枢纽界面，承载快速匹配和好友房两条进入对局的路径。P2 目标是让两条路径都可用，细节打磨（活动入口、商城入口）留 P3。

## 验收标准

### HallView — 主大厅

- AC-1: 展示当前玩家头像、昵称、当前段位图标、积分
- AC-2: 提供「快速匹配」和「好友房」两个入口按钮
- AC-3: 点击「快速匹配」→ 调用 `MatchView.showQuickMatch()`
- AC-4: 点击「好友房」→ 调用 `MatchView.showFriendRoom()`
- AC-5: 大厅加载时从 Colyseus `GameState`（或本地缓存）读取个人信息，若未登录则跳转登录页
- AC-6: 右上角「设置」按钮 → 弹出音效/音量开关（仅本地存储，不上报服务端）

### MatchView — 快速匹配

- AC-7: 进入快速匹配界面后立即调用 `netManager.joinRoom("game", { mode: "quick" })`
- AC-8: 展示匹配等待动画 + 已匹配人数（如「3/5 人已加入」），数据来自 `GameState.players.size`
- AC-9: 匹配成功（`players.size === 5`）→ 隐藏匹配界面，切换到游戏桌场景
- AC-10: 点击「取消匹配」→ 断开房间连接，返回大厅

### MatchView — 好友房（创建）

- AC-11: 点击「创建房间」→ 调用 `netManager.joinRoom("game", { mode: "friend" })`，成功后展示 6 位房间码
- AC-12: 房间码展示区提供「复制」按钮，点击后将房间码复制到系统剪贴板；在微信小程序、H5、原生三端均需正常工作
- AC-13: 等待界面实时显示已进房人数，凑满 5 人自动进入游戏桌

### MatchView — 好友房（加入）

- AC-14: 输入 6 位房间码，点击「加入」→ 调用 `netManager.joinRoom("game", { roomCode })`
- AC-15: 房间码不存在（服务端返回 error 2002）→ 提示「房间不存在，请检查房间码」
- AC-16: 房间已满（服务端返回 error 2001）→ 提示「房间已满」

## 接口 / 数据结构

```typescript
// client/assets/scripts/ui/HallView.ts
export interface HallPlayerInfo {
  nickname: string;
  avatarUrl: string;
  score: number;
  rankLevel: string;
}

export class HallView {
  show(info: HallPlayerInfo): void;
  hide(): void;
}

// client/assets/scripts/ui/MatchView.ts
export class MatchView {
  showQuickMatch(): void;
  showFriendRoom(): void;
  hide(): void;
  private onRoomJoined(): void;
  private onMatchError(code: number): void;
}
```

### 主流程跳转

```
HallView
  → MatchView(快速匹配) → [GameState.phase="dealing"] → 游戏桌场景
  → MatchView(好友房创建/加入) → [players.size=5] → 游戏桌场景
  → [返回大厅] ← SettlementView
```

## 约束

- 大厅不缓存对局数据；进入游戏桌场景时由 GameController 重新订阅 GameState
- 房间码输入框限制为 6 位数字，前端过滤非数字输入
- 「复制」功能在微信小程序、H5、原生三端均需正常工作；跨平台兼容方案由 dev 在 Cocos Creator 3.8 框架内决定
- 个人信息（积分、段位）从登录后的本地缓存读取，不在大厅重新请求接口（P3 再做实时刷新）

## 不在范围内

- 活动入口、Banner 轮播 —— P3
- 商城入口 —— P3
- 排行榜入口 —— P3
- 每日任务提醒角标 —— P3
- 段位赛报名 —— P3

## 测试要求

- 单元测试覆盖全部 16 条 AC
- 边界情况：
  - 房间码输入非数字（自动过滤，AC-14 前置）
  - 匹配取消后再次发起匹配（AC-10 后状态重置）
- 错误路径：AC-15（2002 房间不存在）、AC-16（2001 房间已满）
