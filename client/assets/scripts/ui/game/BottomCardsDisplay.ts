/**
 * @file BottomCardsDisplay.ts
 * @description 底牌展示区 CC Component：地主选定后短暂展示底牌，供所有玩家查看。
 *              进入出牌阶段时由 GameCtrl 调 hide() 收起。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Node, Prefab, instantiate, tween, Vec3 } from 'cc';
import { CardItem } from './CardItem';

const { ccclass, property } = _decorator;

@ccclass('BottomCardsDisplay')
export class BottomCardsDisplay extends Component {

    @property(Prefab) cardItemPrefab!: Prefab;
    @property(Node)   cardContainer!:  Node;
    @property(Node)   handTarget!:     Node;  // 手牌区目标位置（merge 动画终点参考）

    /** AC-21: 底牌 merge 完成后回调。 */
    _onMergeDone: () => void = () => {};

    /**
     * 展示底牌（node 自动设为 active=true）。
     * AC-21: 展示 2s 后以动画融入手牌区。
     */
    show(cards: number[]): void {
        this._clear();
        cards.forEach(code => {
            const node = instantiate(this.cardItemPrefab);
            node.getComponent(CardItem)!.setup(code);
            this.cardContainer.addChild(node);
        });
        this.node.active = true;

        // AC-21: 2s 后 merge 动画
        this.scheduleOnce(() => this._mergeIntoHand(), 2);
    }

    /** 收起底牌区并清空子节点。 */
    hide(): void {
        this.unscheduleAllCallbacks();
        this.node.active = false;
        this._clear();
    }

    /** AC-21: 底牌飞向手牌区，动画完成后回调 _onMergeDone。 */
    private _mergeIntoHand(): void {
        const target = this.handTarget;
        const nodes  = [...this.cardContainer.children];
        let doneCount = 0;
        const onComplete = () => {
            doneCount++;
            if (doneCount >= nodes.length) {
                this.node.active = false;
                this._clear();
                this._onMergeDone();
            }
        };
        nodes.forEach((node, i) => {
            const dest = target ? target.worldPosition.clone() : new Vec3(640, 150, 0);
            dest.x += i * 60;
            tween(node)
                .delay(i * 0.05)
                .to(0.25, { worldPosition: dest, scale: new Vec3(0.8, 0.8, 1) }, { easing: 'sineIn' })
                .call(onComplete)
                .start();
        });
    }

    private _clear(): void {
        this.cardContainer.removeAllChildren();
    }
}
