// Game controllers: a local vs-AI game, or an online room over WebSocket.
import { Faction } from '../shared/cards';
import { GameEvent, GameState, Orders, PlayerId, apply, newGame, viewFor } from '../shared/engine';
import { AiOptions, aiOrders, aiWantsRetreat, tunedDeck } from '../shared/ai';
import type { ClientMsg, ServerMsg } from '../shared/protocol';

export interface Controller {
  seat: PlayerId;
  onState?: (s: GameState, events: GameEvent[]) => void;
  onInfo?: (msg: string) => void;
  submit(o: Orders): void;
  retreat(): void;
}

export class LocalAIGame implements Controller {
  seat: PlayerId = 0;
  state: GameState;
  onState?: (s: GameState, events: GameEvent[]) => void;
  onInfo?: (msg: string) => void;
  constructor(me: Faction, meArch: string | undefined, ai: Faction) {
    const archs = { concord: ['gunline', 'bastion', 'iron'], brood: ['tide', 'apex', 'synapse'], hush: ['phantom', 'knives', 'dread'] }[ai];
    const aiArch = archs[Math.floor(Math.random() * archs.length)];
    this.state = newGame(me, ai, (Math.random() * 2 ** 31) | 0, [tunedDeck(me, meArch), tunedDeck(ai, aiArch)]);
    // Steelman opponent: plays its tuned deck with that deck's tuned strategy, and never sees your hand.
    this.ai = { level: 'steel', profile: `${ai}/${aiArch}` };
  }
  private ai: AiOptions;
  start() { this.emit([]); }
  private emit(ev: GameEvent[]) { this.onState?.(viewFor(this.state, 0), ev); }
  submit(o: Orders) {
    const err = apply(this.state, { type: 'orders', player: 0, orders: o });
    if (err) { this.onInfo?.(err); return; }
    // AI decides from the same pre-reveal information (it can't see our orders)
    setTimeout(() => {
      if (aiWantsRetreat(this.state, 1)) { apply(this.state, { type: 'retreat', player: 1 }); this.emit(this.state.events); return; }
      const e2 = apply(this.state, { type: 'orders', player: 1, orders: aiOrders(this.state, 1, this.ai) });
      if (e2) console.error('AI orders rejected', e2);
      this.emit(this.state.events);
    }, 30);
  }
  retreat() { apply(this.state, { type: 'retreat', player: 0 }); this.emit(this.state.events); }
}

export class OnlineGame implements Controller {
  seat: PlayerId = 0;
  ws: WebSocket;
  onState?: (s: GameState, events: GameEvent[]) => void;
  onInfo?: (msg: string) => void;
  onRoom?: (code: string) => void;
  onStart?: () => void;
  constructor(mode: { host: true; faction: Faction } | { host: false; code: string; faction: Faction }) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => this.send(mode.host ? { t: 'create', faction: mode.faction } : { t: 'join', code: mode.code, faction: mode.faction });
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data) as ServerMsg;
      if (m.t === 'room') { this.seat = m.seat; this.onRoom?.(m.code); }
      else if (m.t === 'start') { this.seat = m.seat; this.onStart?.(); }
      else if (m.t === 'state') this.onState?.(m.state, m.events);
      else if (m.t === 'error') this.onInfo?.(m.msg);
      else if (m.t === 'opponentLeft') this.onInfo?.('Opponent disconnected');
    };
    this.ws.onclose = () => this.onInfo?.('Connection closed');
  }
  private send(m: ClientMsg) { if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  submit(o: Orders) { this.send({ t: 'action', action: { type: 'orders', player: this.seat, orders: o } }); }
  retreat() { this.send({ t: 'action', action: { type: 'retreat', player: this.seat } }); }
}
