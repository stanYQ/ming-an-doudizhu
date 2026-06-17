/**
 * @file GameSceneManager.ts
 * @description 游戏桌场景 Manager：创建全部 UI 逻辑实例，注入 GameController。
 *              挂载到 GameScene 的根节点 GameRoot 上。
 * @module client/scenes
 */

import {
    _decorator, Component, Label, Button, Node, director,
} from 'cc';
import { GameController } from '../game/GameController';
import { NetManager } from '../net/NetManager';
import { HandCardView } from '../ui/HandCardView';
import { PlayZone } from '../ui/PlayZone';
import { PlayerSeat, SeatData } from '../ui/PlayerSeat';
import { CodeCardSelector, CodeCardChoice } from '../ui/CodeCardSelector';
import { SettlementView, SettlementData } from '../ui/SettlementView';

const { ccclass, property } = _decorator;

const API_ENDPOINT = 'ws://localhost:2567';

@ccclass('GameSceneManager')
export class GameSceneManager extends Component {

    // ── GameController（已是 Component，直接引用）─────────────────────────
    @property(GameController)
    gameController!: GameController;

    // ── HandCardView 节点 ─────────────────────────────────────────────────
    @property(Button) playButton!: Button;
    @property(Label)  patternLabel!: Label;

    // ── PlayZone 节点 ─────────────────────────────────────────────────────
    @property(Button) playBtn!: Button;
    @property(Button) passBtn!: Button;
    @property(Label)  playErrorLabel!: Label;
    @property(Node)   playErrorNode!: Node;
    @property(Label)  timerLabel!: Label;

    // ── 5 个席位节点（顺序：0=本人, 1=左前, 2=左, 3=右, 4=右前）────────────
    @property([Node]) seatNodes: Node[] = [];
    // 每个席位需要的子节点引用（通过 getChildByName 获取）

    // ── CodeCardSelector 节点 ─────────────────────────────────────────────
    @property(Node)   codeSelectorRoot!: Node;
    @property(Button) confirmCodeBtn!: Button;

    // ── SettlementView 节点 ───────────────────────────────────────────────
    @property(Node)   settlementRoot!: Node;
    @property(Label)  bannerLabel!: Label;
    @property(Button) playAgainBtn!: Button;
    @property(Button) returnHallBtn!: Button;

    private _netManager = new NetManager();

    onLoad() {
        this._netManager.init(API_ENDPOINT);

        const handCardView    = this._buildHandCardView();
        const playZone        = this._buildPlayZone();
        const seats           = this._buildSeats();
        const codeSelector    = this._buildCodeSelector();
        const settlementView  = this._buildSettlementView();

        // ── 注入 GameController ────────────────────────────────────────────
        this.gameController.handCardView     = handCardView;
        this.gameController.playZone         = playZone;
        this.gameController.playerSeats      = seats;
        this.gameController.codeCardSelector = codeSelector;
        this.gameController.settlementView   = settlementView;
        this.gameController.netManager       = this._netManager;
    }

    // ── 构建各逻辑实例 ──────────────────────────────────────────────────────

    private _buildHandCardView(): HandCardView {
        const v = new HandCardView();
        v._playButton   = this.playButton;
        v._patternLabel = { string: this.patternLabel.string };
        return v;
    }

    private _buildPlayZone(): PlayZone {
        const v = new PlayZone();
        v._playBtn    = this.playBtn;
        v._passBtn    = this.passBtn;
        v._errorLabel = { string: this.playErrorLabel.string, node: this.playErrorNode };
        v._timerLabel = { string: this.timerLabel.string };
        return v;
    }

    private _buildSeats(): PlayerSeat[] {
        return this.seatNodes.map((node, i) => {
            const seat = new PlayerSeat();
            seat.seatIndex = i;
            // 每个席位子节点命名约定：NicknameLabel / HandCountLabel / TimerNode / BadgeNode / FinishedNode
            seat._nicknameLabel  = { string: node.getChildByName('NicknameLabel')?.getComponent(Label)?.string ?? '' };
            seat._handCountLabel = { string: node.getChildByName('HandCountLabel')?.getComponent(Label)?.string ?? '' };
            seat._timerNode      = node.getChildByName('TimerNode') ?? { active: false };
            seat._identityBadge  = {
                string: '',
                node:   node.getChildByName('BadgeNode') ?? { active: false },
            };
            seat._finishedNode   = node.getChildByName('FinishedNode') ?? { active: false };
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
        v._rootNode      = this.settlementRoot;
        v._bannerLabel   = { string: this.bannerLabel.string };
        v._playAgainBtn  = this.playAgainBtn;
        v._returnHallBtn = this.returnHallBtn;
        v.onPlayAgain    = () => director.loadScene('HallScene');
        v.onReturnHall   = () => director.loadScene('HallScene');
        return v;
    }

    // ── Cocos Button Click 事件（在编辑器里绑到对应 Button 的 Click 事件上）──

    onPlayButtonClick()  { this.gameController.onPlayButtonClick();  }
    onPassButtonClick()  { this.gameController.onPassButtonClick();  }
    onPlayAgainClick()   { this.gameController.settlementView?.onPlayAgainClick?.();  }
    onReturnHallClick()  { this.gameController.settlementView?.onReturnHallClick?.(); }
    onConfirmCodeClick() { this.gameController.codeCardSelector?.confirmSelection?.(); }
}
