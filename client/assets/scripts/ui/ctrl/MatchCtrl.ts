/**
 * @file MatchCtrl.ts
 * @description 匹配弹层 Controller（Prefab 根脚本）。
 *              onLoad 从 oops.storage 读取 mode，订阅服务端消息更新 UI。
 *              所有网络动作通过 MATCH_ACTION 事件委托给 HallLogic，不直接调网络。
 * @layer ctrl
 * @module client/ui/ctrl
 */
import { _decorator, Component, Label, Button, Node, sys } from 'cc';
import { oops }    from 'db://oops-framework/core/Oops';
import { message } from 'db://oops-framework/core/common/event/MessageManager';

const { ccclass, property } = _decorator;

@ccclass('MatchCtrl')
export class MatchCtrl extends Component {

    // ── 快速匹配区 ────────────────────────────────────────────────────────────
    @property(Label)  statusLabel!:      Label;
    @property(Label)  playerCountLabel!: Label;
    @property(Node)   aiCountdownNode!:  Node;
    @property(Label)  aiCountdownLabel!: Label;
    @property(Button) cancelBtn!:        Button;

    // ── 好友房区 ──────────────────────────────────────────────────────────────
    @property(Label)   roomCodeLabel!:    Label;
    @property(Node)    roomCodeNode!:     Node;
    @property(Button)  copyBtn!:          Button;
    @property([Label]) playerListLabels:  Label[] = [];
    @property(Node)    startGameBtnNode!: Node;
    @property(Button)  startGameBtn!:     Button;
    @property(Node)    ownerHintNode!:    Node;
    @property(Button)  shareBtn!:         Button;

    // ── 通用 ──────────────────────────────────────────────────────────────────
    @property(Label) errorLabel!: Label;
    @property(Node)  errorNode!:  Node;

    private _mode     = '';
    private _roomCode = '';
    private _mySeat   = -1;

    // ── 生命周期 ──────────────────────────────────────────────────────────────

    onLoad() {
        this._mode = oops.storage?.get('match_mode') ?? 'quick';
        this._applyModeLayout();

        message.on('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.on('ROOM_UPDATE',    this._onRoomUpdate,    this);
        message.on('ERROR',          this._onError,         this);
    }

    onDestroy() {
        message.off('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.off('ROOM_UPDATE',    this._onRoomUpdate,    this);
        message.off('ERROR',          this._onError,         this);
    }

    // ── Button Click（委托 HallLogic 处理网络）────────────────────────────────

    onCancelClick(): void {
        message.dispatchEvent('MATCH_ACTION', { action: 'cancel' });
    }

    onCreateRoomClick(): void {
        message.dispatchEvent('MATCH_ACTION', { action: 'createRoom' });
    }

    onJoinRoomClick(): void {
        const code = this.roomCodeLabel?.string ?? '';
        if (code) message.dispatchEvent('MATCH_ACTION', { action: 'joinByCode', payload: code });
    }

    onForceStartClick(): void {
        message.dispatchEvent('MATCH_ACTION', { action: 'forceStart' });
    }

    onCopyCodeClick(): void {
        if (this._roomCode) sys.copyTextToClipboard(this._roomCode);
    }

    async onShareClick(): Promise<void> {
        if (!this._roomCode) return;
        const text = `我在玩明暗斗地主，房间码：${this._roomCode}，快来加入！`;
        try {
            if ((globalThis as any).wx?.shareAppMessage) {
                (globalThis as any).wx.shareAppMessage({ title: text });
            } else if ((navigator as any)?.share) {
                await (navigator as any).share({ text });
            } else {
                sys.copyTextToClipboard(text);
                oops.gui.toast('房间码已复制');
            }
        } catch { /* 用户取消，静默 */ }
    }

    // ── 服务端消息处理 ────────────────────────────────────────────────────────

    private _onWaitingUpdate(_evt: string, msg: { readyCount: number; total: number; aiSeconds: number }): void {
        if (this.playerCountLabel) {
            this.playerCountLabel.string = `${msg.readyCount}/${msg.total} 人已加入`;
        }
        const full = msg.readyCount >= (msg.total ?? 5);
        if (this.aiCountdownNode) this.aiCountdownNode.active = !full;
        if (!full && this.aiCountdownLabel) {
            this.aiCountdownLabel.string = msg.aiSeconds > 0
                ? `${msg.aiSeconds} 秒后 AI 补位`
                : 'AI 补位中…';
        }
    }

    private _onRoomUpdate(_evt: string, msg: { players: { nickname: string }[]; ownerSeatIndex: number; roomCode?: string }): void {
        if (msg.roomCode) {
            this._roomCode = msg.roomCode;
            if (this.roomCodeLabel) this.roomCodeLabel.string = msg.roomCode;
            if (this.roomCodeNode)  this.roomCodeNode.active  = true;
        }
        for (let i = 0; i < 5; i++) {
            if (this.playerListLabels[i]) {
                this.playerListLabels[i].string = msg.players[i]?.nickname ?? '等待加入…';
            }
        }
        const isOwner = msg.ownerSeatIndex === this._mySeat;
        if (this.startGameBtnNode) this.startGameBtnNode.active = isOwner;
        if (this.ownerHintNode)    this.ownerHintNode.active    = !isOwner;
        if (isOwner && this.startGameBtn) {
            this.startGameBtn.interactable = msg.players.length >= 2;
        }
    }

    private _onError(_evt: string, msg: { code: number }): void {
        const text = msg.code === 2002 ? '房间不存在，请检查房间码'
                   : msg.code === 2001 ? '房间已满'
                   : msg.code === 2003 ? '至少需要 2 名真实玩家才能开局'
                   : `匹配错误 (${msg.code})`;
        if (this.errorLabel) this.errorLabel.string = text;
        if (this.errorNode)  this.errorNode.active  = true;
    }

    // ── 私有 ─────────────────────────────────────────────────────────────────

    private _applyModeLayout(): void {
        const isFriend = this._mode === 'friend';
        if (this.aiCountdownNode)  this.aiCountdownNode.active  = !isFriend;
        if (this.roomCodeNode)     this.roomCodeNode.active     = false;
        if (this.startGameBtnNode) this.startGameBtnNode.active = false;
        if (this.ownerHintNode)    this.ownerHintNode.active    = isFriend;
        if (this.statusLabel) {
            this.statusLabel.string = isFriend ? '好友房' : '快速匹配中…';
        }
    }
}
