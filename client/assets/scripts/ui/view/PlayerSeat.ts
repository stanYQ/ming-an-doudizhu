/**
 * @file PlayerSeat.ts
 * @description 玩家席位组件：昵称/手牌数/计时圆环/身份标签/出完状态。
 * @module client/ui
 */

export interface SeatData {
  playerId:      string;
  nickname:      string;
  handCount:     number;
  isCurrentTurn: boolean;
  turnDeadline?: number;
}

export class PlayerSeat {
  seatIndex = 0;

  // 由 Cocos 场景绑定注入（测试中传入 stub 对象）
  _nicknameLabel:  { string: string }                            = { string: '' };
  _handCountLabel: { string: string }                            = { string: '' };
  _timerNode:      { active: boolean }                           = { active: false };
  _identityBadge:  { string: string; node: { active: boolean } } = { string: '', node: { active: false } };
  _finishedNode:   { active: boolean }                           = { active: false };

  private _identity = '';

  /**
   * 刷新席位显示数据（每次 turn_change 或 play_broadcast 后调用）。
   * @param data 最新的席位快照
   */
  update(data: SeatData): void {
    this._nicknameLabel.string  = data.nickname;
    this._handCountLabel.string = String(data.handCount);
    this._timerNode.active      = data.isCurrentTurn;
    this._finishedNode.active   = data.handCount === 0;
  }

  /**
   * 展示玩家身份标签（identity_reveal 消息触发）。
   * 注意：全屏揭晓动画由 Cocos tween 执行，此处只更新节点状态。
   * @param role 身份：'landlord' | 'partner' | 'civilian'
   */
  showIdentity(role: 'landlord' | 'partner' | 'civilian'): void {
    this._identity = role;
    if (role === 'civilian') {
      this._identityBadge.node.active = false;
    } else {
      this._identityBadge.string      = role;
      this._identityBadge.node.active = true;
    }
  }

  /** 标记该席位玩家已出完所有手牌。 */
  showFinished(): void {
    this._finishedNode.active = true;
  }

  /** 返回当前记录的身份（未揭晓前为空字符串）。 */
  getIdentity(): string { return this._identity; }
}
