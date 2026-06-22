# Spec: 加倍阶段客户端 UI

**任务 ID**: TASK-027  
**目标模块**: client  
**优先级**: P4.2  
**状态**: ready  
**前置依赖**: TASK-023（CardRoom 加倍阶段协议）done；TASK-011（GameController）done  
**权威来源**: specs/doubling-phase.md 协议消息定义

---

## 背景

TASK-023 在服务端新增了 `doubling` 状态和四条协议消息。客户端需要：
1. GameController 新增 `DOUBLING` 状态
2. NetManager 新增 `setDouble()` 发送方法
3. 新组件 `DoublingView.ts` 渲染加倍交互 UI

加倍流程：进入阶段 → 地主先选（其余等待）→ 地主选完后全员可选 → 全员选完或超时 → 自动进入出牌阶段。

---

## 验收标准

### GameController 扩展（TASK-011 延伸）

- AC-1: `ClientGameState` 枚举新增 `DOUBLING` 状态，插入 `LANDLORD_SELECT` 与 `PLAYING` 之间
- AC-2: 收到 `doubling_start` 消息 → `state` 切换为 `DOUBLING`，向 `EventManager.emit("DOUBLING_START", msg)`
- AC-3: 收到 `landlord_doubled` 消息 → `EventManager.emit("LANDLORD_DOUBLED", msg)`，不触发状态切换
- AC-4: 收到 `doubling_result` 消息 → `EventManager.emit("DOUBLING_RESULT", msg)`
- AC-5: 收到 `STATE` 事件且 `phase === "playing"` → `state` 从 `DOUBLING` 切换为 `PLAYING`

### NetManager 扩展（TASK-010 延伸）

- AC-6: 新增 `setDouble(value: 1 | 2)` 方法 → 发送 `{ type: "set_double", value }`
- AC-7: `room` 为 `null` 时调用 `setDouble` → 静默忽略（与其他 send 方法一致）

### DoublingView 组件

- AC-8: 监听 `DOUBLING_START` 事件后显示加倍面板；面板包含：倒计时、「×1 不加倍」和「×2 加倍」两个按钮
- AC-9: 倒计时从 `msg.timeout` 秒开始递减，每秒更新显示；归零时按钮自动禁用
- AC-10: 本机是地主（`msg.landlordSeatIndex === myIndex`）→ 按钮立即可点击
- AC-11: 本机不是地主 → 按钮初始禁用，显示「等待地主选择…」
- AC-12: 收到 `LANDLORD_DOUBLED` 事件 → 展示地主已选倍数（如「地主选择 ×2」）；若本机非地主，解锁按钮
- AC-13: 点击任意按钮 → 调用 `NetManager.setDouble(value)`，两个按钮均禁用（防重复提交）
- AC-14: 收到 `DOUBLING_RESULT` 事件 → 隐藏按钮区，逐座位显示「已加倍 ×2」或「未加倍 ×1」（boolean 判断，不显示身份）；展示 1.5 秒后自动隐藏面板
- AC-15: 收到 `STATE` 切换为 `PLAYING` → 若面板仍可见则立即隐藏

### 断线重连

- AC-16: 收到重播的 `doubling_start` 消息（断线重连场景）→ 面板重新显示，倒计时从服务端剩余时间恢复（`msg.timeout` 为剩余秒数）

---

## 接口 / 数据结构

```typescript
// 新增到 client/assets/scripts/net/NetManager.ts
setDouble(value: 1 | 2): void;

// 新增到 ClientGameState enum（client/assets/scripts/game/GameController.ts）
enum ClientGameState {
  CONNECTING,
  IN_LOBBY,
  IN_ROOM_WAIT,
  DEALING,
  LANDLORD_SELECT,
  DOUBLING,        // ← 新增
  PLAYING,
  SETTLEMENT,
}

// 新增组件
// client/assets/scripts/ui/DoublingView.ts
export class DoublingView extends Component {
  /** 显示加倍面板，绑定倒计时与按钮 */
  show(msg: DoublingStartMsg): void;
  /** 地主加倍结果到达，更新 UI 并解锁平民按钮 */
  onLandlordDoubled(msg: LandlordDoubledMsg): void;
  /** 展示全员加倍结果，1.5秒后自动隐藏 */
  onResult(msg: DoublingResultMsg): void;
  /** 立即隐藏面板 */
  hide(): void;
}
```

---

## 约束

- `DoublingView` 不持有游戏状态，所有数据通过事件消息注入
- 不在此 spec 中实现加倍动画特效（属 P4.3 视觉优化）
- 加倍结果只展示 `doubled: boolean`，严禁通过颜色或图标暗示身份

## 不在范围内

- 加倍阶段 AI 智能决策（AI 统一选 ×1，在 TASK-026 已实现）
- 倍数动画特效 —— P4.3
- 明保规则 UI —— P4

## 测试要求

- 单元测试覆盖全部 16 条 AC
- 关键路径：地主先选（AC-10/11/12）→ 平民解锁（AC-12）→ 全员结果（AC-14）
- 边界：倒计时归零禁用按钮（AC-9）、断线重连恢复（AC-16）、重复事件不重复渲染
