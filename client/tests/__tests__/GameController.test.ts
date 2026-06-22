// ---- oops message mock ----
const handlers: Record<string, (event: string, ...args: any) => void> = {};
const mockOff = jest.fn();

jest.mock('db://oops-framework/core/common/event/MessageManager', () => ({
    message: {
        on: jest.fn((event: string, fn: Function, ctx: any) => {
            handlers[event] = fn.bind(ctx);
        }),
        off: mockOff,
    },
}));

jest.mock('colyseus.js', () => ({ Client: jest.fn() }));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { GameController } from '../game/GameController';
import { PatternType } from '../shared/CardPattern';

// ---- UI mock 工厂 ----
function makeUIMocks() {
    return {
        handCardView: {
            render: jest.fn(),
            getSelectedCards: jest.fn().mockReturnValue([]),
            showDealAnimation: jest.fn(),
        },
        playZone: {
            setInteractable: jest.fn(),
            setPlayButtonEnabled: jest.fn(),
            setPassButtonEnabled: jest.fn(),
            startCountdown: jest.fn(),
            showLastPlay: jest.fn(),
            showError: jest.fn(),
        },
        playerSeats: [
            { showIdentity: jest.fn() },
            { showIdentity: jest.fn() },
            { showIdentity: jest.fn() },
            { showIdentity: jest.fn() },
            { showIdentity: jest.fn() },
        ],
        codeCardSelector: { show: jest.fn() },
        settlementView:   { show: jest.fn(), showResult: jest.fn() },
        doublingView: {
            _mySeatIndex: -1,
            _onSetDouble: jest.fn(),
            show:               jest.fn(),
            onLandlordDoubled:  jest.fn(),
            onResult:           jest.fn(),
            hide:               jest.fn(),
        },
        netManager: {
            playCards:    jest.fn(),
            pass:         jest.fn(),
            selectCodeCard: jest.fn(),
            setDouble:    jest.fn(),
        },
    };
}

function makeController() {
    const ctrl = new GameController();
    const ui = makeUIMocks();
    ctrl.handCardView      = ui.handCardView;
    ctrl.playZone          = ui.playZone;
    ctrl.playerSeats       = ui.playerSeats;
    ctrl.codeCardSelector  = ui.codeCardSelector;
    ctrl.settlementView    = ui.settlementView;
    ctrl.doublingView      = ui.doublingView;
    ctrl.netManager        = ui.netManager;
    ctrl.onLoad();
    return { ctrl, ui };
}

// helper: 触发服务端事件
function emit(event: string, data: any) {
    handlers[event]?.(event, data);
}

beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(handlers).forEach(k => delete handlers[k]);
});

// ===== AC-1: 初始状态 CONNECTING =====
test('AC-1: 构造时状态为 CONNECTING', () => {
    const ctrl = new GameController();
    expect(ctrl.getState()).toBe('CONNECTING');
});

// ===== AC-2: joinRoom 完成后 → IN_ROOM_WAIT =====
test('AC-2: setConnected 后状态变为 IN_ROOM_WAIT', () => {
    const { ctrl } = makeController();
    ctrl.setConnected(2, 'session-abc');
    expect(ctrl.getState()).toBe('IN_ROOM_WAIT');
});

// ===== AC-3: phase=dealing → DEALING + showDealAnimation =====
test('AC-3: STATE dealing → DEALING + 发牌动画', () => {
    const { ctrl, ui } = makeController();
    emit('STATE', { phase: 'dealing' });
    expect(ctrl.getState()).toBe('DEALING');
    expect(ui.handCardView.showDealAnimation).toHaveBeenCalled();
});

// ===== AC-4: phase=landlord_select → LANDLORD_SELECT；地主显示暗号牌选择器 =====
test('AC-4a: STATE landlord_select → LANDLORD_SELECT', () => {
    const { ctrl } = makeController();
    ctrl.setConnected(0, 'session-xyz');
    emit('STATE', { phase: 'landlord_select', landlordSessionId: 'other' });
    expect(ctrl.getState()).toBe('LANDLORD_SELECT');
});

test('AC-4b: 本人是地主 → codeCardSelector.show()', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(0, 'session-landlord');
    emit('STATE', { phase: 'landlord_select', landlordSessionId: 'session-landlord' });
    expect(ui.codeCardSelector.show).toHaveBeenCalled();
});

test('AC-4c: 本人不是地主 → codeCardSelector 不触发', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(1, 'session-farmer');
    emit('STATE', { phase: 'landlord_select', landlordSessionId: 'session-landlord' });
    expect(ui.codeCardSelector.show).not.toHaveBeenCalled();
});

// ===== AC-5: phase=playing → PLAYING + 手牌区可交互 =====
test('AC-5: STATE playing → PLAYING + playZone 可交互', () => {
    const { ctrl, ui } = makeController();
    emit('STATE', { phase: 'playing' });
    expect(ctrl.getState()).toBe('PLAYING');
    expect(ui.playZone.setInteractable).toHaveBeenCalledWith(true);
});

// ===== TASK-027 AC-1: DOUBLING 枚举存在 =====
test('TASK-027 AC-1: ClientGameState 包含 DOUBLING', () => {
    const { ctrl } = makeController();
    // state 不会直接是 DOUBLING 除非收到 DOUBLING_START 消息
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 1 });
    expect(ctrl.getState()).toBe('DOUBLING');
});

// ===== TASK-027 AC-2: DOUBLING_START → state=DOUBLING + doublingView.show() =====
test('TASK-027 AC-2: DOUBLING_START → DOUBLING + doublingView.show(msg)', () => {
    const { ctrl, ui } = makeController();
    const msg = { timeout: 30, landlordSeatIndex: 2 };
    emit('DOUBLING_START', msg);
    expect(ctrl.getState()).toBe('DOUBLING');
    expect(ui.doublingView.show).toHaveBeenCalledWith(msg);
});

test('TASK-027 AC-2b: DOUBLING_START 注入 _onSetDouble → 调用 netManager.setDouble', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(0, 'me');
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 0 });
    // _onSetDouble 被注入，调用它应触发 netManager.setDouble
    ui.doublingView._onSetDouble(2);
    expect(ui.netManager.setDouble).toHaveBeenCalledWith(2);
});

// ===== TASK-027 AC-3: LANDLORD_DOUBLED → doublingView.onLandlordDoubled =====
test('TASK-027 AC-3: LANDLORD_DOUBLED → doublingView.onLandlordDoubled(msg), 不切换状态', () => {
    const { ctrl, ui } = makeController();
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 1 });
    const msg = { value: 2 };
    emit('LANDLORD_DOUBLED', msg);
    expect(ui.doublingView.onLandlordDoubled).toHaveBeenCalledWith(msg);
    expect(ctrl.getState()).toBe('DOUBLING');  // 状态不变
});

// ===== TASK-027 AC-4: DOUBLING_RESULT → doublingView.onResult =====
test('TASK-027 AC-4: DOUBLING_RESULT → doublingView.onResult(msg)', () => {
    const { ctrl, ui } = makeController();
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 1 });
    const msg = { results: [{ seatIndex: 0, doubled: false }] };
    emit('DOUBLING_RESULT', msg);
    expect(ui.doublingView.onResult).toHaveBeenCalledWith(msg);
});

// ===== TASK-027 AC-5: STATE playing（从 DOUBLING）→ doublingView.hide() =====
test('TASK-027 AC-5: STATE playing → doublingView.hide() 被调用', () => {
    const { ui } = makeController();
    emit('DOUBLING_START', { timeout: 30, landlordSeatIndex: 1 });
    emit('STATE', { phase: 'playing' });
    expect(ui.doublingView.hide).toHaveBeenCalled();
});

// ===== TASK-027: setConnected 后 doublingView._mySeatIndex 同步 =====
test('TASK-027: setConnected → doublingView._mySeatIndex 更新', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(3, 'session-x');
    expect(ui.doublingView._mySeatIndex).toBe(3);
});

// ===== AC-6: phase=settlement → SETTLEMENT + 出牌区禁用 + 结算界面 =====
test('AC-6: STATE settlement → SETTLEMENT + playZone 禁用 + settlementView.show()', () => {
    const { ctrl, ui } = makeController();
    emit('STATE', { phase: 'settlement' });
    expect(ctrl.getState()).toBe('SETTLEMENT');
    expect(ui.playZone.setInteractable).toHaveBeenCalledWith(false);
    expect(ui.settlementView.show).toHaveBeenCalled();
});

// ===== AC-7: HAND → handCardView.render =====
test('AC-7: HAND 事件 → handCardView.render(cards)', () => {
    const { ui } = makeController();
    emit('HAND', { cards: [1, 2, 3] });
    expect(ui.handCardView.render).toHaveBeenCalledWith([1, 2, 3]);
});

// ===== AC-8: TURN → currentSeat 更新，本人回合激活按钮 =====
test('AC-8a: TURN 轮到本人 → 激活出牌/不要按钮 + 倒计时', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(2, 'session-me');
    emit('TURN', { seatIndex: 2, deadline: 30000 });
    expect(ui.playZone.setPlayButtonEnabled).toHaveBeenCalledWith(true);
    expect(ui.playZone.setPassButtonEnabled).toHaveBeenCalledWith(true);
    expect(ui.playZone.startCountdown).toHaveBeenCalledWith(30000);
});

test('AC-8b: TURN 非本人回合 → 按钮禁用', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(2, 'session-me');
    emit('TURN', { seatIndex: 3, deadline: 30000 });
    expect(ui.playZone.setPlayButtonEnabled).toHaveBeenCalledWith(false);
    expect(ui.playZone.setPassButtonEnabled).toHaveBeenCalledWith(false);
    expect(ui.playZone.startCountdown).not.toHaveBeenCalled();
});

// ===== AC-9: PLAY → playZone.showLastPlay =====
test('AC-9: PLAY 事件 → playZone.showLastPlay(playerId, cards)', () => {
    const { ui } = makeController();
    emit('PLAY', { playerId: 'p1', cards: [10, 11] });
    expect(ui.playZone.showLastPlay).toHaveBeenCalledWith('p1', [10, 11]);
});

// ===== AC-10: REVEAL → playerSeat.showIdentity =====
test('AC-10: REVEAL 事件 → playerSeats[*].showIdentity(playerId, role)', () => {
    const { ui } = makeController();
    emit('REVEAL', { playerId: 'p2', role: 'landlord' });
    const called = ui.playerSeats.filter(s => s.showIdentity.mock.calls.length > 0);
    expect(called.length).toBeGreaterThan(0);
    expect(called[0].showIdentity).toHaveBeenCalledWith('p2', 'landlord');
});

// ===== AC-11: OVER → settlementView.showResult =====
test('AC-11: OVER 事件 → settlementView.showResult(data)', () => {
    const { ui } = makeController();
    const data = { winnerCamp: 1, scores: {} };
    emit('OVER', data);
    expect(ui.settlementView.showResult).toHaveBeenCalledWith(data);
});

// ===== AC-12: ERROR 1001 → 牌型不合法提示 =====
test('AC-12: ERROR 1001 → playZone.showError("牌型不合法")', () => {
    const { ui } = makeController();
    emit('ERROR', { code: 1001, msg: 'invalid pattern' });
    expect(ui.playZone.showError).toHaveBeenCalledWith('牌型不合法');
});

// ===== AC-13: ERROR 1002 → 压不过上家提示 =====
test('AC-13: ERROR 1002 → playZone.showError("压不过上家")', () => {
    const { ui } = makeController();
    emit('ERROR', { code: 1002, msg: 'cannot beat' });
    expect(ui.playZone.showError).toHaveBeenCalledWith('压不过上家');
});

// ===== AC-14: ERROR 1003 → 静默忽略 =====
test('AC-14: ERROR 1003 → 不触发任何提示', () => {
    const { ui } = makeController();
    emit('ERROR', { code: 1003, msg: 'not your turn' });
    expect(ui.playZone.showError).not.toHaveBeenCalled();
});

// ===== AC-15/16: 出牌预检 =====
test('AC-15: 选中牌型非法 → showError，不调用 playCards', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(0, 'me');
    emit('TURN', { seatIndex: 0, deadline: 30000 });
    ui.handCardView.getSelectedCards.mockReturnValue([1, 5]); // 非法组合
    ctrl.onPlayButtonClick();
    expect(ui.playZone.showError).toHaveBeenCalledWith('牌型不合法');
    expect(ui.netManager.playCards).not.toHaveBeenCalled();
});

test('AC-16: 选中合法牌型 → 调用 netManager.playCards', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(0, 'me');
    emit('TURN', { seatIndex: 0, deadline: 30000 });
    ui.handCardView.getSelectedCards.mockReturnValue([0]); // 单张，合法
    ctrl.onPlayButtonClick();
    expect(ui.netManager.playCards).toHaveBeenCalledWith([0]);
});

// ===== AC-17: 不要按钮 =====
test('AC-17: onPassButtonClick → netManager.pass()', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(1, 'me');
    emit('TURN', { seatIndex: 1, deadline: 30000 });
    ctrl.onPassButtonClick();
    expect(ui.netManager.pass).toHaveBeenCalled();
});

// ===== AC-18: 非本人回合，出牌/不要不触发 =====
test('AC-18: 非本人回合时出牌/不要静默忽略', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(1, 'me');
    emit('TURN', { seatIndex: 3, deadline: 30000 }); // 不是 seat 1
    ctrl.onPlayButtonClick();
    ctrl.onPassButtonClick();
    expect(ui.netManager.playCards).not.toHaveBeenCalled();
    expect(ui.netManager.pass).not.toHaveBeenCalled();
});

// ===== AC-19: 地主提交暗号牌 =====
test('AC-19: onCodeCardSelect → netManager.selectCodeCard(suit, value)', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(0, 'me');
    emit('STATE', { phase: 'landlord_select', landlordSessionId: 'me' });
    ctrl.onCodeCardSelect('heart', 3);
    expect(ui.netManager.selectCodeCard).toHaveBeenCalledWith('heart', 3);
});

// ===== AC-20: 非法暗号牌点数过滤（J/Q/K/A/2/王） =====
test('AC-20: 非法暗号牌点数 → 不调用 selectCodeCard', () => {
    const { ctrl, ui } = makeController();
    ctrl.setConnected(0, 'me');
    emit('STATE', { phase: 'landlord_select', landlordSessionId: 'me' });
    // J=11, Q=12, K=13, A=14, 2=15, 王=16/17
    for (const v of [11, 12, 13, 14, 15, 16, 17]) {
        ctrl.onCodeCardSelect('spade', v);
    }
    expect(ui.netManager.selectCodeCard).not.toHaveBeenCalled();
});

// ===== onDestroy 注销监听 =====
test('onDestroy: 注销全部 oops.message 监听', () => {
    const { ctrl } = makeController();
    ctrl.onDestroy();
    expect(mockOff).toHaveBeenCalledTimes(13); // +REMATCH_UPDATE/REMATCH_START/REMATCH_REDIRECT
});

// ===== TASK-031c: REMATCH 消息路由 =====
test('TASK-031c: REMATCH_UPDATE → settlementView.onRematchUpdate', () => {
    const { ctrl, ui } = makeController();
    ui.settlementView.onRematchUpdate = jest.fn();
    emit('REMATCH_UPDATE', { agreedCount: 2, total: 5 });
    expect(ui.settlementView.onRematchUpdate).toHaveBeenCalledWith({ agreedCount: 2, total: 5 });
});

test('TASK-031c: REMATCH_START → settlementView.onRematchStart', () => {
    const { ctrl, ui } = makeController();
    ui.settlementView.onRematchStart = jest.fn();
    emit('REMATCH_START', {});
    expect(ui.settlementView.onRematchStart).toHaveBeenCalledTimes(1);
});

test('TASK-031c: REMATCH_REDIRECT → settlementView.onRematchRedirect', () => {
    const { ctrl, ui } = makeController();
    ui.settlementView.onRematchRedirect = jest.fn();
    emit('REMATCH_REDIRECT', { action: 'requeue' });
    expect(ui.settlementView.onRematchRedirect).toHaveBeenCalledWith({ action: 'requeue' });
});
