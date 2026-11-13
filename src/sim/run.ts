// Headless AI-vs-AI simulation for balance & pacing.
//   npm run sim -- [gamesPerSeat=40] [--verbose]
import { Faction } from '../shared/cards';
import { GameState, PlayerId, apply, newGame } from '../shared/engine';
import { aiBattleAction, aiOrders, aiWantsRetreat } from '../shared/ai';

const N = Number(process.argv[2] ?? 40);
const verbose = process.argv.includes('--verbose');
const FACTIONS: Faction[] = ['concord', 'brood', 'hush'];

function play(f0: Faction, f1: Faction, seed: number): GameState {
  const s = newGame(f0, f1, seed);
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 5000) {
    if (s.phase === 'orders') {
      for (const p of [0, 1] as PlayerId[]) {
        if (aiWantsRetreat(s, p)) { apply(s, { type: 'retreat', player: p }); break; }
        const err = apply(s, { type: 'orders', player: p, orders: aiOrders(s, p) });
        if (err) throw new Error('orders: ' + err);
      }
    } else {
      const a = aiBattleAction(s, s.active);
      const err = apply(s, a);
      if (err) throw new Error('battle: ' + err + ' ' + JSON.stringify(a));
    }
  }
  return s;
}

interface Agg { games: number; wins: Record<string, number>; rounds: number[]; reasons: Record<string, number>; breaks: number; cardsLost: number; surrenders: number; relayDrain: number; stakes: number[] }

const total: Record<string, { w: number; g: number }> = {};
for (const f of FACTIONS) total[f] = { w: 0, g: 0 };
const allReasons: Record<string, number> = {};
const allRounds: number[] = [];
const resolveBy: Record<string, number> = {};
let breaks = 0, cardsLost = 0, surrenders = 0, relay = 0, bt = 0;

console.log(`Shatterline sim — ${N} games per seat per matchup\n`);
for (let i = 0; i < FACTIONS.length; i++) {
  for (let j = i; j < FACTIONS.length; j++) {
    const A = FACTIONS[i], B = FACTIONS[j];
    const agg: Agg = { games: 0, wins: { [A]: 0, [B]: 0, draw: 0 }, rounds: [], reasons: {}, breaks: 0, cardsLost: 0, surrenders: 0, relayDrain: 0, stakes: [] };
    for (let g = 0; g < N * 2; g++) {
      const swap = g % 2 === 1;
      const s = play(swap ? B : A, swap ? A : B, 1000 + g * 7919 + i * 31 + j * 131);
      const fw = s.winner === -1 || s.winner === null ? 'draw' : s.players[s.winner].faction;
      if (A === B) agg.wins[fw === 'draw' ? 'draw' : A]++;
      else agg.wins[fw]++;
      agg.games++;
      agg.rounds.push(s.round);
      allRounds.push(s.round);
      const reason = s.endReason.replace(/P\d /, '');
      agg.reasons[reason] = (agg.reasons[reason] ?? 0) + 1;
      allReasons[reason] = (allReasons[reason] ?? 0) + 1;
      agg.stakes.push(s.stakes);
      for (const [k, v] of Object.entries(s.stats.resolveBy)) resolveBy[k] = (resolveBy[k] ?? 0) + v;
      breaks += s.stats.breaks[0] + s.stats.breaks[1];
      cardsLost += s.stats.cardsLost[0] + s.stats.cardsLost[1];
      surrenders += s.stats.surrenders[0] + s.stats.surrenders[1];
      relay += s.stats.relayDrain[0] + s.stats.relayDrain[1];
      bt += s.stats.breakthrough[0] + s.stats.breakthrough[1];
      if (A !== B) { total[A].g++; total[B].g++; if (fw === A) total[A].w++; if (fw === B) total[B].w++; }
      if (verbose && g === 0) console.log(s.log.join('\n'));
    }
    const avgR = (agg.rounds.reduce((a, b) => a + b, 0) / agg.games).toFixed(1);
    console.log(`${A.padEnd(8)} vs ${B.padEnd(8)} | ${JSON.stringify(agg.wins)} | avg rounds ${avgR} | ${JSON.stringify(agg.reasons)}`);
  }
}
const G = allRounds.length;
console.log('\nOverall faction win rate (mirrors excluded):');
for (const f of FACTIONS) console.log(`  ${f.padEnd(8)} ${((100 * total[f].w) / Math.max(1, total[f].g)).toFixed(1)}%`);
const hist: Record<number, number> = {};
for (const r of allRounds) hist[r] = (hist[r] ?? 0) + 1;
console.log('Game length (round ended):', JSON.stringify(hist));
console.log('End reasons:', JSON.stringify(allReasons));
console.log(`Per game: breaks ${(breaks / G).toFixed(1)}, cards destroyed ${(cardsLost / G).toFixed(1)}, surrenders ${(surrenders / G).toFixed(2)}, relay drain ${(relay / G).toFixed(1)}, breakthrough ${(bt / G).toFixed(1)}`);
const totR = Object.values(resolveBy).reduce((a, b) => a + b, 0);
console.log('Resolve lost by source:', Object.entries(resolveBy).map(([k, v]) => `${k} ${((100 * v) / totR).toFixed(0)}%`).join(', '));
