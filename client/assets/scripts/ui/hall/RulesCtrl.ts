/**
 * @file RulesCtrl.ts
 * @description 游戏规则弹层 Controller（Prefab 根脚本）。
 *              静态 ScrollView 展示 GAME-RULES.md 摘要，点击遮罩或关闭按钮关闭。
 * @layer ctrl
 * @module client/ui/ctrl
 */
import { _decorator, Component, Label } from 'cc';
import { oops }   from 'db://oops-framework/core/Oops';
import { UIId }   from '../../config/UIId';

const { ccclass, property } = _decorator;

@ccclass('RulesCtrl')
export class RulesCtrl extends Component {

    @property(Label) contentLabel!: Label;  // 规则正文，硬编码摘要文本

    onLoad() {
        if (this.contentLabel) {
            this.contentLabel.string = RULES_TEXT;
        }
    }

    /** 关闭按钮 / CloseBtn Click Event */
    onCloseClick(): void {
        oops.gui.remove(UIId.RulesView);
    }
}

const RULES_TEXT = `明暗斗地主游戏规则

【人数】5人，双副牌（108张）

【身份】
· 地主营（2人）：地主 + 1名同伴（暗号牌确定）
· 平民营（3人）：其余3名玩家

【暗号牌】
· 发牌后每人选1张牌作为"暗号牌"
· 地主公开自己的暗号牌，同伴根据特征判断身份
· 游戏结束时揭晓所有身份

【出牌】
· 顺序：地主先出
· 牌型参考斗地主标准规则（单张、对子、三带、顺子、炸弹等）
· 王炸（双王）为最大牌型

【加倍】
· 游戏开始前可选择加倍（积分×2）

【胜负】
· 地主营任意一人先出完手牌 → 地主营胜
· 平民营任意一人先出完手牌 → 平民营胜

【积分】
· 底分 × 倍率（弹簧/炸弹翻倍）
· 加倍选项进一步放大`;
