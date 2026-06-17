/**
 * @file PlayZone.ts
 * @description 中央出牌区：展示上一手牌、按钮控制、错误提示、倒计时。
 * @module client/ui
 */

export class PlayZone {
  // injected by Cocos node bindings (or test stubs)
  _playBtn:    { interactable: boolean; node: { active: boolean } } = { interactable: true,  node: { active: true } };
  _passBtn:    { interactable: boolean; node: { active: boolean } } = { interactable: true,  node: { active: true } };
  _errorLabel: { string: string; node: { active: boolean } }        = { string: '', node: { active: false } };
  _timerLabel: { string: string }                                   = { string: '' };

  private _lastPlayerId = '';
  private _lastCards:   number[] = [];
  private _deadline     = 0;

  showLastPlay(playerId: string, cards: number[]): void {
    this._lastPlayerId = playerId;
    this._lastCards    = cards;
  }

  getLastPlayerId(): string { return this._lastPlayerId; }
  getLastCards():    number[] { return this._lastCards; }

  clear(): void {
    this._lastPlayerId = '';
    this._lastCards    = [];
    // AC-14: 0.3s 淡出动画由 Cocos tween 执行，纯逻辑层此处仅清状态
  }

  setPlayButtonEnabled(enabled: boolean): void {
    this._playBtn.interactable = enabled;
  }

  setPassButtonEnabled(enabled: boolean): void {
    this._passBtn.interactable = enabled;
  }

  setInteractable(enabled: boolean): void {
    this._playBtn.interactable = enabled;
    this._passBtn.interactable = enabled;
  }

  showError(msg: string): void {
    this._errorLabel.string      = msg;
    this._errorLabel.node.active = true;
  }

  startCountdown(deadline: number): void {
    this._deadline = deadline;
  }

  getDeadline(): number { return this._deadline; }
}
