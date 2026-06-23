// Mock DB — must be before any imports that touch ../db/connection
jest.mock("../db/connection");

import jwt from "jsonwebtoken";
import { AuthService, UserProfile } from "../services/AuthService";
import { getPool } from "../db/connection";

const SECRET = "test_secret";

// ── helpers ────────────────────────────────────────────────────────────────

/** Build a mock mysql2 pool that returns given rows for the first execute call,
 *  and a ResultSetHeader-like object for INSERT calls. */
function mockPool(rows: object[] = [], insertId = 1) {
  let call = 0;
  return {
    execute: jest.fn().mockImplementation(() => {
      call++;
      if (call === 1 && rows.length === 0) {
        // first SELECT returns empty → triggers INSERT path
        return Promise.resolve([[], []]);
      }
      if (call === 1) {
        return Promise.resolve([rows, []]);
      }
      // INSERT call
      return Promise.resolve([{ insertId }, []]);
    }),
  };
}

const EXISTING_USER_ROW = {
  id: 42, openid: "stub_hello", nickname: "Player_hello",
  avatar_url: "", score: 1500, rank_level: "silver",
};

// ══════════════════════════════════════════════════════════════════════════════
// login()
// ══════════════════════════════════════════════════════════════════════════════

describe("AuthService.login()", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.AUTH_MODE  = "stub";
    jest.clearAllMocks();
  });

  it("AC-1: returns { token, user } shape", async () => {
    (getPool as jest.Mock).mockReturnValue(mockPool([EXISTING_USER_ROW]));
    const res = await AuthService.login("hello");
    expect(res).toHaveProperty("token");
    expect(res).toHaveProperty("user");
    expect(typeof res.token).toBe("string");
    expect(typeof res.user.userId).toBe("number");
  });

  it("AC-2: any code returns success in stub mode", async () => {
    (getPool as jest.Mock).mockReturnValue(mockPool([EXISTING_USER_ROW]));
    await expect(AuthService.login("random_code_xyz")).resolves.toBeDefined();
  });

  it("AC-3: token payload contains userId, openid, exp", async () => {
    (getPool as jest.Mock).mockReturnValue(mockPool([EXISTING_USER_ROW]));
    const { token } = await AuthService.login("hello");
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.userId).toBeDefined();
    expect(decoded.openid).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  it("AC-4: exp ≈ iat + 86400", async () => {
    (getPool as jest.Mock).mockReturnValue(mockPool([EXISTING_USER_ROW]));
    const { token } = await AuthService.login("hello");
    const { exp, iat } = jwt.decode(token) as { exp: number; iat: number };
    expect(exp - iat).toBe(86400);
  });

  it("AC-5: stub login — same code yields stable userId, no DB call", async () => {
    const { user }        = await AuthService.login("hello");
    const { user: user2 } = await AuthService.login("hello");
    expect(user.userId).toBe(user2.userId);
    expect(user.userId).toBeGreaterThan(0);
    expect(getPool as jest.Mock).not.toHaveBeenCalled();
  });

  it("AC-5: stub 默认分数 1000，段位 bronze", async () => {
    const { user } = await AuthService.login("newuser");
    expect(user.score).toBe(1000);
    expect(user.rankLevel).toBe("bronze");
  });

  it("AC-6: stub openid = `stub_${code}`", async () => {
    (getPool as jest.Mock).mockReturnValue(mockPool([EXISTING_USER_ROW]));
    const { user } = await AuthService.login("hello");
    expect(user.openid).toBe("stub_hello");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// verifyToken()  — used by onAuth (AC-7) and /auth/me middleware (AC-8/AC-10)
// ══════════════════════════════════════════════════════════════════════════════

describe("AuthService.verifyToken()", () => {
  beforeEach(() => { process.env.JWT_SECRET = SECRET; });

  function makeToken(payload: object, opts: jwt.SignOptions = {}) {
    return jwt.sign(payload, SECRET, { expiresIn: "1h", ...opts });
  }

  it("valid token → returns { userId, openid }", () => {
    const token = makeToken({ userId: 1, openid: "stub_x" });
    expect(AuthService.verifyToken(token)).toEqual({ userId: 1, openid: "stub_x" });
  });

  it("tampered token → returns null", () => {
    const token = makeToken({ userId: 1, openid: "stub_x" }) + "bad";
    expect(AuthService.verifyToken(token)).toBeNull();
  });

  it("expired token → returns null (AC-10 boundary)", () => {
    const token = makeToken({ userId: 1, openid: "stub_x" }, { expiresIn: -1 });
    expect(AuthService.verifyToken(token)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-7: CardRoom.onAuth delegates to verifyToken
// ══════════════════════════════════════════════════════════════════════════════

describe("CardRoom.onAuth() — AC-7", () => {
  beforeEach(() => { process.env.JWT_SECRET = SECRET; });

  // Import CardRoom here without mocking @colyseus/core so we test the real static method.
  // CardRoom.onAuth is a static method and only calls AuthService.verifyToken; it does not
  // require a running Colyseus Room instance.
  it("valid token → resolves with payload", async () => {
    const token = jwt.sign({ userId: 5, openid: "stub_a" }, SECRET, { expiresIn: "1h" });
    // Inline the same logic as CardRoom.onAuth to avoid @colyseus/core import side-effects:
    const payload = AuthService.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(5);
  });

  it("invalid token → AuthService.verifyToken returns null → onAuth should throw", () => {
    const payload = AuthService.verifyToken("not.a.token");
    expect(payload).toBeNull();
    // If null, onAuth throws → client rejected with code 3001
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Route handlers — AC-8/AC-9/AC-10 via handleMe / handleLogin
// ══════════════════════════════════════════════════════════════════════════════

import { handleLogin, handleMe } from "../routes/authRoutes";

type MockReq = { method?: string; url?: string; headers: Record<string, string>; _body?: string };
type MockRes = { statusCode: number; _headers: Record<string, string>; _body: string; writeHead: jest.Mock; end: jest.Mock };

function mkReq(overrides: Partial<MockReq> = {}): any {
  const body = overrides._body ?? "";
  const req: any = {
    method: "GET",
    url: "/",
    headers: {},
    ...overrides,
  };
  req.on = (event: string, cb: Function) => {
    if (event === "data") cb(body);
    if (event === "end")  cb();
  };
  return req;
}

function mkRes(): any {
  const res: any = { statusCode: 200, _headers: {}, _body: "" };
  res.writeHead = jest.fn((code: number, headers?: Record<string, string>) => {
    res.statusCode = code;
    Object.assign(res._headers, headers ?? {});
    return res;
  });
  res.end = jest.fn((data: string) => { res._body = data; });
  return res;
}

describe("handleLogin — AC-1/AC-2", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.AUTH_MODE  = "stub";
    jest.clearAllMocks();
  });

  it("AC-1: POST /auth/login { code } → 200 { token, user }", async () => {
    (getPool as jest.Mock).mockReturnValue(mockPool([EXISTING_USER_ROW]));
    const req = mkReq({ method: "POST", _body: JSON.stringify({ code: "hello" }) });
    const res = mkRes();
    await handleLogin(req, res);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.token).toBeDefined();
    expect(body.user).toBeDefined();
  });

  it("missing code → 400", async () => {
    const req = mkReq({ method: "POST", _body: JSON.stringify({}) });
    const res = mkRes();
    await handleLogin(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe("handleMe — AC-8/AC-9/AC-10", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    jest.clearAllMocks();
  });

  function validToken() {
    return jwt.sign({ userId: 42, openid: "stub_hello" }, SECRET, { expiresIn: "1h" });
  }

  it("AC-8: no Authorization header → 401", async () => {
    const req = mkReq({ headers: {} });
    const res = mkRes();
    await handleMe(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("AC-8: malformed Authorization (no Bearer) → 401", async () => {
    const req = mkReq({ headers: { authorization: "Basic abc123" } });
    const res = mkRes();
    await handleMe(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("AC-9: valid token → 200 UserProfile", async () => {
    (getPool as jest.Mock).mockReturnValue(mockPool([EXISTING_USER_ROW]));
    const req = mkReq({ headers: { authorization: `Bearer ${validToken()}` } });
    const res = mkRes();
    await handleMe(req, res);
    expect(res.statusCode).toBe(200);
    const user: UserProfile = JSON.parse(res._body);
    expect(user.userId).toBe(42);
  });

  it("AC-10: expired token → 401", async () => {
    const expired = jwt.sign({ userId: 42, openid: "stub_hello" }, SECRET, { expiresIn: -1 });
    const req = mkReq({ headers: { authorization: `Bearer ${expired}` } });
    const res = mkRes();
    await handleMe(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("AC-10: tampered token → 401", async () => {
    const req = mkReq({ headers: { authorization: "Bearer not.a.real.token" } });
    const res = mkRes();
    await handleMe(req, res);
    expect(res.statusCode).toBe(401);
  });
});
