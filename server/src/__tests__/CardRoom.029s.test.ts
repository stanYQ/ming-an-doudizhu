/**
 * @file CardRoom.029s.test.ts
 * @description TASK-029s: 快速匹配 AI 补位 — 单元测试 AC-1–7
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

// ── AC-1–7 ────────────────────────────────────────────────────────────────────

describe("TASK-029s — quick match AI fill (AC-1–7)", () => {
  it("AC-1: aiFillDelay option is stored; default is 30", () => {
    const { room: r1 } = buildRoom({ aiFillEnabled: true, aiFillDelay: 10 });
    expect((r1 as any).aiFillDelay).toBe(10);

    const { room: r2 } = buildRoom({ aiFillEnabled: true });
    expect((r2 as any).aiFillDelay).toBe(30);
  });

  it("AC-2: countdown timer starts on first real player join; cancelled when 5 join", () => {
    const { room, timerFns, timers } = buildRoom({ aiFillEnabled: true, aiFillDelay: 10 });
    expect(timerFns.length).toBe(0);

    // First player → fill timer (0) + tick timer (1)
    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});
    expect(timerFns.length).toBe(2);

    // 4 more real players → 5th triggers cancel of fill timer
    for (let i = 1; i < 5; i++) {
      const c = mkClient(`p${i}`);
      (room as any).clients.push(c);
      room.onJoin(c as any, {});
    }
    expect(timers[0].clear).toHaveBeenCalled(); // fill timer cleared
    expect(timers[1].clear).toHaveBeenCalled(); // tick timer cleared
  });

  it("AC-3: fill timer fires with <5 real players → AI injected, dealing starts", () => {
    const { room, timerFns } = buildRoom({ aiFillEnabled: true, aiFillDelay: 10 });

    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});

    // timerFns[0] = main fill timer; fire it
    timerFns[0]();

    expect((room as any).seatMap.length).toBe(5);
    // Landlord is p0 (real) per mock; phase reaches landlord_select
    expect(room.state.phase).toBe("landlord_select");
  });

  it("AC-4: AI sessionIds match 'ai_...' pattern and Player.isAI = true", () => {
    const { room, timerFns } = buildRoom({ aiFillEnabled: true, aiFillDelay: 10 });

    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});
    timerFns[0]();

    const aiSids = [...(room as any).aiSessionIds] as string[];
    expect(aiSids.length).toBe(4);
    for (const sid of aiSids) {
      expect(sid).toMatch(/^ai_/);
      expect(room.state.players.get(sid)?.isAI).toBe(true);
    }
  });

  it("AC-5: AI players have userId = 0 in userIdMap", () => {
    const { room, timerFns } = buildRoom({ aiFillEnabled: true, aiFillDelay: 10 });

    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});
    timerFns[0]();

    const aiSids = [...(room as any).aiSessionIds] as string[];
    for (const sid of aiSids) {
      expect((room as any).userIdMap.get(sid)).toBe(0);
    }
  });

  it("AC-6: waiting_update broadcast includes readyCount, total=5, aiSeconds", () => {
    const { room, broadcasts } = buildRoom({ aiFillEnabled: true, aiFillDelay: 10 });

    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});

    const update = broadcasts.find(b => b.type === "waiting_update");
    expect(update).toBeDefined();
    expect((update!.data as any).readyCount).toBe(1);
    expect((update!.data as any).total).toBe(5);
    expect((update!.data as any).aiSeconds).toBe(10);
  });

  it("AC-7: no waiting_update broadcast when 5th real player joins (dealing starts)", () => {
    const { room, broadcasts } = buildRoom({ aiFillEnabled: true, aiFillDelay: 10 });

    for (let i = 0; i < 5; i++) {
      const c = mkClient(`p${i}`);
      (room as any).clients.push(c);
      room.onJoin(c as any, {});
    }

    // Only 4 waiting_updates (from joins 1–4), not 5
    const waitingUpdates = broadcasts.filter(b => b.type === "waiting_update");
    expect(waitingUpdates.length).toBe(4);
  });
});
