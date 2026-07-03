/**
 * @file GameCtrl.ts
 * @description 游戏桌面板 Controller：持有常驻子区 CC Component，通过 onRender 回调响应业务事件。
 *              弹层（CodeCardSelector/DoublingView/SettlementView）走 oops.gui.open/remove，不持有引用。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Node, director } from 'cc';
import { oops }             from 'db://oops-framework/core/Oops';
import { UIId }             from '../../config/UIId';
import { GameMgr }          from '../../logic/GameMgr';
import { SettlementLogic }  from '../../logic/SettlementLogic';
import { netManager }       from '../../net/NetManager';
import { HandCardView }        from './HandCardView';
import { PlayZone }            from './PlayZone';
import { BottomCardsDisplay }  from './BottomCardsDisplay';
import { PlayerSeat }       from './PlayerSeat';
import { DoublingView }     from './DoublingView';
import { SettlementView }   from './SettlementView';
import { CodeCardChoice }   from './CodeCardSelector';

const { ccclass, property } = _decorator;

@ccclass('GameCtrl')
export class GameCtrl extends Component {

    @property(HandCardView)       handCardView!:        HandCardView;
    @property(PlayZone)           playZone!:            PlayZone;
    @property(BottomCardsDisplay) bottomCardsDisplay!:  BottomCardsDisplay;

    // index 0=自己，1=左邻，2=左对，3=右对，4=右邻（顺时针）
    @property([Node]) seatNodes: Node[] = [];

    private _net          = netManager;
    private _mgr!:        GameMgr;
    private _settlLogic!: SettlementLogic;
    private _seats!:      PlayerSeat[];
    private _mySeatIndex  = -1;

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

        // 注入 HandCardView 按钮回调（prefab 内按钮直接调用自持方法）
        this.handCardView._onPlay = (cards) => this._mgr.requestPlay(cards);
        this.handCardView._onPass = ()      => this._mgr.requestPass();
        this.handCardView._onHint = ()      => this._net.requestHint();

        const room = this._net.room;
        if (room) {
            const mySessionId = room.sessionId as string;
            const myPlayer    = (room.state?.players as any)?.get?.(mySessionId);
            this._mySeatIndex = (myPlayer?.seatIndex as number) ?? -1;
            this._mgr.setConnected(this._mySeatIndex, mySessionId);
        }

        this._net.reconnectSync();
    }

    onDestroy() {
        this._mgr?.destroy();
    }

    // ── onRender 回调 ────────────────────────────────────────────────────────────

    private _render(event: string, data: any): void {
        switch (event) {
            case 'HAND':
                this.handCardView.render(data.cards);
                break;
            case 'BOTTOM_CARDS':
                this.bottomCardsDisplay.show(data.cards);
                break;
            case 'HINT':
                this.handCardView.selectHint(data.cards);
                break;
            case 'TURN':
                this.handCardView.setTurnActive(data.isMyTurn);
                this.handCardView.setPassEnabled(data.isMyTurn && !data.isNewRound);
                if (data.isMyTurn) this.playZone.startCountdown(data.deadline);
                break;
            case 'REVEAL':
                if (typeof data.seatIndex === 'number') {
                    this._seats[data.seatIndex]?.showIdentity(data.role);
                }
                break;
            case 'OVER':
                oops.gui.open(UIId.SettlementView, { data: {
                    msg:                  data,
                    requestRematch:       () => this._settlLogic.requestRematch(this._net),
                    leaveRoom:            () => this._settlLogic.leaveRoom(this._net),
                    navigateToHall:       () => director.loadScene('HallScene'),
                    navigateToQuickMatch: () => director.loadScene('HallScene'),
                }});
                break;
            case 'STATE':
                this._renderState(data);
                break;
            case 'DOUBLING_START':
                oops.gui.open(UIId.DoublingView, { data: {
                    msg:         data,
                    mySeatIndex: this._mySeatIndex,
                    onSetDouble: (v: 1 | 2) => this._mgr.setDouble(v),
                }});
                break;
            case 'LANDLORD_DOUBLED':
                oops.gui.get(UIId.DoublingView)
                    ?.getComponent(DoublingView)
                    ?.onLandlordDoubled(data);
                break;
            case 'DOUBLING_RESULT':
                oops.gui.get(UIId.DoublingView)
                    ?.getComponent(DoublingView)
                    ?.onResult(data);
                break;
            case 'REMATCH_UPDATE':
                oops.gui.get(UIId.SettlementView)
                    ?.getComponent(SettlementView)
                    ?.onRematchUpdate(data);
                break;
            case 'REMATCH_START':
                oops.gui.get(UIId.SettlementView)
                    ?.getComponent(SettlementView)
                    ?.onRematchStart();
                break;
            case 'REMATCH_REDIRECT':
                oops.gui.get(UIId.SettlementView)
                    ?.getComponent(SettlementView)
                    ?.onRematchRedirect();
                break;
        }
    }

    private _renderState(data: any): void {
        switch (data.phase) {
            case 'dealing':
                break;
            case 'landlord_select':
                if (data.isLandlord) {
                    oops.gui.open(UIId.CodeCardSelector, { data: {
                        onConfirm: (c: CodeCardChoice) => this._mgr.selectCodeCard(c.suit, c.rank),
                    }});
                }
                break;
            case 'doubling':
                break;
            case 'playing':
                oops.gui.remove(UIId.DoublingView);
                this.bottomCardsDisplay.hide();
                this.handCardView.setInteractable(true);
                if (data.shouldShowLastPlay) {
                    this.playZone.showLastPlay(data.lastPlayerId, data.lastPlay);
                } else if (data.shouldClearLastPlay) {
                    this.playZone.clear();
                }
                break;
            case 'settlement':
                this.handCardView.setInteractable(false);
                break;
            case 'waiting':
                oops.gui.remove(UIId.SettlementView);
                break;
        }
    }
}
