// Rule ablation: switch off one mechanic at a time and measure FUN PROXIES, not balance.
// "Cut until it hurts" (Subset): a rule whose removal doesn't hurt these numbers doesn't earn its keep.
//   npx tsx scripts/ablate.ts [N=60] [--only=name]
import { writeFileSync } from 'node:fs';
import { Faction } from '../src/shared/cards';
import { tunedDeck } from '../src/shared/ai';
import { GameResult, Side } from '../src/sim/match';
import { Job, runJobs, startPool, stopPool } from '../src/sim/pool';

const argv = process.argv.slice(2);
const N = Number(argv.find((a) => /^\d+$/.test(a)) ?? 60);
const only = argv.find((a) => a.startsWith('--only='))?.slice(7);
const extra = argv.filter((a) => a.startsWith('--rule=') || a.startsWith('--cols='));

export const VARIANTS: [string, string[]][] = [
  ['baseline', []],
  ['+ stake doubler', ['--rule=laneStake=1']],
  ['+ stake bet ±1', ['--rule=laneStake=2']],
  ['+ stake transfer', ['--rule=laneStake=3']],
  ['no column hands/Edge', ['--rule=formations=false']],
  ['no flanking', ['--rule=flank=0', '--rule=flood=0']],
  ['no breach drain', ['--rule=breachDrain=0']],
  ['no cohesion regen', ['--rule=cohesionMax=0', '--rule=drilled=0']],
  ['no terrain', ['--rule=terrainColumns=-1']],
  ['no ambush bonus', ['--rule=ambush=0']],
  ['no rear-strike bonus', ['--rule=rear=0']],
  ['no underdog CP', ['--rule=underdogCp=0']],
  ['no escalation (stakes 1)', ['--rule=maxStakes=1']],
  ['5 columns', ['--cols=5']],
  ['STRIPPED (all dead rules off, no drain, 5 cols)', ['--cols=5', '--rule=formations=false', '--rule=flank=0', '--rule=flood=0', '--rule=breachDrain=0', '--rule=cohesionMax=0', '--rule=drilled=0', '--rule=terrainColumns=-1', '--rule=rear=0', '--rule=underdogCp=0', '--rule=maxStakes=1']],
  ['STRIPPED resolve 10', ['--resolve=10', '--cols=5', '--rule=formations=false', '--rule=flank=0', '--rule=flood=0', '--rule=breachDrain=0', '--rule=cohesionMax=0', '--rule=drilled=0', '--rule=terrainColumns=-1', '--rule=rear=0', '--rule=underdogCp=0', '--rule=maxStakes=1']],
  ['STRIPPED resolve 9', ['--resolve=9', '--cols=5', '--rule=formations=false', '--rule=flank=0', '--rule=flood=0', '--rule=breachDrain=0', '--rule=cohesionMax=0', '--rule=drilled=0', '--rule=terrainColumns=-1', '--rule=rear=0', '--rule=underdogCp=0', '--rule=maxStakes=1']],
  ['STRIPPED resolve 8', ['--resolve=8', '--cols=5', '--rule=formations=false', '--rule=flank=0', '--rule=flood=0', '--rule=breachDrain=0', '--rule=cohesionMax=0', '--rule=drilled=0', '--rule=terrainColumns=-1', '--rule=rear=0', '--rule=underdogCp=0', '--rule=maxStakes=1']],
  ['STRIPPED + 7 cols', ['--rule=formations=false', '--rule=flank=0', '--rule=flood=0', '--rule=breachDrain=0', '--rule=cohesionMax=0', '--rule=drilled=0', '--rule=terrainColumns=-1', '--rule=rear=0', '--rule=underdogCp=0', '--rule=maxStakes=1']],
];

const F: Faction[] = ['concord', 'brood', 'hush'];
const mk = (f: Faction, level: 'steel' | 'greedy'): Side => ({ f, label: f, deck: tunedDeck(f), ai: { level } });

interface Row { collapse: number; name: string; skill: number; lead: number; decided: number; close: number; obvious: number; comeback: number; len: number; morale: number; margin: number; spread: number }
const rows: Row[] = [];
for (const [name, flags] of VARIANTS) {
  if (only && name !== only) continue;
  startPool([...flags, ...extra]);
  // (a) steel vs steel, all cross-faction pairs, both seats
  const jobs: Job[] = [];
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) for (let g = 0; g < N; g++) {
    const A = mk(F[i], 'steel'), B = mk(F[j], 'steel'), seed = 9000 + g * 7919 + i * 31 + j * 131;
    jobs.push(g % 2 ? { a: B, b: A, seed } : { a: A, b: B, seed });
  }
  const res: GameResult[] = await runJobs(jobs);
  // (b) skill expression: steel vs greedy, same decks, all faction pairs incl. mirrors
  const sk: Job[] = [];
  for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) for (let g = 0; g < N / 2; g++) {
    const steelFirst = g % 2 === 0, seed = 7000 + g * 7919 + i * 31 + j * 131;
    sk.push({ a: mk(F[i], steelFirst ? 'steel' : 'greedy'), b: mk(F[j], steelFirst ? 'greedy' : 'steel'), seed });
  }
  const skr = await runJobs(sk);
  stopPool();
  let sw = 0, sd = 0;
  skr.forEach((r, k) => { if (r.winner === 0 || r.winner === 1) { sd++; if (sk[k][r.winner === 0 ? 'a' : 'b'].ai.level === 'steel') sw++; } });
  const dec = res.reduce((a, r) => ({ d: a.d + r.dec.decisions, c: a.c + r.dec.close, o: a.o + r.dec.obvious }), { d: 0, c: 0, o: 0 });
  let cbC = 0, cb = 0, mor = 0, tot = 0;
  const fw: Record<string, number> = { concord: 0, brood: 0, hush: 0 };
  res.forEach((r, k) => {
    if ((r.winner === 0 || r.winner === 1) && r.behindAtR4 !== -1) { cbC++; if (r.winner === r.behindAtR4) cb++; }
    if (r.winner === 0 || r.winner === 1) fw[jobs[k][r.winner === 0 ? 'a' : 'b'].f]++;
    for (const [x, v] of Object.entries(r.resolveBy)) { tot += v; if (x === 'morale') mor += v; }
  });
  const avg = (f: (r: GameResult) => number) => res.reduce((a, r) => a + f(r), 0) / res.length;
  const wr = Object.values(fw).map((w) => w / (2 * N));
  const row: Row = {
    collapse: res.filter((r) => !r.endReason.startsWith('time')).length / res.length,
    name, skill: sw / sd, lead: avg((r) => r.leadChanges), decided: avg((r) => r.decidedRound),
    close: dec.c / dec.d, obvious: dec.o / dec.d, comeback: cb / Math.max(1, cbC), len: avg((r) => r.round),
    morale: mor / Math.max(1, tot), margin: avg((r) => r.margin), spread: Math.max(...wr) - Math.min(...wr),
  };
  rows.push(row);
  console.log(fmt(row));
}
function fmt(r: Row) {
  const p = (x: number) => `${(100 * x).toFixed(0)}%`.padStart(5);
  return `${r.name.padEnd(26)} skill ${p(r.skill)}  leadΔ ${r.lead.toFixed(2)}  decided R${r.decided.toFixed(1)}  close ${p(r.close)}  obvious ${p(r.obvious)}  comeback ${p(r.comeback)}  collapse ${p(r.collapse)}  len ${r.len.toFixed(1)}  morale ${p(r.morale)}  margin ${r.margin.toFixed(1)}  faction spread ${p(r.spread)}`;
}
writeFileSync('docs/ablation-last-run.txt', rows.map(fmt).join('\n') + '\n');
