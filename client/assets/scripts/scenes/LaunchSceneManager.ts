/**
 * @file LaunchSceneManager.ts
 * @description 启动场景 Manager：将 LaunchView 逻辑类与 Cocos 节点/API 接线。
 *              挂载到 LaunchScene 的根节点 LaunchRoot 上。
 * @module client/scenes
 */

import { _decorator, Component, Label, Node, director, assetManager } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { LaunchView } from '../ui/LaunchView';

const { ccclass, property } = _decorator;

const API_BASE = 'http://localhost:2567'; // P4 改为生产地址

@ccclass('LaunchSceneManager')
export class LaunchSceneManager extends Component {

    @property(Label)
    errorLabel!: Label;

    @property(Node)
    retryBtnNode!: Node;

    onLoad() {
        const view = new LaunchView();

        // ── 注入 UI 引用 ───────────────────────────────────────────────────
        view._errorLabel  = this.errorLabel;   // Label 本身有 .string 和 .node
        view._retryBtn    = { node: this.retryBtnNode };

        // ── 注入依赖 ───────────────────────────────────────────────────────
        view._loadAssets = () => this._preloadBundles();

        view._fetchLogin = (code: string) =>
            fetch(`${API_BASE}/auth/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ code }),
            });

        view._storage = {
            getItem:    (k) => oops.storage?.get(k) ?? null,
            setItem:    (k, v) => oops.storage?.set(k, v),
            removeItem: (k) => oops.storage?.remove(k),
        };

        view._navigateToHall = () => director.loadScene('HallScene');

        // ── 启动 ───────────────────────────────────────────────────────────
        view.onLoad();
    }

    private _preloadBundles(): Promise<void> {
        return new Promise((resolve, reject) => {
            assetManager.loadBundle('hall', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}
