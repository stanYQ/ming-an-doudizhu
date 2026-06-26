import { _decorator, Component, Widget } from 'cc';
import { ScreenAdapter } from './ScreenAdapter';
const { ccclass, requireComponent } = _decorator;

/**
 * 挂载到需要遵守安全区的容器节点（如底部手牌区、顶部信息区）。
 * 依赖 Widget 组件，自动把四边 margin 推入安全区内。
 */
@ccclass('SafeAreaWidget')
@requireComponent(Widget)
export class SafeAreaWidget extends Component {
    start() {
        this._applyInsets();
    }

    private _applyInsets() {
        const widget = this.getComponent(Widget)!;
        const { top, bottom, left, right } = ScreenAdapter.safeArea;

        widget.isAlignTop = top > 0;
        widget.isAlignBottom = bottom > 0;
        widget.isAlignLeft = left > 0;
        widget.isAlignRight = right > 0;

        if (top > 0) widget.top = top;
        if (bottom > 0) widget.bottom = bottom;
        if (left > 0) widget.left = left;
        if (right > 0) widget.right = right;

        widget.updateAlignment();
    }
}
