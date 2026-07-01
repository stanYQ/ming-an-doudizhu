/**
 * @file DoublingView.ts
 * @description 加倍阶段 CC Component：倒计时 + ×1/×2 选择 + 全员结果汇总。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Label, Button } from 'cc';

const { ccclass, property } = _decorator;

export interface DoublingStartMsg {
    timeout:           number;  // 倒计时秒数（断线重连时为剩余秒数）
    landlordSeatIndex: number;
}

export interface LandlordDoubledMsg {
    value: 1 | 2;
}

export interface DoublingResultMsg {
    results: Array<{ seatIndex: number; doubled: boolean }>;
}

@ccclass('DoublingView')
export class DoublingView extends Component {

    @property(Label)  timerLabel!:  Label;
    @property(Label)  statusLabel!: Label;
    @property(Button) singleBtn!:   Button;
    @property(Button) doubleBtn!:   Button;
    @property(Label)  resultLabel!: Label;  // 结果展示（显隐用 resultLabel.node.active）

    /** 本人席位编号，GameCtrl 在 onLoad 注入 */
    _mySeatIndex: number = -1;
    /** 加倍选择回调，GameCtrl 在收到 DOUBLING_START 前注入 */
    _onSetDouble: (value: 1 | 2) => void = () => {};

    private _submitted     = false;
    private _timerHandle: any = null;

    /**
     * 显示加倍面板并启动倒计时。
     * 地主立即可点击；非地主初始禁用，等待地主先选。
     */
    show(msg: DoublingStartMsg): void {
        this.node.active             = true;
        this._submitted              = false;
        this.resultLabel.node.active = false;

        const isLandlord = msg.landlordSeatIndex === this._mySeatIndex;
        this.statusLabel.string = isLandlord ? '选择加倍倍数' : '等待地主选择…';
        this._setButtons(isLandlord);
        this._startCountdown(msg.timeout);
    }

    /**
     * 地主加倍结果到达：更新状态文字，若本人未提交则解锁按钮。
     */
    onLandlordDoubled(msg: LandlordDoubledMsg): void {
        this.statusLabel.string = `地主选择 ×${msg.value}`;
        if (!this._submitted) this._setButtons(true);
    }

    /**
     * 全员加倍结果到达：展示结果，1.5 秒后自动隐藏。
     */
    onResult(msg: DoublingResultMsg): void {
        this._setButtons(false);
        this.resultLabel.string = msg.results
            .map(r => `座位${r.seatIndex}: ${r.doubled ? '已加倍 ×2' : '未加倍 ×1'}`)
            .join('\n');
        this.resultLabel.node.active = true;
        setTimeout(() => this.isValid && this.hide(), 1500);
    }

    /** 隐藏面板并停止倒计时。 */
    hide(): void {
        this.node.active = false;
        if (this._timerHandle !== null) {
            clearInterval(this._timerHandle);
            this._timerHandle = null;
        }
    }

    onSingleClick(): void { this._submit(1); }
    onDoubleClick(): void { this._submit(2); }

    onDestroy(): void {
        if (this._timerHandle !== null) clearInterval(this._timerHandle);
    }

    private _submit(value: 1 | 2): void {
        if (this._submitted || !this.singleBtn.interactable) return;
        this._submitted = true;
        this._setButtons(false);
        this._onSetDouble(value);
    }

    private _startCountdown(seconds: number): void {
        if (this._timerHandle !== null) clearInterval(this._timerHandle);
        let remaining = seconds;
        this.timerLabel.string = String(remaining);
        this._timerHandle = setInterval(() => {
            remaining--;
            this.timerLabel.string = String(remaining);
            if (remaining <= 0) {
                clearInterval(this._timerHandle);
                this._timerHandle = null;
                this._setButtons(false);
            }
        }, 1000);
    }

    private _setButtons(enabled: boolean): void {
        this.singleBtn.interactable = enabled;
        this.doubleBtn.interactable = enabled;
    }
}
