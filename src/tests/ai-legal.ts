// Legality + edge cases for aiOrders / aiWantsRetreat / playGame. Run: npx tsx src/tests/ai-legal.ts
import { Faction, FACTION_INFO } from '../shared/cards';
import { PlayerId, apply, newGame, validateOrders } from '../shared/engine';
import { aiOrders, aiWantsRetreat, tunedDeck } from '../shared/ai';
import { playGame } from '../sim/match';

let fails = 0, checks = 0;
const ok = (c: boolean, m: string) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const F: Faction[] = ['concord', 'brood', 'hush'];

// 1. Every order the AI emits is accepted by validateOrders, over whole games, both levels, all seats.
for (const level of ['greedy', 'steel'] as const) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let seed = 1; seed <= 2; seed++) {
  const s = newGame(F[i], F[j], seed * 31 + i * 7 + j, [tunedDeck(F[i]), tunedDeck(F[j])]);
  let g = 0;
  while (s.phase !== 'over' && g++ < 20) for (const p of [0, 1] as PlayerId[]) {
    if ((s.phase as string) === 'over') break;
    const o = aiOrders(s, p, { level });
    const err = validateOrders(s, p, o);
    ok(!err, `${level} ${F[i]}v${F[j]} seed ${seed} R${s.round} P${p}: ${err}`);
    if (apply(s, { type: 'orders', player: p, orders: o })) break;
  }
}
// 2. Edge cases: empty hand, 0 Command, game over, last round.
{
  const s = newGame('concord', 'hush', 5);
  for (const level of ['greedy', 'steel'] as const) {
    const a = structuredClone(s); a.players[0].hand = [];
    ok(aiOrders(a, 0, { level }).deploys.length === 0, 'empty hand → pass');
    const b = structuredClone(s); b.players[0].cp = 0;
    ok(aiOrders(b, 0, { level }).deploys.length === 0, '0 Command → pass');
    const c = structuredClone(s); c.players[1].hand = []; c.players[1].deck = [];
    ok(!validateOrders(c, 0, aiOrders(c, 0, { level })), 'opponent with no cards');
    const d = structuredClone(s); d.phase = 'over'; d.winner = 0;
    ok(aiOrders(d, 1, { level }).deploys.length === 0 && !aiWantsRetreat(d, 1), 'game over → no crash, pass');
    const e = structuredClone(s); e.round = 8;
    ok(!validateOrders(e, 0, aiOrders(e, 0, { level })), 'last round legal');
  }
}
// 3. Retreat is reachable: escalated stakes, hopelessly behind.
{
  const s = newGame('concord', 'brood', 3);
  s.round = 6; s.stakes = 2; s.players[0].resolve = 1; s.players[1].resolve = 12;
  ok(aiWantsRetreat(s, 0) === true, 'retreat when far behind at raised stakes');
  ok(aiWantsRetreat(s, 1) === false, 'no retreat when ahead');
  s.stakes = 1;
  ok(aiWantsRetreat(s, 0) === false, 'no retreat at base stakes');
}
// 4. Sim bookkeeping: playGame is deterministic and metrics are sane.
for (let seed = 1; seed <= 6; seed++) {
  const a = { f: 'hush' as Faction, label: 'a', deck: tunedDeck('hush'), ai: { level: 'steel' as const, profile: 'hush/balanced' } };
  const b = { f: 'concord' as Faction, label: 'b', deck: tunedDeck('concord'), ai: { level: 'greedy' as const } };
  const r1 = playGame(a, b, seed), r2 = playGame(a, b, seed);
  ok(JSON.stringify(r1) === JSON.stringify(r2), 'playGame deterministic');
  ok(r1.decidedRound >= 1 && r1.decidedRound <= r1.round, `decidedRound ${r1.decidedRound} within 1..${r1.round}`);
  ok(r1.leadChanges >= 0 && r1.margin >= 0, 'metrics non-negative');
}
void FACTION_INFO;
console.log(`ai-legal: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
