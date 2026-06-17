import { _decorator, Component, Canvas, ResolutionPolicy, view, screen, sys } from 'cc';
const { ccclass } = _decorator;

/**
 * 挂载到启动场景根节点。
 * 职责：锁横屏 + 设计分辨率 1280×720 + 安全区 inset 暴露。
 */
@ccclass('ScreenAdapter')
export class ScreenAdapter extends Component {
    /** 全局安全区 inset（像素，设计坐标系），其他组件读此值定位 UI */
    static safeArea = { top: 0, bottom: 0, left: 0, right: 0 };

    onLoad() {
        this._lockLandscape();
        this._setDesignResolution();
        this._updateSafeArea();
    }

    private _lockLandscape() {
        // H5 / Web-Mobile：请求横屏锁定
        if (screen.supportsFullScreen) {
            screen.requestFullScreen(null, null);
        }
        // 小程序端方向锁通过 builder 构建配置声明（project.config.json orientation: landscape）
        // Native 端通过 Xcode / Android Manifest 声明，不在此处理
    }

    private _setDesignResolution() {
        // FIXED_HEIGHT：保持 720px 高度，宽度随宽高比伸缩，适配超宽屏两侧留空
        view.setDesignResolutionSize(1280, 720, ResolutionPolicy.FIXED_HEIGHT);
    }

    private _updateSafeArea() {
        const rect = sys.getSafeAreaRect();
        const visibleSize = view.getVisibleSize();
        const frameSize = view.getFrameSize();

        // 将像素 inset 转换为设计坐标系
        const scaleX = visibleSize.width / frameSize.width;
        const scaleY = visibleSize.height / frameSize.height;

        ScreenAdapter.safeArea = {
            top: (frameSize.height - rect.y - rect.height) * scaleY,
            bottom: rect.y * scaleY,
            left: rect.x * scaleX,
            right: (frameSize.width - rect.x - rect.width) * scaleX,
        };
    }
}
