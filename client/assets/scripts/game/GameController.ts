/**
 * @file GameController.ts
 * @description 游戏桌核心控制器：响应服务端状态推送，驱动 UI 组件更新，转发本地操作到 NetManager。
 * @module client/game
 */

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
    DOUBLING        = 'DOUBLING',
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
    private _lastPlaySnapshot: number[] = [];

    // UI 组件引用（由场景装配脚本注入，不在编辑器里拖拽）
    handCardView:     any = null;
    playZone:         any = null;
    playerSeats:      any[] = [];
    codeCardSelector: any = null;
    settlementView:   any = null;
    doublingView:     any = null;
    netManager:       any = null;

    onLoad() {
        message.on('STATE',            this.onStateChange,      this);
        message.on('HAND',             this.onHand,             this);
        message.on('BOTTOM_CARDS',     this.onBottomCards,      this);
        message.on('HINT',             this.onHint,             this);
        message.on('TURN',             this.onTurn,             this);
        message.on('REVEAL',           this.onReveal,           this);
        message.on('OVER',             this.onOver,             this);
        message.on('ERROR',            this.onError,            this);
        message.on('DOUBLING_START',   this.onDoublingStart,    this);
        message.on('LANDLORD_DOUBLED', this.onLandlordDoubled,  this);
        message.on('DOUBLING_RESULT',  this.onDoublingResult,   this);
        message.on('REMATCH_UPDATE',   this.onRematchUpdate,    this);
        message.on('REMATCH_START',    this.onRematchStart,     this);
        message.on('REMATCH_REDIRECT', this.onRematchRedirect,  this);
    }

    onDestroy() {
        message.off('STATE',            this.onStateChange,      this);
        message.off('HAND',             this.onHand,             this);
        message.off('BOTTOM_CARDS',     this.onBottomCards,      this);
        message.off('HINT',             this.onHint,             this);
        message.off('TURN',             this.onTurn,             this);
        message.off('REVEAL',           this.onReveal,           this);
        message.off('OVER',             this.onOver,             this);
        message.off('ERROR',            this.onError,            this);
        message.off('DOUBLING_START',   this.onDoublingStart,    this);
        message.off('LANDLORD_DOUBLED', this.onLandlordDoubled,  this);
        message.off('DOUBLING_RESULT',  this.onDoublingResult,   this);
        message.off('REMATCH_UPDATE',   this.onRematchUpdate,    this);
        message.off('REMATCH_START',    this.onRematchStart,     this);
        message.off('REMATCH_REDIRECT', this.onRematchRedirect,  this);
    }

    /**
     * joinRoom 成功后由场景装配脚本调用，记录本局本人席位信息。
     * @param mySeatIndex 本人在本局的座位编号（0-4）
     * @param mySessionId Colyseus 分配的会话 ID，用于匹配 identity_reveal 消息
     */
    setConnected(mySeatIndex: number, mySessionId: string) {
        this.mySeatIndex  = mySeatIndex;
        this.mySessionId  = mySessionId;
        this.state        = ClientGameState.IN_ROOM_WAIT;
        if (this.doublingView) this.doublingView._mySeatIndex = mySeatIndex;
    }

    /** 返回当前客户端状态机阶段，供测试和场景脚本查询。 */
    getState(): ClientGameState {
        return this.state;
    }

    // ─── 服务端 STATE 事件 ───────────────────────────────────────────────────
    // 服务端是唯一的状态来源，客户端不自行推断阶段转换

    private onStateChange(_event: string, state: any) {
        switch (state.phase) {
            // 收到 dealing → 进入发牌阶段，触发发牌动画；重置出牌快照防跨局误判
            case 'dealing':
                this.state = ClientGameState.DEALING;
                this._lastPlaySnapshot = [];
                this.handCardView?.showDealAnimation?.();
                break;
            // 收到 landlord_select → 若本人座位号与地主座位号匹配则弹出暗号牌选择器
            // 使用 state.landlordSeat（number）而非 landlordSessionId（Schema 中无此字段）
            case 'landlord_select':
                this.state = ClientGameState.LANDLORD_SELECT;
                if (state.landlordSeat === this.mySeatIndex) {
                    this.codeCardSelector?.show();
                }
                break;
            // 收到 doubling → 仅切换状态机；加倍 UI 由 DOUBLING_START 消息处理器负责
            // schema 不含 timeout，不在此处调用 doublingView.show()
            case 'doubling':
                this.state = ClientGameState.DOUBLING;
                break;
            // 收到 playing → 进入出牌阶段，激活出牌区交互；若仍在加倍面板则关闭
            case 'playing':
                this.state = ClientGameState.PLAYING;
                this.doublingView?.hide();
                this.playZone?.setInteractable(true);
                // Schema delta：仅在 lastPlay 内容实际变化时更新 UI，避免每次 delta 都触发
                // 先比较再复制，避免在无变化的高频 delta 上分配新数组（微信小程序 GC 敏感）
                if (state.lastPlay?.length) {
                    const incoming = state.lastPlay as number[];
                    const same = incoming.length === this._lastPlaySnapshot.length &&
                                 incoming.every((v, i) => v === this._lastPlaySnapshot[i]);
                    if (!same) {
                        this._lastPlaySnapshot = [...incoming];
                        this.playZone?.showLastPlay(state.lastPlayerId ?? '', this._lastPlaySnapshot);
                    }
                } else if (this._lastPlaySnapshot.length > 0) {
                    // 新一轮自由出牌：服务端清空 lastPlay，清除上一轮出牌展示
                    this._lastPlaySnapshot = [];
                    this.playZone?.clearLastPlay?.();
                }
                break;
            // 收到 settlement → 禁用交互，展示结算界面
            case 'settlement':
                this.state = ClientGameState.SETTLEMENT;
                this.playZone?.setInteractable(false);
                this.settlementView?.show();
                break;
            // 收到 waiting → 再来一局重置回等待状态，隐藏结算界面
            case 'waiting':
                this.state = ClientGameState.IN_ROOM_WAIT;
                this.settlementView?.hide?.();
                break;
        }
    }

    // ─── 服务端消息路由 ──────────────────────────────────────────────────────

    private onHand(_event: string, msg: { cards: number[] }) {
        this.handCardView?.render(msg.cards);
    }

    private onTurn(_event: string, msg: { seatIndex: number; deadline: number; isNewRound?: boolean }) {
        this.currentSeat = msg.seatIndex;
        const isMyTurn   = this.currentSeat === this.mySeatIndex;
        this.playZone?.setPlayButtonEnabled(isMyTurn);
        // 自由轮（isNewRound=true）不允许 pass
        this.playZone?.setPassButtonEnabled(isMyTurn && !msg.isNewRound);
        if (isMyTurn) this.playZone?.startCountdown(msg.deadline);
    }

    private onBottomCards(_event: string, msg: { cards: number[] }) {
        this.handCardView?.showBottomCards?.(msg.cards);
    }

    private onHint(_event: string, msg: { cards: number[] }) {
        this.playZone?.showHint?.(msg.cards);
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
            case 1003: break; // 静默忽略（不轮到本人出牌时的防御拦截）
        }
    }

    // ─── 加倍阶段消息 ────────────────────────────────────────────────────────

    private onDoublingStart(_event: string, msg: any) {
        // 收到 doubling_start → 切换状态并展示加倍面板
        this.state = ClientGameState.DOUBLING;
        if (this.doublingView) {
            this.doublingView._onSetDouble = (v: 1 | 2) => this.netManager?.setDouble(v);
            this.doublingView.show(msg);
        }
    }

    private onLandlordDoubled(_event: string, msg: any) {
        this.doublingView?.onLandlordDoubled(msg);
    }

    private onDoublingResult(_event: string, msg: any) {
        this.doublingView?.onResult(msg);
    }

    // ─── 再来一局消息路由（TASK-031c）────────────────────────────────────────
    // 服务端结算窗口期广播，GameController 统一转发给 settlementView

    private onRematchUpdate(_event: string, msg: any) {
        this.settlementView?.onRematchUpdate(msg);
    }

    private onRematchStart(_event: string, _msg: any) {
        // 房间状态机重置回 waiting→dealing，随后收到 STATE phase=dealing 正常驱动
        this.settlementView?.onRematchStart();
    }

    private onRematchRedirect(_event: string, msg: any) {
        this.settlementView?.onRematchRedirect(msg);
    }

    // ─── 出牌交互 ────────────────────────────────────────────────────────────

    /**
     * 出牌按钮点击回调。
     * 注意：只在本人回合有效；牌型合法性在此处预检，最终由服务端仲裁。
     */
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

    /**
     * 不要按钮点击回调。
     * 注意：只在本人回合有效；服务端会校验是否可以 pass。
     */
    onPassButtonClick() {
        if (this.currentSeat !== this.mySeatIndex) return;
        this.netManager?.pass();
    }

    // ─── 暗号牌选择（仅地主）────────────────────────────────────────────────

    /**
     * 地主确认暗号牌后由 CodeCardSelector.onConfirm 回调触发。
     * @param suit 花色编码 0=♠ 1=♥ 2=♦ 3=♣
     * @param value rank 编码，0=3 … 7=10；非法值静默丢弃
     */
    onCodeCardSelect(suit: number, value: number) {
        if (!VALID_CODE_CARD_VALUES.has(value)) return;
        this.netManager?.selectCodeCard(suit, value);
    }
}
