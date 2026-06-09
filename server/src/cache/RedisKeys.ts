export const RedisKeys = {
  room:        (id: string)   => `room:${id}`,
  session:     (sid: string)  => `session:${sid}`,
  leaderboard: ()             => `rank:leaderboard`,
  matchQueue:  (tier: string) => `match:queue:${tier}`,
  onlineCount: ()             => `online:count`,
} as const;
