// Headless AI-vs-AI simulation for balance & pacing.
//   npm run sim -- [gamesPerMatchup=20] [--arch] [--verbose]
import { FACTION_INFO, Faction, starterDeck } from '../shared/cards';
import { GameState, PlayerId, apply, newGame } from '../shared/engine';
import { aiOrders, aiWantsRetreat } from '../shared/ai';

const N = Number(process.argv[2] ?? 20);
const byArch = process.argv.includes('--arch');
const verbose = process.argv.includes('--verbose');
const FACTIONS: Faction[] = ['concord', 'brood', 'hush'];

interface Entry { f: Faction; arch?: string; label: string }
const entries: Entry[] = byArch
  ? FACTIONS.flatMap((f) => Object.keys(FACTION_INFO[f].archetypes).map((a) => ({ f, arch: a, label: `${f}/${a}` })))
  : FACTIONS.map((f) => ({ f, label: f }));

function play(a: Entry, b: Entry, seed: number): GameState {
  const s = newGame(a.f, b.f, seed, [starterDeck(a.f, a.arch), starterDeck(b.f, b.arch)]);
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 50) {
    for (const p of [0, 1] as PlayerId[]) {
      if ((s.phase as string) === 'over') break;
      if (aiWantsRetreat(s, p)) { apply(s, { type: 'retreat', player: p }); break; }
      const err = apply(s, { type: 'orders', player: p, orders: aiOrders(s, p, { candidates: 5 }) });
      if (err) throw new Error('orders: ' + err);
    }
  }
  return s;
}

const wins: Record<string, { w: number; g: number }> = {};
for (const e of entries) wins[e.label] = { w: 0, g: 0 };
const reasons: Record<string, number> = {};
const rounds: number[] = [];
const resolveBy: Record<string, number> = {};
let breaks = 0, cardsLost = 0, surrenders = 0;
const t0 = Date.now();

for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const A = entries[i], B = entries[j];
    if (A.f === B.f) continue;
    let aw = 0;
    for (let g = 0; g < N; g++) {
      const swap = g % 2 === 1;
      const s = play(swap ? B : A, swap ? A : B, 1000 + g * 7919 + i * 31 + j * 131);
      const winLabel = s.winner === 0 ? (swap ? B : A).label : s.winner === 1 ? (swap ? A : B).label : 'draw';
      if (winLabel === A.label) { wins[A.label].w++; aw++; }
      if (winLabel === B.label) wins[B.label].w++;
      wins[A.label].g++; wins[B.label].g++;
      rounds.push(s.round);
      reasons[s.endReason] = (reasons[s.endReason] ?? 0) + 1;
      for (const [k, v] of Object.entries(s.stats.resolveBy)) resolveBy[k] = (resolveBy[k] ?? 0) + v;
      breaks += s.stats.breaks[0] + s.stats.breaks[1];
      cardsLost += s.stats.cardsLost[0] + s.stats.cardsLost[1];
      surrenders += s.stats.surrenders[0] + s.stats.surrenders[1];
      if (verbose && g === 0) console.log(s.log.join('\n'));
    }
    console.log(`${A.label.padEnd(18)} vs ${B.label.padEnd(18)} ${aw}-${N - aw}`);
  }
}
const G = rounds.length;
console.log(`\n${G} games in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('Win rate:');
for (const e of entries) console.log(`  ${e.label.padEnd(18)} ${((100 * wins[e.label].w) / Math.max(1, wins[e.label].g)).toFixed(1)}%`);
const hist: Record<number, number> = {};
for (const r of rounds) hist[r] = (hist[r] ?? 0) + 1;
console.log('Game length (round ended):', JSON.stringify(hist));
console.log('End reasons:', JSON.stringify(reasons));
console.log(`Per game: breaks ${(breaks / G).toFixed(1)}, cards destroyed ${(cardsLost / G).toFixed(1)}, surrenders ${(surrenders / G).toFixed(2)}`);
const totR = Object.values(resolveBy).reduce((a, b) => a + b, 0);
console.log('Resolve lost by source:', Object.entries(resolveBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / totR).toFixed(0)}%`).join(', '));
