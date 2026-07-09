/**
 * @file DoublingView.ts
 * @description 加倍阶段 CC Component：倒计时 + ×1/×2 选择 + 全员结果汇总。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Label, Button, tween, Vec3, Color } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIId } from '../../config/UIId';

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

    private _mySeatIndex: number = -1;
    private _onSetDouble: (value: 1 | 2) => void = () => {};
    private _submitted     = false;
    private _remaining     = 0;

    /** oops.gui.open 时框架调用。AC-1: 从屏幕顶部滑入。 */
    onAdded(data: { msg: DoublingStartMsg; mySeatIndex: number; onSetDouble: (v: 1 | 2) => void }): void {
        this._mySeatIndex = data.mySeatIndex;
        this._onSetDouble = data.onSetDouble;
        this._submitted              = false;
        this.resultLabel.node.active = false;
        const isLandlord = data.msg.landlordSeatIndex === this._mySeatIndex;
        this.statusLabel.string = isLandlord ? '选择加倍倍数' : '等待地主选择…';
        this._setButtons(isLandlord);

        // AC-1: 从顶部滑入
        this.node.setPosition(640, 800);
        tween(this.node)
            .to(0.25, { position: new Vec3(640, 500, 0) }, { easing: 'backOut' })
            .start();

        this._startCountdown(data.msg.timeout);
    }

    /**
     * 地主加倍结果到达：更新状态文字，若本人未提交则解锁按钮。
     */
    onLandlordDoubled(msg: LandlordDoubledMsg): void {
        this.statusLabel.string = `地主选择 ×${msg.value}`;
        if (!this._submitted) this._setButtons(true);
    }

    /**
     * 全员加倍结果到达：展示结果，1.5 秒后自动关闭。
     */
    onResult(msg: DoublingResultMsg): void {
        this._setButtons(false);
        this.resultLabel.string = msg.results
            .map(r => `座位${r.seatIndex}: ${r.doubled ? '已加倍 ×2' : '未加倍 ×1'}`)
            .join('\n');
        this.resultLabel.node.active = true;
        this.scheduleOnce(() => this.hide(), 1.5);
    }

    hide(): void {
        this.unscheduleAllCallbacks();
        tween(this.node)
            .to(0.2, { position: new Vec3(640, 800, 0) }, { easing: 'backIn' })
            .call(() => oops.gui.remove(UIId.DoublingView))
            .start();
    }

    onSingleClick(): void { this._submit(1); }
    onDoubleClick(): void { this._submit(2); }

    private _submit(value: 1 | 2): void {
        if (this._submitted || !this.singleBtn.interactable) return;
        this._submitted = true;
        this._setButtons(false);
        this._onSetDouble(value);
    }

    private _startCountdown(seconds: number): void {
        this.unschedule(this._onTick);
        this._remaining = seconds;
        this.timerLabel.string = String(this._remaining);
        this.schedule(this._onTick, 1);
    }

    private _onTick = (): void => {
        this._remaining--;
        this.timerLabel.string = String(this._remaining);
        // AC-7: ≤10s 变红色
        this.timerLabel.color = this._remaining <= 10
            ? new Color('#C0392B')
            : new Color('#FFFFFF');
        if (this._remaining <= 0) {
            this.unschedule(this._onTick);
            this._setButtons(false);
        }
    };

    private _setButtons(enabled: boolean): void {
        this.singleBtn.interactable = enabled;
        this.doubleBtn.interactable = enabled;
    }
}
