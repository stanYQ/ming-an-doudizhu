/**
 * @file simulate.ts
 * @description 数值模拟工具：运行 N 局全 AI 对局，验证地主方胜率 45%–55%。
 * @usage npx ts-node server/tools/simulate.ts --games 100000
 */

import * as fs   from "fs";
import * as path from "path";
import { Deck }        from "../src/logic/Deck";
import { AIPlayer }    from "../src/logic/AIPlayer";
import { RuleEngine }  from "../src/logic/RuleEngine";
import { CardPatternEngine } from "../src/logic/CardPatternEngine";
import { CodeCard, CodeCardSelection } from "../src/logic/CodeCard";
import { compareValue } from "../../shared/CardEncoding";

// ── CLI args ────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const gIdx    = args.indexOf("--games");
const N_GAMES = gIdx >= 0 ? Math.max(1000, parseInt(args[gIdx + 1], 10) || 100000) : 100000;

// ── stats accumulators ──────────────────────────────────────────────────────

let total        = 0;
let landlordWins = 0;
let games2v3     = 0;
let wins2v3      = 0;
let games1v4     = 0;
let wins1v4      = 0;
let totalMul     = 0;
let totalBombs   = 0;
let totalRockets  = 0;

// ── random code card (rank 0–7, suit 0–3) ──────────────────────────────────

function randomCodeCard(): CodeCardSelection {
  return {
    suit: Math.floor(Math.random() * 4),
    rank: Math.floor(Math.random() * 8),
  };
}

// ── simulate one game ───────────────────────────────────────────────────────

function simulateGame(): void {
  const deck = Deck.shuffle();
  const { hands: rawHands, bottom, faceUpCard } = Deck.deal(deck);
  const landlordSeat = Deck.findLandlordSeat(rawHands, faceUpCard);

  // Mutable hand arrays (seat-indexed)
  const hands: number[][] = rawHands.map(h => [...h]);
  hands[landlordSeat].push(...bottom);

  // Code card selection → partner resolution
  const sessionIds = ["p0", "p1", "p2", "p3", "p4"];
  const landlordId = sessionIds[landlordSeat];

  // Build Map for CodeCard.resolveTeammate
  const handMap = new Map<string, number[]>();
  for (let i = 0; i < 5; i++) handMap.set(sessionIds[i], hands[i]);

  // Try random code cards until we find a valid one (always valid: rank 0–7)
  const sel    = randomCodeCard();
  const result = CodeCard.resolveTeammate(sel, landlordId, handMap);
  const isAlone = result.isLandlordAlone;
  const codeCardPair = result.codeCardPair;

  // Track partner seat
  const partnerSeat = result.partnerId
    ? sessionIds.indexOf(result.partnerId)
    : -1;

  // ── game loop ─────────────────────────────────────────────────────────────

  let currentSeat  = landlordSeat;
  let lastPlay: number[] | null = null;   // null = free round
  let lastPlaySeat = -1;
  let passCount    = 0;
  let bombCount    = 0;
  let rocketCount  = 0;
  let winnerId     = -1;

  const MAX_TURNS = 500; // safety guard against infinite loops
  let turns = 0;

  while (winnerId === -1 && turns < MAX_TURNS) {
    turns++;
    const hand = hands[currentSeat];

    if (hand.length === 0) {
      winnerId = currentSeat;
      break;
    }

    // Determine free vs follow round
    const isNewRound = lastPlay === null || lastPlaySeat === currentSeat;
    const lastPattern = isNewRound ? null : CardPatternEngine.parse(lastPlay!);

    // AI decide
    const played = AIPlayer.decide(hand, lastPattern);

    if (played.length === 0) {
      // pass
      passCount++;
      if (passCount >= 4) {
        passCount = 0;
        lastPlay     = null;
        lastPlaySeat = -1;
      }
    } else {
      // validate (should always pass with AIPlayer strategy)
      const vResult = RuleEngine.validatePlay(hand, played, lastPattern);
      if (!vResult.ok) {
        // AI chose invalid play (shouldn't happen); fall back to pass
        passCount++;
        if (passCount >= 4) {
          passCount = 0;
          lastPlay     = null;
          lastPlaySeat = -1;
        }
        currentSeat = (currentSeat + 1) % 5;
        continue;
      }

      // Count bombs / rockets
      const pat = CardPatternEngine.parse(played);
      if (pat !== null && pat.type === "BOMB")           bombCount++;
      if (pat !== null && pat.type === "JOKER_BOMB_BIG") rocketCount++;

      RuleEngine.removeCards(hand, played);
      lastPlay     = played;
      lastPlaySeat = currentSeat;
      passCount    = 0;

      if (hand.length === 0) {
        winnerId = currentSeat;
        break;
      }
    }

    currentSeat = (currentSeat + 1) % 5;
  }

  if (winnerId === -1) return; // degenerate game, discard

  // ── determine winner camp ─────────────────────────────────────────────────

  const winnerSid = sessionIds[winnerId];
  const landlordWon = RuleEngine.determineWinner(winnerSid, landlordId, result.partnerId) === "landlord_camp";

  // ── multiplier (simplified: no individual doubling) ───────────────────────

  const modeMul     = isAlone ? 2 : 1;
  const bombMul     = Math.pow(2, bombCount);
  const rocketMul   = Math.pow(3, rocketCount);
  const multiplier  = modeMul * bombMul * rocketMul;

  // ── accumulate ────────────────────────────────────────────────────────────

  total++;
  if (landlordWon) landlordWins++;

  if (isAlone) {
    games1v4++;
    if (landlordWon) wins1v4++;
  } else {
    games2v3++;
    if (landlordWon) wins2v3++;
  }

  totalMul    += multiplier;
  totalBombs  += bombCount;
  totalRockets += rocketCount;
}

// ── main ────────────────────────────────────────────────────────────────────

console.log(`明暗斗地主 数值模拟  目标: ${N_GAMES.toLocaleString()} 局`);
console.log("─".repeat(50));

const t0 = Date.now();

for (let i = 0; i < N_GAMES; i++) {
  simulateGame();
  if ((i + 1) % 10000 === 0) {
    const pct = (((i + 1) / N_GAMES) * 100).toFixed(1);
    const cur = total > 0 ? ((landlordWins / total) * 100).toFixed(1) : "—";
    console.log(`  [${pct}%] 已完成 ${(i + 1).toLocaleString()} 局  当前地主胜率: ${cur}%`);
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

// ── compute report ───────────────────────────────────────────────────────────

const landlordWinRate  = total > 0 ? landlordWins / total : 0;
const winRate2v3       = games2v3 > 0 ? wins2v3 / games2v3 : 0;
const winRate1v4       = games1v4 > 0 ? wins1v4 / games1v4 : 0;
const landlordAloneRate = total > 0 ? games1v4 / total : 0;
const avgMultiplier    = total > 0 ? totalMul / total : 0;
const avgBombs         = total > 0 ? totalBombs / total : 0;
const avgRockets       = total > 0 ? totalRockets / total : 0;

const passGate = landlordWinRate >= 0.45 && landlordWinRate <= 0.55;

let recommendation: string | null = null;
if (!passGate) {
  if (landlordWinRate < 0.45) {
    recommendation = `地主方胜率偏低（${(landlordWinRate * 100).toFixed(1)}%），建议将一挑四倍数从 ×2 降至 ×1.5 后重跑，或增加地主底牌数量`;
  } else {
    recommendation = `地主方胜率偏高（${(landlordWinRate * 100).toFixed(1)}%），建议将一挑四倍数从 ×2 提升至 ×3 后重跑，或减少地主底牌优势`;
  }
}

const report = {
  totalGames:        total,
  landlordWinRate:   parseFloat(landlordWinRate.toFixed(4)),
  mode2v3: {
    games:   games2v3,
    winRate: parseFloat(winRate2v3.toFixed(4)),
  },
  mode1v4: {
    games:   games1v4,
    winRate: parseFloat(winRate1v4.toFixed(4)),
  },
  landlordAloneRate: parseFloat(landlordAloneRate.toFixed(4)),
  avgMultiplier:     parseFloat(avgMultiplier.toFixed(2)),
  avgBombsPerGame:   parseFloat(avgBombs.toFixed(2)),
  avgRocketsPerGame: parseFloat(avgRockets.toFixed(2)),
  passGate,
  recommendation,
};

// ── print results ─────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(50));
console.log(`  总局数:           ${total.toLocaleString()}`);
console.log(`  地主方整体胜率:   ${(landlordWinRate * 100).toFixed(2)}%   ${passGate ? "✓ PASS (45%–55%)" : "✗ FAIL"}`);
console.log(`  2v3 模式 胜率:    ${(winRate2v3 * 100).toFixed(2)}%  (${games2v3.toLocaleString()} 局)`);
console.log(`  1v4 模式 胜率:    ${(winRate1v4 * 100).toFixed(2)}%  (${games1v4.toLocaleString()} 局)`);
console.log(`  一挑四触发率:     ${(landlordAloneRate * 100).toFixed(2)}%`);
console.log(`  平均倍数:         ×${avgMultiplier.toFixed(2)}`);
console.log(`  平均炸弹/局:      ${avgBombs.toFixed(2)}`);
console.log(`  平均王炸/局:      ${avgRockets.toFixed(2)}`);
console.log(`  耗时:             ${elapsed}s`);
console.log("═".repeat(50));

if (recommendation) {
  console.log(`\n  建议: ${recommendation}`);
}

// ── write report ──────────────────────────────────────────────────────────────

const outPath = path.join(__dirname, "calibration-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\n  报告已写入: ${outPath}`);

process.exit(passGate ? 0 : 1);
