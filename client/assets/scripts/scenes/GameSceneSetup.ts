/**
 * @file GameSceneSetup.ts
 * @description 游戏桌场景全自动装配：挂到 Canvas 上即可，运行时创建全部节点并注入 GameController。
 * @module client/scenes
 *
 * 使用方法：
 *   1. 编辑器新建 GameScene
 *   2. Canvas 节点 → 添加组件 → GameSceneSetup
 *   3. 运行
 */

import {
    _decorator, Component, Node, Label, Color,
    director,
} from 'cc';
import { GameController } from '../game/GameController';
import { NetManager } from '../net/NetManager';
import { HandCardView } from '../ui/HandCardView';
import { PlayZone } from '../ui/PlayZone';
import { PlayerSeat, SeatData } from '../ui/PlayerSeat';
import { CodeCardSelector, CodeCardChoice } from '../ui/CodeCardSelector';
import { SettlementView, SettlementData } from '../ui/SettlementView';
import { makeNode, makeLabel, makeButton, makeFullscreenWidget, bindClick } from './NodeFactory';

const { ccclass } = _decorator;

const API_ENDPOINT = 'ws://localhost:2567';

// 5 个席位的位置（本人在底部中央，其余环绕）
const SEAT_POSITIONS: [number, number][] = [
    [  0, -280],  // 0 本人（底部）
    [-500,  -80],  // 1 左前
    [-500,  200],  // 2 左
    [ 500,  200],  // 3 右
    [ 500,  -80],  // 4 右前
];

@ccclass('GameSceneSetup')
export class GameSceneSetup extends Component {

    private _net = new NetManager();
    private _ctrl!: GameController;

    onLoad() {
        this._net.init(API_ENDPOINT);

        const canvas = this.node;

        // GameController 挂在同节点上
        this._ctrl = canvas.addComponent(GameController);

        // ── 手牌区 ────────────────────────────────────────────────────────
        const handArea = makeNode('HandCardArea', 1280, 200);
        handArea.setPosition(0, -300, 0);
        handArea.parent = canvas;

        const [playBtnNode, playBtnComp] = makeButton({ name: 'PlayButton', label: '出牌', width: 200, height: 80 });
        const [, patternLabelComp]       = makeLabel({ name: 'PatternLabel', text: '请选择合法牌型', width: 400, height: 50 });

        playBtnNode.setPosition(500, 60, 0);   playBtnNode.parent          = handArea;
        patternLabelComp.node.setPosition(500, -30, 0); patternLabelComp.node.parent = handArea;

        bindClick(playBtnComp, canvas, 'GameSceneSetup', 'onPlayButtonClick');

        const handCardView = new HandCardView();
        handCardView._playButton   = playBtnComp;
        handCardView._patternLabel = { string: patternLabelComp.string };

        // ── 出牌区 ────────────────────────────────────────────────────────
        const playArea = makeNode('PlayZoneArea', 600, 200);
        playArea.setPosition(0, 0, 0);
        playArea.parent = canvas;

        const [, playBtnZone]  = makeButton({ name: 'PlayBtn',  label: '出牌', width: 160, height: 70 });
        const [, passBtnZone]  = makeButton({ name: 'PassBtn',  label: '不要', width: 160, height: 70 });
        const [errNode, errLbl] = makeLabel({ name: 'ErrorLabel', text: '', width: 400, height: 50, color: new Color(255, 80, 80, 255) });
        const [, timerLbl]      = makeLabel({ name: 'TimerLabel', text: '',  width: 200, height: 50 });

        playBtnZone.node.setPosition(-200, -80, 0);  playBtnZone.node.parent  = playArea;
        passBtnZone.node.setPosition( 200, -80, 0);  passBtnZone.node.parent  = playArea;
        errNode.setPosition(0, 60, 0);               errNode.parent           = playArea;
        timerLbl.node.setPosition(0, 110, 0);        timerLbl.node.parent     = playArea;

        bindClick(playBtnZone, canvas, 'GameSceneSetup', 'onPlayButtonClick');
        bindClick(passBtnZone, canvas, 'GameSceneSetup', 'onPassButtonClick');

        const playZone = new PlayZone();
        playZone._playBtn    = playBtnZone;
        playZone._passBtn    = passBtnZone;
        playZone._errorLabel = { string: errLbl.string, node: errNode };
        playZone._timerLabel = { string: timerLbl.string };

        // ── 5 个席位 ──────────────────────────────────────────────────────
        const seatsRoot = makeNode('Seats', 0, 0);
        seatsRoot.parent = canvas;

        const seats = SEAT_POSITIONS.map(([x, y], i) => {
            const seatNode = makeNode(`Seat${i}`, 180, 220);
            seatNode.setPosition(x, y, 0);
            seatNode.parent = seatsRoot;

            const [, nickL]   = makeLabel({ name: 'NicknameLabel',  text: `玩家${i}`, width: 160, height: 40, fontSize: 24 });
            const [, countL]  = makeLabel({ name: 'HandCountLabel', text: '0',         width: 80,  height: 40, fontSize: 28 });
            const timerNode   = makeNode('TimerNode',  100, 100);
            const badgeNode   = makeNode('BadgeNode',  120, 40);
            const finishNode  = makeNode('FinishedNode', 120, 40);

            nickL.node.setPosition(0,  60, 0); nickL.node.parent  = seatNode;
            countL.node.setPosition(0,  20, 0); countL.node.parent = seatNode;
            timerNode.setPosition(0,  -20, 0); timerNode.parent   = seatNode;
            badgeNode.setPosition(0,  -70, 0); badgeNode.parent   = seatNode;
            finishNode.setPosition(0, -70, 0); finishNode.parent  = seatNode;

            timerNode.active = badgeNode.active = finishNode.active = false;

            const [, badgeLbl] = makeLabel({ name: 'BadgeLabel', text: '', width: 120, height: 40, fontSize: 22 });
            badgeLbl.node.parent = badgeNode;

            const seat = new PlayerSeat();
            seat.seatIndex        = i;
            seat._nicknameLabel   = { string: nickL.string };
            seat._handCountLabel  = { string: countL.string };
            seat._timerNode       = timerNode;
            seat._identityBadge   = { string: badgeLbl.string, node: badgeNode };
            seat._finishedNode    = finishNode;
            return seat;
        });

        // ── 暗号牌选择器（默认隐藏）─────────────────────────────────────
        const codeRoot = makeNode('CodeSelectorRoot', 700, 500);
        codeRoot.active = false;
        codeRoot.parent = canvas;

        const [, confirmBtnComp] = makeButton({ name: 'ConfirmCodeBtn', label: '确定', width: 200, height: 80 });
        confirmBtnComp.node.setPosition(0, -200, 0);
        confirmBtnComp.node.parent = codeRoot;

        bindClick(confirmBtnComp, canvas, 'GameSceneSetup', 'onConfirmCodeClick');

        const codeSelector = new CodeCardSelector();
        codeSelector._confirmBtn = confirmBtnComp;
        codeSelector._rootNode   = codeRoot;
        codeSelector.onConfirm   = (choice: CodeCardChoice) => {
            this._ctrl.onCodeCardSelect(String(choice.suit), choice.rank);
        };

        // ── 结算界面（默认隐藏）─────────────────────────────────────────
        const settlementRoot = makeNode('SettlementRoot', 1000, 700);
        settlementRoot.active = false;
        settlementRoot.parent = canvas;

        const [, bannerLbl]     = makeLabel({ name: 'BannerLabel',  text: '', width: 600, height: 80, fontSize: 48 });
        const [, playAgainBtn]  = makeButton({ name: 'PlayAgainBtn',  label: '再来一局', width: 240, height: 80 });
        const [, returnHallBtn] = makeButton({ name: 'ReturnHallBtn', label: '返回大厅', width: 240, height: 80 });

        bannerLbl.node.setPosition(0,   240, 0);  bannerLbl.node.parent    = settlementRoot;
        playAgainBtn.node.setPosition(-160, -260, 0); playAgainBtn.node.parent  = settlementRoot;
        returnHallBtn.node.setPosition( 160, -260, 0); returnHallBtn.node.parent = settlementRoot;

        bindClick(playAgainBtn,  canvas, 'GameSceneSetup', 'onPlayAgainClick');
        bindClick(returnHallBtn, canvas, 'GameSceneSetup', 'onReturnHallClick');

        const settlementView = new SettlementView();
        settlementView._rootNode      = settlementRoot;
        settlementView._bannerLabel   = { string: bannerLbl.string };
        settlementView._playAgainBtn  = playAgainBtn;
        settlementView._returnHallBtn = returnHallBtn;
        settlementView.onPlayAgain    = () => director.loadScene('HallScene');
        settlementView.onReturnHall   = () => director.loadScene('HallScene');

        // ── 注入 GameController ──────────────────────────────────────────
        this._ctrl.handCardView     = handCardView;
        this._ctrl.playZone         = playZone;
        this._ctrl.playerSeats      = seats;
        this._ctrl.codeCardSelector = codeSelector;
        this._ctrl.settlementView   = settlementView;
        this._ctrl.netManager       = this._net;
    }

    // ── Button 点击代理 ────────────────────────────────────────────────────
    onPlayButtonClick()  { this._ctrl.onPlayButtonClick();  }
    onPassButtonClick()  { this._ctrl.onPassButtonClick();  }
    onPlayAgainClick()   { this._ctrl.settlementView?.onPlayAgainClick?.();  }
    onReturnHallClick()  { this._ctrl.settlementView?.onReturnHallClick?.(); }
    onConfirmCodeClick() { this._ctrl.codeCardSelector?.confirmSelection?.(); }
}
