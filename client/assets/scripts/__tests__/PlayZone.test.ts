jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { PlayZone } from '../ui/PlayZone';

function makeZone(): PlayZone {
    const z = new PlayZone();
    z._playBtn  = { interactable: true, node: { active: true } };
    z._passBtn  = { interactable: true, node: { active: true } };
    z._errorLabel = { string: '', node: { active: false } };
    z._timerLabel = { string: '' };
    return z;
}

describe('PlayZone — 出牌区', () => {
    test('AC-12: showLastPlay 记录 playerId 和 cards', () => {
        const z = makeZone();
        z.showLastPlay('p1', [0, 1]);
        expect(z.getLastPlayerId()).toBe('p1');
        expect(z.getLastCards()).toEqual([0, 1]);
    });

    test('AC-13: clear 清空出牌区状态', () => {
        const z = makeZone();
        z.showLastPlay('p1', [0, 1]);
        z.clear();
        expect(z.getLastPlayerId()).toBe('');
        expect(z.getLastCards()).toEqual([]);
    });

    test('setPlayButtonEnabled(true/false) 控制出牌按钮', () => {
        const z = makeZone();
        z.setPlayButtonEnabled(false);
        expect(z._playBtn.interactable).toBe(false);
        z.setPlayButtonEnabled(true);
        expect(z._playBtn.interactable).toBe(true);
    });

    test('setPassButtonEnabled(true/false) 控制不要按钮', () => {
        const z = makeZone();
        z.setPassButtonEnabled(false);
        expect(z._passBtn.interactable).toBe(false);
        z.setPassButtonEnabled(true);
        expect(z._passBtn.interactable).toBe(true);
    });

    test('setInteractable(false) 同时禁用两个按钮', () => {
        const z = makeZone();
        z.setInteractable(false);
        expect(z._playBtn.interactable).toBe(false);
        expect(z._passBtn.interactable).toBe(false);
    });

    test('setInteractable(true) 同时启用两个按钮', () => {
        const z = makeZone();
        z.setInteractable(false);
        z.setInteractable(true);
        expect(z._playBtn.interactable).toBe(true);
        expect(z._passBtn.interactable).toBe(true);
    });

    test('showError 设置 errorLabel 文本并显示', () => {
        const z = makeZone();
        z.showError('牌型不合法');
        expect(z._errorLabel.string).toBe('牌型不合法');
        expect(z._errorLabel.node.active).toBe(true);
    });

    test('startCountdown 记录 deadline', () => {
        const z = makeZone();
        z.startCountdown(30000);
        expect(z.getDeadline()).toBe(30000);
    });
});
