import { CARD_BY_ID, FACTION_INFO, Faction, isTactic } from '../shared/cards';
import {
  DeployOrder, Formation, GameEvent, GameState, PlayerId, Pos, allCells, canDeployAt, def, formationAt, isFrontCell, key, lead, other, samePos, simulate, RULES,
} from '../shared/engine';
import { Board3D } from './board3d';
import { cardEl, openInspect, previewEl } from './cardview';
import { Controller, LocalAIGame, OnlineGame } from './net';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ───────────────────────── menu ─────────────────────────
let faction: Faction = 'concord';
let arch: string | undefined;

function renderMenu() {
  $('glory-total').textContent = `Glory: ${glory()}`;
  const fp = $('faction-pick');
  fp.innerHTML = '';
  for (const f of Object.keys(FACTION_INFO) as Faction[]) {
    const info = FACTION_INFO[f];
    const d = document.createElement('div');
    d.className = 'fcard' + (f === faction ? ' sel' : '');
    d.style.setProperty('--fc', info.color);
    d.classList.add('plate');
    const hero = { concord: 'c_trooper', brood: 'b_ravager', hush: 'v_blade' }[f];
    d.innerHTML = `<div class="fart" style="background-image:url(/art/${hero}.webp)"></div><div class="ftxt"><h4>${info.name}</h4><p>${info.blurb}</p></div>`;
    d.onclick = () => { faction = f; arch = undefined; renderMenu(); };
    fp.appendChild(d);
  }
  const ap = $('arch-pick');
  ap.innerHTML = '';
  const opts: [string | undefined, string][] = [[undefined, 'Balanced deck'], ...Object.entries(FACTION_INFO[faction].archetypes)];
  for (const [k, label] of opts) {
    const b = document.createElement('span');
    b.className = 'arch' + (k === arch ? ' sel' : '');
    b.textContent = label;
    b.onclick = () => { arch = k; renderMenu(); };
    ap.appendChild(b);
  }
}
renderMenu();

$('btn-ai').onclick = () => {
  const others = (Object.keys(FACTION_INFO) as Faction[]).filter((f) => f !== faction);
  const g = new LocalAIGame(faction, arch, others[Math.floor(Math.random() * others.length)]);
  startGame(g);
  g.start();
};
$('btn-host').onclick = () => {
  const g = new OnlineGame({ host: true, faction });
  g.onRoom = (code) => { $('menu-status').textContent = `Room ${code}: share this code. Waiting for opponent…`; };
  g.onInfo = (m) => { $('menu-status').textContent = m; };
  g.onStart = () => startGame(g);
};
$('btn-join').onclick = () => {
  const code = ($('join-code') as HTMLInputElement).value.trim().toUpperCase();
  if (code.length < 4) { $('menu-status').textContent = 'Enter a room code'; return; }
  const g = new OnlineGame({ host: false, code, faction });
  g.onInfo = (m) => { $('menu-status').textContent = m; };
  g.onStart = () => startGame(g);
};
$('btn-menu').onclick = () => location.reload();

// ───────────────────────── game ─────────────────────────
let board: Board3D;
let ctl: Controller;
let state: GameState | null = null;
let me: PlayerId = 0;
let pending: DeployOrder[] = [];
let selected: number | null = null;   // uid
let locked = false;
let playing = false;
let gameOverShown = false;   // Glory is banked once per game
const queue: { s: GameState; ev: GameEvent[] }[] = [];

function startGame(c: Controller) {
  ctl = c;
  me = c.seat;
  state = null; pending = []; selected = null; locked = false; playing = false; gameOverShown = false; queue.length = 0;
  $('menu').classList.add('hidden');
  $('game').classList.remove('hidden');
  board = new Board3D($('board'));
  board.setSeat(me);
  board.onFloat = floatText;
  c.onState = (s, ev) => { queue.push({ s, ev }); pump(); };
  c.onInfo = (m) => {
    log(`⚠ ${m}`);
    // a rejected Lock In must not leave the button stuck on "Waiting…"
    if (locked && state && state.phase !== 'over' && !/disconnect|closed/i.test(m)) { locked = false; refresh(); }
  };
  board.renderer.domElement.addEventListener('click', onBoardClick);
  board.renderer.domElement.addEventListener('mousemove', onBoardHover);
  board.renderer.domElement.addEventListener('mouseleave', () => showPreview(null));
  board.renderer.domElement.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (!state) return;
    const p = board.pick(ev.clientX, ev.clientY);
    const f = p ? formationAt(state, p) : undefined;
    if (f && lead(f) && f.cards[0].id !== '?') openInspect(lead(f).id, formationDetail(f));
  });
}

async function pump() {
  if (playing) return;
  playing = true;
  while (queue.length) {
    const { s, ev } = queue.shift()!;
    me = ctl.seat;
    if (state && ev.length) { try { await playback(state, s, ev); } catch (err) { console.warn('playback failed', err); banner(''); } }
    const freshRound = !state || ev.length > 0 || s.round !== state.round || s.phase === 'over';
    state = s;
    if (freshRound) { pending = []; selected = null; locked = false; }
    board.sync(s, me);
    refresh();
    if (s.phase === 'over' && !gameOverShown) showGameOver(s);
  }
  playing = false;
}

// ───────────────────────── HUD ─────────────────────────
function refresh() {
  if (!state) return;
  const s = state;
  const P = s.players[me], O = s.players[other(me)];
  $('me-name').textContent = `You · ${FACTION_INFO[P.faction].name}`;
  $('opp-name').textContent = `${FACTION_INFO[O.faction].name} · Enemy`;
  setResolve('me-res', P.resolve);
  setResolve('opp-res', O.resolve);
  $('round').textContent = `Round ${s.round}/${RULES.maxRounds}`;
  $('stakes').textContent = `Glory at stake: ${s.stakes}${s.pendingEscalations ? ' → ' + Math.min(RULES.maxStakes, s.stakes * 2 ** s.pendingEscalations) + ' next round' : ''}${s.initiative === me ? ' · You have initiative' : ''}${s.round === RULES.maxRounds ? ' · Final round: stakes double' : ''}${s.players[1 - me].resolve - s.players[me].resolve >= 3 && RULES.underdogCp ? ' · Underdog +' + RULES.underdogCp + ' Command' : ''}`;
  const spent = pending.reduce((a, d) => a + def(P.hand.find((h) => h.uid === d.uid)!).cost, 0);
  $('cp-n').textContent = String(P.cp - spent);
  const esc = $<HTMLInputElement>('escalate');
  (esc.closest('label') as HTMLElement).style.display = RULES.maxStakes > 1 ? '' : 'none';
  esc.disabled = P.escalateUsed || locked;
  if (P.escalateUsed) esc.checked = false;
  $('esc-sub').textContent = P.escalateUsed ? 'already used this game' : `stakes ${s.stakes} → ${Math.min(RULES.maxStakes, s.stakes * 2)} Glory`;
  $<HTMLButtonElement>('btn-lock').disabled = locked || s.phase === 'over';
  $<HTMLButtonElement>('btn-lock').textContent = locked ? 'Waiting…' : 'Lock In';
  renderHand(P.cp - spent);
  drawOverlays();
  const oppLocked = !!s.players[other(me)].orders;
  const hintEl = $('hint');
  const prevHint = hintEl.textContent;
  hintEl.textContent = locked ? 'Orders locked. Waiting for the enemy…'
    : oppLocked ? 'The enemy has locked in their orders.'
    : selected !== null ? 'Click a highlighted cell to place it (or click the card again to cancel).'
    : 'Place cards on your Front or Back row. Tags show what happens if the enemy adds nothing. Then Lock In.';
  if (hintEl.textContent !== prevHint) { hintEl.classList.remove('fade'); void hintEl.offsetWidth; hintEl.classList.add('fade'); }
}

function setResolve(id: string, n: number) {
  const el = $(id);
  const pips = Array.from({ length: RULES.startResolve }, (_, i) => `<span class="pip${i < n ? '' : ' lost'}"></span>`).join('');
  el.innerHTML = `${pips}<span class="n" title="Resolve">${Math.max(0, n)}</span>`;
}

function renderHand(cpLeft: number) {
  const h = $('hand');
  if (h.querySelector('.card:hover')) showPreview(null); // the hovered card is about to be replaced without a mouseleave
  h.innerHTML = '';
  if (!state) return;
  for (const c of state.players[me].hand) {
    const d = def(c);
    const el = cardEl(d);
    const used = pending.some((p) => p.uid === c.uid);
    if (used) el.classList.add('used');
    if (!used && d.cost > cpLeft) el.classList.add('unaffordable');
    if (selected === c.uid) el.classList.add('sel');
    el.onclick = () => {
      if (locked) return;
      if (used) { pending = pending.filter((p) => p.uid !== c.uid); selected = null; }
      else if (selected === c.uid) selected = null;
      else if (d.cost <= cpLeft) selected = c.uid;
      refresh();
    };
    el.onmouseenter = () => showPreview(d.id);
    el.onmouseleave = () => showPreview(null);
    el.oncontextmenu = (e) => { e.preventDefault(); openInspect(d.id); };
    onLongPress(el, () => openInspect(d.id));
    const n = state.players[me].hand.length, i = state.players[me].hand.indexOf(c), mid = (n - 1) / 2;
    el.style.setProperty('--fan', `${((i - mid) * 2.2).toFixed(1)}deg`);
    el.style.setProperty('--arc', `${(Math.abs(i - mid) ** 1.6 * 2.2).toFixed(1)}px`);
    h.appendChild(el);
  }
}

function legalHexes(uid: number): Pos[] {
  if (!state) return [];
  const c = state.players[me].hand.find((h) => h.uid === uid);
  if (!c) return [];
  const d = def(c);
  const unitCells = pending.filter((q) => !isTactic(def(state!.players[me].hand.find((h) => h.uid === q.uid)!))).map((q) => q.pos);
  return allCells().filter((p) => canDeployAt(state!, me, d, p, unitCells) && (isTactic(d) || !unitCells.some((q) => samePos(q, p))));
}

function drawOverlays() {
  if (!state) return;
  board.clearOverlays();
  // intents: simulate this round with my pending orders (enemy assumed to add nothing)
  if (state.phase === 'orders') {
    try {
      const sim = simulate(state, me, { deploys: pending });
      const owner = (fid: number) => state!.formations.find((f) => f.fid === fid)?.owner ?? sim.formations.find((f) => f.fid === fid)?.owner;
      const seen = new Set<number>();
      const evs = sim.events.filter((e) => {
        if (e.t === 'strike') return true;
        if (e.t === 'move' && !seen.has(e.fid)) { seen.add(e.fid); return true; }
        return false;
      });
      board.intents(evs, owner, me);
      // Predicted outcomes: everything but the enemy's hidden placements is known, so show it.
      const gone = new Map<number, 'rout' | 'kill'>();
      for (const e of sim.events) { if (e.t === 'break') gone.set(e.fid, 'rout'); else if (e.t === 'destroy') gone.set(e.fid, 'kill'); }
      const posOf = new Map<number, Pos>();
      for (const e of sim.events) if (e.t === 'deploy') posOf.set(e.fid, e.pos);
      for (const f of state.formations) posOf.set(f.fid, f.pos);
      for (const [fid, pos] of posOf) {
        const before = state.formations.find((f) => f.fid === fid);
        const after = sim.formations.find((f) => f.fid === fid);
        const mine = (before ?? after)?.owner === me || (!before && !after);
        if (before && before.owner !== me && lead(before)?.id === '?') continue; // cloaked: we don't actually know its stats
        const g = gone.get(fid);
        if (g) { board.outcome(pos, g === 'rout' ? 'ROUTS' : 'KILLED', mine ? 'bad' : 'good'); continue; }
        if (before && after && after.morale < before.morale && !lead(before)?.id.startsWith('?')) {
          board.outcome(pos, `−${before.morale - after.morale} NERVE`, 'info');
        }
      }
    } catch (err) { console.warn('preview failed', err); }
  }
  for (const p of pending) {
    const c = state.players[me].hand.find((h) => h.uid === p.uid)!;
    board.ghost(p.pos, c.id, state.players[me].faction, isTactic(def(c)));
  }
  if (selected !== null) board.highlight(legalHexes(selected));
}

function onBoardClick(ev: MouseEvent) {
  if (!state || locked || playing) return;
  const p = board.pick(ev.clientX, ev.clientY);
  if (!p) return;
  if (selected !== null) {
    if (legalHexes(selected).some((h) => samePos(h, p))) {
      pending.push({ uid: selected, pos: p });
      selected = null;
      refresh();
    }
    return;
  }
  // clicking a pending ghost removes it
  const i = pending.findIndex((q) => samePos(q.pos, p));
  if (i >= 0) { pending.splice(i, 1); refresh(); }
}

function onBoardHover(ev: MouseEvent) {
  if (!state) return;
  const p = board.pick(ev.clientX, ev.clientY);
  const f = p ? formationAt(state, p) : undefined;
  if (f && lead(f)) showPreview(lead(f).id, formationInfo(f));
  else showPreview(null); // the pointer is on the board, so any hand-card preview is stale
}

function formationInfo(f: Formation): string {
  if (f.cards[0]?.id === '?') return 'A cloaked enemy. Step next to it to reveal it.';
  const parts = [`Stack: ${f.cards.map((c) => CARD_BY_ID[c.id].name).join(' + ')}`];
  if (f.cloaked) parts.push('Cloaked');
  const g = lead(f).grow ?? 0;
  if (g) parts.push(`Evolved +${g}`);
  return parts.join('<br>');
}

function formationDetail(f: Formation): string {
  const owner = f.owner === me ? 'Yours' : 'Enemy';
  const cards = f.cards.map((c) => `${CARD_BY_ID[c.id].name}${c.grow ? ` (evolved +${c.grow})` : ''}${c.dmg ? ` (−${c.dmg} Power)` : ''}`).join('<br>');
  return `<b>${owner}</b> · Power <b>${f.cards.reduce((a, c) => a + Math.max(0, CARD_BY_ID[c.id].power + (c.grow ?? 0) - c.dmg), 0)}</b> · Nerve <b>${f.morale}</b>${f.cloaked ? ' · cloaked' : ''}<br>${f.cards.length > 1 ? 'Stack (top card leads):<br>' : ''}${cards}`;
}

function onLongPress(el: HTMLElement, fn: () => void) {
  let t = 0, fired = false;
  el.addEventListener('touchstart', () => { fired = false; t = window.setTimeout(() => { fired = true; fn(); }, 480); }, { passive: true });
  for (const ev of ['touchend', 'touchmove', 'touchcancel']) el.addEventListener(ev, () => clearTimeout(t));
  // the click that follows a long-press must not also select/cancel the card
  el.addEventListener('click', (e) => { if (fired) { fired = false; e.stopImmediatePropagation(); } }, true);
}

let previewKey: string | null = null;
function showPreview(id: string | null, extra = '') {
  const k = id ? id + extra : null;
  if (k === previewKey) return;
  previewKey = k;
  const el = $('preview');
  el.innerHTML = '';
  if (id) el.appendChild(previewEl(id, extra));
}

$('btn-lock').onclick = () => {
  if (!state || locked) return;
  locked = true;
  ctl.submit({ deploys: pending, escalate: $<HTMLInputElement>('escalate').checked });
  refresh();
};
$('btn-log').onclick = () => $('log').classList.toggle('open');
$('btn-retreat').onclick = () => {
  if (!state || state.phase === 'over') return;
  if (confirm(`Sound the retreat? You concede now and lose only the current ${state.stakes} Glory.`)) ctl.retreat();
};

// ───────────────────────── playback ─────────────────────────
const STEP_NAMES: Record<string, string> = { reveal: 'REVEAL', strike: 'STRIKE', fallout: 'FALLOUT', upkeep: 'UPKEEP' };

async function playback(prev: GameState, next: GameState, ev: GameEvent[]) {
  board.clearOverlays();
  $('hint').textContent = '';
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let i = 0;
  // working copy of names for log
  const nameOf = (fid: number) => {
    const f = next.formations.find((x) => x.fid === fid) ?? prev.formations.find((x) => x.fid === fid);
    return f && f.cards[0] ? CARD_BY_ID[lead(f).id]?.name ?? '?' : 'unit';
  };
  while (i < ev.length) {
    const e = ev[i];
    if (e.t === 'step') {
      if (e.step === 'upkeep' || e.step === 'fallout') { i++; continue; }
      if (!STEP_NAMES[e.step]) { i++; continue; }
      banner(STEP_NAMES[e.step]);
      await wait(550);
      i++; continue;
    }
    if (e.t === 'strike') {
      // play a whole batch of strikes simultaneously
      const batch: typeof ev = [];
      while (i < ev.length && ['strike', 'shock', 'damage', 'heal', 'reveal', 'evolve'].includes(ev[i].t)) batch.push(ev[i++]);
      await Promise.all(batch.filter((b) => b.t === 'strike').map((b) => board.animateStrike(b as Extract<GameEvent, { t: 'strike' }>)));
      for (const b of batch) await handleMinor(b, next, nameOf);
      await wait(250);
      continue;
    }
    await handleMinor(e, next, nameOf);
    i++;
  }
  banner('');
}

async function handleMinor(e: GameEvent, next: GameState, nameOf: (fid: number) => string) {
  switch (e.t) {
    case 'deploy': {
      const fNext = next.formations.find((f) => f.fid === e.fid);
      const f: Formation = fNext ?? { fid: e.fid, owner: e.owner, pos: e.pos, cards: [{ uid: -1, id: e.id, dmg: 0 }], morale: CARD_BY_ID[e.id]?.nerve ?? 1, deployedRound: 0, cloaked: next.players[e.owner].faction === 'hush', buffs: { power: 0, silenced: false } };
      if (e.reinforce) { board.burst(e.pos, '#ffe0a0', 16); board.float(e.pos, '+REINFORCE', '#ffd27a'); }
      else await board.animateDeploy({ ...f, pos: e.pos }, next, me);
      break;
    }
    case 'heal': board.float(e.pos, `+${e.amount} ♥`, '#7aff8a'); break;
    case 'tactic': board.float(e.pos, CARD_BY_ID[e.id].name, '#ffe9b0'); board.burst(e.pos, '#fff0c0', 18); log(`${e.owner === me ? 'You' : 'Enemy'} played ${CARD_BY_ID[e.id].name}`); await sleep(350); break;
    case 'move': await board.animateMove(e.fid, e.to); break;
    case 'strike': log(`${nameOf(e.fid)} → ${nameOf(e.target)}: ${e.amount}${e.lethal ? ' dmg' : ' shock'}`); break;
    case 'shock': board.float(e.pos, `-${e.amount} ☠`, '#6fb8ff'); break;
    case 'damage': board.float(e.pos, `-${e.amount} ♥`, '#ff5a3a'); break;
    case 'break': board.float(e.pos, 'ROUTED', '#ff9a3a'); board.burst(e.pos, '#ff7a3a', 24); log(`💥 ${nameOf(e.fid)} breaks: routed back to hand`); await board.animateRemove(e.fid); break;
    case 'destroy': board.float(e.pos, 'KILLED', '#ff3a2a'); board.burst(e.pos, '#ff2a1a', 34); log(`☠ ${nameOf(e.fid)} is destroyed for good`); await board.animateRemove(e.fid); break;
    case 'rally': board.float(e.pos, `+${e.amount} RALLY`, '#8dff7a'); break;
    case 'reveal': board.float(e.pos, 'REVEALED', '#b99cff'); board.burst(e.pos, '#9a7aff', 20); break;
    case 'evolve': board.float(e.pos, 'EVOLVE', '#9dff5a'); break;
    case 'resolve': {
      const who = e.player === me ? 'You' : 'Enemy';
      log(`${who}: ${e.delta} Resolve (${e.reason})`);
      const st = state!; const pl = st.players[e.player];
      void pl; setResolve(e.player === me ? 'me-res' : 'opp-res', (Number($(e.player === me ? 'me-res' : 'opp-res').querySelector('.n')?.textContent) || 0) + e.delta);
      break;
    }
    case 'round': banner(`ROUND ${e.round}`); await sleep(700); break;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function banner(t: string) {
  const b = $('banner');
  b.textContent = t;
  b.classList.toggle('show', !!t);
}

function floatText(x: number, y: number, text: string, color: string) {
  const d = document.createElement('div');
  d.className = 'float';
  d.style.left = `${x}px`; d.style.top = `${y}px`; d.style.color = color;
  d.textContent = text;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}

function log(t: string) {
  const l = $('log');
  const d = document.createElement('div');
  d.textContent = t;
  l.prepend(d);
  while (l.childElementCount > 80) l.lastChild?.remove();
}

/** Glory: the running score Escalate raises the stakes on (kept in this browser). */
function glory(): number { try { return Number(localStorage.getItem('sl.glory') ?? 0) || 0; } catch { return 0; } }
function addGlory(n: number): number { const t = glory() + n; try { localStorage.setItem('sl.glory', String(t)); } catch { /* private mode */ } return t; }

function showGameOver(s: GameState) {
  gameOverShown = true;
  const won = s.winner === me, draw = s.winner === -1;
  $('go-title').textContent = draw ? 'STALEMATE' : won ? 'VICTORY' : 'DEFEAT';
  $('go-title').style.color = draw ? '#ccc' : won ? '#e0a03c' : '#c8452f';
  const delta = draw ? 0 : won ? s.stakes : -s.stakes;
  const total = addGlory(delta);
  $('go-sub').textContent = `${s.endReason} · ${delta >= 0 ? '+' : '−'}${Math.abs(delta)} Glory (total ${total})`;
  $('gameover').classList.remove('hidden');
}

void key;

// Debug/test hook: lets automated tests find legal placements & screen positions.
(window as unknown as { __sl: unknown }).__sl = {
  legal: (uid: number) => legalHexes(uid).map((p) => board.screenOf(p, 0.1)),
  units: () => state?.formations.filter((f) => f.cards.length).map((f) => { const [x, y] = board.screenOf(f.pos, 0.15); return { id: lead(f).id, owner: f.owner, x, y }; }) ?? [],
  preview: () => document.getElementById('preview')?.textContent ?? '',
  hand: () => state?.players[me].hand.map((c) => ({ uid: c.uid, id: c.id, tactic: isTactic(def(c)), cost: def(c).cost })) ?? [],
};
