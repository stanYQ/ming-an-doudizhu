/**
 * @file PlayerSeat.ts
 * @description 玩家席位 CC Component：挂在 PlayerSeat.prefab 根节点，
 *              通过 @property 绑定子节点，GameCtrl 调用公开方法驱动渲染。
 * @layer ctrl
 * @module client/ui/ctrl
 */
import { _decorator, Component, Label, Sprite, Node, Color } from 'cc';

const { ccclass, property } = _decorator;

export interface SeatData {
    playerId:       string;
    nickname:       string;
    handCount:      number;
    isCurrentTurn:  boolean;
    turnDeadline?:  number;
    isAI?:          boolean;
}

@ccclass('PlayerSeat')
export class PlayerSeat extends Component {

    @property(Label)  nicknameLabel!:  Label;
    @property(Label)  handCountLabel!: Label;
    @property(Node)   timerNode!:      Node;
    @property(Sprite) ringFill!:       Sprite;   // Filled 类型 Sprite，fillRange 0~1
    @property(Node)   badgeNode!:      Node;
    @property(Label)  badgeLabel!:     Label;
    @property(Node)   finishedNode!:   Node;
    @property(Node)   aiBadgeNode!:    Node;
    @property(Node)   passBubbleNode!: Node;  // 「不要」气泡

    seatIndex = 0;

    private _identity = '';
    private _deadline = 0;
    private _totalMs  = 0;

    /**
     * 刷新席位显示数据（每次 turn_change 或 play_broadcast 后调用）。
     */
    refresh(data: SeatData): void {
        if (this.nicknameLabel)  this.nicknameLabel.string  = data.nickname;
        if (this.handCountLabel) this.handCountLabel.string = `剩 ${data.handCount} 张`;
        if (this.finishedNode)   this.finishedNode.active   = data.handCount === 0;
        if (this.aiBadgeNode)    this.aiBadgeNode.active    = data.isAI === true;
        if (data.isCurrentTurn && data.turnDeadline) {
            this.startTurnRing(data.turnDeadline);
        } else {
            this.stopTurnRing();
        }
    }

    /**
     * 显示圆环并按剩余时间推进 fillRange（每 500ms 更新一次）。
     * @param deadline 服务端下发的截止时间戳（ms）
     */
    startTurnRing(deadline: number): void {
        this.stopTurnRing();
        if (this.timerNode) this.timerNode.active = true;
        this._deadline = deadline;
        this._totalMs  = Math.max(deadline - Date.now(), 1);
        if (this.ringFill) this.ringFill.fillRange = 1;
        this.schedule(this._onRingTick, 0.5);
    }

    private _onRingTick = (): void => {
        const remaining = this._deadline - Date.now();
        if (this.ringFill) {
            this.ringFill.fillRange = Math.max(0, remaining / this._totalMs);
            // AC-24: >15s 金色，10-15s 黄色，<10s 红色
            const sec = remaining / 1000;
            this.ringFill.color = sec > 15 ? new Color('#F0C040')
                                : sec > 10 ? new Color('#F0D020')
                                : new Color('#C0392B');
        }
        if (remaining <= 0) this.stopTurnRing();
    };

    /** 隐藏圆环并停止计时。 */
    stopTurnRing(): void {
        this.unschedule(this._onRingTick);
        if (this.timerNode) this.timerNode.active = false;
        if (this.ringFill)  this.ringFill.fillRange = 1;
    }

    /**
     * 显示身份标签（identity_reveal 触发）。
     * @param role 'landlord' | 'partner' | 'civilian'
     */
    showIdentity(role: 'landlord' | 'partner' | 'civilian'): void {
        this._identity = role;
        if (role === 'civilian') {
            if (this.badgeNode) this.badgeNode.active = false;
        } else {
            if (this.badgeLabel) this.badgeLabel.string = role === 'landlord' ? '地主' : '搭档';
            if (this.badgeNode)  this.badgeNode.active  = true;
        }
    }

    /** AC-12: 显示「不要」气泡，500ms 后自动消失。 */
    showPassBubble(): void {
        if (!this.passBubbleNode) return;
        this.passBubbleNode.active = true;
        this.scheduleOnce(() => {
            if (this.passBubbleNode) this.passBubbleNode.active = false;
        }, 0.5);
    }

    /** 标记该席位玩家已出完所有手牌。 */
    showFinished(): void {
        if (this.finishedNode) this.finishedNode.active = true;
    }

    getIdentity(): string { return this._identity; }

}
