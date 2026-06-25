/**
 * @file MatchView.ts
 * @description 匹配弹窗：快速匹配等待 + 好友房创建/加入，凑满5人自动进游戏桌。
 *              V2 扩展：支持 waiting_update（AI 补位倒计时）和 room_update（好友房人员列表）。
 * @module client/ui
 */

// TASK-029c: 快速匹配等待状态推送
export interface WaitingUpdateMsg {
    readyCount: number;
    total:      number;
    aiSeconds:  number;
}

// TASK-030c: 好友房人员列表推送
export interface RoomPlayerSlot {
    seatIndex: number;
    nickname:  string;
    avatarUrl: string;
    isReady:   boolean;
}

export interface RoomUpdateMsg {
    players:        RoomPlayerSlot[];
    ownerSeatIndex: number;
}

export class MatchView {
  // 由 Cocos 场景绑定注入（测试中传入 stub 对象）
  _statusLabel:      { string: string }                            = { string: '' };
  _playerCountLabel: { string: string }                            = { string: '' };
  _roomCodeLabel:    { string: string; node: { active: boolean } } = { string: '', node: { active: false } };
  _copyBtn:          { node: { active: boolean } }                 = { node: { active: false } };
  _errorLabel:       { string: string; node: { active: boolean } } = { string: '', node: { active: false } };
  _rootNode:         { active: boolean }                           = { active: false };

  // TASK-029c: AI 补位倒计时区域（AC-8~11）
  _aiCountdownNode:  { active: boolean } = { active: false };
  _aiCountdownLabel: { string: string }  = { string: '' };
  _cancelBtn:        { interactable: boolean } = { interactable: true };

  // TASK-030c: 好友房等待室（AC-9~16）
  _playerListLabels: Array<{ string: string }> = [];
  _startGameBtn:     { interactable: boolean; node: { active: boolean } } = { interactable: false, node: { active: false } };
  _ownerHintLabel:   { string: string; node: { active: boolean } }        = { string: '', node: { active: false } };
  _shareBtn:         { node: { active: boolean } }                        = { node: { active: false } };

  /** joinOrCreate 封装，由场景装配脚本注入（实际调用 NetManager.joinRoom）。 */
  _joinRoom:       (name: string, options: any) => Promise<{ roomCode?: string }> = () => Promise.resolve({});
  /** 离开房间，由场景装配脚本注入。 */
  _leaveRoom:      () => Promise<void>   = () => Promise.resolve();
  /** 跳转游戏桌，由场景装配脚本注入（director.loadScene('GameScene')）。 */
  _navigateToGame: () => void            = () => {};
  /** 返回大厅（关闭弹窗），由场景装配脚本注入。 */
  _navigateToHall: () => void            = () => {};
  /** 剪贴板，由场景装配脚本注入（CC 版用 sys.copyTextToClipboard）。 */
  _clipboard:      { copy(text: string): void } = { copy: () => {} };
  /** 房主强制开局，由场景装配脚本注入（调用 NetManager.forceStart）。 */
  _forceStart:     () => void = () => {};
  /**
   * 平台分享 API，由场景装配脚本注入。
   * 微信：wx.shareAppMessage；H5：navigator.share；均不可用时复制到剪贴板。
   */
  _sharePlatform:  (text: string) => Promise<void> = async () => {};
  /** 本机席位（由 setConnected 注入），用于判断是否是房主。 */
  _mySeatIndex:    number = -1;

  private _roomCode = '';
  private _roomCodeInput = '';
  private _gameStarted = false;
  private _joining = false;

  /**
   * 显示弹窗并立即发起快速匹配请求。
   * 注意：成功加入房间后等待服务端 player_count 推送，凑满5人后 updatePlayerCount 自动跳转。
   */
  async showQuickMatch(): Promise<void> {
    await this._withJoining(async () => {
      this._reset();
      this._rootNode.active = true;
      await this._joinRoom('game', { mode: 'quick' });
    });
  }

  /**
   * 显示好友房弹窗（不自动加入，等待玩家选择创建或加入）。
   */
  async showFriendRoom(): Promise<void> {
    this._reset();
    this._rootNode.active = true;
  }

  /** 隐藏匹配弹窗。 */
  hide(): void {
    this._rootNode.active = false;
  }

  /**
   * 更新已加入人数显示；达到5人时自动跳转游戏桌。
   * @param count 当前房间人数
   */
  updatePlayerCount(count: number): void {
    this._playerCountLabel.string = `${count}/5 人已加入`;
    if (count >= 5) this._navigateToGame();
  }

  /**
   * 取消匹配并返回大厅（离开房间后关闭弹窗）。
   * AC-11: 若已进入 dealing 阶段，取消按钮禁用，此方法无效。
   */
  async onCancelClick(): Promise<void> {
    if (this._gameStarted) return;
    await this._leaveRoom();
    this._rootNode.active = false;
    this._navigateToHall();
  }

  // ─── TASK-029c: 快速匹配 AI 补位（AC-8~11）────────────────────────────────

  /**
   * 收到服务端 waiting_update 时更新人数和 AI 补位倒计时。
   * AC-8: 更新「X/5 人」；AC-9: 归零时显示「AI 补位中…」；AC-10: 满员时隐藏倒计时区域。
   * @param msg 服务端推送的等待状态
   */
  onWaitingUpdate(msg: WaitingUpdateMsg): void {
    this._playerCountLabel.string = `${msg.readyCount}/${msg.total} 人已加入`;
    if (msg.readyCount >= msg.total) {
      this._aiCountdownNode.active = false;
      return;
    }
    this._aiCountdownNode.active  = true;
    this._aiCountdownLabel.string = msg.aiSeconds > 0
      ? `${msg.aiSeconds} 秒后 AI 补位`
      : 'AI 补位中…';
  }

  /**
   * 收到 STATE phase=dealing 时由控制器调用，禁用取消按钮（AC-11）。
   */
  onGameStarted(): void {
    this._gameStarted = true;
    this._cancelBtn.interactable = false;
  }

  // ─── 好友房 — 创建 ───────────────────────────────────────────────────────

  /**
   * 创建好友房并展示房间码（供房主复制分享）。
   */
  async onCreateRoomClick(): Promise<void> {
    await this._withJoining(async () => {
      const result = await this._joinRoom('game', { mode: 'friend' });
      this._roomCode                   = result.roomCode ?? '';
      this._roomCodeLabel.string       = this._roomCode;
      this._roomCodeLabel.node.active  = true;
      this._copyBtn.node.active        = true;
    });
  }

  /** 复制房间码到剪贴板（无房间码时静默忽略）。 */
  onCopyCodeClick(): void {
    if (this._roomCode) this._clipboard.copy(this._roomCode);
  }

  // ─── 好友房 — 加入 ───────────────────────────────────────────────────────

  /**
   * 更新房间码输入（自动过滤非数字字符）。
   * @param code 原始输入字符串
   */
  setRoomCodeInput(code: string): void {
    this._roomCodeInput = this.filterRoomCode(code);
  }

  /** 用当前输入的房间码加入好友房。 */
  async onJoinRoomClick(): Promise<void> {
    await this._joinRoom('game', { roomCode: this._roomCodeInput });
  }

  /**
   * 过滤房间码输入，只保留数字字符。
   * @param input 原始输入
   * @returns 纯数字字符串
   */
  filterRoomCode(input: string): string {
    return input.replace(/\D/g, '');
  }

  /**
   * 展示服务端返回的匹配错误信息。
   * @param code 错误码：2001=房间已满，2002=房间不存在，2003=人数不足无法开局
   */
  onMatchError(code: number): void {
    const msg = code === 2002 ? '房间不存在，请检查房间码'
               : code === 2001 ? '房间已满'
               : code === 2003 ? '至少需要2名真实玩家才能开局'
               : `匹配错误 (${code})`;
    this._errorLabel.string      = msg;
    this._errorLabel.node.active = true;
  }

  // ─── TASK-030c: 好友房等待室（AC-9~16）──────────────────────────────────

  /**
   * 收到服务端 room_update 时更新人员列表和开始按钮状态。
   * AC-9: 已进房玩家显示昵称，空席显示「等待加入…」。
   * AC-10: 本机是房主 → 显示「开始游戏」按钮；人数≥2 时可点击。
   * AC-12: 非房主 → 显示「等待房主开始…」。
   * @param msg 服务端推送的房间状态
   */
  onRoomUpdate(msg: RoomUpdateMsg): void {
    const filledNicknames = msg.players.map(p => p.nickname || '等待加入…');
    for (let i = 0; i < 5; i++) {
      if (this._playerListLabels[i]) {
        this._playerListLabels[i].string = filledNicknames[i] ?? '等待加入…';
      }
    }
    const isOwner = msg.ownerSeatIndex === this._mySeatIndex;
    this._startGameBtn.node.active   = isOwner;
    this._ownerHintLabel.node.active = !isOwner;
    if (isOwner) {
      this._startGameBtn.interactable = msg.players.length >= 2;
    }
    if (this._roomCode) this._shareBtn.node.active = true;
  }

  /**
   * 房主点击「开始游戏」，发送 force_start（AC-11）。
   */
  onForceStartClick(): void {
    this._forceStart();
  }

  /**
   * 点击「分享」按钮，调用平台分享 API（AC-14/15/16）。
   * 分享失败静默处理。
   */
  async onShareClick(): Promise<void> {
    if (!this._roomCode) return;
    const text = `我在玩明暗斗地主，房间码：${this._roomCode}，快来加入！`;
    try {
      await this._sharePlatform(text);
    } catch {
      // AC-16: 分享失败（用户取消或 API 不支持）静默处理
    }
  }

  private async _withJoining(fn: () => Promise<void>): Promise<void> {
    if (this._joining) return;
    this._joining = true;
    try { await fn(); } finally { this._joining = false; }
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
