/**
 * @file HallSceneManager.ts
 * @description 大厅场景 Manager：将 @property 节点引用注入 HallView + MatchView，并接 oops 事件路由。
 *              挂载到 HallScene 根节点上；所有节点/Label/Button 在 CC 编辑器里拖拽连线。
 * @module client/scenes
 */

import {
    _decorator, Component, Label, Button, Node, director, sys,
} from 'cc';
import { message } from 'db://oops-framework/core/common/event/MessageManager';
import { HallView, HallPlayerInfo } from '../ui/HallView';
import { MatchView } from '../ui/MatchView';
import { netManager } from '../net/NetManager';

const { ccclass, property } = _decorator;

const API_ENDPOINT = 'ws://localhost:2567';
const CACHE_KEY_USER = 'ddz_user';

@ccclass('HallSceneManager')
export class HallSceneManager extends Component {

    // ── HallView 节点 ─────────────────────────────────────────────────────────
    @property(Label)  nicknameLabel!: Label;
    @property(Label)  scoreLabel!: Label;
    @property(Label)  rankLabel!: Label;
    @property(Button) quickMatchBtn!: Button;
    @property(Button) friendRoomBtn!: Button;

    // ── MatchView 共用节点 ────────────────────────────────────────────────────
    @property(Node)   matchRootNode!: Node;
    @property(Label)  statusLabel!: Label;
    @property(Label)  playerCountLabel!: Label;
    @property(Label)  roomCodeLabel!: Label;
    @property(Node)   copyBtnNode!: Node;
    @property(Label)  matchErrorLabel!: Label;

    // ── MatchView TASK-029c: 快速匹配 AI 补位倒计时 ───────────────────────────
    @property(Node)   aiCountdownNode!: Node;    // AI 补位倒计时整体区域（可隐藏）
    @property(Label)  aiCountdownLabel!: Label;  // 「X 秒后 AI 补位」/「AI 补位中…」
    @property(Button) cancelBtn!: Button;        // 取消匹配按钮

    // ── MatchView TASK-030c: 好友房等待室 ────────────────────────────────────
    // 5 个席位占位标签（顺序与服务端 seatIndex 对应）
    @property([Label]) playerListLabels: Label[] = [];
    @property(Button)  startGameBtn!: Button;    // 仅房主可见
    @property(Node)    startGameBtnNode!: Node;
    @property(Label)   ownerHintLabel!: Label;   // 「等待房主开始…」
    @property(Node)    ownerHintNode!: Node;
    @property(Button)  shareBtn!: Button;        // 分享房间码
    @property(Node)    shareBtnNode!: Node;

    // ── 好友房操作按钮 ────────────────────────────────────────────────────────
    @property(Button) createRoomBtn!: Button;
    @property(Button) joinRoomBtn!: Button;

    private _net = netManager;
    private _matchView!: MatchView;

    onLoad() {
        this._net.init(API_ENDPOINT);
        this._net.setToken(sys.localStorage.getItem('ddz_token'));

        const matchView = this._buildMatchView();
        const hallView  = this._buildHallView(matchView);
        this._matchView = matchView;

        // 路由服务端等待状态消息到 MatchView（NetManager 已将 Colyseus 消息转发为 oops 事件）
        message.on('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.on('ROOM_UPDATE',    this._onRoomUpdate,    this);
        // 进入 dealing 后通知 MatchView 禁用取消按钮
        message.on('STATE',          this._onState,         this);

        const raw  = sys.localStorage.getItem(CACHE_KEY_USER);
        const info: HallPlayerInfo | null = raw ? JSON.parse(raw) : null;
        hallView.show(info);
    }

    onDestroy() {
        message.off('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.off('ROOM_UPDATE',    this._onRoomUpdate,    this);
        message.off('STATE',          this._onState,         this);
    }

    // ── oops 事件处理 ─────────────────────────────────────────────────────────

    private _onWaitingUpdate(_event: string, msg: any) {
        this._matchView.onWaitingUpdate(msg);
    }

    private _onRoomUpdate(_event: string, msg: any) {
        this._matchView.onRoomUpdate(msg);
    }

    private _onState(_event: string, state: any) {
        if (state.phase === 'dealing') {
            this._matchView.onGameStarted();
            // dealing 开始后 MatchView 已禁用取消；跳转由 STATE dealing → GameScene 触发
        }
    }

    // ── 构建逻辑实例 ─────────────────────────────────────────────────────────

    private _buildMatchView(): MatchView {
        const v = new MatchView();

        // 基础节点（Label 直接赋值，写 .string 即刻生效）
        v._rootNode         = this.matchRootNode;
        v._statusLabel      = this.statusLabel;
        v._playerCountLabel = this.playerCountLabel;
        v._roomCodeLabel    = { string: this.roomCodeLabel.string, node: this.roomCodeLabel.node };
        v._copyBtn          = { node: this.copyBtnNode };
        v._errorLabel       = this.matchErrorLabel;

        // TASK-029c
        v._aiCountdownNode  = this.aiCountdownNode;
        v._aiCountdownLabel = this.aiCountdownLabel;
        v._cancelBtn        = this.cancelBtn;

        // TASK-030c
        v._playerListLabels = this.playerListLabels;
        v._startGameBtn     = this.startGameBtn;
        v._ownerHintLabel   = { string: this.ownerHintLabel.string, node: this.ownerHintNode };
        v._shareBtn         = { node: this.shareBtnNode };

        // 注入依赖
        v._joinRoom = async (name, options) => {
            await this._net.joinRoom(name, options);
            // roomCode 在服务端 room state 里；由 ROOM_UPDATE 消息推送，此处返回空
            return {};
        };
        v._leaveRoom        = () => this._net.leaveRoom();
        v._navigateToGame   = () => director.loadScene('GameScene');
        v._navigateToHall   = () => v.hide();
        v._forceStart       = () => this._net.forceStart();
        v._sharePlatform    = async (text: string) => {
            // 微信小程序
            if ((globalThis as any).wx?.shareAppMessage) {
                (globalThis as any).wx.shareAppMessage({ title: text });
                return;
            }
            // H5 原生 Share API
            if ((navigator as any)?.share) {
                await (navigator as any).share({ text });
                return;
            }
            // 降级：复制到剪贴板
            (sys as any).copyTextToClipboard?.(text);
        };
        v._clipboard = {
            copy: (t) => (sys as any).copyTextToClipboard?.(t),
        };

        return v;
    }

    private _buildHallView(matchView: MatchView): HallView {
        const v = new HallView();

        v._nicknameLabel = this.nicknameLabel;
        v._scoreLabel    = this.scoreLabel;
        v._rankLabel     = this.rankLabel;
        v._rootNode      = { active: true };   // HallRoot 默认可见
        v._quickMatchBtn = this.quickMatchBtn;
        v._friendRoomBtn = this.friendRoomBtn;

        v._matchView       = matchView;
        v._navigateToLogin = () => director.loadScene('LaunchScene');

        return v;
    }

    // ── Button Click 代理（在编辑器 Button ClickEvents 里选择这里的方法）─────

    onQuickMatchClick()  { this._matchView.showQuickMatch();       }
    onFriendRoomClick()  { this._matchView.showFriendRoom();       }
    onCreateRoomClick()  { this._matchView.onCreateRoomClick();    }
    onJoinRoomClick()    { this._matchView.onJoinRoomClick();      }
    onCancelMatchClick() { this._matchView.onCancelClick();        }
    onCopyCodeClick()    { this._matchView.onCopyCodeClick();      }
    onForceStartClick()  { this._matchView.onForceStartClick();    }
    onShareClick()       { this._matchView.onShareClick();         }
}
