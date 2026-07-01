/**
 * @file SuitCardItem.ts
 * @description 暗号牌选择弹窗中的单格组件：显示花色+点数，支持金色选中态。
 * @layer ctrl
 * @module client/ui/ctrl
 */
import { _decorator, Component, Label, Sprite, Color } from 'cc';

const { ccclass, property } = _decorator;

const SUIT_LABELS  = ['♠', '♥', '♦', '♣'];
const RANK_LABELS  = ['3', '4', '5', '6', '7', '8', '9', '10'];
const RED_COLOR    = new Color(220, 30, 30, 255);
const BLACK_COLOR  = new Color(20, 20, 20, 255);
const SELECTED_BG  = new Color(212, 168, 67, 255);   // 金色

@ccclass('SuitCardItem')
export class SuitCardItem extends Component {

    @property(Label)  suitLabel!: Label;
    @property(Label)  rankLabel!: Label;
    @property(Sprite) cardBg!:   Sprite;

    private _suit = 0;
    private _rank = 0;

    /**
     * 初始化格子内容。
     * @param suit 0=♠ 1=♥ 2=♦ 3=♣
     * @param rank 0=3 … 7=10
     */
    setup(suit: number, rank: number): void {
        this._suit = suit;
        this._rank = rank;
        const isRed = suit === 1 || suit === 2;
        const textClr = isRed ? RED_COLOR : BLACK_COLOR;
        this.suitLabel.string = SUIT_LABELS[suit] ?? '';
        this.rankLabel.string = RANK_LABELS[rank] ?? '';
        this.suitLabel.color  = textClr;
        this.rankLabel.color  = textClr;
        this.cardBg.color     = Color.WHITE;
    }

    /** 切换选中高亮（金色底）。 */
    setSelected(selected: boolean): void {
        this.cardBg.color = selected ? SELECTED_BG : Color.WHITE;
    }

    getSuit(): number { return this._suit; }
    getRank(): number { return this._rank; }
}
