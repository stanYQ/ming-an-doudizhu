/**
 * TASK-035: GameSceneManager 行为测试
 * 覆盖 AC-1 / AC-6 / AC-7
 */

// 'cc' 通过 moduleNameMapper 自动重定向到 tests/__mocks__/cc.ts，无需显式 jest.mock
jest.mock('db://oops-framework/core/common/event/MessageManager', () => ({
    message: { on: jest.fn(), off: jest.fn(), dispatchEvent: jest.fn() },
}));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));
jest.mock('colyseus.js', () => ({ Client: jest.fn() }));

// Mock netManager singleton — GameSceneManager 使用 private _net = netManager
jest.mock('../net/NetManager', () => ({
    netManager: {
        room:   null as any,
        client: null as any,
        init:   jest.fn(),
    },
}));

import { netManager }       from '../net/NetManager';
import { GameSceneManager } from '../scenes/GameSceneManager';

// ── 基础 mock 对象 ────────────────────────────────────────────────────────────

function makeGameController() {
    return {
        setConnected:   jest.fn(),
        handCardView:   null as any,
        playZone:       null as any,
        playerSeats:    null as any,
        codeCardSelector: null as any,
        settlementView: null as any,
        doublingView:   null as any,
        netManager:     null as any,
    };
}

/** 创建 GameSceneManager，覆盖所有私有 builder 方法避免 @property undefined 引用 */
function makeManager() {
    const manager = new GameSceneManager() as any;
    manager._buildHandCardView   = jest.fn(() => ({}));
    manager._buildPlayZone       = jest.fn(() => ({}));
    manager._buildSeats          = jest.fn(() => []);
    manager._buildCodeSelector   = jest.fn(() => ({}));
    manager._buildSettlementView = jest.fn(() => ({}));
    manager._buildDoublingView   = jest.fn(() => ({}));
    manager.gameController       = makeGameController();
    return manager;
}

beforeEach(() => {
    jest.clearAllMocks();
    // 每次测试前给 netManager 设置默认 client（模拟 HallScene 已 init）
    (netManager as any).client = { auth: { token: 'hall-token' } };
    (netManager as any).room   = null;
    // 重置 init 为无副作用的 jest.fn
    (netManager.init as jest.Mock).mockReset();
});

// ───────────────────────────────────────────────────────────────────────────
// AC-1: onLoad() 从 netManager.room 获取 mySeatIndex + mySessionId 并调用 setConnected
// ───────────────────────────────────────────────────────────────────────────

test('TASK-035 AC-1: onLoad() 调用 gameController.setConnected(mySeatIndex, mySessionId)', () => {
    // Arrange: room 已由 HallScene 建立，state.players 含本人席位信息
    (netManager as any).room = {
        sessionId: 'player-sess-abc',
        state: {
            players: new Map([['player-sess-abc', { seatIndex: 3 }]]),
        },
    };

    const manager = makeManager();
    manager.onLoad();

    expect(manager.gameController.setConnected).toHaveBeenCalledWith(3, 'player-sess-abc');
});

test('TASK-035 AC-1b: room 为 null 时 setConnected 不调用（防止 crash）', () => {
    (netManager as any).room = null;
    const manager = makeManager();
    expect(() => manager.onLoad()).not.toThrow();
    expect(manager.gameController.setConnected).not.toHaveBeenCalled();
});

// ───────────────────────────────────────────────────────────────────────────
// AC-6: GameSceneManager.onLoad() 不再调用 netManager.init()
// ───────────────────────────────────────────────────────────────────────────

test('TASK-035 AC-6: onLoad() 不调用 netManager.init()（singleton 已由 HallScene 初始化）', () => {
    const manager = makeManager();
    manager.onLoad();
    expect(netManager.init).not.toHaveBeenCalled();
});

// ───────────────────────────────────────────────────────────────────────────
// AC-7: GameScene 加载后 netManager.client 仍是 HallScene 设置的同一实例
// ───────────────────────────────────────────────────────────────────────────

test('TASK-035 AC-7: onLoad() 后 netManager.client 引用不变（未重新 init）', () => {
    // 模拟 init() 真实副作用：替换 client
    (netManager.init as jest.Mock).mockImplementation(() => {
        (netManager as any).client = { auth: { token: '' } };
    });

    const originalClient = netManager.client;
    const manager = makeManager();
    manager.onLoad();

    // 若 init() 未被调用，client 引用不变
    expect(netManager.client).toBe(originalClient);
});
