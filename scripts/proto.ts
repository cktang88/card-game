// Compare prototype cores on fun proxies (steelman vs steelman), plus skill expression.
//   npx tsx scripts/proto.ts [N=100] [--only=name] [--log=name]
import { writeFileSync } from 'node:fs';
import { DEFAULT_RULES, ProtoRules } from '../src/proto/core';
import { ProtoJob, ProtoResult } from '../src/proto/match';
import { runJobs, startPool, stopPool } from '../src/sim/pool';

const argv = process.argv.slice(2);
const N = Number(argv.find((a) => /^\d+$/.test(a)) ?? 100);
const only = argv.find((a) => a.startsWith('--only='))?.slice(7);
const logName = argv.find((a) => a.startsWith('--log='))?.slice(6);
const P = DEFAULT_RULES.pressure, C = DEFAULT_RULES.clash;
const VARIANTS: [string, ProtoRules][] = [
  ['B pressure (as pitched)', P],
  ['B − cascade', { ...P, cascade: false }],
  ['B − press', { ...P, press: false }],
  ['B − press + lane stake', { ...P, press: false, stake: true }],
  ['B − rally/cornered', { ...P, rally: false, comeback: false }],
  ['B + rank support', { ...P, rankSupport: true }],
  ['B + nerve+1', { ...P, nerveBonus: 1 }],
  ['B + nerve+2', { ...P, nerveBonus: 2 }],
  ['B + rank support + nerve+1', { ...P, rankSupport: true, nerveBonus: 1 }],
  ['C clash (as pitched)', C],
  ['C − shields', { ...C, shields: false }],
  ['C − cascade', { ...C, cascade: false }],
  ['C − stake', { ...C, stake: false }],
  ['C − comeback', { ...C, comeback: false }],
  ['C − quiet kills', { ...C, quietKills: false }],
];
if (argv.includes('--sweepB')) {
  VARIANTS.length = 0;
  for (const breakAt of [6, 8]) for (const press of [false, true]) for (const nerveBonus of [0, 1])
    VARIANTS.push([`B break${breakAt}${press ? ' press' : ''} n+${nerveBonus}`, { ...P, breakAt, press, nerveBonus, rankSupport: true }]);
}
startPool([], undefined, '../proto/worker.ts');
const rows: string[] = [];
for (const [name, rules] of VARIANTS) {
  if (only && name !== only) continue;
  if (logName && name !== logName) continue;
  if (logName) {
    const [r] = await runJobs<ProtoJob, ProtoResult>([{ rules, levels: ['steel', 'steel'], seed: 4242, log: true }]);
    console.log(r.log!.join('\n'), '\nwinner', r.winner);
    continue;
  }
  const ss = await runJobs<ProtoJob, ProtoResult>(Array.from({ length: N }, (_, g) => ({ rules, levels: ['steel', 'steel'], seed: 100 + g * 7919 })));
  const sk = await runJobs<ProtoJob, ProtoResult>(Array.from({ length: N }, (_, g) => ({ rules, levels: g % 2 ? ['greedy', 'steel'] : ['steel', 'greedy'], seed: 200 + g * 7919 })));
  const sr = await runJobs<ProtoJob, ProtoResult>(Array.from({ length: N / 2 }, (_, g) => ({ rules, levels: g % 2 ? ['random', 'greedy'] : ['greedy', 'random'], seed: 300 + g * 7919 })));
  const wr = (rs: ProtoResult[], strong: number[]) => { let w = 0, d = 0; rs.forEach((r, i) => { if (r.winner === 0 || r.winner === 1) { d++; if (r.winner === strong[i]) w++; } }); return w / Math.max(1, d); };
  const avg = (f: (r: ProtoResult) => number) => ss.reduce((a, r) => a + f(r), 0) / ss.length;
  const dec = ss.reduce((a, r) => ({ d: a.d + r.dec.decisions, c: a.c + r.dec.close, o: a.o + r.dec.obvious }), { d: 0, c: 0, o: 0 });
  let cbC = 0, cb = 0; for (const r of ss) if ((r.winner === 0 || r.winner === 1) && r.behindMid !== -1) { cbC++; if (r.winner === r.behindMid) cb++; }
  const p = (x: number) => `${(100 * x).toFixed(0)}%`.padStart(4);
  const line = `${name.padEnd(26)} skill(steel>greedy) ${p(wr(sk, sk.map((_, i) => (i % 2 ? 1 : 0))))}  skill(greedy>random) ${p(wr(sr, sr.map((_, i) => (i % 2 ? 1 : 0))))}  leadΔ ${avg((r) => r.leadChanges).toFixed(2)}  decided ${(100 * avg((r) => r.decidedRound / r.rounds)).toFixed(0)}% of game  close ${p(dec.c / dec.d)}  obvious ${p(dec.o / dec.d)}  comeback ${p(cb / Math.max(1, cbC))}  draws ${p(ss.filter((r) => r.winner === -1).length / N)}  len ${avg((r) => r.rounds).toFixed(1)}  routs ${avg((r) => r.routs).toFixed(1)} kills ${avg((r) => r.kills).toFixed(1)}  longest chain ${avg((r) => r.maxWave).toFixed(1)}`;
  console.log(line); rows.push(line);
}
stopPool();
if (rows.length) writeFileSync('docs/concepts/proto-last-run.txt', rows.join('\n') + '\n');
