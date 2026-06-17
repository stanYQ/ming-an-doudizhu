/**
 * @file MatchView.ts
 * @description 匹配弹窗：快速匹配等待 + 好友房创建/加入，凑满5人自动进游戏桌。
 * @module client/ui
 */

export class MatchView {
  _statusLabel:      { string: string }                          = { string: '' };
  _playerCountLabel: { string: string }                          = { string: '' };
  _roomCodeLabel:    { string: string; node: { active: boolean } } = { string: '', node: { active: false } };
  _copyBtn:          { node: { active: boolean } }               = { node: { active: false } };
  _errorLabel:       { string: string; node: { active: boolean } } = { string: '', node: { active: false } };
  _rootNode:         { active: boolean }                         = { active: false };

  _joinRoom:       (name: string, options: any) => Promise<{ roomCode?: string }> = () => Promise.resolve({});
  _leaveRoom:      () => Promise<void>   = () => Promise.resolve();
  _navigateToGame: () => void            = () => {};
  _navigateToHall: () => void            = () => {};
  _clipboard:      { copy(text: string): void } = { copy: () => {} };

  private _roomCode = '';
  private _roomCodeInput = '';

  async showQuickMatch(): Promise<void> {
    this._reset();
    this._rootNode.active = true;
    await this._joinRoom('game', { mode: 'quick' });
  }

  async showFriendRoom(): Promise<void> {
    this._reset();
    this._rootNode.active = true;
  }

  hide(): void {
    this._rootNode.active = false;
  }

  updatePlayerCount(count: number): void {
    this._playerCountLabel.string = `${count}/5 人已加入`;
    if (count >= 5) this._navigateToGame();
  }

  async onCancelClick(): Promise<void> {
    await this._leaveRoom();
    this._rootNode.active = false;
    this._navigateToHall();
  }

  // ─── 好友房 — 创建 ───────────────────────────────────────────────────────

  async onCreateRoomClick(): Promise<void> {
    const result = await this._joinRoom('game', { mode: 'friend' });
    this._roomCode                   = result.roomCode ?? '';
    this._roomCodeLabel.string       = this._roomCode;
    this._roomCodeLabel.node.active  = true;
    this._copyBtn.node.active        = true;
  }

  onCopyCodeClick(): void {
    if (this._roomCode) this._clipboard.copy(this._roomCode);
  }

  // ─── 好友房 — 加入 ───────────────────────────────────────────────────────

  setRoomCodeInput(code: string): void {
    this._roomCodeInput = this.filterRoomCode(code);
  }

  async onJoinRoomClick(): Promise<void> {
    await this._joinRoom('game', { roomCode: this._roomCodeInput });
  }

  /** AC-14: 过滤非数字字符 */
  filterRoomCode(input: string): string {
    return input.replace(/\D/g, '');
  }

  onMatchError(code: number): void {
    const msg = code === 2002 ? '房间不存在，请检查房间码'
               : code === 2001 ? '房间已满'
               : `匹配错误 (${code})`;
    this._errorLabel.string      = msg;
    this._errorLabel.node.active = true;
  }

  private _reset(): void {
    this._roomCode                   = '';
    this._roomCodeLabel.string       = '';
    this._roomCodeLabel.node.active  = false;
    this._errorLabel.string          = '';
    this._errorLabel.node.active     = false;
    this._playerCountLabel.string    = '';
  }
}
