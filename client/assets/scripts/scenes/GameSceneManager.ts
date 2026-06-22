/**
 * @file GameSceneManager.ts
 * @description 游戏桌场景 Manager：将 @property 节点引用注入各 UI 逻辑实例，再注入 GameController。
 *              挂载到 GameScene 根节点上；所有节点/Label/Button 引用在 CC 编辑器里拖拽连线。
 * @module client/scenes
 */

import {
    _decorator, Component, Label, Button, Node, director,
} from 'cc';
import { GameController } from '../game/GameController';
import { NetManager } from '../net/NetManager';
import { HandCardView } from '../ui/HandCardView';
import { PlayZone } from '../ui/PlayZone';
import { PlayerSeat } from '../ui/PlayerSeat';
import { CodeCardSelector, CodeCardChoice } from '../ui/CodeCardSelector';
import { SettlementView } from '../ui/SettlementView';
import { DoublingView } from '../ui/DoublingView';

const { ccclass, property } = _decorator;

const API_ENDPOINT = 'ws://localhost:2567';

@ccclass('GameSceneManager')
export class GameSceneManager extends Component {

    // ── GameController（同节点上，编辑器拖拽）────────────────────────────────
    @property(GameController) gameController!: GameController;

    // ── HandCardView ─────────────────────────────────────────────────────────
    @property(Button) playButton!: Button;
    @property(Label)  patternLabel!: Label;

    // ── PlayZone ─────────────────────────────────────────────────────────────
    @property(Button) playBtn!: Button;
    @property(Button) passBtn!: Button;
    @property(Label)  playErrorLabel!: Label;
    @property(Label)  timerLabel!: Label;

    // ── 5 个席位根节点（0=本人底部, 1=左前, 2=左, 3=右, 4=右前）────────────
    // 每个席位子节点命名约定：NicknameLabel / HandCountLabel / TimerNode / BadgeNode（含 BadgeLabel 子节点）/ FinishedNode
    @property([Node]) seatNodes: Node[] = [];

    // ── CodeCardSelector ─────────────────────────────────────────────────────
    @property(Node)   codeSelectorRoot!: Node;
    @property(Button) confirmCodeBtn!: Button;

    // ── SettlementView ────────────────────────────────────────────────────────
    @property(Node)   settlementRoot!: Node;
    @property(Label)  bannerLabel!: Label;
    @property(Button) playAgainBtn!: Button;
    @property(Button) returnHallBtn!: Button;
    @property(Label)  rematchStatusLabel!: Label;  // 「等待中…」/ 「X/Y 人同意」

    // ── DoublingView ─────────────────────────────────────────────────────────
    @property(Node)   doublingRoot!: Node;
    @property(Label)  doublingTimerLabel!: Label;
    @property(Label)  doublingStatusLabel!: Label;
    @property(Button) doublingSingleBtn!: Button;
    @property(Button) doublingDoubleBtn!: Button;
    @property(Label)  doublingResultLabel!: Label;

    private _net = new NetManager();

    onLoad() {
        this._net.init(API_ENDPOINT);

        const handCardView   = this._buildHandCardView();
        const playZone       = this._buildPlayZone();
        const seats          = this._buildSeats();
        const codeSelector   = this._buildCodeSelector();
        const settlementView = this._buildSettlementView();
        const doublingView   = this._buildDoublingView();

        this.gameController.handCardView     = handCardView;
        this.gameController.playZone         = playZone;
        this.gameController.playerSeats      = seats;
        this.gameController.codeCardSelector = codeSelector;
        this.gameController.settlementView   = settlementView;
        this.gameController.doublingView     = doublingView;
        this.gameController.netManager       = this._net;
    }

    // ── 构建各逻辑实例 ────────────────────────────────────────────────────────

    private _buildHandCardView(): HandCardView {
        const v = new HandCardView();
        v._playButton   = this.playButton;
        v._patternLabel = this.patternLabel;   // Label 直接赋值，.string 读写即刻生效
        return v;
    }

    private _buildPlayZone(): PlayZone {
        const v = new PlayZone();
        v._playBtn    = this.playBtn;
        v._passBtn    = this.passBtn;
        v._errorLabel = this.playErrorLabel;   // Label 有 .string 和 .node.active
        v._timerLabel = this.timerLabel;
        return v;
    }

    private _buildSeats(): PlayerSeat[] {
        return this.seatNodes.map((node, i) => {
            const seat = new PlayerSeat();
            seat.seatIndex = i;

            const nickLbl    = node.getChildByName('NicknameLabel')?.getComponent(Label);
            const countLbl   = node.getChildByName('HandCountLabel')?.getComponent(Label);
            const timerNode  = node.getChildByName('TimerNode');
            const badgeNode  = node.getChildByName('BadgeNode');
            const badgeLbl   = badgeNode?.getChildByName('BadgeLabel')?.getComponent(Label);
            const finishNode = node.getChildByName('FinishedNode');

            seat._nicknameLabel  = nickLbl!;
            seat._handCountLabel = countLbl!;
            seat._timerNode      = timerNode!;
            // BadgeLabel 是 BadgeNode 的子节点：需代理 string，active 控制容器节点
            seat._identityBadge  = {
                get string()      { return badgeLbl?.string ?? ''; },
                set string(v: string) { if (badgeLbl) badgeLbl.string = v; },
                node: badgeNode!,
            };
            seat._finishedNode   = finishNode!;
            return seat;
        });
    }

    private _buildCodeSelector(): CodeCardSelector {
        const v = new CodeCardSelector();
        v._confirmBtn = this.confirmCodeBtn;
        v._rootNode   = this.codeSelectorRoot;
        v.onConfirm   = (choice: CodeCardChoice) => {
            this.gameController.onCodeCardSelect(String(choice.suit), choice.rank);
        };
        return v;
    }

    private _buildSettlementView(): SettlementView {
        const v = new SettlementView();
        v._rootNode           = this.settlementRoot;
        v._bannerLabel        = this.bannerLabel;
        v._playAgainBtn       = this.playAgainBtn;
        v._returnHallBtn      = this.returnHallBtn;
        v._rematchStatusLabel = this.rematchStatusLabel;

        v.onReturnHall          = () => director.loadScene('HallScene');
        v._requestRematch       = () => this._net.requestRematch();
        v._leaveRoom            = () => this._net.leaveRoom();
        v._navigateToHall       = () => director.loadScene('HallScene');
        // rematch_redirect：回大厅，由玩家自行重新匹配（Demo 阶段）
        v._navigateToQuickMatch = () => director.loadScene('HallScene');
        return v;
    }

    private _buildDoublingView(): DoublingView {
        const v = new DoublingView();
        v._rootNode    = this.doublingRoot;
        v._timerLabel  = this.doublingTimerLabel;
        v._statusLabel = this.doublingStatusLabel;
        v._singleBtn   = this.doublingSingleBtn;
        v._doubleBtn   = this.doublingDoubleBtn;
        v._resultLabel = this.doublingResultLabel;
        return v;
    }

    // ── Button Click 代理（在编辑器 Button ClickEvents 里选择这里的方法）─────

    onPlayButtonClick()      { this.gameController.onPlayButtonClick();  }
    onPassButtonClick()      { this.gameController.onPassButtonClick();  }
    onPlayAgainClick()       { this.gameController.settlementView?.onPlayAgainClick?.();  }
    onReturnHallClick()      { this.gameController.settlementView?.onReturnHallClick?.(); }
    onConfirmCodeClick()     { this.gameController.codeCardSelector?.confirmSelection?.(); }
    onDoublingSingleClick()  { this.gameController.doublingView?.onSingleClick?.(); }
    onDoublingDoubleClick()  { this.gameController.doublingView?.onDoubleClick?.(); }
}
