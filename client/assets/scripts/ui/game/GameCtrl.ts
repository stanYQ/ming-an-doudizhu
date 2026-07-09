/**
 * @file GameCtrl.ts
 * @description 游戏桌面板 Controller：持有常驻子区 CC Component，通过 onRender 回调响应业务事件。
 *              弹层（CodeCardSelector/DoublingView/SettlementView）走 oops.gui.open/remove，不持有引用。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Node, Prefab, instantiate, director, Button } from 'cc';
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
    @property(Node)               seatsContainer!:      Node;    // 席位父节点
    @property(Prefab)             playerSeatPrefab!:     Prefab;  // PlayerSeat.prefab
    @property(Button)             leaveButton!:          Button;  // 测试用：退出牌局

    private _net          = netManager;
    private _mgr!:        GameMgr;
    private _settlLogic!: SettlementLogic;
    private _seats!:      PlayerSeat[];
    private _mySeatIndex  = -1;

    // ── 席位刷新 ────────────────────────────────────────────────────────────

    private _refreshSeats(): void {
        const room = this._net.room;
        if (!room) return;
        const players: Map<string, any> = room.state?.players;
        if (!players) return;
        const currentSeat = this._mgr.getCurrentSeat();

        this._seats.forEach((seat) => {
            const displayIdx = seat.seatIndex;
            const serverIdx  = (displayIdx + this._mySeatIndex) % 5;
            let found: any = null;
            players.forEach((p: any) => { if (p.seatIndex === serverIdx) found = p; });
            if (found) {
                seat.refresh({
                    playerId:      found.sessionId ?? '',
                    nickname:      found.nickname ?? `玩家${serverIdx + 1}`,
                    handCount:     found.handCount ?? 0,
                    isCurrentTurn: serverIdx === currentSeat,
                    turnDeadline:  serverIdx === currentSeat ? this._mgr.getTurnDeadline() : undefined,
                    isAI:          found.isAI === true,
                });
            }
        });
    }

    onLoad() {
        this._settlLogic = new SettlementLogic();
        this._mgr        = new GameMgr(this._net);
        this._mgr.onRender = (event, data) => this._render(event, data);
        this._mgr.init();

        // 清理 Scene 中可能已有的占位 Seat 节点（避免重复）
        for (let i = 0; i < 5; i++) {
            const stale = this.seatsContainer.getChildByName(`Seat${i}`);
            if (stale) stale.destroy();
        }

        // 动态创建 5 个席位：Canvas 中心锚点，坐标相对 Canvas 中心
        // 0=自己(底中), 1=右邻, 2=右上, 3=左上, 4=左邻
        const SEAT_POS: [number, number][] = [
            [0,   -300],   // 自己 — 底部居中
            [500,  -60],   // 右邻
            [280,  260],   // 右上
            [-280, 260],   // 左上
            [-500, -60],   // 左邻
        ];
        this._seats = SEAT_POS.map(([x, y], i) => {
            const node = instantiate(this.playerSeatPrefab);
            node.setPosition(x, y, 0);
            this.seatsContainer.addChild(node);
            const seat = node.getComponent(PlayerSeat)!;
            seat.seatIndex = i;
            return seat;
        });

        // 注入 HandCardView 按钮回调（prefab 内按钮直接调用自持方法）
        this.handCardView._onPlay = (cards) => this._mgr.requestPlay(cards);
        this.handCardView._onPass = ()      => this._mgr.requestPass();
        this.handCardView._onHint = ()      => this._net.requestHint();

        // 测试用退出按钮
        if (this.leaveButton) {
            this.leaveButton.node.on(Button.EventType.CLICK, this.onLeaveClick, this);
        }

        // AC-21: 底牌融入完成后服务端会发新 your_hand，无需额外处理
        this.bottomCardsDisplay._onMergeDone = () => {};

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
        this._net.leaveRoom();
    }

    /** 测试用：手动退出牌局，回到大厅 */
    onLeaveClick(): void {
        this._net.leaveRoom();
        director.loadScene('HallScene');
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
                this._refreshSeats();
                this.handCardView.setTurnActive(data.isMyTurn);
                this.handCardView.setPassEnabled(data.isMyTurn && !data.isNewRound);
                if (data.isMyTurn) this.playZone.startCountdown(data.deadline);
                break;
            case 'REVEAL':
                if (typeof data.seatIndex === 'number') {
                    const displayIdx = (data.seatIndex - this._mySeatIndex + 5) % 5;
                    this._seats[displayIdx]?.showIdentity(data.role);
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
                this._refreshSeats();
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
                this.playZone.clear();
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
                if (data.lastPlay?.length > 0) {
                    this.playZone.showLastPlay(data.lastPlayerId, data.lastPlay);
                } else if (this.playZone.getLastCards().length > 0) {
                    // 服务端清空了 lastPlay（全员 pass），客户端同步清
                    this.playZone.clear();
                }
                break;
            case 'settlement':
                this.handCardView.setInteractable(false);
                break;
            case 'waiting':
                oops.gui.remove(UIId.SettlementView);
                this.playZone.clear();
                break;
        }
    }
}
