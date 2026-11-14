// Self-play tuner: every deck gets its own strategy (evaluation weights) and its own
// deck list, each hill-climbed against the field of other factions' current best.
// Steelman vs steelman: no deck is balanced against a strawman.
//   npx tsx scripts/tune.ts [--phase=weights|decks|both] [--iters=12] [--games=12] [--only=brood/tide]
import { readFileSync, writeFileSync } from 'node:fs';
import { CARDS, FACTION_INFO, Faction, starterDeck } from '../src/shared/cards';
import { AiWeights, DEFAULT_WEIGHTS } from '../src/shared/ai';
import { applyFlags } from '../src/sim/flags';
import { Side } from '../src/sim/match';
import { runJobs, stopPool } from '../src/sim/pool';

const argv = process.argv.slice(2);
applyFlags(argv);
const opt = (k: string, d: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const phase = opt('phase', 'both');
const ITERS = Number(opt('iters', '12'));
const GPO = Number(opt('games', '12'));   // games per opponent per evaluation
const only = opt('only', '');
const PATH = 'src/shared/ai-profiles.json';
const DECK_SIZE = 20, MAX_COPIES = 2, MIN_ARCH = 10;

type Profile = { weights: AiWeights; deck: string[] };
interface Entry { f: Faction; arch?: string; label: string }
const FACTIONS: Faction[] = ['concord', 'brood', 'hush'];
const entries: Entry[] = FACTIONS.flatMap((f) => [...Object.keys(FACTION_INFO[f].archetypes).map((a) => ({ f, arch: a as string | undefined, label: `${f}/${a}` })), { f, arch: undefined, label: `${f}/balanced` }]);

const saved = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, Partial<Profile>>;
const prof: Record<string, Profile> = {};
for (const e of entries) prof[e.label] = {
  weights: { ...DEFAULT_WEIGHTS, ...saved[e.label]?.weights },
  deck: saved[e.label]?.deck ?? starterDeck(e.f, e.arch),
};
const save = () => {
  const out: Record<string, Profile> = {};
  for (const e of entries) {
    const w: Partial<AiWeights> = {};
    for (const [k, v] of Object.entries(prof[e.label].weights)) w[k as keyof AiWeights] = Math.round(v * 100) / 100;
    out[e.label] = { weights: w as AiWeights, deck: [...prof[e.label].deck].sort() };
  }
  writeFileSync(PATH, JSON.stringify(out, null, 1) + '\n');
};

const side = (e: Entry, p: Profile): Side => ({ f: e.f, label: e.label, deck: p.deck, ai: { level: 'steel', weights: p.weights } });

/** Win rate of entry e playing profile p against every other-faction entry's current profile (paired seeds). */
async function score(e: Entry, p: Profile, gpo = GPO, seedBase = 0): Promise<number> {
  const jobs = [], meIsA: boolean[] = [];
  for (const o of entries) {
    if (o.f === e.f) continue;
    for (let g = 0; g < gpo; g++) {
      const me = side(e, p), them = side(o, prof[o.label]);
      const seed = 50_000 + seedBase + g * 7919 + o.label.length * 131 + entries.indexOf(o) * 977;
      jobs.push(g % 2 ? { a: them, b: me, seed } : { a: me, b: them, seed });
      meIsA.push(g % 2 === 0);
    }
  }
  const res = await runJobs(jobs);
  let w = 0;
  res.forEach((r, k) => { if (r.winner === (meIsA[k] ? 0 : 1)) w++; }); // (parity of k only matched the seat when gpo was even)
  return w / res.length;
}

let rngState = 12345;
// Math.imul: the plain product exceeds 2^53 and lost its low bits.
const rnd = () => { rngState = (Math.imul(rngState, 1103515245) + 12345) & 0x7fffffff; return rngState / 0x7fffffff; };

function mutateWeights(w: AiWeights): AiWeights {
  const n = { ...w };
  const keys = Object.keys(n) as (keyof AiWeights)[];
  const k = keys[Math.floor(rnd() * keys.length)];
  if (k === 'reply') n.reply = Math.min(1, Math.max(0, n.reply + (rnd() < 0.5 ? -0.2 : 0.2)));
  else if (k === 'hand' || k === 'tactic') n[k] = n[k] + (rnd() < 0.5 ? -1.5 : 1.5);
  else n[k] = n[k] * Math.exp(rnd() < 0.5 ? -0.4 : 0.4);
  return n;
}

function mutateDeck(e: Entry, deck: string[]): string[] | null {
  const pool = CARDS.filter((d) => d.faction === e.f && d.cls !== 'HQ');
  for (let tries = 0; tries < 50; tries++) {
    const d = [...deck];
    d.splice(Math.floor(rnd() * d.length), 1);
    const add = pool[Math.floor(rnd() * pool.length)].id;
    if (d.filter((x) => x === add).length >= MAX_COPIES) continue;
    d.push(add);
    if (e.arch && d.filter((x) => pool.find((c) => c.id === x)!.arch.includes(e.arch!)).length < MIN_ARCH) continue;
    if (d.length === DECK_SIZE && d.sort().join() !== [...deck].sort().join()) return d;
  }
  return null;
}

const t0 = Date.now();
const log: string[] = [];
for (const ph of phase === 'both' ? ['weights', 'decks'] : [phase]) {
  for (const e of entries) {
    if (only && e.label !== only) continue;
    const start = { ...prof[e.label], weights: { ...prof[e.label].weights }, deck: [...prof[e.label].deck] };
    let inc = await score(e, prof[e.label]);
    const before = inc;
    for (let it = 0; it < ITERS; it++) {
      const cand: Profile = ph === 'weights'
        ? { ...prof[e.label], weights: mutateWeights(prof[e.label].weights) }
        : { ...prof[e.label], deck: mutateDeck(e, prof[e.label].deck) ?? prof[e.label].deck };
      const sc = await score(e, cand);
      if (sc > inc) { prof[e.label] = cand; inc = sc; }
    }
    // Re-validate on fresh seeds with double the games; keep only real improvements.
    const vNew = await score(e, prof[e.label], GPO * 2, 333_333);
    const vOld = await score(e, start, GPO * 2, 333_333);
    const kept = vNew > vOld;
    if (!kept) prof[e.label] = start;
    const line = `${ph.padEnd(7)} ${e.label.padEnd(18)} train ${(100 * before).toFixed(0)}→${(100 * inc).toFixed(0)}  validate ${(100 * vOld).toFixed(0)}→${(100 * vNew).toFixed(0)}  ${kept ? 'KEPT' : 'reverted'}  (${((Date.now() - t0) / 60000).toFixed(1)} min)`;
    console.log(line); log.push(line);
    save();
  }
}
stopPool();
writeFileSync('docs/tune-last-run.txt', log.join('\n') + '\n');
