import { Pos, allHexes, distance, key } from './hex';
import { isTactic } from './cards';
import {
  GameState, Orders, PlayerId, canDeployAt, def, formationAt, isShaken, maxNerve, other, power,
  simulate, tileAt, has,
} from './engine';

/** Static evaluation from p's point of view. */
export function evaluate(s: GameState, p: PlayerId): number {
  if (s.winner !== null) return s.winner === p ? 10000 : s.winner === -1 ? 0 : -10000;
  const o = other(p);
  let v = (s.players[p].resolve - s.players[o].resolve) * 10;
  const relays = s.tiles.filter((t) => t.terrain === 'relay');
  for (const f of s.formations) {
    if (has(f, 'hq')) continue;
    const sign = f.owner === p ? 1 : -1;
    let fv = power(f) * 1.2 + f.morale * 1.0 + f.cards.length * 1.5;
    if (f.broken) fv -= 5;
    else if (isShaken(f)) fv -= 2;
    if (!f.broken) {
      const dr = Math.min(...relays.map((t) => distance(t.pos, f.pos)));
      fv -= dr * 0.4;
      if (tileAt(s, f.pos).terrain === 'relay') fv += 2;
    }
    v += sign * fv;
  }
  for (const t of relays) if (t.relayOwner !== -1) v += (t.relayOwner === p ? 1 : -1) * 4;
  return v;
}

/** Greedy planner: repeatedly add the single placement that most improves the
 *  simulated end-of-round evaluation, until nothing helps or Command runs out. */
export function aiOrders(s: GameState, p: PlayerId, opts: { candidates?: number } = {}): Orders {
  const pl = s.players[p];
  const orders: Orders = { deploys: [] };
  let cp = pl.cp;
  const usedHex = new Set<string>();
  let baseline = evaluate(simulate(s, p, orders), p);
  const maxCand = opts.candidates ?? 8;
  for (let iter = 0; iter < 6; iter++) {
    let best: { uid: number; pos: Pos } | null = null;
    let bestV = baseline;
    const seenCard = new Set<string>();
    for (const c of pl.hand) {
      if (orders.deploys.some((d) => d.uid === c.uid)) continue;
      const cd = def(c);
      if (cd.cost > cp || seenCard.has(cd.id)) continue;
      seenCard.add(cd.id);
      // candidate hexes, pre-ranked by a cheap heuristic
      const hexes = allHexes().filter((h) => (isTactic(cd) || !usedHex.has(key(h))) && canDeployAt(s, p, cd, h));
      const ranked = hexes.map((h) => ({ h, sc: heuristic(s, p, h, cd.range ?? 1) + Math.random() * 0.3 }))
        .sort((a, b) => b.sc - a.sc).slice(0, maxCand);
      for (const { h } of ranked) {
        const trial: Orders = { deploys: [...orders.deploys, { uid: c.uid, pos: h }] };
        const v = evaluate(simulate(s, p, trial), p) - cd.cost * 0.15; // slight preference for efficient plays
        if (v > bestV) { bestV = v; best = { uid: c.uid, pos: h }; }
      }
    }
    if (!best) break;
    orders.deploys.push(best);
    const cd = def(pl.hand.find((h) => h.uid === best!.uid)!);
    cp -= cd.cost;
    if (!isTactic(cd)) usedHex.add(key(best.pos));
    baseline = bestV + cd.cost * 0.15;
  }
  const adv = evaluate(s, p);
  orders.escalate = !pl.escalateUsed && s.round >= 3 && adv > 35;
  return orders;
}

function heuristic(s: GameState, p: PlayerId, h: Pos, range: number): number {
  const occ = formationAt(s, h);
  if (occ) return occ.owner === p ? (occ.broken ? 6 : isShaken(occ) ? 4 : 1) + (maxNerve(occ) - occ.morale) * 0.3 : 3;
  const relays = s.tiles.filter((t) => t.terrain === 'relay');
  const enemies = s.formations.filter((f) => f.owner !== p);
  const dr = Math.min(...relays.map((t) => distance(t.pos, h)));
  const de = enemies.length ? Math.min(...enemies.map((e) => distance(e.pos, h))) : 6;
  return -dr + (range >= 2 ? tileAt(s, h).elev - Math.abs(de - range) * 0.5 : -de * 0.3);
}

export function aiWantsRetreat(s: GameState, p: PlayerId): boolean {
  const adv = evaluate(s, p);
  return s.phase === 'orders' && s.round >= 5 && s.pendingEscalations > 0 && adv < -90;
}
