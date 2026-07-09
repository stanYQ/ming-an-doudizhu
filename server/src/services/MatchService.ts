/**
 * @file MatchService.ts
 * @description 匹配服务：段位分桶匹配 + 好友房创建 + Redis 队列管理
 * @module server/services
 */

import { getRedis } from "../cache/redisClient";

export type Tier = "tier_1" | "tier_2" | "tier_3" | "tier_4" | "tier_5";

const ALL_TIERS: Tier[] = ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"];

const RANK_TO_TIER: Record<string, Tier> = {
  bronze:   "tier_1",
  silver:   "tier_2",
  gold:     "tier_3",
  platinum: "tier_4",
  diamond:  "tier_5",
  master:   "tier_5",
};

export class MatchService {
  /**
   * AC-1/AC-2/AC-3/AC-4: map rankLevel + wait time to one or more tier buckets.
   * 0–15 s → same tier only; 15–30 s → expand ±1 (bounded).
   */
  static resolveTier(rankLevel: string, waitSeconds: number): Tier[] {
    const base = RANK_TO_TIER[rankLevel] ?? "tier_1";
    if (waitSeconds < 15) return [base];

    // Expand to adjacent ±1, clamped at tier_1 / tier_5 (AC-4)
    const idx = ALL_TIERS.indexOf(base);
    const result: Tier[] = [];
    if (idx > 0)                     result.push(ALL_TIERS[idx - 1]);
    result.push(base);
    if (idx < ALL_TIERS.length - 1)  result.push(ALL_TIERS[idx + 1]);
    return result;
  }

  /**
   * AC-8: push sessionId into the tier queue (atomic MULTI to prevent duplicates).
   * Also stores a session→tier reverse mapping with a 5-minute TTL (supports AC-10).
   */
  static async joinQueue(sessionId: string, rankLevel: string): Promise<void> {
    const redis = getRedis();
    const tier  = RANK_TO_TIER[rankLevel] ?? "tier_1";
    const qKey  = `match:queue:${tier}`;
    const sKey  = `match:session:${sessionId}`;

    // Atomic: remove any stale entry, push fresh, set reverse-lookup
    await redis.multi()
      .lrem(qKey, 0, sessionId)      // idempotent remove first
      .rpush(qKey, sessionId)
      .expire(qKey, 300)
      .set(sKey, tier, "EX", 300)   // AC-10: 5-min TTL acts as disconnect guard
      .exec();
  }

  /**
   * AC-9: remove sessionId from its queue.
   * Uses the reverse-lookup key to target exactly one queue.
   */
  static async leaveQueue(sessionId: string): Promise<void> {
    const redis = getRedis();
    const sKey  = `match:session:${sessionId}`;
    const tier  = await redis.get(sKey);

    if (tier) {
      await redis.lrem(`match:queue:${tier}`, 0, sessionId);
      await redis.del(sKey);
    }
    // AC-9: no-op if session not found (not an error)
  }

  /**
   * AC-12: generate a 6-digit room code, globally unique (Redis SET guard).
   * AC-13: code has 30-minute TTL.
   */
  static async generateRoomCode(): Promise<string> {
    const redis = getRedis();
    let code = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const key = `room:code:${code}`;
      // NX = only set if key does not exist → atomic uniqueness guard
      const ok = await redis.set(key, "1", "EX", 1800, "NX");
      if (ok === "OK") return code;
    }
    return code; // extremely unlikely to exhaust; return last attempt
  }

  /**
   * AC-13: validate a room code — returns true only if key still exists in Redis.
   */
  static async validateRoomCode(code: string): Promise<boolean> {
    const redis = getRedis();
    const exists = await redis.exists(`room:code:${code}`);
    return exists === 1;
  }
}
