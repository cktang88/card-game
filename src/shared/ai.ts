import { isTactic } from './cards';
import {
  GameState, Orders, PlayerId, Pos, allCells, canDeployAt, computeBreaches, def, facing, formationAt, isFearless,
  isFront, isFrontCell, key, maxNerve, other, power, simulate,
} from './engine';

/** Static evaluation from p's point of view. */
export function evaluate(s: GameState, p: PlayerId): number {
  if (s.winner !== null) return s.winner === p ? 10000 : s.winner === -1 ? 0 : -10000;
  const o = other(p);
  let v = (s.players[p].resolve - s.players[o].resolve) * 10;
  for (const f of s.formations) {
    const sign = f.owner === p ? 1 : -1;
    let fv = power(f) * 1.1 + (isFearless(s, f) ? 4 : f.morale) * 1.0 + f.cards.length * 2;
    if (!isFearless(s, f) && f.morale * 2 <= maxNerve(f)) fv -= 2;
    if (isFront(f)) fv += 1.5;
    v += sign * fv;
  }
  // standing breaches are future drain + flank pressure
  const { breaches } = computeBreaches(s);
  for (const b of breaches) v += (b.owner === p ? 1 : -1) * 4;
  return v;
}

/** Tuning knobs for sim experiments (DESIGN_LOG). */
export const AI_TUNING = { tacticBonus: 4 }; // see DESIGN_LOG #1

/** Greedy planner: repeatedly add the single placement that most improves the simulated
 *  end-of-round evaluation, until nothing helps or Command runs out. */
export function aiOrders(s: GameState, p: PlayerId, opts: { candidates?: number } = {}): Orders {
  const pl = s.players[p];
  const orders: Orders = { deploys: [] };
  let cp = pl.cp;
  const usedCell = new Set<string>();
  let baseline = evaluate(simulate(s, p, orders), p);
  const maxCand = opts.candidates ?? 8;
  for (let iter = 0; iter < 6; iter++) {
    let best: { uid: number; pos: Pos } | null = null;
    let bestV = baseline;
    const seenCard = new Set<string>();
    const unitCells = orders.deploys.filter((d) => !isTactic(def(pl.hand.find((h) => h.uid === d.uid)!))).map((d) => d.pos);
    for (const c of pl.hand) {
      if (orders.deploys.some((d) => d.uid === c.uid)) continue;
      const cd = def(c);
      if (cd.cost > cp || seenCard.has(cd.id)) continue;
      seenCard.add(cd.id);
      const cells = allCells().filter((h) => (isTactic(cd) || !usedCell.has(key(h))) && canDeployAt(s, p, cd, h, unitCells));
      const ranked = cells.map((h) => ({ h, sc: heuristic(s, p, h, (cd.range ?? 1) >= 2) + Math.random() * 0.3 }))
        .sort((a, b) => b.sc - a.sc).slice(0, maxCand);
      for (const { h } of ranked) {
        const trial: Orders = { deploys: [...orders.deploys, { uid: c.uid, pos: h }] };
        const v = evaluate(simulate(s, p, trial), p) - cd.cost * 0.15 + (isTactic(cd) ? AI_TUNING.tacticBonus : 0);
        if (v > bestV) { bestV = v; best = { uid: c.uid, pos: h }; }
      }
    }
    if (!best) break;
    orders.deploys.push(best);
    const cd = def(pl.hand.find((h) => h.uid === best!.uid)!);
    cp -= cd.cost;
    if (!isTactic(cd)) usedCell.add(key(best.pos));
    baseline = bestV + cd.cost * 0.15 - (isTactic(cd) ? AI_TUNING.tacticBonus : 0);
  }
  const adv = evaluate(s, p);
  orders.escalate = !pl.escalateUsed && s.round >= 3 && adv > 35;
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
