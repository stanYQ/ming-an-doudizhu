/**
 * @file CardRoom.ts
 * @description Colyseus 游戏房间：状态机 + 消息处理 + AI 补位 + 结算 + 再来一局
 * @module CardRoom
 */
import { Room, Client } from "@colyseus/core";
import type { IncomingMessage } from "http";
import { ArraySchema } from "@colyseus/schema";
import { AuthService } from "../services/AuthService";
import { GameState } from "./schema/GameState";
import { Player } from "./schema/Player";
import { CardPatternEngine } from "../logic/CardPatternEngine";
import { RuleEngine } from "../logic/RuleEngine";
import { CodeCard, CodeCardSelection } from "../logic/CodeCard";
import { Deck } from "../logic/Deck";
import { compareValue } from "../../../shared/CardEncoding";
import { PatternType } from "../../../shared/CardPattern";
import { SettleService, GameSummaryV2, TableType } from "../services/SettleService";
import { AIPlayer } from "../logic/AIPlayer";
import { Logger }   from "../utils/Logger";

type BattlePlay = {
  turn:        number;
  seatIndex:   number;
  sessionId:   string;
  cards:       number[];
  isPass:      boolean;
  patternType: string | null;
};

type BattleReport = {
  roomId:                string;
  startAt:               number;
  endAt:                 number;
  landlordSeat:          number;
  partnerSeat:           number | null;
  partnerRevealedAtTurn: number | null;
  plays:                 BattlePlay[];
  doubling: {
    landlordDouble:    1 | 2;
    partnerDoubled:    boolean;
    otherDoubledSeats: number[];
  };
  result: {
    winnerCamp:   "landlord_camp" | "civilian_camp";
    isSpring:     boolean;
    isAntiSpring: boolean;
    bombCount:    number;
    scores:       Record<string, number>;
  };
};

export class CardRoom extends Room<GameState> {
  maxClients = 5;

  /** AC-7: Colyseus calls this before onJoin. Invalid token → reject with code 3001. */
  static async onAuth(token: string, _req: IncomingMessage): Promise<unknown> {
    if ((process.env.AUTH_MODE ?? "stub") === "stub") return { userId: 0, openid: "stub_user" };
    const payload = AuthService.verifyToken(token);
    if (!payload) throw new Error(JSON.stringify({ code: 3001 }));
    return payload;
  }

  // 手牌绝不入 Schema —— Schema 是公开广播的，入了等于告诉所有人手牌
  private hands        = new Map<string, number[]>();
  private timeoutCount = new Map<string, number>();
  // 三次超时后进入"托管"：后续回合由 executeManagedAction 代为出牌，直到本局结束
  private managed      = new Set<string>();
  private landlordId   = "";
  private partnerId: string | null = null;
  private codeCardPair: number[]   = [];
  private passCount    = 0;
  // startDealing 后固定不变；index = 席位号，value = sessionId（因 AI fake client 需要按席索引）
  private seatMap: string[] = [];
  private turnTimer:           { clear(): void } | null = null;
  // 地主断线时兜底：超时自动以默认暗号牌推进，避免游戏永久挂起（ISSUE-006）
  private landlordSelectTimer: { clear(): void } | null = null;
  // 底牌不进 Schema；断线重连时需从内存重播给地主（ISSUE-007）
  private bottomCards: number[] = [];

  // Doubling phase state
  private doublingTimer:          { clear(): void } | null = null;
  private doublingSubmits         = new Map<string, 1|2>(); // 已确认的加倍提交（地主提交后才写入非地主）
  // 非地主可能在地主提交前就发来 set_double；先缓存，等地主确认后统一 flush（保证地主倍率先到）
  private pendingDoubles          = new Map<string, 1|2>();
  private landlordDoubleSubmitted = false;
  doublingData: {
    landlordDouble: 1|2;
    playerDoubles:  Map<string, 1|2>;
    partnerDoubled: boolean;
  } | null = null;

  // Settlement tracking
  private tableType: TableType      = "casual";
  private gameStartTime             = 0;
  private bombCount                 = 0;
  private rocketSmallCount          = 0;
  private rocketBigCount            = 0;
  private civilianPlayed            = new Set<string>(); // spring detection
  private landlordCampPlayed        = new Set<string>(); // anti-spring detection
  private userIdMap                 = new Map<string, number>(); // sessionId → userId

  // AI fill — TASK-029s / 030s
  private aiFillEnabled   = false;  // 仅快速匹配房且显式开启时为 true
  private isFriendRoom    = false;  // 好友房模式：room_update + force_start 协议
  private _roomCode       = '';     // 好友房唯一邀请码，由 onCreate 生成写入 listing metadata
  private aiFillDelay     = 30;     // AI 补位倒计时（秒），可由 roomOptions / AI_FILL_DELAY env 覆盖
  private aiFillRemaining = 0;      // 剩余秒数，随 waiting_update 广播给客户端
  private aiFillTimer:  { clear(): void } | null = null; // 倒计时结束时触发补位+发牌
  private aiFillTicker: { clear(): void } | null = null; // 每秒递减 aiFillRemaining（setTimeout 链，兼容 clock mock）
  // AI fake client 直接 push 进 this.clients：Colyseus clients 是普通数组，生产和测试均支持 push；
  // AI 的 send 是 no-op，不发真实 WebSocket 消息
  private aiSessionIds    = new Set<string>(); // 标记 AI sessionId，绕过 turnTimer / rematch 计票
  // realPlayerCount 有两个用途：① waiting_update 的 readyCount ② rematch 票数阈值（ISSUE-001 修复点）
  private realPlayerCount = 0;
  private nicknameMap     = new Map<string, string>(); // sessionId → 昵称，供 room_update 使用

  // Battle report — TASK-038
  private battlePlays:            BattlePlay[]  = [];
  private battleStartAt:          number        = 0;
  private battleTurnCount:        number        = 0;
  private partnerRevealedAtTurn:  number | null = null;

  // Rematch — TASK-031s
  private rematchWindow:  { clear(): void } | null = null; // 30s 窗口期定时器，到期才 disconnect
  private rematchAgreed   = new Set<string>();   // 当局已同意再来一局的真实玩家
  private rematchCount    = 0;                   // 连续再来一局次数，超 10 次强制返回大厅

  // ── lifecycle ──────────────────────────────────────────────────────────────

  onCreate(options?: { tableType?: TableType; isFriendRoom?: boolean; aiFillEnabled?: boolean; aiFillDelay?: number }): void {
    this.setState(new GameState());
    this.tableType     = options?.tableType     ?? "casual";
    this.isFriendRoom  = options?.isFriendRoom  ?? false;
    this.aiFillEnabled = options?.aiFillEnabled ?? false;
    // AI_FILL_DELAY env 覆盖默认值，方便本地 demo 设 0 即时补位
    this.aiFillDelay   = options?.aiFillDelay   ?? Number(process.env.AI_FILL_DELAY ?? 30);

    if (this.isFriendRoom) {
      this._roomCode = CardRoom._generateRoomCode();
      // 写入 listing metadata，供 GET /rooms/code/:code 查询（测试环境无此方法，安全跳过）
      this.setMetadata?.({ roomCode: this._roomCode });
    }

    this.onMessage("ready",            (c: Client)                                => this.handleReady(c));
    this.onMessage("select_code_card", (c: Client, m: {suit:number;value:number}) => this.handleSelectCode(c, m));
    this.onMessage("set_double",       (c: Client, m: {value: 1|2})              => this.handleSetDouble(c, m));
    this.onMessage("play_cards",       (c: Client, m: {cards:number[]})           => this.handlePlay(c, m));
    this.onMessage("pass",             (c: Client)                                => this.handlePass(c));
    this.onMessage("reconnect_sync",   (c: Client)                                => this.handleReconnectSync(c));
    this.onMessage("request_hint",     (c: Client)                                => this.handleRequestHint(c));
    this.onMessage("force_start",      (c: Client)                                => this.handleForceStart(c));
    this.onMessage("request_rematch",  (c: Client)                                => this.handleRequestRematch(c));
  }

  onJoin(client: Client, options?: { nickname?: string }, auth?: { userId?: number }): void {
    const seatIndex = this.seatMap.length;
    this.seatMap.push(client.sessionId);
    this.userIdMap.set(client.sessionId, auth?.userId ?? 0);
    this.nicknameMap.set(client.sessionId, options?.nickname ?? `玩家${seatIndex + 1}`);
    this.realPlayerCount++;

    const player = new Player();
    player.sessionId = client.sessionId;
    player.seatIndex = seatIndex;
    this.state.players.set(client.sessionId, player);
    this.timeoutCount.set(client.sessionId, 0);

    // First joiner is owner (friend room)
    if (seatIndex === 0) this.state.ownerSessionId = client.sessionId;

    if (this.clients.length === 5) {
      this.cancelAiFillTimer();
      this.cancelAiFillTick();
      this.startDealing();
      return;
    }

    if (this.isFriendRoom) {
      this.broadcastRoomUpdate();
    } else if (this.aiFillEnabled) {
      if (this.realPlayerCount === 1) {
        this.aiFillRemaining = this.aiFillDelay;
        this.startAiFillCountdown();
      }
      this.broadcastWaitingUpdate();
    }
  }

  onDispose(): void {
    if (this.doublingTimer)       { this.doublingTimer.clear();       this.doublingTimer       = null; }
    if (this.turnTimer)           { this.turnTimer.clear();           this.turnTimer           = null; }
    if (this.landlordSelectTimer) { this.landlordSelectTimer.clear(); this.landlordSelectTimer = null; }
    if (this.aiFillTimer)         { this.aiFillTimer.clear();         this.aiFillTimer         = null; }
    if (this.aiFillTicker)        { this.aiFillTicker.clear();        this.aiFillTicker        = null; }
    if (this.rematchWindow)       { this.rematchWindow.clear();       this.rematchWindow       = null; }
  }

  async onLeave(client: Client, _consented: boolean): Promise<void> {
    // ISSUE-001: 所有阶段均递减，保证 rematch 票数阈值与实际在线人数一致。
    // waiting 阶段仅广播更新后提前返回；游戏中则尝试保留席位 60s。
    if (!this.aiSessionIds.has(client.sessionId)) {
      this.realPlayerCount = Math.max(0, this.realPlayerCount - 1);
      // ISSUE-009: 真实玩家全部离线时取消 rematch 定时器，防止 30s 后 disconnect() 访问
      // 已销毁的 WebSocket 导致 _forciblyCloseClient → undefined.removeAllListeners() 崩溃
      if (this.realPlayerCount === 0) {
        // ISSUE-S007: 最后一个真实玩家离开 → 清定时器、驱逐 AI fake clients、强制 dispose
        if (this.rematchWindow) {
          this.rematchWindow.clear();
          this.rematchWindow = null;
        }
        this._evictAIClients();
        this.disconnect();
        return;
      }
    }

    if (this.state.phase === "waiting") {
      if (this.isFriendRoom) this.broadcastRoomUpdate();
      else if (this.aiFillEnabled) this.broadcastWaitingUpdate();
      return;
    }
    try {
      // 保留席位 60s：resolve = 重连成功，reject = 超时
      await this.allowReconnection(client, 60);
      this.handleReconnectSync(client);
    } catch {
      this.managed.add(client.sessionId);
    }
  }

  // ── dealing ────────────────────────────────────────────────────────────────

  private startDealing(): void {
    this.state.phase  = "dealing";
    this.battleStartAt = Date.now();

    const deck       = Deck.shuffle();
    const { hands, bottom, faceUpCard } = Deck.deal(deck);
    this.bottomCards  = bottom;                                    // ISSUE-007: store for reconnect sync
    const landlordSeat = Deck.findLandlordSeat(hands, faceUpCard);

    this.state.landlordSeat = landlordSeat;
    this.landlordId = this.seatMap[landlordSeat];

    for (let i = 0; i < 5; i++) {
      const sid = this.seatMap[i];
      this.hands.set(sid, [...hands[i]]);
      this.state.players.get(sid)!.handCount = hands[i].length;
    }

    // Private hand delivery (AC-22: hand never in Schema)
    for (const c of this.clients) {
      c.send("your_hand", { cards: this.hands.get(c.sessionId) });
    }

    // Give landlord the bottom cards
    const landlordHand = this.hands.get(this.landlordId)!;
    landlordHand.push(...bottom);
    landlordHand.sort((a, b) => a - b);
    this.state.players.get(this.landlordId)!.handCount = landlordHand.length;

    const landlordClient = this.clients.find(c => c.sessionId === this.landlordId);
    landlordClient?.send("bottom_cards", { cards: bottom });

    this.state.phase = "landlord_select";

    // 地主断线时无 turnTimer 兜底，游戏会永久挂起（ISSUE-006）；
    // 超时后以 { suit:0, value:0 } 自动提交，与地主主动提交走同一路径。
    // LANDLORD_SELECT_TIMEOUT env 方便测试设 0 快速触发。
    const lsTimeout = Number(process.env.LANDLORD_SELECT_TIMEOUT ?? 30);
    this.landlordSelectTimer = this.clock.setTimeout(() => {
      if (this.state.phase === "landlord_select") {
        const fc = this.clients.find(c => c.sessionId === this.landlordId) as Client;
        if (fc) this.handleSelectCode(fc, { suit: 0, value: 0 });
      }
    }, lsTimeout * 1000);

    // Auto-select code card when landlord is an AI player
    if (this.aiSessionIds.has(this.landlordId)) {
      const fakeClient = this.clients.find(c => c.sessionId === this.landlordId) as Client;
      if (fakeClient) this.handleSelectCode(fakeClient, { suit: 0, value: 0 });
    }
  }

  // ── message handlers ───────────────────────────────────────────────────────

  private handleReady(_client: Client): void {
    // reserved for lobby flow
  }

  /**
   * 处理地主选择暗号牌。非地主发送静默忽略（防止客户端漏洞跳过地主选牌）。
   * 提交后立即取消超时定时器，进入加倍阶段。
   */
  private handleSelectCode(client: Client, msg: { suit: number; value: number }): void {
    // 非地主静默忽略，避免任意玩家抢占地主操作
    if (client.sessionId !== this.landlordId) return;
    if (this.state.phase !== "landlord_select") return;
    // 正常提交或超时自动提交均走此路径；取消兜底定时器防止重复触发
    this.cancelLandlordSelectTimer();

    const sel: CodeCardSelection = { suit: msg.suit, rank: msg.value };
    if (!CodeCard.isValidSelection(sel)) {
      client.send("error", { code: 1001, msg: "invalid code card" });
      return;
    }

    const result = CodeCard.resolveTeammate(sel, this.landlordId, this.hands);
    this.partnerId    = result.partnerId;
    this.codeCardPair = result.codeCardPair;
    this.state.isAlone = result.isLandlordAlone;

    for (const [sid, player] of this.state.players) {
      if      (sid === this.landlordId) player.role = "landlord";
      else if (sid === this.partnerId)  player.role = "partner";
      else                              player.role = "civilian";
    }

    this.startDoubling();
  }

  private handlePlay(client: Client, msg: { cards: number[] }): void {
    if (this.state.phase !== "playing") return;

    const player = this.state.players.get(client.sessionId);
    if (!player || player.seatIndex !== this.state.currentTurnSeat) {
      client.send("error", { code: 1003, msg: "not your turn" });
      return;
    }

    const hand = this.hands.get(client.sessionId)!;

    // New round: no cards on table OR this player was last to play (all others passed)
    const isNewRound = this.state.lastPlay.length === 0 ||
                       this.state.lastPlayerId === client.sessionId;
    const lastPattern = isNewRound
      ? null
      : CardPatternEngine.parse([...this.state.lastPlay] as number[]);

    const result = RuleEngine.validatePlay(hand, msg.cards, lastPattern);
    if (!result.ok) {
      client.send("error", { code: result.errorCode!, msg: "invalid play" });
      return;
    }
    console.log('[PLAY] sid=%s cards=%j', client.sessionId, msg.cards);

    this.cancelTurnTimer();
    this.timeoutCount.set(client.sessionId, 0);

    // Track bomb types for multiplier calculation
    const pat = result.pattern;
    if      (pat.type === PatternType.JOKER_BOMB_BIG)   this.rocketBigCount++;
    else if (pat.type === PatternType.JOKER_BOMB_SMALL)  this.rocketSmallCount++;
    else if (pat.type === PatternType.BOMB)              this.bombCount++;

    // Track who played for spring/anti-spring detection
    const sid = client.sessionId;
    if (sid === this.landlordId || sid === this.partnerId) this.landlordCampPlayed.add(sid);
    else                                                    this.civilianPlayed.add(sid);

    // Reveal partner if code card is played
    if (this.partnerId !== null) {
      const partnerPlayer = this.state.players.get(this.partnerId);
      if (partnerPlayer && !partnerPlayer.revealed &&
          CodeCard.containsCodeCard(msg.cards, this.codeCardPair)) {
        partnerPlayer.revealed = true;
        this.broadcast("identity_reveal", { playerId: this.partnerId, role: "partner" });
        this.partnerRevealedAtTurn = this.battleTurnCount + 1; // set before increment below
      }
    }

    this.battleTurnCount++;
    this.battlePlays.push({
      turn:        this.battleTurnCount,
      seatIndex:   player.seatIndex,
      sessionId:   client.sessionId,
      cards:       [...msg.cards],
      isPass:      false,
      patternType: String(pat.type),
    });

    RuleEngine.removeCards(hand, msg.cards);
    player.handCount = hand.length;

    // Update shared last-play state
    this.state.lastPlay.splice(0, this.state.lastPlay.length);
    for (const c of msg.cards) this.state.lastPlay.push(c);
    this.state.lastPlayerId = client.sessionId;
    this.passCount = 0;

    if (hand.length === 0) {
      this.finishGame(client.sessionId);
      return;
    }

    this.advanceTurn();
    this.startTurnTimer();
  }

  private handlePass(client: Client): void {
    if (this.state.phase !== "playing") return;

    const player = this.state.players.get(client.sessionId);
    if (!player || player.seatIndex !== this.state.currentTurnSeat) return;

    // 自由出牌轮（lastPlay 为空，或上一出牌者是自己）必须出牌，不可 pass（GAME-RULES.md 3.2）
    // ISSUE-005: 修复前此处缺少守卫，客户端可连续 pass 破坏 lastPlay 状态
    const isNewRound = this.state.lastPlay.length === 0 ||
                       this.state.lastPlayerId === client.sessionId;
    if (isNewRound) {
      client.send("error", { code: 1002, msg: "自由出牌轮不可 pass" });
      return;
    }

    console.log("[PASS] sid=%s seat=%d", client.sessionId, this.state.currentTurnSeat);

    this.battleTurnCount++;
    this.battlePlays.push({
      turn:        this.battleTurnCount,
      seatIndex:   player.seatIndex,
      sessionId:   client.sessionId,
      cards:       [],
      isPass:      true,
      patternType: null,
    });

    this.cancelTurnTimer();
    this.passCount++;

    // 其余 4 人全部 pass → 本轮结束，清空桌面，下一人自由出牌
    if (this.passCount >= 4) {
      this.passCount = 0;
      this.state.lastPlay.splice(0, this.state.lastPlay.length);
      this.state.lastPlayerId = "";
    }

    this.advanceTurn();
    this.startTurnTimer();
  }

  /**
   * 断线重连后补发当前阶段所需的全量状态。
   * Schema delta 会自动同步公开状态；此处只补发私密数据（手牌、底牌）和阶段触发信号。
   */
  private handleReconnectSync(client: Client): void {
    const hand = this.hands.get(client.sessionId) ?? [];
    client.send("your_hand", { cards: hand });
    if (this.state.phase === "landlord_select") {
      // 底牌不在 Schema 里，地主断线后本地丢失；需从内存重播才能重新弹出选牌界面（ISSUE-007）
      if (client.sessionId === this.landlordId) {
        client.send("bottom_cards",         { cards: this.bottomCards });
        client.send("landlord_select_start", {});
      }
    } else if (this.state.phase === "doubling") {
      // 重播 doubling_start 让客户端重新渲染加倍 UI，不会重置已提交状态（服务端幂等）
      client.send("doubling_start", {
        timeout:           30,
        landlordSeatIndex: this.state.landlordSeat,
      });
    } else if (this.state.phase === "playing") {
      client.send("turn_change", {
        seatIndex: this.state.currentTurnSeat,
        deadline:  Date.now() + 30000,
      });
    }
  }

  // ── doubling phase ─────────────────────────────────────────────────────────

  private startDoubling(): void {
    this.gameStartTime        = Date.now();
    this.state.phase          = "doubling";
    this.state.doublingPhase  = true;
    this.doublingSubmits.clear();
    this.pendingDoubles.clear();
    this.landlordDoubleSubmitted = false;

    this.broadcast("doubling_start", {
      timeout:           30,
      landlordSeatIndex: this.state.landlordSeat,
    });

    this.doublingTimer = this.clock.setTimeout(() => {
      this.handleDoublingTimeout();
    }, 30000);

    // Auto-submit doubling=1 for AI players so the phase doesn't stall
    for (const aiSid of this.aiSessionIds) {
      const fakeClient = this.clients.find(c => c.sessionId === aiSid) as Client;
      if (fakeClient) this.handleSetDouble(fakeClient, { value: 1 });
    }
  }

  private handleSetDouble(client: Client, msg: { value: 1 | 2 }): void {
    if (this.state.phase !== "doubling") return;
    const sid   = client.sessionId;
    const value: 1 | 2 = msg.value === 2 ? 2 : 1;

    if (sid === this.landlordId) {
      if (this.landlordDoubleSubmitted) return; // first-wins on duplicates
      this.landlordDoubleSubmitted = true;
      this.doublingSubmits.set(sid, value);
      this.state.landlordDoubleValue = value;

      this.broadcast("landlord_doubled", { value });

      // Flush queued non-landlord submissions
      for (const [psid, pval] of this.pendingDoubles) {
        this.doublingSubmits.set(psid, pval);
      }
      this.pendingDoubles.clear();
      this.checkDoublingComplete();
    } else {
      // Ignore duplicates
      if (this.doublingSubmits.has(sid) || this.pendingDoubles.has(sid)) return;
      if (!this.landlordDoubleSubmitted) {
        // AC-5: queue until landlord submits
        this.pendingDoubles.set(sid, value);
      } else {
        this.doublingSubmits.set(sid, value);
        this.checkDoublingComplete();
      }
    }
  }

  private checkDoublingComplete(): void {
    // 必须等全部 5 人提交后才结算；AI 玩家在 startDoubling 里已同步提交，不会卡住
    if (this.doublingSubmits.size < 5) return;
    this.cancelDoublingTimer();
    this.finishDoubling();
  }

  private handleDoublingTimeout(): void {
    // Missing players default to di=1 (AC-3, AC-13)
    for (const sid of this.seatMap) {
      if (!this.doublingSubmits.has(sid) && !this.pendingDoubles.has(sid)) {
        this.doublingSubmits.set(sid, 1);
      }
    }
    // Flush any pending (they submitted early before landlord)
    for (const [sid, val] of this.pendingDoubles) {
      if (!this.doublingSubmits.has(sid)) this.doublingSubmits.set(sid, val);
    }
    this.pendingDoubles.clear();
    this.finishDoubling();
  }

  private cancelLandlordSelectTimer(): void {
    if (this.landlordSelectTimer) {
      this.landlordSelectTimer.clear();
      this.landlordSelectTimer = null;
    }
  }

  private cancelDoublingTimer(): void {
    if (this.doublingTimer) {
      this.doublingTimer.clear();
      this.doublingTimer = null;
    }
  }

  private finishDoubling(): void {
    // doubling_result 只含席位和是否加倍，不含角色信息——角色在 identity_reveal 时才公开
    const results = this.seatMap.map((sid, seatIndex) => ({
      seatIndex,
      doubled: this.doublingSubmits.get(sid) === 2,
    }));
    this.broadcast("doubling_result", { results });

    // doublingData 存入实例，finishGame 时传给 SettleService 计算倍率
    const landlordDouble = (this.doublingSubmits.get(this.landlordId) ?? 1) as 1 | 2;
    const partnerDoubled = this.partnerId !== null &&
      this.doublingSubmits.get(this.partnerId) === 2;

    this.doublingData = {
      landlordDouble,
      playerDoubles: new Map(this.doublingSubmits),
      partnerDoubled,
    };

    this.state.doublingPhase = false;
    this.state.phase         = "playing";
    this.state.currentTurnSeat = this.state.landlordSeat;
    this.startTurnTimer();
  }

  // ── turn machine ───────────────────────────────────────────────────────────

  private advanceTurn(): void {
    this.state.currentTurnSeat = (this.state.currentTurnSeat + 1) % 5;
  }

  private startTurnTimer(): void {
    const currentSid = this.seatMap[this.state.currentTurnSeat];
    console.log('[TURN] seat=%d sid=%s isAI=%s', this.state.currentTurnSeat, currentSid, this.aiSessionIds.has(currentSid));

    this.broadcast("turn_change", {
      seatIndex:  this.state.currentTurnSeat,
      deadline:   Date.now() + 30000,
      isNewRound: this.state.lastPlay.length === 0,
    });

    if (this.aiSessionIds.has(currentSid)) {
      const delay = Number(process.env.AI_FILL_DELAY) || 1;
      this.clock.setTimeout(() => this.executeAIAction(currentSid), delay);
      return;
    }

    this.turnTimer = this.clock.setTimeout(() => {
      this.handleTimeout(currentSid);
    }, 30000);
  }

  private cancelTurnTimer(): void {
    if (this.turnTimer) {
      this.turnTimer.clear();
      this.turnTimer = null;
    }
  }

  // ── timeout /托管 ──────────────────────────────────────────────────────────

  /**
   * 出牌超时回调。
   * 前两次超时自动 pass（给玩家找回网络的机会）；第三次起进入托管，由 executeManagedAction 代打。
   * 托管状态在本局内不解除（GAME-RULES.md 4.5）。
   */
  private handleTimeout(sessionId: string): void {
    const count = (this.timeoutCount.get(sessionId) ?? 0) + 1;
    this.timeoutCount.set(sessionId, count);
    if (count >= 3) this.managed.add(sessionId);

    if (this.managed.has(sessionId)) {
      this.executeManagedAction(sessionId);
    } else {
      // 前两次超时视为主动 pass
      this.passCount++;
      if (this.passCount >= 4) {
        this.passCount = 0;
        this.state.lastPlay.splice(0, this.state.lastPlay.length);
        this.state.lastPlayerId = "";
      }
      this.advanceTurn();
      this.startTurnTimer();
    }
  }

  /** AC-15/16:托管 AI — free round plays lowest single, follow round passes. */
  private executeManagedAction(sessionId: string): void {
    const hand = this.hands.get(sessionId)!;
    const isNewRound = this.state.lastPlay.length === 0 ||
                       this.state.lastPlayerId === sessionId;

    if (isNewRound && hand.length > 0) {
      // AC-15: play minimum-compareValue single card
      const lowestCard = hand.reduce((min, c) =>
        compareValue(c) < compareValue(min) ? c : min);
      const fakeClient = this.clients.find(c => c.sessionId === sessionId);
      if (fakeClient) this.handlePlay(fakeClient, { cards: [lowestCard] });
    } else {
      // AC-16: pass
      this.passCount++;
      if (this.passCount >= 4) {
        this.passCount = 0;
        this.state.lastPlay.splice(0, this.state.lastPlay.length);
        this.state.lastPlayerId = "";
      }
      this.advanceTurn();
      this.startTurnTimer();
    }
  }

  // ── settlement ─────────────────────────────────────────────────────────────

  /**
   * 从局内追踪数据构造 GameSummaryV2，传给 SettleService 计算积分。
   * 春天：地主方胜且平民方全程未出牌；反春：平民方胜且地主方全程未出牌（GAME-RULES.md 5.3）。
   */
  private buildGameSummary(firstOutId: string, winnerCamp: "landlord_camp" | "civilian_camp"): GameSummaryV2 {
    const landlordWins  = winnerCamp === "landlord_camp";
    const isSpring      = landlordWins && this.civilianPlayed.size === 0;
    const isAntiSpring  = !landlordWins && this.landlordCampPlayed.size === 0;
    const duration      = Math.floor((Date.now() - this.gameStartTime) / 1000);

    const playerDoubles: Record<string, 1 | 2> = {};
    for (const [psid, val] of (this.doublingData?.playerDoubles ?? new Map<string, 1|2>())) {
      playerDoubles[psid] = val;
    }

    const players = this.seatMap.map((psid, idx) => ({
      userId:    this.userIdMap.get(psid) ?? 0,
      sessionId: psid,
      rankPos:   idx,
    }));

    return {
      roomId:           (this as any).roomId ?? "unknown",
      tableType:        this.tableType,
      winnerCamp:       landlordWins ? 1 : 0,
      isLandlordAlone:  this.state.isAlone,
      landlordId:       this.landlordId,
      partnerId:        this.partnerId,
      firstOutId,
      landlordDouble:   this.doublingData?.landlordDouble ?? 1,
      playerDoubles,
      partnerDoubled:   this.doublingData?.partnerDoubled ?? false,
      bombCount:        this.bombCount,
      rocketSmallCount: this.rocketSmallCount,
      rocketBigCount:   this.rocketBigCount,
      hasEightBomb:     false,
      isSpring,
      isAntiSpring,
      duration,
      players,
    };
  }

  /**
   * 某玩家打完最后一张牌时调用。
   * calcDeltas 是纯函数（不访问 DB），结果直接附在 game_over 里广播。
   * DB 写入（settle）异步 fire-and-forget：失败只打日志，不阻塞客户端看到结算界面。
   */
  private finishGame(winnerId: string): void {
    console.log('[FINISH] winner=%s', winnerId);
    this.cancelTurnTimer();
    const winnerCamp = RuleEngine.determineWinner(winnerId, this.landlordId, this.partnerId);
    const summary    = this.buildGameSummary(winnerId, winnerCamp);

    // 同步计算积分增减，附在 game_over payload 里，客户端无需二次请求
    const deltas = SettleService.calcDeltas(summary);
    const scores: Record<string, number> = {};
    for (const [psid, d] of deltas) scores[psid] = d;

    const landlordWins = winnerCamp === "landlord_camp";
    const players = [...this.state.players.entries()]
      .map(([sid, p]) => ({
        sessionId:  sid,
        nickname:   this.nicknameMap.get(sid) ?? `玩家${p.seatIndex + 1}`,
        role:       (sid === this.landlordId ? "landlord"
                  : sid === this.partnerId  ? "partner"
                  : "civilian") as "landlord" | "partner" | "civilian",
        isWinner:   landlordWins
                    ? (sid === this.landlordId || sid === this.partnerId)
                    : (sid !== this.landlordId && sid !== this.partnerId),
        scoreDelta: deltas.get(sid) ?? 0,
        newScore:   null,
        seatIndex:  p.seatIndex,
      }))
      .sort((a, b) => a.seatIndex - b.seatIndex);

    const BASE: Record<string, number> = { starter: 1, casual: 2, expert: 5, peak: 10 };
    const breakdown = {
      baseScore:       BASE[summary.tableType] ?? 1,
      multiplier:      SettleService.calcMultiplier(summary),
      landlordDouble:  summary.landlordDouble,
      partnerDoubled:  summary.partnerDoubled,
      bombCount:       summary.bombCount,
      isSpring:        summary.isSpring,
      isAntiSpring:    summary.isAntiSpring,
      isLandlordAlone: summary.isLandlordAlone,
    };

    this.state.phase = "settlement";
    this.broadcast("game_over", { winnerCamp, scores, players, breakdown });

    // DB 写入失败不影响已广播的 game_over（fire-and-forget 契约，ISSUE-008 注释更正点）
    SettleService.settle(summary).catch(e =>
      console.error("[CardRoom] settle failed:", (e as Error).message)
    );

    this.logBattleReport(winnerId, winnerCamp, summary, scores);
    this.startRematchWindow();
  }

  /**
   * 组装并输出一局完整战报（单行 JSON）。仅在 finishGame 末尾调用一次。
   * 上线落库回放功能（P5）可直接复用此数据结构。
   */
  private logBattleReport(
    winnerId:  string,
    winnerCamp: "landlord_camp" | "civilian_camp",
    summary:   ReturnType<typeof this.buildGameSummary>,
    scores:    Record<string, number>,
  ): void {
    const partnerSeat = this.partnerId !== null
      ? (this.state.players.get(this.partnerId)?.seatIndex ?? null)
      : null;

    const landlordDouble = this.doublingData?.landlordDouble ?? 1;
    const partnerDoubled = this.doublingData?.partnerDoubled ?? false;
    const otherDoubledSeats: number[] = [];
    if (this.doublingData) {
      for (const [psid, val] of this.doublingData.playerDoubles) {
        if (val === 2 && psid !== this.landlordId && psid !== this.partnerId) {
          const p = this.state.players.get(psid);
          if (p) otherDoubledSeats.push(p.seatIndex);
        }
      }
    }

    const report: BattleReport = {
      roomId:                (this as any).roomId ?? "unknown",
      startAt:               this.battleStartAt,
      endAt:                 Date.now(),
      landlordSeat:          this.state.landlordSeat,
      partnerSeat,
      partnerRevealedAtTurn: this.partnerRevealedAtTurn,
      plays:                 this.battlePlays,
      doubling: { landlordDouble, partnerDoubled, otherDoubledSeats },
      result: {
        winnerCamp,
        isSpring:     summary.isSpring,
        isAntiSpring: summary.isAntiSpring,
        bombCount:    this.bombCount,
        scores,
      },
    };

    Logger.info("[BATTLE]", report as unknown as import("../utils/Logger").LogContext);
  }

  // ── hint ───────────────────────────────────────────────────────────────────

  /**
   * request_hint: 当前出牌玩家请求 AI 提示。返回 hint { cards }。
   * 仅在 playing 阶段且轮到该玩家时有效。
   */
  private handleRequestHint(client: Client): void {
    if (this.state.phase !== "playing") return;
    const player = this.state.players.get(client.sessionId);
    if (!player || player.seatIndex !== this.state.currentTurnSeat) return;

    const hand = this.hands.get(client.sessionId)!;
    const isNewRound = this.state.lastPlay.length === 0 ||
                       this.state.lastPlayerId === client.sessionId;
    const lastPattern = isNewRound
      ? null
      : CardPatternEngine.parse([...this.state.lastPlay] as number[]);

    const sid    = client.sessionId;
    const role   = (player.role || "civilian") as "landlord" | "partner" | "civilian";
    const ctx    = {
      role,
      allyId:          sid === this.landlordId ? this.partnerId
                     : sid === this.partnerId  ? this.landlordId : null,
      isLandlordAlone: this.state.isAlone,
      myHandCount:     hand.length,
    };

    const hint = AIPlayer.decide(hand, lastPattern, ctx);
    client.send("hint", { cards: hint });
  }

  // ── AI fill (TASK-029s / 030s) ─────────────────────────────────────────────

  /**
   * Starts the AI fill countdown for quick match rooms (aiFillEnabled=true).
   * Two timers: main fill (aiFillDelay s) + per-second ticker for waiting_update aiSeconds.
   */
  private startAiFillCountdown(): void {
    this.aiFillTimer = this.clock.setTimeout(() => {
      this.cancelAiFillTick();
      if (this.seatMap.length < 5 && this.state.phase === "waiting") {
        this.fillWithAI(5 - this.seatMap.length);
        this.startDealing();
      }
    }, this.aiFillDelay * 1000);

    this.scheduleAiFillTick();
  }

  /** 每秒递减 aiFillRemaining 并广播 waiting_update；用 setTimeout 链代替 setInterval 以兼容现有 clock mock。 */
  private scheduleAiFillTick(): void {
    this.aiFillTicker = this.clock.setTimeout(() => {
      this.aiFillRemaining = Math.max(0, this.aiFillRemaining - 1);
      if (this.state.phase === "waiting") {
        this.broadcastWaitingUpdate();
        if (this.aiFillRemaining > 0) this.scheduleAiFillTick();
      }
    }, 1000);
  }

  private cancelAiFillTimer(): void {
    if (this.aiFillTimer) { this.aiFillTimer.clear(); this.aiFillTimer = null; }
  }

  private cancelAiFillTick(): void {
    if (this.aiFillTicker) { this.aiFillTicker.clear(); this.aiFillTicker = null; }
  }

  /**
   * Injects AI players to fill remaining seats.
   * AC-4: sessionId = "ai_<8-char>", Player.isAI = true
   * AC-5: userId = 0 (no DB write for AI)
   */
  private fillWithAI(count: number): void {
    for (let i = 0; i < count; i++) {
      const sid        = `ai_${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;
      // enqueueRaw: Colyseus broadcast 内部调用，AI 客户端无真实 WebSocket，设为 no-op
      const fakeClient = { sessionId: sid, send: (_t: string, _d: unknown) => {}, enqueueRaw: (_: ArrayBuffer | Uint8Array) => {} };
      (this.clients as any[]).push(fakeClient);

      const seatIndex = this.seatMap.length;
      this.seatMap.push(sid);
      this.userIdMap.set(sid, 0);
      this.nicknameMap.set(sid, `AI${i + 1}`);
      this.aiSessionIds.add(sid);

      const player     = new Player();
      player.sessionId = sid;
      player.seatIndex = seatIndex;
      player.isAI      = true;
      this.state.players.set(sid, player);
      this.timeoutCount.set(sid, 0);
    }
  }

  /**
   * 广播快速匹配等待状态。满 5 人后不再调用（onJoin 中提前 return）。
   */
  private broadcastWaitingUpdate(): void {
    this.broadcast("waiting_update", {
      readyCount: this.realPlayerCount,
      total:      5,
      aiSeconds:  this.aiFillRemaining,
    });
  }

  /**
   * 广播好友房当前人员列表。仅包含真实玩家槽位，AI 不出现在列表中。
   * ownerSeatIndex 由客户端用于判断是否显示「开始游戏」按钮。
   */
  private broadcastRoomUpdate(): void {
    const playerSlots = [...this.seatMap]
      .filter(sid => !this.aiSessionIds.has(sid))
      .map(sid => ({
        seatIndex: this.state.players.get(sid)!.seatIndex,
        nickname:  this.nicknameMap.get(sid) ?? `玩家${this.state.players.get(sid)!.seatIndex + 1}`,
        avatarUrl: "",
        isReady:   false,
      }));

    const ownerPlayer = this.state.players.get(this.state.ownerSessionId);
    this.broadcast("room_update", {
      players:        playerSlots,
      ownerSeatIndex: ownerPlayer?.seatIndex ?? 0,
      roomCode:       this._roomCode,
    });
  }

  /**
   * Immediately executes an AI player's turn using AIPlayer V2 decide().
   * Called from startTurnTimer when the current seat belongs to an AI session.
   */
  private executeAIAction(sessionId: string): void {
    const hand       = this.hands.get(sessionId)!;
    const player     = this.state.players.get(sessionId);
    const isNewRound = this.state.lastPlay.length === 0 ||
                       this.state.lastPlayerId === sessionId;
    console.log('[AI] decide sid=%s hand=%d isNewRound=%s', sessionId, hand.length, isNewRound);
    const lastPattern = isNewRound
      ? null
      : CardPatternEngine.parse([...this.state.lastPlay] as number[]);

    const role = (player?.role ?? "civilian") as "landlord" | "partner" | "civilian";
    const ctx  = {
      role,
      allyId:          sessionId === this.landlordId ? this.partnerId
                     : sessionId === this.partnerId  ? this.landlordId : null,
      isLandlordAlone: this.state.isAlone,
      myHandCount:     hand.length,
    };

    const cards      = AIPlayer.decide(hand, lastPattern, ctx);
    const fakeClient = this.clients.find(c => c.sessionId === sessionId) as Client;
    console.log('[AI] cards=%j fakeClient=%s', cards.length, !!fakeClient);

    if (cards.length > 0 && fakeClient) {
      this.handlePlay(fakeClient, { cards });
      return;
    }

    // Defensive: AIPlayer always returns cards on a free round; fallback plays lowest
    if (isNewRound && hand.length > 0) {
      const lowest = hand.reduce((m, c) => compareValue(c) < compareValue(m) ? c : m);
      if (fakeClient) this.handlePlay(fakeClient, { cards: [lowest] });
      return;
    }

    this.passCount++;
    if (this.passCount >= 4) {
      this.passCount = 0;
      this.state.lastPlay.splice(0, this.state.lastPlay.length);
      this.state.lastPlayerId = "";
    }
    this.advanceTurn();
    this.startTurnTimer();
  }

  /**
   * 好友房房主强制开局：AI 补满剩余席位后立即发牌。
   * 非房主或非 waiting 阶段发送 → 静默忽略（GAME-RULES.md 好友房规则）。
   * @param client 发送方客户端
   */
  private handleForceStart(client: Client): void {
    if (this.state.phase !== "waiting") return;
    // 只有房主可以强制开局（spec AC-8: 非房主静默忽略）
    if (client.sessionId !== this.state.ownerSessionId) return;

    if (this.realPlayerCount < 2) {
      // spec AC-7: 独自一人无法开局，返回 error 2003
      client.send("error", { code: 2003, msg: "至少需要2名真实玩家才能开局" });
      return;
    }

    const needed = 5 - this.seatMap.length;
    if (needed > 0) this.fillWithAI(needed);
    this.startDealing();
  }

  // ── rematch (TASK-031s) ────────────────────────────────────────────────────

  /**
   * 结算后开启 30s 再来一局窗口期。窗口期内收到全员 request_rematch 则重开；
   * 否则 30s 到期触发 disconnect（spec AC-1, AC-4）。
   */
  private startRematchWindow(): void {
    this.rematchAgreed.clear();
    this.rematchWindow = this.clock.setTimeout(() => {
      this._evictAIClients();
      this.disconnect();
    }, 30000);
  }

  // AI fake clients 没有真实 socket，disconnect() 前必须先从 clients 数组移除，
  // 否则 Colyseus 内部 _forciblyCloseClient 会因 rawClient undefined 崩溃。
  private _evictAIClients(): void {
    const arr = this.clients as unknown as Array<{ sessionId: string }>;
    for (const aiSid of this.aiSessionIds) {
      const idx = arr.findIndex(c => c.sessionId === aiSid);
      if (idx !== -1) arr.splice(idx, 1);
    }
  }

  /**
   * 处理玩家「再来一局」请求。
   * - 好友房：记录同意，全员同意后重开（AC-2, AC-3）
   * - 快速匹配：直接返回 rematch_redirect，不重置房间（AC-7）
   * @param client 发送方客户端
   */
  private handleRequestRematch(client: Client): void {
    if (this.state.phase !== "settlement") return;

    if (!this.isFriendRoom) {
      // Quick match: redirect client to re-queue; no room reset
      client.send("rematch_redirect", { action: "requeue" });
      return;
    }

    if (this.rematchAgreed.has(client.sessionId)) return;
    this.rematchAgreed.add(client.sessionId);

    const total = this.realPlayerCount;
    this.broadcast("rematch_update", { agreedCount: this.rematchAgreed.size, total });

    if (this.rematchAgreed.size >= total) this.doRematch();
  }

  /**
   * 全员同意后执行再来一局：广播 rematch_start，重置状态机，重新发牌。
   * 沿用原有 seatMap 和 clients（含 AI fake clients），无需重新注入 AI。
   */
  private doRematch(): void {
    if (this.rematchWindow) { this.rematchWindow.clear(); this.rematchWindow = null; }
    this.rematchCount++;

    // spec: 最多连续 10 局，防止无限循环（GAME-RULES.md 6.3 局后流程）
    if (this.rematchCount > 10) {
      this.disconnect();
      return;
    }

    this.broadcast("rematch_start", {});
    this.resetForRematch();
    this.startDealing();
  }

  /**
   * 重置局内状态以供再来一局使用。
   * 保留 seatMap / clients / aiSessionIds / nicknameMap / realPlayerCount（ISSUE-001 修复依赖）。
   * ownerSessionId 也保留，好友房房主不变。
   */
  private resetForRematch(): void {
    this.hands.clear();
    this.timeoutCount.clear();
    this.managed.clear();
    this.landlordId              = "";
    this.partnerId               = null;
    this.codeCardPair            = [];
    this.passCount               = 0;
    this.doublingData            = null;
    this.doublingSubmits.clear();
    this.pendingDoubles.clear();
    this.landlordDoubleSubmitted = false;
    this.gameStartTime           = 0;
    this.bombCount               = 0;
    this.rocketSmallCount        = 0;
    this.rocketBigCount          = 0;
    this.civilianPlayed.clear();
    this.landlordCampPlayed.clear();
    this.rematchAgreed.clear();
    this.battlePlays             = [];
    this.battleStartAt           = 0;
    this.battleTurnCount         = 0;
    this.partnerRevealedAtTurn   = null;

    this.state.phase               = "waiting";
    this.state.currentTurnSeat     = -1;
    this.state.lastPlayerId         = "";
    this.state.lastPlay.splice(0, this.state.lastPlay.length);
    this.state.landlordSeat        = -1;
    this.state.isAlone             = false;
    this.state.doublingPhase       = false;
    this.state.landlordDoubleValue = 0;

    for (const sid of this.seatMap) {
      const player = this.state.players.get(sid);
      if (player) { player.role = ""; player.revealed = false; player.handCount = 0; }
      this.timeoutCount.set(sid, 0);
    }
  }

  // 生成 6 位大写邀请码，排除易混字符 O/0/I/1
  private static _generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }
}
