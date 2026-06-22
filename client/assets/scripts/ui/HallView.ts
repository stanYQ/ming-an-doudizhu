/**
 * @file HallView.ts
 * @description 主大厅：玩家信息展示、快速匹配/好友房入口、音效设置。
 * @module client/ui
 */

export interface HallPlayerInfo {
  nickname:  string;
  avatarUrl: string;
  score:     number;
  rankLevel: string;
}

export class HallView {
  // 由 Cocos 场景绑定注入（测试中传入 stub 对象）
  _nicknameLabel: { string: string }        = { string: '' };
  _scoreLabel:    { string: string }        = { string: '' };
  _rankLabel:     { string: string }        = { string: '' };
  _rootNode:      { active: boolean }       = { active: false };
  _quickMatchBtn: { interactable: boolean } = { interactable: true };
  _friendRoomBtn: { interactable: boolean } = { interactable: true };

  /** 跳转登录页，由场景装配脚本注入（info 为 null 时调用）。 */
  _navigateToLogin: () => void = () => {};
  /** MatchView 实例，由场景装配脚本注入。 */
  _matchView: { showQuickMatch(): void; showFriendRoom(): void } | null = null;

  private _audioEnabled = true;

  /**
   * 展示大厅主界面。
   * 注意：info 为 null 表示无有效登录信息，立即跳转登录页；不在此处弹错误。
   * @param info 从 localStorage 读取的玩家信息，无效或过期时传 null
   */
  show(info: HallPlayerInfo | null): void {
    if (!info) {
      this._navigateToLogin();
      return;
    }
    this._nicknameLabel.string = info.nickname;
    this._scoreLabel.string    = String(info.score);
    this._rankLabel.string     = info.rankLevel;
    this._rootNode.active      = true;
  }

  /** 隐藏大厅根节点。 */
  hide(): void {
    this._rootNode.active = false;
  }

  /** 快速匹配按钮回调，委托 MatchView 处理。 */
  onQuickMatchClick(): void {
    this._matchView?.showQuickMatch();
  }

  /** 好友房按钮回调，委托 MatchView 处理。 */
  onFriendRoomClick(): void {
    this._matchView?.showFriendRoom();
  }

  /**
   * 音效设置按钮回调（本地状态翻转，不上报服务端）。
   */
  onSettingsClick(): void {
    this._audioEnabled = !this._audioEnabled;
  }

  /** 返回当前音效开关状态。 */
  getAudioEnabled(): boolean { return this._audioEnabled; }
}
