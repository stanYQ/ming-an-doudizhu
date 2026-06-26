jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { PlayerSeat, SeatData } from '../ui/view/PlayerSeat';

function makeSeat(index = 0): PlayerSeat {
    const s = new PlayerSeat();
    s.seatIndex = index;
    s._nicknameLabel  = { string: '' };
    s._handCountLabel = { string: '' };
    s._timerNode      = { active: false };
    s._identityBadge  = { string: '', node: { active: false } };
    s._finishedNode   = { active: false };
    return s;
}

const baseData: SeatData = {
    playerId:      'p1',
    nickname:      '测试玩家',
    handCount:     17,
    isCurrentTurn: false,
};

describe('PlayerSeat — update', () => {
    test('AC-1: update 设置昵称和手牌数', () => {
        const s = makeSeat();
        s.update(baseData);
        expect(s._nicknameLabel.string).toBe('测试玩家');
        expect(s._handCountLabel.string).toBe('17');
    });

    test('AC-2: isCurrentTurn=true → 计时节点显示', () => {
        const s = makeSeat();
        s.update({ ...baseData, isCurrentTurn: true, turnDeadline: Date.now() + 30000 });
        expect(s._timerNode.active).toBe(true);
    });

    test('AC-2: isCurrentTurn=false → 计时节点隐藏', () => {
        const s = makeSeat();
        s.update({ ...baseData, isCurrentTurn: false });
        expect(s._timerNode.active).toBe(false);
    });

    test('AC-4: handCount=0 → showFinished 状态', () => {
        const s = makeSeat();
        s.update({ ...baseData, handCount: 0 });
        expect(s._finishedNode.active).toBe(true);
    });

    test('AC-4: handCount>0 → 非 finished 状态', () => {
        const s = makeSeat();
        s.update({ ...baseData, handCount: 1 });
        expect(s._finishedNode.active).toBe(false);
    });
});

describe('PlayerSeat — showIdentity', () => {
    test('AC-3: landlord → 徽章显示 landlord', () => {
        const s = makeSeat();
        s.showIdentity('landlord');
        expect(s._identityBadge.node.active).toBe(true);
        expect(s._identityBadge.string).toBe('landlord');
    });

    test('AC-3: partner → 徽章显示 partner', () => {
        const s = makeSeat();
        s.showIdentity('partner');
        expect(s._identityBadge.node.active).toBe(true);
        expect(s._identityBadge.string).toBe('partner');
    });

    test('AC-3: civilian → 徽章隐藏', () => {
        const s = makeSeat();
        s.showIdentity('civilian');
        expect(s._identityBadge.node.active).toBe(false);
    });

    test('AC-6: showIdentity 后 getIdentity 返回角色', () => {
        const s = makeSeat();
        s.showIdentity('landlord');
        expect(s.getIdentity()).toBe('landlord');
    });
});

describe('PlayerSeat — showFinished', () => {
    test('showFinished 激活 finishedNode', () => {
        const s = makeSeat();
        s.showFinished();
        expect(s._finishedNode.active).toBe(true);
    });
});

describe('PlayerSeat — seatIndex', () => {
    test('AC-5: seatIndex 正确赋值', () => {
        const s = makeSeat(3);
        expect(s.seatIndex).toBe(3);
    });
});
