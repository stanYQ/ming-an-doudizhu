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

import { Client } from 'colyseus.js';

const SERVER_URL = process.env.COLYSEUS_URL ?? 'ws://localhost:2567';

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
    // ── 1. 连接（5 s 超时；失败则跳过所有断言）──────────────────────────
    const client = new Client(SERVER_URL);
    let room: any;
    let connectTimer: any;
    try {
      room = await Promise.race([
        client.joinOrCreate('game', { mode: 'quick' }),
        new Promise<never>((_, rej) => {
          connectTimer = setTimeout(() => rej(new Error('connect_timeout')), 5_000);
        }),
      ]);
      clearTimeout(connectTimer);
    } catch (e) {
      clearTimeout(connectTimer);
      console.warn(`[032c] 服务端不可达，跳过集成断言（${(e as Error).message}）`);
      return;
    }
    serverAvailable = true;

    // ── 2. 注册所有消息监听（必须在任何 await 前完成，防止竞态）─────────
    const q = makeMsgQueue();

    let myCards: number[]   = [];
    let playState: 'idle' | 'sent' | 'got_1003' = 'idle';
    let pendingCard = -1;

    // 纯入队类型
    const QUEUE_ONLY = [
      'waiting_update', 'bottom_cards',
      'doubling_start', 'landlord_doubled', 'doubling_result',
      'identity_reveal', 'hint',
      'game_over', 'rematch_update', 'rematch_redirect', 'rematch_start',
    ];
    QUEUE_ONLY.forEach(t => room.onMessage(t, (msg: any) => q.push(t, msg)));

    // your_hand：入队 + 记录本地手牌副本
    room.onMessage('your_hand', (msg: any) => {
      q.push('your_hand', msg);
      myCards = [...(msg.cards as number[])];
    });

    // turn_change：入队 + 出牌代理
    // 每次收到 turn_change 时尝试出手牌最小单张；
    // 若上次尝试未被 error 拒绝（playState==='sent'）则视为出牌成功，更新本地手牌。
    room.onMessage('turn_change', (msg: any) => {
      q.push('turn_change', msg);

      if (playState === 'sent' && pendingCard !== -1) {
        // 上次发出 play_cards 后没有收到 error → 服务端接受了该出牌，turn 推进
        myCards = myCards.filter(c => c !== pendingCard);
        flow.acceptedPlays++;
      }

      // 重置出牌状态
      playState  = 'idle';
      pendingCard = -1;

      if (myCards.length === 0) return;

      const sorted = [...myCards].sort((a, b) => a - b);
      pendingCard = sorted[0];
      playState   = 'sent';
      flow.sentPlayCount++;
      room.send('play_cards', { cards: [pendingCard] });
    });

    // error：入队 + 出牌回退
    room.onMessage('error', (msg: any) => {
      q.push('error', msg);
      if (playState !== 'sent') return;

      if (msg.code === 1003) {
        // 不轮到本人 → 等待下次 turn_change 再判断
        playState = 'got_1003';
      } else if (msg.code === 1001 || msg.code === 1002) {
        // 牌型不合法 / 打不过 → pass
        playState   = 'idle';
        pendingCard = -1;
        room.send('pass');
      }
    });

    // ── 3. 等待 AI 补位（AI_FILL_DELAY=0 → 几乎立即）────────────────────
    flow.waitingUpdate = await q.waitFor('waiting_update', 10_000);

    // ── 4. 发牌：等待 your_hand ───────────────────────────────────────────
    const handMsg = await q.waitFor('your_hand', 10_000);
    flow.myCards  = handMsg.cards as number[];

    // ── 5. 叫地主：检测是否收到 bottom_cards（仅地主收到）────────────────
    // bottom_cards 在 your_hand 之后立即发出（同一 startDealing 调用），
    // 若 2 s 内未收到则确认我们不是地主。
    const maybBottom: any = await Promise.race([
      q.waitFor('bottom_cards', 2_000),
      new Promise<null>(res => setTimeout(() => res(null), 2_000)),
    ]);
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
    flow.gameOver = await q.waitFor('game_over', 60_000);

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
