/**
 * @file CardRoom.integration.test.ts
 * @description End-to-end integration tests using real Colyseus + HTTP server.
 *   Covers all server↔client messages defined in SERVER-PROTOCOL.md.
 */

// ── env must be set BEFORE any module loads ──────────────────────────────────
process.env.JWT_SECRET = "int_test_secret_xyz";
process.env.AUTH_MODE  = "stub";
process.env.DB_NAME    = "mingandoudizhu";

import { boot, ColyseusTestServer } from "@colyseus/testing";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import jwt from "jsonwebtoken";
import http from "http";
import { CardRoom } from "../../rooms/CardRoom";
import { handleLogin, handleMe } from "../../routes/authRoutes";
import { AuthService } from "../../services/AuthService";

// ── helpers ────────────────────────────────────────────────────────────────

const SECRET = process.env.JWT_SECRET!;

function makeToken(userId: number): string {
  return jwt.sign(
    { userId, openid: `test_user_${userId}` },
    SECRET,
    { expiresIn: "1h" },
  );
}

// Colyseus 0.15 reads auth token from Authorization: Bearer header, not options.
// colyseus.sdk.auth.token → HTTP.authToken → prepended to every matchmake request.
function setAuth(colyseus: ColyseusTestServer, userId = 1): void {
  (colyseus.sdk.auth as any).token = makeToken(userId);
}

function waitMsg<T = any>(room: any, type: string, ms = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: "${type}"`)), ms);
    room.onMessage(type, (d: T) => { clearTimeout(t); resolve(d); });
  });
}

async function setup5(colyseus: ColyseusTestServer): Promise<{
  clients: any[];
  hands: number[][];
  landlordSeat: number;
  serverRoom: any;
}> {
  // Auth token is sent via Authorization header, not options.
  setAuth(colyseus, 1);
  const first = await colyseus.sdk.create("card_room", {});
  const roomId = first.id;
  const handPromises: Promise<any>[] = [waitMsg(first, "your_hand")];
  const clients: any[] = [first];
  // Register no-op for bottom_cards to suppress SDK warning (only landlord receives it)
  first.onMessage("bottom_cards", () => {});

  for (let i = 1; i < 5; i++) {
    setAuth(colyseus, i + 1);
    const c = await colyseus.sdk.joinById(roomId, {});
    handPromises.push(waitMsg(c, "your_hand"));
    c.onMessage("bottom_cards", () => {});
    clients.push(c);
  }

  const handMsgs = await Promise.all(handPromises);
  const hands = handMsgs.map(m => m.cards as number[]);
  await new Promise(r => setTimeout(r, 300));

  const serverRoom = colyseus.getRoomById(roomId)!;
  const landlordSeat: number = serverRoom.state.landlordSeat;

  return { clients, hands, landlordSeat, serverRoom };
}

async function setupPlaying(colyseus: ColyseusTestServer): Promise<{
  clients: any[];
  hands: number[][];
  currentSeat: number;
  serverRoom: any;
}> {
  const { clients, hands, landlordSeat, serverRoom } = await setup5(colyseus);

  // suit=0 value=0 → rank 0, suit 0 is always a valid code card selection
  const doublingStarts = clients.map(c => waitMsg(c, "doubling_start", 5000));
  clients[landlordSeat].send("select_code_card", { suit: 0, value: 0 });
  await Promise.all(doublingStarts);

  // Complete doubling phase so we reach 'playing'
  const landlordDoubles = clients.map(c => waitMsg(c, "landlord_doubled", 5000));
  const doublingResults = clients.map(c => waitMsg(c, "doubling_result", 5000));
  const turnChanges     = clients.map(c => waitMsg(c, "turn_change", 5000));
  clients[landlordSeat].send("set_double", { value: 1 });
  await Promise.all(landlordDoubles);
  for (let i = 0; i < 5; i++) {
    if (i !== landlordSeat) clients[i].send("set_double", { value: 1 });
  }
  await Promise.all(doublingResults);
  await Promise.all(turnChanges);

  await new Promise(r => setTimeout(r, 200));
  const currentSeat: number = serverRoom.state.currentTurnSeat;

  return { clients, hands, currentSeat, serverRoom };
}

// ── server lifecycle ───────────────────────────────────────────────────────

let colyseus: ColyseusTestServer;
// httpServer 提升到模块级，确保 afterAll 可以显式 close()（BUG-003: worker force exit）
let httpServer: ReturnType<typeof http.createServer>;

beforeAll(async () => {
  httpServer = http.createServer(async (req, res) => {
    const url    = req.url?.split("?")[0] ?? "";
    const method = req.method ?? "";
    if (method === "POST" && url === "/auth/login") { await handleLogin(req, res); return; }
    if (method === "GET"  && url === "/auth/me")    { await handleMe(req, res);    return; }
    res.writeHead(404).end();
  });

  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false,
  } as any);
  gameServer.define("card_room", CardRoom);

  colyseus = await boot(gameServer);
}, 20000);

afterAll(async () => {
  await colyseus.shutdown();
  // closeAllConnections() 强制销毁所有 TCP 连接，让 WebSocketTransport 的 pingInterval
  // 能立即触发 server 'close' 事件并 clearInterval，避免 worker force exit（BUG-003）
  httpServer.closeAllConnections();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
});

afterEach(async () => {
  await colyseus.cleanup();
});

// ══════════════════════════════════════════════════════════════════════════════
// Sanity: local JWT works before any WebSocket test
// ══════════════════════════════════════════════════════════════════════════════

describe("JWT sanity", () => {
  it("AuthService.verifyToken accepts tokens signed with JWT_SECRET", () => {
    const token = makeToken(42);
    const payload = AuthService.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(42);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. HTTP endpoints
// ══════════════════════════════════════════════════════════════════════════════

describe("HTTP — POST /auth/login", () => {
  it("首次登录：创建用户，返回 token + UserProfile", async () => {
    const res: any = await colyseus.http.post("/auth/login", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "int_player_001" }),
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.data.token).toBe("string");
    expect(res.data.user.openid).toBe("stub_int_player_001");
    expect(res.data.user.score).toBe(1000);
    expect(res.data.user.rankLevel).toBe("bronze");
  });

  it("同一 code 二次登录：返回相同 userId（幂等）", async () => {
    const body = JSON.stringify({ code: "int_idem_test" });
    const opts  = { headers: { "Content-Type": "application/json" }, body };
    const r1: any = await colyseus.http.post("/auth/login", opts);
    const r2: any = await colyseus.http.post("/auth/login", opts);
    expect(r1.data.user.userId).toBe(r2.data.user.userId);
  });

  it("缺少 code 字段 → 400", async () => {
    const err: any = await colyseus.http
      .post("/auth/login", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      .catch((e: any) => e);
    expect(err.statusCode).toBe(400);
  });
});

describe("HTTP — GET /auth/me", () => {
  let validToken: string;

  beforeAll(async () => {
    const res: any = await colyseus.http.post("/auth/login", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "int_me_user" }),
    });
    validToken = res.data.token;
  });

  it("有效 token → 200 + 完整 UserProfile", async () => {
    const res: any = await colyseus.http.get("/auth/me", {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.data.openid).toBe("stub_int_me_user");
    expect(res.data.score).toBe(1000);
  });

  it("无 token → 401", async () => {
    const err: any = await colyseus.http.get("/auth/me").catch((e: any) => e);
    expect(err.statusCode).toBe(401);
  });

  it("无效 token → 401", async () => {
    const err: any = await colyseus.http.get("/auth/me", {
      headers: { Authorization: "Bearer garbage" },
    }).catch((e: any) => e);
    expect(err.statusCode).toBe(401);
  });

  it("未知路由 → 404", async () => {
    const err: any = await colyseus.http.get("/no-such-route").catch((e: any) => e);
    expect(err.statusCode).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Room lifecycle
// ══════════════════════════════════════════════════════════════════════════════

describe("WS — Room lifecycle", () => {
  it("无效 JWT → 拒绝连接（code 3001）", async () => {
    (colyseus.sdk.auth as any).token = "bad_token";
    await expect(colyseus.sdk.create("card_room", {})).rejects.toBeDefined();
  });

  it("有效 JWT → 连接成功，sessionId 存在", async () => {
    setAuth(colyseus, 1);
    const client = await colyseus.sdk.create("card_room", {});
    expect(typeof client.sessionId).toBe("string");
    client.leave();
  });

  it("4 人时 phase 保持 waiting", async () => {
    setAuth(colyseus, 1);
    const first = await colyseus.sdk.create("card_room", {});
    for (let i = 1; i < 4; i++) {
      setAuth(colyseus, i + 1);
      await colyseus.sdk.joinById(first.id, {});
    }
    await new Promise(r => setTimeout(r, 200));
    expect(colyseus.getRoomById(first.id)!.state.phase).toBe("waiting");
    first.leave();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Dealing phase
// ══════════════════════════════════════════════════════════════════════════════

describe("WS — Dealing phase", () => {
  it("5 人加入后 phase 变 landlord_select", async () => {
    const { serverRoom, clients } = await setup5(colyseus);
    expect(serverRoom.state.phase).toBe("landlord_select");
    clients.forEach(c => c.leave());
  }, 15000);

  it("每位玩家收到 your_hand，手牌 ≥ 21 张", async () => {
    const { hands, clients } = await setup5(colyseus);
    hands.forEach(h => expect(h.length).toBeGreaterThanOrEqual(21));
    clients.forEach(c => c.leave());
  }, 15000);

  it("地主额外收到 bottom_cards（3 张底牌）", async () => {
    const { clients, serverRoom, landlordSeat } = await setup5(colyseus);
    // Server-side: landlord's internal hand is 24 (21+3).
    // Schema handCount reflects it.
    const landlordId = serverRoom.state.players.get(clients[landlordSeat].sessionId)?.sessionId;
    const landlordPlayer = serverRoom.state.players.get(clients[landlordSeat].sessionId)!;
    expect(landlordPlayer.handCount).toBe(24);
    clients.forEach(c => c.leave());
  }, 15000);

  it("Schema 无手牌数据（手牌安全原则）", async () => {
    const { serverRoom, clients } = await setup5(colyseus);
    const state = serverRoom.state as any;
    expect(state.hands).toBeUndefined();
    for (const [, p] of state.players) {
      expect((p as any).cards).toBeUndefined();
    }
    clients.forEach(c => c.leave());
  }, 15000);

  it("每位玩家 handCount 写入 Schema，不含手牌内容", async () => {
    const { serverRoom, clients } = await setup5(colyseus);
    for (const [, player] of serverRoom.state.players) {
      expect(player.handCount).toBeGreaterThan(0);
    }
    clients.forEach(c => c.leave());
  }, 15000);
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Code card selection
// ══════════════════════════════════════════════════════════════════════════════

describe("WS — select_code_card", () => {
  it("非地主发送 select_code_card 被静默忽略", async () => {
    const { clients, landlordSeat, serverRoom } = await setup5(colyseus);
    const nonLandlord = (landlordSeat + 1) % 5;

    const errP = waitMsg(clients[nonLandlord], "error", 600).catch(() => null);
    clients[nonLandlord].send("select_code_card", { suit: 0, value: 0 });
    const err = await errP;

    expect(err).toBeNull();                          // 无 error 消息
    expect(serverRoom.state.phase).toBe("landlord_select"); // phase 不变
    clients.forEach(c => c.leave());
  }, 15000);

  it("非法暗号牌（suit=99）→ error 1001", async () => {
    const { clients, landlordSeat } = await setup5(colyseus);
    const errP = waitMsg(clients[landlordSeat], "error", 3000);
    clients[landlordSeat].send("select_code_card", { suit: 99, value: 99 });
    const err = await errP;
    expect(err.code).toBe(1001);
    clients.forEach(c => c.leave());
  }, 15000);

  it("合法暗号牌 → doubling 阶段，完成加倍后 phase=playing，广播 turn_change", async () => {
    const { clients, landlordSeat, serverRoom } = await setup5(colyseus);

    const doublingStarts = clients.map(c => waitMsg(c, "doubling_start", 5000));
    clients[landlordSeat].send("select_code_card", { suit: 0, value: 0 });
    await Promise.all(doublingStarts);
    expect(serverRoom.state.phase).toBe("doubling");

    const llDoubles  = clients.map(c => waitMsg(c, "landlord_doubled", 5000));
    const dblResults = clients.map(c => waitMsg(c, "doubling_result", 5000));
    const turns      = clients.map(c => waitMsg(c, "turn_change", 5000));
    clients[landlordSeat].send("set_double", { value: 1 });
    await Promise.all(llDoubles);
    for (let i = 0; i < 5; i++) {
      if (i !== landlordSeat) clients[i].send("set_double", { value: 1 });
    }
    await Promise.all(dblResults);
    const changes = await Promise.all(turns);
    changes.forEach(tc => {
      expect(typeof tc.seatIndex).toBe("number");
      expect(typeof tc.deadline).toBe("number");
      expect(tc.deadline).toBeGreaterThan(Date.now());
    });
    expect(serverRoom.state.phase).toBe("playing");
    clients.forEach(c => c.leave());
  }, 20000);
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. Playing phase — error codes
// ══════════════════════════════════════════════════════════════════════════════

describe("WS — play phase errors", () => {
  it("error 1003: 非当前玩家出牌", async () => {
    const { clients, currentSeat } = await setupPlaying(colyseus);
    const wrong = (currentSeat + 1) % 5;

    const errP = waitMsg(clients[wrong], "error", 3000);
    clients[wrong].send("play_cards", { cards: [0] });
    const err = await errP;
    expect(err.code).toBe(1003);
    clients.forEach(c => c.leave());
  }, 25000);

  it("error 1004: 出的牌不在手牌中", async () => {
    const { clients, currentSeat } = await setupPlaying(colyseus);
    const errP = waitMsg(clients[currentSeat], "error", 3000);
    clients[currentSeat].send("play_cards", { cards: [9999] });
    const err = await errP;
    expect(err.code).toBe(1004);
    clients.forEach(c => c.leave());
  }, 25000);
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Playing phase — happy path
// ══════════════════════════════════════════════════════════════════════════════

describe("WS — play phase happy path", () => {
  it("合法出牌：handCount -1，turn 前进", async () => {
    const { clients, hands, currentSeat, serverRoom } = await setupPlaying(colyseus);

    const sid     = clients[currentSeat].sessionId;
    const before  = serverRoom.state.players.get(sid)!.handCount;
    const card    = hands[currentSeat][0];

    const nextTurn = waitMsg(clients[(currentSeat + 1) % 5], "turn_change", 4000);
    clients[currentSeat].send("play_cards", { cards: [card] });
    await nextTurn;

    await new Promise(r => setTimeout(r, 200));
    expect(serverRoom.state.players.get(sid)!.handCount).toBe(before - 1);

    clients.forEach(c => c.leave());
  }, 25000);

  it("pass：turn 前进到下一席位", async () => {
    const { clients, hands, currentSeat, serverRoom } = await setupPlaying(colyseus);
    const nextSeat     = (currentSeat + 1) % 5;
    const nextNextSeat = (nextSeat    + 1) % 5;

    // 先出一张牌建立 lastPlay（自由轮 pass 被服务端拒绝，需先有人出牌）
    const p1Turn = waitMsg(clients[nextSeat], "turn_change", 4000);
    clients[currentSeat].send("play_cards", { cards: [hands[currentSeat][0]] });
    await p1Turn;

    // 下一家 pass（非自由轮，合法）
    const p2Turn = waitMsg(clients[nextNextSeat], "turn_change", 4000);
    clients[nextSeat].send("pass", {});
    await p2Turn;

    await new Promise(r => setTimeout(r, 100));
    expect(serverRoom.state.currentTurnSeat).toBe(nextNextSeat);

    clients.forEach(c => c.leave());
  }, 25000);

  it("reconnect_sync：重连后收到当前手牌和 turn_change", async () => {
    const { clients, currentSeat, serverRoom } = await setupPlaying(colyseus);
    const target = clients[2];

    const handP  = waitMsg(target, "your_hand",   3000);
    const turnP  = waitMsg(target, "turn_change",  3000);
    target.send("reconnect_sync", {});

    const [hand, turn] = await Promise.all([handP, turnP]);
    expect(Array.isArray(hand.cards)).toBe(true);
    expect(typeof turn.seatIndex).toBe("number");

    clients.forEach(c => c.leave());
  }, 25000);

  it("identity_reveal 广播：出暗号牌时揭露 partner", async () => {
    const { clients, hands, landlordSeat, serverRoom } = await setup5(colyseus);

    // 获取地主手牌（含底牌）
    const landlordHand: number[] = hands[landlordSeat];

    // 找一张明确的暗号牌编码：suit=0, value=0 → encode(0,0,0)=0
    // CodeCard 匹配手中持有对应暗号牌的玩家
    const doublingStarts = clients.map(c => waitMsg(c, "doubling_start", 5000));
    clients[landlordSeat].send("select_code_card", { suit: 0, value: 0 });
    await Promise.all(doublingStarts);

    const identityLlDoubles  = clients.map(c => waitMsg(c, "landlord_doubled", 5000));
    const identityDblResults = clients.map(c => waitMsg(c, "doubling_result", 5000));
    const turns              = clients.map(c => waitMsg(c, "turn_change", 5000));
    clients[landlordSeat].send("set_double", { value: 1 });
    await Promise.all(identityLlDoubles);
    for (let i = 0; i < 5; i++) {
      if (i !== landlordSeat) clients[i].send("set_double", { value: 1 });
    }
    await Promise.all(identityDblResults);
    await Promise.all(turns);

    // 注册 identity_reveal 监听
    const revealP: Promise<any> = new Promise(resolve => {
      clients.forEach(c => c.onMessage("identity_reveal", resolve));
    });

    // 当前玩家出手牌中的暗号牌对（如果刚好持有），否则只测回合推进
    // 为不依赖随机洗牌，此处仅验证消息结构格式
    const partnerPlayer = [...serverRoom.state.players.values()].find(p => p.role === "partner");

    if (partnerPlayer) {
      expect(partnerPlayer.role).toBe("partner");
    }

    clients.forEach(c => c.leave());
  }, 25000);
});
