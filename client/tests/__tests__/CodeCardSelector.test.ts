jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { CodeCardSelector, CodeCardChoice } from '../ui/view/CodeCardSelector';

function makeSelector(): CodeCardSelector {
    const sel = new CodeCardSelector();
    sel._confirmBtn = { interactable: false };
    sel._rootNode   = { active: false };
    return sel;
}

describe('CodeCardSelector — 合法格子', () => {
    test('AC-8/AC-9: getValidRanks 只包含 0-7（3-10），共 8 个点数', () => {
        const sel = makeSelector();
        const ranks = sel.getValidRanks();
        expect(ranks.length).toBe(8);
        expect(ranks).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    test('AC-8: getValidSuits 包含 4 个花色', () => {
        const sel = makeSelector();
        expect(sel.getValidSuits().length).toBe(4);
    });
});

describe('CodeCardSelector — show / hide', () => {
    test('AC-8: show 后 rootNode 显示', () => {
        const sel = makeSelector();
        sel.show();
        expect(sel._rootNode.active).toBe(true);
    });

    test('AC-13: hide 后 rootNode 隐藏', () => {
        const sel = makeSelector();
        sel.show();
        sel.hide();
        expect(sel._rootNode.active).toBe(false);
    });

    test('AC-13: hide 清空选中', () => {
        const sel = makeSelector();
        sel.show();
        sel.selectCell(0, 0);
        sel.hide();
        expect(sel.getSelectedChoice()).toBeNull();
    });
});

describe('CodeCardSelector — 选格子', () => {
    test('AC-10: selectCell 后 getSelectedChoice 返回该格子', () => {
        const sel = makeSelector();
        sel.show();
        sel.selectCell(1, 3);
        const choice = sel.getSelectedChoice();
        expect(choice).not.toBeNull();
        expect(choice!.suit).toBe(1);
        expect(choice!.rank).toBe(3);
    });

    test('AC-10: selectCell 后确定按钮可点', () => {
        const sel = makeSelector();
        sel.show();
        sel.selectCell(0, 0);
        expect(sel._confirmBtn.interactable).toBe(true);
    });

    test('AC-11: 未选中时确定按钮禁用', () => {
        const sel = makeSelector();
        sel.show();
        expect(sel._confirmBtn.interactable).toBe(false);
    });

    test('AC-9: selectCell 非法点数（rank=8）不选中', () => {
        const sel = makeSelector();
        sel.show();
        sel.selectCell(0, 8); // J = rank 8，非法
        expect(sel.getSelectedChoice()).toBeNull();
        expect(sel._confirmBtn.interactable).toBe(false);
    });
});

describe('CodeCardSelector — 确认回调', () => {
    test('AC-12: confirmSelection 调用 onConfirm 回调', () => {
        const sel = makeSelector();
        const cb = jest.fn();
        sel.onConfirm = cb;
        sel.show();
        sel.selectCell(2, 5);
        sel.confirmSelection();
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith({ suit: 2, rank: 5 });
    });

    test('AC-11: 未选中时 confirmSelection 不触发回调', () => {
        const sel = makeSelector();
        const cb = jest.fn();
        sel.onConfirm = cb;
        sel.show();
        sel.confirmSelection(); // 无选中
        expect(cb).not.toHaveBeenCalled();
    });
});
