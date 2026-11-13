// One headless AI-vs-AI game with telemetry.
import { Faction } from '../shared/cards';
import { PlayerId, apply, newGame } from '../shared/engine';
import { AiOptions, aiOrders, aiWantsRetreat } from '../shared/ai';

export interface Side { f: Faction; label: string; deck: string[]; ai: AiOptions }
export interface GameResult {
  winner: null | -1 | PlayerId; round: number; endReason: string;
  resolveBy: Record<string, number>; breaks: number; destroyed: number;
  played: [Record<string, number>, Record<string, number>]; // card id → first round played
  behindAtR4: -1 | PlayerId; log?: string[];
}

export function playGame(a: Side, b: Side, seed: number, keepLog = false): GameResult {
  const s = newGame(a.f, b.f, seed, [a.deck, b.deck]);
  const sides = [a, b];
  const played: [Record<string, number>, Record<string, number>] = [{}, {}];
  let behindAtR4: -1 | PlayerId = -1, checked = false, guard = 0;
  while (s.phase !== 'over' && guard++ < 50) {
    if (s.round === 5 && !checked) {
      checked = true;
      const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
      if (r0 !== r1) behindAtR4 = r0 < r1 ? 0 : 1;
    }
    for (const p of [0, 1] as PlayerId[]) {
      if ((s.phase as string) === 'over') break;
      if (aiWantsRetreat(s, p)) { apply(s, { type: 'retreat', player: p }); break; }
      const o = aiOrders(s, p, sides[p].ai);
      for (const d of o.deploys) {
        const id = s.players[p].hand.find((h) => h.uid === d.uid)?.id;
        if (id && played[p][id] === undefined) played[p][id] = s.round;
      }
      const err = apply(s, { type: 'orders', player: p, orders: o });
      if (err) throw new Error('orders: ' + err);
    }
  }
  return {
    winner: s.winner, round: s.round, endReason: s.endReason, resolveBy: s.stats.resolveBy,
    breaks: s.stats.breaks[0] + s.stats.breaks[1], destroyed: s.stats.destroyed[0] + s.stats.destroyed[1],
    played, behindAtR4, log: keepLog ? s.log : undefined,
  };
}
