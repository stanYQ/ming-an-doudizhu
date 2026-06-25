/**
 * @file CardRoom.038.test.ts
 * @description TASK-038: BattleReport 战报日志 AC-1~AC-8
 * @module CardRoom
 */

// ── mocks (must precede imports) ──────────────────────────────────────────────

jest.mock("@colyseus/core", () => ({
  Room: class {
    state: any = null;
    clients: any[] = [];
    _handlers: Map<string, (c: any, d?: any) => void> = new Map();
    clock = { setTimeout: (_fn: Function, _ms: number): any => ({ clear() {} }) };
    setState(s: any)               { this.state = s; }
    onMessage(t: string, fn: any)  { this._handlers.set(t, fn); }
    broadcast(_t: string, _d: any) {}
    disconnect()                   {}
    allowReconnection(_c: any, _s: number) { return Promise.resolve(); }
  },
}));

// Deterministic deck (same as CardRoom.test.ts):
//   seat 0 (landlord): 0-20  + bottom 105-107
//   seat 1: 21-41 | seat 2 (partner): 42-62 | seat 3: 63-83 | seat 4: 84-104
//   code card pair: [encode(0,0,0)=0, encode(1,0,0)=54] — card 54 is in seat-2 hand
jest.mock("../logic/Deck", () => ({
  Deck: {
    shuffle:          jest.fn(() => Array.from({ length: 108 }, (_, i) => i)),
    deal:             jest.fn(() => ({
      hands: [0, 1, 2, 3, 4].map(s => Array.from({ length: 21 }, (_, i) => s * 21 + i)),
      bottom:      [105, 106, 107],
      faceUpCard:  0,
    })),
    findLandlordSeat: jest.fn(() => 0),
  },
}));

jest.mock("../services/SettleService", () => ({
  SettleService: {
    calcDeltas: jest.fn(() => new Map([["p0", 10], ["p1", -5], ["p2", -5]])),
    settle:     jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../utils/Logger", () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { CardRoom } from "../rooms/CardRoom";
import { Logger }   from "../utils/Logger";

// ── helpers ───────────────────────────────────────────────────────────────────

type MockClient = { sessionId: string; send: jest.Mock };
function mkClient(id: string): MockClient { return { sessionId: id, send: jest.fn() }; }

function buildRoom() {
  const room = new CardRoom() as any;
  room.broadcast         = jest.fn();
  room.disconnect        = jest.fn();
  room.allowReconnection = jest.fn().mockResolvedValue(undefined);
  room.clock             = { setTimeout: jest.fn((_fn: Function) => ({ clear: jest.fn() })) };
  room.onCreate({});
  return room as CardRoom;
}

function addClients(room: CardRoom, n: number, prefix = "p"): MockClient[] {
  const out: MockClient[] = [];
  for (let i = 0; i < n; i++) {
    const c = mkClient(`${prefix}${i}`);
    (room as any).clients.push(c);
    room.onJoin(c as any, {});
    out.push(c);
  }
  return out;
}

function send(room: CardRoom, type: string, client: MockClient, data?: unknown) {
  const fn = (room as any)._handlers.get(type);
  if (!fn) throw new Error(`No handler: "${type}"`);
  fn(client, data);
}

function setupPlaying() {
  const room    = buildRoom();
  const clients = addClients(room, 5);
  send(room, "select_code_card", clients[0], { suit: 0, value: 0 });
  // landlord first, then others
  send(room, "set_double", clients[0], { value: 1 });
  for (let i = 1; i < 5; i++) send(room, "set_double", clients[i], { value: 1 });
  return { room, clients };
}

// ── AC-1: battlePlays 追加 ─────────────────────────────────────────────────

describe("TASK-038 AC-1: battlePlays accumulates per play/pass", () => {
  it("starts empty after setup", () => {
    const { room } = setupPlaying();
    expect((room as any).battlePlays).toEqual([]);
  });

  it("appends one entry per play_cards", () => {
    const { room, clients } = setupPlaying();
    send(room, "play_cards", clients[0], { cards: [0] });
    expect((room as any).battlePlays).toHaveLength(1);
    send(room, "play_cards", clients[1], { cards: [21] });
    expect((room as any).battlePlays).toHaveLength(2);
  });

  it("appends one entry per pass", () => {
    const { room, clients } = setupPlaying();
    // first play to enable pass (need lastPlay set)
    send(room, "play_cards", clients[0], { cards: [0] });
    send(room, "pass", clients[1]);
    expect((room as any).battlePlays).toHaveLength(2);
  });
});

// ── AC-2: BattlePlay 结构 ─────────────────────────────────────────────────

describe("TASK-038 AC-2: BattlePlay structure", () => {
  it("play entry has correct fields", () => {
    const { room, clients } = setupPlaying();
    send(room, "play_cards", clients[0], { cards: [0] });
    const entry = (room as any).battlePlays[0];
    expect(entry.turn).toBe(1);
    expect(entry.seatIndex).toBe(0);
    expect(entry.sessionId).toBe("p0");
    expect(entry.cards).toEqual([0]);
    expect(entry.isPass).toBe(false);
    expect(typeof entry.patternType).toBe("string");
  });

  it("pass entry: cards=[], isPass=true, patternType=null", () => {
    const { room, clients } = setupPlaying();
    send(room, "play_cards", clients[0], { cards: [0] });
    send(room, "pass", clients[1]);
    const passEntry = (room as any).battlePlays[1];
    expect(passEntry.cards).toEqual([]);
    expect(passEntry.isPass).toBe(true);
    expect(passEntry.patternType).toBeNull();
    expect(passEntry.sessionId).toBe("p1");
  });

  it("turn counter increments monotonically", () => {
    const { room, clients } = setupPlaying();
    send(room, "play_cards", clients[0], { cards: [0] });
    send(room, "pass", clients[1]);
    send(room, "play_cards", clients[2], { cards: [42] });
    const turns = (room as any).battlePlays.map((p: any) => p.turn);
    expect(turns).toEqual([1, 2, 3]);
  });
});

// ── AC-3: partnerRevealedAtTurn ────────────────────────────────────────────

describe("TASK-038 AC-3: partnerRevealedAtTurn", () => {
  it("is null before any code card play", () => {
    const { room } = setupPlaying();
    expect((room as any).partnerRevealedAtTurn).toBeNull();
  });

  it("records turn number when partner plays code card", () => {
    const { room, clients } = setupPlaying();
    // Manually give p2 a free turn (set currentTurnSeat=2, clear lastPlay)
    (room as any).state.currentTurnSeat = 2;
    (room as any).state.lastPlay.splice(0);
    (room as any).state.lastPlayerId = "";
    // p2 (partner) plays code card 54 in free round — turn 1
    send(room, "play_cards", clients[2], { cards: [54] });
    expect((room as any).partnerRevealedAtTurn).toBe(1);
  });

  it("stays null when partner never plays code card", () => {
    const { room, clients } = setupPlaying();
    // card 1 is NOT in code card pair [0, 54] — no reveal
    send(room, "play_cards", clients[0], { cards: [1] });
    send(room, "pass", clients[1]);
    expect((room as any).partnerRevealedAtTurn).toBeNull();
  });
});

// ── AC-4: Logger.info('[BATTLE]', ...) at finishGame ─────────────────────

describe("TASK-038 AC-4: logBattleReport called at finishGame", () => {
  beforeEach(() => {
    (Logger.info as jest.Mock).mockClear();
  });

  it("calls Logger.info with '[BATTLE]' message", () => {
    const { room } = setupPlaying();
    (room as any).finishGame("p0");
    const calls = (Logger.info as jest.Mock).mock.calls;
    const battleCall = calls.find((c: any[]) => c[0] === "[BATTLE]");
    expect(battleCall).toBeDefined();
  });

  it("second argument contains report object", () => {
    const { room } = setupPlaying();
    (room as any).finishGame("p0");
    const calls = (Logger.info as jest.Mock).mock.calls;
    const battleCall = calls.find((c: any[]) => c[0] === "[BATTLE]");
    const report = battleCall![1];
    expect(report).toBeDefined();
    expect(typeof report).toBe("object");
    expect(report.plays).toBeDefined();
  });
});

// ── AC-5: doubling 字段 ────────────────────────────────────────────────────

describe("TASK-038 AC-5: doubling fields in BattleReport", () => {
  beforeEach(() => { (Logger.info as jest.Mock).mockClear(); });

  it("landlordDouble=2 when landlord doubled", () => {
    const room    = buildRoom();
    const clients = addClients(room, 5);
    send(room, "select_code_card", clients[0], { suit: 0, value: 0 });
    send(room, "set_double", clients[0], { value: 2 }); // landlord doubles
    for (let i = 1; i < 5; i++) send(room, "set_double", clients[i], { value: 1 });

    (room as any).finishGame("p0");
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(report.doubling.landlordDouble).toBe(2);
  });

  it("otherDoubledSeats empty when no civilians doubled", () => {
    const { room } = setupPlaying();
    (room as any).finishGame("p0");
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(report.doubling.otherDoubledSeats).toEqual([]);
  });

  it("otherDoubledSeats contains seat indices of civilians who doubled", () => {
    const room    = buildRoom();
    const clients = addClients(room, 5);
    send(room, "select_code_card", clients[0], { suit: 0, value: 0 });
    send(room, "set_double", clients[0], { value: 1 });
    send(room, "set_double", clients[1], { value: 2 }); // seat 1 doubles
    for (let i = 2; i < 5; i++) send(room, "set_double", clients[i], { value: 1 });

    (room as any).finishGame("p0");
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(report.doubling.otherDoubledSeats).toContain(1);
  });
});

// ── AC-6: result 字段 ─────────────────────────────────────────────────────

describe("TASK-038 AC-6: result fields in BattleReport", () => {
  beforeEach(() => { (Logger.info as jest.Mock).mockClear(); });

  it("winnerCamp reflects actual winner", () => {
    const { room } = setupPlaying();
    (room as any).finishGame("p0"); // landlord wins
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(report.result.winnerCamp).toBe("landlord_camp");
  });

  it("isSpring=true when civilian never played", () => {
    const { room, clients } = setupPlaying();
    // Only landlord camp plays → spring
    send(room, "play_cards", clients[0], { cards: [0] });
    // skip others, manually trigger finish
    (room as any).finishGame("p0");
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(report.result.isSpring).toBe(true);
  });

  it("isSpring=false when civilians played", () => {
    const { room, clients } = setupPlaying();
    send(room, "play_cards", clients[0], { cards: [0] });
    send(room, "play_cards", clients[1], { cards: [21] }); // civilian played
    (room as any).finishGame("p0");
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(report.result.isSpring).toBe(false);
  });

  it("bombCount tracked correctly", () => {
    const { room } = setupPlaying();
    (room as any).bombCount = 3;
    (room as any).finishGame("p0");
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(report.result.bombCount).toBe(3);
  });

  it("scores present in result", () => {
    const { room } = setupPlaying();
    (room as any).finishGame("p0");
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(typeof report.result.scores).toBe("object");
  });
});

// ── AC-7: JSON 可解析 ─────────────────────────────────────────────────────

describe("TASK-038 AC-7: BattleReport is JSON-parseable", () => {
  beforeEach(() => { (Logger.info as jest.Mock).mockClear(); });

  it("JSON.stringify(report) is parseable without error", () => {
    const { room, clients } = setupPlaying();
    send(room, "play_cards", clients[0], { cards: [0] });
    send(room, "pass", clients[1]);
    (room as any).finishGame("p0");
    const report = (Logger.info as jest.Mock).mock.calls.find((c: any[]) => c[0] === "[BATTLE]")![1];
    expect(() => JSON.parse(JSON.stringify(report))).not.toThrow();
  });
});

// ── resetForRematch clears battle state ──────────────────────────────────

describe("TASK-038: resetForRematch clears battle fields", () => {
  it("clears battlePlays, startAt, turnCount, partnerRevealedAtTurn", () => {
    const { room, clients } = setupPlaying();
    send(room, "play_cards", clients[0], { cards: [0] });
    (room as any).partnerRevealedAtTurn = 1;
    (room as any).battleStartAt         = 12345;
    (room as any).battleTurnCount       = 1;

    (room as any).resetForRematch();

    expect((room as any).battlePlays).toEqual([]);
    expect((room as any).battleStartAt).toBe(0);
    expect((room as any).battleTurnCount).toBe(0);
    expect((room as any).partnerRevealedAtTurn).toBeNull();
  });
});
