// Headless AI-vs-AI simulation for balance & pacing.
//   npm run sim -- [gamesPerMatchup=20] [--arch] [--verbose]
import { FACTION_INFO, Faction, starterDeck } from '../shared/cards';
import { GameState, PlayerId, RULES, apply, newGame, setCols } from '../shared/engine';
import { AI_TUNING, aiOrders, aiWantsRetreat } from '../shared/ai';
const tbArg = process.argv.find((a) => a.startsWith('--tactic-bonus='));
if (tbArg) AI_TUNING.tacticBonus = Number(tbArg.split('=')[1]);

const N = Number(process.argv[2] ?? 20);
const byArch = process.argv.includes('--arch');
const verbose = process.argv.includes('--verbose');
const colsArg = process.argv.find((a) => a.startsWith('--cols='));
if (colsArg) setCols(Number(colsArg.split('=')[1]));
if (process.argv.includes('--no-formations')) RULES.formations = false;
const resArg = process.argv.find((a) => a.startsWith('--resolve='));
if (resArg) RULES.startResolve = Number(resArg.split('=')[1]);
const FACTIONS: Faction[] = ['concord', 'brood', 'hush'];

interface Entry { f: Faction; arch?: string; label: string }
const entries: Entry[] = byArch
  ? FACTIONS.flatMap((f) => Object.keys(FACTION_INFO[f].archetypes).map((a) => ({ f, arch: a, label: `${f}/${a}` })))
  : FACTIONS.map((f) => ({ f, label: f }));

// ── per-game telemetry (Mega Crit-style: per-card play rate, win-when-played, round played) ──
interface Telemetry { played: [Map<string, number>, Map<string, number>]; behindAtR4: -1 | PlayerId }
let tele: Telemetry;

function play(a: Entry, b: Entry, seed: number): GameState {
  const s = newGame(a.f, b.f, seed, [starterDeck(a.f, a.arch), starterDeck(b.f, b.arch)]);
  tele = { played: [new Map(), new Map()], behindAtR4: -1 };
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 50) {
    if (s.round === 5 && tele.behindAtR4 === -1) {
      const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
      if (r0 !== r1) tele.behindAtR4 = r0 < r1 ? 0 : 1;
    }
    for (const p of [0, 1] as PlayerId[]) {
      if ((s.phase as string) === 'over') break;
      if (aiWantsRetreat(s, p)) { apply(s, { type: 'retreat', player: p }); break; }
      const o = aiOrders(s, p, { candidates: 5 });
      for (const d of o.deploys) {
        const id = s.players[p].hand.find((h) => h.uid === d.uid)?.id;
        if (id && !tele.played[p].has(id)) tele.played[p].set(id, s.round);
      }
      const err = apply(s, { type: 'orders', player: p, orders: o });
      if (err) throw new Error('orders: ' + err);
    }
  }
  return s;
}

const cardStats = new Map<string, { games: number; played: number; wins: number; roundSum: number }>();
let comebackChances = 0, comebacks = 0, seat0wins = 0, decided = 0;
function record(s: GameState, decks: [string[], string[]]) {
  for (const p of [0, 1] as PlayerId[]) {
    for (const id of new Set(decks[p])) {
      const st = cardStats.get(id) ?? { games: 0, played: 0, wins: 0, roundSum: 0 };
      st.games++;
      const r = tele.played[p].get(id);
      if (r !== undefined) { st.played++; st.roundSum += r; if (s.winner === p) st.wins++; }
      cardStats.set(id, st);
    }
  }
  if (s.winner === 0 || s.winner === 1) {
    decided++; if (s.winner === 0) seat0wins++;
    if (tele.behindAtR4 !== -1) { comebackChances++; if (s.winner === tele.behindAtR4) comebacks++; }
  }
}

const wins: Record<string, { w: number; g: number }> = {};
for (const e of entries) wins[e.label] = { w: 0, g: 0 };
const reasons: Record<string, number> = {};
const rounds: number[] = [];
const resolveBy: Record<string, number> = {};
let breaks = 0, cardsLost = 0;
const t0 = Date.now();

for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const A = entries[i], B = entries[j];
    if (A.f === B.f) continue;
    let aw = 0;
    for (let g = 0; g < N; g++) {
      const swap = g % 2 === 1;
      const ea = swap ? B : A, eb = swap ? A : B;
      const s = play(ea, eb, 1000 + g * 7919 + i * 31 + j * 131);
      record(s, [starterDeck(ea.f, ea.arch), starterDeck(eb.f, eb.arch)]);
      const winLabel = s.winner === 0 ? (swap ? B : A).label : s.winner === 1 ? (swap ? A : B).label : 'draw';
      if (winLabel === A.label) { wins[A.label].w++; aw++; }
      if (winLabel === B.label) wins[B.label].w++;
      wins[A.label].g++; wins[B.label].g++;
      rounds.push(s.round);
      reasons[s.endReason] = (reasons[s.endReason] ?? 0) + 1;
      for (const [k, v] of Object.entries(s.stats.resolveBy)) resolveBy[k] = (resolveBy[k] ?? 0) + v;
      breaks += s.stats.breaks[0] + s.stats.breaks[1];
      cardsLost += s.stats.destroyed[0] + s.stats.destroyed[1];
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
console.log(`Per game: units broken ${(breaks / G).toFixed(1)}, cards destroyed ${(cardsLost / G).toFixed(1)}`);
const totR = Object.values(resolveBy).reduce((a, b) => a + b, 0);
console.log('Resolve lost by source:', Object.entries(resolveBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / totR).toFixed(0)}%`).join(', '));

// ── card report + exit criteria (docs/DESIGN_PROCESS.md §4) ──
if (process.argv.includes('--cards')) {
  console.log('\nPer-card (play% = played in games where it was in the deck; win% = win rate in games it was played):');
  const rows = [...cardStats.entries()].map(([id, st]) => ({ id, play: st.played / st.games, win: st.played ? st.wins / st.played : 0, rnd: st.played ? st.roundSum / st.played : 0, n: st.played }))
    .sort((a, b) => b.win - a.win);
  for (const r of rows) console.log(`  ${r.id.padEnd(14)} play ${(100 * r.play).toFixed(0).padStart(3)}%  win ${(100 * r.win).toFixed(0).padStart(3)}%  avg round ${r.rnd.toFixed(1)}  (n=${r.n})`);
}
const factionWR = Object.entries(wins).map(([k, v]) => [k, v.w / Math.max(1, v.g)] as const);
const lenOk = rounds.filter((r) => r >= 6).length / G;
const morale = (resolveBy.morale ?? 0) / Math.max(1, totR);
const cb = comebacks / Math.max(1, comebackChances);
const seat = seat0wins / Math.max(1, decided);
const cardOutliers = [...cardStats.entries()].filter(([, st]) => st.played >= 20 && (st.wins / st.played < 0.35 || st.wins / st.played > 0.65)).map(([id]) => id);
const deadCards = [...cardStats.entries()].filter(([, st]) => st.games >= 20 && st.played / st.games < 0.15).map(([id]) => id);
const crit = [
  ['Win rate per entry within 40–60%', factionWR.every(([, w]) => w >= 0.4 && w <= 0.6), factionWR.map(([k, w]) => `${k} ${(100 * w).toFixed(0)}`).join(', ')],
  ['≥ 80% of games last 6+ rounds', lenOk >= 0.8, `${(100 * lenOk).toFixed(0)}%`],
  ['Morale ≥ 50% of Resolve lost', morale >= 0.5, `${(100 * morale).toFixed(0)}%`],
  ['Comeback (behind after R4 → wins) ≥ 25%', cb >= 0.25, `${(100 * cb).toFixed(0)}% of ${comebackChances}`],
  ['Seat advantage within 45–55%', seat >= 0.45 && seat <= 0.55, `seat 0 wins ${(100 * seat).toFixed(0)}%`],
  ['No card with win-when-played outside 35–65%', cardOutliers.length === 0, cardOutliers.join(', ') || 'none'],
  ['No dead card (played in < 15% of games)', deadCards.length === 0, deadCards.join(', ') || 'none'],
] as const;
console.log('\nExit criteria:');
for (const [name, ok, val] of crit) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${val}`);
