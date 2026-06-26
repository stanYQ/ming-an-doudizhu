jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { HandCardView } from '../ui/view/HandCardView';
import { PatternType } from '../shared/CardPattern';

// Card encoding helpers (3♠=0, 4♠=4, 5♠=8 ... 对应 rank 0-12 * 4 + suit)
// Single cards: 0(3♠), 4(4♠), 8(5♠), 12(6♠)
// Pair: [0,1] = 3♠+3♥

function makeView(): HandCardView {
    const v = new HandCardView();
    // mock CC Node pool & button/label stubs
    v._playButton   = { interactable: true };
    v._patternLabel = { string: '' };
    return v;
}

describe('HandCardView — 手牌渲染', () => {
    test('AC-1: render 设置内部 cards', () => {
        const v = makeView();
        v.render([8, 0, 4]);
        expect(v.getCards().length).toBe(3);
    });

    test('AC-3: render 后手牌按 compareValue 升序排列', () => {
        const v = makeView();
        v.render([8, 0, 4]); // 5♠ 3♠ 4♠
        const sorted = v.getCards();
        expect(sorted[0]).toBe(0);  // 3♠ 最小
        expect(sorted[1]).toBe(4);  // 4♠
        expect(sorted[2]).toBe(8);  // 5♠ 最大
    });

    test('AC-1 边界: render([]) 清空手牌', () => {
        const v = makeView();
        v.render([0, 4]);
        v.render([]);
        expect(v.getCards().length).toBe(0);
    });

    test('AC-8: render 24 张地主手牌不报错', () => {
        const v = makeView();
        const cards = Array.from({ length: 24 }, (_, i) => i);
        expect(() => v.render(cards)).not.toThrow();
        expect(v.getCards().length).toBe(24);
    });
});

describe('HandCardView — 选牌交互', () => {
    test('AC-4: 点击牌 → 选中；再点 → 取消', () => {
        const v = makeView();
        v.render([0, 4, 8]);
        v.selectCard(0);
        expect(v.getSelectedCards()).toContain(0);
        v.selectCard(0);
        expect(v.getSelectedCards()).not.toContain(0);
    });

    test('AC-6: getSelectedCards 返回选中编码数组', () => {
        const v = makeView();
        v.render([0, 4, 8]);
        v.selectCard(0);
        v.selectCard(2);
        expect(v.getSelectedCards()).toEqual(expect.arrayContaining([0, 8]));
        expect(v.getSelectedCards().length).toBe(2);
    });

    test('AC-7: clearSelection 清空选中并还原', () => {
        const v = makeView();
        v.render([0, 4, 8]);
        v.selectCard(0);
        v.selectCard(1);
        v.clearSelection();
        expect(v.getSelectedCards().length).toBe(0);
    });

    test('AC-9: setInteractable(false) 后选牌无效', () => {
        const v = makeView();
        v.render([0, 4, 8]);
        v.setInteractable(false);
        v.selectCard(0);
        expect(v.getSelectedCards().length).toBe(0);
    });

    test('AC-9: setInteractable(true) 恢复交互', () => {
        const v = makeView();
        v.render([0, 4, 8]);
        v.setInteractable(false);
        v.setInteractable(true);
        v.selectCard(0);
        expect(v.getSelectedCards().length).toBe(1);
    });
});

describe('HandCardView — 牌型提示', () => {
    test('AC-10: 选合法单张 → playButton 高亮可点', () => {
        const v = makeView();
        v.render([0, 4, 8]);
        v.selectCard(0); // 单张 3♠
        expect(v._playButton.interactable).toBe(true);
    });

    test('AC-10: 不选牌 → playButton 置灰', () => {
        const v = makeView();
        v.render([0, 4, 8]);
        // 未选任何牌
        expect(v._playButton.interactable).toBe(false);
    });

    test('AC-10: 选非法组合 → playButton 置灰', () => {
        const v = makeView();
        v.render([0, 4, 8]); // 3♠ 4♠ 5♠ — 三张非顺子（不够5张）
        v.selectCard(0);
        v.selectCard(1);
        v.selectCard(2);
        // 3张不同点数 = INVALID
        expect(v._playButton.interactable).toBe(false);
    });

    test('AC-11: 合法牌型显示牌型名', () => {
        const v = makeView();
        v.render([0, 13]); // 3♠(0) + 3♥(13) = 对子；suit×13+rank 编码，3♥=1×13+0=13
        v.selectCard(0);
        v.selectCard(1);
        expect(v._patternLabel.string).not.toBe('请选择合法牌型');
        expect(v._patternLabel.string.length).toBeGreaterThan(0);
    });

    test('AC-11: 非法牌型显示提示文本', () => {
        const v = makeView();
        v.render([0, 4]);
        // 不选牌
        expect(v._patternLabel.string).toBe('请选择合法牌型');
    });
});

describe('HandCardView — render 后清空选中', () => {
    test('全选后再 render 清空选中', () => {
        const v = makeView();
        v.render([0, 4]);
        v.selectCard(0); v.selectCard(1);
        v.render([8, 12]);
        expect(v.getSelectedCards().length).toBe(0);
    });
});
