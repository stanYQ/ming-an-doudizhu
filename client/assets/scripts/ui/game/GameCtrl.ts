/**
 * @file GameCtrl.ts
 * @description 游戏桌面板 Controller：持有各子区 CC Component，通过 onRender 回调响应业务事件。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Node, director } from 'cc';
import { GameMgr }                          from '../../logic/GameMgr';
import { SettlementLogic }                  from '../../logic/SettlementLogic';
import { netManager }                       from '../../net/NetManager';
import { HandCardView }                     from './HandCardView';
import { PlayZone }                         from './PlayZone';
import { PlayerSeat }                       from './PlayerSeat';
import { CodeCardSelector, CodeCardChoice } from './CodeCardSelector';
import { SettlementView }                   from './SettlementView';
import { DoublingView }                     from './DoublingView';

const { ccclass, property } = _decorator;

@ccclass('GameCtrl')
export class GameCtrl extends Component {

    @property(HandCardView)     handCardView!:     HandCardView;
    @property(PlayZone)         playZone!:         PlayZone;
    @property(DoublingView)     doublingView!:     DoublingView;
    @property(CodeCardSelector) codeCardSelector!: CodeCardSelector;
    @property(SettlementView)   settlementView!:   SettlementView;

    // index 0=自己，1=左邻，2=左对，3=右对，4=右邻（顺时针）
    @property([Node]) seatNodes: Node[] = [];

    private _net      = netManager;
    private _mgr!:    GameMgr;
    private _settlLogic!: SettlementLogic;
    private _seats!:  PlayerSeat[];

    onLoad() {
        this._settlLogic = new SettlementLogic();
        this._mgr        = new GameMgr(this._net);
        this._mgr.onRender = (event, data) => this._render(event, data);
        this._mgr.init();

        this._seats = this.seatNodes.map((node, i) => {
            const seat = node.getComponent(PlayerSeat)!;
            seat.seatIndex = i;
            return seat;
        });

        // 注入 SettlementView 回调
        this.settlementView.onReturnHall    = () => director.loadScene('HallScene');
        this.settlementView._requestRematch = () => this._settlLogic.requestRematch(this._net);
        this.settlementView._leaveRoom      = () => this._settlLogic.leaveRoom(this._net);
        this.settlementView._navigateToHall       = () => director.loadScene('HallScene');
        this.settlementView._navigateToQuickMatch = () => director.loadScene('HallScene');

        // 注入 CodeCardSelector 确认回调
        this.codeCardSelector.onConfirm = (choice: CodeCardChoice) => {
            this._mgr.selectCodeCard(choice.suit, choice.rank);
        };

        const room = this._net.room;
        if (room) {
            const mySessionId = room.sessionId as string;
            const myPlayer    = (room.state?.players as any)?.get?.(mySessionId);
            const mySeatIndex = (myPlayer?.seatIndex as number) ?? -1;
            this._mgr.setConnected(mySeatIndex, mySessionId);
            this.doublingView._mySeatIndex = mySeatIndex;
        }

        this._net.reconnectSync();
    }

    onDestroy() {
        this._mgr?.destroy();
    }

    // ── onRender 回调（只做节点操作）────────────────────────────────────────────

    private _render(event: string, data: any): void {
        switch (event) {
            case 'HAND':
                this.handCardView.render(data.cards);
                break;
            case 'BOTTOM_CARDS':
                this.handCardView.showBottomCards?.(data.cards);
                break;
            case 'HINT':
                this.playZone.showHint?.(data.cards);
                break;
            case 'TURN':
                this.playZone.setPlayButtonEnabled(data.isMyTurn);
                this.playZone.setPassButtonEnabled(data.isMyTurn && !data.isNewRound);
                if (data.isMyTurn) this.playZone.startCountdown(data.deadline);
                break;
            case 'REVEAL':
                if (typeof data.seatIndex === 'number') {
                    this._seats[data.seatIndex]?.showIdentity(data.role);
                }
                break;
            case 'OVER':
                this.settlementView.showResult(data);
                break;
            case 'STATE':
                this._renderState(data);
                break;
            case 'DOUBLING_START':
                this.doublingView._onSetDouble = (v: 1 | 2) => this._mgr.setDouble(v);
                this.doublingView.show(data);
                break;
            case 'LANDLORD_DOUBLED':
                this.doublingView.onLandlordDoubled(data);
                break;
            case 'DOUBLING_RESULT':
                this.doublingView.onResult(data);
                break;
            case 'REMATCH_UPDATE':
                this.settlementView.onRematchUpdate(data);
                break;
            case 'REMATCH_START':
                this.settlementView.onRematchStart();
                break;
            case 'REMATCH_REDIRECT':
                this.settlementView.onRematchRedirect();
                break;
        }
    }

    private _renderState(data: any): void {
        switch (data.phase) {
            case 'dealing':
                break;
            case 'landlord_select':
                if (data.isLandlord) this.codeCardSelector.show();
                break;
            case 'doubling':
                break;
            case 'playing':
                this.doublingView.hide();
                this.playZone.setInteractable(true);
                if (data.shouldShowLastPlay) {
                    this.playZone.showLastPlay(data.lastPlayerId, data.lastPlay);
                } else if (data.shouldClearLastPlay) {
                    this.playZone.clear();
                }
                break;
            case 'settlement':
                this.playZone.setInteractable(false);
                this.settlementView.show(data);
                break;
            case 'waiting':
                this.settlementView.hide?.();
                break;
        }
    }

    // ── Button Click 代理（编辑器 Button ClickEvents 绑定）──────────────────────

    onPlayButtonClick()      { this._mgr.requestPlay(this.handCardView.getSelectedCards()); }
    onPassButtonClick()      { this._mgr.requestPass(); }
    onPlayAgainClick()       { this.settlementView.onPlayAgainClick?.();  }
    onReturnHallClick()      { this.settlementView.onReturnHallClick?.(); }
    onConfirmCodeClick()     { this.codeCardSelector.confirmSelection?.(); }
    onDoublingSingleClick()  { this.doublingView.onSingleClick?.(); }
    onDoublingDoubleClick()  { this.doublingView.onDoubleClick?.(); }
}
