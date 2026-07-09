/**
 * @file SettlementView.ts
 * @description 结算界面 CC Component：胜负横幅、全员积分、倍率明细、再来一局。
 *              V2：支持 breakdown 字段（底分/加倍明细/流水公式），向下兼容 V1。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Label, Button, tween, UIOpacity } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIId } from '../../config/UIId';

const { ccclass, property } = _decorator;

export interface PlayerResult {
    playerId:   string;
    nickname:   string;
    role:       'landlord' | 'partner' | 'civilian';
    scoreDelta: number;
    isMe:       boolean;
}

export interface BreakdownV2 {
    baseScore:       number;
    landlordDouble:  1 | 2;
    playerDoubles:   Record<string, 1 | 2>;
    isLandlordAlone: boolean;
    isSpring:        boolean;
    isAntiSpring:    boolean;
}

export interface SettlementData {
    winnerCamp:       0 | 1;
    players:          PlayerResult[];
    multiplier:       number;
    multiplierDetail: { mode: number; bombCount: number; rocketCount: number };
    breakdown?:       BreakdownV2;
}

export interface GameOverMsg {
    winnerCamp:  0 | 1;
    scores?:     Record<string, number>;
    players?:    Array<{ sessionId: string; nickname: string; role: 'landlord'|'partner'|'civilian'; scoreDelta: number; newScore: number|null; seatIndex: number }>;
    breakdown?:  BreakdownV2;
    multiplier?: number;
}

export interface RematchUpdateMsg {
    agreedCount: number;
    total:       number;
}

const BASE_SCORE_LABELS: Record<number, string> = { 1: '入门场', 2: '休闲场', 5: '精英场', 10: '巅峰场' };

@ccclass('SettlementView')
export class SettlementView extends Component {

    @property(Label)  bannerLabel!:        Label;
    @property(Label)  scoresLabel!:        Label;  // 分数摘要
    @property(Button) playAgainBtn!:       Button;
    @property(Button) returnHallBtn!:      Button;
    @property(Label)  rematchStatusLabel!: Label;  // .node.active 控制显隐

    private _requestRematch:       () => void          = () => {};
    private _leaveRoom:            () => Promise<void> = () => Promise.resolve();
    private _navigateToHall:       () => void          = () => {};
    private _navigateToQuickMatch: () => void          = () => {};

    private _data:          SettlementData | null = null;
    private _animating      = false;
    private _rematchPending = false;

    /** oops.gui.open 时框架调用。fade-in 入场动画延迟到下一帧（此时节点已挂载到 UI 层）。 */
    onAdded(data: {
        msg:                 GameOverMsg;
        requestRematch:      () => void;
        leaveRoom:           () => Promise<void>;
        navigateToHall:      () => void;
        navigateToQuickMatch:() => void;
    }): void {
        this._requestRematch       = data.requestRematch;
        this._leaveRoom            = data.leaveRoom;
        this._navigateToHall       = data.navigateToHall;
        this._navigateToQuickMatch = data.navigateToQuickMatch;

        // fade-in 入场动画：延迟到下一帧，因为 onAdded 时节点尚未挂载到 UI 层
        this.scheduleOnce(() => {
            const uiOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
            uiOpacity.opacity = 0;
            tween(uiOpacity)
                .to(0.35, { opacity: 255 })
                .call(() => this.finishAnimation())
                .start();
        }, 0);

        this.showResult(data.msg);
    }

    /** 展示结算界面（动画期间按钮禁用）。 */
    private show(data: SettlementData): void {
        this._data                       = data;
        this._animating                  = true;
        this.playAgainBtn.interactable   = false;
        this.returnHallBtn.interactable  = false;
        this.bannerLabel.string          = data.winnerCamp === 1 ? '地主阵营获胜' : '平民阵营获胜';
    }

    /**
     * 接收 game_over 消息并展示（GameCtrl 调用）。
     * V2 含 breakdown 显示明细；缺失降级为 V1。
     */
    showResult(msg: GameOverMsg): void {
        const players: PlayerResult[] = (msg.players ?? []).map(p => ({
            playerId:   p.sessionId,
            nickname:   p.nickname,
            role:       p.role,
            scoreDelta: p.scoreDelta,
            isMe:       false,
        }));
        this.show({
            winnerCamp:       msg.winnerCamp,
            players,
            multiplier:       msg.multiplier ?? 0,
            multiplierDetail: { mode: 1, bombCount: 0, rocketCount: 0 },
            breakdown:        msg.breakdown,
        });

        // 填充分数摘要
        if (this.scoresLabel && msg.players?.length) {
            const lines = msg.players.map(p =>
                `${this.formatScore(p.scoreDelta)}（余额: ${p.newScore}）`
            );
            this.scoresLabel.string = lines.join('  |  ');
        }
    }

    hide(): void { oops.gui.remove(UIId.SettlementView); }

    /** Cocos tween 动画结束后调用，解锁操作按钮。 */
    finishAnimation(): void {
        this._animating                  = false;
        this.playAgainBtn.interactable   = true;
        this.returnHallBtn.interactable  = true;
    }

    onPlayAgainClick(): void {
        if (this._animating || this._rematchPending) return;
        this._rematchPending                 = true;
        this.playAgainBtn.interactable       = false;
        this.rematchStatusLabel.string       = '等待中…';
        this.rematchStatusLabel.node.active  = true;
        this._requestRematch();
        this.scheduleOnce(this._onRematchTimeout, 30);
    }

    onReturnHallClick(): void {
        if (this._animating) return;
        this.unschedule(this._onRematchTimeout);
        this._leaveRoom();
        this.hide();
        this._navigateToHall();
    }

    onRematchUpdate(msg: RematchUpdateMsg): void {
        this.rematchStatusLabel.string      = `${msg.agreedCount}/${msg.total} 人同意再来一局`;
        this.rematchStatusLabel.node.active = true;
    }

    onRematchStart(): void {
        this.unschedule(this._onRematchTimeout);
        this.hide();
    }

    onRematchRedirect(): void {
        this.unschedule(this._onRematchTimeout);
        this.hide();
        this._leaveRoom();
        this._navigateToQuickMatch();
    }

    // ── 数据查询方法 ────────────────────────────────────────────────────────────

    formatScore(delta: number): string { return delta >= 0 ? `+${delta}` : `${delta}`; }
    getPlayers():    PlayerResult[]   { return this._data?.players ?? []; }
    getMe():         PlayerResult | undefined { return this._data?.players.find(p => p.isMe); }
    getMultiplier(): number           { return this._data?.multiplier ?? 0; }
    getMultiplierDetail(): SettlementData['multiplierDetail'] {
        return this._data?.multiplierDetail ?? { mode: 1, bombCount: 0, rocketCount: 0 };
    }

    hasBreakdown(): boolean { return this._data?.breakdown !== undefined; }

    getBaseScoreLabel(): string {
        const bd = this._data?.breakdown;
        if (!bd) return '';
        const name = BASE_SCORE_LABELS[bd.baseScore] ?? `底分${bd.baseScore}`;
        return `底分 ×${bd.baseScore}（${name}）`;
    }

    getMultiplierLines(): string[] {
        if (!this._data?.breakdown) return [];
        const { isSpring, isAntiSpring, isLandlordAlone } = this._data.breakdown;
        const { bombCount, rocketCount }                  = this._data.multiplierDetail;
        const lines: string[] = [];
        for (let i = 0; i < bombCount;  i++) lines.push('炸弹 ×2');
        for (let i = 0; i < rocketCount; i++) lines.push('王炸 ×3');
        if (isSpring)        lines.push('春天 ×2');
        if (isAntiSpring)    lines.push('反春天 ×2');
        if (isLandlordAlone) lines.push('一挑四 ×3');
        return lines;
    }

    getGlobalMultiplierLine(): string {
        if (!this._data?.breakdown) return '';
        return `全局倍数 M = ×${this._data.multiplier}`;
    }

    getLandlordDoubleLabel(): string {
        const bd = this._data?.breakdown;
        if (!bd) return '';
        return bd.landlordDouble === 2 ? '地主加倍 ×2' : '地主未加倍';
    }

    getPlayerDoubleLabel(sessionId: string): string {
        const bd = this._data?.breakdown;
        if (!bd) return '';
        return (bd.playerDoubles[sessionId] ?? 1) === 2 ? '加倍 ×2' : '未加倍';
    }

    getFlowText(sessionId: string): string {
        const bd = this._data?.breakdown;
        if (!bd) return '';
        const B    = bd.baseScore;
        const M    = this._data!.multiplier;
        const dL   = bd.landlordDouble;
        const di   = bd.playerDoubles[sessionId] ?? 1;
        const flow = B * M * dL * di;
        return `${B} × ${M} × ${dL} × ${di} = ${flow}`;
    }

    isLandlordAloneMode(): boolean { return this._data?.breakdown?.isLandlordAlone ?? false; }

    getPartnerSplitLabel(partnerSessionId: string): string {
        const bd = this._data?.breakdown;
        if (!bd) return '';
        return (bd.playerDoubles[partnerSessionId] ?? 1) === 2
            ? '内部分配：1:1'
            : '内部分配：2:1';
    }

    private _onRematchTimeout = (): void => {
        this._rematchPending                = false;
        this.playAgainBtn.interactable      = true;
        this.rematchStatusLabel.string      = '有玩家未同意';
        this.rematchStatusLabel.node.active = true;
    };
}
