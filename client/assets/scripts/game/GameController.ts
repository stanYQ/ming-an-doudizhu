import { _decorator, Component } from 'cc';
import { message } from 'db://oops-framework/core/common/event/MessageManager';
import { parse } from '../shared/PatternHelper';
import { PatternType } from '../shared/CardPattern';

const { ccclass } = _decorator;

export enum ClientGameState {
    CONNECTING      = 'CONNECTING',
    IN_LOBBY        = 'IN_LOBBY',
    IN_ROOM_WAIT    = 'IN_ROOM_WAIT',
    DEALING         = 'DEALING',
    LANDLORD_SELECT = 'LANDLORD_SELECT',
    PLAYING         = 'PLAYING',
    SETTLEMENT      = 'SETTLEMENT',
}

// 合法暗号牌点数：3-10（value 0-7，对应编码 rank 0-7）
const VALID_CODE_CARD_VALUES = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

@ccclass('GameController')
export class GameController extends Component {
    private state: ClientGameState = ClientGameState.CONNECTING;
    private currentSeat: number = -1;
    private mySeatIndex: number = -1;
    private mySessionId: string = '';

    // UI 组件引用（由场景注入）
    handCardView:     any = null;
    playZone:         any = null;
    playerSeats:      any[] = [];
    codeCardSelector: any = null;
    settlementView:   any = null;
    netManager:       any = null;

    onLoad() {
        message.on('STATE',  this.onStateChange, this);
        message.on('HAND',   this.onHand,        this);
        message.on('TURN',   this.onTurn,         this);
        message.on('PLAY',   this.onPlay,         this);
        message.on('REVEAL', this.onReveal,       this);
        message.on('OVER',   this.onOver,         this);
        message.on('ERROR',  this.onError,        this);
    }

    onDestroy() {
        message.off('STATE',  this.onStateChange, this);
        message.off('HAND',   this.onHand,        this);
        message.off('TURN',   this.onTurn,         this);
        message.off('PLAY',   this.onPlay,         this);
        message.off('REVEAL', this.onReveal,       this);
        message.off('OVER',   this.onOver,         this);
        message.off('ERROR',  this.onError,        this);
    }

    /** joinRoom 完成后由外部调用 */
    setConnected(mySeatIndex: number, mySessionId: string) {
        this.mySeatIndex  = mySeatIndex;
        this.mySessionId  = mySessionId;
        this.state        = ClientGameState.IN_ROOM_WAIT;
    }

    getState(): ClientGameState {
        return this.state;
    }

    // ─── 服务端 STATE 事件 ───────────────────────────────────────────────────

    private onStateChange(_event: string, state: any) {
        switch (state.phase) {
            case 'dealing':
                this.state = ClientGameState.DEALING;
                this.handCardView?.showDealAnimation?.();
                break;
            case 'landlord_select':
                this.state = ClientGameState.LANDLORD_SELECT;
                if (state.landlordSessionId === this.mySessionId) {
                    this.codeCardSelector?.show();
                }
                break;
            case 'playing':
                this.state = ClientGameState.PLAYING;
                this.playZone?.setInteractable(true);
                break;
            case 'settlement':
                this.state = ClientGameState.SETTLEMENT;
                this.playZone?.setInteractable(false);
                this.settlementView?.show();
                break;
        }
    }

    // ─── 服务端消息路由 ──────────────────────────────────────────────────────

    private onHand(_event: string, msg: { cards: number[] }) {
        this.handCardView?.render(msg.cards);
    }

    private onTurn(_event: string, msg: { seatIndex: number; deadline: number }) {
        this.currentSeat = msg.seatIndex;
        const isMyTurn   = this.currentSeat === this.mySeatIndex;
        this.playZone?.setPlayButtonEnabled(isMyTurn);
        this.playZone?.setPassButtonEnabled(isMyTurn);
        if (isMyTurn) this.playZone?.startCountdown(msg.deadline);
    }

    private onPlay(_event: string, msg: { playerId: string; cards: number[] }) {
        this.playZone?.showLastPlay(msg.playerId, msg.cards);
    }

    private onReveal(_event: string, msg: { playerId: string; role: string }) {
        this.playerSeats?.forEach(seat => seat?.showIdentity(msg.playerId, msg.role));
    }

    private onOver(_event: string, msg: { winnerCamp: number; scores: object }) {
        this.settlementView?.showResult(msg);
    }

    private onError(_event: string, msg: { code: number; msg: string }) {
        switch (msg.code) {
            case 1001: this.playZone?.showError('牌型不合法'); break;
            case 1002: this.playZone?.showError('压不过上家'); break;
            case 1003: break; // 静默忽略
        }
    }

    // ─── 出牌交互 ────────────────────────────────────────────────────────────

    onPlayButtonClick() {
        if (this.currentSeat !== this.mySeatIndex) return;
        const selected = this.handCardView?.getSelectedCards() ?? [];
        const pattern  = parse(selected);
        if (pattern.type === PatternType.INVALID) {
            this.playZone?.showError('牌型不合法');
            return;
        }
        this.netManager?.playCards(selected);
    }

    onPassButtonClick() {
        if (this.currentSeat !== this.mySeatIndex) return;
        this.netManager?.pass();
    }

    // ─── 暗号牌选择（仅地主）────────────────────────────────────────────────

    onCodeCardSelect(suit: string, value: number) {
        if (!VALID_CODE_CARD_VALUES.has(value)) return;
        this.netManager?.selectCodeCard(suit, value);
    }
}
