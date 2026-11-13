// Shatterline rules engine (v0.4: the Battle Line).
//
// Board: 5 columns. Each side has a Front row and a Back row (20 cells). No HQ.
// A round:  ORDERS  both players secretly place cards on their own side
//           REVEAL  placements land; On Reveal effects; tactics
//           BREACH  Front units with no enemy in their column are In Breach; their
//                   neighbouring enemy Front units are Flanked
//           STRIKE  every unit strikes its one target, all at once
//           FALLOUT broken / destroyed units leave; neighbours panic (cascades)
//           UPKEEP  each-round effects; a surviving breach drains 1 Resolve
// Units never move unless a card says so.

import { CARD_BY_ID, CardDef, Faction, Keyword, isTactic, rangeOf, starterDeck } from './cards';

// ───────────────────────── tunables ─────────────────────────
export const RULES = {
  maxRounds: 8,
  startResolve: 14,
  handStart: 5,
  handMax: 8,
  drawPerRound: 2,
  stackMax: 3,
  swarmStackMax: 5,
  cpCap: 7,
  maxStakes: 8,
  ambush: 1,
  rear: 1,
  flank: 1,
  flood: 2,
  breachDrain: 1,
  breachFromRound: 2,
  evolveMax: 3,
  terrainColumns: 0,    // 0 = auto (≈ width / 2.5)
  cohesionMax: 2,
  formations: true,     // column hands: the higher hand holds the Edge (+1 strikes) in that column
  edge: 1,              // strike bonus in a column where you hold the Edge
  underdogCp: 1,        // extra Command next round for the player behind on Resolve by ≥ 3
};
export const cpForRound = (round: number) => Math.min(round + 1, RULES.cpCap);

// ───────────────────────── grid ─────────────────────────
/** Board width (columns). Live binding: change via setCols(). */
export let COLS = 7;
export function setCols(n: number) { COLS = n; }
export const ROWS = 4;
/** Rows: 0 = P1 Back, 1 = P1 Front, 2 = P0 Front, 3 = P0 Back. */
export interface Pos { col: number; row: number }
export type PlayerId = 0 | 1;
export const frontRow = (p: PlayerId) => (p === 0 ? 2 : 1);
export const backRow = (p: PlayerId) => (p === 0 ? 3 : 0);
export const sideOf = (pos: Pos): PlayerId => (pos.row >= 2 ? 0 : 1);
export const isFrontCell = (pos: Pos) => pos.row === 1 || pos.row === 2;
export const samePos = (a: Pos, b: Pos) => a.col === b.col && a.row === b.row;
export const key = (p: Pos) => `${p.col},${p.row}`;
export function allCells(): Pos[] {
  const out: Pos[] = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) out.push({ col, row });
  return out;
}
/** Neighbours on the same side: left, right, and the other row of the same column. */
export function around(pos: Pos): Pos[] {
  const p = sideOf(pos);
  const other = isFrontCell(pos) ? backRow(p) : frontRow(p);
  return [{ col: pos.col - 1, row: pos.row }, { col: pos.col + 1, row: pos.row }, { col: pos.col, row: other }]
    .filter((q) => q.col >= 0 && q.col < COLS);
}
export const beside = (pos: Pos): Pos[] => [{ col: pos.col - 1, row: pos.row }, { col: pos.col + 1, row: pos.row }].filter((q) => q.col >= 0 && q.col < COLS);

export type Terrain = 'open' | 'ridge' | 'ruins';

// ───────────────────────── types ─────────────────────────
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

export type Step = 'reveal' | 'breach' | 'strike' | 'fallout' | 'upkeep';

export type GameEvent =
  | { t: 'step'; step: Step }
  | { t: 'deploy'; fid: number; pos: Pos; id: string; reinforce: boolean; owner: PlayerId }
  | { t: 'tactic'; id: string; pos: Pos; owner: PlayerId }
  | { t: 'move'; fid: number; from: Pos; to: Pos }
  | { t: 'breach'; fid: number; pos: Pos; owner: PlayerId }
  | { t: 'flank'; fid: number; pos: Pos; amount: number }
  | { t: 'edge'; col: number; owner: PlayerId }
  | { t: 'strike'; fid: number; target: number; from: Pos; to: Pos; amount: number; lethal: boolean; rear: boolean }
  | { t: 'shock'; fid: number; pos: Pos; amount: number }
  | { t: 'damage'; fid: number; pos: Pos; amount: number }
  | { t: 'heal'; fid: number; pos: Pos; amount: number }
  | { t: 'break'; fid: number; pos: Pos }
  | { t: 'destroy'; fid: number; pos: Pos }
  | { t: 'reveal'; fid: number; pos: Pos }
  | { t: 'evolve'; fid: number; pos: Pos }
  | { t: 'rally'; fid: number; pos: Pos; amount: number }
  | { t: 'resolve'; player: PlayerId; delta: number; reason: string }
  | { t: 'round'; round: number };

export interface GameState {
  rng: number;
  round: number;
  phase: 'orders' | 'over';
  players: [PlayerState, PlayerState];
  terrain: Terrain[];          // per column
  formations: Formation[];
  nextId: number;
  initiative: PlayerId;
  stakes: number;
  pendingEscalations: number;
  winner: null | -1 | PlayerId;
  endReason: string;
  breaches: number[];          // fids In Breach this round
  flanked: Record<number, number>; // fid → extra Shock per strike taken this round
  edge: (-1 | PlayerId)[];     // per column: who holds the Edge this round
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
export function newGame(f0: Faction, f1: Faction, seed = Date.now() & 0xffffffff, decks?: [string[], string[]]): GameState {
  const s: GameState = {
    rng: seed, round: 1, phase: 'orders',
    players: [mkPlayer(f0), mkPlayer(f1)],
    terrain: Array(COLS).fill('open'),
    formations: [], nextId: 1, initiative: 0, stakes: 1, pendingEscalations: 0,
    winner: null, endReason: '', breaches: [], flanked: {}, edge: [], log: [], events: [],
    stats: { breaks: [0, 0], destroyed: [0, 0], resolveBy: {} },
  };
  s.initiative = rand(s) < 0.5 ? 0 : 1;
  const cols = Array.from({ length: COLS }, (_, i) => i);
  shuffle(s, cols);
  cols.slice(0, RULES.terrainColumns || Math.round(COLS / 2.5)).forEach((c, i) => { s.terrain[c] = i % 2 === 0 ? 'ridge' : 'ruins'; });
  for (const p of [0, 1] as PlayerId[]) {
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
    cloaked: s.players[owner].faction === 'hush', buffs: noBuffs() };
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
export const faction = (s: GameState, f: Formation) => s.players[f.owner].faction;
export const isToken = (f: Formation) => f.cards.every((c) => c.token);
export const isRanged = (d: CardDef) => rangeOf(d) >= 2;
export const strikes = (d: CardDef) => rangeOf(d) > 0;

export function formationAt(s: GameState, p: Pos): Formation | undefined { return s.formations.find((f) => samePos(f.pos, p)); }
export function getF(s: GameState, fid: number) { return s.formations.find((f) => f.fid === fid); }
export const alive = (s: GameState, f: Formation) => s.formations.includes(f);
export const isFront = (f: Formation) => isFrontCell(f.pos);
export const terrainAt = (s: GameState, col: number): Terrain => s.terrain[col];

const aroundUnits = (s: GameState, f: Formation) => around(f.pos).map((p) => formationAt(s, p)).filter((x): x is Formation => !!x);
export const allies = (s: GameState, f: Formation) => aroundUnits(s, f).filter((o) => o.owner === f.owner);
/** Enemy units in the same column, nearest (Front) first. */
export function facing(s: GameState, f: Formation): Formation[] {
  const e = other(f.owner);
  return [frontRow(e), backRow(e)].map((row) => formationAt(s, { col: f.pos.col, row })).filter((x): x is Formation => !!x);
}

export function linkSource(s: GameState, f: Formation): Formation | undefined {
  if (faction(s, f) !== 'brood' || has(f, 'synapse')) return undefined;
  return allies(s, f).find((o) => has(o, 'synapse'));
}
export const isLinked = (s: GameState, f: Formation) => !!linkSource(s, f);
/** Fearless units never break: Shock hits them as damage instead (structures, linked Brood). */
export const isFearless = (s: GameState, f: Formation) => has(f, 'fearless') || isLinked(s, f);

/** Concord: a Front unit with an allied Front unit beside it. */
export function shoulderToShoulder(s: GameState, f: Formation): boolean {
  if (faction(s, f) !== 'concord' || !isFront(f)) return false;
  return beside(f.pos).some((p) => formationAt(s, p)?.owner === f.owner);
}

/** Front units with no enemy at all in their column. */
export function computeBreaches(s: GameState): { breaches: Formation[]; flanked: Map<Formation, number> } {
  const breaches = s.formations.filter((f) => isFront(f) && facing(s, f).length === 0);
  const flanked = new Map<Formation, number>();
  for (const b of breaches) {
    const amt = faction(s, b) === 'brood' && !b.buffs.silenced ? RULES.flood : RULES.flank;
    for (const p of beside({ col: b.pos.col, row: frontRow(other(b.owner)) })) {
      const e = formationAt(s, p);
      if (e && e.owner !== b.owner && faction(s, e) !== 'concord') flanked.set(e, (flanked.get(e) ?? 0) + amt); // Concord: Hold the Line
    }
  }
  return { breaches, flanked };
}

// ───────────────────────── formations (column hands) ─────────────────────────
export type HandRank = 0 | 1 | 2 | 3 | 4;
export const HAND_NAMES = ['—', 'Rabble', 'Squad', 'Kin', 'Command'] as const;
const LEADERS = ['Officer', 'Synapse', 'Psion'];
/** Your cards in a column (Front + Back, including stacked cards) form a hand:
 *  Rabble 1 card · Squad 2+ · Kin 2+ non-leaders all of one class · Command Kin + a leader. */
export function columnHand(s: GameState, p: PlayerId, col: number): { rank: HandRank; cost: number } {
  // cloaked units are hidden, so they aren't in formation (and the opponent couldn't see them anyway)
  const cards = s.formations.filter((f) => f.owner === p && f.pos.col === col && !has(f, 'decoy') && !f.cloaked).flatMap((f) => f.cards);
  if (!cards.length) return { rank: 0, cost: 0 };
  const cost = cards.reduce((a, c) => a + def(c).cost, 0);
  if (cards.length === 1) return { rank: 1, cost };
  const troops = cards.filter((c) => !LEADERS.includes(def(c).cls));
  const leaders = cards.length - troops.length;
  const cls = (c: CardInst) => (s.players[p].faction === 'brood' && ['Swarm', 'Beast'].includes(def(c).cls) ? 'Brood' : def(c).cls); // One Organism
  const kin = troops.length >= 2 && troops.every((c) => cls(c) === cls(troops[0]));
  const rank: HandRank = kin && leaders ? 4 : kin ? 3 : 2;
  return { rank, cost };
}
/** Who holds the Edge in each column (higher hand; tie → higher total cost; else nobody). */
export function computeEdge(s: GameState): (-1 | PlayerId)[] {
  return Array.from({ length: COLS }, (_, col) => {
    const a = columnHand(s, 0, col), b = columnHand(s, 1, col);
    if (!a.rank || !b.rank) return -1; // uncontested columns are breaches, not hands
    if (a.rank !== b.rank) return a.rank > b.rank ? 0 : 1;
    if (a.cost !== b.cost) return a.cost > b.cost ? 0 : 1;
    return -1;
  });
}

// ───────────────────────── targeting ─────────────────────────
/** Exactly one target (or none). Front: enemy Front in the column, else enemy Back (rear strike).
 *  Ranged Back: same, over its own line. Melee Back: none. In Breach: none (it flanks instead).
 *  Ranged units can't target cloaked units (their shots fall through). Hunters go for the Back row first.
 *  Guard: a strike at a unit beside a Guard hits the Guard instead. */
export function chooseTarget(s: GameState, f: Formation): { t: Formation; rear: boolean } | undefined {
  const d = leadDef(f);
  if (!strikes(d)) return undefined;
  if (!isFront(f) && !isRanged(d)) return undefined;
  if (s.breaches.includes(f.fid)) return undefined;
  let line = facing(s, f).filter((o) => !(o.cloaked && isRanged(d)));
  if (has(f, 'hunter')) line = [...line].sort((a, b) => Number(isFront(a)) - Number(isFront(b)));
  const t0 = line[0];
  if (!t0) return undefined;
  const rear = !isFront(t0) && !facing(s, f).some((o) => isFront(o));
  let t = t0;
  if (!has(f, 'artillery')) {
    const g = beside(t0.pos).map((p) => formationAt(s, p)).find((o) => o && o.owner === t0.owner && has(o, 'guard') && !o.cloaked);
    if (g) t = g;
  }
  return { t, rear: rear && t === t0 };
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
function shock(s: GameState, f: Formation, amount: number, opts: { ignoreAuras?: boolean } = {}) {
  if (amount <= 0 || !alive(s, f) || !f.cards.length) return;
  if (has(f, 'decoy')) { f.morale = 0; return; } // a phantom pops when struck
  if (!opts.ignoreAuras && allies(s, f).some((o) => has(o, 'standard'))) amount -= 1;
  if (amount <= 0) return;
  if (isFearless(s, f)) return damage(s, f, amount);
  f.morale -= amount;
  s.events.push({ t: 'shock', fid: f.fid, pos: f.pos, amount });
}

function damage(s: GameState, f: Formation, amount: number) {
  if (amount <= 0 || !alive(s, f) || !f.cards.length) return;
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

/** Empty cells on p's side around a position (beside first, then the other row). */
function emptyAroundOwn(s: GameState, pos: Pos): Pos[] {
  return around(pos).filter((q) => !formationAt(s, q));
}
function emptyOwnCell(s: GameState, p: PlayerId, near: Pos): Pos | undefined {
  const cells = allCells().filter((c) => sideOf(c) === p && !formationAt(s, c) && (!(!isFrontCell(c)) || !!formationAt(s, { col: c.col, row: frontRow(p) })));
  return cells.sort((a, b) => Math.abs(a.col - near.col) + Math.abs(a.row - near.row) - (Math.abs(b.col - near.col) + Math.abs(b.row - near.row)) || Number(isFrontCell(b)) - Number(isFrontCell(a)))[0];
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
}

// ───────────────────────── strike ─────────────────────────
interface StrikePlan { a: Formation; ad: CardDef; t: Formation; amount: number; lethal: boolean; rear: boolean; ignoreAuras: boolean }

export function strikeValue(s: GameState, a: Formation, t: Formation, rear: boolean): { amount: number; lethal: boolean } {
  const ad = leadDef(a);
  const kw = (k: Keyword) => !a.buffs.silenced && ad.keywords.includes(k);
  let v = power(a) + a.buffs.power;
  if (allies(s, a).some((o) => has(o, 'officer'))) v += 1;
  const link = linkSource(s, a);
  if (link && has(link, 'overmind')) v += 1;
  if (terrainAt(s, a.pos.col) === 'ridge') v += 1;
  if (isRanged(ad) && terrainAt(s, t.pos.col) === 'ruins' && !kw('artillery')) v -= 1;
  if (rear) { v += RULES.rear; if (kw('raider')) v += 2; }
  v += s.flanked[t.fid] ?? 0;
  if (RULES.formations && s.edge[a.pos.col] === a.owner) v += RULES.edge;
  let lethal = kw('lethal');
  if (a.cloaked && !kw('silent')) {
    v += RULES.ambush;
    if (kw('assassin') && ['Officer', 'Synapse'].includes(leadDef(t).cls)) lethal = true;
  }
  if (kw('terror') && !isFearless(s, t) && t.morale * 2 <= maxNerve(t)) v += 2;
  if (kw('breach') && (isFearless(s, t) || terrainAt(s, t.pos.col) === 'ruins')) v += 2;
  if (kw('pack')) v += allies(s, a).length;
  return { amount: Math.max(0, v), lethal };
}

function strikeAll(s: GameState) {
  const plans: StrikePlan[] = [];
  for (const f of s.formations) {
    const tg = chooseTarget(s, f);
    if (!tg) continue;
    const ad = leadDef(f);
    plans.push({ a: f, ad, t: tg.t, rear: tg.rear, ...strikeValue(s, f, tg.t, tg.rear), ignoreAuras: has(f, 'dirge') });
    if (has(f, 'cleave')) for (const p of beside(tg.t.pos)) {
      const e = formationAt(s, p);
      if (e && e.owner !== f.owner && !e.cloaked) plans.push({ a: f, ad, t: e, rear: false, ...strikeValue(s, f, e, false), ignoreAuras: false });
    }
  }
  for (const p of plans) if (p.ad.keywords.includes('volley') && !p.a.buffs.silenced && plans.some((q) => q !== p && q.t === p.t && q.a.owner === p.a.owner)) p.amount += 1;
  const revealed = new Set<Formation>();
  const fed = new Set<Formation>();
  for (const p of plans) {
    if (!alive(s, p.t) || !p.t.cards.length) continue;
    s.events.push({ t: 'strike', fid: p.a.fid, target: p.t.fid, from: { ...p.a.pos }, to: { ...p.t.pos }, amount: p.amount, lethal: p.lethal, rear: p.rear });
    s.log.push(`${p.ad.name}(#${p.a.fid}) → ${leadDef(p.t).name}(#${p.t.fid}) ${p.amount}${p.lethal ? ' lethal' : ''}${p.rear ? ' rear' : ''}`);
    if (p.a.cloaked && !p.ad.keywords.includes('silent')) revealed.add(p.a);
    const wasStanding = p.t.morale > 0;
    if (p.t.cloaked && !has(p.t, 'decoy')) revealed.add(p.t); // being hit gives you away
    if (has(p.t, 'decoy') && alive(s, p.a)) shock(s, p.a, 1, { ignoreAuras: true }); // the trap springs
    if (p.lethal) damage(s, p.t, p.amount);
    else shock(s, p.t, p.amount, { ignoreAuras: p.ignoreAuras });
    if (p.amount > 0) fed.add(p.a);
    const kw = (k: Keyword) => !p.a.buffs.silenced && p.ad.keywords.includes(k);
    if (kw('splash')) for (const q of beside(p.t.pos)) { const o = formationAt(s, q); if (o && o.owner !== p.a.owner) shock(s, o, 1, { ignoreAuras: true }); }
    if (kw('drain')) heal(s, p.a, 2);
    if (kw('infect') && wasStanding && p.t.morale <= 0 && !isFearless(s, p.t)) { const c = emptyOwnCell(s, p.a.owner, p.a.pos); if (c) spawnToken(s, p.a.owner, c, 'b_skitter'); }
  }
  for (const a of revealed) uncloak(s, a);
  for (const a of fed) if (alive(s, a) && faction(s, a) === 'brood' && a.cards.length) {
    const top = lead(a);
    if ((top.grow ?? 0) < RULES.evolveMax) { top.grow = (top.grow ?? 0) + 1; s.events.push({ t: 'evolve', fid: a.fid, pos: a.pos }); }
  }
}

// ───────────────────────── fallout ─────────────────────────
/** Remove broken (Nerve 0) / destroyed units: −1 Resolve per card, and the units around
 *  them (beside, in front or behind) panic: 1 Shock. Repeats for cascades. */
function fallout(s: GameState) {
  for (let guard = 0; guard < 20; guard++) {
    const gone = s.formations.filter((f) => f.cards.length === 0 || (f.morale <= 0 && !isFearless(s, f)));
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
        // Routed, not dead: the top card falls back to hand to be rallied later.
        const top = real[real.length - 1];
        if (top && !decoy) { top.dmg = 0; top.grow = 0; if (pl.hand.length < RULES.handMax) pl.hand.push(top); else pl.discard.push(top.id); }
        for (const c of real) if (c !== top || decoy) pl.discard.push(c.id);
      } else s.events.push({ t: 'destroy', fid: f.fid, pos: f.pos });
      s.log.push(`#${f.fid} (P${f.owner}) ${f.cards.length ? 'breaks' : 'is wiped out'}`);
      if (decoy) continue;
      for (const q of around(f.pos)) { const o = formationAt(s, q); if (o && o.owner === f.owner) shock(s, o, 1, { ignoreAuras: true }); }
      if (burst) {
        spawnToken(s, f.owner, f.pos, 'b_skitter');
        const c = emptyAroundOwn(s, f.pos)[0]; if (c) spawnToken(s, f.owner, c, 'b_skitter');
      }
    }
    checkWin(s);
    if (s.winner !== null) return;
  }
}

// ───────────────────────── orders ─────────────────────────
export function stackLimit(cards: CardInst[]): number {
  if (cards.every((c) => def(c).keywords.includes('swarm'))) return RULES.swarmStackMax;
  if (cards.some((c) => ['Structure', 'Illusion'].includes(def(c).cls))) return 1;
  return RULES.stackMax;
}

export function canReinforce(f: Formation, card: CardDef): boolean {
  if (['Structure', 'Illusion'].includes(leadDef(f).cls) || ['Structure', 'Illusion', 'Tactic'].includes(card.cls)) return false;
  return f.cards.length < stackLimit([...f.cards, { uid: 0, id: card.id, dmg: 0 }]);
}

export function tacticTargetOk(s: GameState, p: PlayerId, card: CardDef, pos: Pos): boolean {
  const occ = formationAt(s, pos);
  if (!occ) return false;
  if (card.tactic!.target === 'enemy') return occ.owner !== p && !occ.cloaked;
  return occ.owner === p;
}

/** Place on any empty cell of your own side, or onto your own unit (stack).
 *  A Back cell needs your Front cell in that column filled (now, or by these same orders). */
export function canDeployAt(s: GameState, p: PlayerId, card: CardDef, pos: Pos, pending: Pos[] = []): boolean {
  if (pos.col < 0 || pos.col >= COLS || pos.row < 0 || pos.row >= ROWS) return false;
  if (isTactic(card)) return tacticTargetOk(s, p, card, pos);
  if (sideOf(pos) !== p) return false;
  const occ = formationAt(s, pos);
  if (occ) return occ.owner === p && canReinforce(occ, card);
  if (!isFrontCell(pos)) {
    const fr = { col: pos.col, row: frontRow(p) };
    return !!formationAt(s, fr) || pending.some((q) => samePos(q, fr));
  }
  return true;
}

export function validateOrders(s: GameState, p: PlayerId, o: Orders): string | null {
  const pl = s.players[p];
  let total = 0;
  const used = new Set<number>();
  const hexes = new Set<string>();
  const unitCells = o.deploys.filter((d) => { const c = pl.hand.find((h) => h.uid === d.uid); return c && !isTactic(def(c)); }).map((d) => d.pos);
  for (const d of o.deploys) {
    const c = pl.hand.find((h) => h.uid === d.uid);
    if (!c) return 'card not in hand';
    if (used.has(d.uid)) return 'card used twice';
    used.add(d.uid);
    const cd = def(c);
    if (!isTactic(cd)) {
      if (hexes.has(key(d.pos))) return 'one card per cell per round';
      hexes.add(key(d.pos));
    }
    total += cd.cost;
    if (!canDeployAt(s, p, cd, d.pos, unitCells)) return `can't place ${cd.name} there`;
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
    if (tgt.owner !== p || !canReinforce(tgt, cd)) return null;
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

function onReveal(s: GameState, f: Formation, cd: CardDef) {
  const k = (x: Keyword) => cd.keywords.includes(x);
  if (k('fortify')) s.terrain[f.pos.col] = 'ruins';
  if (k('nightmare')) for (const o of [...s.formations]) if (o.owner !== f.owner && Math.abs(o.pos.col - f.pos.col) <= 1) shock(s, o, 1, { ignoreAuras: true });
  if (k('mirage')) for (const q of emptyAroundOwn(s, f.pos).filter((q) => isFrontCell(q) || formationAt(s, { col: q.col, row: frontRow(f.owner) })).slice(0, 2)) spawnToken(s, f.owner, q, 'v_phantom');
  if (k('echo')) { const q = emptyAroundOwn(s, f.pos).find((q) => isFrontCell(q)); if (q) spawnToken(s, f.owner, q, 'v_phantom'); }
  if (k('shove')) {
    const e = formationAt(s, { col: f.pos.col, row: frontRow(other(f.owner)) });
    if (e) {
      const dest = beside(e.pos).find((q) => !formationAt(s, q));
      if (dest) { s.events.push({ t: 'move', fid: e.fid, from: e.pos, to: dest }); e.pos = dest; }
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
    case 'powerArea': for (const o of [tgt, ...allies(s, tgt)]) o.buffs.power += n; break;
    case 'nerve': for (const o of [tgt, ...allies(s, tgt)]) o.morale = Math.min(maxNerve(o), o.morale + n); break;
    case 'scream': for (const o of s.formations.filter((o) => o.owner !== p && isFront(o) && Math.abs(o.pos.col - tgt.pos.col) <= 1)) shock(s, o, n); break;
    case 'silence': tgt.buffs.silenced = true; tgt.buffs.power -= n; break;
    case 'cloak': { tgt.cloaked = true; const q = emptyAroundOwn(s, tgt.pos).find((q) => isFrontCell(q)); if (q) spawnToken(s, p, q, 'v_phantom'); break; }
    case 'knives': for (const o of s.formations) if (o.owner === p && o.cloaked) o.buffs.power += n; break;
    case 'shell': for (const o of [tgt, ...aroundUnits(s, tgt)]) if (o.owner !== p) shock(s, o, n); break;
  }
}

function resolveRound(s: GameState) {
  s.events = [];
  for (const f of s.formations) f.buffs = noBuffs();

  // ── REVEAL ──
  s.events.push({ t: 'step', step: 'reveal' });
  const placed: [Formation, CardDef][] = [];
  const tactics: [PlayerId, CardInst, Pos][] = [];
  for (const p of [s.initiative, other(s.initiative)]) {
    const pl = s.players[p];
    const o = pl.orders!;
    if (o.escalate && !pl.escalateUsed) { pl.escalateUsed = true; s.pendingEscalations++; s.log.push(`P${p} ESCALATES`); }
    // Front placements first so same-round Back placements behind them are valid
    const sorted = [...o.deploys].sort((a, b) => Number(!isFrontCell(a.pos)) - Number(!isFrontCell(b.pos)));
    for (const d of sorted) {
      const idx = pl.hand.findIndex((h) => h.uid === d.uid);
      if (idx < 0) continue;
      const c = pl.hand[idx];
      const cd = def(c);
      if (cd.cost > pl.cp) continue;
      if (isTactic(cd)) { pl.hand.splice(idx, 1); pl.cp -= cd.cost; tactics.push([p, c, d.pos]); continue; }
      const f = placeUnit(s, p, c, d.pos);
      if (!f) continue;
      pl.hand.splice(idx, 1); pl.cp -= cd.cost;
      placed.push([f, cd]);
    }
    pl.orders = null;
  }
  for (const [f, cd] of placed) if (alive(s, f)) onReveal(s, f, cd);
  for (const [p, c, pos] of tactics) if (tacticTargetOk(s, p, def(c), pos)) applyTactic(s, p, c, pos); else s.players[p].discard.push(c.id);
  fallout(s);
  if (s.winner !== null) return;

  // ── BREACH ──
  s.events.push({ t: 'step', step: 'breach' });
  const { breaches, flanked } = computeBreaches(s);
  s.breaches = breaches.map((b) => b.fid);
  s.flanked = {};
  for (const b of breaches) s.events.push({ t: 'breach', fid: b.fid, pos: { ...b.pos }, owner: b.owner });
  for (const [f, n] of flanked) { s.flanked[f.fid] = n; s.events.push({ t: 'flank', fid: f.fid, pos: { ...f.pos }, amount: n }); }
  s.edge = RULES.formations ? computeEdge(s) : [];
  s.edge.forEach((w, col) => { if (w !== -1) s.events.push({ t: 'edge', col, owner: w as PlayerId }); });

  // ── STRIKE ──
  s.events.push({ t: 'step', step: 'strike' });
  strikeAll(s);

  // ── FALLOUT ──
  s.events.push({ t: 'step', step: 'fallout' });
  fallout(s);
  if (s.winner !== null) return;

  // ── UPKEEP ──
  s.events.push({ t: 'step', step: 'upkeep' });
  upkeep(s);
  checkWin(s);
  if (s.winner !== null) return;
  nextRound(s);
}

function upkeep(s: GameState) {
  for (const f of [...s.formations]) {
    if (!alive(s, f) || !f.cards.length) continue;
    const top = lead(f);
    if (has(f, 'grow') && (top.grow ?? 0) < 3) { top.grow = (top.grow ?? 0) + 1; s.events.push({ t: 'evolve', fid: f.fid, pos: f.pos }); }
    if (has(f, 'hatch')) {
      const kids = s.formations.filter((o) => o.owner === f.owner && o.cards.length && isToken(o) && lead(o).id === 'b_skitter').length;
      const c = emptyOwnCell(s, f.owner, f.pos);
      if (kids < 2 && c) spawnToken(s, f.owner, c, 'b_skitter');
    }
    if (has(f, 'shroud')) for (const o of allies(s, f)) o.cloaked = true;
    if (has(f, 'fade') && !f.cloaked && facing(s, f).length === 0) f.cloaked = true;
    if (has(f, 'dread')) for (const o of facing(s, f)) shock(s, o, 1, { ignoreAuras: true });
    if (has(f, 'decoy') && s.round >= f.deployedRound + 1) f.morale = 0; // phantoms hold for the round after they appear, then fade
  }
  fallout(s);
  if (s.winner !== null) return;
  // Cohesion: Nerve recovers from the allies around a unit (wounds never do).
  for (const f of s.formations) {
    if (!f.cards.length || has(f, 'decoy')) continue;
    if (isLinked(s, f)) { heal(s, f, 1); continue; } // the hive regrows flesh instead
    if (isFearless(s, f)) continue;
    const gain = Math.min(RULES.cohesionMax + (faction(s, f) === 'concord' ? 1 : 0), allies(s, f).length); // Concord: Drilled
    const before = f.morale;
    f.morale = Math.min(maxNerve(f), f.morale + gain);
    if (f.morale > before) s.events.push({ t: 'rally', fid: f.fid, pos: f.pos, amount: f.morale - before });
  }
  // Breakthrough: a unit that was In Breach and still stands drains 1 Resolve (max 1 per side)
  if (s.round >= RULES.breachFromRound) {
    for (const p of [0, 1] as PlayerId[]) {
      const still = s.breaches.map((fid) => getF(s, fid)).some((f) => f && f.owner === p && !has(f, 'decoy'));
      if (still) loseResolve(s, other(p), RULES.breachDrain, 'enemy broke through', 'breach');
    }
  }
}

function nextRound(s: GameState) {
  if (s.round >= RULES.maxRounds) {
    const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
    if (r0 !== r1) return end(s, r0 > r1 ? 0 : 1, 'time: higher Resolve');
    const fr = (p: PlayerId) => s.formations.filter((f) => f.owner === p && isFront(f)).length;
    if (fr(0) !== fr(1)) return end(s, fr(0) > fr(1) ? 0 : 1, 'time: held more of the line');
    return end(s, -1, 'time: dead even');
  }
  const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
  s.initiative = r0 < r1 ? 0 : r1 < r0 ? 1 : other(s.initiative);
  s.round++;
  s.events.push({ t: 'round', round: s.round });
  s.breaches = []; s.flanked = {}; s.edge = [];
  while (s.pendingEscalations > 0) { s.stakes = Math.min(RULES.maxStakes, s.stakes * 2); s.pendingEscalations--; }
  if (s.round === RULES.maxRounds) s.stakes = Math.min(RULES.maxStakes, s.stakes * 2);
  for (const p of [0, 1] as PlayerId[]) {
    s.players[p].cp = cpForRound(s.round) + (s.players[other(p)].resolve - s.players[p].resolve >= 3 ? RULES.underdogCp : 0);
    for (let i = 0; i < RULES.drawPerRound; i++) draw(s, p);
  }
  s.phase = 'orders';
}

// ───────────────────────── preview ─────────────────────────
export function simulate(s: GameState, p: PlayerId, orders: Orders): GameState {
  const c = structuredClone({ ...s, log: [], events: [] }) as GameState;
  c.players[p].orders = orders;
  c.players[other(p)].orders = { deploys: [] };
  resolveRound(c);
  return c;
}

// ───────────────────────── views ─────────────────────────
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
