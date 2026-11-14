// Shatterline server: serves the built client and hosts authoritative 1v1 rooms
// over WebSocket. vs-AI games run entirely in the browser.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Faction } from '../shared/cards';
import { Action, GameState, Orders, PlayerId, apply, newGame, viewFor } from '../shared/engine';
import { tunedDeck } from '../shared/ai';
import { MAX_CLIENT_BYTES } from '../shared/protocol';
import type { ClientMsg, ServerMsg } from '../shared/protocol';
import { randomInt } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8080);
const here = fileURLToPath(new URL('.', import.meta.url));
const STATIC = [join(here, 'client'), join(here, '../../dist/client')].find((p) => existsSync(p)) ?? join(here, 'client');

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p === '/' || !extname(p)) p = '/index.html';
    const body = await readFile(join(STATIC, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': p.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(body);
  } catch {
    // malformed URI, missing file, directory read, ...: never let a request take the process down
    if (!res.headersSent) res.writeHead(404);
    res.end('not found');
  }
});

interface Room {
  code: string;
  sockets: [WebSocket | null, WebSocket | null];
  factions: [Faction | null, Faction | null];
  state: GameState | null;
  lastActive: number;
}
const rooms = new Map<string, Room>();
const MAX_ROOMS = 1000;
const IDLE_MS = 60 * 60 * 1000;

const send = (ws: WebSocket | null, m: ServerMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
function code(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  do { c = Array.from({ length: 5 }, () => A[randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}
function broadcast(r: Room) {
  if (!r.state) return;
  for (const seat of [0, 1] as PlayerId[]) { const v = viewFor(r.state, seat); send(r.sockets[seat], { t: 'state', state: v, events: v.events }); }
}

// ── input validation: everything from the wire is untrusted ──
const FACTIONS: readonly string[] = ['concord', 'brood', 'hush'];
const isFaction = (x: unknown): x is Faction => typeof x === 'string' && FACTIONS.includes(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && Math.abs(x) < 1e9;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Rebuild an Orders object from untrusted JSON, or null if it is malformed. Extra fields are dropped. */
function cleanOrders(o: unknown): Orders | null {
  if (!isObj(o) || !Array.isArray(o.deploys) || o.deploys.length > 24) return null;
  const deploys: Orders['deploys'] = [];
  for (const d of o.deploys) {
    if (!isObj(d) || !isInt(d.uid) || !isObj(d.pos) || !isInt(d.pos.col) || !isInt(d.pos.row)) return null;
    deploys.push({ uid: d.uid, pos: { col: d.pos.col, row: d.pos.row } });
  }
  const out: Orders = { deploys };
  if (o.escalate !== undefined) { if (typeof o.escalate !== 'boolean') return null; out.escalate = o.escalate; }
  if (o.stake !== undefined) { if (!isInt(o.stake)) return null; out.stake = o.stake; }
  return out;
}

/** The server ignores any `player` field a client sends: the seat comes from the socket. */
function cleanAction(a: unknown, seat: PlayerId): Action | null {
  if (!isObj(a)) return null;
  if (a.type === 'retreat') return { type: 'retreat', player: seat };
  if (a.type === 'orders') { const orders = cleanOrders(a.orders); return orders ? { type: 'orders', player: seat, orders } : null; }
  return null;
}

function forfeit(r: Room, seat: PlayerId) {
  if (r.state && r.state.phase !== 'over') { apply(r.state, { type: 'retreat', player: seat }); broadcast(r); }
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_CLIENT_BYTES });
const alive = new WeakSet<WebSocket>();
wss.on('connection', (ws) => {
  let room: Room | null = null;
  let seat: PlayerId = 0;
  alive.add(ws);
  ws.on('pong', () => alive.add(ws));
  ws.on('error', () => { /* oversized frame, reset, ...: 'close' follows */ });
  let budget = 30, refill = Date.now();
  ws.on('message', (raw, isBinary) => {
    const now = Date.now();
    budget = Math.min(30, budget + (now - refill) / 100); refill = now; // ~10 msgs/s sustained, bursts of 30
    if (--budget < 0) return ws.close(1008, 'rate limit');
    if (isBinary) return;
    let m: ClientMsg;
    try { m = JSON.parse(String(raw)); } catch { return send(ws, { t: 'error', msg: 'bad message' }); }
    if (!isObj(m)) return send(ws, { t: 'error', msg: 'bad message' });
    try {
      if (m.t === 'create') {
        if (room) return send(ws, { t: 'error', msg: 'already in a room' });
        if (!isFaction(m.faction)) return send(ws, { t: 'error', msg: 'bad faction' });
        if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'error', msg: 'Server busy, try again later' });
        room = { code: code(), sockets: [ws, null], factions: [m.faction, null], state: null, lastActive: Date.now() };
        seat = 0;
        rooms.set(room.code, room);
        send(ws, { t: 'room', code: room.code, seat });
      } else if (m.t === 'join') {
        if (room) return send(ws, { t: 'error', msg: 'already in a room' });
        if (typeof m.code !== 'string' || !isFaction(m.faction)) return send(ws, { t: 'error', msg: 'bad join request' });
        const r = rooms.get(m.code.trim().toUpperCase());
        if (!r || r.sockets[1] || r.state || !r.sockets[0]) return send(ws, { t: 'error', msg: 'Room not found or full' });
        room = r; seat = 1;
        r.sockets[1] = ws; r.factions[1] = m.faction;
        r.lastActive = Date.now();
        // Cryptographic seed: a guessable (timestamp) seed would let a client rebuild the opponent's hand and deck order.
        r.state = newGame(r.factions[0]!, r.factions[1]!, randomInt(2 ** 31), [tunedDeck(r.factions[0]!), tunedDeck(r.factions[1]!)]);
        send(r.sockets[0], { t: 'start', seat: 0 });
        send(ws, { t: 'start', seat: 1 });
        broadcast(r);
      } else if (m.t === 'action') {
        if (!room?.state) return send(ws, { t: 'error', msg: 'game not started' });
        const a = cleanAction(m.action, seat);
        if (!a) return send(ws, { t: 'error', msg: 'bad action' });
        if (room.state.phase === 'over') return send(ws, { t: 'error', msg: 'game over' });
        // Orders are final once locked in: re-submitting would let a player edit them after seeing the opponent locked.
        if (a.type === 'orders' && room.state.players[seat].orders) return send(ws, { t: 'error', msg: 'orders already locked' });
        room.lastActive = Date.now();
        const err = apply(room.state, a);
        if (err) return send(ws, { t: 'error', msg: err });
        broadcast(room);
      } else send(ws, { t: 'error', msg: 'unknown message' });
    } catch (e) {
      console.error('message handler failed', e);
      send(ws, { t: 'error', msg: 'server error' });
    }
  });
  ws.on('close', () => {
    if (!room) return;
    const r = room;
    if (r.sockets[seat] !== ws) return;
    r.sockets[seat] = null;
    const opp = r.sockets[(1 - seat) as PlayerId];
    // Leaving mid-game forfeits (no reconnect support): the opponent is told and sees the game end.
    try { forfeit(r, seat); } catch (e) { console.error('forfeit failed', e); }
    send(opp, { t: 'opponentLeft' });
    // A room whose host left before anyone joined is dead; so is one with nobody left.
    if (!r.state || !opp) rooms.delete(r.code);
    else if (!r.sockets[0] && !r.sockets[1]) rooms.delete(r.code);
  });
});

// keep idle sockets alive through proxies and drop dead ones
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) { ws.terminate(); continue; }
    alive.delete(ws);
    try { ws.ping(); } catch { /* closing */ }
  }
}, 25_000).unref();

// sweep idle rooms (and close their sockets so they don't linger as orphans)
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rooms) if (now - r.lastActive > IDLE_MS) { rooms.delete(k); for (const w of r.sockets) w?.close(1001, 'room expired'); }
}, 5 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`Shatterline server on :${PORT} (static: ${STATIC})`));
