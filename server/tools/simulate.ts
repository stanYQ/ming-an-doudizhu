/**
 * @file simulate.ts
 * @description TASK-024 数值模拟校准工具 V2。
 *   使用 AIPlayer V2（含 AIContext）跑 N 局全 AI 对局，验证地主方胜率 42%–55%。
 * @usage npx ts-node server/tools/simulate.ts [--games <n>] [--sample <n>]
 */

import * as fs   from "fs";
import * as path from "path";

import { Deck }               from "../src/logic/Deck";
import { AIPlayer }           from "../src/logic/AIPlayer";
import type { AIContext }     from "../src/logic/AIPlayer";
import { RuleEngine }         from "../src/logic/RuleEngine";
import { CardPatternEngine }  from "../src/logic/CardPatternEngine";
import { CodeCard, CodeCardSelection } from "../src/logic/CodeCard";
import { PatternType }        from "../../shared/CardPattern";

// ── CLI args ────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const gIdx    = args.indexOf("--games");
const sIdx    = args.indexOf("--sample");
const N_GAMES = gIdx >= 0 ? Math.max(1000, parseInt(args[gIdx + 1], 10) || 100000) : 100000;
const SAMPLE_N = sIdx >= 0 ? Math.min(20, parseInt(args[sIdx + 1], 10) || 0) : 0;

// ── types ────────────────────────────────────────────────────────────────────

interface PlayRecord {
  seat:    number;
  cards:   number[];
  pattern: string;
  isPass:  boolean;
}

interface SampleGame {
  gameIndex:  number;
  mode:       "2v3" | "1v4";
  winnerCamp: 0 | 1;
  totalTurns: number;
  plays:      PlayRecord[];
}

// ── stats accumulators ───────────────────────────────────────────────────────

let total             = 0;
let landlordWins      = 0;
let games2v3          = 0;
let wins2v3           = 0;
let games1v4          = 0;
let wins1v4           = 0;
let totalMul          = 0;
let totalBombs        = 0;
let totalRocketSmall  = 0;
let totalRocketBig    = 0;

const sampleGames: SampleGame[] = [];
const sampleInterval = SAMPLE_N > 0 ? Math.floor(N_GAMES / SAMPLE_N) : Infinity;

// ── helpers ───────────────────────────────────────────────────────────────────

function randomCodeCard(): CodeCardSelection {
  return { suit: Math.floor(Math.random() * 4), rank: Math.floor(Math.random() * 8) };
}

/** V2 multiplier formula (matches SettleService.calcMultiplier, no personal doubles). */
function calcMultiplier(bombs: number, rSmall: number, rBig: number, alone: boolean, spring: boolean): number {
  let M = 1;
  M *= Math.pow(2, bombs);    // each regular bomb ×2
  M *= Math.pow(3, rSmall);   // 双小王炸 ×3
  M *= Math.pow(4, rBig);     // 双大王炸 ×4
  if (alone)  M *= 3;         // 一挑四 ×3 (V2 rule)
  if (spring) M *= 2;         // 春天 ×2
  return M;
}

// ── simulate one game ─────────────────────────────────────────────────────────

function simulateGame(collectPlays: boolean, gameIndex: number): void {
  const deck = Deck.shuffle();
  const { hands: rawHands, bottom, faceUpCard } = Deck.deal(deck);
  const landlordSeat = Deck.findLandlordSeat(rawHands, faceUpCard);

  const hands: number[][] = rawHands.map(h => [...h]);
  hands[landlordSeat].push(...bottom);

  const sessionIds = ["p0", "p1", "p2", "p3", "p4"];
  const landlordId = sessionIds[landlordSeat];

  const handMap = new Map<string, number[]>();
  for (let i = 0; i < 5; i++) handMap.set(sessionIds[i], hands[i]);

  const sel      = randomCodeCard();
  const resolved = CodeCard.resolveTeammate(sel, landlordId, handMap);
  const isAlone  = resolved.isLandlordAlone;
  const partnerId = resolved.partnerId;

  // ── game loop ──────────────────────────────────────────────────────────────

  let currentSeat  = landlordSeat;
  let lastPlay: number[] | null = null;
  let lastPlaySeat = -1;
  let passCount    = 0;
  let bombCount    = 0;
  let rocketSmall  = 0;
  let rocketBig    = 0;
  let winnerId     = -1;

  // Spring tracking: did each civilian play at least once?
  const civilianPlayed = new Set<string>();

  const plays: PlayRecord[] = [];
  const MAX_TURNS = 600;

  for (let t = 0; t < MAX_TURNS && winnerId === -1; t++) {
    const sid  = sessionIds[currentSeat];
    const hand = hands[currentSeat];

    if (hand.length === 0) { currentSeat = (currentSeat + 1) % 5; continue; }

    const isNewRound  = lastPlay === null || lastPlaySeat === currentSeat;
    const lastPattern = isNewRound ? null : CardPatternEngine.parse(lastPlay!);

    // Build V2 AIContext
    const role: AIContext["role"] =
      sid === landlordId ? "landlord" :
      sid === partnerId  ? "partner"  : "civilian";

    const ctx: AIContext = {
      role,
      allyId:          role === "landlord" ? partnerId :
                       role === "partner"  ? landlordId : null,
      isLandlordAlone: isAlone,
      myHandCount:     hand.length,
    };

    const played = AIPlayer.decide(hand, lastPattern, ctx);

    if (played.length === 0) {
      if (collectPlays) plays.push({ seat: currentSeat, cards: [], pattern: "pass", isPass: true });
      if (++passCount >= 4) { passCount = 0; lastPlay = null; lastPlaySeat = -1; }
    } else {
      const pat = CardPatternEngine.parse(played);
      if (pat && pat.type === PatternType.BOMB)             bombCount++;
      else if (pat && pat.type === PatternType.JOKER_BOMB_SMALL) rocketSmall++;
      else if (pat && pat.type === PatternType.JOKER_BOMB_BIG)   rocketBig++;

      if (role === "civilian") civilianPlayed.add(sid);

      if (collectPlays) plays.push({ seat: currentSeat, cards: played, pattern: pat?.type ?? "UNKNOWN", isPass: false });

      RuleEngine.removeCards(hand, played);
      lastPlay     = played;
      lastPlaySeat = currentSeat;
      passCount    = 0;

      if (hand.length === 0) { winnerId = currentSeat; break; }
    }

    currentSeat = (currentSeat + 1) % 5;
  }

  if (winnerId === -1) return; // max turns hit — discard degenerate game

  // ── result ─────────────────────────────────────────────────────────────────

  const winnerSid   = sessionIds[winnerId];
  const landlordWon = RuleEngine.determineWinner(winnerSid, landlordId, partnerId) === "landlord_camp";

  // Spring: landlord wins AND no civilian ever played
  const isSpring = landlordWon && civilianPlayed.size === 0;

  const multiplier = calcMultiplier(bombCount, rocketSmall, rocketBig, isAlone, isSpring);

  total++;
  if (landlordWon) landlordWins++;
  if (isAlone) { games1v4++; if (landlordWon) wins1v4++; }
  else         { games2v3++; if (landlordWon) wins2v3++; }
  totalMul         += multiplier;
  totalBombs       += bombCount;
  totalRocketSmall += rocketSmall;
  totalRocketBig   += rocketBig;

  if (collectPlays) {
    sampleGames.push({
      gameIndex,
      mode:       isAlone ? "1v4" : "2v3",
      winnerCamp: landlordWon ? 1 : 0,
      totalTurns: plays.filter(p => !p.isPass).length,
      plays,
    });
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log(`明暗斗地主 数值模拟 V2  目标: ${N_GAMES.toLocaleString()} 局`);
if (SAMPLE_N > 0) console.log(`抽样: ${SAMPLE_N} 局 → sample-games.json`);
console.log("─".repeat(56));

const t0 = Date.now();

for (let i = 0; i < N_GAMES; i++) {
  const collectPlays = SAMPLE_N > 0 && i % sampleInterval === 0 && sampleGames.length < SAMPLE_N;
  simulateGame(collectPlays, i);

  if ((i + 1) % 10000 === 0) {
    const pct = (((i + 1) / N_GAMES) * 100).toFixed(1);
    const cur = total > 0 ? ((landlordWins / total) * 100).toFixed(1) : "—";
    console.log(`  [${pct}%] ${(i + 1).toLocaleString()} 局  地主胜率: ${cur}%`);
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

// ── compute report ────────────────────────────────────────────────────────────

const landlordWinRate   = total > 0 ? landlordWins / total : 0;
const winRate2v3        = games2v3 > 0 ? wins2v3 / games2v3 : 0;
const winRate1v4        = games1v4 > 0 ? wins1v4 / games1v4 : 0;
const landlordAloneRate = total > 0 ? games1v4 / total : 0;
const avgMultiplier     = total > 0 ? totalMul / total : 0;
const avgBombs          = total > 0 ? totalBombs / total : 0;
const avgRockets        = total > 0 ? (totalRocketSmall + totalRocketBig) / total : 0;

const passGate = landlordWinRate >= 0.42 && landlordWinRate <= 0.55;

let recommendation: string | null = null;
if (!passGate) {
  if (landlordWinRate < 0.42) {
    recommendation = `地主方胜率偏低（${(landlordWinRate * 100).toFixed(1)}%），建议将一挑四倍数从 ×3 降至 ×2，或增加地主底牌数量后重跑`;
  } else {
    recommendation = `地主方胜率偏高（${(landlordWinRate * 100).toFixed(1)}%），建议将一挑四倍数从 ×3 提升至 ×4，或调整暗号牌选取策略后重跑`;
  }
}

const report = {
  totalGames:        total,
  landlordWinRate:   parseFloat(landlordWinRate.toFixed(4)),
  mode2v3: { games: games2v3, winRate: parseFloat(winRate2v3.toFixed(4)) },
  mode1v4: { games: games1v4, winRate: parseFloat(winRate1v4.toFixed(4)) },
  landlordAloneRate: parseFloat(landlordAloneRate.toFixed(4)),
  avgMultiplier:     parseFloat(avgMultiplier.toFixed(2)),
  avgBombsPerGame:   parseFloat(avgBombs.toFixed(2)),
  avgRocketsPerGame: parseFloat(avgRockets.toFixed(2)),
  passGate,
  recommendation,
};

// ── print ─────────────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(56));
console.log(`  总局数:           ${total.toLocaleString()}`);
console.log(`  地主方整体胜率:   ${(landlordWinRate * 100).toFixed(2)}%   ${passGate ? "✓ PASS (42%–55%)" : "✗ FAIL"}`);
console.log(`  2v3 模式 胜率:    ${(winRate2v3 * 100).toFixed(2)}%  (${games2v3.toLocaleString()} 局)`);
console.log(`  1v4 模式 胜率:    ${(winRate1v4 * 100).toFixed(2)}%  (${games1v4.toLocaleString()} 局)`);
console.log(`  一挑四触发率:     ${(landlordAloneRate * 100).toFixed(2)}%`);
console.log(`  平均倍数 M:       ×${avgMultiplier.toFixed(2)}`);
console.log(`  平均炸弹/局:      ${avgBombs.toFixed(2)}`);
console.log(`  平均王炸/局:      ${avgRockets.toFixed(2)}`);
console.log(`  耗时:             ${elapsed}s`);
console.log("═".repeat(56));
if (recommendation) console.log(`\n  建议: ${recommendation}`);

// ── write files ───────────────────────────────────────────────────────────────

const toolsDir = path.join(__dirname);
fs.writeFileSync(path.join(toolsDir, "calibration-report.json"), JSON.stringify(report, null, 2));
console.log(`\n  报告 → server/tools/calibration-report.json`);

if (SAMPLE_N > 0 && sampleGames.length > 0) {
  fs.writeFileSync(path.join(toolsDir, "sample-games.json"), JSON.stringify(sampleGames, null, 2));
  console.log(`  样本 → server/tools/sample-games.json (${sampleGames.length} 局)`);
}

process.exit(passGate ? 0 : 1);
