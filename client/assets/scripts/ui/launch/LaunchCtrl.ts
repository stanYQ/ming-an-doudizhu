/**
 * @file LaunchCtrl.ts
 * @description 启动场景 Controller：挂在 LaunchScene/Canvas/LaunchController 节点。
 *              持有进度条 / 错误标签等 CC 节点，将 CC 操作注入 LaunchLogic，不含业务判断。
 * @module client/ui/ctrl
 */

import { _decorator, Component, Label, ProgressBar, director, tween } from 'cc';
import { oops }                       from 'db://oops-framework/core/Oops';
import { LaunchLogic }               from '../../logic/LaunchLogic';
import { SERVER_URL, MAX_RETRIES }   from '../../config/AppConfig';

const { ccclass, property } = _decorator;

@ccclass('LaunchCtrl')
export class LaunchCtrl extends Component {

    @property(ProgressBar) progressBar!:   ProgressBar;  // 进度条组件，progress 属性 0→1 控制填充
    @property(Label)       progressLabel!: Label;        // 「加载中… XX%」进度文字

    private _logic!:      LaunchLogic;
    private _retries = 0;

    onLoad() {
        this._logic = new LaunchLogic();

        this._logic._loadAssets = () => this._preloadWithProgress();

        this._logic._fetchLogin = (code) =>
            fetch(`${SERVER_URL}/auth/login`, {
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

        // 错误回调：toast 提示，最多重试 MAX_RETRIES 次
        this._logic._onError = (msg) => {
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
            // 进度动画与加载速度解耦：先跑 0→90% 的模拟动画，加载完成后再推到 100%
            const state = { pct: 0 };
            const anim = tween(state)
                .to(2.5, { pct: 90 }, { onUpdate: () => this._setProgress(state.pct) })
                .start();

            // oops.res.loadBundle 是 Promise API；错误时 resolve(null) 不 reject，需判 null
            oops.res.loadBundle('game').then((gameBundle) => {
                anim.stop();
                if (!gameBundle) {
                    reject(new Error('分包加载失败，请检查网络'));
                    return;
                }
                tween(state)
                    .to(0.3, { pct: 100 }, { onUpdate: () => this._setProgress(state.pct) })
                    .call(() => this.scheduleOnce(() => resolve(), 0.25))
                    .start();
            });
        });
    }

    private _setProgress(pct: number) {
        if (this.progressLabel) {
            this.progressLabel.string = `加载中… ${Math.floor(pct)}%`;
        }
        if (this.progressBar) {
            this.progressBar.progress = pct / 100;
        }
    }
}
