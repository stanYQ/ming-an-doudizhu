/**
 * @file UIId.ts
 * @description 全局弹层 UIId 枚举 + UIConfigData 配置表。
 *              prefab 路径规则：
 *                bundle: 'hall'  → assets/bundle/hall/prefab/
 *                bundle: 'game'  → assets/bundle/game/prefab/
 *                bundle 缺省     → assets/resources/prefab/common/（框架级）
 * @module client/config
 */
import { LayerType }  from 'db://oops-framework/core/gui/layer/LayerEnum';
import type { UIConfigMap } from 'db://oops-framework/core/gui/layer/LayerEnum';

export enum UIId {
    MatchView        = 'MatchView',
    RulesView        = 'RulesView',
    CodeCardSelector = 'CodeCardSelector',
    DoublingView     = 'DoublingView',
    SettlementView   = 'SettlementView',
}

export const UIConfigData: UIConfigMap = {
    [UIId.MatchView]: {
        layer:  LayerType.PopUp,
        prefab: 'prefab/MatchView',
        bundle: 'hall',
        mask:   true,
    },
    [UIId.RulesView]: {
        layer:   LayerType.PopUp,
        prefab:  'prefab/RulesView',
        bundle:  'hall',
        vacancy: true,
    },
    [UIId.CodeCardSelector]: {
        layer:  LayerType.PopUp,
        prefab: 'prefab/CodeCardSelector',
        bundle: 'game',
    },
    [UIId.DoublingView]: {
        layer:  LayerType.PopUp,
        prefab: 'prefab/DoublingView',
        bundle: 'game',
    },
    [UIId.SettlementView]: {
        layer:  LayerType.PopUp,
        prefab: 'prefab/SettlementView',
        bundle: 'game',
    },
};
