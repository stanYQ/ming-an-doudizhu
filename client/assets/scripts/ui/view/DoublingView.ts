/**
 * @file DoublingView.ts
 * @description 加倍阶段 UI：倒计时 + ×1/×2 选择 + 全员结果汇总展示。
 * @module client/ui
 */

export interface DoublingStartMsg {
    timeout:            number;  // 倒计时秒数（断线重连时为剩余秒数）
    landlordSeatIndex:  number;
}

export interface LandlordDoubledMsg {
    value: 1 | 2;
}

export interface DoublingResultMsg {
    results: Array<{ seatIndex: number; doubled: boolean }>;
}

export class DoublingView {
    // 由 Cocos 场景装配脚本注入
    _rootNode:    { active: boolean }       = { active: false };
    _timerLabel:  { string: string }        = { string: '' };
    _statusLabel: { string: string }        = { string: '' };
    _singleBtn:   { interactable: boolean } = { interactable: false };
    _doubleBtn:   { interactable: boolean } = { interactable: false };
    _resultLabel: { string: string; node: { active: boolean } } = { string: '', node: { active: false } };

    /** 本人席位编号，GameController 在 setConnected 后注入 */
    _mySeatIndex: number = -1;
    /** 加倍选择回调，GameController 在收到 doubling_start 前注入 */
    _onSetDouble: (value: 1 | 2) => void = () => {};

    // 定时器函数，测试时注入 fake 实现
    _setInterval:   (fn: () => void, ms: number) => any = (fn, ms) => setInterval(fn, ms);
    _clearInterval: (id: any) => void                   = (id) => clearInterval(id);
    _setTimeout:    (fn: () => void, ms: number) => any = (fn, ms) => setTimeout(fn, ms);

    private _timerHandle: any   = null;
    private _submitted          = false;

    /**
     * 显示加倍面板并启动倒计时。
     * 地主立即可点击；非地主初始禁用，等待地主先选。
     * @param msg 服务端 doubling_start 消息（断线重连时 timeout 为剩余秒数）
     */
    show(msg: DoublingStartMsg): void {
        this._rootNode.active         = true;
        this._submitted               = false;
        this._resultLabel.node.active = false;

        const isLandlord = msg.landlordSeatIndex === this._mySeatIndex;
        this._statusLabel.string = isLandlord ? '选择加倍倍数' : '等待地主选择…';
        this._setButtons(isLandlord);
        this._startCountdown(msg.timeout);
    }

    /**
     * 地主加倍结果到达：更新状态文字，若本人未提交则解锁按钮。
     * 注意：本人已提交后不再解锁（防重复提交）。
     * @param msg landlord_doubled 消息
     */
    onLandlordDoubled(msg: LandlordDoubledMsg): void {
        this._statusLabel.string = `地主选择 ×${msg.value}`;
        if (!this._submitted) {
            this._setButtons(true);
        }
    }

    /**
     * 全员加倍结果到达：逐座位展示，1.5 秒后自动隐藏面板。
     * @param msg doubling_result 消息
     */
    onResult(msg: DoublingResultMsg): void {
        this._setButtons(false);
        this._resultLabel.string = msg.results
            .map(r => `座位${r.seatIndex}: ${r.doubled ? '已加倍 ×2' : '未加倍 ×1'}`)
            .join('\n');
        this._resultLabel.node.active = true;
        this._setTimeout(() => this.hide(), 1500);
    }

    /** 立即隐藏面板并停止倒计时（STATE=playing 触发或 onResult 计时结束后调用）。 */
    hide(): void {
        this._rootNode.active = false;
        if (this._timerHandle !== null) {
            this._clearInterval(this._timerHandle);
            this._timerHandle = null;
        }
    }

    /** ×1 不加倍按钮回调。 */
    onSingleClick(): void { this._submit(1); }

    /** ×2 加倍按钮回调。 */
    onDoubleClick(): void { this._submit(2); }

    private _submit(value: 1 | 2): void {
        if (this._submitted || !this._singleBtn.interactable) return;
        this._submitted = true;
        this._setButtons(false);
        this._onSetDouble(value);
    }

    private _startCountdown(seconds: number): void {
        if (this._timerHandle !== null) this._clearInterval(this._timerHandle);
        let remaining = seconds;
        this._timerLabel.string = String(remaining);
        this._timerHandle = this._setInterval(() => {
            remaining--;
            this._timerLabel.string = String(remaining);
            if (remaining <= 0) {
                this._clearInterval(this._timerHandle);
                this._timerHandle = null;
                // 倒计时归零，禁用按钮防止超时后仍提交
                this._setButtons(false);
            }
        }, 1000);
    }

    private _setButtons(enabled: boolean): void {
        this._singleBtn.interactable = enabled;
        this._doubleBtn.interactable = enabled;
    }
}
