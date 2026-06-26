/**
 * @file HallLogic.ts
 * @description 主大厅业务逻辑管理器：路由服务端消息，通过 onRender 回调通知 HallCtrl 更新节点。
 *              纯 TS，无 CC import，无 oops.* 依赖（仅 message 事件总线）。
 * @module logic
 * @layer logic
 */

import { message } from 'db://oops-framework/core/common/event/MessageManager';

export interface NetLike {
    joinRoom(roomName: string, options: Record<string, unknown>): Promise<void>;
    leaveRoom(): Promise<void>;
    forceStart(): void;
}

/** HallCtrl 注册此回调，在回调内操作 CC 节点，不含业务判断。 */
export type RenderHandler = (event: string, data: unknown) => void;

export class HallLogic {
    /** Ctrl 注入：将服务端事件转化为节点操作。 */
    onRender?: RenderHandler;

    constructor(private readonly _net: NetLike) {}

    // ── 生命周期 ──────────────────────────────────────────────────────────────

    /**
     * 注册服务端消息监听。HallCtrl.onLoad() 调用。
     */
    init(): void {
        message.on('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.on('ROOM_UPDATE',    this._onRoomUpdate,    this);
        message.on('STATE',          this._onState,         this);
    }

    /**
     * 注销所有监听。HallCtrl.onDestroy() 调用。
     */
    destroy(): void {
        message.off('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.off('ROOM_UPDATE',    this._onRoomUpdate,    this);
        message.off('STATE',          this._onState,         this);
    }

    // ── 主动操作 ──────────────────────────────────────────────────────────────

    /** 加入快速匹配队列。 */
    async startQuickMatch(): Promise<void> {
        await this._net.joinRoom('game', { mode: 'quick' });
    }

    /** 创建或加入好友房。 */
    async startFriendRoom(): Promise<void> {
        await this._net.joinRoom('game', { mode: 'friend' });
    }

    /** 取消匹配/离开房间。 */
    async cancelMatch(): Promise<void> {
        await this._net.leaveRoom();
    }

    /** 房主强制开始（人数未满时）。 */
    forceStart(): void {
        this._net.forceStart();
    }

    /** 通过房间码加入好友房。 */
    async joinByCode(roomCode: string): Promise<void> {
        await this._net.joinRoom('game', { mode: 'friend', roomCode });
    }

    // ── 服务端消息处理 ────────────────────────────────────────────────────────

    private _onWaitingUpdate(_event: string, msg: { readyCount: number; aiSeconds?: number }): void {
        this.onRender?.('WAITING', {
            readyCount: msg.readyCount,
            aiSeconds:  msg.aiSeconds ?? 0,
        });
    }

    private _onRoomUpdate(_event: string, msg: { players: unknown[]; roomCode: string; isOwner: boolean }): void {
        this.onRender?.('ROOM', {
            players:  msg.players,
            roomCode: msg.roomCode,
            isOwner:  msg.isOwner,
        });
    }

    private _onState(_event: string, state: { phase: string }): void {
        if (state.phase === 'dealing') {
            this.onRender?.('GAME_STARTED', {});
        }
    }
}
