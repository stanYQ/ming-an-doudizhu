/**
 * @file CardRoom.030s.test.ts
 * @description TASK-030s: 好友房服务端 — 单元测试 AC-1–8
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

function buildFriendRoom() {
  return buildRoom({ isFriendRoom: true });
}

// ── AC-1–8 ────────────────────────────────────────────────────────────────────

describe("TASK-030s — friend room (AC-1–8)", () => {
  it("AC-1: room_update is broadcast when a player joins", () => {
    const { room, broadcasts } = buildFriendRoom();
    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, { nickname: "Alice" });

    expect(broadcasts.some(b => b.type === "room_update")).toBe(true);
  });

  it("AC-2: PlayerSlot has correct shape — seatIndex, nickname, avatarUrl='', isReady=false", () => {
    const { room, broadcasts } = buildFriendRoom();
    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, { nickname: "Alice" });

    const update = broadcasts.find(b => b.type === "room_update")!;
    const slots  = (update.data as any).players as any[];
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      seatIndex: 0,
      nickname:  "Alice",
      avatarUrl: "",
      isReady:   false,
    });
  });

  it("AC-3: room_update uses broadcast (all clients receive it, not a private send)", () => {
    const { room } = buildFriendRoom();
    const broadcastFn = (room as any).broadcast as jest.Mock;
    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});

    expect(broadcastFn).toHaveBeenCalledWith("room_update", expect.any(Object));
  });

  it("AC-4: first joiner becomes ownerSessionId; subsequent joins do not change it", () => {
    const { room } = buildFriendRoom();
    const c0 = mkClient("p0");
    const c1 = mkClient("p1");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});
    (room as any).clients.push(c1);
    room.onJoin(c1 as any, {});

    expect(room.state.ownerSessionId).toBe("p0");
  });

  it("AC-5: force_start by owner in waiting phase triggers dealing", () => {
    const { room } = buildFriendRoom();
    for (let i = 0; i < 2; i++) {
      const c = mkClient(`p${i}`);
      (room as any).clients.push(c);
      room.onJoin(c as any, {});
    }
    msg(room, "force_start", (room as any).clients[0]);
    // Landlord = p0 (real), so phase = landlord_select
    expect(room.state.phase).toBe("landlord_select");
  });

  it("AC-6: force_start with ≥2 real players → AI fills remaining 3 seats", () => {
    const { room } = buildFriendRoom();
    for (let i = 0; i < 2; i++) {
      const c = mkClient(`p${i}`);
      (room as any).clients.push(c);
      room.onJoin(c as any, {});
    }
    msg(room, "force_start", (room as any).clients[0]);

    expect((room as any).seatMap.length).toBe(5);
    expect((room as any).aiSessionIds.size).toBe(3);
  });

  it("AC-7: force_start with <2 real players → error { code: 2003 }", () => {
    const { room } = buildFriendRoom();
    const c0 = mkClient("p0");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});

    msg(room, "force_start", c0);

    expect(c0.send).toHaveBeenCalledWith("error", expect.objectContaining({ code: 2003 }));
    expect(room.state.phase).toBe("waiting");
  });

  it("AC-8: non-owner force_start is silently ignored — phase stays waiting", () => {
    const { room } = buildFriendRoom();
    const c0 = mkClient("p0");
    const c1 = mkClient("p1");
    (room as any).clients.push(c0);
    room.onJoin(c0 as any, {});
    (room as any).clients.push(c1);
    room.onJoin(c1 as any, {});

    msg(room, "force_start", c1); // c1 is NOT owner

    expect(room.state.phase).toBe("waiting");
    expect(c1.send).not.toHaveBeenCalledWith("error", expect.anything());
  });
});
