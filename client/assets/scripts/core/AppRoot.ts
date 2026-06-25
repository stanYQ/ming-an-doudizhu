/**
 * @file AppRoot.ts
 * @description oops-framework 根组件，挂载在 LaunchScene Canvas 根节点，常驻整个游戏生命周期。
 * @module client/core
 */
import { _decorator } from 'cc';
import { Root } from 'db://oops-framework/core/Root';

const { ccclass } = _decorator;

@ccclass('AppRoot')
export class AppRoot extends Root {
    // 挂在 LaunchScene Canvas 根节点
    // gui 属性留空（P0 不使用 LayerManager 层）
}
