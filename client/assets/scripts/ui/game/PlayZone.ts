/**
 * @file PlayZone.ts
 * @description 中央出牌区 CC Component：展示上一手牌、按钮控制、错误提示、倒计时。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PlayZone')
export class PlayZone extends Component {

    @property(Label) timerLabel!: Label;   // 当前出牌者倒计时
    @property(Label) lastPlayLabel!: Label; // 上一手牌文字（TASK-044 替换为卡牌节点）

    private _lastPlayerId = '';
    private _lastCards:   number[] = [];
    private _deadline     = 0;

    // 每帧更新倒计时显示（deadline=0 时跳过）
    update(_dt: number): void {
        if (this._deadline <= 0 || !this.timerLabel) return;
        const remaining = Math.max(0, Math.ceil((this._deadline - Date.now()) / 1000));
        this.timerLabel.string = String(remaining);
        if (remaining <= 0) this._deadline = 0;
    }

    /**
     * 记录上一手出牌信息。
     * @param playerId 出牌者 sessionId
     * @param cards    出的牌，0-107 编码数组
     */
    showLastPlay(playerId: string, cards: number[]): void {
        this._lastPlayerId = playerId;
        this._lastCards    = cards;
    }

    getLastPlayerId(): string  { return this._lastPlayerId; }
    getLastCards():   number[] { return this._lastCards; }

    clear(): void {
        this._lastPlayerId = '';
        this._lastCards    = [];
    }

    /**
     * 启动倒计时（deadline 后 update() 会驱动 timerLabel）。
     * @param deadline 服务端下发的截止时间戳（毫秒）
     */
    startCountdown(deadline: number): void {
        this._deadline = deadline;
    }

}
