/**
 * @file AppRoot.ts
 * @description oops-framework 根组件，挂在 LaunchScene 根节点，常驻整个游戏生命周期。
 *              初始化 oops.res / oops.storage；多场景架构下不使用 LayerManager，gui 留空。
 * @module client/core
 */
import { _decorator } from 'cc';
import { Root }       from 'db://oops-framework/core/Root';

const { ccclass } = _decorator;

@ccclass('AppRoot')
export class AppRoot extends Root {
    // LaunchScene → HallScene → GameScene 多场景跳转通过 director.loadScene 完成，
    // 无需 gui.open，run() 不覆盖，由父类 Root 处理 config.json 加载。
}
