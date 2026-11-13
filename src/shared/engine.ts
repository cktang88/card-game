// Shatterline rules engine (v0.2 — auto-resolve).
//
// A round:   ORDERS (both players secretly place cards) → REVEAL → RESOLVE
//            RESOLVE = Advance → Ranged volley → Melee clash → Routs → Upkeep
// The only player decisions are what to play, where, and the stakes.

import { CARD_BY_ID, CardDef, Faction, HQ_ID, Keyword, isHeavy, isTactic, rangeOf, speedOf, starterDeck } from './cards';
import { Pos, ROWS, allHexes, distance, inBounds, key, lineBetween, neighbors, samePos } from './hex';
import { Terrain, buildMap } from './map';

// ───────────────────────── tunables ─────────────────────────
export const RULES = {
  maxRounds: 8,
  startResolve: 16,
  handStart: 5,
  handMax: 8,
  drawPerRound: 2,
  stackMax: 3,
  swarmStackMax: 5,
  breakCost: 3,
  broodBreakCost: 1,
  synapseLossCost: 3,
  cardDeathCost: 1,
  hqLossCost: 6,
  siegeDrain: 1,
  relayDrain: 1,
  cpCap: 7,
  carryOver: 1,
  maxStakes: 8,
  ambush: 2,
  flank: 1,
  feralPower: 1,
};
export const cpForRound = (round: number) => Math.min(round + 1, RULES.cpCap);

// ───────────────────────── types ─────────────────────────
export type PlayerId = 0 | 1;

export interface CardInst { uid: number; id: string; dmg: number; grow?: number; token?: boolean }

export interface Buffs { power: number; hold: boolean; charge: boolean; speed: number; confused: boolean }
const noBuffs = (): Buffs => ({ power: 0, hold: false, charge: false, speed: 0, confused: false });

export interface Formation {
  fid: number;
  owner: PlayerId;
  pos: Pos;
  cards: CardInst[];      // bottom → top; last is the Lead
  morale: number;         // current Nerve
  broken: boolean;
  deployedRound: number;
  cloaked: boolean;
  moved: boolean;         // moved this round (for Charge)
  buffs: Buffs;
}

export interface Tile { pos: Pos; elev: number; terrain: Terrain; fortified: boolean; melted: boolean; relayOwner: -1 | PlayerId }

export interface DeployOrder { uid: number; pos: Pos }
export interface Orders { deploys: DeployOrder[]; escalate?: boolean }

export interface Inbound { owner: PlayerId; pos: Pos; card: CardInst }

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

export type Step = 'reveal' | 'advance' | 'ranged' | 'melee' | 'rout' | 'upkeep';

export type GameEvent =
  | { t: 'step'; step: Step }
  | { t: 'deploy'; fid: number; pos: Pos; id: string; reinforce: boolean; owner: PlayerId }
  | { t: 'inbound'; pos: Pos; owner: PlayerId }
  | { t: 'tactic'; id: string; pos: Pos; owner: PlayerId }
  | { t: 'move'; fid: number; from: Pos; to: Pos }
  | { t: 'strike'; fid: number; target: number; from: Pos; to: Pos; amount: number; lethal: boolean }
  | { t: 'shock'; fid: number; pos: Pos; amount: number }
  | { t: 'damage'; fid: number; pos: Pos; amount: number }
  | { t: 'break'; fid: number; pos: Pos }
  | { t: 'destroy'; fid: number; pos: Pos }
  | { t: 'surrender'; fid: number; pos: Pos }
  | { t: 'rally'; fid: number; pos: Pos }
  | { t: 'reveal'; fid: number; pos: Pos }
  | { t: 'evolve'; fid: number; pos: Pos }
  | { t: 'resolve'; player: PlayerId; delta: number; reason: string }
  | { t: 'round'; round: number };

export interface GameState {
  rng: number;
  round: number;
  phase: 'orders' | 'over';
  players: [PlayerState, PlayerState];
  tiles: Tile[];
  formations: Formation[];
  inbound: Inbound[];
  nextId: number;
  initiative: PlayerId;
  stakes: number;
  pendingEscalations: number;
  winner: null | -1 | PlayerId;
  endReason: string;
  fedThisRound: number[];
  log: string[];
  events: GameEvent[];
  stats: { breaks: [number, number]; cardsLost: [number, number]; surrenders: [number, number]; resolveBy: Record<string, number> };
}

export type Action =
  | { type: 'orders'; player: PlayerId; orders: Orders }
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
export const HQ_POS: [Pos, Pos] = [{ col: 2, row: ROWS - 1 }, { col: 3, row: 0 }];

export function newGame(f0: Faction, f1: Faction, seed = Date.now() & 0xffffffff, decks?: [string[], string[]]): GameState {
  const map = buildMap();
  const s: GameState = {
    rng: seed, round: 1, phase: 'orders',
    players: [mkPlayer(f0), mkPlayer(f1)],
    tiles: allHexes().map((pos) => ({ pos, elev: map.get(key(pos))!.elev, terrain: map.get(key(pos))!.terrain, fortified: false, melted: false, relayOwner: -1 })),
    formations: [], inbound: [], nextId: 1, initiative: 0, stakes: 1, pendingEscalations: 0,
    winner: null, endReason: '', fedThisRound: [], log: [], events: [],
    stats: { breaks: [0, 0], cardsLost: [0, 0], surrenders: [0, 0], resolveBy: {} },
  };
  s.initiative = rand(s) < 0.5 ? 0 : 1;
  for (const p of [0, 1] as PlayerId[]) {
    s.formations.push(mkFormation(s, p, HQ_POS[p], { uid: s.nextId++, id: HQ_ID[s.players[p].faction], dmg: 0, token: true }, 0));
    const ids = decks?.[p] ?? starterDeck(s.players[p].faction);
    s.players[p].deck = ids.map((id) => ({ uid: s.nextId++, id, dmg: 0 }));
    shuffle(s, s.players[p].deck);
    for (let i = 0; i < RULES.handStart; i++) draw(s, p);
    s.players[p].cp = cpForRound(1);
  }
  return s;
}

function mkPlayer(f: Faction): PlayerState {
  return { faction: f, deck: [], hand: [], discard: [], resolve: RULES.startResolve, cp: 0, escalateUsed: false, orders: null };
}

function mkFormation(s: GameState, owner: PlayerId, pos: Pos, card: CardInst, round: number): Formation {
  const d = def(card);
  return { fid: s.nextId++, owner, pos: { ...pos }, cards: [card], morale: d.nerve, broken: false, deployedRound: round,
    cloaked: s.players[owner].faction === 'hush' && d.cls !== 'HQ', moved: false, buffs: noBuffs() };
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
export const cardPower = (c: CardInst) => def(c).power + (c.grow ?? 0) - c.dmg;
export const power = (f: Formation) => f.cards.reduce((a, c) => a + Math.max(0, cardPower(c)), 0);
export const maxNerve = (f: Formation) => f.cards.reduce((a, c) => a + def(c).nerve, 0);
const isFearlessBase = (f: Formation) => has(f, 'fearless') || has(f, 'hq');
export const isShaken = (f: Formation) => !f.broken && !isFearlessBase(f) && f.morale <= Math.floor(maxNerve(f) / 2);
export const faction = (s: GameState, f: Formation) => s.players[f.owner].faction;

export function tileAt(s: GameState, p: Pos): Tile { return s.tiles.find((t) => samePos(t.pos, p))!; }
export function formationAt(s: GameState, p: Pos): Formation | undefined { return s.formations.find((f) => samePos(f.pos, p)); }
export function getF(s: GameState, fid: number) { return s.formations.find((f) => f.fid === fid); }
export const elev = (s: GameState, p: Pos) => tileAt(s, p).elev;
export const alive = (s: GameState, f: Formation) => s.formations.includes(f);

export function homeRows(p: PlayerId): number[] { return p === 0 ? [ROWS - 1, ROWS - 2] : [0, 1]; }
export const homeEdge = (p: PlayerId) => (p === 0 ? ROWS - 1 : 0);
export const inHome = (p: PlayerId, pos: Pos) => homeRows(p).includes(pos.row);
/** P0 attacks "up" the board (row decreasing), P1 attacks "down". */
export const fwd = (p: PlayerId) => (p === 0 ? -1 : 1);
export const inFrontArc = (f: Formation, p: Pos) => distance(f.pos, p) === 1 && p.row === f.pos.row + fwd(f.owner);

export function adjFormations(s: GameState, pos: Pos): Formation[] {
  return neighbors(pos).map((n) => formationAt(s, n)).filter((x): x is Formation => !!x);
}
const adjEnemies = (s: GameState, f: Formation) => adjFormations(s, f.pos).filter((o) => o.owner !== f.owner && !o.broken);
const adjFriends = (s: GameState, f: Formation) => adjFormations(s, f.pos).filter((o) => o.owner === f.owner && !o.broken);

export function linkSource(s: GameState, f: Formation): Formation | undefined {
  if (faction(s, f) !== 'brood') return undefined;
  return s.formations.find((o) => o !== f && o.owner === f.owner && !o.broken &&
    (has(o, 'synapse') || has(o, 'synapseBig')) && distance(o.pos, f.pos) <= (has(o, 'synapseBig') ? 3 : 2));
}
export const isLinked = (s: GameState, f: Formation) => !!linkSource(s, f);
/** Fearless formations never lose Nerve: Shock hits them as damage instead. */
export const isFearless = (s: GameState, f: Formation) => isFearlessBase(f) || isLinked(s, f);

export function inFiringLine(s: GameState, f: Formation): boolean {
  if (faction(s, f) !== 'concord' || has(f, 'hq')) return false;
  // 3+ Concord formations side by side in the same row
  let n = 1;
  for (const dc of [-1, 1]) {
    for (let k = 1; k < 3; k++) {
      const o = formationAt(s, { col: f.pos.col + dc * k, row: f.pos.row });
      if (!o || o.owner !== f.owner || o.broken || has(o, 'hq')) break;
      n++;
    }
  }
  return n >= 3;
}

export function isCreep(s: GameState, pos: Pos, owner: PlayerId): boolean {
  return adjFormations(s, pos).some((o) => o.owner === owner && has(o, 'creep'));
}

export function hasCover(s: GameState, f: Formation): boolean {
  const t = tileAt(s, f.pos);
  if (!t.melted && (t.terrain === 'ruins' || t.fortified)) return true;
  if (leadDef(f).cls === 'Infantry' && adjFriends(s, f).some((o) => has(o, 'coverAura'))) return true;
  return false;
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

/** Enemies this formation could strike from where it stands. */
export function targetsInReach(s: GameState, f: Formation): Formation[] {
  const d = leadDef(f);
  const r = rangeOf(d);
  if (r === 0 || f.broken) return [];
  const indirect = d.keywords.includes('indirect');
  return s.formations.filter((o) => {
    if (o.owner === f.owner) return false;
    const dist = distance(o.pos, f.pos);
    if (dist === 1) return true;
    if (dist > r) return false;
    if (o.cloaked && !indirect) return false;
    return hasLOS(s, f.pos, o.pos, indirect);
  });
}

/** THE targeting rule (same for everyone, keywords excepted):
 *  nearest → in front arc → lowest Nerve → leftmost. Hunters pick the costliest. */
export function chooseTarget(s: GameState, f: Formation): Formation | undefined {
  const ts = targetsInReach(s, f);
  if (!ts.length) return undefined;
  const hunter = has(f, 'hunter');
  const score = (o: Formation) => [
    hunter ? -leadDef(o).cost : 0,
    distance(o.pos, f.pos),
    inFrontArc(f, o.pos) ? 0 : 1,
    has(o, 'hq') ? 1 : 0,
    o.cloaked ? 99 : (isFearless(s, o) ? 50 + power(o) : o.morale),
    o.pos.col,
    o.pos.row,
  ];
  return ts.sort((a, b) => {
    const A = score(a), B = score(b);
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return A[i] - B[i];
    return 0;
  })[0];
}

// ───────────────────────── resolve / win ─────────────────────────
function loseResolve(s: GameState, p: PlayerId, n: number, reason: string) {
  if (n <= 0 || s.winner !== null) return;
  s.players[p].resolve -= n;
  const cat = /broke/.test(reason) ? 'morale' : /surrender/.test(reason) ? 'surrender' : /relay/.test(reason) ? 'relays' : /besieged/.test(reason) ? 'siege' : 'kills';
  s.stats.resolveBy[cat] = (s.stats.resolveBy[cat] ?? 0) + n;
  s.events.push({ t: 'resolve', player: p, delta: -n, reason });
  s.log.push(`P${p} −${n} Resolve (${reason}) → ${s.players[p].resolve}`);
}

function checkWin(s: GameState) {
  if (s.winner !== null) return;
  const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
  if (r0 <= 0 && r1 <= 0) end(s, r0 === r1 ? -1 : r0 > r1 ? 0 : 1, 'mutual collapse');
  else if (r0 <= 0) end(s, 1, 'army collapsed');
  else if (r1 <= 0) end(s, 0, 'army collapsed');
}

function end(s: GameState, w: -1 | PlayerId, reason: string) {
  s.winner = w; s.endReason = reason; s.phase = 'over';
  s.log.push(`GAME OVER: ${w === -1 ? 'draw' : 'P' + w + ' wins'} (${reason}), stakes ${s.stakes}`);
}

// ───────────────────────── damage, shock, breaks ─────────────────────────
function removeFormation(s: GameState, f: Formation) {
  s.formations = s.formations.filter((o) => o !== f);
}

/** Returns number of cards killed. */
function applyDamage(s: GameState, f: Formation, amount: number): number {
  if (amount <= 0 || !alive(s, f)) return 0;
  if (has(f, 'decoy')) { vanishDecoy(s, f); return 0; }
  s.events.push({ t: 'damage', fid: f.fid, pos: f.pos, amount });
  let killed = 0;
  while (amount > 0 && f.cards.length) {
    const top = lead(f);
    const take = Math.min(cardPower(top), amount);
    top.dmg += take; amount -= take;
    if (cardPower(top) <= 0) {
      f.cards.pop(); killed++;
      if (!top.token) s.players[f.owner].discard.push(top.id);
      s.stats.cardsLost[f.owner]++;
      const d = def(top);
      const cost = d.cls === 'HQ' ? RULES.hqLossCost : top.token ? 0 : d.cls === 'Synapse' ? RULES.synapseLossCost : RULES.cardDeathCost;
      loseResolve(s, f.owner, cost, `${d.name} destroyed`);
    }
  }
  if (!f.cards.length) {
    removeFormation(s, f);
    s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
    s.log.push(`#${f.fid} (P${f.owner}) wiped out`);
    // Watching a unit get wiped out shakes its neighbours.
    for (const o of adjFormations(s, f.pos)) if (o.owner === f.owner) panic(s, o, 1);
  } else {
    f.morale = Math.min(f.morale, maxNerve(f));
    if (killed) panic(s, f, 1);
  }
  return killed;
}

/** Morale damage from an attack or effect. Fearless formations take it as damage instead. */
function applyShock(s: GameState, f: Formation, amount: number, opts: { dirge?: boolean } = {}): void {
  if (amount <= 0 || !alive(s, f) || f.broken) return;
  if (has(f, 'decoy')) { vanishDecoy(s, f); return; }
  if (!opts.dirge && adjFriends(s, f).some((o) => has(o, 'standard'))) amount -= 1;
  if (amount <= 0) return;
  if (isFearless(s, f)) {
    // Linked Brood shrug off half of it; structures/HQs take it all.
    applyDamage(s, f, isFearlessBase(f) ? amount : Math.floor(amount / 2));
    return;
  }
  f.morale -= amount;
  s.events.push({ t: 'shock', fid: f.fid, pos: f.pos, amount });
  if (f.morale <= 0) breakFormation(s, f);
}

/** Panic: small morale knock from seeing friends fall. Fearless ignore it entirely. */
function panic(s: GameState, f: Formation, n: number) {
  if (!alive(s, f) || f.broken || isFearless(s, f) || has(f, 'decoy')) return;
  f.morale -= n;
  s.events.push({ t: 'shock', fid: f.fid, pos: f.pos, amount: n });
  if (f.morale <= 0) breakFormation(s, f);
}

function breakFormation(s: GameState, f: Formation) {
  f.broken = true; f.morale = 0;
  s.stats.breaks[f.owner]++;
  s.events.push({ t: 'break', fid: f.fid, pos: f.pos });
  const d = leadDef(f);
  const fac = faction(s, f);
  const cost = f.cards.every((c) => c.token) ? 0 : fac === 'brood' ? (d.cls === 'Synapse' ? RULES.synapseLossCost : RULES.broodBreakCost) : RULES.breakCost;
  s.log.push(`#${f.fid} ${d.name} (P${f.owner}) BREAKS`);
  loseResolve(s, f.owner, cost, `${d.name} broke`);
  for (const o of adjFormations(s, f.pos)) if (o.owner === f.owner) panic(s, o, 1);
}

function vanishDecoy(s: GameState, f: Formation) {
  if (!alive(s, f)) return;
  removeFormation(s, f);
  for (const c of f.cards) if (!c.token) s.players[f.owner].discard.push(c.id);
  s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
  s.log.push(`#${f.fid} was only a Phantom`);
  for (const o of adjFormations(s, f.pos)) if (o.owner !== f.owner) panic(s, o, 1);
}

export function uncloak(s: GameState, f: Formation) {
  if (!f.cloaked || !alive(s, f)) return;
  f.cloaked = false;
  s.events.push({ t: 'reveal', fid: f.fid, pos: f.pos });
  if (has(f, 'decoy')) return vanishDecoy(s, f);
  if (has(f, 'nightmare'))
    for (const o of [...s.formations]) if (o.owner !== f.owner && distance(o.pos, f.pos) <= 2) applyShock(s, o, 1);
  if (has(f, 'echo')) {
    const spot = neighbors(f.pos).find((n) => !formationAt(s, n));
    if (spot) spawnToken(s, f.owner, spot, 'v_phantom');
  }
}

function spawnToken(s: GameState, owner: PlayerId, pos: Pos, id: string): Formation {
  const nf = mkFormation(s, owner, pos, { uid: s.nextId++, id, dmg: 0, token: true }, s.round);
  s.formations.push(nf);
  s.events.push({ t: 'deploy', fid: nf.fid, pos, id, reinforce: false, owner });
  return nf;
}

// ───────────────────────── strike math ─────────────────────────
export interface StrikePlan { a: Formation; ad: CardDef; t: Formation; amount: number; lethal: boolean; dirge: boolean }

export function strikeValue(s: GameState, a: Formation, t: Formation): { amount: number; lethal: boolean } {
  const ad = leadDef(a);
  const melee = distance(a.pos, t.pos) === 1;
  let v = power(a) + a.buffs.power;
  if (inFiringLine(s, a)) v += 1;
  const link = linkSource(s, a);
  if (link && has(link, 'synapseBig')) v += 1;
  if (adjFriends(s, a).some((o) => has(o, 'officerAura'))) v += 1;
  if (ad.keywords.includes('frenzy'))
    v += adjFormations(s, t.pos).filter((o) => o.owner === a.owner && o !== a && !o.broken && faction(s, o) === 'brood').length;
  if ((ad.keywords.includes('charge') || a.buffs.charge) && a.moved && melee) v += 2;
  if (isShaken(a)) v -= 1;
  if (a.broken && faction(s, a) === 'brood') v += RULES.feralPower;
  // position
  if (!inFrontArc(t, a.pos) && !has(t, 'unflankable') && !isFearlessBase(t)) v += RULES.flank;
  const ea = elev(s, a.pos), et = elev(s, t.pos);
  if (ea > et) v += 1; else if (et > ea) v -= 1;
  if (!melee && hasCover(s, t) && !ad.keywords.includes('ignoreCover')) v -= 1;
  if (!ad.keywords.includes('dirge') && adjFriends(s, t).length >= 2) v -= 1;
  if (t.buffs.hold && melee) v -= 1;
  let lethal = ad.keywords.includes('lethal') || t.broken;
  if (a.cloaked && !ad.keywords.includes('silent')) {
    v += RULES.ambush;
    if (ad.keywords.includes('assassinate') && ['Officer', 'Synapse'].includes(leadDef(t).cls)) { v += 3; lethal = true; }
  }
  if (ad.keywords.includes('breach') && (leadDef(t).cls === 'Structure' || has(t, 'hq'))) v += 3;
  if (ad.keywords.includes('terror') && isShaken(t)) v *= 2;
  return { amount: Math.max(0, v), lethal };
}

function canStrike(f: Formation): boolean {
  return !f.broken && !f.buffs.confused && rangeOf(leadDef(f)) > 0;
}

function resolveStrikes(s: GameState, rangedStep: boolean) {
  const plans: StrikePlan[] = [];
  for (const f of s.formations) {
    if (!canStrike(f)) continue;
    const isRanged = rangeOf(leadDef(f)) >= 2;
    const engaged = adjEnemies(s, f).length > 0;
    // Ranged units fire in the volley step unless enemies are in their face,
    // in which case they fight at point blank in the melee step.
    const myStep = isRanged && !engaged;
    if (myStep !== rangedStep) continue;
    if (has(f, 'shriek')) {
      for (const e of adjFormations(s, f.pos).filter((o) => o.owner !== f.owner)) {
        const v = strikeValue(s, f, e);
        plans.push({ a: f, ad: leadDef(f), t: e, amount: v.amount, lethal: v.lethal, dirge: false });
      }
      continue;
    }
    const t = chooseTarget(s, f);
    if (!t) continue;
    const v = strikeValue(s, f, t);
    plans.push({ a: f, ad: leadDef(f), t, amount: v.amount, lethal: v.lethal, dirge: has(f, 'dirge') });
  }
  // volley: +1 if another ally hits the same target
  for (const p of plans) if (p.ad.keywords.includes('volley') && plans.some((q) => q !== p && q.t === p.t)) p.amount += 1;
  // apply simultaneously
  const cloakedAttackers = new Set<Formation>();
  for (const p of plans) {
    if (!alive(s, p.t)) continue;
    s.events.push({ t: 'strike', fid: p.a.fid, target: p.t.fid, from: { ...p.a.pos }, to: { ...p.t.pos }, amount: p.amount, lethal: p.lethal });
    s.log.push(`${p.ad.name}(#${p.a.fid}) → ${leadDef(p.t).name}(#${p.t.fid}) ${p.amount}${p.lethal ? ' lethal' : ''}`);
    if (p.a.cloaked && !p.ad.keywords.includes('silent')) cloakedAttackers.add(p.a);
    if (p.t.cloaked) uncloak(s, p.t);
    if (!alive(s, p.t)) continue;
    if (faction(s, p.a) === 'brood' && p.amount > 0 && !s.fedThisRound.includes(p.a.fid)) s.fedThisRound.push(p.a.fid);
    if (p.lethal || p.t.broken) {
      const k = applyDamage(s, p.t, p.amount);
      if (k && p.ad.keywords.includes('devour') && alive(s, p.a)) {
        const top = lead(p.a); top.dmg = Math.max(0, top.dmg - 3);
        for (const e of adjEnemies(s, p.a)) applyShock(s, e, 2);
      }
    } else applyShock(s, p.t, p.amount, { dirge: p.dirge });
    if (p.ad.keywords.includes('barrage')) for (const o of adjFormations(s, p.t.pos)) if (o !== p.a) panic(s, o, 1);
    if (p.ad.keywords.includes('meltCover')) { const tt = tileAt(s, p.t.pos); tt.melted = true; tt.fortified = false; }
  }
  for (const a of cloakedAttackers) uncloak(s, a);
}

// ───────────────────────── advance ─────────────────────────
function goals(s: GameState, f: Formation): Pos[] {
  const enemies = s.formations.filter((o) => o.owner !== f.owner).map((o) => o.pos);
  const relays = s.tiles.filter((t) => t.terrain === 'relay' && t.relayOwner !== f.owner && !formationAt(s, t.pos)).map((t) => t.pos);
  return [...enemies, ...relays];
}

function canAdvance(s: GameState, f: Formation): boolean {
  const d = leadDef(f);
  if (f.broken || f.buffs.hold || f.buffs.confused || d.keywords.includes('immobile') || speedOf(d) === 0) return false;
  if (d.keywords.includes('digIn')) return false;
  if (f.deployedRound === s.round) return false;
  if (isShaken(f)) return false;
  if (tileAt(s, f.pos).terrain === 'relay') return false; // hold objectives
  if (targetsInReach(s, f).length) return false;
  return true;
}

function stepToward(s: GameState, f: Formation, gs: Pos[]): Pos | undefined {
  if (!gs.length) return undefined;
  const d = leadDef(f);
  const flying = d.keywords.includes('flying') || d.keywords.includes('burrow');
  const dist = (p: Pos) => Math.min(...gs.map((g) => distance(g, p)));
  const cur = dist(f.pos);
  const cands = neighbors(f.pos).filter((n) => !formationAt(s, n) && (flying || Math.abs(elev(s, n) - elev(s, f.pos)) <= 1) && dist(n) < cur);
  if (!cands.length) return undefined;
  const ranged = rangeOf(d) >= 2;
  cands.sort((a, b) => dist(a) - dist(b) || (ranged ? elev(s, b) - elev(s, a) : 0) || a.col - b.col);
  return cands[0];
}

function advanceAll(s: GameState) {
  const order = [...s.formations].sort((a, b) => (a.owner === s.initiative ? 0 : 1) - (b.owner === s.initiative ? 0 : 1) || a.fid - b.fid);
  for (const f of order) {
    if (!alive(s, f) || !canAdvance(s, f)) continue;
    const d = leadDef(f);
    const steps = speedOf(d) + f.buffs.speed;
    const ignoreZoc = d.keywords.includes('flying') || d.keywords.includes('burrow');
    for (let i = 0; i < steps; i++) {
      const to = stepToward(s, f, goals(s, f));
      if (!to) break;
      s.events.push({ t: 'move', fid: f.fid, from: { ...f.pos }, to });
      f.pos = to; f.moved = true;
      // stepping next to a cloaked enemy spots it
      for (const o of adjFormations(s, f.pos)) if (o.owner !== f.owner && o.cloaked) uncloak(s, o);
      if (!alive(s, f)) break;
      if (tileAt(s, f.pos).terrain === 'crater' && !d.keywords.includes('flying')) break;
      if (tileAt(s, f.pos).terrain === 'relay') break;
      if (!ignoreZoc && adjEnemies(s, f).length) break;
      if (targetsInReach(s, f).length) break;
    }
  }
}

// ───────────────────────── orders ─────────────────────────
export function stackLimit(cards: CardInst[]): number {
  if (cards.every((c) => def(c).keywords.includes('swarm5'))) return RULES.swarmStackMax;
  if (cards.some((c) => ['Structure', 'Illusion', 'HQ'].includes(def(c).cls))) return 1;
  return RULES.stackMax;
}

export function canReinforce(f: Formation, card: CardDef): boolean {
  const ld = leadDef(f);
  if (['Structure', 'Illusion', 'HQ'].includes(ld.cls) || ['Structure', 'Illusion', 'Tactic'].includes(card.cls)) return false;
  const ok = card.cls === 'Officer' || f.cards.every((c) => def(c).cls === card.cls || def(c).cls === 'Officer');
  if (!ok) return false;
  return f.cards.length < stackLimit([...f.cards, { uid: 0, id: card.id, dmg: 0 }]);
}

export function tacticTargetOk(s: GameState, p: PlayerId, card: CardDef, pos: Pos): boolean {
  const occ = formationAt(s, pos);
  const k = card.tactic!.kind;
  if (!occ) return false;
  if (k === 'falseOrders') return occ.owner !== p && !occ.cloaked && !has(occ, 'hq');
  if (occ.owner !== p) return false;
  if (k === 'scream') return has(occ, 'synapse') || has(occ, 'synapseBig');
  if (k === 'broadcast' || k === 'knives' || k === 'spawning') return true;
  return !has(occ, 'hq');
}

/** Hive-style placement: a new formation must touch one of your formations
 *  and must not touch an enemy (Infiltrate and spawn structures relax that). */
export function canDeployAt(s: GameState, p: PlayerId, card: CardDef, pos: Pos): boolean {
  if (!inBounds(pos)) return false;
  if (isTactic(card)) return tacticTargetOk(s, p, card, pos);
  const occ = formationAt(s, pos);
  if (occ) return occ.owner === p && canReinforce(occ, card);
  if (s.inbound.some((i) => samePos(i.pos, pos))) return false;
  const adj = adjFormations(s, pos);
  const mine = adj.filter((o) => o.owner === p && !o.broken);
  const touchesEnemy = adj.some((o) => o.owner !== p);
  const infiltrate = card.keywords.includes('infiltrate');
  if (infiltrate && (isCreep(s, pos, p) || neighbors(pos).some((n) => isCreep(s, n, p)))) return true;
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
    const cd = def(c);
    if (!isTactic(cd)) {
      if (hexes.has(key(d.pos))) return 'one unit per hex per round';
      hexes.add(key(d.pos));
    }
    cost += cd.cost;
    if (!canDeployAt(s, p, cd, d.pos)) return `can't place ${cd.name} there`;
  }
  if (cost > pl.cp) return 'not enough Command';
  if (o.escalate && pl.escalateUsed) return 'already escalated';
  return null;
}

// ───────────────────────── apply ─────────────────────────
export function apply(s: GameState, a: Action): string | null {
  if (s.phase === 'over') return 'game over';
  if (a.type === 'retreat') {
    s.events = [];
    s.log.push(`P${a.player} sounds the retreat`);
    end(s, other(a.player), 'retreat');
    return null;
  }
  const err = validateOrders(s, a.player, a.orders);
  if (err) return err;
  s.players[a.player].orders = a.orders;
  if (s.players[0].orders && s.players[1].orders) resolveRound(s);
  return null;
}

function placeCard(s: GameState, p: PlayerId, c: CardInst, pos: Pos, landing: boolean) {
  const cd = def(c);
  const tgt = formationAt(s, pos);
  if (tgt && tgt.owner === p && canReinforce(tgt, cd)) {
    tgt.cards.push(c);
    if (tgt.broken) { tgt.broken = false; tgt.morale = Math.max(1, Math.floor(maxNerve(tgt) / 2)); s.events.push({ t: 'rally', fid: tgt.fid, pos: tgt.pos }); }
    else tgt.morale = Math.min(maxNerve(tgt), tgt.morale + cd.nerve);
    s.events.push({ t: 'deploy', fid: tgt.fid, pos, id: c.id, reinforce: true, owner: p });
    return;
  }
  let at = pos;
  if (tgt || (!landing && !canDeployAt(s, p, cd, pos))) {
    const alt = allHexes().filter((h) => !formationAt(s, h) && canDeployAt(s, p, cd, h)).sort((x, y) => distance(x, pos) - distance(y, pos))[0];
    if (!alt) { s.players[p].hand.push(c); s.players[p].cp += cd.cost; return; }
    at = alt;
  }
  const f = mkFormation(s, p, at, c, landing ? 0 : s.round);
  s.formations.push(f);
  if (cd.keywords.includes('digIn')) { tileAt(s, at).fortified = true; tileAt(s, at).melted = false; }
  s.events.push({ t: 'deploy', fid: f.fid, pos: at, id: c.id, reinforce: false, owner: p });
}

function applyTactic(s: GameState, p: PlayerId, c: CardInst, pos: Pos) {
  const cd = def(c);
  const tgt = formationAt(s, pos);
  s.events.push({ t: 'tactic', id: c.id, pos, owner: p });
  s.players[p].discard.push(c.id);
  switch (cd.tactic!.kind) {
    case 'overTheTop': if (tgt) { tgt.buffs.speed += 1; tgt.buffs.charge = true; tgt.deployedRound = 0; } break;
    case 'holdFast': if (tgt) { tgt.buffs.hold = true; tgt.morale += 3; } break;
    case 'broadcast':
      for (const o of s.formations) if (o.owner === p && distance(o.pos, pos) <= 2 && !isFearlessBase(o)) {
        if (o.broken) { o.broken = false; o.morale = 2; s.events.push({ t: 'rally', fid: o.fid, pos: o.pos }); }
        else o.morale = Math.min(maxNerve(o), o.morale + 2);
      }
      break;
    case 'spawning': if (tgt) for (let i = 0; i < 2; i++) { const spot = neighbors(tgt.pos).find((n) => !formationAt(s, n)); if (spot) spawnToken(s, p, spot, 'b_skitter'); } break;
    case 'pheromone': if (tgt) for (const o of [tgt, ...adjFriends(s, tgt)]) if (faction(s, o) === 'brood') o.buffs.power += 2; break;
    case 'scream': if (tgt) for (const e of adjEnemies(s, tgt)) applyShock(s, e, 2); break;
    case 'falseOrders': if (tgt && tgt.owner !== p) { tgt.buffs.confused = true; applyShock(s, tgt, 1); } break;
    case 'smoke': if (tgt) { tgt.cloaked = true; const spot = neighbors(tgt.pos).find((n) => !formationAt(s, n)); if (spot) spawnToken(s, p, spot, 'v_phantom'); } break;
    case 'knives': for (const o of s.formations) if (o.owner === p && o.cloaked) o.buffs.power += 2; break;
  }
}

function resolveRound(s: GameState) {
  s.events = [];
  s.fedThisRound = [];
  for (const f of s.formations) { f.buffs = noBuffs(); f.moved = false; }

  // ── REVEAL ──
  s.events.push({ t: 'step', step: 'reveal' });
  const landing = s.inbound; s.inbound = [];
  for (const i of landing) placeCard(s, i.owner, i.card, i.pos, true);   // heavy drops land first
  for (const p of [s.initiative, other(s.initiative)]) {
    const pl = s.players[p];
    const o = pl.orders!;
    if (o.escalate && !pl.escalateUsed) { pl.escalateUsed = true; s.pendingEscalations++; s.log.push(`P${p} ESCALATES`); }
    const cardOf = (uid: number) => pl.hand.find((h) => h.uid === uid);
    // units first, then tactics (so tactics can target freshly placed units)
    const ordered = o.deploys.filter((d) => cardOf(d.uid))
      .sort((a, b) => Number(isTactic(def(cardOf(a.uid)!))) - Number(isTactic(def(cardOf(b.uid)!))));
    for (const d of ordered) {
      const idx = pl.hand.findIndex((h) => h.uid === d.uid);
      if (idx < 0) continue;
      const c = pl.hand[idx];
      const cd = def(c);
      if (cd.cost > pl.cp) continue;
      pl.hand.splice(idx, 1);
      pl.cp -= cd.cost;
      if (isTactic(cd)) { if (tacticTargetOk(s, p, cd, d.pos)) applyTactic(s, p, c, d.pos); else pl.discard.push(c.id); }
      else if (isHeavy(cd) && !formationAt(s, d.pos)) { s.inbound.push({ owner: p, pos: d.pos, card: c }); s.events.push({ t: 'inbound', pos: d.pos, owner: p }); }
      else placeCard(s, p, c, d.pos, false);
    }
    pl.orders = null;
  }
  if (finishIfOver(s)) return;

  s.events.push({ t: 'step', step: 'advance' });
  advanceAll(s);
  if (finishIfOver(s)) return;

  s.events.push({ t: 'step', step: 'ranged' });
  resolveStrikes(s, true);
  if (finishIfOver(s)) return;

  s.events.push({ t: 'step', step: 'melee' });
  resolveStrikes(s, false);
  if (finishIfOver(s)) return;

  s.events.push({ t: 'step', step: 'rout' });
  for (const f of [...s.formations]) {
    if (!f.broken || !alive(s, f)) continue;
    const fac = faction(s, f);
    if (fac === 'concord') flee(s, f);
    else if (fac === 'brood') feral(s, f);
    else vanish(s, f);
  }
  if (finishIfOver(s)) return;

  s.events.push({ t: 'step', step: 'upkeep' });
  upkeep(s);
  if (finishIfOver(s)) return;
  nextRound(s);
}

function finishIfOver(s: GameState): boolean {
  checkWin(s);
  return s.winner !== null;
}

function flee(s: GameState, f: Formation) {
  if (inHome(f.owner, f.pos)) return;
  const d = leadDef(f);
  const immobile = d.keywords.includes('immobile') || speedOf(d) === 0;
  const steps = Math.max(1, speedOf(d));
  const edge = homeEdge(f.owner);
  for (let i = 0; i < steps; i++) {
    if (inHome(f.owner, f.pos)) break;
    const cands = immobile ? [] : neighbors(f.pos).filter((n) =>
      Math.abs(n.row - edge) < Math.abs(f.pos.row - edge) && !formationAt(s, n) &&
      Math.abs(elev(s, n) - elev(s, f.pos)) <= 1 &&
      !neighbors(n).some((m) => { const o = formationAt(s, m); return o && o.owner !== f.owner && !o.broken; }));
    if (!cands.length) { if (i === 0) surrender(s, f); return; }
    const to = cands.sort((a, b) => a.col - b.col)[0];
    s.events.push({ t: 'move', fid: f.fid, from: { ...f.pos }, to });
    f.pos = to;
  }
}

function surrender(s: GameState, f: Formation) {
  s.log.push(`#${f.fid} (P${f.owner}) is ENCIRCLED and surrenders`);
  s.stats.surrenders[f.owner]++;
  const n = f.cards.filter((c) => !c.token).length;
  for (const c of f.cards) if (!c.token) s.players[f.owner].discard.push(c.id);
  s.stats.cardsLost[f.owner] += f.cards.length;
  removeFormation(s, f);
  s.events.push({ t: 'surrender', fid: f.fid, pos: f.pos });
  loseResolve(s, f.owner, Math.max(1, n) * RULES.cardDeathCost, 'surrender');
}

function feral(s: GameState, f: Formation) {
  const adj = adjFormations(s, f.pos).filter((o) => !has(o, 'hq') || o.owner !== f.owner);
  if (adj.length && rangeOf(leadDef(f)) > 0) {
    const t = adj.sort((a, b) => (a.owner === f.owner ? 1 : 0) - (b.owner === f.owner ? 1 : 0) || a.morale - b.morale)[0];
    const v = power(f) + RULES.feralPower;
    s.events.push({ t: 'strike', fid: f.fid, target: t.fid, from: { ...f.pos }, to: { ...t.pos }, amount: v, lethal: t.owner === f.owner });
    if (t.owner === f.owner) applyDamage(s, t, Math.max(1, Math.ceil(v / 2)));
    else applyShock(s, t, v);
    return;
  }
  if (leadDef(f).keywords.includes('immobile')) return;
  const others = s.formations.filter((o) => o !== f);
  const to = stepToward(s, f, others.map((o) => o.pos));
  if (to) { s.events.push({ t: 'move', fid: f.fid, from: { ...f.pos }, to }); f.pos = to; }
}

/** Hush don't rout: they melt away. The Lead slips back to hand (unless caught). */
function vanish(s: GameState, f: Formation) {
  if (adjEnemies(s, f).length) { s.log.push(`#${f.fid} is caught before it can vanish`); return surrender(s, f); }
  const pl = s.players[f.owner];
  const top = f.cards.pop()!;
  top.dmg = 0; top.grow = 0;
  if (!top.token) { if (pl.hand.length < RULES.handMax) pl.hand.push(top); else pl.discard.push(top.id); }
  for (const c of f.cards) if (!c.token) pl.discard.push(c.id);
  s.stats.cardsLost[f.owner] += f.cards.length;
  removeFormation(s, f);
  s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
  s.log.push(`#${f.fid} (P${f.owner}) vanishes`);
}

function upkeep(s: GameState) {
  // regroup / relink / officer rally
  for (const f of s.formations) {
    if (!f.broken) continue;
    const fac = faction(s, f);
    const officer = adjFriends(s, f).some((o) => has(o, 'rally'));
    if ((fac === 'concord' && (officer || (inHome(f.owner, f.pos) && adjEnemies(s, f).length === 0))) ||
        (fac === 'brood' && isLinked(s, f))) {
      f.broken = false; f.morale = Math.max(1, Math.floor(maxNerve(f) / 2));
      s.events.push({ t: 'rally', fid: f.fid, pos: f.pos });
    }
  }
  // recover
  for (const f of s.formations) {
    if (f.broken || isFearlessBase(f)) continue;
    const dreaded = s.formations.some((o) => o.owner !== f.owner && !o.broken && has(o, 'dread') && distance(o.pos, f.pos) <= 2);
    if (dreaded) continue;
    let gain = adjEnemies(s, f).length === 0 ? 1 : 0;
    if (s.formations.some((o) => o.owner === f.owner && !o.broken && distance(o.pos, f.pos) <= 2 && has(o, 'marshal'))) gain += 1;
    f.morale = Math.min(maxNerve(f), f.morale + gain);
  }
  // evolve
  for (const f of s.formations) {
    if (f.broken) continue;
    const top = lead(f);
    const fed = s.fedThisRound.includes(f.fid);
    const grub = has(f, 'grub');
    if ((fed || grub) && (top.grow ?? 0) < (grub ? 4 : 3)) { top.grow = (top.grow ?? 0) + 1; s.events.push({ t: 'evolve', fid: f.fid, pos: f.pos }); }
  }
  // brood hatcheries
  for (const f of [...s.formations]) {
    if (f.broken || !has(f, 'hatch')) continue;
    const kids = s.formations.filter((o) => o.owner === f.owner && leadDef(o).id === 'b_skitter' && lead(o).token).length;
    const spot = neighbors(f.pos).find((n) => !formationAt(s, n) && !adjFormations(s, n).some((o) => o.owner !== f.owner));
    if (kids < 2 && spot) spawnToken(s, f.owner, spot, 'b_skitter');
  }
  // stealth: spotted cloaks drop, then Fade / Shroud re-cloak, Mirage spawns
  for (const f of [...s.formations]) if (f.cloaked && adjEnemies(s, f).length) uncloak(s, f);
  for (const f of s.formations) {
    if (f.broken || f.cloaked || faction(s, f) !== 'hush' || has(f, 'hq')) continue;
    if (adjFriends(s, f).some((o) => has(o, 'shroud')) || (has(f, 'fade') && adjEnemies(s, f).length === 0)) f.cloaked = true;
  }
  for (const f of [...s.formations]) {
    if (f.broken || !has(f, 'mirage')) continue;
    if (s.formations.filter((o) => o.owner === f.owner && has(o, 'decoy')).length >= 2) continue;
    const spot = neighbors(f.pos).find((n) => !formationAt(s, n));
    if (spot) spawnToken(s, f.owner, spot, 'v_phantom');
  }
  // creep unsettles enemies standing in it
  for (const f of [...s.formations]) {
    if (f.broken || s.players[other(f.owner)].faction !== 'brood') continue;
    if (isCreep(s, f.pos, other(f.owner))) panic(s, f, 1);
  }
  // relays & siege
  for (const t of s.tiles) {
    if (t.terrain !== 'relay') continue;
    const o = formationAt(s, t.pos);
    if (o && !o.broken && !has(o, 'decoy')) t.relayOwner = o.owner;
  }
  for (const p of [0, 1] as PlayerId[]) {
    const n = s.tiles.filter((t) => t.terrain === 'relay' && t.relayOwner === p).length;
    if (n) loseResolve(s, other(p), n * RULES.relayDrain, 'relays held by enemy');
    const hq = s.formations.find((f) => f.owner === other(p) && has(f, 'hq'));
    const bt = hq ? adjFormations(s, hq.pos).filter((f) => f.owner === p && !f.broken && !has(f, 'decoy')).length : 0;
    if (bt) loseResolve(s, other(p), bt * RULES.siegeDrain, 'HQ besieged');
  }
}

function nextRound(s: GameState) {
  if (s.round >= RULES.maxRounds) {
    const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
    if (r0 !== r1) return end(s, r0 > r1 ? 0 : 1, 'time: higher Resolve');
    const rl = (p: PlayerId) => s.tiles.filter((t) => t.relayOwner === p).length;
    if (rl(0) !== rl(1)) return end(s, rl(0) > rl(1) ? 0 : 1, 'time: relays');
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
    for (let i = 0; i < RULES.drawPerRound; i++) draw(s, p);
  }
  s.phase = 'orders';
}

// ───────────────────────── preview (intent arrows) ─────────────────────────
/** Simulate the board's next resolution with the given orders for `p` (opponent
 *  assumed to play nothing). Used for intent arrows and by the AI. */
export function simulate(s: GameState, p: PlayerId, orders: Orders): GameState {
  const c = structuredClone({ ...s, log: [], events: [] }) as GameState;
  c.players[p].orders = orders;
  c.players[other(p)].orders = { deploys: [] };
  resolveRound(c);
  return c;
}

// ───────────────────────── views ─────────────────────────
/** Redact hidden info for a given viewer. */
export function viewFor(s: GameState, viewer: PlayerId): GameState {
  const v: GameState = JSON.parse(JSON.stringify(s));
  const opp = v.players[other(viewer)];
  opp.hand = opp.hand.map(() => ({ uid: -1, id: '?', dmg: 0 }));
  opp.orders = opp.orders ? { deploys: [], escalate: false } : null;
  for (const p of v.players) p.deck = p.deck.map(() => ({ uid: -1, id: '?', dmg: 0 }));
  for (const f of v.formations)
    if (f.owner !== viewer && f.cloaked) { f.cards = [{ uid: -1, id: '?', dmg: 0 }]; f.morale = -1; }
  for (const i of v.inbound) if (i.owner !== viewer) i.card = { uid: -1, id: '?', dmg: 0 };
  // events: hide what cloaked enemy units are
  for (const e of v.events) if (e.t === 'deploy' && e.owner !== viewer && v.players[e.owner].faction === 'hush') e.id = '?';
  v.log = [];
  v.rng = 0;
  return v;
}
