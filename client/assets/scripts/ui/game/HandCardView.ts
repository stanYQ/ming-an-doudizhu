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

    @property(Prefab)  cardItemPrefab!: Prefab;   // CardItem.prefab
    @property(Node)    cardContainer!:  Node;      // HorizontalLayout 容器
    @property(Label)   patternHintLabel!: Label;   // 当前选牌牌型，如「顺子」
    @property(Button)  playButton!:     Button;    // 出牌按钮（选牌合法时启用）

    private _cards:    number[] = [];
    private _selected: Set<number> = new Set();    // 排序后 _cards 的下标集合
    private _interactable = true;
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

    /** 控制手牌区是否响应点击（非本人回合时禁用）。 */
    setInteractable(enabled: boolean): void {
        this._interactable = enabled;
    }

    showBottomCards(_cards: number[]): void {}

    private _clearCards(): void {
        [...this.cardContainer.children].forEach(n => {
            n.off(Node.EventType.TOUCH_END);
            this._pool.put(n);
        });
    }

    private _updatePatternUI(): void {
        const sel = this.getSelectedCards();
        if (sel.length === 0) {
            this.playButton.interactable      = false;
            this.patternHintLabel.string      = '请选择合法牌型';
            return;
        }
        const pattern = parse(sel);
        const invalid = pattern.type === PatternType.INVALID;
        this.playButton.interactable      = !invalid;
        this.patternHintLabel.string      = invalid
            ? '请选择合法牌型'
            : (PATTERN_LABEL[pattern.type] ?? pattern.type);
    }
}
