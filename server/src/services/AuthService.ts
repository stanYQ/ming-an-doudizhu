import jwt from "jsonwebtoken";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "../db/connection";

const getSecret = () => process.env.JWT_SECRET ?? "dev_secret_change_me";
const isStub    = () => (process.env.AUTH_MODE ?? "stub") === "stub";

export interface UserProfile {
  userId:    number;
  openid:    string;
  nickname:  string;
  avatarUrl: string;
  score:     number;
  rankLevel: string; // "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master"
}

export interface LoginResponse {
  token: string;
  user:  UserProfile;
}

interface UserRow extends RowDataPacket {
  id:         number;
  openid:     string;
  nickname:   string;
  avatar_url: string;
  score:      number;
  rank_level: string;
}

function rowToProfile(r: UserRow): UserProfile {
  return {
    userId:    r.id,
    openid:    r.openid,
    nickname:  r.nickname,
    avatarUrl: r.avatar_url,
    score:     r.score,
    rankLevel: r.rank_level,
  };
}

export class AuthService {
  /**
   * Stub login: derives openid from code without calling WeChat API.
   * P4 replaces only this method's openid resolution — interface unchanged.
   */
  static async login(code: string): Promise<LoginResponse> {
    if (!isStub()) throw new Error("wechat auth not yet implemented");

    // AC-6: stub openid = `stub_${code}`
    const openid = `stub_${code}`;

    const pool = getPool();
    const [rows] = await pool.execute<UserRow[]>(
      "SELECT id, openid, nickname, avatar_url, score, rank_level FROM users WHERE openid = ?",
      [openid],
    );

    let user: UserProfile;
    if (rows.length > 0) {
      // AC-5: existing user
      user = rowToProfile(rows[0]);
    } else {
      // AC-5: first login → create with defaults (青铜/1000 分)
      const nickname = `Player_${openid.slice(-6)}`;
      const [res] = await pool.execute<ResultSetHeader>(
        "INSERT INTO users (openid, nickname, avatar_url, score, rank_level) VALUES (?, ?, ?, ?, ?)",
        [openid, nickname, "", 1000, "bronze"],
      );
      user = {
        userId:    res.insertId,
        openid,
        nickname,
        avatarUrl: "",
        score:     1000,
        rankLevel: "bronze",
      };
    }

    // AC-3/AC-4: JWT payload { userId, openid }, exp = now + 24h
    const token = jwt.sign(
      { userId: user.userId, openid: user.openid },
      getSecret(),
      { expiresIn: "24h" },
    );

    return { token, user };
  }

  /**
   * Synchronous JWT verification.
   * Returns payload on success, null on any failure (expired, tampered, etc.).
   */
  static verifyToken(token: string): { userId: number; openid: string } | null {
    try {
      const payload = jwt.verify(token, getSecret()) as {
        userId: number;
        openid: string;
      };
      return { userId: payload.userId, openid: payload.openid };
    } catch {
      return null;
    }
  }

  /** Fetch user profile by primary key. Returns null if not found. */
  static async getUser(userId: number): Promise<UserProfile | null> {
    const pool = getPool();
    const [rows] = await pool.execute<UserRow[]>(
      "SELECT id, openid, nickname, avatar_url, score, rank_level FROM users WHERE id = ?",
      [userId],
    );
    return rows.length > 0 ? rowToProfile(rows[0]) : null;
  }
}
