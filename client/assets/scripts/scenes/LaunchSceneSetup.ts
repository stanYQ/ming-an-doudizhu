/**
 * @file LaunchSceneSetup.ts
 * @description 启动场景全自动装配：挂到 Canvas 上即可，运行时创建全部节点并启动 LaunchView 流程。
 * @module client/scenes
 *
 * 使用方法：
 *   1. 编辑器新建 LaunchScene
 *   2. Hierarchy 里 Canvas 节点选中
 *   3. 属性检查器 → 添加组件 → LaunchSceneSetup
 *   4. 运行
 */

import {
    _decorator, Component, Node, Label, Color,
    director, sys,
} from 'cc';
import { LaunchView } from '../ui/LaunchView';
import { makeNode, makeLabel, makeButton, makeFullscreenWidget, bindClick } from './NodeFactory';

const { ccclass } = _decorator;

const API_BASE = 'http://localhost:2567';

@ccclass('LaunchSceneSetup')
export class LaunchSceneSetup extends Component {

    // ── 逻辑实例（装配后持有，供重试按钮调用）─────────────────────────────
    private _view!: LaunchView;

    onLoad() {
        const canvas = this.node;

        // ── 1. 建节点树 ─────────────────────────────────────────────────
        const root      = makeNode('LaunchRoot', 1280, 720);
        makeFullscreenWidget(root);
        root.parent = canvas;

        const [errorNode, errorLabel] = makeLabel({
            name: 'ErrorLabel', text: '',
            width: 600, height: 60,
            color: new Color(255, 80, 80, 255),
        });
        errorNode.setPosition(0, -80, 0);
        errorNode.parent = root;

        const [retryNode, retryBtn] = makeButton({ name: 'RetryBtn', label: '重试', width: 200, height: 70 });
        retryNode.setPosition(0, -180, 0);
        retryNode.parent = root;

        // ── 2. 装配 LaunchView ───────────────────────────────────────────
        const view = new LaunchView();
        this._view = view;

        view._errorLabel  = { string: errorLabel.string, node: errorNode };
        view._retryBtn    = { node: retryNode };
        view._loadAssets  = () => this._preloadBundles();
        view._fetchLogin  = (code) =>
            fetch(`${API_BASE}/auth/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ code }),
            });
        view._storage     = {
            getItem:    (k) => sys.localStorage.getItem(k),
            setItem:    (k, v) => sys.localStorage.setItem(k, v),
            removeItem: (k) => sys.localStorage.removeItem(k),
        };
        view._navigateToHall = () => director.loadScene('HallScene');

        // ── 3. 绑定重试按钮 ──────────────────────────────────────────────
        bindClick(retryBtn, this.node, 'LaunchSceneSetup', 'onRetryClick');

        // ── 4. 启动 ──────────────────────────────────────────────────────
        view.onLoad();
    }

    onRetryClick() {
        this._view.onLoad();
    }

    private _preloadBundles(): Promise<void> {
        // Hall bundle will be created when HallScene is built in CC editor.
        // Skip preload during early development to avoid 404.
        return Promise.resolve();
    }
}
