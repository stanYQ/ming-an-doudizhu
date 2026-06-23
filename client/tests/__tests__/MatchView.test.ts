jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { MatchView, WaitingUpdateMsg, RoomUpdateMsg } from '../ui/MatchView';

function makeView() {
    const v = new MatchView();
    v._statusLabel      = { string: '' };
    v._playerCountLabel = { string: '' };
    v._roomCodeLabel    = { string: '', node: { active: false } };
    v._copyBtn          = { node: { active: false } };
    v._errorLabel       = { string: '', node: { active: false } };
    v._rootNode         = { active: false };
    v._aiCountdownNode  = { active: false };
    v._aiCountdownLabel = { string: '' };
    v._cancelBtn        = { interactable: true };
    v._playerListLabels = [{string:''},{string:''},{string:''},{string:''},{string:''}];
    v._startGameBtn     = { interactable: false, node: { active: false } };
    v._ownerHintLabel   = { string: '', node: { active: false } };
    v._shareBtn         = { node: { active: false } };

    v._joinRoom        = jest.fn().mockResolvedValue({ roomCode: undefined });
    v._leaveRoom       = jest.fn().mockResolvedValue(undefined);
    v._navigateToGame  = jest.fn();
    v._navigateToHall  = jest.fn();
    v._clipboard       = { copy: jest.fn() };
    v._forceStart      = jest.fn();
    v._sharePlatform   = jest.fn().mockResolvedValue(undefined);

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

// ===== TASK-029c: 快速匹配 AI 补位（AC-8~11）=====

describe('MatchView — TASK-029c: 快速匹配 AI 补位', () => {
    test('AC-8: onWaitingUpdate 更新人数和倒计时文字', () => {
        const v = makeView();
        v.onWaitingUpdate({ readyCount: 2, total: 5, aiSeconds: 18 });
        expect(v._playerCountLabel.string).toBe('2/5 人已加入');
        expect(v._aiCountdownNode.active).toBe(true);
        expect(v._aiCountdownLabel.string).toBe('18 秒后 AI 补位');
    });

    test('AC-9: aiSeconds=0 → 显示「AI 补位中…」', () => {
        const v = makeView();
        v.onWaitingUpdate({ readyCount: 1, total: 5, aiSeconds: 0 });
        expect(v._aiCountdownLabel.string).toBe('AI 补位中…');
    });

    test('AC-10: readyCount 达到 total → 隐藏倒计时区域', () => {
        const v = makeView();
        v._aiCountdownNode.active = true;
        v.onWaitingUpdate({ readyCount: 5, total: 5, aiSeconds: 0 });
        expect(v._aiCountdownNode.active).toBe(false);
    });

    test('AC-11: onGameStarted 禁用取消按钮，此后 onCancelClick 无效', async () => {
        const v = makeView();
        await v.showQuickMatch();
        v.onGameStarted();
        expect(v._cancelBtn.interactable).toBe(false);
        await v.onCancelClick();
        expect(v._leaveRoom).not.toHaveBeenCalled();
        expect(v._navigateToHall).not.toHaveBeenCalled();
    });
});

// ===== TASK-030c: 好友房等待室（AC-9~16）=====

describe('MatchView — TASK-030c: 好友房等待室', () => {
    const makeRoomUpdate = (count: number, ownerSeatIndex = 0): RoomUpdateMsg => ({
        ownerSeatIndex,
        players: Array.from({ length: count }, (_, i) => ({
            seatIndex: i, nickname: `玩家${i + 1}`, avatarUrl: '', isReady: false,
        })),
    });

    test('AC-9: onRoomUpdate 渲染已进房玩家昵称，空席显示「等待加入…」', () => {
        const v = makeView();
        v._mySeatIndex = 0;
        v.onRoomUpdate(makeRoomUpdate(2));
        expect(v._playerListLabels[0].string).toBe('玩家1');
        expect(v._playerListLabels[1].string).toBe('玩家2');
        expect(v._playerListLabels[2].string).toBe('等待加入…');
    });

    test('AC-10: 本机是房主且人数=1 → 开始按钮可见但禁用', () => {
        const v = makeView();
        v._mySeatIndex = 0;
        v.onRoomUpdate(makeRoomUpdate(1));
        expect(v._startGameBtn.node.active).toBe(true);
        expect(v._startGameBtn.interactable).toBe(false);
    });

    test('AC-10: 本机是房主且人数≥2 → 开始按钮可点击', () => {
        const v = makeView();
        v._mySeatIndex = 0;
        v.onRoomUpdate(makeRoomUpdate(3));
        expect(v._startGameBtn.interactable).toBe(true);
    });

    test('AC-11: onForceStartClick 调用 _forceStart', () => {
        const v = makeView();
        v.onForceStartClick();
        expect(v._forceStart).toHaveBeenCalledTimes(1);
    });

    test('AC-11: onMatchError(2003) → 提示人数不足', () => {
        const v = makeView();
        v.onMatchError(2003);
        expect(v._errorLabel.string).toContain('2名真实玩家');
        expect(v._errorLabel.node.active).toBe(true);
    });

    test('AC-12: 非房主 → 隐藏开始按钮，显示等待提示', () => {
        const v = makeView();
        v._mySeatIndex = 1;  // ownerSeatIndex=0，本机不是房主
        v.onRoomUpdate(makeRoomUpdate(2, 0));
        expect(v._startGameBtn.node.active).toBe(false);
        expect(v._ownerHintLabel.node.active).toBe(true);
    });

    test('AC-14/15/16: onShareClick 调用 _sharePlatform 并传正确文案', async () => {
        const v = makeView();
        (v._joinRoom as jest.Mock).mockResolvedValue({ roomCode: '888888' });
        await v.showFriendRoom();
        await v.onCreateRoomClick();
        await v.onShareClick();
        expect(v._sharePlatform).toHaveBeenCalledWith(
            expect.stringContaining('888888'),
        );
    });

    test('AC-16: _sharePlatform 抛出异常时静默处理', async () => {
        const v = makeView();
        (v._joinRoom as jest.Mock).mockResolvedValue({ roomCode: '777777' });
        (v._sharePlatform as jest.Mock).mockRejectedValueOnce(new Error('user cancelled'));
        await v.showFriendRoom();
        await v.onCreateRoomClick();
        await expect(v.onShareClick()).resolves.toBeUndefined();
    });
});

// ===== TASK-035 AC-12/AC-13: 防重入 _joining 标志 =====

describe('MatchView — TASK-035: 防重入（_joining 标志）', () => {
    // AC-12: showQuickMatch 执行中再次调用静默忽略
    // 原理：两次 showQuickMatch() 同步发起，p1 在 await _joinRoom 处暂停，
    // 此时 p2 被同步调用；若有 _joining 守卫，p2 立即返回不调用 _joinRoom。
    test('TASK-035 AC-12a: showQuickMatch 执行中再次调用静默忽略', async () => {
        const v = makeView();
        v._joinRoom = jest.fn().mockResolvedValue({});

        const p1 = v.showQuickMatch();  // await 暂停，控制权回到调用处
        const p2 = v.showQuickMatch();  // 同步调用，此时 _joining 应为 true

        await Promise.all([p1, p2]);

        expect(v._joinRoom).toHaveBeenCalledTimes(1); // 只发起一次 join
    });

    // AC-12: onCreateRoomClick 同样受 _joining 保护
    test('TASK-035 AC-12b: onCreateRoomClick 执行中再次调用静默忽略', async () => {
        const v = makeView();
        v._joinRoom = jest.fn().mockResolvedValue({});

        const p1 = v.onCreateRoomClick();
        const p2 = v.onCreateRoomClick(); // await 暂停前的同步第二次调用

        await Promise.all([p1, p2]);

        expect(v._joinRoom).toHaveBeenCalledTimes(1);
    });

    // AC-13: joinRoom 成功后 _joining 复位，允许再次匹配
    test('TASK-035 AC-13: joinRoom 完成后 _joining 复位，允许重新发起', async () => {
        const v = makeView();
        v._joinRoom = jest.fn().mockResolvedValue({});

        await v.showQuickMatch();          // 第一次完成
        await v.showQuickMatch();          // 第二次：_joining 已复位，应正常发起

        expect(v._joinRoom).toHaveBeenCalledTimes(2);
    });

    // AC-13b: joinRoom 失败后 _joining 同样复位，允许重试
    test('TASK-035 AC-13b: joinRoom 失败后 _joining 复位，允许重试', async () => {
        const v = makeView();
        v._joinRoom = jest.fn()
            .mockRejectedValueOnce(new Error('network error'))
            .mockResolvedValueOnce({});

        try { await v.showQuickMatch(); } catch { /* 首次失败，预期 */ }
        await v.showQuickMatch(); // 重试

        expect(v._joinRoom).toHaveBeenCalledTimes(2);
    });
});
