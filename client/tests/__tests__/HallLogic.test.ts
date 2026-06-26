// ---- oops message mock ----
const handlers: Record<string, (event: string, ...args: any[]) => void> = {};
const mockOff = jest.fn();

jest.mock('db://oops-framework/core/common/event/MessageManager', () => ({
    message: {
        on:  jest.fn((event: string, fn: Function, ctx: any) => { handlers[event] = fn.bind(ctx); }),
        off: mockOff,
    },
}));

jest.mock('cc',          () => require('../__mocks__/cc'));
jest.mock('colyseus.js', () => ({ Client: jest.fn() }));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { HallLogic } from '../logic/HallLogic';

function makeLogic() {
    const mockNet = {
        joinRoom:   jest.fn().mockResolvedValue(undefined),
        leaveRoom:  jest.fn().mockResolvedValue(undefined),
        forceStart: jest.fn(),
    };
    const renderEvents: Array<[string, unknown]> = [];
    const logic = new HallLogic(mockNet as any);
    logic.onRender = (event, data) => renderEvents.push([event, data]);
    logic.init();
    return { logic, mockNet, renderEvents };
}

function emit(event: string, data: any) {
    handlers[event]?.(event, data);
}

function lastRender(renderEvents: Array<[string, unknown]>, event: string) {
    return [...renderEvents].reverse().find(([e]) => e === event)?.[1];
}

beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(handlers).forEach(k => delete handlers[k]);
});

// ── init / destroy ─────────────────────────────────────────────────────────────

test('AC-arch-1: init 注册 WAITING_UPDATE / ROOM_UPDATE / STATE 三个监听', () => {
    makeLogic();
    expect(Object.keys(handlers)).toEqual(
        expect.arrayContaining(['WAITING_UPDATE', 'ROOM_UPDATE', 'STATE']),
    );
});

test('AC-arch-2: destroy 注销三个监听', () => {
    const { logic } = makeLogic();
    logic.destroy();
    expect(mockOff).toHaveBeenCalledTimes(3);
});

// ── 消息路由 ──────────────────────────────────────────────────────────────────

test('AC-1: WAITING_UPDATE → onRender("WAITING", { readyCount, aiSeconds })', () => {
    const { renderEvents } = makeLogic();
    emit('WAITING_UPDATE', { readyCount: 3, aiSeconds: 10 });
    const data = lastRender(renderEvents, 'WAITING') as any;
    expect(data?.readyCount).toBe(3);
    expect(data?.aiSeconds).toBe(10);
});

test('AC-1b: WAITING_UPDATE 无 aiSeconds → aiSeconds=0', () => {
    const { renderEvents } = makeLogic();
    emit('WAITING_UPDATE', { readyCount: 2 });
    const data = lastRender(renderEvents, 'WAITING') as any;
    expect(data?.aiSeconds).toBe(0);
});

test('AC-2: ROOM_UPDATE → onRender("ROOM", { players, roomCode, isOwner })', () => {
    const { renderEvents } = makeLogic();
    emit('ROOM_UPDATE', { players: ['A', 'B'], roomCode: '1234', isOwner: true });
    const data = lastRender(renderEvents, 'ROOM') as any;
    expect(data?.roomCode).toBe('1234');
    expect(data?.isOwner).toBe(true);
    expect(data?.players).toHaveLength(2);
});

test('AC-3: STATE phase=dealing → onRender("GAME_STARTED", {})', () => {
    const { renderEvents } = makeLogic();
    emit('STATE', { phase: 'dealing' });
    expect(renderEvents.filter(([e]) => e === 'GAME_STARTED')).toHaveLength(1);
});

test('AC-3b: STATE phase=waiting → GAME_STARTED 不触发', () => {
    const { renderEvents } = makeLogic();
    emit('STATE', { phase: 'waiting' });
    expect(renderEvents.filter(([e]) => e === 'GAME_STARTED')).toHaveLength(0);
});

// ── 主动操作 ──────────────────────────────────────────────────────────────────

test('AC-4: startQuickMatch → joinRoom("game", { mode: "quick" })', async () => {
    const { logic, mockNet } = makeLogic();
    await logic.startQuickMatch();
    expect(mockNet.joinRoom).toHaveBeenCalledWith('game', { mode: 'quick' });
});

test('AC-5: startFriendRoom → joinRoom("game", { mode: "friend" })', async () => {
    const { logic, mockNet } = makeLogic();
    await logic.startFriendRoom();
    expect(mockNet.joinRoom).toHaveBeenCalledWith('game', { mode: 'friend' });
});

test('AC-6: cancelMatch → leaveRoom()', async () => {
    const { logic, mockNet } = makeLogic();
    await logic.cancelMatch();
    expect(mockNet.leaveRoom).toHaveBeenCalled();
});

test('AC-7: forceStart → netManager.forceStart()', () => {
    const { logic, mockNet } = makeLogic();
    logic.forceStart();
    expect(mockNet.forceStart).toHaveBeenCalled();
});

test('AC-8: joinByCode("ABCD") → joinRoom("game", { mode:"friend", roomCode:"ABCD" })', async () => {
    const { logic, mockNet } = makeLogic();
    await logic.joinByCode('ABCD');
    expect(mockNet.joinRoom).toHaveBeenCalledWith('game', { mode: 'friend', roomCode: 'ABCD' });
});
