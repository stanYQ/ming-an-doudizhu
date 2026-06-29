/**
 * @file GameCtrl.ts
 * @description 游戏桌面板 Controller：将 @property 节点引用注入各 UI 视图，持有 GameMgr 实例，
 *              通过 onRender 回调响应业务事件执行 CC 节点操作。
 * @module client/ui/ctrl
 */

import {
    _decorator, Component, Label, Button, Node, director,
} from 'cc';
import { GameMgr }           from '../../logic/GameMgr';
import { SettlementLogic }   from '../../logic/SettlementLogic';
import { netManager }        from '../../net/NetManager';
import { HandCardView }      from '../view/HandCardView';
import { PlayZone }          from '../view/PlayZone';
import { PlayerSeat }        from '../view/PlayerSeat';
import { CodeCardSelector, CodeCardChoice } from '../view/CodeCardSelector';
import { SettlementView }    from '../view/SettlementView';
import { DoublingView }      from '../view/DoublingView';

const { ccclass, property } = _decorator;

@ccclass('GameCtrl')
export class GameCtrl extends Component {

    // ── HandCardView ─────────────────────────────────────────────────────────
    @property(Button) playButton!:    Button;  // 出牌按钮，选牌合法时 interactable=true
    @property(Label)  patternLabel!:  Label;   // 当前选牌牌型名称，如「顺子」「炸弹」

    // ── PlayZone ─────────────────────────────────────────────────────────────
    @property(Button) playBtn!:        Button;  // 出牌确认（PlayZone 内，与 playButton 联动）
    @property(Button) passBtn!:        Button;  // 不出 / 跳过
    @property(Label)  playErrorLabel!: Label;   // 出牌非法原因，如「不能小于上家」
    @property(Label)  timerLabel!:     Label;   // 当前回合剩余秒数

    // ── 5 个席位根节点 ────────────────────────────────────────────────────────
    // index 0=自己，1=左邻，2=左对，3=右对，4=右邻（顺时针）
    @property([Node]) seatNodes: Node[] = [];

    // ── CodeCardSelector ─────────────────────────────────────────────────────
    @property(Node)   codeSelectorRoot!: Node;    // 暗号牌选择弹窗根节点
    @property(Button) confirmCodeBtn!:   Button;  // 确认暗号牌，点击后弹窗关闭

    // ── SettlementView ────────────────────────────────────────────────────────
    @property(Node)   settlementRoot!:      Node;    // 结算面板根节点，game_over 后显示
    @property(Label)  bannerLabel!:         Label;   // 「胜利」或「失败」横幅
    @property(Button) playAgainBtn!:        Button;  // 再来一局
    @property(Button) returnHallBtn!:       Button;  // 返回大厅
    @property(Label)  rematchStatusLabel!:  Label;   // 「等待 X / 5 人…」再来一局状态

    // ── DoublingView ─────────────────────────────────────────────────────────
    @property(Node)   doublingRoot!:        Node;    // 加倍阶段面板根节点
    @property(Label)  doublingTimerLabel!:  Label;   // 加倍操作倒计时剩余秒数
    @property(Label)  doublingStatusLabel!: Label;   // 「请选择是否加倍」等提示
    @property(Button) doublingSingleBtn!:   Button;  // 单倍（不加倍）
    @property(Button) doublingDoubleBtn!:   Button;  // 双倍（加倍）
    @property(Label)  doublingResultLabel!: Label;   // 本局最终加倍倍率，如「×4」

    private _net      = netManager;
    private _mgr!:    GameMgr;
    private _settlLogic!: SettlementLogic;

    // AC-17: 所有 UI 视图实例保留在 Ctrl
    private _handCardView!:   HandCardView;
    private _playZone!:       PlayZone;
    private _seats!:          PlayerSeat[];
    private _codeSelector!:   CodeCardSelector;
    private _settlementView!: SettlementView;
    private _doublingView!:   DoublingView;

    onLoad() {
        this._handCardView   = this._buildHandCardView();
        this._playZone       = this._buildPlayZone();
        this._seats          = this._buildSeats();
        this._codeSelector   = this._buildCodeSelector();
        this._settlementView = this._buildSettlementView();
        this._doublingView   = this._buildDoublingView();

        this._mgr = new GameMgr(this._net);

        // AC-19: 注册 onRender 回调，在回调内操作 CC 节点，不含业务判断
        this._mgr.onRender = (event, data) => this._render(event, data);

        this._mgr.init();

        const room = this._net.room;
        if (room) {
            const mySessionId = room.sessionId as string;
            const myPlayer    = (room.state?.players as any)?.get?.(mySessionId);
            const mySeatIndex = (myPlayer?.seatIndex as number) ?? -1;
            this._mgr.setConnected(mySeatIndex, mySessionId);
        }
    }

    onDestroy() {
        this._mgr?.destroy();
    }

    // ── onRender 回调（只做节点操作）────────────────────────────────────────

    private _render(event: string, data: any): void {
        switch (event) {
            case 'HAND':
                this._handCardView.render(data.cards);
                break;
            case 'BOTTOM_CARDS':
                this._handCardView.showBottomCards?.(data.cards);
                break;
            case 'HINT':
                this._playZone.showHint?.(data.cards);
                break;
            case 'TURN':
                this._playZone.setPlayButtonEnabled(data.isMyTurn);
                this._playZone.setPassButtonEnabled(data.isMyTurn && !data.isNewRound);
                if (data.isMyTurn) this._playZone.startCountdown(data.deadline);
                break;
            case 'REVEAL':
                this._seats.forEach(s => s?.showIdentity(data.playerId, data.role));
                break;
            case 'OVER':
                this._settlementView.showResult(data);
                break;
            case 'STATE':
                this._renderState(data);
                break;
            case 'DOUBLING_START':
                this._doublingView._onSetDouble = (v: 1 | 2) => this._mgr.setDouble(v);
                this._doublingView.show(data);
                break;
            case 'LANDLORD_DOUBLED':
                this._doublingView.onLandlordDoubled(data);
                break;
            case 'DOUBLING_RESULT':
                this._doublingView.onResult(data);
                break;
            case 'REMATCH_UPDATE':
                this._settlementView.onRematchUpdate(data);
                break;
            case 'REMATCH_START':
                this._settlementView.onRematchStart();
                break;
            case 'REMATCH_REDIRECT':
                this._settlementView.onRematchRedirect(data);
                break;
        }
    }

    private _renderState(data: any): void {
        switch (data.phase) {
            case 'dealing':
                this._handCardView.showDealAnimation?.();
                break;
            case 'landlord_select':
                if (data.isLandlord) this._codeSelector.show();
                break;
            case 'doubling':
                break;
            case 'playing':
                this._doublingView.hide();
                this._playZone.setInteractable(true);
                if (data.shouldShowLastPlay) {
                    this._playZone.showLastPlay(data.lastPlayerId, data.lastPlay);
                } else if (data.shouldClearLastPlay) {
                    this._playZone.clearLastPlay?.();
                }
                break;
            case 'settlement':
                this._playZone.setInteractable(false);
                this._settlementView.show();
                break;
            case 'waiting':
                this._settlementView.hide?.();
                break;
        }
    }

    // ── 构建各逻辑实例 ────────────────────────────────────────────────────────

    private _buildHandCardView(): HandCardView {
        const v = new HandCardView();
        v._playButton   = this.playButton;
        v._patternLabel = this.patternLabel;
        return v;
    }

    private _buildPlayZone(): PlayZone {
        const v = new PlayZone();
        v._playBtn    = this.playBtn;
        v._passBtn    = this.passBtn;
        v._errorLabel = this.playErrorLabel;
        v._timerLabel = this.timerLabel;
        return v;
    }

    private _buildSeats(): PlayerSeat[] {
        return this.seatNodes.map((node, i) => {
            const seat = new PlayerSeat();
            seat.seatIndex = i;

            const nickLbl    = node.getChildByName('NicknameLabel')?.getComponent(Label);
            const countLbl   = node.getChildByName('HandCountLabel')?.getComponent(Label);
            const timerNode  = node.getChildByName('TimerNode');
            const badgeNode  = node.getChildByName('BadgeNode');
            const badgeLbl   = badgeNode?.getChildByName('BadgeLabel')?.getComponent(Label);
            const finishNode = node.getChildByName('FinishedNode');

            seat._nicknameLabel  = nickLbl!;
            seat._handCountLabel = countLbl!;
            seat._timerNode      = timerNode!;
            seat._identityBadge  = {
                get string()       { return badgeLbl?.string ?? ''; },
                set string(v: string) { if (badgeLbl) badgeLbl.string = v; },
                node: badgeNode!,
            };
            seat._finishedNode   = finishNode!;
            return seat;
        });
    }

    private _buildCodeSelector(): CodeCardSelector {
        const v = new CodeCardSelector();
        v._confirmBtn = this.confirmCodeBtn;
        v._rootNode   = this.codeSelectorRoot;
        v.onConfirm   = (choice: CodeCardChoice) => {
            this._mgr.selectCodeCard(choice.suit, choice.rank);
        };
        return v;
    }

    private _buildSettlementView(): SettlementView {
        this._settlLogic = new SettlementLogic();
        const v = new SettlementView();
        v._rootNode           = this.settlementRoot;
        v._bannerLabel        = this.bannerLabel;
        v._playAgainBtn       = this.playAgainBtn;
        v._returnHallBtn      = this.returnHallBtn;
        v._rematchStatusLabel = this.rematchStatusLabel;

        v.onReturnHall          = () => { director.loadScene('HallScene'); };
        v._requestRematch       = () => this._settlLogic.requestRematch(this._net);
        v._leaveRoom            = () => this._settlLogic.leaveRoom(this._net);
        v._navigateToHall       = () => { director.loadScene('HallScene'); };
        v._navigateToQuickMatch = () => { director.loadScene('HallScene'); };
        return v;
    }

    private _buildDoublingView(): DoublingView {
        const v = new DoublingView();
        v._rootNode    = this.doublingRoot;
        v._timerLabel  = this.doublingTimerLabel;
        v._statusLabel = this.doublingStatusLabel;
        v._singleBtn   = this.doublingSingleBtn;
        v._doubleBtn   = this.doublingDoubleBtn;
        v._resultLabel = this.doublingResultLabel;
        return v;
    }

    // ── Button Click 代理（编辑器 Button ClickEvents 绑定）───────────────────

    // AC-18: 先从 UI 视图取数据，再以参数形式传给 _mgr
    onPlayButtonClick()      { this._mgr.requestPlay(this._handCardView.getSelectedCards()); }
    onPassButtonClick()      { this._mgr.requestPass(); }
    onPlayAgainClick()       { this._settlementView.onPlayAgainClick?.();  }
    onReturnHallClick()      { this._settlementView.onReturnHallClick?.(); }
    onConfirmCodeClick()     { this._codeSelector.confirmSelection?.(); }
    onDoublingSingleClick()  { this._doublingView.onSingleClick?.(); }
    onDoublingDoubleClick()  { this._doublingView.onDoubleClick?.(); }
}
