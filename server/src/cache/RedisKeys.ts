/**
 * @file RedisKeys.ts
 * @description Redis 键名生成函数集合。所有业务代码必须通过此常量生成键名，
 *              禁止在外部硬编码或拼接字符串（见 specs/infra-setup.md §Redis键命名规范）。
 *              TTL 由调用方在 SET/EXPIRE 命令中设置，本文件仅负责键名生成。
 * @module server/cache/RedisKeys
 * @see specs/infra-setup.md §Redis 键命名规范
 */

export const RedisKeys = {
  /** 房间快照。String(JSON)，存储 CardRoom 内存状态。TTL=对局持续期，局结束时手动 DEL。 */
  room:        (id: string)   => `room:${id}`,

  /** 玩家会话。Hash，存储 JWT 解析后的玩家信息（uid/nickname 等）。TTL=86400s（24h）。 */
  session:     (sid: string)  => `session:${sid}`,

  /** 全局排行榜。ZSet，按积分降序，长期保存（无 TTL）。 */
  leaderboard: ()             => `rank:leaderboard`,

  /** 分段匹配队列。List，每档位（tier）独立队列，RPUSH 入队 BLPOP 出队。TTL=动态（匹配超时后清理）。 */
  matchQueue:  (tier: string) => `match:queue:${tier}`,

  /** 实时在线人数。String，原子计数器，连接时 INCR 断开时 DECR，无 TTL。 */
  onlineCount: ()             => `online:count`,
} as const;
