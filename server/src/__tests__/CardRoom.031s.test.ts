/**
 * @file CardRoom.031s.test.ts
 * @description TASK-031s: 再来一局服务端 — 单元测试 AC-1–8
 * @module server
 */

jest.mock("@colyseus/core", () => ({
  Room: class {
    state: any = null;
    clients: any[] = [];
    _handlers: Map<string, (c: any, d?: any) => void> = new Map();
    clock = { setTimeout: (_fn: Function, _ms: number): any => ({ clear() {} }) };
    setState(s: any)                { this.state = s; }
    onMessage(t: string, fn: any)   { this._handlers.set(t, fn); }
    broadcast(_t: string, _d: any)  {}
    disconnect()                    {}
    allowReconnection(_c: any, _s: number) { return Promise.resolve(); }
  },
}));

jest.mock("../logic/Deck", () => ({
  Deck: {
    shuffle:          jest.fn(() => Array.from({ length: 108 }, (_, i) => i)),
    deal:             jest.fn(() => ({
      hands:      [0, 1, 2, 3, 4].map(s => Array.from({ length: 21 }, (_, i) => s * 21 + i)),
      bottom:     [105, 106, 107],
      faceUpCard: 0,
    })),
    findLandlordSeat: jest.fn(() => 0),
  },
}));

jest.mock("../services/SettleService", () => ({
  SettleService: {
    calcDeltas: jest.fn(() => new Map<string, number>()),
    settle:     jest.fn().mockResolvedValue(undefined),
  },
}));

import { CardRoom } from "../rooms/CardRoom";

type MockClient = { sessionId: string; send: jest.Mock };

function mkClient(id: string): MockClient {
  return { sessionId: id, send: jest.fn() };
}

function buildRoom(options: Record<string, unknown> = {}) {
  const room = new CardRoom() as any;
  const broadcasts: Array<{ type: string; data: unknown }> = [];
  const timerFns: Function[] = [];
  const timers:   Array<{ clear: jest.Mock }> = [];

  room.broadcast = jest.fn((type: string, data: unknown) => {
    broadcasts.push({ type, data });
  });
  room.disconnect       = jest.fn();
  room.allowReconnection = jest.fn().mockResolvedValue(undefined);
  room.clock            = {
    setTimeout: jest.fn((fn: Function) => {
      timerFns.push(fn);
      const t = { clear: jest.fn() };
      timers.push(t);
      return t;
    }),
  };

  room.onCreate(options);
  return { room: room as CardRoom, broadcasts, timerFns, timers };
}

function msg(room: CardRoom, type: string, client: MockClient, data?: unknown) {
  const fn = (room as any)._handlers.get(type);
  if (!fn) throw new Error(`No handler for "${type}"`);
  fn(client, data);
}

/**
 * Sets up a room in settlement phase.
 * All 5 clients are real, landlord = p0 (seat 0), partner = p2 (card 54 in hand).
 * Timer layout after setup:
 *   timerFns[0] = doubling timer (30s)
 *   timerFns[1] = turn timer for p0 (30s)   ← cleared when p0 plays
 *   timerFns[2] = rematch window (30s)
 */
function setupSettlement(opts: Record<string, unknown> = {}) {
  const { room, broadcasts, timerFns, timers } = buildRoom({ isFriendRoom: true, ...opts });

  const clients: MockClient[] = [];
  for (let i = 0; i < 5; i++) {
    const c = mkClient(`p${i}`);
    (room as any).clients.push(c);
    room.onJoin(c as any, {});
    clients.push(c);
  }

  // Landlord (p0) selects code card → startDoubling → timerFns[0]
  msg(room, "select_code_card", clients[0], { suit: 0, value: 0 });

  // Complete doubling → finishDoubling → startTurnTimer → timerFns[1]
  msg(room, "set_double", clients[0], { value: 1 });
  for (let i = 1; i < 5; i++) msg(room, "set_double", clients[i], { value: 1 });

  // Drain p0's hand to 1 card, play it → finishGame → startRematchWindow → timerFns[2]
  const hand     = (room as any).hands.get("p0") as number[];
  const lastCard = hand[0];
  hand.splice(1);
  room.state.players.get("p0")!.handCount = 1;
  msg(room, "play_cards", clients[0], { cards: [lastCard] });

  return { room, clients, broadcasts, timerFns, timers };
}

// ── AC-1–8 ────────────────────────────────────────────────────────────────────

describe("TASK-031s — rematch (AC-1–8)", () => {
  it("AC-1: disconnect is NOT called immediately after game_over (30s window starts)", () => {
    const { room } = setupSettlement();
    expect(room.state.phase).toBe("settlement");
    expect((room as any).disconnect).not.toHaveBeenCalled();
  });

  it("AC-2: request_rematch in settlement phase records the player's consent", () => {
    const { room, clients } = setupSettlement();
    msg(room, "request_rematch", clients[0]);
    expect((room as any).rematchAgreed.has("p0")).toBe(true);
  });

  it("AC-3: friend room — all agree → rematch_start broadcast + room no longer in settlement", () => {
    const { room, clients, broadcasts } = setupSettlement();
    for (const c of clients) msg(room, "request_rematch", c);

    expect(broadcasts.some(b => b.type === "rematch_start")).toBe(true);
    expect(room.state.phase).not.toBe("settlement");
  });

  it("AC-4: window expires (timer fires) → disconnect is called", () => {
    const { room, timerFns } = setupSettlement();
    // timerFns[2] = rematch window
    timerFns[timerFns.length - 1]();
    expect((room as any).disconnect).toHaveBeenCalled();
  });

  it("AC-5: rematch_update broadcast after each agreement, with agreedCount and total", () => {
    const { room, clients, broadcasts } = setupSettlement();
    msg(room, "request_rematch", clients[0]);

    const update = broadcasts.find(b => b.type === "rematch_update");
    expect(update).toBeDefined();
    expect((update!.data as any).agreedCount).toBe(1);
    expect((update!.data as any).total).toBe(5);
  });

  it("AC-6: full agreement → rematch_start + state reset + re-deal (new hands dealt)", () => {
    const { room, clients } = setupSettlement();
    for (const c of clients) msg(room, "request_rematch", c);

    // Room should have re-dealt — p0 should have a fresh hand
    const newHand = (room as any).hands.get("p0") as number[];
    expect(newHand).toBeDefined();
    expect(newHand.length).toBeGreaterThan(1); // more than 1 card (fresh deal)
    expect(room.state.phase).not.toBe("settlement");
  });

  it("AC-7: quick match — request_rematch sends rematch_redirect { action: 'requeue' }", () => {
    // Setup: quick match room (no isFriendRoom)
    const { room: qRoom, broadcasts: qBroadcasts, timerFns: qTimers } = buildRoom({});
    const clients: MockClient[] = [];
    for (let i = 0; i < 5; i++) {
      const c = mkClient(`q${i}`);
      (qRoom as any).clients.push(c);
      qRoom.onJoin(c as any, {});
      clients.push(c);
    }
    msg(qRoom, "select_code_card", clients[0], { suit: 0, value: 0 });
    msg(qRoom, "set_double", clients[0], { value: 1 });
    for (let i = 1; i < 5; i++) msg(qRoom, "set_double", clients[i], { value: 1 });

    const hand     = (qRoom as any).hands.get("q0") as number[];
    const lastCard = hand[0];
    hand.splice(1);
    qRoom.state.players.get("q0")!.handCount = 1;
    msg(qRoom, "play_cards", clients[0], { cards: [lastCard] });

    // Now in settlement; send rematch request
    msg(qRoom, "request_rematch", clients[0]);

    expect(clients[0].send).toHaveBeenCalledWith("rematch_redirect", { action: "requeue" });
  });

  it("AC-8: quick match rematch_redirect does not reset the room", () => {
    const { room: qRoom } = buildRoom({});
    const clients: MockClient[] = [];
    for (let i = 0; i < 5; i++) {
      const c = mkClient(`q${i}`);
      (qRoom as any).clients.push(c);
      qRoom.onJoin(c as any, {});
      clients.push(c);
    }
    msg(qRoom, "select_code_card", clients[0], { suit: 0, value: 0 });
    msg(qRoom, "set_double", clients[0], { value: 1 });
    for (let i = 1; i < 5; i++) msg(qRoom, "set_double", clients[i], { value: 1 });

    const hand     = (qRoom as any).hands.get("q0") as number[];
    const lastCard = hand[0];
    hand.splice(1);
    qRoom.state.players.get("q0")!.handCount = 1;
    msg(qRoom, "play_cards", clients[0], { cards: [lastCard] });

    msg(qRoom, "request_rematch", clients[0]);

    // Room stays in settlement (not reset to waiting/dealing)
    expect(qRoom.state.phase).toBe("settlement");
  });
});
