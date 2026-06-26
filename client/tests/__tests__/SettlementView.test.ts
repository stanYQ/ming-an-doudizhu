jest.mock('cc', () => require('../__mocks__/cc'));
jest.mock('db://oops-framework/core/Oops', () => ({ oops: {} }));

import { SettlementView, SettlementData, PlayerResult, BreakdownV2, GameOverMsg, RematchUpdateMsg } from '../ui/view/SettlementView';

function makeView(): SettlementView {
    const v = new SettlementView();
    v._rootNode            = { active: false };
    v._bannerLabel         = { string: '' };
    v._playAgainBtn        = { interactable: false };
    v._returnHallBtn       = { interactable: false };
    v._rematchStatusLabel  = { string: '', node: { active: false } };
    v._requestRematch      = jest.fn();
    v._leaveRoom           = jest.fn().mockResolvedValue(undefined);
    v._navigateToHall      = jest.fn();
    v._navigateToQuickMatch = jest.fn();
    // 注入假定时器（与 DoublingView 相同模式）
    let timerCb: (() => void) | null = null;
    v._setTimeout  = jest.fn(fn => { timerCb = fn; return 1; });
    v._clearTimeout = jest.fn();
    (v as any)._fireRematchTimeout = () => timerCb?.();
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

    test('AC-8: 动画结束后点击「再来一局」→ 发送 request_rematch', () => {
        const v = makeView();
        v.show(baseData);
        v.finishAnimation();
        v.onPlayAgainClick();
        expect(v._requestRematch).toHaveBeenCalledTimes(1);
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

// ─────────────────────────────────────────────────────────────────────────────
// TASK-028: V2 breakdown 测试
// ─────────────────────────────────────────────────────────────────────────────

const baseBreakdown: BreakdownV2 = {
    baseScore:       2,
    landlordDouble:  1,
    playerDoubles:   { 'p1': 1, 'p2': 1, 'p3': 2, 'p4': 1, 'p5': 1 },
    isLandlordAlone: false,
    isSpring:        false,
    isAntiSpring:    false,
};

const v2Data: SettlementData = {
    ...baseData,
    multiplierDetail: { mode: 1, bombCount: 1, rocketCount: 0 },
    breakdown: { ...baseBreakdown },
};

function makeV2View(): SettlementView {
    const v = makeView();
    v.show(v2Data);
    return v;
}

// ── AC-2: V1 降级兼容 ────────────────────────────────────────────────────────
describe('TASK-028 AC-2: V1 降级兼容', () => {
    test('无 breakdown → hasBreakdown() = false', () => {
        const v = makeView();
        v.show(baseData);  // baseData 无 breakdown
        expect(v.hasBreakdown()).toBe(false);
    });

    test('无 breakdown → getBaseScoreLabel() 返回 空字符串（不报错）', () => {
        const v = makeView();
        v.show(baseData);
        expect(() => v.getBaseScoreLabel()).not.toThrow();
        expect(v.getBaseScoreLabel()).toBe('');
    });

    test('无 breakdown → getMultiplierLines() 返回 []（不报错）', () => {
        const v = makeView();
        v.show(baseData);
        expect(v.getMultiplierLines()).toEqual([]);
    });

    test('无 breakdown → showResult 仅含 winnerCamp，正常显示横幅', () => {
        const v = makeView();
        const msg: GameOverMsg = { winnerCamp: 0 };
        v.showResult(msg);
        expect(v._bannerLabel.string).toContain('平民阵营');
        expect(v.hasBreakdown()).toBe(false);
    });
});

// ── AC-1: showResult 解析 breakdown ─────────────────────────────────────────
describe('TASK-028 AC-1: showResult 解析 V2 消息', () => {
    test('showResult 含 breakdown → hasBreakdown() = true', () => {
        const v = makeView();
        const msg: GameOverMsg = {
            winnerCamp: 1,
            scores: [{ sessionId: 'p1', scoreDelta: 40, newScore: 1040 }],
            multiplier: 2,
            breakdown: baseBreakdown,
        };
        v.showResult(msg);
        expect(v.hasBreakdown()).toBe(true);
        expect(v.getMultiplier()).toBe(2);
    });
});

// ── AC-3: 底分标签 ────────────────────────────────────────────────────────────
describe('TASK-028 AC-3: getBaseScoreLabel', () => {
    test('baseScore=2 → "底分 ×2（休闲场）"', () => {
        const v = makeV2View();
        expect(v.getBaseScoreLabel()).toBe('底分 ×2（休闲场）');
    });

    test('baseScore=1 → "底分 ×1（入门场）"', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, baseScore: 1 } });
        expect(v.getBaseScoreLabel()).toBe('底分 ×1（入门场）');
    });

    test('baseScore=5 → "底分 ×5（精英场）"', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, baseScore: 5 } });
        expect(v.getBaseScoreLabel()).toBe('底分 ×5（精英场）');
    });

    test('baseScore=10 → "底分 ×10（巅峰场）"', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, baseScore: 10 } });
        expect(v.getBaseScoreLabel()).toBe('底分 ×10（巅峰场）');
    });
});

// ── AC-4/5: 倍数明细行（只含触发项）────────────────────────────────────────
describe('TASK-028 AC-4/5: getMultiplierLines', () => {
    test('1 颗炸弹 → 包含 "炸弹 ×2"', () => {
        const v = makeV2View(); // bombCount=1
        expect(v.getMultiplierLines()).toContain('炸弹 ×2');
    });

    test('0 颗炸弹 + 0 王炸 + 未触发特效 → 返回 []', () => {
        const v = makeView();
        v.show({
            ...v2Data,
            multiplierDetail: { mode: 1, bombCount: 0, rocketCount: 0 },
            breakdown: { ...baseBreakdown, isSpring: false, isAntiSpring: false, isLandlordAlone: false },
        });
        expect(v.getMultiplierLines()).toEqual([]);
    });

    test('AC-5: 春天触发 → 包含 "春天 ×2"', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, isSpring: true } });
        expect(v.getMultiplierLines()).toContain('春天 ×2');
    });

    test('AC-5: 反春天触发 → 包含 "反春天 ×2"', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, isAntiSpring: true } });
        expect(v.getMultiplierLines()).toContain('反春天 ×2');
    });

    test('AC-5: 一挑四 → 包含 "一挑四 ×3"', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, isLandlordAlone: true } });
        expect(v.getMultiplierLines()).toContain('一挑四 ×3');
    });

    test('AC-5: 未触发的项不出现在列表中', () => {
        const v = makeV2View(); // spring=false, solo=false
        const lines = v.getMultiplierLines();
        expect(lines).not.toContain('春天 ×2');
        expect(lines).not.toContain('一挑四 ×3');
    });

    test('2 颗炸弹 → 列表中出现 2 次 "炸弹 ×2"', () => {
        const v = makeView();
        v.show({ ...v2Data, multiplierDetail: { mode: 1, bombCount: 2, rocketCount: 0 } });
        const lines = v.getMultiplierLines();
        expect(lines.filter(l => l === '炸弹 ×2').length).toBe(2);
    });
});

// ── AC-6: 全局倍数合计行 ──────────────────────────────────────────────────────
describe('TASK-028 AC-6: getGlobalMultiplierLine', () => {
    test('multiplier=4 → "全局倍数 M = ×4"', () => {
        const v = makeView();
        v.show({ ...v2Data, multiplier: 4 });
        expect(v.getGlobalMultiplierLine()).toBe('全局倍数 M = ×4');
    });

    test('无 breakdown → 返回 ""', () => {
        const v = makeView();
        v.show(baseData);
        expect(v.getGlobalMultiplierLine()).toBe('');
    });
});

// ── AC-7: 地主加倍标签 ────────────────────────────────────────────────────────
describe('TASK-028 AC-7: getLandlordDoubleLabel', () => {
    test('landlordDouble=1 → "地主未加倍"', () => {
        const v = makeV2View();
        expect(v.getLandlordDoubleLabel()).toBe('地主未加倍');
    });

    test('landlordDouble=2 → "地主加倍 ×2"', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, landlordDouble: 2 } });
        expect(v.getLandlordDoubleLabel()).toBe('地主加倍 ×2');
    });
});

// ── AC-8: 个人加倍标签 ────────────────────────────────────────────────────────
describe('TASK-028 AC-8: getPlayerDoubleLabel', () => {
    test('di=1 → "未加倍"', () => {
        const v = makeV2View();
        expect(v.getPlayerDoubleLabel('p1')).toBe('未加倍');
    });

    test('di=2 → "加倍 ×2"', () => {
        const v = makeV2View(); // p3 doubled
        expect(v.getPlayerDoubleLabel('p3')).toBe('加倍 ×2');
    });

    test('全员加倍时，每人均返回 "加倍 ×2"', () => {
        const v = makeView();
        const allDoubled: BreakdownV2 = {
            ...baseBreakdown,
            playerDoubles: { p1: 2, p2: 2, p3: 2, p4: 2, p5: 2 },
        };
        v.show({ ...v2Data, breakdown: allDoubled });
        ['p1', 'p2', 'p3', 'p4', 'p5'].forEach(id => {
            expect(v.getPlayerDoubleLabel(id)).toBe('加倍 ×2');
        });
    });

    test('无 breakdown → 返回 ""（V1 降级）', () => {
        const v = makeView();
        v.show(baseData);
        expect(v.getPlayerDoubleLabel('p1')).toBe('');
    });
});

// ── AC-9: 平民流水计算式 ──────────────────────────────────────────────────────
describe('TASK-028 AC-9: getFlowText', () => {
    test('B=2,M=2,dL=1,di=1 → "2 × 2 × 1 × 1 = 4"', () => {
        const v = makeView();
        v.show({ ...v2Data, multiplier: 2 });
        expect(v.getFlowText('p1')).toBe('2 × 2 × 1 × 1 = 4');
    });

    test('地主加倍+玩家加倍: B=2,M=2,dL=2,di=2 → "2 × 2 × 2 × 2 = 16"', () => {
        const v = makeView();
        v.show({
            ...v2Data,
            multiplier: 2,
            breakdown: { ...baseBreakdown, landlordDouble: 2, playerDoubles: { p3: 2 } },
        });
        expect(v.getFlowText('p3')).toBe('2 × 2 × 2 × 2 = 16');
    });

    test('无 breakdown → 返回 ""（V1 降级）', () => {
        const v = makeView();
        v.show(baseData);
        expect(v.getFlowText('p1')).toBe('');
    });
});

// ── AC-11: 一挑四模式 ────────────────────────────────────────────────────────
describe('TASK-028 AC-11: isLandlordAloneMode', () => {
    test('isLandlordAlone=true → isLandlordAloneMode() = true', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, isLandlordAlone: true } });
        expect(v.isLandlordAloneMode()).toBe(true);
    });

    test('isLandlordAlone=false → false', () => {
        const v = makeV2View();
        expect(v.isLandlordAloneMode()).toBe(false);
    });

    test('无 breakdown → false（V1 降级）', () => {
        const v = makeView();
        v.show(baseData);
        expect(v.isLandlordAloneMode()).toBe(false);
    });
});

// ── AC-13: 暗队友分配比例 ─────────────────────────────────────────────────────
describe('TASK-028 AC-13: getPartnerSplitLabel', () => {
    test('暗队友未加倍 → "内部分配：2:1"', () => {
        const v = makeV2View(); // p2 未加倍
        expect(v.getPartnerSplitLabel('p2')).toBe('内部分配：2:1');
    });

    test('暗队友已加倍 → "内部分配：1:1"', () => {
        const v = makeView();
        v.show({ ...v2Data, breakdown: { ...baseBreakdown, playerDoubles: { p2: 2 } } });
        expect(v.getPartnerSplitLabel('p2')).toBe('内部分配：1:1');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK-031c: 再来一局（AC-9~15）
// ─────────────────────────────────────────────────────────────────────────────

describe('TASK-031c: 再来一局', () => {
    test('AC-9: finishAnimation 后两个按钮均可点击', () => {
        const v = makeView();
        v.show(baseData);
        v.finishAnimation();
        expect(v._playAgainBtn.interactable).toBe(true);
        expect(v._returnHallBtn.interactable).toBe(true);
    });

    test('AC-10: 动画期间点击「再来一局」无效', () => {
        const v = makeView();
        v.show(baseData);
        v.onPlayAgainClick();
        expect(v._requestRematch).not.toHaveBeenCalled();
    });

    test('AC-10: finishAnimation 后点击「再来一局」→ 发送 request_rematch + 禁用按钮', () => {
        const v = makeView();
        v.show(baseData);
        v.finishAnimation();
        v.onPlayAgainClick();
        expect(v._requestRematch).toHaveBeenCalledTimes(1);
        expect(v._playAgainBtn.interactable).toBe(false);
        expect(v._rematchStatusLabel.string).toBe('等待中…');
        expect(v._rematchStatusLabel.node.active).toBe(true);
    });

    test('AC-10: 不可重复发送 request_rematch（防止双击）', () => {
        const v = makeView();
        v.show(baseData);
        v.finishAnimation();
        v.onPlayAgainClick();
        v.onPlayAgainClick();
        expect(v._requestRematch).toHaveBeenCalledTimes(1);
    });

    test('AC-11: onRematchUpdate 更新同意人数提示', () => {
        const v = makeView();
        v.show(baseData);
        v.onRematchUpdate({ agreedCount: 3, total: 5 });
        expect(v._rematchStatusLabel.string).toBe('3/5 人同意再来一局');
        expect(v._rematchStatusLabel.node.active).toBe(true);
    });

    test('AC-12: onRematchStart → 隐藏结算界面', () => {
        const v = makeView();
        v.show(baseData);
        v.onRematchStart();
        expect(v._rootNode.active).toBe(false);
    });

    test('AC-13: onRematchRedirect → 隐藏界面 + 进入快速匹配', () => {
        const v = makeView();
        v.show(baseData);
        v.onRematchRedirect();
        expect(v._rootNode.active).toBe(false);
        expect(v._navigateToQuickMatch).toHaveBeenCalledTimes(1);
    });

    test('AC-14: 30 秒超时 → 按钮恢复，显示「有玩家未同意」', () => {
        const v = makeView();
        v.show(baseData);
        v.finishAnimation();
        v.onPlayAgainClick();
        (v as any)._fireRematchTimeout();
        expect(v._playAgainBtn.interactable).toBe(true);
        expect(v._rematchStatusLabel.string).toBe('有玩家未同意');
    });

    test('AC-15: 返回大厅 → 调用 _leaveRoom + onReturnHall（不发 request_rematch）', () => {
        const v = makeView();
        const hallCb = jest.fn();
        v.onReturnHall = hallCb;
        v.show(baseData);
        v.finishAnimation();
        v.onReturnHallClick();
        expect(v._leaveRoom).toHaveBeenCalledTimes(1);
        expect(hallCb).toHaveBeenCalledTimes(1);
        expect(v._requestRematch).not.toHaveBeenCalled();
    });
});
