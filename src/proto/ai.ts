// Prototype bots. 'steel': samples the opponent's hidden hand, predicts their best reply,
// best-responds to a mix of (reply, pass). 'greedy': assumes the opponent passes. 'random': legal random.
import { POrders, PState, Side, resolve, supply, targets } from './core';

export interface PDecStats { decisions: number; close: number; obvious: number }

function mk(seed: number) {
  let t = seed | 0;
  return () => { t = (t + 0x6d2b79f5) | 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

export function evaluate(s: PState, p: Side): number {
  if (s.winner !== null) return s.winner === p ? 1000 : s.winner === -1 ? 0 : -1000;
  const e = (1 - p) as Side;
  let v = (s.markers[e] - s.markers[p]) * 10;
  for (const q of [0, 1] as Side[]) {
    const sg = q === p ? 1 : -1;
    for (const row of s.board[q]) for (const u of row) {
      if (!u) continue;
      v += sg * (s.r.mode === 'pressure' ? u.power + u.nerve * 0.7 : u.power * 1.5 - (u.shaken ? 3 : 0) + u.shields);
    }
    v += sg * s.hand[q].length * 0.5 + sg * s.bonusCmd[q] * 1.5;
  }
  return v;
}

/** Enumerate legal orders (sampled down to `cap`). */
export function candidates(s: PState, p: Side, rnd: () => number, cap: number): POrders[] {
  const out: POrders[] = [];
  const hand = s.hand[p];
  const cmd0 = supply(s, p);
  const rec = (i: number, cmd: number, used: Set<string>, places: POrders['places']) => {
    if (i === hand.length) { out.push({ places: places.slice(), stake: -1, press: false }); return; }
    rec(i + 1, cmd, used, places);
    const c = hand[i];
    if (c.cost > cmd) return;
    for (const t of targets(s, p, used)) {
      const k = `${t.row}${t.lane}`;
      used.add(k); places.push({ card: c.id, ...t });
      rec(i + 1, cmd - c.cost, used, places);
      places.pop(); used.delete(k);
    }
  };
  rec(0, cmd0, new Set(), []);
  let base = out;
  if (base.length > cap) { // keep the pass + a random sample
    const keep = [base[0]];
    for (let i = 1; i < base.length; i++) { const j = Math.floor(rnd() * i); if (keep.length < cap) keep.push(base[i]); else if (j < cap) keep[j] = base[i]; }
    base = keep;
  }
  const res: POrders[] = [];
  const stakes = s.r.stake ? [-1, ...Array.from({ length: s.r.lanes }, (_, i) => i)] : [-1];
  for (const o of base) {
    const st = stakes[Math.floor(rnd() * stakes.length)];
    res.push({ ...o, stake: st });
    if (s.r.press && s.pressesLeft[p] > 0) res.push({ ...o, stake: st, press: true });
  }
  return res;
}

const PASS: POrders = { places: [], stake: -1, press: false };
const both = (p: Side, mine: POrders, theirs: POrders): [POrders, POrders] => (p === 0 ? [mine, theirs] : [theirs, mine]);

function determinize(s: PState, p: Side, rnd: () => number): PState {
  const e = 1 - p;
  const pool = [...s.hand[e], ...s.deck[e]];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const c = { ...s, hand: s.hand.slice() as PState['hand'], deck: s.deck.slice() as PState['deck'] };
  c.hand[e] = pool.slice(0, s.hand[e].length); c.deck[e] = pool.slice(s.hand[e].length);
  return c;
}

export function protoOrders(s: PState, p: Side, level: 'steel' | 'greedy' | 'random', stats?: PDecStats): POrders {
  const rnd = mk(s.rng ^ (s.round * 7919) ^ (p * 104729));
  const cands = candidates(s, p, rnd, level === 'steel' ? 250 : 250);
  if (level === 'random') return cands[Math.floor(rnd() * cands.length)];
  let score: (o: POrders) => number;
  if (level === 'greedy') score = (o) => evaluate(resolve(s, both(p, o, PASS)), p);
  else {
    const worlds = [0, 1].map(() => {
      const w = determinize(s, p, rnd);
      const e = (1 - p) as Side;
      let best = PASS, bv = -Infinity;
      for (const o of candidates(w, e, rnd, 120)) { const v = evaluate(resolve(w, both(e, o, PASS)), e); if (v > bv) { bv = v; best = o; } }
      return { w, reply: best };
    });
    score = (o) => worlds.reduce((a, { w, reply }) => a + 0.5 * evaluate(resolve(w, both(p, o, PASS)), p) + 0.5 * evaluate(resolve(w, both(p, o, reply)), p), 0) / worlds.length;
  }
  const scored = cands.map((o) => ({ o, v: score(o) })).sort((a, b) => b.v - a.v);
  if (stats && scored.length > 1) {
    // distinct "plans" = different card sets; close if the best two plans are within 3 (≈0.3 marker)
    const byId = new Map(s.hand[p].map((c) => [c.id, c]));
    const sig = (o: POrders) => o.places.map((x) => { const c = byId.get(x.card)!; return `${c.cost}${c.power}${c.nerve}@${x.row}${x.lane}`; }).sort().join() + '|' + o.stake + o.press;
    const seen = new Set<string>(); const vals: number[] = [];
    for (const x of scored) { const k = sig(x.o); if (!seen.has(k)) { seen.add(k); vals.push(x.v); } if (vals.length === 2) break; }
    // Relative to this decision's spread: the gap between the two best distinct plans vs best − median plan.
    const spread = scored[0].v - scored[Math.floor(scored.length / 2)].v;
    stats.decisions++;
    if (spread > 0.5) {
      const gap = vals.length > 1 ? vals[0] - vals[1] : spread;
      if (gap <= 0.15 * spread) stats.close++;
      if (gap >= 0.6 * spread) stats.obvious++;
    } else stats.obvious++; // nothing matters this turn: not an interesting decision

  }
  return scored[0].o;
}
