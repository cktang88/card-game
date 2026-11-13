// Shatterline server: serves the built client and hosts authoritative 1v1 rooms
// over WebSocket. vs-AI games run entirely in the browser.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Faction } from '../shared/cards';
import { Action, GameState, PlayerId, apply, newGame, viewFor } from '../shared/engine';
import { tunedDeck } from '../shared/ai';
import type { ClientMsg, ServerMsg } from '../shared/protocol';

const PORT = Number(process.env.PORT ?? 8080);
const here = fileURLToPath(new URL('.', import.meta.url));
const STATIC = [join(here, 'client'), join(here, '../../dist/client')].find((p) => existsSync(p)) ?? join(here, 'client');

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/healthz') { res.end('ok'); return; }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p === '/' || !extname(p)) p = '/index.html';
  try {
    const body = await readFile(join(STATIC, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream', 'cache-control': p.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
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

const send = (ws: WebSocket | null, m: ServerMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); };
function code(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  do { c = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}
function broadcast(r: Room) {
  if (!r.state) return;
  for (const seat of [0, 1] as PlayerId[]) { const v = viewFor(r.state, seat); send(r.sockets[seat], { t: 'state', state: v, events: v.events }); }
}

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  let room: Room | null = null;
  let seat: PlayerId = 0;
  ws.on('message', (raw) => {
    let m: ClientMsg;
    try { m = JSON.parse(String(raw)); } catch { return; }
    if (m.t === 'create') {
      room = { code: code(), sockets: [ws, null], factions: [m.faction, null], state: null, lastActive: Date.now() };
      seat = 0;
      rooms.set(room.code, room);
      send(ws, { t: 'room', code: room.code, seat });
    } else if (m.t === 'join') {
      const r = rooms.get(m.code.toUpperCase());
      if (!r || r.sockets[1]) return send(ws, { t: 'error', msg: 'Room not found or full' });
      room = r; seat = 1;
      r.sockets[1] = ws; r.factions[1] = m.faction;
      r.state = newGame(r.factions[0]!, r.factions[1]!, undefined, [tunedDeck(r.factions[0]!), tunedDeck(r.factions[1]!)]);
      send(r.sockets[0], { t: 'start', seat: 0 });
      send(ws, { t: 'start', seat: 1 });
      broadcast(r);
    } else if (m.t === 'action' && room?.state) {
      const a = { ...m.action, player: seat } as Action;
      const err = apply(room.state, a);
      room.lastActive = Date.now();
      if (err) return send(ws, { t: 'error', msg: err });
      broadcast(room);
    }
  });
  ws.on('close', () => {
    if (!room) return;
    room.sockets[seat] = null;
    send(room.sockets[(1 - seat) as PlayerId], { t: 'opponentLeft' });
    if (!room.sockets[0] && !room.sockets[1]) rooms.delete(room.code);
  });
});

// sweep idle rooms
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rooms) if (now - r.lastActive > 60 * 60 * 1000) rooms.delete(k);
}, 5 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`Shatterline server on :${PORT} (static: ${STATIC})`));
