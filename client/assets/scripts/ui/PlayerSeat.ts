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

  _nicknameLabel:  { string: string }                       = { string: '' };
  _handCountLabel: { string: string }                       = { string: '' };
  _timerNode:      { active: boolean }                      = { active: false };
  _identityBadge:  { string: string; node: { active: boolean } } = { string: '', node: { active: false } };
  _finishedNode:   { active: boolean }                      = { active: false };

  private _identity = '';

  update(data: SeatData): void {
    this._nicknameLabel.string  = data.nickname;
    this._handCountLabel.string = String(data.handCount);
    this._timerNode.active      = data.isCurrentTurn;
    this._finishedNode.active   = data.handCount === 0;
  }

  showIdentity(role: 'landlord' | 'partner' | 'civilian'): void {
    this._identity = role;
    if (role === 'civilian') {
      this._identityBadge.node.active = false;
    } else {
      this._identityBadge.string      = role;
      this._identityBadge.node.active = true;
    }
    // AC-6: 全屏身份揭晓动画由 Cocos tween 执行，纯逻辑层只记录状态
  }

  showFinished(): void {
    this._finishedNode.active = true;
  }

  getIdentity(): string { return this._identity; }
}
