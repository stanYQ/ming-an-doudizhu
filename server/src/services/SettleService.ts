/**
 * @file SettleService.ts
 * @description 积分结算服务 V2。实现计划书 V1.1 §7 的零和倍数体系。
 *   替换 TASK-019 SettleService（已废弃）。
 * @module SettleService
 */

import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader } from "mysql2";
import { getPool } from "../db/connection";

// ── Base score by table type ───────────────────────────────────────────────

export type TableType = "starter" | "casual" | "expert" | "peak";

const BASE_SCORES: Record<TableType, number> = {
  starter: 1,
  casual:  2,
  expert:  5,
  peak:    10,
};

const M_CAPS: Record<TableType, number> = {
  starter: 16,
  casual:  64,
  expert:  256,
  peak:    Infinity,
};

// ── Public interfaces ──────────────────────────────────────────────────────

export interface GameSummaryV2 {
  roomId:          string;
  tableType:       TableType;
  winnerCamp:      0 | 1;              // 0=平民方  1=地主方
  isLandlordAlone: boolean;
  landlordId:      string;
  partnerId:       string | null;
  firstOutId:      string;
  landlordDouble:  1 | 2;             // dL
  playerDoubles:   Record<string, 1 | 2>; // sessionId → di（含暗队友）
  partnerDoubled:  boolean;           // 暗队友是否加倍（影响内部分配）
  bombCount:       number;            // 普通炸弹（4-8张同点）
  rocketSmallCount: number;           // 双小王炸
  rocketBigCount:  number;            // 双大王炸
  hasEightBomb:    boolean;           // 保留字段，V2 中 bombCount 已含8炸
  isSpring:        boolean;
  isAntiSpring:    boolean;
  duration:        number;
  players: Array<{
    userId:    number;
    sessionId: string;
    rankPos:   number;
  }>;
}

export interface PlayerSettleResultV2 {
  userId:     number;
  scoreDelta: number;
  newScore:   number;
}

export interface SettleResultV2 {
  players:    PlayerSettleResultV2[];
  multiplier: number;
  winnerCamp: 0 | 1;
  breakdown: {
    baseScore:       number;
    landlordDouble:  1 | 2;
    playerDoubles:   Record<string, 1 | 2>;
    isLandlordAlone: boolean;
    isSpring:        boolean;
    isAntiSpring:    boolean;
  };
}

// ── SettleService ──────────────────────────────────────────────────────────

export class SettleService {
  /**
   * 计算全局倍数 M（不含个人加倍 di/dL）。
   * M = 2^bombCount × 3^rocketSmallCount × 4^rocketBigCount
   *   × (isLandlordAlone ? 3 : 1) × (isSpring ? 2 : 1) × (isAntiSpring ? 2 : 1)
   * 结果按场次封顶。
   */
  static calcMultiplier(
    summary: Pick<GameSummaryV2,
      "tableType" | "bombCount" | "rocketSmallCount" | "rocketBigCount" |
      "isLandlordAlone" | "isSpring" | "isAntiSpring">
  ): number {
    let M = 1;
    M *= Math.pow(2, summary.bombCount);         // AC-4: 每炸 ×2
    M *= Math.pow(3, summary.rocketSmallCount);  // AC-5: 双小王炸 ×3
    M *= Math.pow(4, summary.rocketBigCount);    // AC-6: 双大王炸 ×4
    if (summary.isLandlordAlone) M *= 3;         // AC-9: 一挑四 ×3
    if (summary.isSpring)        M *= 2;         // AC-7: 春天 ×2
    if (summary.isAntiSpring)    M *= 2;         // AC-8: 反春天 ×2

    const cap = M_CAPS[summary.tableType];       // AC-2: M 封顶
    return Math.min(M, cap);
  }

  /**
   * 纯函数：计算每名玩家的 scoreDelta（含个人加倍，不写库）。
   * 零和保证：Σ scoreDelta = 0（除不尽零头归地主，误差 ≤ 1）。
   */
  static calcDeltas(summary: GameSummaryV2): Map<string, number> {
    const M  = SettleService.calcMultiplier(summary);
    const B  = BASE_SCORES[summary.tableType];
    const dL = summary.landlordDouble;
    const { landlordId, partnerId, isLandlordAlone, winnerCamp,
            playerDoubles, partnerDoubled } = summary;

    const landlordWins = winnerCamp === 1;
    const deltas = new Map<string, number>();

    if (isLandlordAlone) {
      // AC-17: 一挑四 — 地主单独承担全额
      let total = 0;
      for (const p of summary.players) {
        if (p.sessionId === landlordId) continue;
        const di   = playerDoubles[p.sessionId] ?? 1;
        const flow = B * M * di * dL;
        total += flow;
        // AC-14/14b: civilian gets +flow on win, -flow on loss
        deltas.set(p.sessionId, landlordWins ? -flow : flow);
      }
      deltas.set(landlordId, landlordWins ? total : -total);
    } else {
      // AC-12/13: 2v3 — 只有平民参与流水，暗队友 di 只影响内部分配
      let total = 0;
      for (const p of summary.players) {
        if (p.sessionId === landlordId || p.sessionId === partnerId) continue;
        const di   = playerDoubles[p.sessionId] ?? 1;
        const flow = B * M * di * dL;
        total += flow;
        deltas.set(p.sessionId, landlordWins ? -flow : flow);
      }

      // AC-15/16: 内部份数分配；零头归地主
      const sign         = landlordWins ? 1 : -1;
      const divisor      = partnerDoubled ? 2 : 3;                  // AC-16: 加倍对半; AC-15: 不加倍 1/3
      const partnerShare = Math.floor(total / divisor);
      const landlordShare = total - partnerShare;

      deltas.set(landlordId, sign * landlordShare);
      if (partnerId) deltas.set(partnerId, sign * partnerShare);
    }

    return deltas;
  }

  /**
   * 执行完整结算：计算分值，在同一 MySQL 事务内写库。
   * AC-22: 事务失败时抛出，CardRoom 收到异常后不广播 game_over。
   */
  static async settle(summary: GameSummaryV2): Promise<SettleResultV2> {
    const multiplier = SettleService.calcMultiplier(summary);
    const deltas     = SettleService.calcDeltas(summary);
    const B          = BASE_SCORES[summary.tableType];
    const pool       = getPool();
    const conn       = await (pool as any).getConnection() as PoolConnection;

    try {
      await conn.beginTransaction();

      // AC-19: 写入 game_records
      const [recResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO game_records
           (room_id, table_type, winner_camp, is_alone, multiplier, landlord_double, duration)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          summary.roomId, summary.tableType, summary.winnerCamp,
          summary.isLandlordAlone ? 1 : 0, multiplier,
          summary.landlordDouble, summary.duration,
        ],
      );
      const gameId = recResult.insertId;

      const playerResults: PlayerSettleResultV2[] = [];

      for (const p of summary.players) {
        const delta       = deltas.get(p.sessionId) ?? 0;
        const doubleValue = p.sessionId === summary.landlordId
          ? summary.landlordDouble
          : (summary.playerDoubles[p.sessionId] ?? 1);

        const role = p.sessionId === summary.landlordId ? "landlord"
                   : p.sessionId === summary.partnerId  ? "partner"
                   : "civilian";

        // AC-20: 写入 game_players（含 double_value）
        await conn.execute(
          `INSERT INTO game_players
             (record_id, user_id, session_id, role, rank_pos, score_delta, double_value)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [gameId, p.userId, p.sessionId, role, p.rankPos, delta, doubleValue],
        );

        if (p.userId === 0) continue; // AI 补位玩家不写 users 表

        // AC-21: 更新 users.score，不为负
        const [rows] = await conn.execute<any[]>(
          "SELECT score FROM users WHERE id = ?",
          [p.userId],
        );
        const currentScore = (rows[0] as any)?.score ?? 0;
        const newScore     = Math.max(0, currentScore + delta);

        await conn.execute(
          "UPDATE users SET score = ?, total_games = total_games + 1 WHERE id = ?",
          [newScore, p.userId],
        );

        playerResults.push({ userId: p.userId, scoreDelta: delta, newScore });
      }

      await conn.commit();

      return {
        players:    playerResults,
        multiplier,
        winnerCamp: summary.winnerCamp,
        breakdown: {
          baseScore:       B,
          landlordDouble:  summary.landlordDouble,
          playerDoubles:   summary.playerDoubles,
          isLandlordAlone: summary.isLandlordAlone,
          isSpring:        summary.isSpring,
          isAntiSpring:    summary.isAntiSpring,
        },
      };
    } catch (e) {
      await conn.rollback();
      throw e; // AC-22: 传给 CardRoom，不广播 game_over
    } finally {
      conn.release();
    }
  }
}
