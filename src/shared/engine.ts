import { CARD_BY_ID, CardDef, Faction, HQ_ID, Keyword, starterDeck } from './cards';
import { Pos, allHexes, distance, inBounds, key, neighbors, lineBetween, samePos, toAxial, fromAxial, AXIAL_DIRS, ROWS } from './hex';
import { Terrain, buildMap } from './map';

// ───────────────────────── tunables ─────────────────────────
export const RULES = {
  maxRounds: 8,
  startResolve: 16,
  handStart: 5,
  handMax: 8,
  stackMax: 3,
  swarmStackMax: 5,
  breakCost: 3,
  broodBreakCost: 1,
  synapseLossCost: 3,
  cardDeathCost: 1,
  hqLossCost: 6,
  siegeDrain: 1,
  relayDrain: 1,
  breakthroughDrain: 1,
  cpCap: 7,
  carryOver: 1,
  maxStakes: 8,
  ambushShock: 1,
  feralPower: 1,
};
export const cpForRound = (round: number) => Math.min(round + 1, RULES.cpCap);

// ───────────────────────── types ─────────────────────────
export type PlayerId = 0 | 1;

export interface CardInst { uid: number; id: string; dmg: number; grow?: number; token?: boolean }

export interface Formation {
  fid: number;
  owner: PlayerId;
  pos: Pos;
  cards: CardInst[];      // bottom → top; last is Lead
  morale: number;
  broken: boolean;
  deployedRound: number;
  activatedRound: number;
  cloaked: boolean;
}

export interface Tile {
  pos: Pos;
  elev: number;
  terrain: Terrain;
  fortified: boolean;
  melted: boolean;
  relayOwner: -1 | PlayerId;
}

export interface DeployOrder { uid: number; pos: Pos }
export interface Orders { deploys: DeployOrder[]; escalate?: boolean }

export interface PlayerState {
  faction: Faction;
  deck: CardInst[];
  hand: CardInst[];
  discard: string[];
  resolve: number;
  cp: number;
  escalateUsed: boolean;
  orders: Orders | null;
}

export type GameEvent =
  | { t: 'deploy'; fid: number; pos: Pos; id: string; reinforce: boolean; owner: PlayerId }
  | { t: 'move'; fid: number; from: Pos; to: Pos }
  | { t: 'attack'; fid: number; target: number; from: Pos; to: Pos; dmg: number; shock: number }
  | { t: 'break'; fid: number; pos: Pos }
  | { t: 'destroy'; fid: number; pos: Pos }
  | { t: 'rally'; fid: number; pos: Pos }
  | { t: 'reveal'; fid: number; pos: Pos }
  | { t: 'evolve'; fid: number; pos: Pos }
  | { t: 'resolve'; player: PlayerId; delta: number; reason: string }
  | { t: 'round'; round: number };

export interface GameState {
  rng: number;
  round: number;
  phase: 'orders' | 'battle' | 'over';
  players: [PlayerState, PlayerState];
  tiles: Tile[];
  formations: Formation[];
  nextId: number;
  initiative: PlayerId;
  active: PlayerId;
  passed: [boolean, boolean];
  stakes: number;
  pendingEscalations: number;
  winner: null | -1 | PlayerId;
  endReason: string;
  attackedThisRound: number[];
  fedThisRound: number[];
  log: string[];
  events: GameEvent[];
  stats: { breaks: [number, number]; cardsLost: [number, number]; surrenders: [number, number]; relayDrain: [number, number]; breakthrough: [number, number]; resolveBy: Record<string, number> };
}

export type Action =
  | { type: 'orders'; player: PlayerId; orders: Orders }
  | { type: 'activate'; player: PlayerId; fid: number; move?: Pos; target?: number; special?: 'digIn' | 'rally'; specialTarget?: number }
  | { type: 'pass'; player: PlayerId }
  | { type: 'retreat'; player: PlayerId };

// ───────────────────────── rng ─────────────────────────
function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(s: GameState, a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// ───────────────────────── setup ─────────────────────────
export function newGame(f0: Faction, f1: Faction, seed = Date.now() & 0xffffffff, decks?: [string[], string[]]): GameState {
  const map = buildMap();
  const s: GameState = {
    rng: seed,
    round: 1,
    phase: 'orders',
    players: [mkPlayer(f0), mkPlayer(f1)],
    tiles: allHexes().map((pos) => ({ pos, elev: map.get(key(pos))!.elev, terrain: map.get(key(pos))!.terrain, fortified: false, melted: false, relayOwner: -1 })),
    formations: [],
    nextId: 1,
    initiative: 0,
    active: 0,
    passed: [false, false],
    stakes: 1,
    pendingEscalations: 0,
    winner: null,
    endReason: '',
    attackedThisRound: [],
    fedThisRound: [],
    log: [],
    events: [],
    stats: { breaks: [0, 0], cardsLost: [0, 0], surrenders: [0, 0], relayDrain: [0, 0], breakthrough: [0, 0], resolveBy: {} },
  };
  s.initiative = rand(s) < 0.5 ? 0 : 1;
  for (const p of [0, 1] as PlayerId[]) {
    const pos = HQ_POS[p];
    s.formations.push({ fid: s.nextId++, owner: p, pos, cards: [{ uid: s.nextId++, id: HQ_ID[s.players[p].faction], dmg: 0, token: true }],
      morale: 9, broken: false, deployedRound: 0, activatedRound: 0, cloaked: false });
  }
  for (const p of [0, 1] as PlayerId[]) {
    const ids = decks?.[p] ?? starterDeck(s.players[p].faction);
    s.players[p].deck = ids.map((id) => ({ uid: s.nextId++, id, dmg: 0 }));
    shuffle(s, s.players[p].deck);
    for (let i = 0; i < RULES.handStart; i++) draw(s, p);
    s.players[p].cp = cpForRound(1);
  }
  return s;
}

export const HQ_POS: [Pos, Pos] = [{ col: 2, row: ROWS - 1 }, { col: 3, row: 0 }];

function mkPlayer(f: Faction): PlayerState {
  return { faction: f, deck: [], hand: [], discard: [], resolve: RULES.startResolve, cp: 0, escalateUsed: false, orders: null };
}

function draw(s: GameState, p: PlayerId) {
  const pl = s.players[p];
  const c = pl.deck.pop();
  if (!c) return;
  if (pl.hand.length >= RULES.handMax) pl.discard.push(c.id);
  else pl.hand.push(c);
}

// ───────────────────────── queries ─────────────────────────
export const def = (c: CardInst): CardDef => CARD_BY_ID[c.id];
export const lead = (f: Formation): CardInst => f.cards[f.cards.length - 1];
export const leadDef = (f: Formation): CardDef => def(lead(f));
export const has = (f: Formation, k: Keyword) => leadDef(f).keywords.includes(k);
export const other = (p: PlayerId): PlayerId => (1 - p) as PlayerId;

export function tileAt(s: GameState, p: Pos): Tile {
  return s.tiles.find((t) => samePos(t.pos, p))!;
}
export function formationAt(s: GameState, p: Pos): Formation | undefined {
  return s.formations.find((f) => samePos(f.pos, p));
}
export function getF(s: GameState, fid: number) {
  return s.formations.find((f) => f.fid === fid);
}
export const elev = (s: GameState, p: Pos) => tileAt(s, p).elev;
export const maxMorale = (f: Formation) => leadDef(f).morale + (f.cards.length - 1);
export const cardStr = (c: CardInst) => def(c).str + (c.grow ?? 0);
export const strength = (f: Formation) => f.cards.reduce((a, c) => a + cardStr(c) - c.dmg, 0);
export const isShaken = (f: Formation) => !f.broken && f.morale <= Math.floor(maxMorale(f) / 2);
export const faction = (s: GameState, f: Formation) => s.players[f.owner].faction;

export function homeRows(p: PlayerId): number[] { return p === 0 ? [ROWS - 1, ROWS - 2] : [0, 1]; }
export const homeEdge = (p: PlayerId) => (p === 0 ? ROWS - 1 : 0);
export const inHome = (p: PlayerId, pos: Pos) => homeRows(p).includes(pos.row);

function adjFormations(s: GameState, pos: Pos): Formation[] {
  return neighbors(pos).map((n) => formationAt(s, n)).filter((x): x is Formation => !!x);
}
const adjEnemies = (s: GameState, f: Formation) => adjFormations(s, f.pos).filter((o) => o.owner !== f.owner && !o.broken);
const adjFriends = (s: GameState, f: Formation) => adjFormations(s, f.pos).filter((o) => o.owner === f.owner && !o.broken);

export function linkSource(s: GameState, f: Formation): Formation | undefined {
  if (faction(s, f) !== 'brood') return undefined;
  return s.formations.find((o) => o !== f && o.owner === f.owner && !o.broken &&
    (has(o, 'synapse') || has(o, 'synapseBig')) &&
    distance(o.pos, f.pos) <= (has(o, 'synapseBig') ? 3 : 2));
}
export const isLinked = (s: GameState, f: Formation) => !!linkSource(s, f);

export function inFiringLine(s: GameState, f: Formation): boolean {
  if (faction(s, f) !== 'concord') return false;
  const a = toAxial(f.pos);
  for (let d = 0; d < 3; d++) {
    let count = 1;
    for (const sign of [1, -1]) {
      const [dq, dr] = AXIAL_DIRS[d];
      for (let k = 1; k < 3; k++) {
        const p = fromAxial(a.q + dq * k * sign, a.r + dr * k * sign);
        if (!inBounds(p)) break;
        const o = formationAt(s, p);
        if (!o || o.owner !== f.owner || o.broken) break;
        count++;
      }
    }
    if (count >= 3) return true;
  }
  return false;
}

export function isCreep(s: GameState, pos: Pos, broodOwner: PlayerId): boolean {
  return adjFormations(s, pos).some((o) => o.owner === broodOwner && has(o, 'creep'));
}

function hasCover(s: GameState, f: Formation): boolean {
  const t = tileAt(s, f.pos);
  if (!t.melted && (t.terrain === 'ruins' || t.fortified)) return true;
  if (leadDef(f).cls === 'Infantry' && adjFriends(s, f).some((o) => has(o, 'coverAura'))) return true;
  return false;
}

export function attackRange(s: GameState, f: Formation, from: Pos = f.pos): number {
  const d = leadDef(f);
  let r = d.range;
  if (r > 1 && d.keywords.includes('highRange') && elev(s, from) >= 1) r++;
  return r;
}

export function canActivate(s: GameState, f: Formation): boolean {
  if (f.broken || f.activatedRound === s.round) return false;
  const d = leadDef(f);
  if (f.deployedRound === s.round && !d.keywords.includes('rapid')) return false;
  if (d.range === 0 && (d.speed === 0 || d.keywords.includes('immobile')) && !d.keywords.includes('rally')) return false;
  return true;
}

// ───────────────────────── movement ─────────────────────────
export function reachable(s: GameState, f: Formation): { pos: Pos; steps: number }[] {
  const d = leadDef(f);
  if (d.keywords.includes('immobile') || d.speed === 0) return [{ pos: f.pos, steps: 0 }];
  const flying = d.keywords.includes('flying');
  const ignoreZoc = flying || d.keywords.includes('burrow');
  const seen = new Map<string, number>([[key(f.pos), 0]]);
  const out: { pos: Pos; steps: number }[] = [{ pos: f.pos, steps: 0 }];
  let frontier: Pos[] = [f.pos];
  for (let stepN = 1; stepN <= d.speed; stepN++) {
    const next: Pos[] = [];
    for (const p of frontier) {
      for (const n of neighbors(p)) {
        if (seen.has(key(n))) continue;
        if (formationAt(s, n)) continue;
        const tn = tileAt(s, n);
        if (!flying && Math.abs(tn.elev - elev(s, p)) > 1) continue;
        seen.set(key(n), stepN);
        out.push({ pos: n, steps: stepN });
        const stops = (!flying && tn.terrain === 'crater') ||
          (!ignoreZoc && neighbors(n).some((m) => { const o = formationAt(s, m); return o && o !== f && o.owner !== f.owner && !o.broken; }));
        if (!stops) next.push(n);
      }
    }
    frontier = next;
  }
  if (isShaken(f)) {
    const enemies = s.formations.filter((o) => o.owner !== f.owner);
    const nearest = (p: Pos) => Math.min(99, ...enemies.map((e) => distance(e.pos, p)));
    const cur = nearest(f.pos);
    return out.filter((o) => nearest(o.pos) >= cur);
  }
  return out;
}

export function hasLOS(s: GameState, from: Pos, to: Pos, indirect: boolean): boolean {
  if (indirect) return true;
  const e0 = elev(s, from), e1 = elev(s, to);
  for (const p of lineBetween(from, to)) {
    if (!inBounds(p)) continue;
    const e = elev(s, p);
    if (e > Math.max(e0, e1)) return false;
    if (formationAt(s, p) && e0 <= e) return false;
  }
  return true;
}

export function targetsFrom(s: GameState, f: Formation, from: Pos): Formation[] {
  const d = leadDef(f);
  if (d.range === 0) return [];
  const r = attackRange(s, f, from);
  const indirect = d.keywords.includes('indirect');
  return s.formations.filter((o) => o.owner !== f.owner && distance(o.pos, from) <= r &&
    (distance(o.pos, from) === 1 || (hasLOS(s, from, o.pos, indirect) && (!o.cloaked || indirect))));
}

// ───────────────────────── resolve / win ─────────────────────────
function loseResolve(s: GameState, p: PlayerId, n: number, reason: string) {
  if (n <= 0 || s.winner !== null) return;
  s.players[p].resolve -= n;
  const cat = /broke/.test(reason) ? 'morale' : /surrender/.test(reason) ? 'surrender' : /relay/.test(reason) ? 'relays' : /besieged/.test(reason) ? 'siege' : 'kills';
  s.stats.resolveBy[cat] = (s.stats.resolveBy[cat] ?? 0) + n;
  s.events.push({ t: 'resolve', player: p, delta: -n, reason });
  s.log.push(`P${p} loses ${n} Resolve (${reason}) → ${s.players[p].resolve}`);
  checkWin(s);
}

function checkWin(s: GameState) {
  if (s.winner !== null) return;
  const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
  if (r0 <= 0 && r1 <= 0) end(s, r0 === r1 ? -1 : r0 > r1 ? 0 : 1, 'mutual collapse');
  else if (r0 <= 0) end(s, 1, 'P0 army collapsed');
  else if (r1 <= 0) end(s, 0, 'P1 army collapsed');
}

function end(s: GameState, w: -1 | PlayerId, reason: string) {
  s.winner = w;
  s.endReason = reason;
  s.phase = 'over';
  s.log.push(`GAME OVER: ${w === -1 ? 'draw' : 'P' + w + ' wins'} (${reason}), stakes ${s.stakes}`);
}

// ───────────────────────── damage & shock ─────────────────────────
interface DmgResult { killed: number; destroyed: boolean }

function applyDamage(s: GameState, f: Formation, amount: number): DmgResult {
  const res: DmgResult = { killed: 0, destroyed: false };
  if (amount <= 0) return res;
  if (has(f, 'decoy')) { vanishDecoy(s, f); res.destroyed = true; return res; }
  let leaderDown = false;
  while (amount > 0 && f.cards.length) {
    const top = lead(f);
    const hp = cardStr(top) - top.dmg;
    const take = Math.min(hp, amount);
    top.dmg += take;
    amount -= take;
    if (top.dmg >= cardStr(top)) {
      f.cards.pop();
      res.killed++;
      if (!top.token) s.players[f.owner].discard.push(top.id);
      s.stats.cardsLost[f.owner]++;
      const isSyn = def(top).cls === 'Synapse';
      const isHq = def(top).cls === 'HQ';
      loseResolve(s, f.owner, isHq ? RULES.hqLossCost : isSyn ? RULES.synapseLossCost : RULES.cardDeathCost, `${def(top).name} destroyed`);
      if (f.cards.length) leaderDown = true;
    }
  }
  if (!f.cards.length) {
    res.destroyed = true;
    s.formations = s.formations.filter((o) => o !== f);
    s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
    s.log.push(`Formation #${f.fid} (P${f.owner}) destroyed`);
    // Watching a unit get wiped out shakes its neighbours.
    for (const o of adjFormations(s, f.pos)) if (o.owner === f.owner && !o.broken) applyShock(s, o, 1, { raw: true });
  } else {
    f.morale = Math.min(f.morale, maxMorale(f));
    if (leaderDown) applyShock(s, f, 1, {});
  }
  return res;
}

/** Decoys pop harmlessly (for their owner) and startle adjacent enemies. */
function vanishDecoy(s: GameState, f: Formation) {
  if (!s.formations.includes(f)) return;
  s.formations = s.formations.filter((o) => o !== f);
  for (const c of f.cards) if (!c.token) s.players[f.owner].discard.push(c.id);
  s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
  s.log.push(`#${f.fid} was only a Phantom`);
  for (const o of adjFormations(s, f.pos)) if (o.owner !== f.owner) applyShock(s, o, 1, { raw: true });
}

/** Remove cloak. Triggers Decoy / Nightmare. */
export function uncloak(s: GameState, f: Formation) {
  if (!f.cloaked || !s.formations.includes(f)) return;
  f.cloaked = false;
  s.events.push({ t: 'reveal', fid: f.fid, pos: f.pos });
  if (has(f, 'decoy')) return vanishDecoy(s, f);
  if (has(f, 'nightmare'))
    for (const o of [...s.formations]) if (o.owner !== f.owner && distance(o.pos, f.pos) <= 2) applyShock(s, o, 1, { raw: true });
}

interface ShockOpts { dirge?: boolean; visited?: Set<number>; raw?: boolean }

export function shockTaken(s: GameState, f: Formation, amount: number, opts: ShockOpts): number {
  if (amount <= 0) return 0;
  if (has(f, 'hq')) return 0;
  if (!opts.dirge && !opts.raw && adjFriends(s, f).some((o) => has(o, 'officerAura'))) amount -= 1;
  if (faction(s, f) === 'brood') amount = isLinked(s, f) ? 0 : amount * 2;
  return Math.max(0, amount);
}

function applyShock(s: GameState, f: Formation, amount: number, opts: ShockOpts): number {
  if (f.broken || !s.formations.includes(f)) return 0;
  const n = shockTaken(s, f, amount, opts);
  if (n <= 0) return 0;
  if (has(f, 'decoy')) { vanishDecoy(s, f); return n; }
  f.morale -= n;
  if (f.morale <= 0) breakFormation(s, f, opts.visited ?? new Set());
  return n;
}

function breakFormation(s: GameState, f: Formation, visited: Set<number>) {
  f.broken = true;
  f.morale = 0;
  visited.add(f.fid);
  s.stats.breaks[f.owner]++;
  s.events.push({ t: 'break', fid: f.fid, pos: f.pos });
  const fac = faction(s, f);
  const d = leadDef(f);
  const cost = fac === 'brood' ? (d.cls === 'Synapse' ? RULES.synapseLossCost : RULES.broodBreakCost) : RULES.breakCost;
  s.log.push(`#${f.fid} ${d.name} (P${f.owner}) BREAKS`);
  loseResolve(s, f.owner, cost, `${d.name} broke`);
  // panic ripple
  for (const o of adjFormations(s, f.pos)) {
    if (o.owner === f.owner && !o.broken && !visited.has(o.fid)) {
      visited.add(o.fid);
      applyShock(s, o, 1, { visited, raw: true });
    }
  }
}

// ───────────────────────── attack ─────────────────────────
export interface AttackPreview { dmg: number; shock: number }

export function previewAttack(s: GameState, a: Formation, t: Formation, from: Pos, movedSteps: number): AttackPreview {
  const ad = leadDef(a);
  const melee = distance(from, t.pos) === 1;
  let dmg = ad.power + (lead(a).grow ?? 0) + (a.cards.length - 1);
  if (inFiringLineAt(s, a, from)) dmg += 1;
  const link = linkSource(s, a);
  if (link && has(link, 'synapseBig')) dmg += 1;
  if (a.cloaked && ad.keywords.includes('assassinate') && ['Officer', 'Synapse'].includes(leadDef(t).cls)) dmg += 3;
  if (ad.keywords.includes('frenzy'))
    dmg += adjFormations(s, t.pos).filter((o) => o.owner === a.owner && o !== a && !o.broken && faction(s, o) === 'brood').length;
  if (isShaken(a)) dmg -= 1;
  if (a.broken && faction(s, a) === 'brood') dmg += RULES.feralPower;
  const ea = elev(s, from), et = elev(s, t.pos);
  if (!melee && ea > et) dmg += 1;
  if (!melee && hasCover(s, t) && !ad.keywords.includes('ignoreCover')) dmg -= 1;
  if (melee && et > ea) dmg -= 1;
  if (t.broken) dmg += 1;
  dmg = Math.max(0, dmg);

  let shock = ad.shock;
  if (ad.keywords.includes('charge') && movedSteps >= 2) shock += 2;
  if (ad.keywords.includes('volley') && s.attackedThisRound.includes(t.fid)) shock += 1;
  if (!has(t, 'unflankable')) {
    const flankers = adjFormations(s, t.pos).filter((o) => o.owner === a.owner && o !== a && !o.broken).length;
    shock += Math.min(2, flankers);
  }
  if (!ad.keywords.includes('dirge') && adjFriends(s, t).length >= 2) shock -= 1;
  if (et > ea) shock -= 1;
  if (a.cloaked && !ad.keywords.includes('silent')) shock += RULES.ambushShock; // ambush (silent shooters stay hidden instead)
  return { dmg, shock: Math.max(0, shock) };
}

function inFiringLineAt(s: GameState, f: Formation, at: Pos): boolean {
  if (samePos(at, f.pos)) return inFiringLine(s, f);
  const old = f.pos; f.pos = at;
  const r = inFiringLine(s, f);
  f.pos = old;
  return r;
}

function doAttack(s: GameState, a: Formation, t: Formation, movedSteps: number, opts: { noRetaliate?: boolean; noSpecial?: boolean } = {}) {
  const ad = leadDef(a);
  if (has(t, 'decoy')) {
    s.events.push({ t: 'attack', fid: a.fid, target: t.fid, from: { ...a.pos }, to: { ...t.pos }, dmg: 0, shock: 0 });
    vanishDecoy(s, t);
    if (a.cloaked && !ad.keywords.includes('silent')) uncloak(s, a);
    return;
  }
  const pv = previewAttack(s, a, t, a.pos, movedSteps);
  const ambush = a.cloaked && !ad.keywords.includes('silent');
  const melee = distance(a.pos, t.pos) === 1;
  const tPos = { ...t.pos };
  if (t.cloaked) uncloak(s, t);
  const dres = applyDamage(s, t, pv.dmg);
  if (pv.dmg > 0 && faction(s, a) === 'brood' && !s.fedThisRound.includes(a.fid)) s.fedThisRound.push(a.fid);
  const shock = pv.shock + (dres.killed > 0 ? 1 : 0);
  let dealt = 0;
  if (!dres.destroyed) dealt = applyShock(s, t, shock, { dirge: ad.keywords.includes('dirge') });
  s.events.push({ t: 'attack', fid: a.fid, target: t.fid, from: { ...a.pos }, to: tPos, dmg: pv.dmg, shock: dealt });
  s.log.push(`#${a.fid} ${ad.name} → #${t.fid}: ${pv.dmg}⚔ ${dealt}☠${ambush ? ' (ambush)' : ''}`);
  if (!s.attackedThisRound.includes(t.fid)) s.attackedThisRound.push(t.fid);
  if (a.cloaked && !ad.keywords.includes('silent')) uncloak(s, a);
  if (s.winner !== null) return;

  if (dres.killed > 0 && ad.keywords.includes('devour')) {
    const top = lead(a); top.dmg = Math.max(0, top.dmg - 3);
    for (const e of adjEnemies(s, a)) applyShock(s, e, 2, {});
  }
  if (!opts.noSpecial) {
    if (ad.keywords.includes('barrage'))
      for (const o of adjFormations(s, tPos)) applyShock(s, o, 1, { raw: true });
    if (ad.keywords.includes('meltCover')) { const tt = tileAt(s, tPos); tt.melted = true; tt.fortified = false; }
  }
  if (s.winner !== null) return;
  // retaliation (never against an ambush)
  if (melee && !ambush && !opts.noRetaliate && s.formations.includes(t) && !t.broken && leadDef(t).range >= 1 && s.formations.includes(a)) {
    const rd = Math.max(0, leadDef(t).power + (lead(t).grow ?? 0) + (t.cards.length - 1) - (isShaken(t) ? 1 : 0));
    if (rd > 0) {
      applyDamage(s, a, rd);
      s.events.push({ t: 'attack', fid: t.fid, target: a.fid, from: tPos, to: { ...a.pos }, dmg: rd, shock: 0 });
    }
  }
}

// ───────────────────────── orders ─────────────────────────
export function stackLimit(cards: CardInst[]): number {
  if (cards.every((c) => def(c).keywords.includes('swarm5'))) return RULES.swarmStackMax;
  if (cards.some((c) => def(c).cls === 'Structure' || def(c).cls === 'Illusion')) return 1;
  return RULES.stackMax;
}

export function canReinforce(f: Formation, card: CardDef): boolean {
  const ld = leadDef(f);
  if (['Structure', 'Illusion'].includes(ld.cls) || ['Structure', 'Illusion'].includes(card.cls)) return false;
  const sameCls = f.cards.every((c) => def(c).cls === card.cls || def(c).cls === 'Officer') || card.cls === 'Officer';
  if (!sameCls) return false;
  const limit = stackLimit([...f.cards, { uid: 0, id: card.id, dmg: 0 }]);
  return f.cards.length < limit;
}

/** Hive-style placement: a new formation must touch one of your formations
 *  and must not touch an enemy (Infiltrate and spawn structures relax that). */
export function canDeployAt(s: GameState, p: PlayerId, card: CardDef, pos: Pos): boolean {
  if (!inBounds(pos)) return false;
  const occ = formationAt(s, pos);
  if (occ) return occ.owner === p && canReinforce(occ, card);
  const adj = neighbors(pos).map((n) => formationAt(s, n)).filter((x): x is Formation => !!x);
  const mine = adj.filter((o) => o.owner === p && !o.broken);
  const touchesEnemy = adj.some((o) => o.owner !== p);
  const infiltrate = card.keywords.includes('infiltrate');
  if (infiltrate && s.players[p].faction === 'brood' && (isCreep(s, pos, p) || neighbors(pos).some((n) => isCreep(s, n, p)))) return true;
  if (!mine.length) return false;
  if (!touchesEnemy || infiltrate) return true;
  return mine.some((o) => has(o, 'spawn'));
}

export function validateOrders(s: GameState, p: PlayerId, o: Orders): string | null {
  const pl = s.players[p];
  let cost = 0;
  const used = new Set<number>();
  const hexes = new Set<string>();
  for (const d of o.deploys) {
    const c = pl.hand.find((h) => h.uid === d.uid);
    if (!c) return 'card not in hand';
    if (used.has(d.uid)) return 'card used twice';
    used.add(d.uid);
    if (hexes.has(key(d.pos))) return 'one order per hex';
    hexes.add(key(d.pos));
    cost += def(c).cost;
    if (!canDeployAt(s, p, def(c), d.pos)) return `illegal deploy for ${def(c).name}`;
  }
  if (cost > pl.cp) return 'not enough command';
  if (o.escalate && pl.escalateUsed) return 'already escalated';
  return null;
}

// ───────────────────────── apply ─────────────────────────
export function apply(s: GameState, a: Action): string | null {
  if (s.phase === 'over') return 'game over';
  s.events = [];
  if (a.type === 'retreat') {
    s.log.push(`P${a.player} sounds the retreat`);
    end(s, other(a.player), `P${a.player} retreated`);
    return null;
  }
  if (a.type === 'orders') {
    if (s.phase !== 'orders') return 'not orders phase';
    const err = validateOrders(s, a.player, a.orders);
    if (err) return err;
    s.players[a.player].orders = a.orders;
    if (s.players[0].orders && s.players[1].orders) reveal(s);
    return null;
  }
  if (s.phase !== 'battle') return 'not battle phase';
  if (a.player !== s.active) return 'not your activation';
  if (a.type === 'pass') {
    s.passed[a.player] = true;
    advance(s);
    return null;
  }
  // activate
  const f = getF(s, a.fid);
  if (!f || f.owner !== a.player) return 'no such formation';
  if (!canActivate(s, f)) return 'cannot activate';
  let steps = 0;
  if (a.move && !samePos(a.move, f.pos)) {
    const r = reachable(s, f).find((x) => samePos(x.pos, a.move!));
    if (!r) return 'unreachable';
    s.events.push({ t: 'move', fid: f.fid, from: f.pos, to: a.move });
    f.pos = { ...a.move };
    steps = r.steps;
    for (const o of adjFormations(s, f.pos)) if (o.owner !== f.owner && o.cloaked) uncloak(s, o);
  }
  f.activatedRound = s.round;
  if (a.special === 'digIn' && has(f, 'digIn')) {
    tileAt(s, f.pos).fortified = true;
    tileAt(s, f.pos).melted = false;
  } else if (a.special === 'rally' && has(f, 'rally')) {
    const t = a.specialTarget !== undefined ? getF(s, a.specialTarget) : undefined;
    if (t && t.owner === f.owner && t.broken && distance(t.pos, f.pos) === 1) {
      t.broken = false; t.morale = 2;
      s.events.push({ t: 'rally', fid: t.fid, pos: t.pos });
    }
  } else if (a.target !== undefined) {
    const t = getF(s, a.target);
    if (t && t.owner !== f.owner) {
      if (has(f, 'shriek') && distance(t.pos, f.pos) === 1) {
        for (const e of adjFormations(s, f.pos).filter((o) => o.owner !== f.owner)) {
          if (has(e, 'decoy')) { vanishDecoy(s, e); continue; }
          if (e.cloaked) uncloak(s, e);
          if (!s.formations.includes(e)) continue;
          const pv = previewAttack(s, f, e, f.pos, steps);
          const dealt = applyShock(s, e, pv.shock, {});
          s.events.push({ t: 'attack', fid: f.fid, target: e.fid, from: f.pos, to: e.pos, dmg: 0, shock: dealt });
          if (s.winner !== null) break;
        }
      } else if (targetsFrom(s, f, f.pos).includes(t)) {
        doAttack(s, f, t, steps);
      }
    }
  }
  if (s.phase === 'battle') advance(s, true);
  return null;
}

function anyActivatable(s: GameState, p: PlayerId) {
  return !s.passed[p] && s.formations.some((f) => f.owner === p && canActivate(s, f));
}

function advance(s: GameState, justActed = false) {
  if (s.winner !== null) return;
  const cur = s.active;
  const nxt = other(cur);
  if (justActed && anyActivatable(s, nxt)) s.active = nxt;
  else if (anyActivatable(s, cur)) s.active = cur;
  else if (anyActivatable(s, nxt)) s.active = nxt;
  else endPhase(s);
}

function reveal(s: GameState) {
  s.events = [];
  for (const p of [s.initiative, other(s.initiative)]) {
    const pl = s.players[p];
    const o = pl.orders!;
    if (o.escalate && !pl.escalateUsed) {
      pl.escalateUsed = true;
      s.pendingEscalations++;
      s.log.push(`P${p} ESCALATES`);
    }
    for (const d of o.deploys) {
      const idx = pl.hand.findIndex((h) => h.uid === d.uid);
      if (idx < 0) continue;
      const c = pl.hand[idx];
      const cd = def(c);
      let pos = d.pos;
      const occ = formationAt(s, pos);
      if (occ && occ.owner !== p) {
        const alt = allHexes().filter((h) => !formationAt(s, h) && canDeployAt(s, p, cd, h)).sort((x, y) => distance(x, pos) - distance(y, pos))[0];
        if (!alt) continue;
        pos = alt;
      }
      pl.hand.splice(idx, 1);
      pl.cp -= cd.cost;
      const tgt = formationAt(s, pos);
      if (tgt && tgt.owner === p && canReinforce(tgt, cd)) {
        tgt.cards.push(c);
        if (tgt.broken) {
          tgt.broken = false;
          tgt.morale = Math.max(1, Math.min(cd.morale, Math.floor(maxMorale(tgt) / 2)));
          s.events.push({ t: 'rally', fid: tgt.fid, pos: tgt.pos });
        } else {
          tgt.morale = Math.min(maxMorale(tgt) + (cd.keywords.includes('reinforceMorale') ? 1 : 0), tgt.morale + cd.morale + (cd.keywords.includes('reinforceMorale') ? 1 : 0));
        }
        s.events.push({ t: 'deploy', fid: tgt.fid, pos, id: c.id, reinforce: true, owner: p });
      } else if (!tgt) {
        const f: Formation = { fid: s.nextId++, owner: p, pos: { ...pos }, cards: [c], morale: cd.morale, broken: false, deployedRound: s.round, activatedRound: 0, cloaked: pl.faction === 'hush' };
        s.formations.push(f);
        s.events.push({ t: 'deploy', fid: f.fid, pos, id: c.id, reinforce: false, owner: p });
      } else {
        pl.hand.push(c); pl.cp += cd.cost; // couldn't place
      }
    }
    pl.orders = null;
  }
  s.phase = 'battle';
  s.passed = [false, false];
  s.attackedThisRound = [];
  s.fedThisRound = [];
  s.active = s.initiative;
  if (!anyActivatable(s, s.active)) advance(s);
}

// ───────────────────────── end phase ─────────────────────────
function endPhase(s: GameState) {
  // 1. broken formations act
  for (const f of [...s.formations]) {
    if (!f.broken || !s.formations.includes(f)) continue;
    const fac = faction(s, f);
    if (fac === 'concord') flee(s, f);
    else if (fac === 'brood') feral(s, f);
    else vanish(s, f);
    if (s.winner !== null) return;
  }
  // 2. regroup / relink
  for (const f of s.formations) {
    if (!f.broken) continue;
    const fac = faction(s, f);
    if (fac === 'concord' && inHome(f.owner, f.pos) && adjEnemies(s, f).length === 0) {
      f.broken = false; f.morale = 1; s.events.push({ t: 'rally', fid: f.fid, pos: f.pos });
    } else if (fac === 'brood' && isLinked(s, f)) {
      f.broken = false; f.morale = 1; s.events.push({ t: 'rally', fid: f.fid, pos: f.pos });
    }
  }
  // 3. recover
  for (const f of s.formations) {
    if (f.broken) continue;
    let gain = adjEnemies(s, f).length === 0 ? 1 : 0;
    if (faction(s, f) === 'concord' && s.formations.some((o) => o.owner === f.owner && !o.broken && distance(o.pos, f.pos) <= 2 && has(o, 'marshal'))) gain += 1;
    f.morale = Math.min(maxMorale(f), f.morale + gain);
  }
  // 3b. evolve: Brood that drew blood this round grow (+1 ⚔/♥ on the Lead, max +3)
  for (const f of s.formations) {
    if (f.broken || !s.fedThisRound.includes(f.fid)) continue;
    const top = lead(f);
    if ((top.grow ?? 0) < 3) { top.grow = (top.grow ?? 0) + 1; s.events.push({ t: 'evolve', fid: f.fid, pos: f.pos }); }
  }
  // 3c. stealth: spotted cloaks drop, then Fade / Shroud re-cloak, Mirage spawns phantoms
  for (const f of [...s.formations]) if (f.cloaked && adjEnemies(s, f).length) uncloak(s, f);
  if (s.winner !== null) return;
  for (const f of s.formations) {
    if (f.broken || f.cloaked || faction(s, f) !== 'hush') continue;
    const shrouded = adjFriends(s, f).some((o) => has(o, 'shroud'));
    if (shrouded || (has(f, 'fade') && adjEnemies(s, f).length === 0)) f.cloaked = true;
  }
  for (const f of [...s.formations]) {
    if (f.broken || !has(f, 'mirage')) continue;
    const phantoms = s.formations.filter((o) => o.owner === f.owner && has(o, 'decoy')).length;
    if (phantoms >= 2) continue;
    const spot = neighbors(f.pos).find((n) => !formationAt(s, n));
    if (spot) {
      const nf: Formation = { fid: s.nextId++, owner: f.owner, pos: spot, cards: [{ uid: s.nextId++, id: 'v_phantom', dmg: 0, token: true }],
        morale: 1, broken: false, deployedRound: s.round, activatedRound: 0, cloaked: true };
      s.formations.push(nf);
      s.events.push({ t: 'deploy', fid: nf.fid, pos: spot, id: 'v_phantom', reinforce: false, owner: f.owner });
    }
  }
  // 4. creep
  for (const f of [...s.formations]) {
    if (f.broken) continue;
    if (s.players[other(f.owner)].faction === 'brood' && isCreep(s, f.pos, other(f.owner))) applyShock(s, f, 1, { raw: true });
    if (s.winner !== null) return;
  }
  // 5. relays
  for (const t of s.tiles) {
    if (t.terrain !== 'relay') continue;
    const o = formationAt(s, t.pos);
    if (o && !o.broken) t.relayOwner = o.owner;
  }
  for (const p of [0, 1] as PlayerId[]) {
    const n = s.tiles.filter((t) => t.terrain === 'relay' && t.relayOwner === p).length;
    if (n) { s.stats.relayDrain[p] += n; loseResolve(s, other(p), n * RULES.relayDrain, 'relays held by enemy'); }
    const hq = s.formations.find((f) => f.owner === other(p) && has(f, 'hq'));
    const bt = hq ? adjFormations(s, hq.pos).filter((f) => f.owner === p && !f.broken).length : 0;
    if (bt) { s.stats.breakthrough[p] += bt; loseResolve(s, other(p), bt * RULES.siegeDrain, 'HQ besieged'); }
  }
  if (s.winner !== null) return;
  // 6. round end
  if (s.round >= RULES.maxRounds) {
    const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
    if (r0 !== r1) return end(s, r0 > r1 ? 0 : 1, 'time: higher Resolve');
    const rl = (p: PlayerId) => s.tiles.filter((t) => t.relayOwner === p).length;
    if (rl(0) !== rl(1)) return end(s, rl(0) > rl(1) ? 0 : 1, 'time: relays');
    const cc = (p: PlayerId) => s.formations.filter((f) => f.owner === p).reduce((a, f) => a + f.cards.length, 0);
    if (cc(0) !== cc(1)) return end(s, cc(0) > cc(1) ? 0 : 1, 'time: cards on board');
    return end(s, -1, 'time: dead even');
  }
  const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
  s.initiative = r0 < r1 ? 0 : r1 < r0 ? 1 : other(s.initiative);
  s.round++;
  s.events.push({ t: 'round', round: s.round });
  while (s.pendingEscalations > 0) { s.stakes = Math.min(RULES.maxStakes, s.stakes * 2); s.pendingEscalations--; }
  if (s.round === RULES.maxRounds) s.stakes = Math.min(RULES.maxStakes, s.stakes * 2);
  for (const p of [0, 1] as PlayerId[]) {
    const pl = s.players[p];
    const relays = s.tiles.filter((t) => t.terrain === 'relay' && t.relayOwner === p).length;
    pl.cp = Math.min(RULES.carryOver, pl.cp) + cpForRound(s.round) + relays;
    draw(s, p);
  }
  s.phase = 'orders';
  s.attackedThisRound = [];
}

function flee(s: GameState, f: Formation) {
  if (inHome(f.owner, f.pos)) return;
  const steps = Math.max(1, leadDef(f).keywords.includes('immobile') ? 0 : leadDef(f).speed);
  const edge = homeEdge(f.owner);
  for (let i = 0; i < steps; i++) {
    if (inHome(f.owner, f.pos)) break;
    const cands = neighbors(f.pos).filter((n) =>
      Math.abs(n.row - edge) < Math.abs(f.pos.row - edge) &&
      !formationAt(s, n) &&
      Math.abs(elev(s, n) - elev(s, f.pos)) <= 1 &&
      !neighbors(n).some((m) => { const o = formationAt(s, m); return o && o.owner !== f.owner && !o.broken; }));
    if (!cands.length || leadDef(f).keywords.includes('immobile')) {
      if (i === 0) surrender(s, f);
      return;
    }
    const to = cands[0];
    s.events.push({ t: 'move', fid: f.fid, from: f.pos, to });
    f.pos = to;
  }
}

function surrender(s: GameState, f: Formation) {
  s.log.push(`#${f.fid} (P${f.owner}) is ENCIRCLED and surrenders`);
  s.stats.surrenders[f.owner]++;
  const n = f.cards.length;
  for (const c of f.cards) s.players[f.owner].discard.push(c.id);
  s.stats.cardsLost[f.owner] += n;
  f.cards = [];
  s.formations = s.formations.filter((o) => o !== f);
  s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
  loseResolve(s, f.owner, n * RULES.cardDeathCost, 'surrender');
}

function feral(s: GameState, f: Formation) {
  const adj = adjFormations(s, f.pos);
  if (adj.length) {
    const t = adj.sort((a, b) => (a.owner === f.owner ? 1 : 0) - (b.owner === f.owner ? 1 : 0) || a.morale - b.morale)[0];
    if (t.owner !== f.owner) { if (leadDef(f).range >= 1) doAttack(s, f, t, 0, { noSpecial: true }); }
    else { applyDamage(s, t, Math.max(1, leadDef(f).power)); }
    return;
  }
  if (leadDef(f).keywords.includes('immobile')) return;
  const others = s.formations.filter((o) => o !== f);
  if (!others.length) return;
  const nearest = others.sort((a, b) => distance(a.pos, f.pos) - distance(b.pos, f.pos))[0];
  const step = neighbors(f.pos).filter((n) => !formationAt(s, n) && Math.abs(elev(s, n) - elev(s, f.pos)) <= 1)
    .sort((a, b) => distance(a, nearest.pos) - distance(b, nearest.pos))[0];
  if (step && distance(step, nearest.pos) < distance(f.pos, nearest.pos)) {
    s.events.push({ t: 'move', fid: f.fid, from: f.pos, to: step });
    f.pos = step;
  }
}

/** Hush don't rout: they melt away. The Lead slips back to hand (if not caught);
 *  the rest of the stack is lost. */
function vanish(s: GameState, f: Formation) {
  if (adjEnemies(s, f).length) { s.log.push(`#${f.fid} is caught before it can vanish`); return surrender(s, f); }
  const pl = s.players[f.owner];
  const top = f.cards.pop()!;
  top.dmg = 0; top.grow = 0;
  if (!top.token) { if (pl.hand.length < RULES.handMax) pl.hand.push(top); else pl.discard.push(top.id); }
  for (const c of f.cards) if (!c.token) pl.discard.push(c.id);
  s.stats.cardsLost[f.owner] += f.cards.length;
  s.formations = s.formations.filter((o) => o !== f);
  s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
  s.log.push(`#${f.fid} (P${f.owner}) vanishes`);
}

// ───────────────────────── views ─────────────────────────
/** Redact hidden info for a given viewer. */
export function viewFor(s: GameState, viewer: PlayerId): GameState {
  const v: GameState = JSON.parse(JSON.stringify(s));
  const opp = v.players[other(viewer)];
  opp.hand = opp.hand.map(() => ({ uid: -1, id: '?', dmg: 0 }));
  opp.deck = opp.deck.map(() => ({ uid: -1, id: '?', dmg: 0 }));
  opp.orders = opp.orders ? { deploys: [], escalate: false } : null;
  for (const p of v.players) p.deck = p.deck.map(() => ({ uid: -1, id: '?', dmg: 0 }));
  for (const f of v.formations)
    if (f.owner !== viewer && f.cloaked) { f.cards = [{ uid: -1, id: '?', dmg: 0 }]; f.morale = -1; }
  v.rng = 0;
  return v;
}

export function clone(s: GameState): GameState {
  return structuredClone(s);
}
