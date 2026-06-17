jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { SettlementView, SettlementData, PlayerResult } from '../ui/SettlementView';

function makeView(): SettlementView {
    const v = new SettlementView();
    v._rootNode      = { active: false };
    v._bannerLabel   = { string: '' };
    v._playAgainBtn  = { interactable: false };
    v._returnHallBtn = { interactable: false };
    return v;
}

const basePlayer = (overrides: Partial<PlayerResult> = {}): PlayerResult => ({
    playerId:   'p1',
    nickname:   '玩家1',
    role:       'civilian',
    scoreDelta: 10,
    isMe:       false,
    ...overrides,
});

const baseData: SettlementData = {
    winnerCamp: 1,
    players: [
        basePlayer({ playerId: 'p1', role: 'landlord', scoreDelta: 40, isMe: false }),
        basePlayer({ playerId: 'p2', role: 'partner',  scoreDelta: 20, isMe: false }),
        basePlayer({ playerId: 'p3', role: 'civilian', scoreDelta: -20, isMe: true }),
        basePlayer({ playerId: 'p4', role: 'civilian', scoreDelta: -20, isMe: false }),
        basePlayer({ playerId: 'p5', role: 'civilian', scoreDelta: -20, isMe: false }),
    ],
    multiplier: 4,
    multiplierDetail: { mode: 1, bombCount: 2, rocketCount: 1 },
};

describe('SettlementView — 显示结果', () => {
    test('AC-1: winnerCamp=1 → 横幅文本含「地主阵营」', () => {
        const v = makeView();
        v.show(baseData);
        expect(v._bannerLabel.string).toContain('地主阵营');
    });

    test('AC-1: winnerCamp=0 → 横幅文本含「平民阵营」', () => {
        const v = makeView();
        v.show({ ...baseData, winnerCamp: 0 });
        expect(v._bannerLabel.string).toContain('平民阵营');
    });

    test('AC-2: getPlayers 返回全部 5 名玩家及身份', () => {
        const v = makeView();
        v.show(baseData);
        const players = v.getPlayers();
        expect(players.length).toBe(5);
        expect(players[0].role).toBe('landlord');
        expect(players[1].role).toBe('partner');
    });

    test('AC-3: 正积分格式化为 +N', () => {
        const v = makeView();
        v.show(baseData);
        expect(v.formatScore(40)).toBe('+40');
    });

    test('AC-3: 负积分格式化为 -N', () => {
        const v = makeView();
        expect(v.formatScore(-20)).toBe('-20');
    });

    test('AC-3: 零积分格式化为 +0', () => {
        const v = makeView();
        expect(v.formatScore(0)).toBe('+0');
    });

    test('AC-4: getMe 返回 isMe=true 的玩家', () => {
        const v = makeView();
        v.show(baseData);
        expect(v.getMe()?.playerId).toBe('p3');
    });

    test('AC-5: getMultiplier 返回总倍率', () => {
        const v = makeView();
        v.show(baseData);
        expect(v.getMultiplier()).toBe(4);
    });

    test('AC-5: getMultiplierDetail 返回倍率明细', () => {
        const v = makeView();
        v.show(baseData);
        const detail = v.getMultiplierDetail();
        expect(detail.bombCount).toBe(2);
        expect(detail.rocketCount).toBe(1);
    });
});

describe('SettlementView — 动画与按钮', () => {
    test('AC-6: show 后 rootNode 激活', () => {
        const v = makeView();
        v.show(baseData);
        expect(v._rootNode.active).toBe(true);
    });

    test('AC-10: show 后按钮禁用（动画期间）', () => {
        const v = makeView();
        v.show(baseData);
        expect(v._playAgainBtn.interactable).toBe(false);
        expect(v._returnHallBtn.interactable).toBe(false);
    });

    test('AC-10: finishAnimation 后按钮启用', () => {
        const v = makeView();
        v.show(baseData);
        v.finishAnimation();
        expect(v._playAgainBtn.interactable).toBe(true);
        expect(v._returnHallBtn.interactable).toBe(true);
    });

    test('AC-10: 动画期间点击「再来一局」无效', () => {
        const v = makeView();
        const cb = jest.fn();
        v.onPlayAgain = cb;
        v.show(baseData);
        v.onPlayAgainClick();  // 动画未完成
        expect(cb).not.toHaveBeenCalled();
    });

    test('AC-8: 动画结束后点击「再来一局」触发回调', () => {
        const v = makeView();
        const cb = jest.fn();
        v.onPlayAgain = cb;
        v.show(baseData);
        v.finishAnimation();
        v.onPlayAgainClick();
        expect(cb).toHaveBeenCalledTimes(1);
    });

    test('AC-9: 动画结束后点击「返回大厅」触发回调', () => {
        const v = makeView();
        const cb = jest.fn();
        v.onReturnHall = cb;
        v.show(baseData);
        v.finishAnimation();
        v.onReturnHallClick();
        expect(cb).toHaveBeenCalledTimes(1);
    });
});

describe('SettlementView — hide + 幂等', () => {
    test('hide 后 rootNode 隐藏', () => {
        const v = makeView();
        v.show(baseData);
        v.hide();
        expect(v._rootNode.active).toBe(false);
    });

    test('show 幂等：第二次调用更新数据', () => {
        const v = makeView();
        v.show(baseData);
        v.show({ ...baseData, multiplier: 8 });
        expect(v.getMultiplier()).toBe(8);
    });
});

describe('SettlementView — 边界', () => {
    test('一挑四：无 partner 玩家时正常展示', () => {
        const v = makeView();
        const soloData: SettlementData = {
            ...baseData,
            players: [
                basePlayer({ role: 'landlord', scoreDelta: 80 }),
                basePlayer({ role: 'civilian', scoreDelta: -20 }),
                basePlayer({ role: 'civilian', scoreDelta: -20 }),
                basePlayer({ role: 'civilian', scoreDelta: -20 }),
                basePlayer({ role: 'civilian', scoreDelta: -20 }),
            ],
        };
        expect(() => v.show(soloData)).not.toThrow();
        expect(v.getPlayers().filter(p => p.role === 'partner').length).toBe(0);
    });
});
