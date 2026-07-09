// ---- oops message mock ----
const handlers: Record<string, (event: string, ...args: any) => void> = {};
const mockOff   = jest.fn();
const mockToast = jest.fn();

jest.mock('db://oops-framework/core/common/event/MessageManager', () => ({
    message: {
        on:  jest.fn((event: string, fn: Function, ctx: any) => { handlers[event] = fn.bind(ctx); }),
        off: mockOff,
    },
}));

jest.mock('colyseus.js', () => ({ Client: jest.fn() }));
jest.mock('db://oops-framework/core/Oops', () => ({
    oops: { gui: { toast: (...args: any[]) => mockToast(...args) } },
}));

// PatternHelper / CardPattern are pure TS — no CC runtime needed
jest.mock('../shared/PatternHelper', () => {
    const { PatternType } = jest.requireActual('../shared/CardPattern');
    return {
        parse: (cards: number[]) => {
            // minimal stub: 1-card array → SINGLE; others → INVALID
            if (cards.length === 1) return { type: PatternType.SINGLE, cards };
            return { type: PatternType.INVALID, cards };
        },
    };
});

import { GameMgr, ClientGameState } from '../logic/GameMgr';

// ---- 工厂 ----

function makeController() {
    const mockNet = {
        playCards:        jest.fn(),
        pass:             jest.fn(),
        selectCodeCard:   jest.fn(),
        setDouble:        jest.fn(),
        sendDealingReady: jest.fn(),
        requestRematch:   jest.fn(),
        leaveRoom:        jest.fn().mockResolvedValue(undefined),
    };
    const renderEvents: Array<[string, any]> = [];
    const mgr = new GameMgr(mockNet as any);
    mgr.onRender = (event, data) => renderEvents.push([event, data]);
    mgr.init();
    return { mgr, mockNet, renderEvents };
}

/** 触发服务端事件 */
function emit(event: string, data: any) {
    handlers[event]?.(event, data);
}

/** 取最近一次 onRender(event) 的 data */
function lastRender(renderEvents: Array<[string, any]>, event: string): any | undefined {
    return [...renderEvents].reverse().find(([e]) => e === event)?.[1];
}

beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(handlers).forEach(k => delete handlers[k]);
});

// ===== AC-1: 初始状态 CONNECTING =====
test('AC-1: 构造时状态为 CONNECTING', () => {
    const mockNet = { playCards: jest.fn(), pass: jest.fn(), selectCodeCard: jest.fn(),
                      setDouble: jest.fn(), sendDealingReady: jest.fn(), requestRematch: jest.fn(), leaveRoom: jest.fn() };
    const mgr = new GameMgr(mockNet as any);
    expect(mgr.getState()).toBe(ClientGameState.CONNECTING);
});

// ===== AC-2: joinRoom 完成后 → IN_ROOM_WAIT =====
test('AC-2: setConnected 后状态变为 IN_ROOM_WAIT', () => {
    const { mgr } = makeController();
    mgr.setConnected(2, 'session-abc');
    expect(mgr.getState()).toBe(ClientGameState.IN_ROOM_WAIT);
});

// ===== AC-3: phase=dealing → DEALING + onRender STATE dealing =====
test('AC-3: STATE dealing → DEALING + onRender fires STATE{phase:dealing}', () => {
    const { mgr, renderEvents } = makeController();
    emit('STATE', { phase: 'dealing' });
    expect(mgr.getState()).toBe(ClientGameState.DEALING);
    expect(lastRender(renderEvents, 'STATE')?.phase).toBe('dealing');
});

// ===== AC-4: landlord_select =====
test('AC-4a: STATE landlord_select → LANDLORD_SELECT', () => {
    const { mgr } = makeController();
    mgr.setConnected(0, 'session-xyz');
    emit('STATE', { phase: 'landlord_select', landlordSeat: 3 });
    expect(mgr.getState()).toBe(ClientGameState.LANDLORD_SELECT);
});

test('AC-4b: 本人 seatIndex === landlordSeat → STATE data.isLandlord=true', () => {
    const { mgr, renderEvents } = makeController();
    mgr.setConnected(2, 'session-landlord');
    emit('STATE', { phase: 'landlord_select', landlordSeat: 2 });
    expect(lastRender(renderEvents, 'STATE')?.isLandlord).toBe(true);
});

test('AC-4c: 本人 seatIndex !== landlordSeat → STATE data.isLandlord=false', () => {
    const { mgr, renderEvents } = makeController();
    mgr.setConnected(1, 'session-farmer');
    emit('STATE', { phase: 'landlord_select', landlordSeat: 3 });
    expect(lastRender(renderEvents, 'STATE')?.isLandlord).toBe(false);
});

// ===== AC-5: phase=playing → PLAYING + onRender STATE playing =====
test('AC-5: STATE playing → PLAYING + onRender STATE{phase:playing}', () => {
    const { mgr, renderEvents } = makeController();
    emit('STATE', { phase: 'playing' });
    expect(mgr.getState()).toBe(ClientGameState.PLAYING);
    expect(lastRender(renderEvents, 'STATE')?.phase).toBe('playing');
});

// ===== TASK-027 AC-1: DOUBLING 枚举存在 =====
test('TASK-027 AC-1: ClientGameState 包含 DOUBLING', () => {
    const { mgr } = makeController();
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 1 });
    expect(mgr.getState()).toBe(ClientGameState.DOUBLING);
});

// ===== TASK-027 AC-2: DOUBLING_START → state=DOUBLING + onRender DOUBLING_START =====
test('TASK-027 AC-2: DOUBLING_START → DOUBLING + onRender DOUBLING_START(msg)', () => {
    const { mgr, renderEvents } = makeController();
    const msg = { timeout: 30, landlordSeatIndex: 2 };
    emit('DOUBLING_START', msg);
    expect(mgr.getState()).toBe(ClientGameState.DOUBLING);
    expect(lastRender(renderEvents, 'DOUBLING_START')).toMatchObject(msg);
});

// ===== TASK-027 AC-2b: setDouble → netManager.setDouble =====
test('TASK-027 AC-2b: setDouble(2) → netManager.setDouble(2)', () => {
    const { mgr, mockNet } = makeController();
    mgr.setDouble(2);
    expect(mockNet.setDouble).toHaveBeenCalledWith(2);
});

// ===== TASK-027 AC-3: LANDLORD_DOUBLED → onRender LANDLORD_DOUBLED =====
test('TASK-027 AC-3: LANDLORD_DOUBLED → onRender LANDLORD_DOUBLED(msg), 不切换状态', () => {
    const { mgr, renderEvents } = makeController();
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 1 });
    const msg = { value: 2 };
    emit('LANDLORD_DOUBLED', msg);
    expect(lastRender(renderEvents, 'LANDLORD_DOUBLED')).toMatchObject(msg);
    expect(mgr.getState()).toBe(ClientGameState.DOUBLING);
});

// ===== TASK-027 AC-4: DOUBLING_RESULT → onRender DOUBLING_RESULT =====
test('TASK-027 AC-4: DOUBLING_RESULT → onRender DOUBLING_RESULT(msg)', () => {
    const { renderEvents } = makeController();
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 1 });
    const msg = { results: [{ seatIndex: 0, doubled: false }] };
    emit('DOUBLING_RESULT', msg);
    expect(lastRender(renderEvents, 'DOUBLING_RESULT')).toMatchObject(msg);
});

// ===== TASK-027 AC-5: STATE playing（从 DOUBLING）→ onRender STATE{phase:playing} =====
test('TASK-027 AC-5: STATE playing → onRender STATE fired', () => {
    const { renderEvents } = makeController();
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 1 });
    emit('STATE', { phase: 'playing' });
    expect(lastRender(renderEvents, 'STATE')?.phase).toBe('playing');
});

// ===== TASK-027: setConnected 记录 mySeatIndex =====
test('TASK-027: setConnected → getMySeatIndex() 返回正确席位', () => {
    const { mgr } = makeController();
    mgr.setConnected(3, 'session-x');
    expect(mgr.getMySeatIndex()).toBe(3);
});

// ===== AC-6: phase=settlement → SETTLEMENT + onRender STATE settlement =====
test('AC-6: STATE settlement → SETTLEMENT + onRender STATE{phase:settlement}', () => {
    const { mgr, renderEvents } = makeController();
    emit('STATE', { phase: 'settlement' });
    expect(mgr.getState()).toBe(ClientGameState.SETTLEMENT);
    expect(lastRender(renderEvents, 'STATE')?.phase).toBe('settlement');
});

// ===== AC-7: HAND → onRender HAND =====
test('AC-7: HAND 事件 → onRender HAND({cards})', () => {
    const { renderEvents } = makeController();
    emit('HAND', { cards: [1, 2, 3] });
    expect(lastRender(renderEvents, 'HAND')?.cards).toEqual([1, 2, 3]);
});

// ===== TASK-050c AC-C3: HAND → sendDealingReady（兜底） =====
test('TASK-050c AC-C3: HAND 事件触发后立即调用 sendDealingReady（兜底逻辑）', () => {
    const { mockNet } = makeController();
    emit('HAND', { cards: [1, 2, 3] });
    expect(mockNet.sendDealingReady).toHaveBeenCalledTimes(1);
});

// ===== TASK-050c AC-C4: CODE_CARD_REVEAL → onRender =====
test('TASK-050c AC-C4: CODE_CARD_REVEAL → onRender CODE_CARD_REVEAL({suit, value, landlordSeatIndex})', () => {
    const { renderEvents } = makeController();
    const msg = { suit: 1, value: 5, landlordSeatIndex: 2 };
    emit('CODE_CARD_REVEAL', msg);
    expect(lastRender(renderEvents, 'CODE_CARD_REVEAL')).toEqual(msg);
});

// ===== AC-8: TURN → onRender TURN with isMyTurn =====
test('AC-8a: TURN 轮到本人 → onRender TURN{isMyTurn:true, deadline}', () => {
    const { mgr, renderEvents } = makeController();
    mgr.setConnected(2, 'session-me');
    emit('TURN', { seatIndex: 2, deadline: 30000 });
    const data = lastRender(renderEvents, 'TURN');
    expect(data?.isMyTurn).toBe(true);
    expect(data?.deadline).toBe(30000);
});

test('AC-8b: TURN 非本人回合 → onRender TURN{isMyTurn:false}', () => {
    const { mgr, renderEvents } = makeController();
    mgr.setConnected(2, 'session-me');
    emit('TURN', { seatIndex: 3, deadline: 30000 });
    expect(lastRender(renderEvents, 'TURN')?.isMyTurn).toBe(false);
});

// ===== G2 AC-8: Schema delta lastPlay =====
test('G2 AC-8: STATE playing + lastPlay 非空 → STATE{shouldShowLastPlay:true}', () => {
    const { renderEvents } = makeController();
    emit('STATE', { phase: 'playing', lastPlay: [10, 11], lastPlayerId: 'p1' });
    const data = lastRender(renderEvents, 'STATE');
    expect(data?.shouldShowLastPlay).toBe(true);
    expect(data?.lastPlay).toEqual([10, 11]);
    expect(data?.lastPlayerId).toBe('p1');
});

test('G2 AC-8: STATE playing + lastPlay 为空 → shouldShowLastPlay=false', () => {
    const { renderEvents } = makeController();
    emit('STATE', { phase: 'playing', lastPlay: [], lastPlayerId: '' });
    expect(lastRender(renderEvents, 'STATE')?.shouldShowLastPlay).toBe(false);
});

// ===== AC-10: REVEAL → onRender REVEAL =====
test('AC-10: REVEAL 事件 → onRender REVEAL({playerId, role})', () => {
    const { renderEvents } = makeController();
    emit('REVEAL', { playerId: 'p2', role: 'landlord' });
    const data = lastRender(renderEvents, 'REVEAL');
    expect(data?.playerId).toBe('p2');
    expect(data?.role).toBe('landlord');
});

// ===== AC-11: OVER → onRender OVER =====
test('AC-11: OVER 事件 → onRender OVER(data)', () => {
    const { renderEvents } = makeController();
    const data = { winnerCamp: 1, scores: {} };
    emit('OVER', data);
    expect(lastRender(renderEvents, 'OVER')).toMatchObject(data);
});

// ===== AC-12: ERROR 1001 → toast =====
test('AC-12: ERROR 1001 → oops.gui.toast("牌型不合法")', () => {
    makeController();
    emit('ERROR', { code: 1001, msg: 'invalid pattern' });
    expect(mockToast).toHaveBeenCalledWith('牌型不合法');
});

// ===== AC-13: ERROR 1002 → toast =====
test('AC-13: ERROR 1002 → oops.gui.toast("压不过上家")', () => {
    makeController();
    emit('ERROR', { code: 1002, msg: 'cannot beat' });
    expect(mockToast).toHaveBeenCalledWith('压不过上家');
});

// ===== AC-14: ERROR 1003 → 静默 =====
test('AC-14: ERROR 1003 → 不触发 toast', () => {
    makeController();
    emit('ERROR', { code: 1003, msg: 'not your turn' });
    expect(mockToast).not.toHaveBeenCalled();
});

// ===== AC-15/16: requestPlay 预检 =====
test('AC-15: 非法牌型 → toast("牌型不合法")，不调用 playCards', () => {
    const { mgr, mockNet } = makeController();
    mgr.setConnected(0, 'me');
    emit('TURN', { seatIndex: 0, deadline: 30000 });
    mgr.requestPlay([1, 5]); // INVALID per stub
    expect(mockToast).toHaveBeenCalledWith('牌型不合法');
    expect(mockNet.playCards).not.toHaveBeenCalled();
});

test('AC-16: 合法单张 → netManager.playCards([0])', () => {
    const { mgr, mockNet } = makeController();
    mgr.setConnected(0, 'me');
    emit('TURN', { seatIndex: 0, deadline: 30000 });
    mgr.requestPlay([0]); // SINGLE per stub
    expect(mockNet.playCards).toHaveBeenCalledWith([0]);
});

// ===== AC-17: requestPass =====
test('AC-17: requestPass() → netManager.pass()', () => {
    const { mgr, mockNet } = makeController();
    mgr.setConnected(1, 'me');
    emit('TURN', { seatIndex: 1, deadline: 30000 });
    mgr.requestPass();
    expect(mockNet.pass).toHaveBeenCalled();
});

// ===== AC-18: 非本人回合，出牌/不要静默 =====
test('AC-18: 非本人回合时 requestPlay/requestPass 静默忽略', () => {
    const { mgr, mockNet } = makeController();
    mgr.setConnected(1, 'me');
    emit('TURN', { seatIndex: 3, deadline: 30000 });
    mgr.requestPlay([0]);
    mgr.requestPass();
    expect(mockNet.playCards).not.toHaveBeenCalled();
    expect(mockNet.pass).not.toHaveBeenCalled();
});

// ===== AC-19: selectCodeCard =====
test('AC-19: selectCodeCard(1, 3) → netManager.selectCodeCard(1, 3)', () => {
    const { mgr, mockNet } = makeController();
    mgr.setConnected(2, 'me');
    emit('STATE', { phase: 'landlord_select', landlordSeat: 2 });
    mgr.selectCodeCard(1, 3);
    expect(mockNet.selectCodeCard).toHaveBeenCalledWith(1, 3);
});

// ===== AC-20: 非法暗号牌点数（rank>=8）过滤 =====
test('AC-20: 非法暗号牌 rank (8-17) → 不调用 selectCodeCard', () => {
    const { mgr, mockNet } = makeController();
    mgr.setConnected(2, 'me');
    emit('STATE', { phase: 'landlord_select', landlordSeat: 2 });
    for (const rank of [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
        mgr.selectCodeCard(0, rank);
    }
    expect(mockNet.selectCodeCard).not.toHaveBeenCalled();
});

// ===== G5 AC-16: BOTTOM_CARDS =====
test('G5 AC-16: BOTTOM_CARDS 事件 → onRender BOTTOM_CARDS({cards})', () => {
    const { renderEvents } = makeController();
    emit('BOTTOM_CARDS', { cards: [100, 101, 102] });
    expect(lastRender(renderEvents, 'BOTTOM_CARDS')?.cards).toEqual([100, 101, 102]);
});

// ===== G6 AC-19: HINT =====
test('G6 AC-19: HINT 事件 → onRender HINT({cards})', () => {
    const { renderEvents } = makeController();
    emit('HINT', { cards: [5, 6, 7] });
    expect(lastRender(renderEvents, 'HINT')?.cards).toEqual([5, 6, 7]);
});

// ===== onDestroy 注销监听 =====
test('onDestroy: 注销全部 oops.message 监听（14 个）', () => {
    const { mgr } = makeController();
    mgr.destroy();
    // STATE/HAND/BOTTOM_CARDS/HINT/TURN/REVEAL/OVER/ERROR/DOUBLING_START/LANDLORD_DOUBLED/DOUBLING_RESULT/REMATCH_UPDATE/REMATCH_START/REMATCH_REDIRECT = 14
    expect(mockOff).toHaveBeenCalledTimes(14);
});

// ===== TASK-031c: REMATCH 消息路由 =====
test('TASK-031c: REMATCH_UPDATE → onRender REMATCH_UPDATE', () => {
    const { renderEvents } = makeController();
    emit('REMATCH_UPDATE', { agreedCount: 2, total: 5 });
    expect(lastRender(renderEvents, 'REMATCH_UPDATE')).toMatchObject({ agreedCount: 2, total: 5 });
});

test('TASK-031c: REMATCH_START → onRender REMATCH_START', () => {
    const { renderEvents } = makeController();
    emit('REMATCH_START', {});
    expect(renderEvents.filter(([e]) => e === 'REMATCH_START')).toHaveLength(1);
});

test('TASK-031c: REMATCH_REDIRECT → onRender REMATCH_REDIRECT', () => {
    const { renderEvents } = makeController();
    emit('REMATCH_REDIRECT', { action: 'requeue' });
    expect(lastRender(renderEvents, 'REMATCH_REDIRECT')).toMatchObject({ action: 'requeue' });
});

// ===== TASK-035: 状态机补全 =====

test('TASK-035 AC-8: STATE doubling → state=DOUBLING，onRender DOUBLING_START 不触发', () => {
    const { mgr, renderEvents } = makeController();
    emit('STATE', { phase: 'doubling' });
    expect(mgr.getState()).toBe(ClientGameState.DOUBLING);
    expect(renderEvents.filter(([e]) => e === 'DOUBLING_START')).toHaveLength(0);
});

test('TASK-035 AC-9: STATE waiting → IN_ROOM_WAIT + onRender STATE{phase:waiting}', () => {
    const { mgr, renderEvents } = makeController();
    emit('STATE', { phase: 'settlement' });
    emit('STATE', { phase: 'waiting' });
    expect(mgr.getState()).toBe(ClientGameState.IN_ROOM_WAIT);
    expect(lastRender(renderEvents, 'STATE')?.phase).toBe('waiting');
});

test('TASK-035 AC-10: lastPlay 内容未变时 shouldShowLastPlay 仅触发一次', () => {
    const { renderEvents } = makeController();
    emit('STATE', { phase: 'playing', lastPlay: [10, 11, 12], lastPlayerId: 'A' });
    const cnt1 = renderEvents.filter(([e, d]) => e === 'STATE' && d.shouldShowLastPlay).length;
    expect(cnt1).toBe(1);
    emit('STATE', { phase: 'playing', lastPlay: [10, 11, 12], lastPlayerId: 'A' }); // 相同
    const cnt2 = renderEvents.filter(([e, d]) => e === 'STATE' && d.shouldShowLastPlay).length;
    expect(cnt2).toBe(1); // 不重复触发
    emit('STATE', { phase: 'playing', lastPlay: [20], lastPlayerId: 'B' });
    const cnt3 = renderEvents.filter(([e, d]) => e === 'STATE' && d.shouldShowLastPlay).length;
    expect(cnt3).toBe(2);
});

test('TASK-035 AC-11: lastPlay 清空 → shouldClearLastPlay=true', () => {
    const { renderEvents } = makeController();
    emit('STATE', { phase: 'playing', lastPlay: [5, 6, 7], lastPlayerId: 'A' });
    emit('STATE', { phase: 'playing', lastPlay: [], lastPlayerId: '' });
    expect(lastRender(renderEvents, 'STATE')?.shouldClearLastPlay).toBe(true);
});

test('P1-coverage: dealing 重置快照，再来一局同款出牌仍触发 shouldShowLastPlay', () => {
    const { renderEvents } = makeController();
    emit('STATE', { phase: 'playing', lastPlay: [10], lastPlayerId: 'A' });
    expect(renderEvents.filter(([e, d]) => e === 'STATE' && d.shouldShowLastPlay).length).toBe(1);
    emit('STATE', { phase: 'dealing' });
    emit('STATE', { phase: 'playing', lastPlay: [10], lastPlayerId: 'B' });
    expect(renderEvents.filter(([e, d]) => e === 'STATE' && d.shouldShowLastPlay).length).toBe(2);
});
