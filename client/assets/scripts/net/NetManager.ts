/**
 * @file NetManager.ts
 * @description Colyseus 网络层封装：创建客户端连接、加入房间、收发消息，将服务端事件桥接到 oops EventManager。
 * @module client/net
 */

import { message } from 'db://oops-framework/core/common/event/MessageManager';

// Colyseus 通过 assets/plugins/colyseus-bundle.js（自包含 IIFE plugin）注入。
// 该 plugin 在游戏脚本加载前执行，将 { Client, Room, ... } 挂到 globalThis.colyseus。
// Jest 中：各测试在 beforeEach 里设置 globalThis.colyseus = { Client: MockClient }。
function _colyseus(): any {
    return (globalThis as any).colyseus;
}

export class NetManager {
    private client: any = null;
    private _room: any = null;
    private _httpBase = '';

    /** 当前已加入的 Colyseus Room 实例，供 GameCtrl 读取席位信息。 */
    get room(): any { return this._room; }

    /**
     * 初始化 Colyseus Client 实例（不发起连接）。
     * @param endpoint 服务端地址（http:// 或 ws:// 均可，Colyseus 内部自动转换）
     */
    init(endpoint: string): void {
        this.client = new (_colyseus().Client)(endpoint);
        this._httpBase = endpoint.replace('ws://', 'http://').replace('wss://', 'https://');
    }

    /**
     * 将 JWT 写入 Colyseus client.auth.token，之后每次 joinRoom 自动携带 Authorization 头。
     * token 为 null/undefined 时静默忽略，不影响 stub 模式下无 token 的测试流程。
     * @param token 登录接口返回的 JWT
     */
    setToken(token: string | null | undefined): void {
        if (!token || !this.client) return;
        this.client.auth.token = token;
    }

    /**
     * 加入或创建指定房间，并注册所有服务端消息处理器。
     * @param name 房间名称，对应服务端 gameServer.define(name, ...)
     * @param options 加入参数（token、mode、roomCode 等）
     */
    async joinRoom(name: string, options: any): Promise<void> {
        this._room = await this.client.joinOrCreate(name, options);
        this._registerHandlers();
    }

    /**
     * 创建好友房（不参与快速匹配撮合）。
     * 服务端生成 roomCode 并通过 room_update 广播给房主。
     */
    async createFriendRoom(): Promise<void> {
        try {
            this._room = await this.client.create('game', { isFriendRoom: true });
            this._registerHandlers();
        } catch (e: any) {
            message.dispatchEvent('ERROR', { code: 0, msg: e?.message ?? '创建房间失败' });
        }
    }

    /**
     * 按 roomId 加入已存在的房间（好友通过邀请码加入时使用）。
     * @param roomId Colyseus 内部房间 ID，由 GET /rooms/code/:code 查得
     */
    async joinRoomById(roomId: string): Promise<void> {
        this._room = await this.client.joinById(roomId);
        this._registerHandlers();
    }

    /**
     * 通过好友房邀请码加入房间。
     * 先查 HTTP 端点拿 roomId，再用 joinById 建立 WebSocket 连接。
     * @param code 6 位大写邀请码
     */
    async joinByCode(code: string): Promise<void> {
        try {
            const res  = await fetch(`${this._httpBase}/rooms/code/${code.toUpperCase()}`);
            const data = await res.json();
            if (!res.ok) {
                message.dispatchEvent('ERROR', { code: 2002, msg: data.error ?? 'room not found' });
                return;
            }
            await this.joinRoomById(data.roomId);
        } catch (e: any) {
            const errMsg: string = e?.message ?? '';
            if (errMsg.includes('full')) {
                message.dispatchEvent('ERROR', { code: 2001, msg: errMsg });
            } else if (errMsg.includes('not found') || errMsg.includes('room')) {
                message.dispatchEvent('ERROR', { code: 2002, msg: errMsg });
            } else {
                message.dispatchEvent('ERROR', { code: 0, msg: errMsg || '加入房间失败' });
            }
        }
    }

    // 将 Colyseus room 消息路由到 oops EventManager，解耦 NetManager 与各 Controller
    private _registerHandlers() {
        const r = this._room!;
        r.onMessage('your_hand',       (msg: any) => message.dispatchEvent('HAND',            msg));
        r.onMessage('bottom_cards',    (msg: any) => message.dispatchEvent('BOTTOM_CARDS',    msg));
        r.onMessage('hint',            (msg: any) => message.dispatchEvent('HINT',            msg));
        r.onMessage('identity_reveal', (msg: any) => message.dispatchEvent('REVEAL',          msg));
        r.onMessage('game_over',       (msg: any) => message.dispatchEvent('OVER',            msg));
        r.onMessage('turn_change',     (msg: any) => message.dispatchEvent('TURN',            msg));
        r.onMessage('error',           (msg: any) => message.dispatchEvent('ERROR',           msg));
        r.onMessage('code_card_reveal', (msg: any) => message.dispatchEvent('CODE_CARD_REVEAL', msg));
        r.onMessage('doubling_start',   (msg: any) => message.dispatchEvent('DOUBLING_START',   msg));
        r.onMessage('landlord_doubled', (msg: any) => message.dispatchEvent('LANDLORD_DOUBLED', msg));
        r.onMessage('doubling_result',  (msg: any) => message.dispatchEvent('DOUBLING_RESULT',  msg));
        r.onMessage('waiting_update',   (msg: any) => message.dispatchEvent('WAITING_UPDATE',   msg));
        r.onMessage('room_update',      (msg: any) => message.dispatchEvent('ROOM_UPDATE',      msg));
        r.onMessage('rematch_update',   (msg: any) => message.dispatchEvent('REMATCH_UPDATE',   msg));
        r.onMessage('rematch_start',    (msg: any) => message.dispatchEvent('REMATCH_START',    msg));
        r.onMessage('rematch_redirect', (msg: any) => message.dispatchEvent('REMATCH_REDIRECT', msg));
        r.onStateChange((state: any)               => message.dispatchEvent('STATE',            state));
    }

    /**
     * 发送出牌请求。
     * 注意：只发送意图，不在此处做牌型合法性校验（由服务端仲裁）。
     * @param cards 要出的牌，0-107 编码整数数组
     */
    playCards(cards: number[]): void {
        this._room?.send('play_cards', { cards });
    }

    /** 发送 pass（不要）请求。 */
    pass(): void {
        this._room?.send('pass');
    }

    /**
     * 发送暗号牌选择（仅地主在 landlord_select 阶段调用）。
     * @param suit 花色编码 0=♠ 1=♥ 2=♦ 3=♣
     * @param value rank 编码，0=3 … 7=10
     */
    selectCodeCard(suit: number, value: number): void {
        this._room?.send('select_code_card', { suit, value });
    }

    /** 发送发牌动画完成确认（发牌阶段客户端动画结束后调用）。 */
    sendDealingReady(): void {
        this._room?.send('dealing_ready');
    }

    /** 断线重连后同步当前游戏状态。 */
    reconnectSync(): void {
        this._room?.send('reconnect_sync');
    }

    /** 请求服务端发送出牌提示（合法牌型列表）。 */
    requestHint(): void {
        this._room?.send('request_hint');
    }

    /**
     * 发送加倍选择（加倍阶段调用）。
     * @param value 1=不加倍，2=加倍
     */
    setDouble(value: 1 | 2): void {
        this._room?.send('set_double', { value });
    }

    /** 房主发送强制开局（好友房 waiting 阶段）。 */
    forceStart(): void {
        this._room?.send('force_start');
    }

    /** 发送再来一局请求（结算窗口期内）。 */
    requestRematch(): void {
        this._room?.send('request_rematch');
    }

    /**
     * 主动离开当前房间并清除引用。
     * 用于取消匹配或结算后返回大厅。
     */
    async leaveRoom(): Promise<void> {
        await this._room?.leave();
        this._room = null;
    }
}

/** 全局单例：HallCtrl 建立连接，GameCtrl 复用同一 room 引用。 */
export const netManager = new NetManager();
