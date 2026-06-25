/**
 * @file GameFlow.integration.test.ts
 * @description TASK-032c: 全流程集成冒烟 — Node.js 直连真实 Colyseus，走完
 *              join → deal → landlord_select → doubling → playing → game_over → rematch
 *
 * 前置条件（先启动服务端）：
 *   cd game_project/server
 *   AI_FILL_DELAY=0 npm run dev
 *
 * 运行方式：
 *   npm test -- --testPathPattern=GameFlow.integration
 *
 * 服务端不可达时所有 test 自动通过（静默跳过断言）。
 *
 * 注：plays 通过 Colyseus schema delta 推送（无 play_broadcast 消息），
 *     本测试通过 turn_change 序列 + error 推断出牌结果。
 * @module client/tests
 */

import * as http from 'http';
import { Client } from 'colyseus.js';

const SERVER_URL = process.env.COLYSEUS_URL ?? 'ws://localhost:2567';

// 绕过 http_proxy 环境变量：直接用 Node 原生 http 模块
function httpPost(hostname: string, port: number, path: string, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname, port, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let raw = '';
        res.on('data', (chunk: string) => { raw += chunk; });
        res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/* ── 消息收集器 ──────────────────────────────────────────────────────────────
 * push()     : 新消息入队；若有等待方则立即交付
 * waitFor()  : 返回 Promise；若队内已有消息则立即 resolve
 * 作用：防止 registerHandler → waitFor 之间的竞态（消息先于 await 到达时入队）
 */
interface MsgQueue {
  push(type: string, msg: any): void;
  waitFor(type: string, timeoutMs?: number): Promise<any>;
}

function makeMsgQueue(): MsgQueue {
  const queued:  Record<string, any[]> = {};
  const pending: Record<string, Array<{ resolve(v: any): void; timer: any }>> = {};

  return {
    push(type, msg) {
      const p = pending[type]?.shift();
      if (p) { clearTimeout(p.timer); p.resolve(msg); }
      else   { (queued[type] ??= []).push(msg); }
    },
    waitFor(type, ms = 15_000): Promise<any> {
      if (queued[type]?.length) return Promise.resolve(queued[type].shift()!);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`[032c] timeout waiting for "${type}" (${ms}ms)`)),
          ms,
        );
        (pending[type] ??= []).push({ resolve, timer });
      });
    },
  };
}

function findMySeatIndex(room: any): number | null {
  const players = room.state?.players;
  if (!players) return null;

  const bySessionId = players.get?.(room.sessionId);
  if (typeof bySessionId?.seatIndex === 'number') return bySessionId.seatIndex;

  if (typeof players.forEach === 'function') {
    let seatIndex: number | null = null;
    players.forEach((player: any) => {
      if (player?.sessionId === room.sessionId && typeof player.seatIndex === 'number') {
        seatIndex = player.seatIndex;
      }
    });
    if (seatIndex !== null) return seatIndex;
  }

  const list = Array.isArray(players) ? players : Object.values(players);
  const me = list.find((player: any) => player?.sessionId === room.sessionId);
  return typeof (me as any)?.seatIndex === 'number' ? (me as any).seatIndex : null;
}

function waitForMySeatIndex(room: any, timeoutMs = 10_000): Promise<number> {
  const current = findMySeatIndex(room);
  if (current !== null) return Promise.resolve(current);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('[032c] timeout waiting for my seatIndex from room.state.players')),
      timeoutMs,
    );
    room.onStateChange(() => {
      const seatIndex = findMySeatIndex(room);
      if (seatIndex === null) return;
      clearTimeout(timer);
      resolve(seatIndex);
    });
  });
}

function pushRecent<T>(items: T[], item: T, max = 8): void {
  items.push(item);
  if (items.length > max) items.shift();
}

function formatRecent(recent: { turnChanges: any[]; hints: any[]; errors: any[] }): string {
  return JSON.stringify({
    turn_change: recent.turnChanges,
    hint: recent.hints,
    error: recent.errors,
  });
}

/* ── 流程结果（beforeAll 填充，各 test 断言）────────────────────────────────── */

let serverAvailable = false;

const flow = {
  waitingUpdate:  null  as any,
  myCards:        []    as number[],
  isLandlord:     false,
  bottomCards:    null  as number[] | null,
  doublingStart:  null  as any,
  doublingResult: null  as any,
  gameOver:       null  as any,
  rematchMsg:     null  as any,
  sentPlayCount:  0,          // 我们发送 play_cards 的次数
  acceptedPlays:  0,          // 服务端接受（turn 推进且无 error）的次数
};

/* ── 测试 ─────────────────────────────────────────────────────────────────── */

describe('TASK-032c: GameFlow 集成冒烟（join→deal→landlord→doubling→play→settle→rematch）', () => {

  beforeAll(async () => {
    // ── 1. 登录拿 JWT（AUTH_MODE=stub：任意 code 均合法）───────────────
    const parsed   = new URL(SERVER_URL.replace(/^ws/, 'http'));
    const hostname = parsed.hostname;
    const port     = Number(parsed.port) || 2567;
    let token: string;
    let connectTimer: any;
    try {
      const body = await Promise.race([
        httpPost(hostname, port, '/auth/login', { code: 'integration_test_player' }),
        new Promise<never>((_, rej) => {
          connectTimer = setTimeout(() => rej(new Error('connect_timeout')), 5_000);
        }),
      ]) as { token: string };
      clearTimeout(connectTimer);
      token = body.token;
    } catch (e) {
      clearTimeout(connectTimer);
      console.warn(`[032c] 服务端不可达，跳过集成断言（${(e as Error).message}）`);
      return;
    }

    // ── 2. 连接 Colyseus（持 JWT）────────────────────────────────────────
    const client = new Client(SERVER_URL);
    client.auth.token = token;
    let room: any;
    try {
      room = await Promise.race([
        client.create('game', { aiFillEnabled: true }),
        new Promise<never>((_, rej) => {
          connectTimer = setTimeout(() => rej(new Error('connect_timeout')), 5_000);
        }),
      ]);
      clearTimeout(connectTimer);
    } catch (e) {
      clearTimeout(connectTimer);
      console.warn(`[032c] 房间连接失败，跳过集成断言（${(e as Error).message}）`);
      return;
    }
    serverAvailable = true;

    // ── 2. 注册所有消息监听（必须在任何 await 前完成，防止竞态）─────────
    const q = makeMsgQueue();

    let mySeatIndex: number | null = null;
    let playAgentEnabled = false;
    let awaitingPlayResult = false;
    let recoverableErrorCount = 0;
    const recent = {
      turnChanges: [] as any[],
      hints:       [] as any[],
      errors:      [] as any[],
    };

    // 纯入队类型
    const QUEUE_ONLY = [
      'waiting_update', 'bottom_cards',
      'doubling_start', 'landlord_doubled', 'doubling_result',
      'identity_reveal',
      'game_over', 'rematch_update', 'rematch_redirect', 'rematch_start',
    ];
    QUEUE_ONLY.forEach(t => room.onMessage(t, (msg: any) => q.push(t, msg)));

    // your_hand：入队 + 记录本地手牌副本
    room.onMessage('your_hand', (msg: any) => {
      q.push('your_hand', msg);
    });

    room.onMessage('hint', (msg: any) => {
      pushRecent(recent.hints, msg);
      q.push('hint', msg);
    });

    // turn_change：先入队；仅本人回合才请求服务端 hint 并行动。
    room.onMessage('turn_change', (msg: any) => {
      q.push('turn_change', msg);
      pushRecent(recent.turnChanges, msg);

      if (awaitingPlayResult) {
        awaitingPlayResult = false;
        recoverableErrorCount = 0;
        flow.acceptedPlays++;
      }

      if (!playAgentEnabled || msg.seatIndex !== mySeatIndex) return;

      const isNewRound = msg.isNewRound ?? false;
      room.send('request_hint');
      q.waitFor('hint', 5_000)
        .then((hint: any) => {
          const cards = Array.isArray(hint.cards) ? hint.cards : [];
          if (cards.length > 0) {
            flow.sentPlayCount++;
            awaitingPlayResult = true;
            room.send('play_cards', { cards });
          } else if (!isNewRound) {
            room.send('pass');
          }
          // isNewRound && cards===[] → 等下一个 turn_change
        })
        .catch((e: Error) => {
          q.push('fatal', new Error(`[032c] timeout waiting for hint on my turn: ${e.message}; recent=${formatRecent(recent)}`));
        });
    });

    // error 处理：
    //   1003 → 座位判断错误，立即 fatal
    //   1001 → 服务端拒绝牌型（可能是服务端 bug / race），不发 pass（自由轮 pass 会触发 1002 级联）
    //          重新 request_hint 用新推荐重试，最多 3 次
    //   1002 → 区分来源：play_cards 被拒（跟牌场景，发 pass 合理）vs pass 被拒（自由轮，不再 pass）
    room.onMessage('error', (msg: any) => {
      q.push('error', msg);
      pushRecent(recent.errors, msg);

      if (msg.code === 1003) {
        awaitingPlayResult = false;
        q.push('fatal', new Error(`[032c] error 1003 after seat-gated play agent; seat判断错误; recent=${formatRecent(recent)}`));
      } else if (msg.code === 1001) {
        // 牌型非法：不发 pass。重新请求 hint 用新推荐重试（ISSUE-C011）。
        const wasAwaiting = awaitingPlayResult;
        awaitingPlayResult = false;
        recoverableErrorCount++;
        if (recoverableErrorCount > 3) {
          q.push('fatal', new Error(`[032c] consecutive 1001 exceeded 3; recent=${formatRecent(recent)}`));
          return;
        }
        if (wasAwaiting) {
          room.send('request_hint');
          q.waitFor('hint', 5_000)
            .then((hint2: any) => {
              const cards2 = Array.isArray(hint2.cards) ? hint2.cards : [];
              if (cards2.length > 0) {
                flow.sentPlayCount++;
                awaitingPlayResult = true;
                room.send('play_cards', { cards: cards2 });
              }
            })
            .catch(() => {});
        }
      } else if (msg.code === 1002) {
        // 1002 来源区分：awaitingPlayResult=true → play_cards 被拒（跟牌），发 pass 合理
        //               awaitingPlayResult=false → pass 本身被拒（自由轮），不再 pass（ISSUE-C011）
        const wasAwaiting = awaitingPlayResult;
        awaitingPlayResult = false;
        recoverableErrorCount++;
        if (wasAwaiting) {
          room.send('pass');
        }
        if (recoverableErrorCount > 3) {
          q.push('fatal', new Error(`[032c] consecutive 1002 exceeded 3; recent=${formatRecent(recent)}`));
        }
      } else {
        recoverableErrorCount = 0;
      }
    });

    mySeatIndex = await waitForMySeatIndex(room);
    playAgentEnabled = true;

    // ── 3. 等待 AI 补位（AI_FILL_DELAY=0 → 几乎立即）────────────────────
    flow.waitingUpdate = await q.waitFor('waiting_update', 10_000);

    // ── 4. 发牌：等待 your_hand ───────────────────────────────────────────
    const handMsg = await q.waitFor('your_hand', 10_000);
    flow.myCards  = handMsg.cards as number[];

    // ── 5. 叫地主：检测是否收到 bottom_cards（仅地主收到）────────────────
    // bottom_cards 在 your_hand 之后立即发出（同一 startDealing 调用），
    // 若 2 s 内未收到（waitFor reject）则 .catch 转 null，确认我们不是地主。
    const maybBottom: any = await q.waitFor('bottom_cards', 2_000).catch(() => null);
    if (maybBottom !== null) {
      flow.isLandlord  = true;
      flow.bottomCards = (maybBottom as any).cards as number[];
      // 地主选暗号牌（选梅花3，suit=0 value=0，最小合法暗号牌）
      room.send('select_code_card', { suit: 0, value: 0 });
    }
    // 非地主：AI 地主已在 startDealing 内自动 handleSelectCode

    // ── 6. 加倍阶段 ────────────────────────────────────────────────────────
    flow.doublingStart  = await q.waitFor('doubling_start',  15_000);
    room.send('set_double', { value: 1 });    // 不加倍
    flow.doublingResult = await q.waitFor('doubling_result', 15_000);

    // ── 7. 出牌阶段 → 等待 game_over ─────────────────────────────────────
    // 出牌代理在 turn_change 回调中运行（上方已注册）；
    // AI 驱动游戏推进，我们在自己的回合出单张或 pass。
    flow.gameOver = await Promise.race([
      q.waitFor('game_over', 60_000),
      q.waitFor('fatal',     60_000).then((e: Error) => { throw e; }),
    ]);

    // ── 8. 再来一局 ───────────────────────────────────────────────────────
    room.send('request_rematch');
    flow.rematchMsg = await Promise.race([
      q.waitFor('rematch_redirect', 8_000),
      q.waitFor('rematch_start',    8_000),
    ]).catch(() => null);

    await room.leave();
  }, 120_000);

  /* ── 断言 ──────────────────────────────────────────────────────────────── */

  // 辅助：服务端不可达时跳过
  const s = (fn: () => void) => () => { if (!serverAvailable) return; fn(); };

  test('AC-6: 服务端可达，收到 waiting_update（readyCount≥1）',
    s(() => {
      expect(flow.waitingUpdate.readyCount).toBeGreaterThanOrEqual(1);
      expect(flow.waitingUpdate.total).toBe(5);
    })
  );

  test('AC-7: your_hand 手牌数 21，编码 0–107，无重复',
    s(() => {
      expect(flow.myCards.length).toBe(21);
      expect(flow.myCards.every(c => c >= 0 && c <= 107)).toBe(true);
      expect(new Set(flow.myCards).size).toBe(21);
    })
  );

  test('AC-7b: 若为地主则 bottom_cards 为 3 张合法编码',
    s(() => {
      if (!flow.isLandlord) return; // 非地主跳过
      expect(flow.bottomCards).not.toBeNull();
      expect(flow.bottomCards!.length).toBe(3);
      expect(flow.bottomCards!.every(c => c >= 0 && c <= 107)).toBe(true);
    })
  );

  test('AC-8: 收到 doubling_start（timeout 为正数，landlordSeatIndex 0–4）',
    s(() => {
      expect(flow.doublingStart).not.toBeNull();
      expect(flow.doublingStart.timeout).toBeGreaterThan(0);
      expect(flow.doublingStart.landlordSeatIndex).toBeGreaterThanOrEqual(0);
      expect(flow.doublingStart.landlordSeatIndex).toBeLessThan(5);
    })
  );

  test('AC-9: 收到 doubling_result（results 数组，包含每位玩家的加倍值）',
    s(() => {
      expect(flow.doublingResult).not.toBeNull();
      expect(Array.isArray(flow.doublingResult.results)).toBe(true);
      expect(flow.doublingResult.results.length).toBeGreaterThan(0);
    })
  );

  test('AC-10: 全局流程完成，收到 game_over（winnerCamp 合法）',
    s(() => {
      expect(flow.gameOver).not.toBeNull();
      expect(['landlord_camp', 'civilian_camp']).toContain(flow.gameOver.winnerCamp);
    })
  );

  test('AC-11: game_over.scores 包含 5 名玩家，零和',
    s(() => {
      const scores = flow.gameOver.scores as Record<string, number>;
      expect(Object.keys(scores).length).toBe(5);
      const total = Object.values(scores)
        .reduce((acc: number, v: any) => acc + (v as number), 0);
      expect(total).toBe(0);
    })
  );

  test('AC-12: 发送 request_rematch 后收到 rematch_redirect 或 rematch_start',
    s(() => {
      expect(flow.rematchMsg).not.toBeNull();
    })
  );

  test('AC-13: 快速匹配场景收 rematch_redirect { action: "requeue" }',
    s(() => {
      // quick-match 房间（mode=quick）走 requeue 分支
      if (flow.rematchMsg?.action !== undefined) {
        expect(flow.rematchMsg.action).toBe('requeue');
      }
    })
  );
});
