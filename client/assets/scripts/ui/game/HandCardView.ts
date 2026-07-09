/**
 * @file HandCardView.ts
 * @description 手牌区 CC Component：排序展示、对象池复用、选牌 + 牌型实时提示。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Label, Button, Node, Prefab, NodePool, instantiate, UITransform, Vec2, Vec3 } from 'cc';
import { PatternType } from '../../shared/CardPattern';
import { compareValue } from '../../shared/CardEncoding';
import { parse } from '../../shared/PatternHelper';
import { CardItem } from './CardItem';

const { ccclass, property } = _decorator;

/** 单张卡牌原始宽高（CardItem.prefab UITransform contentSize: 52×78） */
const CARD_W = 52;
const CARD_H = 78;
/** 手牌区卡牌缩放比例 */
const CARD_SCALE  = 1.8;
/** 相邻卡牌可见部分宽度 */
const CARD_VISIBLE = 42;

const PATTERN_LABEL: Record<string, string> = {
    [PatternType.SINGLE]:              '单张',
    [PatternType.PAIR]:                '对子',
    [PatternType.TRIPLE]:              '三张',
    [PatternType.TRIPLE_SOLO]:         '三带一',
    [PatternType.TRIPLE_PAIR]:         '三带二',
    [PatternType.STRAIGHT]:            '顺子',
    [PatternType.CONSECUTIVE_PAIRS]:   '连对',
    [PatternType.AIRPLANE]:            '飞机',
    [PatternType.AIRPLANE_SOLO_WINGS]: '飞机带单',
    [PatternType.AIRPLANE_PAIR_WINGS]: '飞机带对',
    [PatternType.BOMB]:                '炸弹',
    [PatternType.JOKER_BOMB_SMALL]:    '双小王',
    [PatternType.JOKER_BOMB_BIG]:      '天炸',
};

@ccclass('HandCardView')
export class HandCardView extends Component {

    @property(Prefab)  cardItemPrefab!:   Prefab;
    @property(Node)    cardContainer!:   Node;
    @property(Label)   patternHintLabel!: Label;
    @property(Button)  playButton!:      Button;
    @property(Button)  passButton!:      Button;
    @property(Button)  hintButton!:      Button;

    /** GameCtrl 在 onLoad 注入，按钮 ClickEvent 指向 HandCardView 自身方法 */
    _onPlay: (cards: number[]) => void = () => {};
    _onPass: () => void = () => {};
    _onHint: () => void = () => {};

    private _cards:      number[] = [];
    private _selected:   Set<number> = new Set();
    private _interactable  = true;
    private _turnActive    = false;   // 是否轮到本人出牌
    private _passEnabled   = false;
    private _pool!:         NodePool;
    private _lastSwipedIdx  = -1;     // 滑动选中：上一次命中的卡片下标

    onLoad() {
        this._pool = new NodePool('CardItem');
    }

    /**
     * 接收服务端手牌，排序后渲染节点。
     * @param cards 0-107 编码数组
     */
    render(cards: number[]): void {
        this._clearCards();
        this._cards = [...cards].sort((a, b) => compareValue(a) - compareValue(b));
        this._selected.clear();
        this._lastSwipedIdx = -1;
        this._cards.forEach((code, i) => {
            const node = this._pool.size() > 0 ? this._pool.get()! : instantiate(this.cardItemPrefab);
            node.getComponent(CardItem)!.setup(code);
            node.setScale(CARD_SCALE, CARD_SCALE, 1);
            node.off(Node.EventType.TOUCH_END);
            node.on(Node.EventType.TOUCH_END, () => this.selectCard(i));
            this.cardContainer.addChild(node);
        });
        this._layoutCards();
        this._updatePatternUI();

        // 滑动选中：在 cardContainer 上监听 TOUCH_MOVE
        this.cardContainer.off(Node.EventType.TOUCH_MOVE);
        this.cardContainer.on(Node.EventType.TOUCH_MOVE, this._onSwipe, this);
    }

    getCards(): number[] { return this._cards; }

    /**
     * 切换指定下标的选中状态，更新牌型提示和出牌按钮。
     * @param index 排序后 _cards 数组的下标
     */
    selectCard(index: number): void {
        if (!this._interactable) return;
        if (index < 0 || index >= this._cards.length) return;
        if (this._selected.has(index)) {
            this._selected.delete(index);
        } else {
            this._selected.add(index);
        }
        this.cardContainer.children[index]
            ?.getComponent(CardItem)
            ?.setSelected(this._selected.has(index));
        this._updatePatternUI();
    }

    /** 返回当前选中的牌（原始编码，按下标升序）。 */
    getSelectedCards(): number[] {
        return [...this._selected].sort((a, b) => a - b).map(i => this._cards[i]);
    }

    clearSelection(): void {
        this.cardContainer.children.forEach(n => n.getComponent(CardItem)?.setSelected(false));
        this._selected.clear();
        this._updatePatternUI();
    }

    /** 服务端 turn_change：激活/关闭本人出牌权。 */
    setTurnActive(enabled: boolean): void {
        this._turnActive = enabled;
        this.hintButton.interactable = enabled;
        this._updatePatternUI();
    }

    /** 控制「不要」按钮（首出无需不要）。 */
    setPassEnabled(enabled: boolean): void {
        this._passEnabled = enabled;
        this.passButton.interactable = enabled;
    }

    /** 整体禁用（结算/非游戏阶段）。 */
    setInteractable(enabled: boolean): void {
        this._interactable  = enabled;
        this.hintButton.interactable = enabled;
        this._updatePatternUI();
        this.passButton.interactable = enabled;
    }

    /**
     * 服务端 hint 响应：自动选中建议的牌。
     * @param cards 服务端推荐的牌，0-107 编码数组
     */
    selectHint(cards: number[]): void {
        this.clearSelection();
        cards.forEach(code => {
            const i = this._cards.indexOf(code);
            if (i >= 0) this.selectCard(i);
        });
    }

    /**
     * 乐观移除已出的牌（不等服务端 your_hand）。
     * 服务端拒绝时靠后续 your_hand 修正。
     */
    removeCardsOptimistic(played: number[]): void {
        const set = new Set(played);
        const remaining = this._cards.filter(c => !set.has(c));
        if (remaining.length < this._cards.length) {
            this.render(remaining);
        }
    }

    /** PlayBtn ClickEvent 目标方法（prefab 内部自持，不跨节点引用）。 */
    onPlayBtnClick(): void {
        const cards = this.getSelectedCards();
        this._onPlay(cards);
        // 乐观更新：出牌后立即从显示中移除，不等服务端 your_hand
        this.removeCardsOptimistic(cards);
    }
    /** PassBtn ClickEvent 目标方法。 */
    onPassBtnClick(): void { this._onPass(); }
    /** HintBtn ClickEvent 目标方法。 */
    onHintBtnClick(): void { this._onHint(); }

    private _clearCards(): void {
        [...this.cardContainer.children].forEach(n => {
            n.off(Node.EventType.TOUCH_END);
            this._pool.put(n);
        });
    }

    /** 手牌水平排列：居中，相邻牌露出 CARD_VISIBLE px（缩放后）。 */
    private _layoutCards(): void {
        const children = this.cardContainer.children;
        if (children.length === 0) return;
        const w = CARD_W * CARD_SCALE;
        const totalW  = w + (children.length - 1) * CARD_VISIBLE;
        const startX  = -totalW / 2 + w / 2;
        for (let i = 0; i < children.length; i++) {
            children[i].setPosition(startX + i * CARD_VISIBLE, 0, 0);
        }
    }

    /** 滑动选中：将触摸点转为 cardContainer 局部坐标，找到命中的牌并选中。 */
    private _onSwipe(e: any): void {
        if (!this._interactable || this._cards.length === 0) return;
        const uiLocation = e.getUILocation?.() ?? e.getLocation?.();
        if (!uiLocation) return;
        const local = this.cardContainer.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(uiLocation.x, uiLocation.y, 0));
        const idx = this._hitTest(local.x, local.y);
        if (idx >= 0 && idx !== this._lastSwipedIdx) {
            this._lastSwipedIdx = idx;
            this.selectCard(idx);
        }
    }

    /** 碰撞检测：返回给定局部坐标命中的牌下标，未命中返回 -1。 */
    private _hitTest(localX: number, _localY: number): number {
        const children = this.cardContainer.children;
        if (children.length === 0) return -1;
        const w = CARD_W * CARD_SCALE;
        const totalW  = w + (children.length - 1) * CARD_VISIBLE;
        const startX  = -totalW / 2;
        for (let i = 0; i < children.length; i++) {
            const left  = startX + i * CARD_VISIBLE;
            const right = left + w;
            if (localX >= left && localX <= right) return i;
        }
        return -1;
    }

    private _updatePatternUI(): void {
        const sel = this.getSelectedCards();
        if (sel.length === 0) {
            this.playButton.interactable = false;
            this.patternHintLabel.string = '请选择合法牌型';
            return;
        }
        const pattern = parse(sel);
        const invalid = pattern.type === PatternType.INVALID;
        // 出牌按钮：轮到本人 AND 牌型合法
        this.playButton.interactable = this._turnActive && !invalid;
        this.patternHintLabel.string = invalid
            ? '请选择合法牌型'
            : (PATTERN_LABEL[pattern.type] ?? pattern.type);
    }
}
