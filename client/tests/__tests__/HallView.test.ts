jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { HallView, HallPlayerInfo } from '../ui/HallView';

const baseInfo: HallPlayerInfo = {
    nickname: '测试玩家', avatarUrl: '', score: 1500, rankLevel: 'gold',
};

function makeView() {
    const v = new HallView();
    v._nicknameLabel = { string: '' };
    v._scoreLabel    = { string: '' };
    v._rankLabel     = { string: '' };
    v._rootNode      = { active: false };
    v._quickMatchBtn = { interactable: true };
    v._friendRoomBtn = { interactable: true };
    v._navigateToLogin = jest.fn();
    v._matchView = {
        showQuickMatch: jest.fn(),
        showFriendRoom: jest.fn(),
    };
    return v;
}

describe('HallView — 展示信息', () => {
    test('AC-1: show 设置昵称、积分、段位', () => {
        const v = makeView();
        v.show(baseInfo);
        expect(v._nicknameLabel.string).toBe('测试玩家');
        expect(v._scoreLabel.string).toBe('1500');
        expect(v._rankLabel.string).toBe('gold');
    });

    test('AC-1: show 激活 rootNode', () => {
        const v = makeView();
        v.show(baseInfo);
        expect(v._rootNode.active).toBe(true);
    });

    test('AC-5: show(null) → 跳转登录页', () => {
        const v = makeView();
        v.show(null);
        expect(v._navigateToLogin).toHaveBeenCalledTimes(1);
        expect(v._rootNode.active).toBe(false);
    });

    test('hide 关闭 rootNode', () => {
        const v = makeView();
        v.show(baseInfo);
        v.hide();
        expect(v._rootNode.active).toBe(false);
    });
});

describe('HallView — 按钮跳转', () => {
    test('AC-3: onQuickMatchClick → matchView.showQuickMatch', () => {
        const v = makeView();
        v.show(baseInfo);
        v.onQuickMatchClick();
        expect(v._matchView!.showQuickMatch).toHaveBeenCalledTimes(1);
    });

    test('AC-4: onFriendRoomClick → matchView.showFriendRoom', () => {
        const v = makeView();
        v.show(baseInfo);
        v.onFriendRoomClick();
        expect(v._matchView!.showFriendRoom).toHaveBeenCalledTimes(1);
    });
});

describe('HallView — 设置', () => {
    test('AC-6: onSettingsClick 切换音效开关', () => {
        const v = makeView();
        v.show(baseInfo);
        const initial = v.getAudioEnabled();
        v.onSettingsClick();
        expect(v.getAudioEnabled()).toBe(!initial);
    });
});
