/**
 * @file HandCardView.ts
 * @description 手牌区 CC Component：排序展示、对象池复用、选牌 + 牌型实时提示。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Label, Button, Node, Prefab, NodePool, instantiate } from 'cc';
import { PatternType } from '../../shared/CardPattern';
import { compareValue } from '../../shared/CardEncoding';
import { parse } from '../../shared/PatternHelper';
import { CardItem } from './CardItem';

const { ccclass, property } = _decorator;

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
    private _pool!: NodePool;

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
        this._cards.forEach((code, i) => {
            const node = this._pool.size() > 0 ? this._pool.get()! : instantiate(this.cardItemPrefab);
            node.getComponent(CardItem)!.setup(code);
            node.off(Node.EventType.TOUCH_END);
            node.on(Node.EventType.TOUCH_END, () => this.selectCard(i));
            this.cardContainer.addChild(node);
        });
        this._updatePatternUI();
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
        this._turnActive    = enabled;
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

    /** PlayBtn ClickEvent 目标方法（prefab 内部自持，不跨节点引用）。 */
    onPlayBtnClick(): void { this._onPlay(this.getSelectedCards()); }
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
