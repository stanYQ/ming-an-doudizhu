import type { IncomingMessage, ServerResponse } from "http";
import { AuthService } from "../services/AuthService";

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end",  () => resolve(data));
    req.on("error", reject);
  });
}

/** AC-8: extracts Bearer token from Authorization header. */
function extractBearer(req: IncomingMessage): string | null {
  const auth = req.headers["authorization"] ?? "";
  const [type, token] = auth.split(" ");
  return type === "Bearer" && token ? token : null;
}

/** POST /auth/login  { code: string } → { token, user } */
export async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const raw  = await readBody(req);
    const body = JSON.parse(raw) as { code?: string };
    if (!body.code) { json(res, 400, { error: "code required" }); return; }
    const result = await AuthService.login(body.code);
    json(res, 200, result);
  } catch (e) {
    json(res, 500, { error: (e as Error).message });
  }
}

/** GET /auth/me  Authorization: Bearer <token> → UserProfile */
export async function handleMe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // AC-8: no token → 401
  const token = extractBearer(req);
  if (!token) { json(res, 401, { error: "unauthorized" }); return; }

  // AC-10: invalid/expired token → 401
  const payload = AuthService.verifyToken(token);
  if (!payload) { json(res, 401, { error: "unauthorized" }); return; }

  // AC-9: valid token → user profile
  const user = await AuthService.getUser(payload.userId, payload.openid);
  if (!user) { json(res, 404, { error: "user not found" }); return; }
  json(res, 200, user);
}
