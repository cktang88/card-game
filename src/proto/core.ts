// Prototype core for the converged concept skeleton (docs/concepts/JUDGEMENT.md).
// Vanilla cards only: the digital equivalent of a paper test. Two resolution models:
//   'pressure' (pitch B): units aim Power at the first enemy in their lane; Pressure ≥ Nerve routs,
//              ≥ 2×Nerve kills quietly; each rout panics neighbours (+1 Pressure) and exposes the unit behind.
//   'clash'    (pitch C): lane totals compared; loser's front unit is Shaken (margin 1–2), Routs if
//              already Shaken, or is Destroyed quietly (margin 3+). Routs shake neighbours. Win a lane to Rally.
// Shared: 3 lanes × Front/Rear per side, hidden simultaneous placement, stacking, units never move.

export type Mode = 'pressure' | 'clash';
export interface ProtoRules {
  mode: Mode;
  rounds: number;
  lanes: number;
  cascade: boolean;      // routs spread panic to neighbours
  quietKills: boolean;   // overkill destroys instead of routing (no panic, B: not a rout marker? still a marker)
  stake: boolean;        // secret Stake on one lane (clash: loser's front routs outright; pressure: removals there count double)
  press: boolean;        // pressure: Press twice per game (+1 Power, own routs count double)
  rally: boolean;        // pressure: +1 Command next round per unit lost; clash: Rally Shaken units in won lanes
  comeback: boolean;     // clash: +1 Supply per rout deficit; pressure: Cornered (+1 Nerve at breakAt−1)
  breakAt: number;       // markers/routs to lose
  rankSupport: boolean;  // pressure: only Front units strike; a Rear unit adds its Nerve to the Front in its lane
  shields: boolean;      // clash: a reinforced unit absorbs a hit by discarding the reinforcer
  nerveBonus?: number;   // deck tweak: +N Nerve on every vanilla card
}
export const DEFAULT_RULES: Record<Mode, ProtoRules> = {
  pressure: { mode: 'pressure', rounds: 5, lanes: 3, cascade: true, quietKills: true, stake: false, press: true, rally: true, comeback: true, breakAt: 4, rankSupport: false, shields: true },
  clash: { mode: 'clash', rounds: 5, lanes: 3, cascade: true, quietKills: true, stake: true, press: false, rally: true, comeback: true, breakAt: 3, rankSupport: false, shields: true },
};

export interface PCard { id: number; cost: number; power: number; nerve: number }
export interface PUnit { cards: PCard[]; power: number; nerve: number; shaken: boolean; shields: number }
export type Side = 0 | 1;
export interface PState {
  r: ProtoRules; round: number; rng: number;
  board: (PUnit | null)[][][];   // [side][row 0=Front,1=Rear][lane]
  hand: PCard[][]; deck: PCard[][];
  markers: [number, number];     // pressure: break markers; clash: routs suffered
  bonusCmd: [number, number];
  pressesLeft: [number, number];
  winner: null | -1 | Side; log: string[];
  stats: { routs: number; kills: number; maxWave: number; stakeHits: number };
}
export interface Place { card: number; row: 0 | 1; lane: number }
export interface POrders { places: Place[]; stake: number; press: boolean } // stake −1 = none

// ── decks: vanilla stat lines ──
export function vanillaDeck(mode: Mode): Omit<PCard, 'id'>[] {
  const L: [number, number, number, number][] = mode === 'pressure'
    ? [[1, 2, 1, 3], [1, 1, 2, 3], [2, 3, 2, 2], [2, 2, 3, 3], [2, 1, 4, 2], [2, 4, 1, 1], [3, 3, 4, 2], [3, 4, 2, 2], [3, 2, 5, 2]]
    : [[1, 1, 1, 5], [2, 2, 2, 6], [3, 3, 3, 5], [4, 4, 4, 4]];
  return L.flatMap(([cost, power, nerve, n]) => Array.from({ length: n }, () => ({ cost, power, nerve })));
}

export function rand(s: PState) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(s: PState, a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

export function newProto(r: ProtoRules, seed: number): PState {
  const s: PState = {
    r, round: 1, rng: seed, board: [0, 1].map(() => [0, 1].map(() => Array(r.lanes).fill(null))) as PState['board'],
    hand: [[], []], deck: [[], []], markers: [0, 0], bonusCmd: [0, 0], pressesLeft: [2, 2], winner: null, log: [],
    stats: { routs: 0, kills: 0, maxWave: 0, stakeHits: 0 },
  };
  let id = 1;
  for (const p of [0, 1] as Side[]) { s.deck[p] = vanillaDeck(r.mode).map((c) => ({ ...c, nerve: c.nerve + (r.nerveBonus ?? 0), id: id++ })); shuffle(s, s.deck[p]); }
  drawUp(s);
  return s;
}
function drawUp(s: PState) { for (const p of [0, 1] as Side[]) while (s.hand[p].length < 5 && s.deck[p].length) s.hand[p].push(s.deck[p].pop()!); }

export function supply(s: PState, p: Side): number {
  const base = s.r.mode === 'pressure' ? 3 : s.round + 2;
  return base + s.bonusCmd[p];
}

/** All own targets for one card: empty slots (Rear needs nothing) or stacking onto an own unit. */
export function targets(s: PState, p: Side, used: Set<string>): { row: 0 | 1; lane: number }[] {
  const out: { row: 0 | 1; lane: number }[] = [];
  for (const row of [0, 1] as const) for (let lane = 0; lane < s.r.lanes; lane++) {
    const k = `${row}${lane}`;
    if (used.has(k)) continue;
    const u = s.board[p][row][lane];
    if (!u || u.cards.length < 3) out.push({ row, lane });
  }
  return out;
}

const clone = (s: PState): PState => ({
  ...s, log: [], stats: { ...s.stats }, markers: [...s.markers] as [number, number], bonusCmd: [...s.bonusCmd] as [number, number],
  pressesLeft: [...s.pressesLeft] as [number, number], hand: [s.hand[0].slice(), s.hand[1].slice()], deck: [s.deck[0].slice(), s.deck[1].slice()],
  board: s.board.map((side) => side.map((row) => row.map((u) => (u ? { ...u, cards: u.cards.slice() } : null)))) as PState['board'],
});

/** Resolve a round on a COPY (or in place if inPlace). Returns the new state. */
export function resolve(s0: PState, orders: [POrders, POrders], inPlace = false): PState {
  const s = inPlace ? s0 : clone(s0);
  const r = s.r;
  const stakeCost = [0, 0];
  // ── placement ──
  for (const p of [0, 1] as Side[]) {
    let cmd = supply(s, p);
    const o = orders[p];
    if (r.mode === 'clash' && r.stake && o.stake >= 0 && r.comeback && s.markers[1 - p] > s.markers[p]) stakeCost[p] = 1; // leader's Stake costs 1
    cmd -= stakeCost[p];
    for (const pl of o.places) {
      const i = s.hand[p].findIndex((c) => c.id === pl.card);
      if (i < 0) continue;
      const c = s.hand[p][i];
      if (c.cost > cmd) continue;
      const u = s.board[p][pl.row][pl.lane];
      if (u && u.cards.length >= 3) continue;
      cmd -= c.cost; s.hand[p].splice(i, 1);
      if (!u) s.board[p][pl.row][pl.lane] = { cards: [c], power: c.power, nerve: c.nerve, shaken: false, shields: 0 };
      else if (r.mode === 'pressure') { u.cards.push(c); u.nerve += c.nerve; }        // stacking adds Nerve
      else { u.cards.push(c); u.power += c.power; u.nerve += c.nerve; if (r.shields) u.shields++; } // clash: adds Value (+ absorbs a hit)
    }
    s.bonusCmd[p] = 0;
  }
  const press = [0, 1].map((p) => r.press && orders[p].press && s.pressesLeft[p] > 0) as [boolean, boolean];
  for (const p of [0, 1] as Side[]) if (press[p]) s.pressesLeft[p]--;
  const lost = [0, 0];
  if (r.mode === 'pressure') resolvePressure(s, press, orders, lost);
  else resolveClash(s, orders, lost);
  // ── end of round ──
  if (r.rally && r.mode === 'pressure') for (const p of [0, 1] as Side[]) s.bonusCmd[p] = lost[p];
  if (r.comeback && r.mode === 'clash') for (const p of [0, 1] as Side[]) s.bonusCmd[p] = Math.max(0, s.markers[p] - s.markers[1 - p]);
  const b0 = s.markers[0] >= r.breakAt, b1 = s.markers[1] >= r.breakAt;
  if (b0 || b1) s.winner = b0 && b1 ? (s.markers[0] === s.markers[1] ? -1 : s.markers[0] > s.markers[1] ? 1 : 0) : b0 ? 1 : 0;
  else if (s.round >= r.rounds) {
    if (s.markers[0] !== s.markers[1]) s.winner = s.markers[0] > s.markers[1] ? 1 : 0;
    else {
      const sh = [0, 1].map((p) => s.board[p].flat().filter((u) => u?.shaken).length);
      s.winner = sh[0] === sh[1] ? -1 : sh[0] > sh[1] ? 1 : 0;
    }
  }
  if (s.winner === null) { s.round++; drawUp(s); }
  return s;
}

function neighbours(s: PState, row: number, lane: number): [number, number][] {
  const n: [number, number][] = [[1 - row, lane]];
  if (lane > 0) n.push([row, lane - 1]);
  if (lane < s.r.lanes - 1) n.push([row, lane + 1]);
  return n;
}

function resolvePressure(s: PState, press: [boolean, boolean], orders: [POrders, POrders], lost: number[]) {
  const r = s.r;
  const pr: number[][][] = [0, 1].map(() => [0, 1].map(() => Array(r.lanes).fill(0)));
  const firstEnemy = (e: Side, lane: number): 0 | 1 | -1 => (s.board[e][0][lane] ? 0 : s.board[e][1][lane] ? 1 : -1);
  for (const p of [0, 1] as Side[]) {
    const e = (1 - p) as Side;
    for (const row of [0, 1]) for (let lane = 0; lane < r.lanes; lane++) {
      const u = s.board[p][row][lane];
      if (!u || (r.rankSupport && row === 1)) continue;
      const pow = u.power + (press[p] ? 1 : 0);
      let tl = lane, bonus = 0, tr = firstEnemy(e, lane);
      if (tr < 0) { // flank the nearest occupied enemy lane (+1)
        for (const d of [1, 2, 3]) {
          const cand = [lane - d, lane + d].filter((x) => x >= 0 && x < r.lanes && firstEnemy(e, x) >= 0);
          if (cand.length) { tl = cand[0]; tr = firstEnemy(e, tl); bonus = 1; break; }
        }
      }
      if (tr >= 0) pr[e][tr][tl] += pow + bonus;
    }
  }
  const cornered = (p: number) => (r.comeback && s.markers[p] >= r.breakAt - 1 ? 1 : 0);
  const removed = new Set<string>();
  let wave = 0;
  for (;;) {
    const now: [Side, number, number, boolean][] = [];
    for (const p of [0, 1] as Side[]) for (const row of [0, 1]) for (let lane = 0; lane < r.lanes; lane++) {
      const u = s.board[p][row][lane];
      if (!u || removed.has(`${p}${row}${lane}`)) continue;
      const behind = row === 0 && !removed.has(`${p}1${lane}`) ? s.board[p][1][lane] : null;
      const nv = u.nerve + cornered(p) + (r.rankSupport && behind ? behind.nerve : 0);
      if (pr[p][row][lane] >= nv) now.push([p, row, lane, r.quietKills && pr[p][row][lane] >= 2 * nv]);
    }
    if (!now.length) break;
    wave++;
    for (const [p, row, lane, killed] of now) {
      removed.add(`${p}${row}${lane}`);
      const staked = r.stake && (orders[0].stake === lane || orders[1].stake === lane);
      const m = (!killed && press[p] ? 2 : 1) * (staked ? 2 : 1);
      if (staked) s.stats.stakeHits++;
      s.markers[p] += m; lost[p]++;
      if (killed) { s.stats.kills++; s.log.push(`P${p} ${row ? 'Rear' : 'Front'}${lane} slain`); continue; }
      s.stats.routs++;
      s.log.push(`P${p} ${row ? 'Rear' : 'Front'}${lane} ROUTS (pressure ${pr[p][row][lane]})`);
      if (r.cascade) for (const [nr, nl] of neighbours(s, row, lane)) if (s.board[p][nr][nl]) pr[p][nr][nl] += 1;
      if (row === 0 && s.board[p][1][lane]) pr[p][1][lane] += pr[p][0][lane]; // exposed
    }
  }
  s.stats.maxWave = Math.max(s.stats.maxWave, wave);
  for (const k of removed) { const [p, row, lane] = [...k].map(Number); s.board[p][row][lane] = null; }
}

function resolveClash(s: PState, orders: [POrders, POrders], lost: number[]) {
  const r = s.r;
  const val = (p: number, lane: number) => (s.board[p][0][lane]?.power ?? 0) + (s.board[p][1][lane]?.power ?? 0);
  const routQ: [number, number, number][] = [];
  const won: boolean[][] = [[], []];
  const hit = (p: number, row: number, lane: number, kind: 'shake' | 'rout' | 'destroy') => {
    const u = s.board[p][row][lane];
    if (!u) return;
    if (kind === 'destroy') { s.board[p][row][lane] = null; s.stats.kills++; s.log.push(`P${p} ${row ? 'Rear' : 'Front'}${lane} destroyed`); return; }
    if (u.shields > 0) { u.shields--; const c = u.cards.pop()!; u.power -= c.power; u.nerve -= c.nerve; s.log.push(`P${p} ${row ? 'Rear' : 'Front'}${lane} hit absorbed by reinforcement`); return; }
    if (kind === 'rout' || u.shaken) routQ.push([p, row, lane]); else { u.shaken = true; s.log.push(`P${p} ${row ? 'Rear' : 'Front'}${lane} shaken`); }
  };
  for (let lane = 0; lane < r.lanes; lane++) {
    const v0 = val(0, lane), v1 = val(1, lane);
    s.log.push(`  lane ${lane}: ${v0} vs ${v1}${r.stake && (orders[0].stake === lane || orders[1].stake === lane) ? ' (staked)' : ''}`);
    if (v0 === v1) continue;
    const w = v0 > v1 ? 0 : 1, l = 1 - w, m = Math.abs(v0 - v1);
    won[w][lane] = true;
    const row = s.board[l][0][lane] ? 0 : s.board[l][1][lane] ? 1 : -1;
    if (row < 0) continue;
    const staked = r.stake && (orders[0].stake === lane || orders[1].stake === lane);
    if (staked) { s.stats.stakeHits++; hit(l, row, lane, 'rout'); }
    else if (r.quietKills && m >= 3) hit(l, row, lane, 'destroy');
    else hit(l, row, lane, 'shake');
  }
  let wave = 0;
  while (routQ.length) {
    wave++;
    const batch = routQ.splice(0);
    for (const [p, row, lane] of batch) {
      if (!s.board[p][row][lane]) continue;
      s.board[p][row][lane] = null; s.markers[p]++; lost[p]++; s.stats.routs++;
      s.log.push(`P${p} ${row ? 'Rear' : 'Front'}${lane} ROUTS`);
      if (r.cascade) for (const [nr, nl] of neighbours(s, row, lane)) hit(p, nr, nl, 'shake');
    }
  }
  s.stats.maxWave = Math.max(s.stats.maxWave, wave);
  if (r.rally) for (const p of [0, 1]) for (let lane = 0; lane < r.lanes; lane++) if (won[p][lane]) for (const row of [0, 1]) { const u = s.board[p][row][lane]; if (u) u.shaken = false; }
}
