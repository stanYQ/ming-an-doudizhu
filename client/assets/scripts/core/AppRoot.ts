/**
 * @file AppRoot.ts
 * @description oops-framework 根组件，挂载在 LaunchScene/Canvas，常驻整个游戏生命周期。
 *              - gui 节点（Scene 直属子节点）持久化，使 oops.gui.toast/open 全局可用。
 *              - 注册全局弹层 UIConfigData。
 * @module client/core
 */
import { Director, _decorator, director } from 'cc';
import { Root }          from 'db://oops-framework/core/Root';
import { oops }          from 'db://oops-framework/core/Oops';
import { UIConfigData }  from '../config/UIId';

const { ccclass } = _decorator;

@ccclass('AppRoot')
export class AppRoot extends Root {
    onLoad() {
        super.onLoad();
        // gui 必须是 Scene 直属子节点才能 persist（编辑器里放在 Scene 根层级，不放在 Canvas 下）
        if (this.gui) {
            director.addPersistRootNode(this.gui);
            // CC3 把 persist 节点插入新场景时排在最前面（sibling index 低），
            // 会被 Canvas 遮住。每次场景启动后把 gui 移到最高 sibling index，
            // 确保 LayerPopUp 始终渲染在所有场景内容之上。
            director.on(Director.EVENT_AFTER_SCENE_LAUNCH, this._bringGuiToFront, this);
        }
        oops.gui.init(UIConfigData);
    }

    onDestroy() {
        director.off(Director.EVENT_AFTER_SCENE_LAUNCH, this._bringGuiToFront, this);
    }

    private _bringGuiToFront(): void {
        const scene = director.getScene();
        if (scene?.isValid && this.gui?.isValid) {
            this.gui.setSiblingIndex(scene.children.length - 1);
        }
    }
}
