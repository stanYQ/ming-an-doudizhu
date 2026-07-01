/**
 * @file gameRoutes.ts
 * @description HTTP 路由：GET /api/leaderboard + POST /api/checkin
 * @module server
 */
import type { IncomingMessage, ServerResponse } from "http";
import { getPool } from "../db/connection";
import { getRedis } from "../cache/redisClient";
import { AuthService } from "../services/AuthService";

const LEADERBOARD_KEY = "leaderboard:top50";
const LEADERBOARD_TTL = 60; // seconds

// 连续签到奖励积分：第 1~6 天 50/100/200/300/500/500，第 7 天起 1000
const STREAK_REWARDS = [50, 100, 200, 300, 500, 500, 1000];

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function extractBearer(req: IncomingMessage): string | null {
  const auth = req.headers["authorization"] ?? "";
  const [type, token] = auth.split(" ");
  return type === "Bearer" && token ? token : null;
}

/**
 * GET /api/leaderboard
 * 返回全服积分 Top 50，Redis 缓存 60s。
 */
export async function handleLeaderboard(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const redis = getRedis();
    const cached = await redis.get(LEADERBOARD_KEY).catch(() => null);
    if (cached) {
      json(res, 200, JSON.parse(cached));
      return;
    }

    const [rows] = await getPool().query<any[]>(
      `SELECT id AS userId, nickname, avatar_url AS avatarUrl, score, rank_level AS rankLevel
         FROM users
        ORDER BY score DESC
        LIMIT 50`,
    );

    const result = (rows as any[]).map((r, i) => ({ rank: i + 1, ...r }));
    await redis.set(LEADERBOARD_KEY, JSON.stringify(result), "EX", LEADERBOARD_TTL).catch(() => null);
    json(res, 200, result);
  } catch (e) {
    json(res, 500, { error: (e as Error).message });
  }
}

/**
 * POST /api/checkin
 * 每日签到，计算连续签到天数并给积分奖励。
 * 重复签到返回 409。
 */
export async function handleCheckin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = extractBearer(req);
  if (!token) { json(res, 401, { error: "unauthorized" }); return; }

  const payload = AuthService.verifyToken(token);
  if (!payload) { json(res, 401, { error: "unauthorized" }); return; }

  const { userId } = payload;
  const pool = getPool();

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 今天是否已签到
    const [existing] = await pool.query<any[]>(
      "SELECT id FROM checkin_records WHERE user_id = ? AND checkin_date = ?",
      [userId, today],
    );
    if ((existing as any[]).length > 0) {
      json(res, 409, { error: "already checked in today" });
      return;
    }

    // 查昨天是否有签到，计算连续天数
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const [prev] = await pool.query<any[]>(
      "SELECT streak FROM checkin_records WHERE user_id = ? AND checkin_date = ?",
      [userId, yesterday],
    );
    const prevStreak = (prev as any[]).length > 0 ? (prev as any[])[0].streak : 0;
    const streak     = prevStreak + 1;
    const scoreGained = STREAK_REWARDS[Math.min(streak - 1, STREAK_REWARDS.length - 1)];

    // 写签到记录
    await pool.query(
      "INSERT INTO checkin_records (user_id, checkin_date, streak, score_gained) VALUES (?, ?, ?, ?)",
      [userId, today, streak, scoreGained],
    );

    // 更新用户积分和金币
    await pool.query(
      "UPDATE users SET score = score + ?, coin = coin + ?, updated_at = NOW() WHERE id = ?",
      [scoreGained, scoreGained, userId],
    );

    // 积分榜缓存失效
    await getRedis().del(LEADERBOARD_KEY).catch(() => null);

    const [[user]] = await pool.query<any[]>(
      "SELECT score, coin FROM users WHERE id = ?",
      [userId],
    ) as any;

    json(res, 200, { streak, scoreGained, score: user.score, coin: user.coin });
  } catch (e) {
    json(res, 500, { error: (e as Error).message });
  }
}
