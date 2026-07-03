/**
 * @file BottomCardsDisplay.ts
 * @description 底牌展示区 CC Component：地主选定后短暂展示底牌，供所有玩家查看。
 *              进入出牌阶段时由 GameCtrl 调 hide() 收起。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
import { CardItem } from './CardItem';

const { ccclass, property } = _decorator;

@ccclass('BottomCardsDisplay')
export class BottomCardsDisplay extends Component {

    @property(Prefab) cardItemPrefab!: Prefab;
    @property(Node)   cardContainer!:  Node;

    /**
     * 展示底牌（node 自动设为 active=true）。
     * @param cards 底牌编码数组（0-107）
     */
    show(cards: number[]): void {
        this._clear();
        cards.forEach(code => {
            const node = instantiate(this.cardItemPrefab);
            node.getComponent(CardItem)!.setup(code);
            this.cardContainer.addChild(node);
        });
        this.node.active = true;
    }

    /** 收起底牌区并清空子节点。 */
    hide(): void {
        this.node.active = false;
        this._clear();
    }

    private _clear(): void {
        this.cardContainer.removeAllChildren();
    }
}
