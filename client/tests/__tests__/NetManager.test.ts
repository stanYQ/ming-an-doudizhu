// ---- oops message mock ----
const mockDispatchEvent = jest.fn();
jest.mock('db://oops-framework/core/common/event/MessageManager', () => ({
    message: { dispatchEvent: mockDispatchEvent },
}));

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

// Colyseus is no longer imported via 'colyseus.js'; it is accessed via globalThis.colyseus.
// We set it here so NetManager.init() can find it without going through the npm package.
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
    ['your_hand',       'HAND'],
    ['identity_reveal', 'REVEAL'],
    ['game_over',       'OVER'],
    ['turn_change',     'TURN'],
    ['play_broadcast',  'PLAY'],
    ['error',           'ERROR'],
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

test('AC-13: selectCodeCard 发送 select_code_card', async () => {
    await setupWithRoom();
    manager.selectCodeCard('heart', 3);
    expect(mockSend).toHaveBeenCalledWith('select_code_card', { suit: 'heart', value: 3 });
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
    expect(() => manager.selectCodeCard('spade', 1)).not.toThrow();
    expect(() => manager.reconnectSync()).not.toThrow();
    expect(() => manager.requestHint()).not.toThrow();
    expect(mockSend).not.toHaveBeenCalled();
});
