/**
 * @file GameMgr.ts
 * @description 游戏桌核心业务逻辑管理器：响应服务端消息，通过 onRender 回调通知 Ctrl 更新 UI。
 *              不继承 CC Component，不持有任何 UI 视图对象，不调用 oops.*（toast 除外）。
 * @module logic
 * @layer logic
 */

import { message }   from 'db://oops-framework/core/common/event/MessageManager';
import { oops }      from 'db://oops-framework/core/Oops';
import { HandLogic } from './HandLogic';

// ── 客户端状态机 ──────────────────────────────────────────────────────────────

export enum ClientGameState {
    CONNECTING      = 'CONNECTING',
    IN_LOBBY        = 'IN_LOBBY',
    IN_ROOM_WAIT    = 'IN_ROOM_WAIT',
    DEALING         = 'DEALING',
    LANDLORD_SELECT = 'LANDLORD_SELECT',
    DOUBLING        = 'DOUBLING',
    PLAYING         = 'PLAYING',
    SETTLEMENT      = 'SETTLEMENT',
}

// 合法暗号牌点数：3-10（rank 编码 0-7）
const VALID_CODE_VALUES = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

export interface NetLike {
    playCards(cards: number[]): void;
    pass(): void;
    selectCodeCard(suit: number, value: number): void;
    setDouble(v: 1 | 2): void;
    requestRematch(): void;
    leaveRoom(): Promise<void>;
}

/** GameCtrl 注册此回调，在回调内操作 CC 节点（不含业务判断）。 */
export type RenderHandler = (event: string, data: any) => void;

export class GameMgr {
    /** Ctrl 注入：每个服务端事件 → 对应 UI 操作。 */
    onRender?: RenderHandler;

    private _state:            ClientGameState = ClientGameState.CONNECTING;
    private _mySeatIndex:      number          = -1;
    private _mySessionId:      string          = '';
    private _currentSeat:      number          = -1;
    private _lastPlaySnapshot: number[]        = [];

    private readonly _handLogic = new HandLogic();

    constructor(private readonly _net: NetLike) {}

    // ── 生命周期 ──────────────────────────────────────────────────────────────

    /**
     * 注册所有服务端消息监听。GameCtrl.onLoad() 调用。
     */
    init(): void {
        message.on('STATE',            this._onState,           this);
        message.on('HAND',             this._onHand,            this);
        message.on('BOTTOM_CARDS',     this._onBottomCards,     this);
        message.on('HINT',             this._onHint,            this);
        message.on('TURN',             this._onTurn,            this);
        message.on('REVEAL',           this._onReveal,          this);
        message.on('OVER',             this._onOver,            this);
        message.on('ERROR',            this._onError,           this);
        message.on('DOUBLING_START',   this._onDoublingStart,   this);
        message.on('LANDLORD_DOUBLED', this._onLandlordDoubled, this);
        message.on('DOUBLING_RESULT',  this._onDoublingResult,  this);
        message.on('REMATCH_UPDATE',   this._onRematchUpdate,   this);
        message.on('REMATCH_START',    this._onRematchStart,    this);
        message.on('REMATCH_REDIRECT', this._onRematchRedirect, this);
    }

    /**
     * 注销所有监听。GameCtrl.onDestroy() 调用。
     */
    destroy(): void {
        message.off('STATE',            this._onState,           this);
        message.off('HAND',             this._onHand,            this);
        message.off('BOTTOM_CARDS',     this._onBottomCards,     this);
        message.off('HINT',             this._onHint,            this);
        message.off('TURN',             this._onTurn,            this);
        message.off('REVEAL',           this._onReveal,          this);
        message.off('OVER',             this._onOver,            this);
        message.off('ERROR',            this._onError,           this);
        message.off('DOUBLING_START',   this._onDoublingStart,   this);
        message.off('LANDLORD_DOUBLED', this._onLandlordDoubled, this);
        message.off('DOUBLING_RESULT',  this._onDoublingResult,  this);
        message.off('REMATCH_UPDATE',   this._onRematchUpdate,   this);
        message.off('REMATCH_START',    this._onRematchStart,    this);
        message.off('REMATCH_REDIRECT', this._onRematchRedirect, this);
    }

    // ── 连接信息 ──────────────────────────────────────────────────────────────

    /**
     * joinRoom 成功后由 GameCtrl 调用，记录本局席位信息。
     */
    setConnected(mySeatIndex: number, mySessionId: string): void {
        this._mySeatIndex = mySeatIndex;
        this._mySessionId = mySessionId;
        this._state       = ClientGameState.IN_ROOM_WAIT;
    }

    getState(): ClientGameState { return this._state; }
    getMySeatIndex(): number    { return this._mySeatIndex; }

    // ── 出牌操作（AC-7）─────────────────────────────────────────────────────

    requestPlay(cards: number[]): void {
        if (this._currentSeat !== this._mySeatIndex) return;
        const result = this._handLogic.validate(cards);
        if (!result.valid) {
            oops.gui.toast(result.error ?? '牌型不合法');
            return;
        }
        this._net.playCards(cards);
    }

    requestPass(): void {
        if (this._currentSeat !== this._mySeatIndex) return;
        this._net.pass();
    }

    selectCodeCard(suit: number, rank: number): void {
        if (!VALID_CODE_VALUES.has(rank)) return;
        this._net.selectCodeCard(suit, rank);
    }

    setDouble(v: 1 | 2): void {
        this._net.setDouble(v);
    }

    requestRematch(): void {
        this._net.requestRematch();
    }

    returnToHall(): void {
        this._net.leaveRoom();
    }

    // ── 服务端消息处理 ────────────────────────────────────────────────────────

    private _onState(_event: string, state: any): void {
        let shouldShowLastPlay  = false;
        let shouldClearLastPlay = false;

        switch (state.phase) {
            case 'dealing':
                this._state = ClientGameState.DEALING;
                this._lastPlaySnapshot = [];
                break;

            case 'landlord_select':
                this._state = ClientGameState.LANDLORD_SELECT;
                break;

            case 'doubling':
                this._state = ClientGameState.DOUBLING;
                break;

            case 'playing':
                this._state = ClientGameState.PLAYING;
                if (state.lastPlay?.length) {
                    const inc  = state.lastPlay as number[];
                    const same = inc.length === this._lastPlaySnapshot.length &&
                                 inc.every((v, i) => v === this._lastPlaySnapshot[i]);
                    if (!same) {
                        this._lastPlaySnapshot = [...inc];
                        shouldShowLastPlay = true;
                    }
                } else if (this._lastPlaySnapshot.length > 0) {
                    this._lastPlaySnapshot = [];
                    shouldClearLastPlay = true;
                }
                break;

            case 'settlement':
                this._state = ClientGameState.SETTLEMENT;
                break;

            case 'waiting':
                this._state = ClientGameState.IN_ROOM_WAIT;
                break;
        }

        this.onRender?.('STATE', {
            phase:              state.phase,
            isLandlord:         state.landlordSeat === this._mySeatIndex,
            lastPlay:           this._lastPlaySnapshot,
            lastPlayerId:       state.lastPlayerId ?? '',
            shouldShowLastPlay,
            shouldClearLastPlay,
        });
    }

    private _onHand(_event: string, msg: { cards: number[] }): void {
        this.onRender?.('HAND', msg);
    }

    private _onBottomCards(_event: string, msg: { cards: number[] }): void {
        this.onRender?.('BOTTOM_CARDS', msg);
    }

    private _onHint(_event: string, msg: { cards: number[] }): void {
        this.onRender?.('HINT', msg);
    }

    private _onTurn(_event: string, msg: { seatIndex: number; deadline: number; isNewRound?: boolean }): void {
        this._currentSeat = msg.seatIndex;
        const isMyTurn    = this._currentSeat === this._mySeatIndex;
        this.onRender?.('TURN', { ...msg, isMyTurn });
    }

    private _onReveal(_event: string, msg: { playerId: string; role: string }): void {
        this.onRender?.('REVEAL', msg);
    }

    private _onOver(_event: string, msg: any): void {
        this.onRender?.('OVER', msg);
    }

    private _onError(_event: string, msg: { code: number; msg: string }): void {
        // AC-6: 错误提示直接 toast，不经过 Ctrl
        switch (msg.code) {
            case 1001: oops.gui.toast('牌型不合法'); break;
            case 1002: oops.gui.toast('压不过上家'); break;
            case 1003: break; // 静默（不轮到本人时的防御拦截）
        }
    }

    private _onDoublingStart(_event: string, msg: any): void {
        this._state = ClientGameState.DOUBLING;
        this.onRender?.('DOUBLING_START', msg);
    }

    private _onLandlordDoubled(_event: string, msg: any): void {
        this.onRender?.('LANDLORD_DOUBLED', msg);
    }

    private _onDoublingResult(_event: string, msg: any): void {
        this.onRender?.('DOUBLING_RESULT', msg);
    }

    private _onRematchUpdate(_event: string, msg: any): void {
        this.onRender?.('REMATCH_UPDATE', msg);
    }

    private _onRematchStart(_event: string, _msg: any): void {
        this.onRender?.('REMATCH_START', {});
    }

    private _onRematchRedirect(_event: string, msg: any): void {
        this.onRender?.('REMATCH_REDIRECT', msg);
    }
}
