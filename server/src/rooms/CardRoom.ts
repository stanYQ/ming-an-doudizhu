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

export class CardRoom extends Room<GameState> {
  maxClients = 5;

  /** AC-7: Colyseus calls this before onJoin. Invalid token → reject with code 3001. */
  static async onAuth(token: string, _req: IncomingMessage): Promise<unknown> {
    const payload = AuthService.verifyToken(token);
    if (!payload) throw new Error(JSON.stringify({ code: 3001 }));
    return payload;
  }

  // Private game state — never enters Schema
  private hands        = new Map<string, number[]>();
  private timeoutCount = new Map<string, number>();
  private managed      = new Set<string>();
  private landlordId   = "";
  private partnerId: string | null = null;
  private codeCardPair: number[]   = [];
  private passCount    = 0;
  private seatMap: string[] = []; // seatIndex → sessionId
  private turnTimer: { clear(): void } | null = null;

  // ── lifecycle ──────────────────────────────────────────────────────────────

  onCreate(_options: unknown): void {
    this.setState(new GameState());

    this.onMessage("ready",            (c: Client)                             => this.handleReady(c));
    this.onMessage("select_code_card", (c: Client, m: {suit:number;value:number}) => this.handleSelectCode(c, m));
    this.onMessage("play_cards",       (c: Client, m: {cards:number[]})        => this.handlePlay(c, m));
    this.onMessage("pass",             (c: Client)                             => this.handlePass(c));
    this.onMessage("reconnect_sync",   (c: Client)                             => this.handleReconnectSync(c));
  }

  onJoin(client: Client, _options: unknown): void {
    const seatIndex = this.seatMap.length;
    this.seatMap.push(client.sessionId);

    const player = new Player();
    player.sessionId = client.sessionId;
    player.seatIndex = seatIndex;
    this.state.players.set(client.sessionId, player);
    this.timeoutCount.set(client.sessionId, 0);

    if (this.clients.length === 5) this.startDealing();
  }

  async onLeave(client: Client, _consented: boolean): Promise<void> {
    try {
      // Hold the seat for 60 s; resolve = reconnected, reject = timed out
      await this.allowReconnection(client, 60);
      this.handleReconnectSync(client);
    } catch {
      this.managed.add(client.sessionId);
    }
  }

  // ── dealing ────────────────────────────────────────────────────────────────

  private startDealing(): void {
    this.state.phase = "dealing";

    const deck       = Deck.shuffle();
    const { hands, bottom, faceUpCard } = Deck.deal(deck);
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
  }

  // ── message handlers ───────────────────────────────────────────────────────

  private handleReady(_client: Client): void {
    // reserved for lobby flow
  }

  private handleSelectCode(client: Client, msg: { suit: number; value: number }): void {
    // AC-4: only landlord can pick code card; silently ignore others
    if (client.sessionId !== this.landlordId) return;
    if (this.state.phase !== "landlord_select") return;

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

    this.state.phase           = "playing";
    this.state.currentTurnSeat = this.state.landlordSeat;
    this.startTurnTimer();
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

    this.cancelTurnTimer();
    this.timeoutCount.set(client.sessionId, 0);

    // Reveal partner if code card is played
    if (this.partnerId !== null) {
      const partnerPlayer = this.state.players.get(this.partnerId);
      if (partnerPlayer && !partnerPlayer.revealed &&
          CodeCard.containsCodeCard(msg.cards, this.codeCardPair)) {
        partnerPlayer.revealed = true;
        this.broadcast("identity_reveal", { playerId: this.partnerId, role: "partner" });
      }
    }

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

    this.cancelTurnTimer();
    this.passCount++;

    // 4 consecutive passes → round is over, next player gets free play
    if (this.passCount >= 4) {
      this.passCount = 0;
      this.state.lastPlay.splice(0, this.state.lastPlay.length);
      this.state.lastPlayerId = "";
    }

    this.advanceTurn();
    this.startTurnTimer();
  }

  private handleReconnectSync(client: Client): void {
    const hand = this.hands.get(client.sessionId) ?? [];
    client.send("your_hand", { cards: hand });
    if (this.state.phase === "playing") {
      client.send("turn_change", {
        seatIndex: this.state.currentTurnSeat,
        deadline:  Date.now() + 30000,
      });
    }
  }

  // ── turn machine ───────────────────────────────────────────────────────────

  private advanceTurn(): void {
    this.state.currentTurnSeat = (this.state.currentTurnSeat + 1) % 5;
  }

  private startTurnTimer(): void {
    this.broadcast("turn_change", {
      seatIndex: this.state.currentTurnSeat,
      deadline:  Date.now() + 30000,
    });

    const currentSid = this.seatMap[this.state.currentTurnSeat];
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

  private handleTimeout(sessionId: string): void {
    const count = (this.timeoutCount.get(sessionId) ?? 0) + 1;
    this.timeoutCount.set(sessionId, count);
    if (count >= 3) this.managed.add(sessionId);

    if (this.managed.has(sessionId)) {
      this.executeManagedAction(sessionId);
    } else {
      // Auto-pass for first two timeouts
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

  private finishGame(winnerId: string): void {
    const winnerCamp = RuleEngine.determineWinner(
      winnerId, this.landlordId, this.partnerId);

    this.state.phase = "settlement";
    this.broadcast("game_over", { winnerCamp, scores: {} });

    // P3: persist to DB before disconnect
    this.disconnect();
  }
}
