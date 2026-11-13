// Shatterline AI.
//  • greedy  — v1: adds placements one at a time, assuming the opponent passes.
//  • steel   — v2 ("steelman"): samples the opponent's hidden hand from their unseen cards
//              (never peeks at the real hand), predicts their greedy reply, and picks orders
//              that score well both against that reply and against a pass. Its evaluation
//              weights come from a per-deck profile tuned by self-play (scripts/tune.ts), so
//              every deck is played toward its own best plan.
import { Faction, isTactic, starterDeck } from './cards';
import {
  GameState, Orders, PlayerId, Pos, allCells, canDeployAt, computeBreaches, def, facing, formationAt, isFearless,
  isFront, isFrontCell, key, maxNerve, other, power, simulate,
} from './engine';
import PROFILES from './ai-profiles.json';

export interface AiWeights {
  resolve: number;  // Resolve difference
  power: number;    // per point of standing Power
  morale: number;   // per point of current Nerve
  cards: number;    // per card in a formation (stack depth)
  shaky: number;    // penalty for a unit at half Nerve or less
  front: number;    // bonus for Front-row presence
  breach: number;   // per standing breach
  fearless: number; // value of a Fearless unit's morale
  hand: number;     // per card kept in hand
  tactic: number;   // bonus for playing a tactic (insurance value the 1-round sim can't see)
  reply: number;    // 0..1 weight of the predicted-reply outcome vs the opponent-passes outcome
}
export const DEFAULT_WEIGHTS: AiWeights = { resolve: 10, power: 1.1, morale: 1, cards: 2, shaky: 2, front: 1.5, breach: 4, fearless: 4, hand: 0, tactic: 4, reply: 0.5 };

/** Decision telemetry (Meier: a decision is interesting when several options are close in value). */
export interface DecisionStats { decisions: number; close: number; obvious: number }
export interface AiOptions { stats?: DecisionStats; level?: 'greedy' | 'steel'; weights?: Partial<AiWeights>; profile?: string; candidates?: number; samples?: number }

/** Tuned per-deck profiles: label (e.g. "brood/tide") → weights + deck list. */
export const AI_PROFILES = PROFILES as Record<string, { weights?: Partial<AiWeights>; deck?: string[] }>;
/** Best known deck for a faction/archetype: the self-play tuned list if there is one. */
export function tunedDeck(f: Faction, arch?: string): string[] {
  return AI_PROFILES[`${f}/${arch ?? 'balanced'}`]?.deck ?? starterDeck(f, arch);
}
/** Back-compat knob used by older sim flags. */
export const AI_TUNING = { tacticBonus: DEFAULT_WEIGHTS.tactic };

function weightsFor(o: AiOptions): AiWeights {
  return { ...DEFAULT_WEIGHTS, tactic: AI_TUNING.tacticBonus, ...(o.profile ? AI_PROFILES[o.profile]?.weights : {}), ...o.weights };
}

/** Deterministic per-decision RNG (so sims are reproducible and paired-seed comparisons work). */
function mkRng(seed: number) {
  let t = seed | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Static evaluation from p's point of view. */
export function evaluate(s: GameState, p: PlayerId, w: AiWeights = DEFAULT_WEIGHTS): number {
  if (s.winner !== null) return s.winner === p ? 10000 : s.winner === -1 ? 0 : -10000;
  const o = other(p);
  let v = (s.players[p].resolve - s.players[o].resolve) * w.resolve;
  v += (s.players[p].hand.length - s.players[o].hand.length) * w.hand;
  for (const f of s.formations) {
    if (!f.cards.length) continue;
    const sign = f.owner === p ? 1 : -1;
    let fv = power(f) * w.power + (isFearless(s, f) ? w.fearless : f.morale * w.morale) + f.cards.length * w.cards;
    if (!isFearless(s, f) && f.morale * 2 <= maxNerve(f)) fv -= w.shaky;
    if (isFront(f)) fv += w.front;
    v += sign * fv;
  }
  const { breaches } = computeBreaches(s);
  for (const b of breaches) v += (b.owner === p ? 1 : -1) * w.breach;
  return v;
}

/** Replace the opponent's hidden hand with a sample from their unseen cards (hand ∪ deck). */
function determinize(s: GameState, p: PlayerId, rnd: () => number): GameState {
  const c = structuredClone({ ...s, log: [], events: [] }) as GameState;
  const op = c.players[other(p)];
  const pool = [...op.hand, ...op.deck];
  const shuf = () => { for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } };
  shuf();
  // Cloaked enemy units are unknown too: swap each with a random unseen unit card (Nerve as if fresh).
  for (const f of c.formations) {
    if (f.owner === p || !f.cloaked || f.cards.length !== 1 || def(f.cards[0]).cls === 'Illusion') continue;
    const j = pool.findIndex((x) => !isTactic(def(x)) && def(x).cls !== 'Structure');
    if (j < 0) continue;
    const real = f.cards[0];
    f.cards[0] = { ...pool[j], uid: real.uid, dmg: 0 };
    pool[j] = { ...real, uid: pool[j].uid, dmg: 0 };
    f.morale = Math.min(maxNerve(f), def(f.cards[0]).nerve);
  }
  shuf();
  op.hand = pool.slice(0, op.hand.length);
  op.deck = pool.slice(op.hand.length);
  return c;
}

/** Greedy order builder. `score(trial)` returns the value of a full set of orders. */
function greedy(s: GameState, p: PlayerId, w: AiWeights, rnd: () => number, maxCand: number, score: (o: Orders) => number, stats?: DecisionStats): Orders {
  const pl = s.players[p];
  const orders: Orders = { deploys: [] };
  let cp = pl.cp;
  const usedCell = new Set<string>();
  let baseline = score(orders);
  for (let iter = 0; iter < 6; iter++) {
    let best: { uid: number; pos: Pos } | null = null;
    let bestV = baseline;
    const optionVals: { id: string; v: number }[] = iter === 0 && stats ? [{ id: 'pass', v: baseline }] : [];
    const seenCard = new Set<string>();
    const unitCells = orders.deploys.filter((d) => !isTactic(def(pl.hand.find((h) => h.uid === d.uid)!))).map((d) => d.pos);
    for (const c of pl.hand) {
      if (orders.deploys.some((d) => d.uid === c.uid)) continue;
      const cd = def(c);
      if (cd.cost > cp || seenCard.has(cd.id)) continue;
      seenCard.add(cd.id);
      const cells = allCells().filter((h) => (isTactic(cd) || !usedCell.has(key(h))) && canDeployAt(s, p, cd, h, unitCells));
      const ranked = cells.map((h) => ({ h, sc: heuristic(s, p, h, (cd.range ?? 1) >= 2) + rnd() * 0.3 }))
        .sort((a, b) => b.sc - a.sc).slice(0, maxCand);
      for (const { h } of ranked) {
        const v = score({ deploys: [...orders.deploys, { uid: c.uid, pos: h }] }) - cd.cost * 0.15 + (isTactic(cd) ? w.tactic : 0);
        if (iter === 0 && stats) optionVals.push({ id: cd.id, v });
        if (v > bestV) { bestV = v; best = { uid: c.uid, pos: h }; }
      }
    }
    if (iter === 0 && stats && optionVals.length > 1) {
      // best value per distinct card (or pass); "close" = another card within 3 eval (~0.3 Resolve)
      const per = new Map<string, number>();
      for (const o of optionVals) per.set(o.id, Math.max(per.get(o.id) ?? -Infinity, o.v));
      const vals = [...per.values()].sort((a, b) => b - a);
      stats.decisions++;
      if (vals.length > 1 && vals[0] - vals[1] <= 3) stats.close++;
      if (vals.length < 2 || vals[0] - vals[1] > 15) stats.obvious++;
    }
    if (!best) break;
    orders.deploys.push(best);
    const cd = def(pl.hand.find((h) => h.uid === best!.uid)!);
    cp -= cd.cost;
    if (!isTactic(cd)) usedCell.add(key(best.pos));
    baseline = bestV + cd.cost * 0.15 - (isTactic(cd) ? w.tactic : 0);
  }
  return orders;
}

export function aiOrders(s: GameState, p: PlayerId, opts: AiOptions = {}): Orders {
  const w = weightsFor(opts);
  const rnd = mkRng(s.rng ^ (s.round * 7919) ^ (p * 104729));
  const cand = opts.candidates ?? (opts.level === 'steel' ? 6 : 5);
  let orders: Orders;
  if (opts.level !== 'steel') {
    orders = greedy(s, p, w, rnd, cand, (o) => evaluate(simulate(s, p, o), p, w), opts.stats);
  } else {
    // Predict the opponent's reply on K sampled worlds, then best-respond to the mixture.
    const K = opts.samples ?? 2;
    const worlds = Array.from({ length: K }, () => {
      const ws = determinize(s, p, rnd);
      const opp = other(p);
      const reply = greedy(ws, opp, DEFAULT_WEIGHTS, rnd, 4, (o) => evaluate(simulate(ws, opp, o), opp, DEFAULT_WEIGHTS));
      return { ws, reply };
    });
    const score = (o: Orders) => {
      let v = 0;
      for (const { ws, reply } of worlds) {
        v += (1 - w.reply) * evaluate(simulate(ws, p, o), p, w);
        v += w.reply * evaluate(simulate(ws, p, o, reply), p, w);
      }
      return v / K;
    };
    orders = greedy(s, p, w, rnd, cand, score, opts.stats);
  }
  const adv = evaluate(s, p, w);
  orders.escalate = !s.players[p].escalateUsed && s.round >= 3 && adv > 35;
  return orders;
}

function heuristic(s: GameState, p: PlayerId, h: Pos, ranged: boolean): number {
  const occ = formationAt(s, h);
  if (occ) return occ.owner === p ? 1 + (maxNerve(occ) - occ.morale) * 0.5 : 3;
  const enemyInCol = facing(s, { fid: -1, owner: p, pos: h } as never).length;
  let sc = isFrontCell(h) ? 2 : ranged ? 1.5 : -1;
  if (isFrontCell(h)) sc += enemyInCol ? 1 : 2; // contest or breach
  return sc;
}

export function aiWantsRetreat(s: GameState, p: PlayerId): boolean {
  const adv = evaluate(s, p);
  return s.phase === 'orders' && s.round >= 5 && s.pendingEscalations > 0 && adv < -90;
}
