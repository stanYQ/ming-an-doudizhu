jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { MatchView } from '../ui/MatchView';

function makeView() {
    const v = new MatchView();
    v._statusLabel     = { string: '' };
    v._playerCountLabel = { string: '' };
    v._roomCodeLabel   = { string: '', node: { active: false } };
    v._copyBtn         = { node: { active: false } };
    v._errorLabel      = { string: '', node: { active: false } };
    v._rootNode        = { active: false };

    v._joinRoom       = jest.fn().mockResolvedValue({ roomCode: undefined });
    v._leaveRoom      = jest.fn().mockResolvedValue(undefined);
    v._navigateToGame = jest.fn();
    v._navigateToHall = jest.fn();
    v._clipboard      = { copy: jest.fn() };

    return v;
}

describe('MatchView — 快速匹配', () => {
    test('AC-7: showQuickMatch 调用 joinRoom("game", { mode:"quick" })', async () => {
        const v = makeView();
        await v.showQuickMatch();
        expect(v._joinRoom).toHaveBeenCalledWith('game', { mode: 'quick' });
    });

    test('AC-7: showQuickMatch 显示界面', async () => {
        const v = makeView();
        await v.showQuickMatch();
        expect(v._rootNode.active).toBe(true);
    });

    test('AC-8: updatePlayerCount 更新人数标签', async () => {
        const v = makeView();
        await v.showQuickMatch();
        v.updatePlayerCount(3);
        expect(v._playerCountLabel.string).toBe('3/5 人已加入');
    });

    test('AC-9: updatePlayerCount(5) → 跳转游戏桌', async () => {
        const v = makeView();
        await v.showQuickMatch();
        v.updatePlayerCount(5);
        expect(v._navigateToGame).toHaveBeenCalledTimes(1);
    });

    test('AC-10: onCancelClick → leaveRoom + 返回大厅', async () => {
        const v = makeView();
        await v.showQuickMatch();
        await v.onCancelClick();
        expect(v._leaveRoom).toHaveBeenCalledTimes(1);
        expect(v._navigateToHall).toHaveBeenCalledTimes(1);
    });

    test('AC-10: 取消后再次发起匹配，状态重置', async () => {
        const v = makeView();
        await v.showQuickMatch();
        await v.onCancelClick();
        await v.showQuickMatch();
        expect(v._joinRoom).toHaveBeenCalledTimes(2);
        expect(v._rootNode.active).toBe(true);
    });
});

describe('MatchView — 好友房（创建）', () => {
    test('AC-11: showFriendRoom 后点「创建」→ joinRoom({ mode:"friend" }) + 显示房间码', async () => {
        const v = makeView();
        (v._joinRoom as jest.Mock).mockResolvedValue({ roomCode: '123456' });
        await v.showFriendRoom();
        await v.onCreateRoomClick();
        expect(v._joinRoom).toHaveBeenCalledWith('game', { mode: 'friend' });
        expect(v._roomCodeLabel.string).toBe('123456');
        expect(v._roomCodeLabel.node.active).toBe(true);
    });

    test('AC-12: onCopyCodeClick 复制房间码到剪贴板', async () => {
        const v = makeView();
        (v._joinRoom as jest.Mock).mockResolvedValue({ roomCode: '654321' });
        await v.showFriendRoom();
        await v.onCreateRoomClick();
        v.onCopyCodeClick();
        expect(v._clipboard.copy).toHaveBeenCalledWith('654321');
    });

    test('AC-13: 好友房等待中 updatePlayerCount 更新人数', async () => {
        const v = makeView();
        (v._joinRoom as jest.Mock).mockResolvedValue({ roomCode: '111111' });
        await v.showFriendRoom();
        await v.onCreateRoomClick();
        v.updatePlayerCount(3);
        expect(v._playerCountLabel.string).toBe('3/5 人已加入');
    });

    test('AC-13: 好友房凑满 5 人自动进入游戏桌', async () => {
        const v = makeView();
        (v._joinRoom as jest.Mock).mockResolvedValue({ roomCode: '222222' });
        await v.showFriendRoom();
        await v.onCreateRoomClick();
        v.updatePlayerCount(5);
        expect(v._navigateToGame).toHaveBeenCalledTimes(1);
    });
});

describe('MatchView — 好友房（加入）', () => {
    test('AC-14: onJoinRoomClick 调用 joinRoom({ roomCode })', async () => {
        const v = makeView();
        await v.showFriendRoom();
        v.setRoomCodeInput('999888');
        await v.onJoinRoomClick();
        expect(v._joinRoom).toHaveBeenCalledWith('game', { roomCode: '999888' });
    });

    test('AC-14: filterRoomCode 过滤非数字字符', () => {
        const v = makeView();
        expect(v.filterRoomCode('abc123')).toBe('123');
        expect(v.filterRoomCode('12-34')).toBe('1234');
        expect(v.filterRoomCode('123456')).toBe('123456');
    });

    test('AC-15: onMatchError(2002) → 提示房间不存在', () => {
        const v = makeView();
        v.onMatchError(2002);
        expect(v._errorLabel.string).toContain('房间不存在');
        expect(v._errorLabel.node.active).toBe(true);
    });

    test('AC-16: onMatchError(2001) → 提示房间已满', () => {
        const v = makeView();
        v.onMatchError(2001);
        expect(v._errorLabel.string).toContain('房间已满');
        expect(v._errorLabel.node.active).toBe(true);
    });
});
