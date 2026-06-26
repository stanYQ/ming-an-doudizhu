/**
 * @file HallCtrl.ts
 * @description 主大厅 Controller：持有场景节点引用，将 HallLogic 的 onRender 事件转化为节点操作。
 *              AC-arch-4: message 处理函数内无业务判断，均委托 _hallLogic。
 * @module client/ui/ctrl
 */

import {
    _decorator, Component, Label, Button, Node, sys, director,
} from 'cc';
import { oops }        from 'db://oops-framework/core/Oops';
import { HallLogic }   from '../../logic/HallLogic';
import { netManager }  from '../../net/NetManager';
import { MatchView }   from '../view/MatchView';

const { ccclass, property } = _decorator;

@ccclass('HallCtrl')
export class HallCtrl extends Component {

    // ── 顶部栏 ─────────────────────────────────────────────────────────────────
    @property(Label)  nicknameLabel!: Label;
    @property(Label)  scoreLabel!:    Label;
    @property(Label)  rankLabel!:     Label;

    // ── 主操作按钮 ─────────────────────────────────────────────────────────────
    @property(Button) quickMatchBtn!: Button;
    @property(Button) friendRoomBtn!: Button;

    // ── 功能宫格 ───────────────────────────────────────────────────────────────
    @property(Button) rulesBtn!:      Button;
    @property([Button]) featureBtns:  Button[] = [];   // 签到/活动/排行榜（灰色）

    // ── MatchView（默认隐藏） ──────────────────────────────────────────────────
    @property(Node)   matchRootNode!:    Node;
    @property(Label)  statusLabel!:      Label;
    @property(Label)  playerCountLabel!: Label;
    @property(Label)  roomCodeLabel!:    Label;
    @property(Node)   copyBtnNode!:      Node;
    @property(Label)  matchErrorLabel!:  Label;
    @property(Node)   aiCountdownNode!:  Node;
    @property(Label)  aiCountdownLabel!: Label;
    @property(Button) cancelBtn!:        Button;
    @property([Label]) playerListLabels: Label[] = [];
    @property(Button) startGameBtn!:     Button;
    @property(Node)   startGameBtnNode!: Node;
    @property(Label)  ownerHintLabel!:   Label;
    @property(Node)   ownerHintNode!:    Node;
    @property(Button) shareBtn!:         Button;
    @property(Node)   shareBtnNode!:     Node;
    @property(Button) createRoomBtn!:    Button;
    @property(Button) joinRoomBtn!:      Button;

    // ── Toast（P0 手写实现） ───────────────────────────────────────────────────
    @property(Node)   toastNode!:  Node;
    @property(Label)  toastLabel!: Label;

    // ── 网络断线横幅 ───────────────────────────────────────────────────────────
    @property(Node)   networkBanner!: Node;

    private _net        = netManager;
    private _hallLogic!: HallLogic;
    private _matchView!: MatchView;

    onLoad() {
        this._net.init('ws://localhost:2567');
        this._net.setToken(oops.storage?.get('ddz_token') ?? null);

        this._hallLogic = new HallLogic(this._net);
        this._hallLogic.onRender = (e, d) => this._render(e, d);
        this._hallLogic.init();

        this._matchView = this._buildMatchView();

        // 从 oops.storage 读取玩家信息，直接更新顶栏节点（非服务端 push，无需经过 logic）
        const info = oops.storage?.getJson?.('ddz_user', null) as
            { nickname?: string; score?: number; rankLevel?: string } | null;
        if (info) {
            if (this.nicknameLabel) this.nicknameLabel.string = info.nickname ?? '';
            if (this.scoreLabel)    this.scoreLabel.string    = String(info.score ?? 0);
            if (this.rankLabel)     this.rankLabel.string     = info.rankLevel ?? '';
        }
    }

    onDestroy() {
        this._hallLogic?.destroy();
    }

    // ── onRender（只做节点操作，无业务判断） ──────────────────────────────────

    private _render(event: string, data: any): void {
        switch (event) {
            case 'WAITING':
                this._matchView.onWaitingUpdate(data);
                break;
            case 'ROOM':
                this._matchView.onRoomUpdate(data);
                break;
            case 'GAME_STARTED':
                director.loadScene('GameScene');
                break;
        }
    }

    // ── Button Click 代理 ──────────────────────────────────────────────────────

    onQuickMatchClick()  { this._matchView.showQuickMatch();    }
    onFriendRoomClick()  { this._matchView.showFriendRoom();    }
    onCreateRoomClick()  { this._matchView.onCreateRoomClick(); }
    onJoinRoomClick()    { this._matchView.onJoinRoomClick();   }
    onCancelMatchClick() { this._matchView.onCancelClick();     }
    onCopyCodeClick()    { this._matchView.onCopyCodeClick();   }
    onForceStartClick()  { this._matchView.onForceStartClick(); }
    onShareClick()       { this._matchView.onShareClick();      }

    onRulesClick() {
        // RulesView 由编辑器节点控制，Ctrl 直接设置 active
        const rulesNode = this.node.getChildByName('RulesView');
        if (rulesNode) rulesNode.active = true;
    }

    onFeatureGridClick() {
        this._showToast('功能即将上线');
    }

    // ── 内部工具 ───────────────────────────────────────────────────────────────

    private _buildMatchView(): MatchView {
        const v = new MatchView();
        v._rootNode         = this.matchRootNode;
        v._statusLabel      = this.statusLabel;
        v._playerCountLabel = this.playerCountLabel;
        v._roomCodeLabel    = { string: this.roomCodeLabel?.string ?? '', node: this.roomCodeLabel?.node };
        v._copyBtn          = { node: this.copyBtnNode };
        v._errorLabel       = this.matchErrorLabel;
        v._aiCountdownNode  = this.aiCountdownNode;
        v._aiCountdownLabel = this.aiCountdownLabel;
        v._cancelBtn        = this.cancelBtn;
        v._playerListLabels = this.playerListLabels;
        v._startGameBtn     = this.startGameBtn;
        v._ownerHintLabel   = { string: this.ownerHintLabel?.string ?? '', node: this.ownerHintNode };
        v._shareBtn         = { node: this.shareBtnNode };

        v._joinRoom     = async (name, options) => { await this._net.joinRoom(name, options); return {}; };
        v._leaveRoom    = () => this._net.leaveRoom();
        v._navigateToGame  = () => director.loadScene('GameScene');
        v._navigateToHall  = () => v.hide();
        v._forceStart      = () => this._net.forceStart();
        v._sharePlatform   = async (text) => {
            if ((globalThis as any).wx?.shareAppMessage) {
                (globalThis as any).wx.shareAppMessage({ title: text });
                return;
            }
            if ((navigator as any)?.share) { await (navigator as any).share({ text }); return; }
            sys.copyTextToClipboard(text);
        };
        v._clipboard = { copy: (t) => sys.copyTextToClipboard(t) };
        return v;
    }

    /** 多场景架构下 oops gui 层未初始化，自行实现轻量 Toast。 */
    private _showToast(msg: string, duration = 2000) {
        if (!this.toastNode || !this.toastLabel) return;
        this.toastLabel.string = msg;
        this.toastNode.active  = true;
        // opacity Tween（简单淡入淡出）
        const n = this.toastNode;
        n.setScale(1, 1, 1);
        this.scheduleOnce(() => { n.active = false; }, duration / 1000);
    }
}
