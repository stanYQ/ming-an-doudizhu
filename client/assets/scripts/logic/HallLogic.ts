/**
 * @file HallLogic.ts
 * @description 主大厅业务逻辑：路由服务端消息 + 响应 MatchCtrl 的 MATCH_ACTION 委托。
 *              纯 TS，无 CC / oops.* 依赖。
 * @layer logic
 * @module logic
 */
import { message } from 'db://oops-framework/core/common/event/MessageManager';

export interface NetLike {
    joinRoom(roomName: string, options: Record<string, unknown>): Promise<void>;
    leaveRoom(): Promise<void>;
    forceStart(): void;
}

export type RenderHandler = (event: string, data: unknown) => void;

export class HallLogic {
    onRender?: RenderHandler;

    constructor(private readonly _net: NetLike) {}

    // ── 生命周期 ──────────────────────────────────────────────────────────────

    init(): void {
        message.on('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.on('ROOM_UPDATE',    this._onRoomUpdate,    this);
        message.on('STATE',          this._onState,         this);
        message.on('MATCH_ACTION',   this._onMatchAction,   this);
    }

    destroy(): void {
        message.off('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.off('ROOM_UPDATE',    this._onRoomUpdate,    this);
        message.off('STATE',          this._onState,         this);
        message.off('MATCH_ACTION',   this._onMatchAction,   this);
    }

    // ── 主动操作（HallCtrl 直接调用）────────────────────────────────────────

    async startQuickMatch(): Promise<void> {
        await this._net.joinRoom('game', { mode: 'quick' });
    }

    // ── MATCH_ACTION 委托（MatchCtrl 通过 EventManager 触发）────────────────

    private _onMatchAction(_evt: string, data: { action: string; payload?: string }): void {
        switch (data.action) {
            case 'cancel':
                this._net.leaveRoom().then(() => {
                    this.onRender?.('MATCH_CANCELLED', {});
                });
                break;
            case 'createRoom':
                this._net.joinRoom('game', { mode: 'friend' });
                break;
            case 'joinByCode':
                if (data.payload) this._net.joinRoom('game', { roomCode: data.payload });
                break;
            case 'forceStart':
                this._net.forceStart();
                break;
        }
    }

    // ── 服务端消息处理 ────────────────────────────────────────────────────────

    private _onWaitingUpdate(_evt: string, msg: { readyCount: number; total: number; aiSeconds?: number }): void {
        this.onRender?.('WAITING', {
            readyCount: msg.readyCount,
            total:      msg.total ?? 5,
            aiSeconds:  msg.aiSeconds ?? 0,
        });
    }

    private _onRoomUpdate(_evt: string, msg: { players: unknown[]; roomCode: string; ownerSeatIndex: number }): void {
        this.onRender?.('ROOM', {
            players:        msg.players,
            roomCode:       msg.roomCode,
            ownerSeatIndex: msg.ownerSeatIndex,
        });
    }

    private _onState(_evt: string, state: { phase: string }): void {
        if (state.phase === 'dealing') {
            this.onRender?.('GAME_STARTED', {});
        }
    }
}
