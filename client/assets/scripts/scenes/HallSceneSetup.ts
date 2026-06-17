/**
 * @file HallSceneSetup.ts
 * @description 大厅场景全自动装配：挂到 Canvas 上即可，运行时创建全部节点并启动 HallView + MatchView。
 * @module client/scenes
 *
 * 使用方法：
 *   1. 编辑器新建 HallScene
 *   2. Canvas 节点 → 添加组件 → HallSceneSetup
 *   3. 运行
 */

import {
    _decorator, Component, Node, Label, Color,
    director, sys,
} from 'cc';
import { HallView, HallPlayerInfo } from '../ui/HallView';
import { MatchView } from '../ui/MatchView';
import { NetManager } from '../net/NetManager';
import { makeNode, makeLabel, makeButton, makeFullscreenWidget, bindClick } from './NodeFactory';

const { ccclass } = _decorator;

const API_ENDPOINT = 'ws://localhost:2567';
const CACHE_KEY_USER = 'ddz_user';

@ccclass('HallSceneSetup')
export class HallSceneSetup extends Component {

    private _hallView!: HallView;
    private _matchView!: MatchView;
    private _net = new NetManager();

    onLoad() {
        this._net.init(API_ENDPOINT);

        const canvas = this.node;

        // ── 大厅根节点 ───────────────────────────────────────────────────
        const hallRoot = makeNode('HallRoot', 1280, 720);
        makeFullscreenWidget(hallRoot);
        hallRoot.parent = canvas;

        // 玩家信息
        const [, nickLabel]  = makeLabel({ name: 'NicknameLabel', text: '', width: 300, height: 50, fontSize: 32 });
        const [, scoreLabel] = makeLabel({ name: 'ScoreLabel',    text: '', width: 200, height: 50 });
        const [, rankLabel]  = makeLabel({ name: 'RankLabel',     text: '', width: 200, height: 50 });

        nickLabel.node.setPosition(-400, 280, 0);   nickLabel.node.parent = hallRoot;
        scoreLabel.node.setPosition(-200, 280, 0);  scoreLabel.node.parent = hallRoot;
        rankLabel.node.setPosition(0,    280, 0);   rankLabel.node.parent = hallRoot;

        // 主按钮
        const [qmNode, qmBtn]  = makeButton({ name: 'QuickMatchBtn',  label: '快速匹配', width: 260, height: 90 });
        const [frNode, frBtn]  = makeButton({ name: 'FriendRoomBtn',  label: '好友房',   width: 260, height: 90 });
        qmNode.setPosition(-160, 0, 0); qmNode.parent = hallRoot;
        frNode.setPosition( 160, 0, 0); frNode.parent = hallRoot;

        bindClick(qmBtn, this.node, 'HallSceneSetup', 'onQuickMatchClick');
        bindClick(frBtn, this.node, 'HallSceneSetup', 'onFriendRoomClick');

        // ── 匹配弹窗根节点（默认隐藏）────────────────────────────────────
        const matchRoot = makeNode('MatchViewRoot', 800, 600);
        matchRoot.active = false;
        matchRoot.parent = canvas;

        const [, statusLabel]      = makeLabel({ name: 'StatusLabel',      text: '',  width: 500, height: 50 });
        const [, playerCountLabel] = makeLabel({ name: 'PlayerCountLabel', text: '',  width: 300, height: 50 });
        const [roomCodeNode, roomCodeLabel] = makeLabel({ name: 'RoomCodeLabel', text: '', width: 300, height: 60, fontSize: 48 });
        const [, matchErrorLabel]  = makeLabel({ name: 'MatchErrorLabel',  text: '',  width: 500, height: 50, color: new Color(255, 80, 80, 255) });

        statusLabel.node.setPosition(0,  200, 0);   statusLabel.node.parent      = matchRoot;
        playerCountLabel.node.setPosition(0, 130, 0); playerCountLabel.node.parent = matchRoot;
        roomCodeNode.setPosition(0, 50, 0);           roomCodeNode.parent          = matchRoot;
        matchErrorLabel.node.setPosition(0, -30, 0);  matchErrorLabel.node.parent  = matchRoot;

        const [copyNode, copyBtn]     = makeButton({ name: 'CopyBtn',      label: '复制房间码', width: 220, height: 60 });
        const [createNode, createBtn] = makeButton({ name: 'CreateRoomBtn', label: '创建房间',  width: 220, height: 70 });
        const [joinNode,   joinBtn]   = makeButton({ name: 'JoinRoomBtn',   label: '加入房间',  width: 220, height: 70 });
        const [cancelNode, cancelBtn] = makeButton({ name: 'CancelBtn',     label: '取消',      width: 160, height: 60 });

        copyNode.setPosition(0,  -100, 0);  copyNode.parent   = matchRoot;
        createNode.setPosition(-130, -180, 0); createNode.parent = matchRoot;
        joinNode.setPosition(  130, -180, 0); joinNode.parent   = matchRoot;
        cancelNode.setPosition(0,  -270, 0); cancelNode.parent  = matchRoot;

        bindClick(copyBtn,   this.node, 'HallSceneSetup', 'onCopyCodeClick');
        bindClick(createBtn, this.node, 'HallSceneSetup', 'onCreateRoomClick');
        bindClick(joinBtn,   this.node, 'HallSceneSetup', 'onJoinRoomClick');
        bindClick(cancelBtn, this.node, 'HallSceneSetup', 'onCancelMatchClick');

        // ── 装配 MatchView ───────────────────────────────────────────────
        const mv = new MatchView();
        this._matchView = mv;

        mv._statusLabel      = { string: statusLabel.string };
        mv._playerCountLabel = { string: playerCountLabel.string };
        mv._roomCodeLabel    = { string: roomCodeLabel.string, node: roomCodeNode };
        mv._copyBtn          = { node: copyNode };
        mv._errorLabel       = { string: matchErrorLabel.string, node: matchErrorLabel.node };
        mv._rootNode         = matchRoot;
        mv._joinRoom         = (name, opts) => this._net.joinRoom(name, opts).then(() => ({}));
        mv._leaveRoom        = async () => {};
        mv._navigateToGame   = () => director.loadScene('GameScene');
        mv._navigateToHall   = () => mv.hide();
        mv._clipboard        = { copy: (t) => (sys as any).copyTextToClipboard?.(t) };

        // ── 装配 HallView ────────────────────────────────────────────────
        const hv = new HallView();
        this._hallView = hv;

        hv._nicknameLabel = { string: nickLabel.string };
        hv._scoreLabel    = { string: scoreLabel.string };
        hv._rankLabel     = { string: rankLabel.string };
        hv._rootNode      = hallRoot;
        hv._quickMatchBtn = qmBtn;
        hv._friendRoomBtn = frBtn;
        hv._matchView     = mv;
        hv._navigateToLogin = () => director.loadScene('LaunchScene');

        // ── 读缓存，启动 ─────────────────────────────────────────────────
        const raw  = sys.localStorage.getItem(CACHE_KEY_USER);
        const info: HallPlayerInfo | null = raw ? JSON.parse(raw) : null;
        hv.show(info);
    }

    // ── Button 点击代理（Cocos EventHandler 调用这里）─────────────────────

    onQuickMatchClick()  { this._matchView.showQuickMatch();    }
    onFriendRoomClick()  { this._matchView.showFriendRoom();    }
    onCreateRoomClick()  { this._matchView.onCreateRoomClick(); }
    onJoinRoomClick()    { this._matchView.onJoinRoomClick();   }
    onCancelMatchClick() { this._matchView.onCancelClick();     }
    onCopyCodeClick()    { this._matchView.onCopyCodeClick();   }
}
