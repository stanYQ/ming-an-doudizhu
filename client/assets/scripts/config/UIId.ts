/**
 * @file UIId.ts
 * @description 全局弹层 UIId 枚举 + UIConfigData 配置表。
 *              新增弹层时在此注册，prefab 路径对应 assets/resources/ 下的相对路径（不含扩展名）。
 *              规范：resources/prefab/hall/  大厅相关弹层
 *                    resources/prefab/common/ 跨场景通用节点
 * @module client/config
 */
import { LayerType }  from 'db://oops-framework/core/gui/layer/LayerEnum';
import type { UIConfigMap } from 'db://oops-framework/core/gui/layer/LayerEnum';

export enum UIId {
    MatchView = 'MatchView',
    RulesView = 'RulesView',
}

export const UIConfigData: UIConfigMap = {
    [UIId.MatchView]: {
        layer:  LayerType.PopUp,
        prefab: 'prefab/hall/MatchView',
        mask:   true,
    },
    [UIId.RulesView]: {
        layer:   LayerType.PopUp,
        prefab:  'prefab/hall/RulesView',
        mask:    true,
        vacancy: true,   // 点击遮罩关闭
    },
};
