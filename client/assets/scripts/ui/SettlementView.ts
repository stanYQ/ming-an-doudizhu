/**
 * @file SettlementView.ts
 * @description 结算界面：胜负横幅、全员身份/积分展示、倍率明细、操作按钮。
 * @module client/ui
 */

export interface PlayerResult {
  playerId:   string;
  nickname:   string;
  role:       'landlord' | 'partner' | 'civilian';
  scoreDelta: number;
  isMe:       boolean;
}

export interface SettlementData {
  winnerCamp:       0 | 1;
  players:          PlayerResult[];
  multiplier:       number;
  multiplierDetail: { mode: number; bombCount: number; rocketCount: number };
}

export class SettlementView {
  _rootNode:      { active: boolean }      = { active: false };
  _bannerLabel:   { string: string }       = { string: '' };
  _playAgainBtn:  { interactable: boolean } = { interactable: false };
  _returnHallBtn: { interactable: boolean } = { interactable: false };

  onPlayAgain:  () => void = () => {};
  onReturnHall: () => void = () => {};

  private _data:      SettlementData | null = null;
  private _animating  = false;

  show(data: SettlementData): void {
    this._data               = data;
    this._rootNode.active    = true;
    this._animating          = true;
    this._playAgainBtn.interactable  = false;
    this._returnHallBtn.interactable = false;
    this._bannerLabel.string = data.winnerCamp === 1 ? '地主阵营获胜' : '平民阵营获胜';
    // AC-6/7: 淡入 + 积分滚动动画由 Cocos tween 执行；finishAnimation() 结束后启用按钮
  }

  hide(): void {
    this._rootNode.active = false;
  }

  /** Cocos tween 动画结束后调用（或测试中直接调用） */
  finishAnimation(): void {
    this._animating                  = false;
    this._playAgainBtn.interactable  = true;
    this._returnHallBtn.interactable = true;
  }

  onPlayAgainClick(): void {
    if (this._animating) return;
    this.onPlayAgain();
  }

  onReturnHallClick(): void {
    if (this._animating) return;
    this.onReturnHall();
  }

  formatScore(delta: number): string {
    return delta >= 0 ? `+${delta}` : `${delta}`;
  }

  getPlayers(): PlayerResult[] {
    return this._data?.players ?? [];
  }

  getMe(): PlayerResult | undefined {
    return this._data?.players.find(p => p.isMe);
  }

  getMultiplier(): number {
    return this._data?.multiplier ?? 0;
  }

  getMultiplierDetail(): SettlementData['multiplierDetail'] {
    return this._data?.multiplierDetail ?? { mode: 1, bombCount: 0, rocketCount: 0 };
  }
}
