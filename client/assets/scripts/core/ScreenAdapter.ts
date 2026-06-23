import { _decorator, Component, ResolutionPolicy, view, screen, sys } from 'cc';
const { ccclass } = _decorator;

/**
 * @file ScreenAdapter.ts
 * @description 挂载到 Canvas 节点。职责：设计分辨率 1280×720 + 安全区 inset 暴露。
 * @module client/core
 */
@ccclass('ScreenAdapter')
export class ScreenAdapter extends Component {
    /** 全局安全区 inset（像素，设计坐标系），其他组件读此值定位 UI */
    static safeArea = { top: 0, bottom: 0, left: 0, right: 0 };

    onLoad() {
        this._setDesignResolution();
        this._updateSafeArea();
        // 全屏锁横屏需要用户手势触发，由用户首次点击时调用 ScreenAdapter.requestFullscreen()
    }

    /** 在用户手势回调中调用（点击按钮等），否则浏览器拒绝 */
    static requestFullscreen() {
        if (screen.supportsFullScreen) {
            screen.requestFullScreen();
        }
    }

    private _setDesignResolution() {
        // FIXED_HEIGHT：保持 720px 高度，宽度随宽高比伸缩，适配超宽屏两侧留空
        view.setDesignResolutionSize(1280, 720, ResolutionPolicy.FIXED_HEIGHT);
    }

    private _updateSafeArea() {
        const rect = sys.getSafeAreaRect();
        const visibleSize = view.getVisibleSize();
        // screen.windowSize 替代已废弃的 view.getFrameSize()
        const windowSize = screen.windowSize;

        const scaleX = visibleSize.width  / windowSize.width;
        const scaleY = visibleSize.height / windowSize.height;

        ScreenAdapter.safeArea = {
            top:    (windowSize.height - rect.y - rect.height) * scaleY,
            bottom: rect.y * scaleY,
            left:   rect.x * scaleX,
            right:  (windowSize.width - rect.x - rect.width) * scaleX,
        };
    }
}
