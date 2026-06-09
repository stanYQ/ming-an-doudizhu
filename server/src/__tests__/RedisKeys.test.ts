import { RedisKeys } from '../cache/RedisKeys';

describe('RedisKeys (AC-7)', () => {
  it('room key', () => {
    expect(RedisKeys.room('abc123')).toBe('room:abc123');
    expect(RedisKeys.room('xyz')).toBe('room:xyz');
  });

  it('session key', () => {
    expect(RedisKeys.session('sid1')).toBe('session:sid1');
  });

  it('leaderboard key (static)', () => {
    expect(RedisKeys.leaderboard()).toBe('rank:leaderboard');
  });

  it('matchQueue key', () => {
    expect(RedisKeys.matchQueue('gold')).toBe('match:queue:gold');
    expect(RedisKeys.matchQueue('bronze')).toBe('match:queue:bronze');
  });

  it('onlineCount key (static)', () => {
    expect(RedisKeys.onlineCount()).toBe('online:count');
  });

  it('keys are generated via functions, not hardcoded strings', () => {
    // verify each entry is a function
    expect(typeof RedisKeys.room).toBe('function');
    expect(typeof RedisKeys.session).toBe('function');
    expect(typeof RedisKeys.leaderboard).toBe('function');
    expect(typeof RedisKeys.matchQueue).toBe('function');
    expect(typeof RedisKeys.onlineCount).toBe('function');
  });
});
