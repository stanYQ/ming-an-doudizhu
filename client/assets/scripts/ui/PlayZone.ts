/**
 * @file PlayZone.ts
 * @description 中央出牌区：展示上一手牌、按钮控制、错误提示、倒计时。
 * @module client/ui
 */

export class PlayZone {
  // 由 Cocos 场景绑定注入（测试中传入 stub 对象）
  _playBtn:    { interactable: boolean; node: { active: boolean } } = { interactable: true,  node: { active: true } };
  _passBtn:    { interactable: boolean; node: { active: boolean } } = { interactable: true,  node: { active: true } };
  _errorLabel: { string: string; node: { active: boolean } }        = { string: '', node: { active: false } };
  _timerLabel: { string: string }                                   = { string: '' };

  private _lastPlayerId = '';
  private _lastCards:   number[] = [];
  private _deadline     = 0;

  /**
   * 记录并展示上一手出牌信息（牌面渲染由 Cocos 节点绑定完成）。
   * @param playerId 出牌者的 Colyseus sessionId
   * @param cards    出的牌，0-107 编码数组
   */
  showLastPlay(playerId: string, cards: number[]): void {
    this._lastPlayerId = playerId;
    this._lastCards    = cards;
  }

  /** 返回上一手出牌的玩家 ID。 */
  getLastPlayerId(): string { return this._lastPlayerId; }

  /** 返回上一手出的牌（原始编码）。 */
  getLastCards():    number[] { return this._lastCards; }

  /**
   * 清除上一手牌记录。
   * 注意：0.3s 淡出动画由 Cocos tween 执行，纯逻辑层只清状态。
   */
  clear(): void {
    this._lastPlayerId = '';
    this._lastCards    = [];
  }

  /**
   * 单独控制出牌按钮可用状态（不影响不要按钮）。
   * @param enabled true = 可点击
   */
  setPlayButtonEnabled(enabled: boolean): void {
    this._playBtn.interactable = enabled;
  }

  /**
   * 单独控制不要按钮可用状态（不影响出牌按钮）。
   * @param enabled true = 可点击
   */
  setPassButtonEnabled(enabled: boolean): void {
    this._passBtn.interactable = enabled;
  }

  /**
   * 同时控制出牌和不要按钮（阶段切换时整体禁用/启用）。
   * @param enabled true = 两个按钮均可点击
   */
  setInteractable(enabled: boolean): void {
    this._playBtn.interactable = enabled;
    this._passBtn.interactable = enabled;
  }

  /**
   * 显示错误提示（牌型不合法、压不过上家等）。
   * @param msg 提示文字
   */
  showError(msg: string): void {
    this._errorLabel.string      = msg;
    this._errorLabel.node.active = true;
  }

  /**
   * 启动倒计时（记录截止时间戳，Cocos tween 读取此值驱动动画）。
   * @param deadline 服务端下发的截止时间戳（毫秒）
   */
  startCountdown(deadline: number): void {
    this._deadline = deadline;
  }

  /** 返回当前倒计时截止时间戳。 */
  getDeadline(): number { return this._deadline; }
}
