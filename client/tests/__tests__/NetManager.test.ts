// ---- oops message mock ----
const mockDispatchEvent = jest.fn();
jest.mock('db://oops-framework/core/common/event/MessageManager', () => ({
    message: { dispatchEvent: mockDispatchEvent },
}));

// G7 单例测试：两次 import 必须是同一对象引用
import { netManager } from '../net/NetManager';

// ---- Colyseus mock ----
const mockSend = jest.fn();
const messageHandlers: Record<string, (msg: any) => void> = {};
let stateChangeHandler: ((state: any) => void) | null = null;

const mockRoom = {
    send: mockSend,
    onMessage: jest.fn((type: string, cb: (msg: any) => void) => {
        messageHandlers[type] = cb;
    }),
    onStateChange: jest.fn((cb: (state: any) => void) => {
        stateChangeHandler = cb;
    }),
};

const mockJoinOrCreate = jest.fn();
const MockClient = jest.fn().mockImplementation(() => ({ joinOrCreate: mockJoinOrCreate }));

// NetManager reads colyseus from globalThis.colyseus (set by plugin at CC runtime).
// In Jest we inject the mock here before module load.
(globalThis as any).colyseus = { Client: MockClient };

import { NetManager } from '../net/NetManager';

function emitServerMsg(type: string, payload: any) {
    messageHandlers[type]?.(payload);
}

let manager: NetManager;

beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(messageHandlers).forEach(k => delete messageHandlers[k]);
    stateChangeHandler = null;
    (globalThis as any).colyseus = { Client: MockClient };
    manager = new NetManager();
});

// ===== AC-1 =====
test('AC-1: init 创建 Client 实例，不调用 joinOrCreate', () => {
    manager.init('ws://localhost:2567');
    expect(MockClient).toHaveBeenCalledWith('ws://localhost:2567');
    expect(mockJoinOrCreate).not.toHaveBeenCalled();
});

// ===== AC-2 =====
test('AC-2: joinRoom 调用 joinOrCreate 并注册消息处理器', async () => {
    mockJoinOrCreate.mockResolvedValueOnce(mockRoom);
    manager.init('ws://localhost:2567');
    await manager.joinRoom('game', { token: 'abc' });
    expect(mockJoinOrCreate).toHaveBeenCalledWith('game', { token: 'abc' });
    expect(mockRoom.onMessage).toHaveBeenCalled();
});

// ===== AC-3 =====
test('AC-3: joinRoom 失败时抛出错误', async () => {
    mockJoinOrCreate.mockRejectedValueOnce(new Error('server unreachable'));
    manager.init('ws://localhost:2567');
    await expect(manager.joinRoom('game', {})).rejects.toThrow('server unreachable');
});

// ===== AC-4 ~ AC-9: 消息路由 =====
const routingCases: [string, string][] = [
    ['your_hand',        'HAND'],
    ['bottom_cards',     'BOTTOM_CARDS'],
    ['hint',             'HINT'],
    ['identity_reveal',  'REVEAL'],
    ['game_over',        'OVER'],
    ['turn_change',      'TURN'],
    ['error',            'ERROR'],
    ['doubling_start',   'DOUBLING_START'],
    ['landlord_doubled', 'LANDLORD_DOUBLED'],
    ['doubling_result',  'DOUBLING_RESULT'],
    ['waiting_update',   'WAITING_UPDATE'],
    ['room_update',      'ROOM_UPDATE'],
    ['rematch_update',   'REMATCH_UPDATE'],
    ['rematch_start',    'REMATCH_START'],
    ['rematch_redirect', 'REMATCH_REDIRECT'],
];

test.each(routingCases)('AC: 收到 "%s" → oops.message.dispatchEvent("%s")', async (serverMsg, event) => {
    mockJoinOrCreate.mockResolvedValueOnce(mockRoom);
    manager.init('ws://localhost:2567');
    await manager.joinRoom('game', {});

    const payload = { test: serverMsg };
    emitServerMsg(serverMsg, payload);

    expect(mockDispatchEvent).toHaveBeenCalledWith(event, payload);
});

// ===== AC-10 =====
test('AC-10: onStateChange → oops.message.dispatchEvent("STATE")', async () => {
    mockJoinOrCreate.mockResolvedValueOnce(mockRoom);
    manager.init('ws://localhost:2567');
    await manager.joinRoom('game', {});

    const state = { phase: 'playing' };
    stateChangeHandler!(state);

    expect(mockDispatchEvent).toHaveBeenCalledWith('STATE', state);
});

// ===== AC-11 ~ AC-15 =====
async function setupWithRoom() {
    mockJoinOrCreate.mockResolvedValueOnce(mockRoom);
    manager.init('ws://localhost:2567');
    await manager.joinRoom('game', {});
}

test('AC-11: playCards 发送 play_cards + cards', async () => {
    await setupWithRoom();
    manager.playCards([1, 2, 3]);
    expect(mockSend).toHaveBeenCalledWith('play_cards', { cards: [1, 2, 3] });
});

test('AC-12: pass 发送 pass', async () => {
    await setupWithRoom();
    manager.pass();
    expect(mockSend).toHaveBeenCalledWith('pass');
});

test('AC-13: selectCodeCard 发送 select_code_card（suit 为 number）', async () => {
    await setupWithRoom();
    manager.selectCodeCard(1, 3);
    expect(mockSend).toHaveBeenCalledWith('select_code_card', { suit: 1, value: 3 });
});

test('AC-14: reconnectSync 发送 reconnect_sync', async () => {
    await setupWithRoom();
    manager.reconnectSync();
    expect(mockSend).toHaveBeenCalledWith('reconnect_sync');
});

test('AC-15: requestHint 发送 request_hint', async () => {
    await setupWithRoom();
    manager.requestHint();
    expect(mockSend).toHaveBeenCalledWith('request_hint');
});

// ===== AC-16 =====
test('AC-16: room 为 null 时所有 send 方法静默忽略', () => {
    manager.init('ws://localhost:2567');
    expect(() => manager.playCards([1])).not.toThrow();
    expect(() => manager.pass()).not.toThrow();
    expect(() => manager.selectCodeCard(0, 1)).not.toThrow();
    expect(() => manager.reconnectSync()).not.toThrow();
    expect(() => manager.requestHint()).not.toThrow();
    expect(() => manager.setDouble(1)).not.toThrow();
    expect(() => manager.forceStart()).not.toThrow();
    expect(() => manager.requestRematch()).not.toThrow();
    expect(mockSend).not.toHaveBeenCalled();
});

// ===== AC-6/7: setDouble =====
test('AC-6: setDouble(1) 发送 set_double { value: 1 }', async () => {
    await setupWithRoom();
    manager.setDouble(1);
    expect(mockSend).toHaveBeenCalledWith('set_double', { value: 1 });
});

test('AC-7: setDouble(2) 发送 set_double { value: 2 }', async () => {
    await setupWithRoom();
    manager.setDouble(2);
    expect(mockSend).toHaveBeenCalledWith('set_double', { value: 2 });
});

test('TASK-029c: forceStart 发送 force_start', async () => {
    await setupWithRoom();
    manager.forceStart();
    expect(mockSend).toHaveBeenCalledWith('force_start');
});

test('TASK-031c: requestRematch 发送 request_rematch', async () => {
    await setupWithRoom();
    manager.requestRematch();
    expect(mockSend).toHaveBeenCalledWith('request_rematch');
});

test('TASK-031c: leaveRoom 调用 room.leave() 并清除引用', async () => {
    const mockLeave = jest.fn().mockResolvedValue(undefined);
    const roomWithLeave = { ...mockRoom, leave: mockLeave };
    mockJoinOrCreate.mockResolvedValueOnce(roomWithLeave);
    manager.init('ws://localhost:2567');
    await manager.joinRoom('game', {});
    await manager.leaveRoom();
    expect(mockLeave).toHaveBeenCalledTimes(1);
    // 离开后 send 方法静默忽略（room 已 null）
    expect(() => manager.pass()).not.toThrow();
    expect(mockSend).not.toHaveBeenCalled();
});

// ===== G7 AC-1: netManager 单例 =====
test('G7 AC-1: netManager 是 NetManager 模块级单例，两次 import 同一引用', () => {
    const { netManager: nm2 } = require('../net/NetManager');
    expect(netManager).toBe(nm2);
});

// ===== G1 AC-4/5/6: setToken =====
test('G1 AC-4: setToken 将 token 写入 client.auth.token', () => {
    const mockAuth: { token: string } = { token: '' };
    const mockClientInst = { joinOrCreate: mockJoinOrCreate, auth: mockAuth };
    (MockClient as jest.Mock).mockImplementationOnce(() => mockClientInst);
    manager.init('ws://localhost:2567');
    manager.setToken('jwt-abc');
    expect(mockAuth.token).toBe('jwt-abc');
});

test('G1 AC-6: setToken(null) 静默忽略，不抛异常', () => {
    manager.init('ws://localhost:2567');
    expect(() => manager.setToken(null)).not.toThrow();
});

// ===== TASK-035 AC-4: init() 之前调用 setToken 不抛 TypeError =====
test('TASK-035 AC-4: init() 之前调用 setToken(token) 静默忽略，不抛 TypeError', () => {
    // manager 是 new NetManager()，init() 从未调用过，this.client === null
    // 当前实现：this.client.auth.token = token → TypeError
    expect(() => manager.setToken('valid-jwt-token')).not.toThrow();
});

test('G1 AC-6: setToken(undefined) 静默忽略，不抛异常', () => {
    manager.init('ws://localhost:2567');
    expect(() => manager.setToken(undefined)).not.toThrow();
});
