// Headless AI-vs-AI simulation for balance & pacing (parallel over all cores).
//   npm run sim -- [gamesPerMatchup=20] [--arch] [--cards] [--verbose]
//   --ai=steel|greedy   AI level for both sides (default steel = steelman, see DESIGN_PROCESS §3)
//   --starter           use hand-built starter decks instead of tuned profile decks
//   --h2h               AI check: steel vs greedy with identical decks; prints steel's win rate
//   --cols=N --no-formations --resolve=N --rule=k=v --stat=faction[:Class].field±N --tactic-bonus=N
import { FACTION_INFO, Faction, starterDeck } from '../shared/cards';
import { PlayerId } from '../shared/engine';
import { AI_PROFILES, AiOptions } from '../shared/ai';
import { applyFlags } from './flags';
import { GameResult, Side } from './match';
import { Job, runJobs, stopPool } from './pool';

const argv = process.argv.slice(2);
applyFlags(argv);
const N = Number(argv.find((a) => /^\d+$/.test(a)) ?? 20);
const byArch = argv.includes('--arch');
const verbose = argv.includes('--verbose');
const h2h = argv.includes('--h2h');
const level = (argv.find((a) => a.startsWith('--ai='))?.slice(5) ?? 'steel') as 'steel' | 'greedy';
const useProfiles = !argv.includes('--starter');
const FACTIONS: Faction[] = ['concord', 'brood', 'hush'];

interface Entry { f: Faction; arch?: string; label: string }
const entries: Entry[] = byArch
  ? FACTIONS.flatMap((f) => [...Object.keys(FACTION_INFO[f].archetypes).map((a) => ({ f, arch: a as string | undefined, label: `${f}/${a}` })), { f, arch: undefined, label: `${f}/balanced` }])
  : FACTIONS.map((f) => ({ f, label: f }));

export function deckFor(e: Entry): string[] {
  const label = e.arch ? e.label : `${e.f}/balanced`;
  return (useProfiles && AI_PROFILES[label]?.deck) || starterDeck(e.f, e.arch);
}
function side(e: Entry, lv: 'steel' | 'greedy'): Side {
  const profile = e.arch ? e.label : `${e.f}/balanced`;
  const ai: AiOptions = { level: lv, profile: useProfiles && lv === 'steel' ? profile : undefined };
  return { f: e.f, label: e.label, deck: deckFor(e), ai };
}

const t0 = Date.now();
// ── build all jobs ──
interface Meta { A: Entry; B: Entry; swap: boolean; i: number; j: number; g: number }
const jobs: Job[] = [], meta: Meta[] = [];
for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
  const A = entries[i], B = entries[j];
  if (A.f === B.f && !h2h) continue;
  for (let g = 0; g < N; g++) {
    const swap = g % 2 === 1;
    const sa = side(A, level), sb = side(B, level);
    if (h2h) { // steel plays one side, greedy the other, alternating
      const steelIsA = g % 4 < 2;
      sa.ai = { ...sa.ai, level: steelIsA ? 'steel' : 'greedy', profile: undefined };
      sb.ai = { ...sb.ai, level: steelIsA ? 'greedy' : 'steel', profile: undefined };
    }
    jobs.push({ a: swap ? sb : sa, b: swap ? sa : sb, seed: 1000 + g * 7919 + i * 31 + j * 131, log: verbose && g === 0 });
    meta.push({ A, B, swap, i, j, g });
  }
}
const results: GameResult[] = await runJobs(jobs);
stopPool();

if (h2h) {
  let steelWins = 0, decided = 0;
  results.forEach((r, k) => {
    if (r.winner !== 0 && r.winner !== 1) return;
    decided++;
    if (jobs[k][r.winner === 0 ? 'a' : 'b'].ai.level === 'steel') steelWins++;
  });
  console.log(`steel vs greedy: steel wins ${((100 * steelWins) / decided).toFixed(1)}% of ${decided} decided games (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  process.exit(0);
}

// ── aggregate ──
const wins: Record<string, { w: number; g: number }> = {};
for (const e of entries) wins[e.label] = { w: 0, g: 0 };
const reasons: Record<string, number> = {}, resolveBy: Record<string, number> = {}, hist: Record<number, number> = {};
const pair: Record<string, number> = {};
const cardStats = new Map<string, { games: number; played: number; wins: number; roundSum: number }>();
let breaks = 0, cardsLost = 0, comebackChances = 0, comebacks = 0, seat0wins = 0, decided = 0;
results.forEach((r, k) => {
  const { A, B, swap } = meta[k];
  const ea = swap ? B : A, eb = swap ? A : B;
  const winLabel = r.winner === 0 ? ea.label : r.winner === 1 ? eb.label : 'draw';
  if (winLabel === A.label) { wins[A.label].w++; pair[`${A.label}|${B.label}`] = (pair[`${A.label}|${B.label}`] ?? 0) + 1; }
  if (winLabel === B.label) wins[B.label].w++;
  wins[A.label].g++; wins[B.label].g++;
  hist[r.round] = (hist[r.round] ?? 0) + 1;
  reasons[r.endReason] = (reasons[r.endReason] ?? 0) + 1;
  for (const [x, v] of Object.entries(r.resolveBy)) resolveBy[x] = (resolveBy[x] ?? 0) + v;
  breaks += r.breaks; cardsLost += r.destroyed;
  const decks = [deckFor(ea), deckFor(eb)];
  for (const p of [0, 1] as PlayerId[]) for (const id of new Set(decks[p])) {
    const st = cardStats.get(id) ?? { games: 0, played: 0, wins: 0, roundSum: 0 };
    st.games++;
    const rr = r.played[p][id];
    if (rr !== undefined) { st.played++; st.roundSum += rr; if (r.winner === p) st.wins++; }
    cardStats.set(id, st);
  }
  if (r.winner === 0 || r.winner === 1) {
    decided++; if (r.winner === 0) seat0wins++;
    if (r.behindAtR4 !== -1) { comebackChances++; if (r.winner === r.behindAtR4) comebacks++; }
  }
  if (r.log) console.log(r.log.join('\n'));
});
for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
  const A = entries[i], B = entries[j];
  if (A.f === B.f) continue;
  const aw = pair[`${A.label}|${B.label}`] ?? 0;
  console.log(`${A.label.padEnd(18)} vs ${B.label.padEnd(18)} ${aw}-${N - aw}`);
}
const G = results.length;
console.log(`\n${G} games in ${((Date.now() - t0) / 1000).toFixed(1)}s  (AI: ${level}, decks: ${useProfiles ? 'tuned profiles where available' : 'starter'})`);
console.log('Win rate:');
for (const e of entries) console.log(`  ${e.label.padEnd(18)} ${((100 * wins[e.label].w) / Math.max(1, wins[e.label].g)).toFixed(1)}%`);
console.log('Game length (round ended):', JSON.stringify(hist));
console.log('End reasons:', JSON.stringify(reasons));
console.log(`Per game: units broken ${(breaks / G).toFixed(1)}, cards destroyed ${(cardsLost / G).toFixed(1)}`);
const totR = Object.values(resolveBy).reduce((a, b) => a + b, 0);
console.log('Resolve lost by source:', Object.entries(resolveBy).sort((a, b) => b[1] - a[1]).map(([x, v]) => `${x} ${((100 * v) / totR).toFixed(0)}%`).join(', '));

// ── card report + exit criteria (docs/DESIGN_PROCESS.md §4) ──
if (argv.includes('--cards')) {
  console.log('\nPer-card (play% = played in games where it was in the deck; win% = win rate in games it was played):');
  const rows = [...cardStats.entries()].map(([id, st]) => ({ id, play: st.played / st.games, win: st.played ? st.wins / st.played : 0, rnd: st.played ? st.roundSum / st.played : 0, n: st.played }))
    .sort((a, b) => b.win - a.win);
  for (const r of rows) console.log(`  ${r.id.padEnd(14)} play ${(100 * r.play).toFixed(0).padStart(3)}%  win ${(100 * r.win).toFixed(0).padStart(3)}%  avg round ${r.rnd.toFixed(1)}  (n=${r.n})`);
}
const factionWR = Object.entries(wins).map(([x, v]) => [x, v.w / Math.max(1, v.g)] as const);
const lenOk = Object.entries(hist).filter(([r]) => Number(r) >= 6).reduce((a, [, n]) => a + n, 0) / G;
const morale = (resolveBy.morale ?? 0) / Math.max(1, totR);
const cb = comebacks / Math.max(1, comebackChances);
const seat = seat0wins / Math.max(1, decided);
const cardOutliers = [...cardStats.entries()].filter(([, st]) => st.played >= 150 && (st.wins / st.played < 0.35 || st.wins / st.played > 0.65)).map(([id]) => id);
const deadCards = [...cardStats.entries()].filter(([, st]) => st.games >= 20 && st.played / st.games < 0.15).map(([id]) => id);
const crit = [
  ['Win rate per entry within 40–60%', factionWR.every(([, w]) => w >= 0.4 && w <= 0.6), factionWR.map(([x, w]) => `${x} ${(100 * w).toFixed(0)}`).join(', ')],
  ['≥ 80% of games last 6+ rounds', lenOk >= 0.8, `${(100 * lenOk).toFixed(0)}%`],
  ['Morale ≥ 50% of Resolve lost', morale >= 0.5, `${(100 * morale).toFixed(0)}%`],
  ['Comeback (behind after R4 → wins) ≥ 25%', cb >= 0.25, `${(100 * cb).toFixed(0)}% of ${comebackChances}`],
  ['Seat advantage within 45–55%', seat >= 0.45 && seat <= 0.55, `seat 0 wins ${(100 * seat).toFixed(0)}%`],
  ['No card with win-when-played outside 35–65% (n ≥ 150)', cardOutliers.length === 0, cardOutliers.join(', ') || 'none'],
  ['No dead card (played in < 15% of games)', deadCards.length === 0, deadCards.join(', ') || 'none'],
] as const;
console.log('\nExit criteria:');
for (const [name, ok, val] of crit) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${val}`);
