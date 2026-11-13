// One headless AI-vs-AI game with telemetry.
import { Faction } from '../shared/cards';
import { PlayerId, apply, newGame } from '../shared/engine';
import { AiOptions, DecisionStats, aiOrders, aiWantsRetreat } from '../shared/ai';

export interface Side { f: Faction; label: string; deck: string[]; ai: AiOptions }
export interface GameResult {
  winner: null | -1 | PlayerId; round: number; endReason: string;
  resolveBy: Record<string, number>; breaks: number; destroyed: number;
  played: [Record<string, number>, Record<string, number>]; // card id → first round played
  behindAtR4: -1 | PlayerId; log?: string[];
  leadChanges: number;        // times the Resolve leader flipped
  decidedRound: number;       // first round from which the eventual winner was ahead for good
  margin: number;             // final Resolve gap
  dec: DecisionStats;
}

export function playGame(a: Side, b: Side, seed: number, keepLog = false): GameResult {
  const s = newGame(a.f, b.f, seed, [a.deck, b.deck]);
  const sides = [a, b];
  const played: [Record<string, number>, Record<string, number>] = [{}, {}];
  let behindAtR4: -1 | PlayerId = -1, checked = false, guard = 0;
  const dec: DecisionStats = { decisions: 0, close: 0, obvious: 0 };
  const diffs: number[] = []; // r0 - r1 at the start of each round
  while (s.phase !== 'over' && guard++ < 50) {
    if (diffs.length < s.round) diffs.push(s.players[0].resolve - s.players[1].resolve);
    if (s.round === 5 && !checked) {
      checked = true;
      const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
      if (r0 !== r1) behindAtR4 = r0 < r1 ? 0 : 1;
    }
    for (const p of [0, 1] as PlayerId[]) {
      if ((s.phase as string) === 'over') break;
      if (aiWantsRetreat(s, p)) { apply(s, { type: 'retreat', player: p }); break; }
      const o = aiOrders(s, p, { ...sides[p].ai, stats: dec });
      for (const d of o.deploys) {
        const id = s.players[p].hand.find((h) => h.uid === d.uid)?.id;
        if (id && played[p][id] === undefined) played[p][id] = s.round;
      }
      const err = apply(s, { type: 'orders', player: p, orders: o });
      if (err) throw new Error('orders: ' + err);
    }
  }
  diffs.push(s.players[0].resolve - s.players[1].resolve);
  let leadChanges = 0, last = 0;
  for (const d of diffs) { const sg = Math.sign(d); if (sg && last && sg !== last) leadChanges++; if (sg) last = sg; }
  let decidedRound = 1;
  if (s.winner === 0 || s.winner === 1) {
    const sg = s.winner === 0 ? 1 : -1;
    for (let i = 0; i < diffs.length; i++) if (Math.sign(diffs[i]) !== sg) decidedRound = i + 2;
    decidedRound = Math.min(decidedRound, s.round);
  }
  return {
    leadChanges, decidedRound, margin: Math.abs(diffs[diffs.length - 1]), dec,
    winner: s.winner, round: s.round, endReason: s.endReason, resolveBy: s.stats.resolveBy,
    breaks: s.stats.breaks[0] + s.stats.breaks[1], destroyed: s.stats.destroyed[0] + s.stats.destroyed[1],
    played, behindAtR4, log: keepLog ? s.log : undefined,
  };
}
