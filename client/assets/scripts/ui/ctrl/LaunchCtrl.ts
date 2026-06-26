/**
 * @file LaunchCtrl.ts
 * @description 启动场景 Controller：挂在 LaunchScene/Canvas/LaunchController 节点。
 *              持有进度条 / 错误标签等 CC 节点，将 CC 操作注入 LaunchLogic，不含业务判断。
 * @module client/ui/ctrl
 */

import { _decorator, Component, Label, Node, UITransform, director, tween } from 'cc';
import { oops }          from 'db://oops-framework/core/Oops';
import { LaunchLogic }   from '../../logic/LaunchLogic';

const { ccclass, property } = _decorator;

// P1 STUB-ONLY: 上线前替换为环境变量或 config 注入
const API_BASE       = 'http://localhost:2567';
const BAR_FULL_WIDTH = 400;
const MAX_RETRIES    = 3;

@ccclass('LaunchCtrl')
export class LaunchCtrl extends Component {

    @property(Node)  progressBarFill!: Node;
    @property(Label) progressLabel!:   Label;
    @property(Node)  errorLabel!:      Node;

    private _logic!:      LaunchLogic;
    private _retries = 0;

    onLoad() {
        this._logic = new LaunchLogic();

        this._logic._loadAssets = () => this._preloadWithProgress();

        this._logic._fetchLogin = (code) =>
            fetch(`${API_BASE}/auth/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ code }),
            });

        this._logic._storage = {
            getItem:    (k) => oops.storage?.get(k) ?? null,
            setItem:    (k, v) => oops.storage?.set(k, v),
            removeItem: (k) => oops.storage?.remove(k),
        };

        this._logic._navigateToHall = () => director.loadScene('HallScene');

        // 错误回调：最多重试 MAX_RETRIES 次，超出后停留在错误页
        this._logic._onError = (msg) => {
            if (this.errorLabel) this.errorLabel.active = true;
            oops.gui.toast(msg);
            if (this._retries < MAX_RETRIES) {
                this._retries++;
                this.scheduleOnce(() => this._logic.onLoad(), 2);
            }
        };

        this._logic.onLoad();
    }

    private _preloadWithProgress(): Promise<void> {
        return new Promise((resolve, reject) => {
            let progress = 0;
            let loaded   = false;

            const timer = setInterval(() => {
                if (loaded) return;
                progress = Math.min(progress + Math.random() * 12 + 3, 90);
                this._setProgress(progress);
            }, 120);

            oops.res.loadBundle('game', (err: any) => {
                clearInterval(timer);
                if (err) { reject(err); return; }
                loaded = true;
                this._setProgress(100);
                this.scheduleOnce(() => resolve(), 0.25);
            });
        });
    }

    private _setProgress(pct: number) {
        if (this.progressLabel) {
            this.progressLabel.string = `加载中… ${Math.floor(pct)}%`;
        }
        if (this.progressBarFill) {
            const tf = this.progressBarFill.getComponent(UITransform);
            if (tf) tween(tf).to(0.08, { width: BAR_FULL_WIDTH * pct / 100 }).start();
        }
    }
}
