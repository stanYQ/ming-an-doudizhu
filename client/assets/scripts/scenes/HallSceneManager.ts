/**
 * @file HallSceneManager.ts
 * @description 大厅场景 Manager：将 HallView + MatchView 与 Cocos 节点/NetManager 接线。
 *              挂载到 HallScene 的根节点 HallRoot 上。
 * @module client/scenes
 */

import {
    _decorator, Component, Label, Button, Node, director, sys,
} from 'cc';
import { HallView, HallPlayerInfo } from '../ui/HallView';
import { MatchView } from '../ui/MatchView';
import { NetManager } from '../net/NetManager';

const { ccclass, property } = _decorator;

const API_ENDPOINT = 'ws://localhost:2567';
const CACHE_KEY_USER = 'ddz_user';

@ccclass('HallSceneManager')
export class HallSceneManager extends Component {

    // ── HallView 节点引用 ──────────────────────────────────────────────────
    @property(Label)  nicknameLabel!: Label;
    @property(Label)  scoreLabel!: Label;
    @property(Label)  rankLabel!: Label;
    @property(Button) quickMatchBtn!: Button;
    @property(Button) friendRoomBtn!: Button;

    // ── MatchView 节点引用 ─────────────────────────────────────────────────
    @property(Label)  statusLabel!: Label;
    @property(Label)  playerCountLabel!: Label;
    @property(Label)  roomCodeLabel!: Label;
    @property(Node)   roomCodeNode!: Node;
    @property(Node)   copyBtnNode!: Node;
    @property(Label)  matchErrorLabel!: Label;
    @property(Node)   matchErrorNode!: Node;
    @property(Node)   matchRootNode!: Node;

    private _netManager = new NetManager();
    private _matchView!: MatchView;

    onLoad() {
        this._netManager.init(API_ENDPOINT);

        const matchView = this._buildMatchView();
        const hallView  = this._buildHallView(matchView);

        this._matchView = matchView;

        // 读缓存，没有则跳登录
        const raw = sys.localStorage.getItem(CACHE_KEY_USER);
        const info: HallPlayerInfo | null = raw ? JSON.parse(raw) : null;
        hallView.show(info);
    }

    private _buildMatchView(): MatchView {
        const v = new MatchView();

        v._statusLabel      = { string: this.statusLabel.string };
        v._playerCountLabel = { string: this.playerCountLabel.string };
        v._roomCodeLabel    = { string: this.roomCodeLabel.string, node: this.roomCodeNode };
        v._copyBtn          = { node: this.copyBtnNode };
        v._errorLabel       = { string: this.matchErrorLabel.string, node: this.matchErrorNode };
        v._rootNode         = { active: false };

        v._joinRoom = (name, options) => this._netManager.joinRoom(name, options)
            .then(() => ({})); // NetManager.joinRoom returns void; roomCode via state

        v._leaveRoom      = async () => { /* colyseus room leave handled in NetManager */ };
        v._navigateToGame = () => director.loadScene('GameScene');
        v._navigateToHall = () => this._onReturnToHall();

        v._clipboard = {
            copy: (text) => {
                // sys.copyTextToClipboard 在 Cocos 3.8 可用
                (sys as any).copyTextToClipboard?.(text);
            },
        };

        // ── 按钮监听 ───────────────────────────────────────────────────────
        // （在 HallScene 里将这些 Button 的 Click Event 指向这里的方法）

        return v;
    }

    private _buildHallView(matchView: MatchView): HallView {
        const v = new HallView();

        v._nicknameLabel = { string: this.nicknameLabel.string };
        v._scoreLabel    = { string: this.scoreLabel.string };
        v._rankLabel     = { string: this.rankLabel.string };
        v._rootNode      = { active: false };
        v._quickMatchBtn = this.quickMatchBtn;
        v._friendRoomBtn = this.friendRoomBtn;

        v._matchView       = matchView;
        v._navigateToLogin = () => director.loadScene('LaunchScene');

        return v;
    }

    private _onReturnToHall() {
        this._matchView.hide();
    }

    // ── Cocos Button Click 事件（在编辑器里把这些方法绑到 Button 的 Click 事件上）──

    onQuickMatchClick()  { this._matchView.showQuickMatch();  }
    onFriendRoomClick()  { this._matchView.showFriendRoom();  }
    onCreateRoomClick()  { this._matchView.onCreateRoomClick(); }
    onJoinRoomClick()    { this._matchView.onJoinRoomClick();   }
    onCancelMatchClick() { this._matchView.onCancelClick();     }
    onCopyCodeClick()    { this._matchView.onCopyCodeClick();   }
}
