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
  _nicknameLabel: { string: string }      = { string: '' };
  _scoreLabel:    { string: string }      = { string: '' };
  _rankLabel:     { string: string }      = { string: '' };
  _rootNode:      { active: boolean }     = { active: false };
  _quickMatchBtn: { interactable: boolean } = { interactable: true };
  _friendRoomBtn: { interactable: boolean } = { interactable: true };

  _navigateToLogin: () => void = () => {};
  _matchView: { showQuickMatch(): void; showFriendRoom(): void } | null = null;

  private _audioEnabled = true;

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

  hide(): void {
    this._rootNode.active = false;
  }

  onQuickMatchClick(): void {
    this._matchView?.showQuickMatch();
  }

  onFriendRoomClick(): void {
    this._matchView?.showFriendRoom();
  }

  onSettingsClick(): void {
    // AC-6: 仅本地翻转，不上报服务端
    this._audioEnabled = !this._audioEnabled;
  }

  getAudioEnabled(): boolean { return this._audioEnabled; }
}
