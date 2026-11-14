// End-to-end multiplayer test: spawns the real server, plays a full game with two WebSocket clients using
// random legal orders, scans every message for hidden-info leaks, and throws abuse at the server.
// Run: npx tsx src/tests/net-e2e.ts
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { GameState, Orders, PlayerId, validateOrders } from '../shared/engine';
import type { ServerMsg } from '../shared/protocol';

const PORT = Number(process.env.NET_TEST_PORT ?? 8091);
const URL = `ws://127.0.0.1:${PORT}/ws`;
let failures = 0, checks = 0;
const ok = (c: unknown, msg: string) => { checks++; if (!c) { failures++; console.error('FAIL:', msg); } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── tiny seeded RNG so failures reproduce ──
let seed = Number(process.env.SEED ?? 12345);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

class Client {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  raw: string[] = [];
  seat: PlayerId = 0;
  view: GameState | null = null;
  closed = false;
  closeCode = 0;
  constructor() {
    this.ws = new WebSocket(URL);
    this.ws.on('message', (d) => {
      const s = String(d); this.raw.push(s);
      const m = JSON.parse(s) as ServerMsg; this.msgs.push(m);
      if (m.t === 'room' || m.t === 'start') this.seat = m.seat;
      if (m.t === 'state') { this.view = m.state; this.onState?.(m.state); }
    });
    this.ws.on('close', (c) => { this.closed = true; this.closeCode = c; });
    this.ws.on('error', () => {});
  }
  onState?: (s: GameState) => void;
  open() { return new Promise<void>((res, rej) => { this.ws.once('open', () => res()); this.ws.once('error', rej); }); }
  send(o: unknown) { this.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); }
  async waitFor<T extends ServerMsg['t']>(t: T, ms = 3000): Promise<Extract<ServerMsg, { t: T }>> {
    const end = Date.now() + ms;
    for (;;) {
      const m = this.msgs.find((x) => x.t === t);
      if (m) { this.msgs.splice(this.msgs.indexOf(m), 1); return m as Extract<ServerMsg, { t: T }>; }
      if (Date.now() > end) throw new Error(`timeout waiting for ${t}`);
      await sleep(5);
    }
  }
  async nextError(ms = 1500): Promise<string> { return (await this.waitFor('error', ms)).msg; }
  async noMessage(ms = 150) { await sleep(ms); }
  close() { this.ws.close(); }
}

// ── leak scanner ──
const isMasked = (c: { id: string; uid: number }) => c.id === '?' && c.uid === -1;
const handUids = new Map<PlayerId, Set<number>>([[0, new Set()], [1, new Set()]]);
function* walkNoFormations(x: unknown, path = ''): Generator<[string, any]> {
  if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) yield* walkNoFormations(x[i], `${path}[${i}]`); }
  else if (x && typeof x === 'object') {
    yield [path, x];
    for (const [k, v] of Object.entries(x)) if (k !== 'formations') yield* walkNoFormations(v, `${path}.${k}`);
  }
}
function scanView(v: GameState, seat: PlayerId, what: string) {
  const opp = (1 - seat) as PlayerId;
  ok(v.players[opp].hand.every(isMasked), `${what}: opponent hand not masked`);
  ok(v.players[0].deck.every(isMasked) && v.players[1].deck.every(isMasked), `${what}: deck order visible`);
  ok(v.players[opp].orders === null || (v.players[opp].orders!.deploys.length === 0 && !v.players[opp].orders!.escalate && v.players[opp].orders!.stake === undefined), `${what}: opponent pending orders visible`);
  ok(v.rng === 0 && v.log.length === 0, `${what}: rng/log leaked`);
  for (const f of v.formations) if (f.owner !== seat && f.cloaked) ok(f.cards.length === 1 && isMasked(f.cards[0]) && f.morale === -1, `${what}: cloaked enemy formation ${f.fid} revealed`);
  for (const e of v.events) if (e.t === 'deploy' && e.owner !== seat && v.players[e.owner].faction === 'hush') ok(e.id === '?', `${what}: hush deploy event reveals id`);
  // opponent hand uids (as seen by the opponent themselves) must not appear outside formations in my view
  const oppHand = handUids.get(opp)!;
  for (const [p, o] of walkNoFormations(v)) if (typeof o.uid === 'number' && o.uid >= 0 && oppHand.has(o.uid) && p !== `.players[${seat}].hand`) { ok(false, `${what}: opponent hand uid ${o.uid} at ${p}`); }
}

function randomOrders(v: GameState, seat: PlayerId): Orders {
  const hand = [...v.players[seat].hand];
  for (let attempt = 0; attempt < 30; attempt++) {
    const deploys: Orders['deploys'] = [];
    const n = Math.floor(rnd() * 4);
    for (let i = 0; i < n && hand.length; i++) {
      const c = hand[Math.floor(rnd() * hand.length)];
      if (deploys.some((d) => d.uid === c.uid)) continue;
      deploys.push({ uid: c.uid, pos: { col: Math.floor(rnd() * 5), row: seat === 0 ? 2 + Math.floor(rnd() * 2) : Math.floor(rnd() * 2) } });
    }
    const o: Orders = { deploys };
    if (rnd() < 0.15) o.escalate = true;
    if (rnd() < 0.3) o.stake = Math.floor(rnd() * 5);
    if (validateOrders(v, seat, o) === null) return o;
  }
  return { deploys: [] };
}

async function startServer() {
  const p = spawn('npx', ['tsx', 'src/server/index.ts'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'], cwd: process.cwd(), detached: true });
  let exited: number | null = null;
  p.on('exit', (c) => { exited = c ?? -1; });
  let log = '';
  p.stdout.on('data', (d) => { log += d; }); p.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`); if (r.ok) break; } catch { /* not up yet */ }
    await sleep(100);
  }
  return { p, alive: () => exited === null, log: () => log };
}

async function pair(f0 = 'concord', f1 = 'hush') {
  const a = new Client(), b = new Client();
  await a.open(); await b.open();
  a.send({ t: 'create', faction: f0 });
  const room = await a.waitFor('room');
  b.send({ t: 'join', code: room.code, faction: f1 });
  await a.waitFor('start'); await b.waitFor('start');
  await a.waitFor('state'); await b.waitFor('state');
  return { a, b, code: room.code };
}

async function playFullGame(f0: string, f1: string) {
  const { a, b } = await pair(f0, f1);
  const cs = [a, b];
  let rounds = 0, states = 0;
  const submitted: [number, number] = [-1, -1];
  const done = new Promise<void>((resolve) => {
    for (const c of cs) {
      c.onState = (v) => {
        states++;
        for (const s of [0, 1] as PlayerId[]) { const cl = cs[s]; if (cl.view) handUids.set(s, new Set(cl.view.players[s].hand.map((h) => h.uid))); }
        scanView(v, c.seat, `game seat${c.seat} r${v.round}`);
        if (v.phase === 'over') { resolve(); return; }
        rounds = Math.max(rounds, v.round);
        if (submitted[c.seat] !== v.round && !v.players[c.seat].orders) {
          submitted[c.seat] = v.round;
          c.send({ t: 'action', action: { type: 'orders', player: c.seat, orders: randomOrders(v, c.seat) } });
        }
      };
    }
    // kick off
    for (const c of cs) c.onState!(c.view!);
    setTimeout(resolve, 20000);
  });
  await done;
  await sleep(100);
  ok(a.view!.phase === 'over' && b.view!.phase === 'over', `${f0} v ${f1}: game reached over (rounds=${rounds}, states=${states})`);
  ok(a.view!.winner === b.view!.winner, 'both seats agree on the winner');
  // after game over
  a.send({ t: 'action', action: { type: 'retreat', player: 0 } });
  ok((await a.nextError()) === 'game over', 'retreat after game over rejected');
  b.send({ t: 'action', action: { type: 'orders', player: 1, orders: { deploys: [] } } });
  ok((await b.nextError()) === 'game over', 'orders after game over rejected');
  // raw wire check: no real card id of opponent's hand ever in the other seat's JSON as a hand entry (covered by scanView), and deck is never real
  for (const c of cs) for (const r of c.raw) { const m = JSON.parse(r); if (m.t === 'state') ok(m.state.players.every((p: any) => p.deck.every(isMasked)), 'raw deck masked'); }
  a.close(); b.close();
}

async function abuse(serverAlive: () => boolean) {
  const c = new Client(); await c.open();
  // malformed / hostile payloads before and outside any room
  for (const bad of ['{not json', 'null', '42', '"str"', '[]', '{}', '{"t":"nope"}', '{"t":"create"}', '{"t":"create","faction":"zzz"}', '{"t":"join","code":5,"faction":"hush"}', '{"t":"join","faction":"hush"}', '{"t":"action"}', '{"t":"action","action":null}', '{"t":"action","action":{"type":"orders"}}']) {
    c.send(bad);
    await c.nextError().catch(() => { ok(false, `no error reply to ${bad}`); });
  }
  c.ws.send(Buffer.from([1, 2, 3]));
  c.send({ t: 'join', code: 'ZZZZZ', faction: 'hush' });
  ok((await c.nextError()) === 'Room not found or full', 'join nonexistent room');
  c.send({ t: 'join', code: '', faction: 'hush' });
  await c.nextError();
  ok(serverAlive(), 'server alive after pre-room abuse');

  // huge message
  const big = new Client(); await big.open();
  big.ws.send('x'.repeat(2_000_000));
  await sleep(300);
  ok(big.closed, 'oversized message closes the socket');
  ok(serverAlive(), 'server alive after huge message');

  // double create, third wheel join
  const { a, b, code } = await pair('brood', 'concord');
  a.send({ t: 'create', faction: 'hush' });
  ok((await a.nextError()) === 'already in a room', 'second create rejected');
  const third = new Client(); await third.open();
  third.send({ t: 'join', code, faction: 'hush' });
  ok((await third.nextError()) === 'Room not found or full', 'join full room rejected');
  third.send({ t: 'join', code: code.toLowerCase(), faction: 'hush' });
  await third.nextError();

  // hostile orders: malformed shapes
  const hostile: unknown[] = [
    { type: 'orders', orders: { deploys: 'x' } },
    { type: 'orders', orders: { deploys: [null] } },
    { type: 'orders', orders: { deploys: [{ uid: 'a', pos: { col: 0, row: 0 } }] } },
    { type: 'orders', orders: { deploys: [{ uid: 1, pos: null }] } },
    { type: 'orders', orders: { deploys: [{ uid: 1, pos: { col: 1.5, row: 2 } }] } },
    { type: 'orders', orders: { deploys: Array.from({ length: 30 }, () => ({ uid: 1, pos: { col: 0, row: 0 } })) } },
    { type: 'orders', orders: { deploys: [], stake: 'x' } },
    { type: 'orders', orders: { deploys: [], escalate: 'yes' } },
    { type: 'orders', orders: { deploys: [{ uid: 999999, pos: { col: 0, row: 2 } }] } }, // card not in hand
    { type: 'orders', orders: { deploys: [], stake: 99 } },
    { type: 'teleport' },
  ];
  for (const act of hostile) {
    a.send({ t: 'action', action: act });
    await a.nextError().catch(() => ok(false, `no error for ${JSON.stringify(act).slice(0, 80)}`));
  }
  // card from the OPPONENT's hand (uid learned from b's own view) must be rejected for a
  const bHand = b.view!.players[b.seat].hand;
  const aHand = new Set(a.view!.players[a.seat].hand.map((h) => h.uid));
  const theirs = bHand.find((h) => !aHand.has(h.uid))!;
  a.send({ t: 'action', action: { type: 'orders', orders: { deploys: [{ uid: theirs.uid, pos: { col: 0, row: a.seat === 0 ? 2 : 1 } }] } } });
  ok((await a.nextError()) === 'card not in hand', 'playing opponent card rejected');

  // spoofing the seat: a claims to be the other player; must lock a's own seat
  a.send({ t: 'action', action: { type: 'orders', player: 1 - a.seat, orders: { deploys: [], escalate: true } } });
  await sleep(150);
  const bv = b.view!;
  ok(bv.players[a.seat].orders !== null, 'seat-spoof: a locked orders for itself (not for b)');
  ok(bv.players[b.seat].orders === null, 'seat-spoof: b is not locked by a');
  ok(bv.players[a.seat].orders?.escalate === false && bv.players[a.seat].orders?.deploys.length === 0, 'a escalate is hidden from b before reveal');
  // double submission after locking is refused
  a.send({ t: 'action', action: { type: 'orders', orders: { deploys: [] } } });
  ok((await a.nextError()) === 'orders already locked', 'double submit rejected');
  // spoofed retreat: a sends retreat with player = b's seat -> a loses, not b
  b.msgs.length = 0;
  a.send({ t: 'action', action: { type: 'retreat', player: 1 - a.seat } });
  await sleep(150);
  ok(b.view!.phase === 'over' && b.view!.winner === b.seat, 'spoofed retreat makes the sender retreat');
  a.close(); b.close();
  ok(serverAlive(), 'server alive after hostile actions');
}

async function lifecycle(serverAlive: () => boolean) {
  // host leaves before anyone joins: room must die
  const h = new Client(); await h.open();
  h.send({ t: 'create', faction: 'hush' });
  const room = await h.waitFor('room');
  h.close(); await sleep(150);
  const g = new Client(); await g.open();
  g.send({ t: 'join', code: room.code, faction: 'brood' });
  ok((await g.nextError()) === 'Room not found or full', 'cannot join a room whose host left');

  // action before start
  const h2 = new Client(); await h2.open();
  h2.send({ t: 'create', faction: 'hush' }); await h2.waitFor('room');
  h2.send({ t: 'action', action: { type: 'retreat' } });
  ok((await h2.nextError()) === 'game not started', 'action before start rejected');
  h2.close();

  // guest disconnects mid-game: host is told and the game ends in the host's favour
  const { a, b } = await pair('concord', 'brood');
  b.close();
  await a.waitFor('opponentLeft');
  await sleep(100);
  ok(a.view!.phase === 'over' && a.view!.winner === a.seat, 'mid-game disconnect forfeits to the remaining player');
  a.close();

  // host disconnects mid-game
  const p2 = await pair('hush', 'hush');
  p2.a.close();
  await p2.b.waitFor('opponentLeft');
  await sleep(100);
  ok(p2.b.view!.phase === 'over' && p2.b.view!.winner === p2.b.seat, 'host disconnect forfeits');
  p2.b.close();

  // simultaneous lock-in from both seats in the same tick
  const p3 = await pair('brood', 'concord');
  p3.a.send({ t: 'action', action: { type: 'orders', orders: { deploys: [] } } });
  p3.b.send({ t: 'action', action: { type: 'orders', orders: { deploys: [] } } });
  await sleep(250);
  ok(p3.a.view!.round === 2 && p3.b.view!.round === 2, 'simultaneous lock-in resolves exactly one round');
  p3.a.close(); p3.b.close();

  // room code uniqueness across many rooms
  const codes = new Set<string>(); const hs: Client[] = [];
  for (let i = 0; i < 60; i++) { const c = new Client(); await c.open(); c.send({ t: 'create', faction: 'hush' }); codes.add((await c.waitFor('room')).code); hs.push(c); }
  ok(codes.size === 60, 'room codes unique');
  hs.forEach((c) => c.close());

  // HTTP: health check, malformed URI, traversal
  const hz = await fetch(`http://127.0.0.1:${PORT}/healthz`);
  ok(hz.status === 200 && (await hz.text()) === 'ok', '/healthz returns 200 ok');
  const bad = await fetch(`http://127.0.0.1:${PORT}/%E0%A4%A`);
  ok(bad.status === 404 || bad.status === 200, 'malformed URI handled');
  const trav = await fetch(`http://127.0.0.1:${PORT}/..%2f..%2fetc/passwd`);
  ok(!(await trav.text()).includes('root:'), 'no path traversal');
  ok(serverAlive(), 'server alive at end');
}

const srv = await startServer();
try {
  await playFullGame('concord', 'hush');
  await playFullGame('brood', 'concord');
  await playFullGame('hush', 'brood');
  await abuse(srv.alive);
  await lifecycle(srv.alive);
} catch (e) {
  failures++; console.error('EXCEPTION', e);
} finally {
  const alive = srv.alive();
  try { process.kill(-srv.p.pid!, 'SIGKILL'); } catch { /* already gone */ }
  if (!alive) console.error('server log:\n' + srv.log());
}
console.log(`${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
