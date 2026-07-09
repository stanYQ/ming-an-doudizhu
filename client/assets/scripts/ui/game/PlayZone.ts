/**
 * @file PlayZone.ts
 * @description 中央出牌区 CC Component：本轮所有出牌累积展示，新轮次清空。
 * @layer ctrl
 * @module client/ui/game
 */
import { _decorator, Component, Label, Node, Prefab, instantiate, NodePool, Layout, UITransform } from 'cc';

const { ccclass, property } = _decorator;

interface PlayEntry {
    playerId: string;
    cards:    number[];
    nodes:    Node[];
}

@ccclass('PlayZone')
export class PlayZone extends Component {

    @property(Label)  timerLabel!:        Label;
    @property(Node)   lastPlayContainer!: Node;
    @property(Prefab) miniCardPrefab!:     Prefab;
    @property(Label)  playerNameLabel!:    Label;
    @property(Label)  freeRoundLabel!:     Label;

    private _lastPlayerId = '';
    private _lastCards:   number[] = [];
    private _deadline     = 0;
    private _pool!:       NodePool;

    /** 本轮累计出牌（按出牌顺序） */
    private _roundPlays: PlayEntry[] = [];

    onLoad() {
        this._pool = new NodePool('MiniCard');
    }

    update(_dt: number): void {
        if (this._deadline <= 0 || !this.timerLabel) return;
        const remaining = Math.max(0, Math.ceil((this._deadline - Date.now()) / 1000));
        this.timerLabel.string = String(remaining);
        if (remaining <= 0) this._deadline = 0;
    }

    /**
     * 本轮新增一手出牌。同一 playerId 重复出牌时先移除旧牌再加新牌（自由出牌轮）。
     */
    showLastPlay(playerId: string, cards: number[]): void {
        this._lastPlayerId = playerId;
        this._lastCards    = cards;

        if (!this.lastPlayContainer || !this.miniCardPrefab) return;
        if (this.freeRoundLabel) this.freeRoundLabel.node.active = false;

        // 销毁 Layout，否则自动排版会覆盖手动 setPosition
        const lo = this.lastPlayContainer.getComponent(Layout);
        if (lo) lo.destroy();

        // 同一玩家再次出牌（自由出牌轮自己继续出）：先回收旧牌
        const dupIdx = this._roundPlays.findIndex(p => p.playerId === playerId);
        if (dupIdx >= 0) {
            const old = this._roundPlays[dupIdx];
            old.nodes.forEach(n => { n.removeFromParent(); n.setScale(1, 1, 1); this._pool.put(n); });
            this._roundPlays.splice(dupIdx, 1);
        }

        // 创建新牌节点
        const CARD_W  = 57;
        const SCALE   = 1.3;
        const overlap = cards.length > 8 ? 0.50 : 0.30;
        const visible = CARD_W * (1 - overlap);
        const startX  = -(cards.length - 1) * visible / 2;

        const nodes: Node[] = [];
        for (const code of cards) {
            const node = this._pool.size() > 0
                ? this._pool.get()!
                : instantiate(this.miniCardPrefab);
            node.getComponent('CardItem')?.['setup']?.(code);
            node.setScale(SCALE, SCALE, 1);
            this.lastPlayContainer.addChild(node);
            nodes.push(node);
        }

        this._roundPlays.push({ playerId, cards, nodes });

        // 整体重新排版：每家牌组之间留 20px 间距
        this._relayout();
    }

    getLastPlayerId(): string  { return this._lastPlayerId; }
    getLastCards():   number[] { return this._lastCards; }

    /** 新轮次开始（全员 pass 或牌局结束），清空所有累积。 */
    clear(): void {
        this._lastPlayerId = '';
        this._lastCards    = [];
        if (this.freeRoundLabel) this.freeRoundLabel.node.active = true;
        this._recycleAll();
    }

    startCountdown(deadline: number): void {
        this._deadline = deadline;
    }

    // ── 内部 ──────────────────────────────────────────────────────────────────

    /** 按顺序排版所有累积的牌组 */
    private _relayout(): void {
        const CARD_W  = 57;
        const SCALE   = 1.3;
        const GAP     = 20;  // 不同玩家牌组之间的间距

        let xCursor = 0;
        const allNodes: Node[] = [];
        for (const entry of this._roundPlays) {
            const overlap = entry.cards.length > 8 ? 0.50 : 0.30;
            const visible = CARD_W * (1 - overlap);
            const groupW  = (entry.cards.length - 1) * visible + CARD_W;
            const startX  = xCursor + CARD_W / 2;
            entry.nodes.forEach((node, i) => {
                node.setScale(SCALE, SCALE, 1);
                node.setPosition(startX + i * visible, 0, 0);
                allNodes.push(node);
            });
            xCursor += groupW + GAP;
        }

        // 整体居中
        const totalW = Math.max(xCursor - GAP, CARD_W);
        allNodes.forEach(n => {
            const pos = n.position;
            n.setPosition(pos.x - totalW / 2, pos.y, pos.z);
        });

        // 扩展容器 UITransform，确保触摸区域覆盖所有牌
        const containerUT = this.lastPlayContainer.getComponent(UITransform);
        if (containerUT) {
            containerUT.setContentSize(totalW + 40, CARD_W * 2);
        }
    }

    private _recycleAll(): void {
        for (const entry of this._roundPlays) {
            entry.nodes.forEach(n => {
                n.removeFromParent();
                n.setScale(1, 1, 1);
                this._pool.put(n);
            });
        }
        this._roundPlays = [];
    }

}
