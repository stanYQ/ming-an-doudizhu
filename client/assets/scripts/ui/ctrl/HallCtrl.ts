/**
 * @file HallCtrl.ts
 * @description 主大厅 Controller：持有场景节点，将 HallLogic 事件转化为节点操作。
 *              弹层通过 oops.gui.open/remove 管理，mode 经 oops.storage 传递给 MatchCtrl。
 * @layer ctrl
 * @module client/ui/ctrl
 */
import { _decorator, Component, Label, Button, director } from 'cc';
import { oops }        from 'db://oops-framework/core/Oops';
import { HallLogic }   from '../../logic/HallLogic';
import { netManager }  from '../../net/NetManager';
import { SERVER_URL }  from '../../config/AppConfig';
import { UIId }        from '../../config/UIId';

const { ccclass, property } = _decorator;

@ccclass('HallCtrl')
export class HallCtrl extends Component {

    // ── 顶部栏 ────────────────────────────────────────────────────────────────
    @property(Label)  nicknameLabel!: Label;
    @property(Label)  scoreLabel!:    Label;
    @property(Label)  rankLabel!:     Label;

    // ── 主操作按钮 ────────────────────────────────────────────────────────────
    @property(Button) quickMatchBtn!: Button;
    @property(Button) friendRoomBtn!: Button;

    // ── 功能宫格 ──────────────────────────────────────────────────────────────
    @property(Button) rulesBtn!:    Button;
    @property(Button) checkinBtn!:  Button;
    @property(Button) activityBtn!: Button;
    @property(Button) rankingBtn!:  Button;

    private _hallLogic!: HallLogic;

    onLoad() {
        netManager.init(SERVER_URL.replace('http', 'ws'));
        netManager.setToken(oops.storage?.get('ddz_token') ?? null);

        this._hallLogic = new HallLogic(netManager);
        this._hallLogic.onRender = (e, d) => this._render(e, d);
        this._hallLogic.init();

        const info = oops.storage?.getJson?.('ddz_user', null) as
            { nickname?: string; score?: number; rankLevel?: string } | null;
        if (info) {
            if (this.nicknameLabel) this.nicknameLabel.string = info.nickname ?? '';
            if (this.scoreLabel)    this.scoreLabel.string    = String(info.score ?? 0);
            if (this.rankLabel)     this.rankLabel.string     = info.rankLevel ?? '';
        }
    }

    onDestroy() {
        this._hallLogic?.destroy();
    }

    // ── onRender ──────────────────────────────────────────────────────────────

    private _render(event: string, _data: unknown): void {
        switch (event) {
            case 'MATCH_CANCELLED':
                oops.gui.remove(UIId.MatchView);
                break;
            case 'GAME_STARTED':
                oops.gui.remove(UIId.MatchView);
                director.loadScene('GameScene');
                break;
        }
    }

    // ── Button Click 代理 ─────────────────────────────────────────────────────

    onQuickMatchClick(): void {
        oops.storage?.set('match_mode', 'quick');
        this._hallLogic.startQuickMatch();
        oops.gui.open(UIId.MatchView);
    }

    onFriendRoomClick(): void {
        oops.storage?.set('match_mode', 'friend');
        oops.gui.open(UIId.MatchView);
    }

    onRulesClick(): void {
        oops.gui.open(UIId.RulesView);
    }

    onCheckinClick(): void  { oops.gui.toast('签到功能即将上线');  }
    onActivityClick(): void { oops.gui.toast('活动功能即将上线');  }
    onRankingClick(): void  { oops.gui.toast('排行榜功能即将上线'); }
}
