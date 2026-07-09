/**
 * @file MatchCtrl.ts
 * @description 匹配弹层 Controller（Prefab 根脚本）。
 *              onLoad 从 oops.storage 读取 mode，订阅服务端消息更新 UI。
 *              所有网络动作通过 MATCH_ACTION 事件委托给 HallLogic，不直接调网络。
 * @layer ctrl
 * @module client/ui/ctrl
 */
import { _decorator, Component, Label, Button, Node, EditBox, tween, Vec3, Widget } from 'cc';
import { oops }       from 'db://oops-framework/core/Oops';
import { message }    from 'db://oops-framework/core/common/event/MessageManager';
import { netManager } from '../../net/NetManager';

const { ccclass, property } = _decorator;

@ccclass('MatchCtrl')
export class MatchCtrl extends Component {

    // ── 快速匹配区 ────────────────────────────────────────────────────────────
    @property(Label)  statusLabel!:      Label;
    @property(Label)  playerCountLabel!: Label;
    @property(Node)   aiCountdownNode!:  Node;
    @property(Label)  aiCountdownLabel!: Label;
    @property(Button) cancelBtn!:        Button;
    @property(Node)   dotsNode!:         Node;    // 3 点跳动容器（含 Dot0/Dot1/Dot2 子节点）

    // ── 模式容器 ──────────────────────────────────────────────────────────────
    @property(Node) quickMatchContent!: Node;
    @property(Node) friendRoomContent!: Node;

    // ── 好友房区 ──────────────────────────────────────────────────────────────
    @property(Label)   roomCodeLabel!:    Label;
    @property(Node)    roomCodeNode!:     Node;
    @property(Button)  copyBtn!:          Button;
    @property([Label]) playerListLabels:  Label[] = [];
    @property(Node)    startGameBtnNode!: Node;
    @property(Button)  startGameBtn!:     Button;
    @property(Node)    ownerHintNode!:    Node;
    @property(Button)  shareBtn!:         Button;

    // ── 好友房 — 未入房状态（创建 / 输入房码加入）──────────────────────────
    @property(Node)   joinAreaNode!:   Node;     // 输入房码 + 加入/创建按钮 容器（RoomcodeNode 子节点）
    @property(EditBox) roomCodeInput!:  EditBox;  // 6 位房码输入框
    @property(Button) joinBtn!:         Button;   // 「加入」按钮


    private _mode         = '';
    private _roomCode     = '';
    private _mySeat       = -1;
    private _statusTick    = 0;          // 状态文字 "匹配中." 点循环
    private _statusTimer:  ReturnType<typeof setInterval> | null = null;

    // ── 生命周期 ──────────────────────────────────────────────────────────────

    onLoad() {
        this._ensureCentered();

        this._mode = oops.storage?.get('match_mode') ?? 'quick';

        const room = netManager.room;
        if (room) {
            const me = (room.state?.players as any)?.get?.(room.sessionId);
            this._mySeat = (me?.seatIndex as number) ?? -1;
        }

        this._applyModeLayout();

        if (this._mode === 'quick') {
            this._startQuickMatchFeel();
        }

        message.on('WAITING_UPDATE', this._onWaitingUpdate, this);
        message.on('ROOM_UPDATE',    this._onRoomUpdate,    this);
        message.on('ERROR',          this._onError,         this);
    }

    onDestroy() {
        this._stopQuickMatchFeel();
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
        const code = (this.roomCodeInput?.string ?? '').trim().toUpperCase();
        if (!code) { oops.gui.toast('请输入房间码'); return; }
        if (code.length !== 6) { oops.gui.toast('房间码为 6 位'); return; }
        message.dispatchEvent('MATCH_ACTION', { action: 'joinByCode', payload: code });
    }

    onForceStartClick(): void {
        message.dispatchEvent('MATCH_ACTION', { action: 'forceStart' });
    }

    onCopyCodeClick(): void {
        if (this._roomCode) this._copyToClipboard(this._roomCode);
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
                this._copyToClipboard(text);
                oops.gui.toast('房间码已复制');
            }
        } catch { /* 用户取消，静默 */ }
    }

    private _copyToClipboard(text: string): void {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).catch(() => { /* 静默 */ });
        } else {
            // Fallback for non-secure-context H5
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed'; ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    }

    // ── 服务端消息处理 ────────────────────────────────────────────────────────

    private _onWaitingUpdate(_evt: string, msg: { readyCount: number; total: number; aiSeconds: number }): void {
        if (this.playerCountLabel) {
            this.playerCountLabel.string = `${msg.readyCount}/${msg.total} 人已加入`;
        }
        const full = msg.readyCount >= (msg.total ?? 5);
        if (this.aiCountdownNode) this.aiCountdownNode.active = !full;
        if (full) {
            this._stopQuickMatchFeel();
            if (this.statusLabel) this.statusLabel.string = '即将开始…';
        } else if (this.aiCountdownLabel) {
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
            // 入房成功 → 隐藏加入/创建区域
            if (this.joinAreaNode) this.joinAreaNode.active = false;
            // 入房成功 → 刷新本机 seatIndex（onLoad 时 room 还不存在）
            const room = netManager.room;
            if (room) {
                const me = (room.state?.players as any)?.get?.(room.sessionId);
                this._mySeat = (me?.seatIndex as number) ?? -1;
            }
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

    private _onError(_evt: string, msg: { code: number; msg?: string }): void {
        const text = msg.code === 2002 ? '房间不存在，请检查房间码'
                   : msg.code === 2001 ? '房间已满'
                   : msg.code === 2003 ? '至少需要 2 名真实玩家才能开局'
                   : (msg.msg || `匹配错误 (${msg.code})`);
        oops.gui.toast(text);
    }

    // ── 匹配氛围 ─────────────────────────────────────────────────────────────

    /** 启动快速匹配动效：3 点跳动 + 状态文字省略号循环 */
    private _startQuickMatchFeel(): void {
        this._startDotsAnim();
        this._statusTimer = setInterval(() => {
            this._statusTick = (this._statusTick + 1) % 3;
            if (this.statusLabel) {
                const dots = '.'.repeat(this._statusTick + 1);
                this.statusLabel.string = `匹配中${dots}`;
            }
        }, 500);
        // 初始人数显示（服务端 waiting_update 可能尚未到达）
        if (this.playerCountLabel) this.playerCountLabel.string = '匹配中…';
        if (this.aiCountdownLabel) this.aiCountdownLabel.string = 'AI 补位中…';
    }

    private _stopQuickMatchFeel(): void {
        if (this._statusTimer) { clearInterval(this._statusTimer); this._statusTimer = null; }
    }

    /** 3 个金色圆点循环跳动，各错开 200ms。dotsNode 未绑定时用 SVG 圆点 children 兜底 */
    private _startDotsAnim(): void {
        const container = this.dotsNode;
        if (!container) return;
        const dots = container.children;
        if (dots.length === 0) return;
        dots.forEach((dot, i) => {
            tween(dot)
                .delay(i * 0.2)
                .by(0.3, { position: new Vec3(0, 12, 0) }, { easing: 'sineOut' })
                .by(0.3, { position: new Vec3(0, -12, 0) }, { easing: 'sineIn' })
                .union()
                .repeatForever()
                .start();
        });
    }

    private _applyModeLayout(): void {
        const isFriend = this._mode === 'friend';
        if (this.quickMatchContent) this.quickMatchContent.active = !isFriend;
        if (this.friendRoomContent) this.friendRoomContent.active = isFriend;

        if (this.aiCountdownNode)  this.aiCountdownNode.active  = !isFriend;

        if (isFriend) {
            // 好友房初始：roomCodeNode 保持 active（Join 是其子节点），其他子节点由 room_update 控制
            if (this.roomCodeNode)     this.roomCodeNode.active     = true;
            if (this.joinAreaNode)     this.joinAreaNode.active     = true;
            if (this.startGameBtnNode) this.startGameBtnNode.active = false;
            if (this.ownerHintNode)    this.ownerHintNode.active    = false;
        } else {
            if (this.roomCodeNode)     this.roomCodeNode.active     = false;
            if (this.joinAreaNode)     this.joinAreaNode.active     = false;
            if (this.startGameBtnNode) this.startGameBtnNode.active = false;
            if (this.ownerHintNode)    this.ownerHintNode.active    = false;
        }

        if (this.statusLabel) {
            this.statusLabel.string = isFriend ? '好友房' : '';    // quick 模式由 _startQuickMatchFeel 接管
        }
    }

    /** 确保根节点始终居中于父容器（Canvas 尺寸与设计分辨率不匹配时防止偏移） */
    private _ensureCentered(): void {
        const w = this.node.getComponent(Widget) || this.node.addComponent(Widget);
        w.alignMode               = Widget.AlignMode.ALWAYS;
        w.isAlignHorizontalCenter = true;
        w.isAlignVerticalCenter   = true;
    }
}
