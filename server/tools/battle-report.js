/**
 * @file battle-report.js
 * @description 解析服务端日志中的 [BATTLE] 战报，输出人类可读格式
 * @module tools
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ── 牌面解码 ──────────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];

function cardName(c) {
  const deck = Math.floor(c / 54), w = c % 54;
  if (w === 53) return `副${deck + 1}大王`;
  if (w === 52) return `副${deck + 1}小王`;
  return `副${deck + 1}${SUITS[Math.floor(w / 13)]}${RANKS[w % 13]}`;
}

function handStr(cards) {
  return cards.map(cardName).join(' + ');
}

// ── 日志文件定位 ──────────────────────────────────────────
function resolveLogFile() {
  if (process.env.SERVER_LOG && fs.existsSync(process.env.SERVER_LOG)) {
    return process.env.SERVER_LOG;
  }
  // 自动找 /private/tmp/ 下最新的 server-*.log
  const dir = '/private/tmp';
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('server-') && f.endsWith('.log'))
    .map(f => ({ file: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (files.length === 0) throw new Error('未找到 server-*.log，请先启动服务端');
  return files[0].file;
}

// ── 战报渲染 ──────────────────────────────────────────────
function renderReport(d, index, total) {
  const role = {};
  role[d.landlordSeat] = '地主';
  if (d.partnerSeat !== null) role[d.partnerSeat] = '搭档';

  const seats = {};
  for (const p of d.plays) {
    if (!seats[p.seatIndex]) seats[p.seatIndex] = p.sessionId;
  }

  const lines = [];
  const bar   = '═'.repeat(62);
  lines.push('');
  lines.push(bar);
  lines.push(`  战报 ${index}/${total}   房间: ${d.roomId}   耗时: ${((d.endAt - d.startAt) / 1000).toFixed(1)}s`);
  lines.push(bar);

  // 座位
  lines.push('');
  lines.push('【座位分配】');
  for (let i = 0; i < 5; i++) {
    const r   = role[i] || '平民';
    const sid = seats[i] || '?';
    const tag = i === d.landlordSeat ? ' ◀ 地主' : i === d.partnerSeat ? ' ◀ 搭档(暗)' : '';
    lines.push(`  Seat${i} [${r.padEnd(2)}]  ${sid}${tag}`);
  }

  // 加倍
  const dbl = d.doubling;
  lines.push('');
  lines.push('【加倍情况】');
  lines.push(`  地主 x${dbl.landlordDouble}` +
    (dbl.partnerDoubled ? '  搭档已加倍' : '') +
    (dbl.otherDoubledSeats.length ? `  其他加倍席: ${dbl.otherDoubledSeats.join(',')}` : ''));

  // 出牌流水
  lines.push('');
  lines.push('【出牌流水】');
  lines.push('─'.repeat(62));

  let roundNo = 0;
  for (let i = 0; i < d.plays.length; i++) {
    const p    = d.plays[i];
    const prev = i > 0 ? d.plays[i - 1] : null;

    // 新一轮判断：前一手非 pass 且下一个出牌者 === 前一个出牌者（其余全 pass 了）
    // 或者是第一回合
    const isRoundStart = i === 0 ||
      (!p.isPass && prev && !prev.isPass && prev.seatIndex === p.seatIndex);

    if (isRoundStart) {
      roundNo++;
      lines.push('');
      lines.push(`  ── 第${roundNo}轮 ${'─'.repeat(48)}`);
    }

    const r   = role[p.seatIndex] || '平民';
    const who = `Seat${p.seatIndex}·${r}`;
    const rev = d.partnerRevealedAtTurn === p.turn ? '  【★ 搭档身份揭晓】' : '';
    const t   = `T${String(p.turn).padStart(2, '0')}`;

    if (p.isPass) {
      lines.push(`  ${t}  ${who.padEnd(10)}  ⏭  PASS`);
    } else {
      lines.push(`  ${t}  ${who.padEnd(10)}  ▶  [${p.patternType.padEnd(14)}]  ${handStr(p.cards)}${rev}`);
    }
  }

  // 结算
  lines.push('');
  lines.push('─'.repeat(62));
  const r = d.result;
  lines.push('');
  lines.push('【结算】');
  lines.push(`  胜方: ${r.winnerCamp === 'landlord_camp' ? '地主方（地主＋搭档）' : '平民方'}`);
  if (r.isSpring)     lines.push('  ★ 春天（平民方全程未出牌）');
  if (r.isAntiSpring) lines.push('  ★ 反春（地主方全程未出牌）');
  lines.push(`  炸弹数: ${r.bombCount}   倍率: x${Math.pow(2, r.bombCount)}`);
  lines.push('');
  lines.push('  积分明细:');

  for (const [sid, score] of Object.entries(r.scores)) {
    const seat  = Object.entries(seats).find(([, s]) => s === sid)?.[0];
    const rname = seat !== undefined ? (role[seat] || '平民') : '?';
    const sign  = score > 0 ? '+' : '';
    lines.push(`    ${sid.padEnd(18)} [${rname}]  ${sign}${score}`);
  }

  const total_score = Object.values(r.scores).reduce((a, b) => a + b, 0);
  lines.push(`  零和校验: ${total_score}${total_score === 0 ? ' ✓' : ' ✗ ERROR'}`);

  return lines.join('\n');
}

// ── 主入口 ────────────────────────────────────────────────
function main() {
  let logFile;
  try {
    logFile = process.argv[2] || resolveLogFile();
  } catch (e) {
    console.error('[battle-report] ' + e.message);
    process.exit(0); // 非致命，测试不因此失败
  }

  const raw = fs.readFileSync(logFile, 'utf8');
  const battles = [];

  for (const line of raw.split('\n')) {
    if (!line.includes('"msg":"[BATTLE]"') && !line.includes('"msg":"[BATTLE] ')) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.msg && entry.msg.startsWith('[BATTLE]') && entry.roomId) {
        battles.push(entry);
      }
    } catch { /* 截断行跳过 */ }
  }

  if (battles.length === 0) {
    console.log('[battle-report] 日志中未找到 [BATTLE] 条目，跳过');
    return;
  }

  console.log(`\n[battle-report] 来源: ${logFile}   共 ${battles.length} 场战报`);
  for (let i = 0; i < battles.length; i++) {
    console.log(renderReport(battles[i], i + 1, battles.length));
  }
  console.log('');
}

main();
