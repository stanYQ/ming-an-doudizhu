import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "../db/connection";

// ── rank thresholds ────────────────────────────────────────────────────────

const RANK_THRESHOLDS: Array<[string, number]> = [
  ["master",   3000],
  ["diamond",  2500],
  ["platinum", 2000],
  ["gold",     1500],
  ["silver",   1200],
  ["bronze",      0],
];

function scoreToRank(score: number): string {
  for (const [rank, min] of RANK_THRESHOLDS) {
    if (score >= min) return rank;
  }
  return "bronze";
}

const BASE_SCORE: Record<string, number> = {
  bronze: 100, silver: 120, gold: 150,
  platinum: 180, diamond: 220, master: 260,
};

function baseScore(rankLevel: string): number {
  return BASE_SCORE[rankLevel] ?? 100;
}

// ── public interfaces ──────────────────────────────────────────────────────

export interface GameSummary {
  roomId:          string;
  winnerCamp:      0 | 1;        // 0=civilian camp  1=landlord camp
  isLandlordAlone: boolean;
  landlordId:      string;       // sessionId
  partnerId:       string | null;
  firstOutId:      string;
  multiplier:      number;       // caller-supplied final multiplier (ignored here; we recalc)
  bombCount:       number;
  rocketCount:     number;
  hasEightBomb:    boolean;
  duration:        number;
  players: Array<{
    userId:    number;
    sessionId: string;
    rankLevel: string;
    rankPos:   number;
  }>;
}

export interface PlayerSettleResult {
  userId:       number;
  scoreDelta:   number;
  newScore:     number;
  newRankLevel: string;
}

export interface SettleResult {
  players:    PlayerSettleResult[];
  multiplier: number;
  winnerCamp: 0 | 1;
}

// ── pure functions (no side effects) ─────────────────────────────────────

export class SettleService {
  /**
   * Calculates total multiplier from game summary.
   * modeMultiplier × bombMultiplier × rocketMultiplier
   */
  static calcMultiplier(
    summary: Pick<GameSummary, "isLandlordAlone" | "bombCount" | "rocketCount" | "hasEightBomb">,
  ): number {
    // AC-4: mode multiplier
    const modeMul = summary.isLandlordAlone ? 2 : 1;

    // AC-5: each 4-7 bomb ×2; one 8-bomb ×4 (replaces ×2 for that bomb)
    const regularBombs = summary.bombCount - (summary.hasEightBomb ? 1 : 0);
    const bombMul = (summary.hasEightBomb ? 4 : 1) * Math.pow(2, regularBombs);

    // AC-6: each rocket (王炸) ×3
    const rocketMul = Math.pow(3, summary.rocketCount);

    return modeMul * bombMul * rocketMul;
  }

  /**
   * Returns each player's scoreDelta (rounded integer).
   * AC-1/AC-7 → AC-12: share-based distribution.
   */
  static calcDeltas(summary: GameSummary): Map<string, number> {
    const multiplier   = SettleService.calcMultiplier(summary);
    const landlordWins = summary.winnerCamp === 1;
    const deltas       = new Map<string, number>();

    for (const p of summary.players) {
      const isLandlord = p.sessionId === summary.landlordId;
      const isPartner  = summary.partnerId !== null && p.sessionId === summary.partnerId;
      const unit       = baseScore(p.rankLevel) * multiplier; // 1份

      let shares: number;
      if (summary.isLandlordAlone) {
        // AC-10/AC-11
        if (isLandlord) shares = landlordWins ? 8 : -4;
        else            shares = landlordWins ? -2 : 1;
      } else {
        // AC-8/AC-9
        if (isLandlord)       shares = landlordWins ?  2 : -2;
        else if (isPartner)   shares = landlordWins ?  2 : -2;
        else                  shares = landlordWins ? -1 : 4 / 3; // AC-9: civilian +4/3份
      }

      // AC-12: round to integer
      deltas.set(p.sessionId, Math.round(shares * unit));
    }

    return deltas;
  }

  /**
   * Executes full settlement: compute scores, update DB in a single transaction.
   * AC-18: if transaction fails, throws — CardRoom must not broadcast game_over.
   */
  static async settle(summary: GameSummary): Promise<SettleResult> {
    const multiplier = SettleService.calcMultiplier(summary);
    const deltas     = SettleService.calcDeltas(summary);
    const pool       = getPool();
    const conn       = await (pool as any).getConnection() as PoolConnection;

    try {
      await conn.beginTransaction();

      const playerResults: PlayerSettleResult[] = [];

      // AC-15: insert game_records
      const [recResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO game_records
           (room_id, winner_camp, is_landlord_alone, multiplier, duration)
         VALUES (?, ?, ?, ?, ?)`,
        [summary.roomId, summary.winnerCamp, summary.isLandlordAlone ? 1 : 0, multiplier, summary.duration],
      );
      const gameId = recResult.insertId;

      for (const p of summary.players) {
        const delta = deltas.get(p.sessionId) ?? 0;

        // AC-16: insert game_players (AI user_id = 0, per constraint)
        await conn.execute(
          `INSERT INTO game_players (game_id, user_id, session_id, score_delta, rank_pos)
           VALUES (?, ?, ?, ?, ?)`,
          [gameId, p.userId, p.sessionId, delta, p.rankPos],
        );

        if (p.userId === 0) continue; // AI player — don't update users table

        // AC-17: fetch current score, apply delta, clamp to 0
        const [rows] = await conn.execute<RowDataPacket[]>(
          "SELECT score FROM users WHERE id = ?",
          [p.userId],
        );
        const currentScore = (rows[0] as any)?.score ?? 0;
        const newScore     = Math.max(0, currentScore + delta); // AC-14: floor at 0
        const newRankLevel = scoreToRank(newScore);             // AC-13
        const isWinner     = summary.winnerCamp === 1
          ? (p.sessionId === summary.landlordId || p.sessionId === summary.partnerId)
          : (p.sessionId !== summary.landlordId && p.sessionId !== summary.partnerId);

        await conn.execute(
          `UPDATE users
           SET score = ?, rank_level = ?, total_games = total_games + 1,
               win_games = win_games + ?
           WHERE id = ?`,
          [newScore, newRankLevel, isWinner ? 1 : 0, p.userId],
        );

        playerResults.push({ userId: p.userId, scoreDelta: delta, newScore, newRankLevel });
      }

      await conn.commit();
      return { players: playerResults, multiplier, winnerCamp: summary.winnerCamp };
    } catch (e) {
      await conn.rollback();
      throw e; // AC-18: propagate to CardRoom so it skips game_over broadcast
    } finally {
      conn.release();
    }
  }
}
