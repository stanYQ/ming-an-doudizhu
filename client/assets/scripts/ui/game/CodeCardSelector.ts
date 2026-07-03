/**
 * @file CodeCardSelector.ts
 * @description 地主暗号牌选择弹窗 CC Component：4花色×8点数（3-10）共32格，确认后回调 GameCtrl。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Button, Node, Prefab, instantiate } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIId } from '../../config/UIId';
import { SuitCardItem } from './SuitCardItem';

const { ccclass, property } = _decorator;

export interface CodeCardChoice {
    suit: number;  // 0=♠ 1=♥ 2=♦ 3=♣
    rank: number;  // 0=3 … 7=10
}

@ccclass('CodeCardSelector')
export class CodeCardSelector extends Component {

    @property(Button) confirmBtn!:         Button;
    @property(Node)   cardGrid!:           Node;    // GridLayout 容器
    @property(Prefab) suitCardItemPrefab!: Prefab;

    /** 确认回调，由 onAdded 注入 */
    private onConfirm: (choice: CodeCardChoice) => void = () => {};

    private _selected: CodeCardChoice | null = null;

    onLoad() {
        // 4 花色 × 8 点数（3-10）= 32 格，onLoad 只跑一次
        for (let suit = 0; suit < 4; suit++) {
            for (let rank = 0; rank < 8; rank++) {
                const node = instantiate(this.suitCardItemPrefab);
                const item = node.getComponent(SuitCardItem)!;
                item.setup(suit, rank);
                node.on(Node.EventType.TOUCH_END, () => this._onCellTap(suit, rank, item));
                this.cardGrid.addChild(node);
            }
        }
    }

    /** oops.gui.open 时框架调用，data 来自 open 第二参数的 data 字段。 */
    onAdded(data: { onConfirm: (choice: CodeCardChoice) => void }): void {
        this.onConfirm               = data.onConfirm;
        this._selected               = null;
        this.confirmBtn.interactable = false;
        this.cardGrid.getComponentsInChildren(SuitCardItem).forEach(c => c.setSelected(false));
    }

    /** 触发确认回调并关闭弹窗。 */
    confirmSelection(): void {
        if (!this._selected) return;
        this.onConfirm(this._selected);
        oops.gui.remove(UIId.CodeCardSelector);
    }

    getSelectedChoice(): CodeCardChoice | null { return this._selected; }

    hide(): void { oops.gui.remove(UIId.CodeCardSelector); }

    private _onCellTap(suit: number, rank: number, item: SuitCardItem): void {
        this.cardGrid.getComponentsInChildren(SuitCardItem).forEach(c => c.setSelected(false));
        item.setSelected(true);
        this._selected               = { suit, rank };
        this.confirmBtn.interactable = true;
    }
}
