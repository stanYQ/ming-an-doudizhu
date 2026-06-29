/**
 * @file AppRoot.ts
 * @description oops-framework 根组件，挂载在 LaunchScene/Canvas，常驻整个游戏生命周期。
 *              - gui 节点（Scene 直属子节点）持久化，使 oops.gui.toast/open 全局可用。
 *              - 注册全局弹层 UIConfigData。
 * @module client/core
 */
import { _decorator, director } from 'cc';
import { Root }          from 'db://oops-framework/core/Root';
import { oops }          from 'db://oops-framework/core/Oops';
import { UIConfigData }  from '../config/UIId';

const { ccclass } = _decorator;

@ccclass('AppRoot')
export class AppRoot extends Root {
    onLoad() {
        super.onLoad();
        if (this.gui) director.addPersistRootNode(this.gui);
        oops.gui.init(UIConfigData);
    }
}
