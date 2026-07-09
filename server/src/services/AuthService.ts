/**
 * @file AuthService.ts
 * @description 认证服务：Stub 模式占位登录 + JWT 签发与验证
 * @module server/services
 */

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

    // stub 模式：不访问 MySQL，直接返回内存用户（无需数据库）
    const openid  = `stub_${code}`;
    // 用 code 字符串的 charCode 之和生成一个稳定的伪 userId（同一 code 总是同一 ID）
    const userId  = [...code].reduce((acc, c) => acc + c.charCodeAt(0), 1000) % 900000 + 100000;
    const nickname = `Player_${openid.slice(-6)}`;

    const user: UserProfile = {
      userId,
      openid,
      nickname,
      avatarUrl: "",
      score:     1000,
      rankLevel: "bronze",
    };

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
  static async getUser(userId: number, openid?: string): Promise<UserProfile | null> {
    if (isStub()) {
      return {
        userId,
        openid:    openid ?? `stub_user_${userId}`,
        nickname:  `Player_${String(userId).slice(-6)}`,
        avatarUrl: "",
        score:     1000,
        rankLevel: "bronze",
      };
    }
    const pool = getPool();
    const [rows] = await pool.execute<UserRow[]>(
      "SELECT id, openid, nickname, avatar_url, score, rank_level FROM users WHERE id = ?",
      [userId],
    );
    return rows.length > 0 ? rowToProfile(rows[0]) : null;
  }
}
