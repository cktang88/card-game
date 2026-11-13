// Shatterline rules engine (v0.3: simplified, no movement).
//
// A round:  ORDERS  both players secretly place cards
//           REVEAL  placements land; On Reveal effects; tactics
//           STRIKE  every unit strikes once, all at the same time
//           FALLOUT broken / destroyed units leave; adjacent allies panic
//           UPKEEP  "each round" effects; Relays drain Resolve
// Units never move unless a card says so.

import { CARD_BY_ID, CardDef, Faction, HQ_ID, Keyword, isTactic, rangeOf, starterDeck } from './cards';
import { Pos, ROWS, allHexes, distance, inBounds, key, neighbors, samePos } from './hex';
import { Terrain, buildMap } from './map';

// ───────────────────────── tunables ─────────────────────────
export const RULES = {
  maxRounds: 8,
  startResolve: 9,
  handStart: 5,
  handMax: 8,
  drawPerRound: 2,
  stackMax: 3,
  swarmStackMax: 5,
  cpCap: 7,
  maxStakes: 8,
  ambush: 1,
  flankMax: 2,
  relayDrain: 1,
  evolveMax: 3,
};
export const cpForRound = (round: number) => Math.min(round + 1, RULES.cpCap);

// ───────────────────────── types ─────────────────────────
export type PlayerId = 0 | 1;

export interface CardInst { uid: number; id: string; dmg: number; grow?: number; token?: boolean }

export interface Buffs { power: number; silenced: boolean }
const noBuffs = (): Buffs => ({ power: 0, silenced: false });

export interface Formation {
  fid: number;
  owner: PlayerId;
  pos: Pos;
  cards: CardInst[];      // bottom → top; the top card (Lead) has the active ability
  morale: number;         // current Nerve
  deployedRound: number;
  cloaked: boolean;
  buffs: Buffs;           // this round only
}

export interface Tile { pos: Pos; elev: number; terrain: Terrain; fortified: boolean; relayOwner: -1 | PlayerId }

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

export type Step = 'reveal' | 'strike' | 'fallout' | 'upkeep';

export type GameEvent =
  | { t: 'step'; step: Step }
  | { t: 'deploy'; fid: number; pos: Pos; id: string; reinforce: boolean; owner: PlayerId }
  | { t: 'bounce'; pos: Pos; owner: PlayerId }
  | { t: 'tactic'; id: string; pos: Pos; owner: PlayerId }
  | { t: 'move'; fid: number; from: Pos; to: Pos }
  | { t: 'strike'; fid: number; target: number; from: Pos; to: Pos; amount: number; lethal: boolean }
  | { t: 'shock'; fid: number; pos: Pos; amount: number }
  | { t: 'damage'; fid: number; pos: Pos; amount: number }
  | { t: 'heal'; fid: number; pos: Pos; amount: number }
  | { t: 'break'; fid: number; pos: Pos }
  | { t: 'destroy'; fid: number; pos: Pos }
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
  nextId: number;
  initiative: PlayerId;
  stakes: number;
  pendingEscalations: number;
  winner: null | -1 | PlayerId;
  endReason: string;
  log: string[];
  events: GameEvent[];
  stats: { breaks: [number, number]; destroyed: [number, number]; resolveBy: Record<string, number> };
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
    tiles: allHexes().map((pos) => ({ pos, elev: map.get(key(pos))!.elev, terrain: map.get(key(pos))!.terrain, fortified: false, relayOwner: -1 })),
    formations: [], nextId: 1, initiative: 0, stakes: 1, pendingEscalations: 0,
    winner: null, endReason: '', log: [], events: [],
    stats: { breaks: [0, 0], destroyed: [0, 0], resolveBy: {} },
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
  return { fid: s.nextId++, owner, pos: { ...pos }, cards: [card], morale: d.nerve, deployedRound: round,
    cloaked: s.players[owner].faction === 'hush' && d.cls !== 'HQ', buffs: noBuffs() };
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
export const has = (f: Formation, k: Keyword) => !!f.cards.length && !f.buffs.silenced && leadDef(f).keywords.includes(k);
export const other = (p: PlayerId): PlayerId => (1 - p) as PlayerId;
export const cardPower = (c: CardInst) => def(c).power + (c.grow ?? 0) - c.dmg;
export const power = (f: Formation) => f.cards.reduce((a, c) => a + Math.max(0, cardPower(c)), 0);
export const maxNerve = (f: Formation) => f.cards.reduce((a, c) => a + def(c).nerve, 0);
export const isHQ = (f: Formation) => !!f.cards.length && leadDef(f).cls === 'HQ';
export const faction = (s: GameState, f: Formation) => s.players[f.owner].faction;
export const isToken = (f: Formation) => f.cards.every((c) => c.token);
const costOf = (f: Formation) => f.cards.reduce((a, c) => a + def(c).cost, 0);

export function tileAt(s: GameState, p: Pos): Tile { return s.tiles.find((t) => samePos(t.pos, p))!; }
export function formationAt(s: GameState, p: Pos): Formation | undefined { return s.formations.find((f) => samePos(f.pos, p)); }
export function getF(s: GameState, fid: number) { return s.formations.find((f) => f.fid === fid); }
export const elev = (s: GameState, p: Pos) => tileAt(s, p).elev;
export const alive = (s: GameState, f: Formation) => s.formations.includes(f);

export function adjFormations(s: GameState, pos: Pos): Formation[] {
  return neighbors(pos).map((n) => formationAt(s, n)).filter((x): x is Formation => !!x);
}
/** Units (not HQs) next to a hex. */
export const adjUnits = (s: GameState, pos: Pos) => adjFormations(s, pos).filter((o) => !isHQ(o));
const adjEnemies = (s: GameState, f: Formation) => adjUnits(s, f.pos).filter((o) => o.owner !== f.owner);
const adjAllies = (s: GameState, f: Formation) => adjUnits(s, f.pos).filter((o) => o.owner === f.owner);

export function linkSource(s: GameState, f: Formation): Formation | undefined {
  if (faction(s, f) !== 'brood' || isHQ(f) || has(f, 'synapse')) return undefined;
  return s.formations.find((o) => o !== f && o.owner === f.owner && has(o, 'synapse') && distance(o.pos, f.pos) <= 1);
}
export const isLinked = (s: GameState, f: Formation) => !!linkSource(s, f);
/** Fearless units never break: Shock hits them as damage instead (structures, linked Brood). */
export const isFearless = (s: GameState, f: Formation) => has(f, 'fearless') || isLinked(s, f);

/** Concord faction rule: Shoulder to Shoulder: +1 when next to 2+ allied units. */
export function inFiringLine(s: GameState, f: Formation): boolean {
  if (faction(s, f) !== 'concord' || isHQ(f)) return false;
  return adjAllies(s, f).length >= 2;
}

export function hasCover(s: GameState, f: Formation): boolean {
  const t = tileAt(s, f.pos);
  return t.terrain === 'ruins' || t.fortified;
}

/** Enemies this formation could strike from where it stands. */
export function targetsInReach(s: GameState, f: Formation): Formation[] {
  const r = rangeOf(leadDef(f));
  if (r === 0 || isHQ(f)) return [];
  const inReach = s.formations.filter((o) => {
    if (o.owner === f.owner || isHQ(o)) return false;
    const d = distance(o.pos, f.pos);
    return d === 1 || (d <= r && !o.cloaked);
  });
  if (has(f, 'artillery')) return inReach;
  const guards = inReach.filter((o) => has(o, 'guard'));
  return guards.length ? guards : inReach;
}

/** THE targeting rule (same for everyone; Hunter excepted):
 *  nearest → lowest Nerve → leftmost. */
export function chooseTarget(s: GameState, f: Formation): Formation | undefined {
  const ts = targetsInReach(s, f);
  if (!ts.length) return undefined;
  const hunter = has(f, 'hunter');
  const score = (o: Formation) => [
    hunter ? -costOf(o) : 0,
    distance(o.pos, f.pos),
    o.cloaked ? 99 : isFearless(s, o) ? 50 + power(o) : o.morale,
    o.pos.col, o.pos.row,
  ];
  return ts.sort((a, b) => {
    const A = score(a), B = score(b);
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return A[i] - B[i];
    return 0;
  })[0];
}

// ───────────────────────── resolve / win ─────────────────────────
function loseResolve(s: GameState, p: PlayerId, n: number, reason: string, cat: string) {
  if (n <= 0 || s.winner !== null) return;
  s.players[p].resolve -= n;
  s.stats.resolveBy[cat] = (s.stats.resolveBy[cat] ?? 0) + n;
  s.events.push({ t: 'resolve', player: p, delta: -n, reason });
  s.log.push(`P${p} −${n} Resolve (${reason}) → ${s.players[p].resolve}`);
}

function checkWin(s: GameState) {
  if (s.winner !== null) return;
  const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
  if (r0 <= 0 && r1 <= 0) end(s, r0 === r1 ? -1 : r0 > r1 ? 0 : 1, 'both armies collapsed');
  else if (r0 <= 0) end(s, 1, 'army collapsed');
  else if (r1 <= 0) end(s, 0, 'army collapsed');
}

function end(s: GameState, w: -1 | PlayerId, reason: string) {
  s.winner = w; s.endReason = reason; s.phase = 'over';
  s.log.push(`GAME OVER: ${w === -1 ? 'draw' : 'P' + w + ' wins'} (${reason}), stakes ${s.stakes}`);
}

// ───────────────────────── shock & damage ─────────────────────────
/** Shock lowers Nerve. Fearless units take it as damage instead. */
function shock(s: GameState, f: Formation, amount: number, opts: { ignoreAuras?: boolean } = {}) {
  if (amount <= 0 || !alive(s, f) || isHQ(f)) return;
  if (has(f, 'decoy')) { f.morale = 0; return; }
  if (!opts.ignoreAuras && adjAllies(s, f).some((o) => has(o, 'standard'))) amount -= 1;
  if (amount <= 0) return;
  if (isFearless(s, f)) return damage(s, f, amount);
  f.morale -= amount;
  s.events.push({ t: 'shock', fid: f.fid, pos: f.pos, amount });
}

/** Damage lowers Power, top card first. A card at 0 Power is destroyed. */
function damage(s: GameState, f: Formation, amount: number) {
  if (amount <= 0 || !alive(s, f) || isHQ(f)) return;
  if (has(f, 'decoy')) { f.morale = 0; return; }
  if (has(f, 'armor')) amount -= 1;
  if (amount <= 0) return;
  s.events.push({ t: 'damage', fid: f.fid, pos: f.pos, amount });
  while (amount > 0 && f.cards.length) {
    const top = lead(f);
    const take = Math.min(cardPower(top), amount);
    top.dmg += take; amount -= take;
    if (cardPower(top) <= 0) {
      f.cards.pop();
      if (!top.token) { s.players[f.owner].discard.push(top.id); loseResolve(s, f.owner, 1, `${def(top).name} destroyed`, 'kills'); }
      s.stats.destroyed[f.owner]++;
      f.morale = Math.min(f.morale, maxNerve(f));
    }
  }
}

function heal(s: GameState, f: Formation, n: number) {
  if (!alive(s, f) || !f.cards.length) return;
  const top = lead(f);
  const h = Math.min(n, top.dmg);
  if (h > 0) { top.dmg -= h; s.events.push({ t: 'heal', fid: f.fid, pos: f.pos, amount: h }); }
}

function spawnToken(s: GameState, owner: PlayerId, pos: Pos, id: string): Formation {
  const nf = mkFormation(s, owner, pos, { uid: s.nextId++, id, dmg: 0, token: true }, s.round);
  s.formations.push(nf);
  s.events.push({ t: 'deploy', fid: nf.fid, pos, id, reinforce: false, owner });
  return nf;
}

export function uncloak(s: GameState, f: Formation) {
  if (!f.cloaked || !alive(s, f)) return;
  f.cloaked = false;
  s.events.push({ t: 'reveal', fid: f.fid, pos: f.pos });
  if (has(f, 'decoy')) f.morale = 0;
}

const emptyAround = (s: GameState, p: Pos) => neighbors(p).filter((n) => !formationAt(s, n) && tileAt(s, n).terrain !== 'crater');

// ───────────────────────── strike ─────────────────────────
export interface StrikePlan { a: Formation; ad: CardDef; t: Formation; amount: number; lethal: boolean; ignoreAuras: boolean }

export function strikeValue(s: GameState, a: Formation, t: Formation): { amount: number; lethal: boolean } {
  const ad = leadDef(a);
  const kw = (k: Keyword) => !a.buffs.silenced && ad.keywords.includes(k);
  const melee = distance(a.pos, t.pos) === 1;
  let v = power(a) + a.buffs.power;
  if (inFiringLine(s, a)) v += 1;
  if (adjAllies(s, a).some((o) => has(o, 'officer'))) v += 1;
  const link = linkSource(s, a);
  if (link && has(link, 'overmind')) v += 1;
  // position: flanking and high ground
  v += Math.min(RULES.flankMax, adjUnits(s, t.pos).filter((o) => o.owner === a.owner && o !== a).length);
  if (elev(s, a.pos) > elev(s, t.pos)) v += 1;
  if (!melee && hasCover(s, t) && !kw('artillery')) v -= 1;
  // keywords
  let lethal = kw('lethal');
  if (a.cloaked && !kw('silent')) {
    v += RULES.ambush;
    if (kw('assassin') && ['Officer', 'Synapse'].includes(leadDef(t).cls)) lethal = true;
  }
  if (kw('terror') && !isFearless(s, t) && t.morale * 2 <= maxNerve(t)) v += 2;
  if (kw('breach') && (isFearless(s, t) || hasCover(s, t))) v += 2;
  if (kw('pack')) v += adjAllies(s, a).length;
  return { amount: Math.max(0, v), lethal };
}

function strikeAll(s: GameState) {
  const plans: StrikePlan[] = [];
  for (const f of s.formations) {
    if (isHQ(f) || rangeOf(leadDef(f)) === 0) continue;
    const ad = leadDef(f);
    if (has(f, 'cleave')) {
      for (const e of adjEnemies(s, f)) plans.push({ a: f, ad, t: e, ...strikeValue(s, f, e), ignoreAuras: false });
      if (plans.some((p) => p.a === f)) continue;
    }
    const t = chooseTarget(s, f);
    if (!t) continue;
    plans.push({ a: f, ad, t, ...strikeValue(s, f, t), ignoreAuras: has(f, 'dirge') });
  }
  for (const p of plans) if (p.ad.keywords.includes('volley') && !p.a.buffs.silenced && plans.some((q) => q !== p && q.t === p.t && q.a.owner === p.a.owner)) p.amount += 1;
  const revealed = new Set<Formation>();
  const fed = new Set<Formation>();
  for (const p of plans) {
    if (!alive(s, p.t) || !p.t.cards.length) continue;
    s.events.push({ t: 'strike', fid: p.a.fid, target: p.t.fid, from: { ...p.a.pos }, to: { ...p.t.pos }, amount: p.amount, lethal: p.lethal });
    s.log.push(`${p.ad.name}(#${p.a.fid}) → ${leadDef(p.t).name}(#${p.t.fid}) ${p.amount}${p.lethal ? ' lethal' : ''}`);
    if (p.a.cloaked && !p.ad.keywords.includes('silent')) revealed.add(p.a);
    if (p.t.cloaked) uncloak(s, p.t);
    const wasStanding = p.t.morale > 0;
    if (p.lethal) damage(s, p.t, p.amount);
    else shock(s, p.t, p.amount, { ignoreAuras: p.ignoreAuras });
    if (p.amount > 0) fed.add(p.a);
    const kw = (k: Keyword) => !p.a.buffs.silenced && p.ad.keywords.includes(k);
    if (kw('splash')) for (const o of adjUnits(s, p.t.pos)) if (o.owner !== p.a.owner) shock(s, o, 1, { ignoreAuras: true });
    if (kw('drain')) heal(s, p.a, 2);
    if (kw('infect') && wasStanding && p.t.morale <= 0 && !isFearless(s, p.t) && !has(p.t, 'decoy')) infected.push({ pos: { ...p.t.pos }, owner: p.a.owner });
  }
  for (const a of revealed) uncloak(s, a);
  // Brood evolve: grows each time it draws blood
  for (const a of fed) if (alive(s, a) && faction(s, a) === 'brood' && a.cards.length) {
    const top = lead(a);
    if ((top.grow ?? 0) < RULES.evolveMax) { top.grow = (top.grow ?? 0) + 1; s.events.push({ t: 'evolve', fid: a.fid, pos: a.pos }); }
  }
}
let infected: { pos: Pos; owner: PlayerId }[] = [];

// ───────────────────────── fallout ─────────────────────────
/** Remove every broken (Nerve 0) or destroyed (no cards left) unit. Each costs its owner
 *  1 Resolve per card, and every adjacent ally panics (1 Shock). Repeats for cascades. */
function fallout(s: GameState) {
  for (let guard = 0; guard < 20; guard++) {
    const gone = s.formations.filter((f) => !isHQ(f) && (f.cards.length === 0 || (f.morale <= 0 && !isFearless(s, f))));
    if (!gone.length) return;
    for (const f of gone) {
      s.formations = s.formations.filter((o) => o !== f);
      const pl = s.players[f.owner];
      const decoy = f.cards.length > 0 && leadDef(f).keywords.includes('decoy');
      const burst = f.cards.length > 0 && leadDef(f).keywords.includes('burst') && !f.buffs.silenced;
      if (f.cards.length) {
        const real = f.cards.filter((c) => !c.token);
        s.stats.breaks[f.owner]++;
        s.events.push({ t: 'break', fid: f.fid, pos: f.pos });
        if (!decoy) loseResolve(s, f.owner, real.length, `${leadDef(f).name} broke`, 'morale');
        for (const c of real) pl.discard.push(c.id);
      } else {
        s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
      }
      s.log.push(`#${f.fid} (P${f.owner}) ${f.cards.length ? 'breaks' : 'is wiped out'}`);
      if (decoy) continue;
      for (const o of adjUnits(s, f.pos)) if (o.owner === f.owner) shock(s, o, 1, { ignoreAuras: true });
      if (burst) for (const n of emptyAround(s, f.pos).concat([f.pos]).filter((n) => !formationAt(s, n)).slice(0, 2)) spawnToken(s, f.owner, n, 'b_skitter');
    }
    checkWin(s);
    if (s.winner !== null) return;
  }
}

// ───────────────────────── orders ─────────────────────────
export function stackLimit(cards: CardInst[]): number {
  if (cards.every((c) => def(c).keywords.includes('swarm'))) return RULES.swarmStackMax;
  if (cards.some((c) => ['Structure', 'Illusion', 'HQ'].includes(def(c).cls))) return 1;
  return RULES.stackMax;
}

export function canReinforce(f: Formation, card: CardDef): boolean {
  if (['Structure', 'Illusion', 'HQ'].includes(leadDef(f).cls) || ['Structure', 'Illusion', 'Tactic'].includes(card.cls)) return false;
  return f.cards.length < stackLimit([...f.cards, { uid: 0, id: card.id, dmg: 0 }]);
}

export function tacticTargetOk(s: GameState, p: PlayerId, card: CardDef, pos: Pos): boolean {
  const occ = formationAt(s, pos);
  if (!occ || isHQ(occ)) return false;
  if (card.tactic!.target === 'enemy') return occ.owner !== p && !occ.cloaked;
  return occ.owner === p;
}

/** Hive-style placement: a new unit must touch one of your units or your HQ.
 *  It MAY touch enemies: placing next to them is how you attack. */
export function canDeployAt(s: GameState, p: PlayerId, card: CardDef, pos: Pos): boolean {
  if (!inBounds(pos)) return false;
  if (isTactic(card)) return tacticTargetOk(s, p, card, pos);
  const occ = formationAt(s, pos);
  if (occ) return occ.owner === p && canReinforce(occ, card);
  if (tileAt(s, pos).terrain === 'crater') return false;
  if (adjFormations(s, pos).some((o) => o.owner === p)) return true;
  if (card.keywords.includes('infiltrate')) return s.formations.some((o) => o.owner === p && distance(o.pos, pos) <= 2);
  return false;
}

export function validateOrders(s: GameState, p: PlayerId, o: Orders): string | null {
  const pl = s.players[p];
  let total = 0;
  const used = new Set<number>();
  const hexes = new Set<string>();
  for (const d of o.deploys) {
    const c = pl.hand.find((h) => h.uid === d.uid);
    if (!c) return 'card not in hand';
    if (used.has(d.uid)) return 'card used twice';
    used.add(d.uid);
    const cd = def(c);
    if (!isTactic(cd)) {
      if (hexes.has(key(d.pos))) return 'one card per hex per round';
      hexes.add(key(d.pos));
    }
    total += cd.cost;
    if (!canDeployAt(s, p, cd, d.pos)) return `can't place ${cd.name} there`;
  }
  if (total > pl.cp) return 'not enough Command';
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

function placeUnit(s: GameState, p: PlayerId, c: CardInst, pos: Pos): Formation | null {
  const cd = def(c);
  const tgt = formationAt(s, pos);
  if (tgt) {
    if (tgt.owner !== p || !canReinforce(tgt, cd)) return null; // the enemy got there first
    tgt.cards.push(c);
    tgt.morale += cd.nerve;
    s.events.push({ t: 'deploy', fid: tgt.fid, pos, id: c.id, reinforce: true, owner: p });
    return tgt;
  }
  const f = mkFormation(s, p, pos, c, s.round);
  s.formations.push(f);
  s.events.push({ t: 'deploy', fid: f.fid, pos, id: c.id, reinforce: false, owner: p });
  return f;
}

/** On Reveal effects of a freshly placed card. */
function onReveal(s: GameState, f: Formation, cd: CardDef) {
  const k = (x: Keyword) => cd.keywords.includes(x);
  if (k('fortify')) tileAt(s, f.pos).fortified = true;
  if (k('nightmare')) for (const o of [...s.formations]) if (o.owner !== f.owner && !isHQ(o) && distance(o.pos, f.pos) <= 2) shock(s, o, 1, { ignoreAuras: true });
  if (k('mirage')) for (const n of emptyAround(s, f.pos).slice(0, 2)) spawnToken(s, f.owner, n, 'v_phantom');
  if (k('echo')) { const n = emptyAround(s, f.pos)[0]; if (n) spawnToken(s, f.owner, n, 'v_phantom'); }
  if (k('shove')) {
    const e = adjEnemies(s, f).sort((a, b) => a.morale - b.morale)[0];
    if (e) {
      // straight away from the rammer: the neighbour of e that is 2 from f and most aligned
      const away = neighbors(e.pos).filter((n) => distance(n, f.pos) === 2)
        .sort((a, b) => Math.abs((a.row - e.pos.row) - (e.pos.row - f.pos.row)) - Math.abs((b.row - e.pos.row) - (e.pos.row - f.pos.row)))[0];
      if (away && !formationAt(s, away) && tileAt(s, away).terrain !== 'crater') { s.events.push({ t: 'move', fid: e.fid, from: e.pos, to: away }); e.pos = away; }
      else shock(s, e, 2);
    }
  }
}

function applyTactic(s: GameState, p: PlayerId, c: CardInst, pos: Pos) {
  const cd = def(c);
  const tgt = formationAt(s, pos);
  s.events.push({ t: 'tactic', id: c.id, pos, owner: p });
  s.players[p].discard.push(c.id);
  if (!tgt) return;
  const n = cd.tactic!.n;
  switch (cd.tactic!.kind) {
    case 'power': tgt.buffs.power += n; break;
    case 'powerArea': for (const o of [tgt, ...adjAllies(s, tgt)]) o.buffs.power += n; break;
    case 'nerve': for (const o of [tgt, ...adjAllies(s, tgt)]) o.morale = Math.min(maxNerve(o), o.morale + n); break;
    case 'scream': for (const e of adjEnemies(s, tgt)) shock(s, e, n); break;
    case 'silence': tgt.buffs.silenced = true; tgt.buffs.power -= n; break;
    case 'cloak': { tgt.cloaked = true; const e = emptyAround(s, tgt.pos)[0]; if (e) spawnToken(s, p, e, 'v_phantom'); break; }
    case 'knives': for (const o of s.formations) if (o.owner === p && o.cloaked) o.buffs.power += n; break;
    case 'shell': for (const o of [tgt, ...adjUnits(s, tgt.pos)]) if (o.owner !== p) shock(s, o, n); break;
  }
}

function resolveRound(s: GameState) {
  s.events = [];
  infected = [];
  for (const f of s.formations) f.buffs = noBuffs();

  // ── REVEAL ──
  s.events.push({ t: 'step', step: 'reveal' });
  const placed: [Formation, CardDef][] = [];
  const tactics: [PlayerId, CardInst, Pos][] = [];
  for (const p of [s.initiative, other(s.initiative)]) {
    const pl = s.players[p];
    const o = pl.orders!;
    if (o.escalate && !pl.escalateUsed) { pl.escalateUsed = true; s.pendingEscalations++; s.log.push(`P${p} ESCALATES`); }
    for (const d of o.deploys) {
      const idx = pl.hand.findIndex((h) => h.uid === d.uid);
      if (idx < 0) continue;
      const c = pl.hand[idx];
      const cd = def(c);
      if (cd.cost > pl.cp) continue;
      if (isTactic(cd)) { pl.hand.splice(idx, 1); pl.cp -= cd.cost; tactics.push([p, c, d.pos]); continue; }
      const f = placeUnit(s, p, c, d.pos);
      if (!f) { s.events.push({ t: 'bounce', pos: d.pos, owner: p }); continue; } // card stays in hand
      pl.hand.splice(idx, 1); pl.cp -= cd.cost;
      placed.push([f, cd]);
    }
    pl.orders = null;
  }
  for (const [f] of placed) for (const e of adjEnemies(s, f)) if (e.cloaked) uncloak(s, e); // walking into the unseen reveals it
  for (const [f, cd] of placed) if (alive(s, f)) onReveal(s, f, cd);
  for (const [p, c, pos] of tactics) if (tacticTargetOk(s, p, def(c), pos)) applyTactic(s, p, c, pos); else s.players[p].discard.push(c.id);
  fallout(s);
  if (s.winner !== null) return;

  // ── STRIKE ──
  s.events.push({ t: 'step', step: 'strike' });
  strikeAll(s);

  // ── FALLOUT ──
  s.events.push({ t: 'step', step: 'fallout' });
  fallout(s);
  if (s.winner !== null) return;
  for (const i of infected) if (!formationAt(s, i.pos)) spawnToken(s, i.owner, i.pos, 'b_skitter');

  // ── UPKEEP ──
  s.events.push({ t: 'step', step: 'upkeep' });
  upkeep(s);
  checkWin(s);
  if (s.winner !== null) return;
  nextRound(s);
}

function upkeep(s: GameState) {
  for (const f of [...s.formations]) {
    if (isHQ(f) || !alive(s, f) || !f.cards.length) continue;
    const top = lead(f);
    if (has(f, 'grow') && (top.grow ?? 0) < 4) { top.grow = (top.grow ?? 0) + 1; s.events.push({ t: 'evolve', fid: f.fid, pos: f.pos }); }
    if (has(f, 'hatch')) {
      const kids = s.formations.filter((o) => o.owner === f.owner && o.cards.length && isToken(o) && lead(o).id === 'b_skitter').length;
      const n = emptyAround(s, f.pos)[0];
      if (kids < 3 && n) spawnToken(s, f.owner, n, 'b_skitter');
    }
    if (has(f, 'shroud')) for (const o of adjAllies(s, f)) o.cloaked = true;
    if (has(f, 'fade') && !f.cloaked && adjEnemies(s, f).length === 0) f.cloaked = true;
    if (has(f, 'dread')) for (const o of adjEnemies(s, f)) shock(s, o, 1, { ignoreAuras: true });
  }
  fallout(s);
  if (s.winner !== null) return;
  for (const t of s.tiles) {
    if (t.terrain !== 'relay') continue;
    const o = formationAt(s, t.pos);
    if (o && !has(o, 'decoy')) t.relayOwner = o.owner;
  }
  // Relay majority: whoever holds more Relays drains the other.
  const held = (p: PlayerId) => s.tiles.filter((t) => t.terrain === 'relay' && t.relayOwner === p).length;
  const h0 = held(0), h1 = held(1);
  if (h0 !== h1) loseResolve(s, h0 > h1 ? 1 : 0, RULES.relayDrain, 'enemy holds more Relays', 'relays');
}

function nextRound(s: GameState) {
  if (s.round >= RULES.maxRounds) {
    const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
    if (r0 !== r1) return end(s, r0 > r1 ? 0 : 1, 'time: higher Resolve');
    const held = (p: PlayerId) => s.tiles.filter((t) => t.terrain === 'relay' && t.relayOwner === p).length;
    if (held(0) !== held(1)) return end(s, held(0) > held(1) ? 0 : 1, 'time: more Relays');
    return end(s, -1, 'time: dead even');
  }
  const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
  s.initiative = r0 < r1 ? 0 : r1 < r0 ? 1 : other(s.initiative);
  s.round++;
  s.events.push({ t: 'round', round: s.round });
  while (s.pendingEscalations > 0) { s.stakes = Math.min(RULES.maxStakes, s.stakes * 2); s.pendingEscalations--; }
  if (s.round === RULES.maxRounds) s.stakes = Math.min(RULES.maxStakes, s.stakes * 2);
  for (const p of [0, 1] as PlayerId[]) {
    s.players[p].cp = cpForRound(s.round);
    for (let i = 0; i < RULES.drawPerRound; i++) draw(s, p);
  }
  s.phase = 'orders';
}

// ───────────────────────── preview ─────────────────────────
/** Simulate the next resolution with the given orders for `p` (opponent assumed to play
 *  nothing). Used for intent arrows and by the AI. */
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
  for (const e of v.events) if (e.t === 'deploy' && e.owner !== viewer && v.players[e.owner].faction === 'hush') e.id = '?';
  v.log = [];
  v.rng = 0;
  return v;
}
