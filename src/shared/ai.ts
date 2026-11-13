import { CARD_BY_ID } from './cards';
import { Pos, allHexes, distance, key } from './hex';
import {
  Action, GameState, Orders, PlayerId, apply, canActivate, canDeployAt, def, formationAt,
  has, isShaken, leadDef, maxMorale, other, reachable, strength, targetsFrom, tileAt, inHome,
} from './engine';

/** Static evaluation from p's point of view. */
export function evaluate(s: GameState, p: PlayerId): number {
  if (s.winner !== null) return s.winner === p ? 10000 : s.winner === -1 ? 0 : -10000;
  const o = other(p);
  let v = (s.players[p].resolve - s.players[o].resolve) * 10;
  const relays = s.tiles.filter((t) => t.terrain === 'relay');
  for (const f of s.formations) {
    const sign = f.owner === p ? 1 : -1;
    let fv = strength(f) * 1.0 + f.morale * 1.4 + f.cards.length * 2;
    if (f.broken) fv -= 6;
    else if (isShaken(f)) fv -= 2;
    if (!f.broken) {
      const dr = Math.min(...relays.map((t) => distance(t.pos, f.pos)));
      fv -= dr * 0.6;
      const r = tileAt(s, f.pos);
      if (r.terrain === 'relay') fv += 3;
      if (leadDef(f).range >= 2) fv += r.elev * 0.8;
    }
    v += sign * fv;
  }
  for (const t of relays) if (t.relayOwner !== -1) v += (t.relayOwner === p ? 1 : -1) * 5;
  return v;
}

function cloneLite(s: GameState): GameState {
  const log = s.log, ev = s.events;
  s.log = []; s.events = [];
  const c = structuredClone(s);
  s.log = log; s.events = ev;
  return c;
}

export function aiBattleAction(s: GameState, p: PlayerId): Action {
  let best: Action = { type: 'pass', player: p };
  let bestV = -Infinity;
  for (const f of s.formations) {
    if (f.owner !== p || !canActivate(s, f)) continue;
    const moves = reachable(s, f);
    for (const m of moves) {
      // try each target from that spot, or no attack
      const probe = cloneLite(s);
      const pf = probe.formations.find((x) => x.fid === f.fid)!;
      pf.pos = m.pos;
      const targets = targetsFrom(probe, pf, m.pos).map((t) => t.fid);
      const opts: (number | undefined)[] = [undefined, ...targets];
      for (const t of opts) {
        const a: Action = { type: 'activate', player: p, fid: f.fid, move: m.pos, target: t };
        const c = cloneLite(s);
        if (apply(c, a)) continue;
        const v = evaluate(c, p) + Math.random() * 0.3;
        if (v > bestV) { bestV = v; best = a; }
      }
      if (has(f, 'digIn')) {
        const a: Action = { type: 'activate', player: p, fid: f.fid, move: m.pos, special: 'digIn' };
        const c = cloneLite(s); apply(c, a);
        const v = evaluate(c, p) + 0.5;
        if (v > bestV) { bestV = v; best = a; }
      }
      if (has(f, 'rally')) {
        for (const b of s.formations.filter((x) => x.owner === p && x.broken)) {
          const a: Action = { type: 'activate', player: p, fid: f.fid, move: m.pos, special: 'rally', specialTarget: b.fid };
          const c = cloneLite(s); apply(c, a);
          const v = evaluate(c, p);
          if (v > bestV) { bestV = v; best = a; }
        }
      }
    }
  }
  return best;
}

export function aiOrders(s: GameState, p: PlayerId): Orders {
  const pl = s.players[p];
  let cp = pl.cp;
  const deploys: { uid: number; pos: Pos }[] = [];
  const usedHex = new Set<string>();
  const hand = [...pl.hand].sort((a, b) => def(b).cost - def(a).cost + (Math.random() - 0.5));
  const relays = s.tiles.filter((t) => t.terrain === 'relay');
  const enemy = s.formations.filter((f) => f.owner !== p);
  // Hold back the odd card early so the deck has gas late, but always play something.
  for (const c of hand) {
    const cd = def(c);
    if (cd.cost > cp) continue;
    let bestPos: Pos | null = null, bestScore = -Infinity;
    for (const h of allHexes()) {
      if (usedHex.has(key(h))) continue;
      if (!canDeployAt(s, p, cd, h)) continue;
      const occ = formationAt(s, h);
      let sc = 0;
      if (occ) {
        if (occ.broken) sc += 9;
        else if (isShaken(occ)) sc += 5;
        sc += (maxMorale(occ) - occ.morale) * 0.5;
        if (tileAt(s, h).terrain === 'relay') sc += 2;
        sc += 1.5 - occ.cards.length; // spread a bit
      } else {
        const dr = Math.min(...relays.map((t) => distance(t.pos, h)));
        const de = enemy.length ? Math.min(...enemy.map((e) => distance(e.pos, h))) : 5;
        if (cd.range >= 2) sc += tileAt(s, h).elev * 1.2 - Math.abs(de - cd.range) * 0.6 + (inHome(p, h) ? 0.5 : 0);
        else sc += -dr * 1.0;
        if (cd.cls === 'Structure') sc += -dr * 0.8;
        const friends = s.formations.filter((f) => f.owner === p && distance(f.pos, h) === 1).length;
        sc += friends * 0.7;
        if (cd.keywords.includes('synapse') || cd.keywords.includes('synapseBig')) sc += friends * 0.8 - (de <= 1 ? 3 : 0);
      }
      sc += Math.random() * 0.4;
      if (sc > bestScore) { bestScore = sc; bestPos = h; }
    }
    if (bestPos) {
      deploys.push({ uid: c.uid, pos: bestPos });
      usedHex.add(key(bestPos));
      cp -= cd.cost;
    }
  }
  const adv = evaluate(s, p);
  const escalate = !pl.escalateUsed && s.round >= 3 && adv > 30;
  return { deploys, escalate };
}

export function aiWantsRetreat(s: GameState, p: PlayerId): boolean {
  // Concede cheaply when the position is hopeless and stakes are about to rise.
  const adv = evaluate(s, p);
  return s.phase === 'orders' && s.round >= 5 && s.pendingEscalations > 0 && adv < -90;
}

export { CARD_BY_ID };
