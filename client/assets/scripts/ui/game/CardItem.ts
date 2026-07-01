/**
 * @file CardItem.ts
 * @description 单张卡牌节点组件：显示花色/点数/正反面，支持选中态上移动画。
 * @layer ctrl
 * @module client/ui/ctrl
 */
import { _decorator, Component, Label, Sprite, Node, Color, tween, Vec3 } from 'cc';
import { decode, DecodeResult } from '../../shared/CardEncoding';

const { ccclass, property } = _decorator;

const RANK_LABELS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUIT_LABELS = ['♠','♥','♦','♣'];
const RED_COLOR       = new Color(220, 30, 30, 255);
const BLACK_COLOR     = new Color(20, 20, 20, 255);
const JOKER_BIG_BG   = new Color(26, 35, 126, 255);   // 大王深蓝底
const JOKER_SMALL_BG = new Color(139, 0, 0, 255);      // 小王红底

@ccclass('CardItem')
export class CardItem extends Component {

    @property(Label)  rankLabel!:     Label;    // 左上角点数（小字）
    @property(Label)  suitLabel!:     Label;    // 左上角花色（小字）
    @property(Label)  centerRank!:    Label;    // 居中大点数
    @property(Sprite) cardBg!:        Sprite;   // 卡牌底色
    @property(Node)   selectOverlay!: Node;     // 选中时金色描边覆层

    private _selected = false;

    /**
     * 用 0-107 编码初始化卡牌显示内容。
     * @param cardCode CardEncoding 格式编码
     */
    setup(cardCode: number): void {
        const decoded = decode(cardCode);
        if (decoded.isJoker) {
            this.rankLabel.string   = '';
            this.suitLabel.string   = '';
            this.centerRank.string  = decoded.isLarge ? '大' : '小';
            this.centerRank.color   = Color.WHITE;
            this.cardBg.color       = decoded.isLarge ? JOKER_BIG_BG : JOKER_SMALL_BG;
        } else {
            const card    = decoded as Extract<DecodeResult, { isJoker: false }>;
            const isRed   = card.suit === 1 || card.suit === 2;
            const textClr = isRed ? RED_COLOR : BLACK_COLOR;
            this.rankLabel.string   = RANK_LABELS[card.rank]  ?? '';
            this.suitLabel.string   = SUIT_LABELS[card.suit]  ?? '';
            this.centerRank.string  = RANK_LABELS[card.rank]  ?? '';
            this.rankLabel.color    = textClr;
            this.suitLabel.color    = textClr;
            this.centerRank.color   = textClr;
            this.cardBg.color       = Color.WHITE;
        }
        this._selected = false;
        if (this.selectOverlay) this.selectOverlay.active = false;
        this.node.setPosition(this.node.position.x, 0, 0);
    }

    /**
     * 切换选中态：上移 20px + 显示金色描边覆层。
     * @param selected true=选中
     */
    setSelected(selected: boolean): void {
        this._selected = selected;
        if (this.selectOverlay) this.selectOverlay.active = selected;
        const y = selected ? 20 : 0;
        tween(this.node)
            .to(0.08, { position: new Vec3(this.node.position.x, y, 0) })
            .start();
    }

    isSelected(): boolean { return this._selected; }
}
