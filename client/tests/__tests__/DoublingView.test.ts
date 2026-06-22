import { DoublingView, DoublingStartMsg, LandlordDoubledMsg, DoublingResultMsg } from '../ui/DoublingView';

// ---- 构造辅助 ----
function makeView(mySeat = 0) {
    const view = new DoublingView();
    view._mySeatIndex = mySeat;

    // Fake timers
    const intervalCbs: Array<() => void> = [];
    const timeoutCbs:  Array<() => void> = [];

    view._setInterval   = jest.fn((fn: () => void) => { intervalCbs.push(fn); return intervalCbs.length - 1; }) as any;
    view._clearInterval = jest.fn();
    view._setTimeout    = jest.fn((fn: () => void) => { timeoutCbs.push(fn); return timeoutCbs.length - 1; }) as any;

    const tickInterval = () => intervalCbs[intervalCbs.length - 1]?.();
    const fireTimeout  = () => timeoutCbs[timeoutCbs.length - 1]?.();

    return { view, tickInterval, fireTimeout };
}

const MSG_START_LANDLORD: DoublingStartMsg = { timeout: 30, landlordSeatIndex: 0 };
const MSG_START_CIVILIAN: DoublingStartMsg = { timeout: 30, landlordSeatIndex: 1 };
const MSG_LANDLORD_DOUBLED: LandlordDoubledMsg = { value: 2 };
const MSG_RESULT: DoublingResultMsg = {
    results: [
        { seatIndex: 0, doubled: false },
        { seatIndex: 1, doubled: true  },
        { seatIndex: 2, doubled: false },
        { seatIndex: 3, doubled: true  },
        { seatIndex: 4, doubled: false },
    ],
};

// ===== AC-8: show() 显示面板并包含倒计时 + 两个按钮 =====
test('AC-8: show() 激活面板，setInterval 启动倒计时', () => {
    const { view } = makeView();
    expect(view._rootNode.active).toBe(false);
    view.show(MSG_START_LANDLORD);
    expect(view._rootNode.active).toBe(true);
    expect(view._setInterval).toHaveBeenCalled();
    expect(view._timerLabel.string).toBe('30');
});

// ===== AC-9: 倒计时每秒递减，归零时禁用按钮 =====
test('AC-9: 倒计时递减，归零时按钮禁用', () => {
    const { view, tickInterval } = makeView();
    view.show({ timeout: 3, landlordSeatIndex: 0 });   // 本机是地主，按钮初始启用

    tickInterval(); expect(view._timerLabel.string).toBe('2');
    tickInterval(); expect(view._timerLabel.string).toBe('1');
    tickInterval(); expect(view._timerLabel.string).toBe('0');

    expect(view._singleBtn.interactable).toBe(false);
    expect(view._doubleBtn.interactable).toBe(false);
});

// ===== AC-10: 本机是地主 → 按钮立即可点击 =====
test('AC-10: 本机是地主 → 按钮立即可点击', () => {
    const { view } = makeView(0);
    view.show(MSG_START_LANDLORD);   // landlordSeatIndex === _mySeatIndex === 0
    expect(view._singleBtn.interactable).toBe(true);
    expect(view._doubleBtn.interactable).toBe(true);
});

// ===== AC-11: 本机不是地主 → 按钮禁用，状态文字「等待地主选择…」=====
test('AC-11: 本机不是地主 → 按钮禁用 + 状态「等待地主选择…」', () => {
    const { view } = makeView(0);
    view.show(MSG_START_CIVILIAN);   // landlordSeatIndex=1, mySeat=0
    expect(view._singleBtn.interactable).toBe(false);
    expect(view._doubleBtn.interactable).toBe(false);
    expect(view._statusLabel.string).toBe('等待地主选择…');
});

// ===== AC-12: LANDLORD_DOUBLED → 展示地主选择，非地主解锁按钮 =====
test('AC-12: onLandlordDoubled → 状态文字更新，非地主按钮解锁', () => {
    const { view } = makeView(0);
    view.show(MSG_START_CIVILIAN);
    expect(view._singleBtn.interactable).toBe(false);

    view.onLandlordDoubled(MSG_LANDLORD_DOUBLED);
    expect(view._statusLabel.string).toBe('地主选择 ×2');
    expect(view._singleBtn.interactable).toBe(true);
    expect(view._doubleBtn.interactable).toBe(true);
});

test('AC-12b: onLandlordDoubled 后本机已提交 → 不重新解锁按钮', () => {
    const { view } = makeView(0);
    view.show(MSG_START_CIVILIAN);
    view.onLandlordDoubled(MSG_LANDLORD_DOUBLED);   // unlock
    view.onSingleClick();                            // submit → buttons off + _submitted=true
    view.onLandlordDoubled(MSG_LANDLORD_DOUBLED);   // should NOT unlock again
    expect(view._singleBtn.interactable).toBe(false);
});

// ===== AC-13: 点击按钮 → 调用 _onSetDouble，两个按钮禁用（防重复提交）=====
test('AC-13: onSingleClick → _onSetDouble(1)，按钮禁用', () => {
    const { view } = makeView(0);
    const onSetDouble = jest.fn();
    view._onSetDouble = onSetDouble;
    view.show(MSG_START_LANDLORD);

    view.onSingleClick();
    expect(onSetDouble).toHaveBeenCalledWith(1);
    expect(view._singleBtn.interactable).toBe(false);
    expect(view._doubleBtn.interactable).toBe(false);
});

test('AC-13b: onDoubleClick → _onSetDouble(2)，按钮禁用', () => {
    const { view } = makeView(0);
    const onSetDouble = jest.fn();
    view._onSetDouble = onSetDouble;
    view.show(MSG_START_LANDLORD);

    view.onDoubleClick();
    expect(onSetDouble).toHaveBeenCalledWith(2);
    expect(view._singleBtn.interactable).toBe(false);
});

test('AC-13c: 重复点击只触发一次 _onSetDouble', () => {
    const { view } = makeView(0);
    const onSetDouble = jest.fn();
    view._onSetDouble = onSetDouble;
    view.show(MSG_START_LANDLORD);

    view.onSingleClick();
    view.onSingleClick();
    view.onDoubleClick();
    expect(onSetDouble).toHaveBeenCalledTimes(1);
});

// ===== AC-14: DOUBLING_RESULT → 逐座展示，1.5s 后自动隐藏 =====
test('AC-14: onResult → 显示结果区，1.5s 后 hide()', () => {
    const { view, fireTimeout } = makeView(0);
    view.show(MSG_START_LANDLORD);

    view.onResult(MSG_RESULT);
    expect(view._resultLabel.node.active).toBe(true);
    expect(view._resultLabel.string).toContain('座位0: 未加倍 ×1');
    expect(view._resultLabel.string).toContain('座位1: 已加倍 ×2');

    // 面板仍可见，setTimeout 尚未触发
    expect(view._rootNode.active).toBe(true);

    // 模拟 1.5s 后触发 auto-hide
    fireTimeout();
    expect(view._rootNode.active).toBe(false);
});

// ===== AC-15: STATE → PLAYING 时 hide() 立即隐藏 =====
test('AC-15: hide() 关闭面板 + 停止倒计时', () => {
    const { view } = makeView(0);
    view.show(MSG_START_LANDLORD);
    expect(view._rootNode.active).toBe(true);

    view.hide();
    expect(view._rootNode.active).toBe(false);
    expect(view._clearInterval).toHaveBeenCalled();
});

test('AC-15b: 已隐藏时再次调用 hide() 不抛出', () => {
    const { view } = makeView(0);
    expect(() => view.hide()).not.toThrow();
});

// ===== AC-16: 断线重连 → show() 重新展示，倒计时从剩余秒数恢复 =====
test('AC-16: 断线重连 — 再次 show() 用服务端剩余时间重置倒计时', () => {
    const { view } = makeView(0);
    view.show({ timeout: 30, landlordSeatIndex: 0 });   // 首次显示

    // 模拟断线后重连，服务端剩余 15 秒
    view.show({ timeout: 15, landlordSeatIndex: 0 });
    expect(view._timerLabel.string).toBe('15');
    expect(view._setInterval).toHaveBeenCalledTimes(2);  // 重置了 interval
    expect(view._clearInterval).toHaveBeenCalled();      // 清掉旧的
});

// ===== 防御：按钮禁用时点击不触发 _onSetDouble =====
test('按钮未解锁时（非地主未等到 landlord_doubled）点击静默忽略', () => {
    const { view } = makeView(0);
    const onSetDouble = jest.fn();
    view._onSetDouble = onSetDouble;
    view.show(MSG_START_CIVILIAN);   // mySeat=0, landlord=1 → 按钮禁用

    view.onSingleClick();
    expect(onSetDouble).not.toHaveBeenCalled();
});
