// Honesty test: steel's decisions must be identical whatever the opponent's hidden cards really are,
// given the same public information. Run: npx tsx src/tests/ai-honesty.ts
import { starterDeck } from '../shared/cards';
import { GameState, PlayerId, apply, newGame } from '../shared/engine';
import { aiOrders, aiWantsRetreat, tunedDeck } from '../shared/ai';

let fails = 0, checks = 0, cloakedSwaps = 0;
const ok = (c: boolean, m: string) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };

function swapHandDeck(s: GameState, p: PlayerId): boolean {
  const pl = s.players[p];
  const i = pl.hand.findIndex((h, k) => pl.deck.some((d) => d.id !== h.id));
  if (i < 0) return false;
  const j = pl.deck.findIndex((d) => d.id !== pl.hand[i].id);
  [pl.hand[i], pl.deck[j]] = [pl.deck[j], pl.hand[i]];
  return true;
}
function swapCloakedWithHand(s: GameState, p: PlayerId): boolean {
  const pl = s.players[p];
  const f = s.formations.find((x) => x.owner === p && x.cloaked && x.cards.length === 1 && !x.cards[0].token);
  if (!f) return false;
  const i = pl.hand.findIndex((h) => h.id !== f.cards[0].id);
  if (i < 0) return false;
  [f.cards[0], pl.hand[i]] = [pl.hand[i], f.cards[0]];
  f.morale = f.cards[0] ? 1 : 0; // morale of a cloaked unit is hidden too
  return true;
}
const clone = <T,>(x: T): T => structuredClone(x);

for (const [fa, fb] of [['hush', 'concord'], ['hush', 'brood'], ['concord', 'hush']] as const) {
  for (let seed = 1; seed <= 6; seed++) {
    const s = newGame(fa, fb, seed, [tunedDeck(fa), tunedDeck(fb)]);
    const me: PlayerId = fa === 'hush' ? 1 : 0, opp = (1 - me) as PlayerId;
    for (let guard = 0; guard < 8 && s.phase !== 'over'; guard++) {
      // Whoever moves first submits; the AI under test is `me`.
      if (me === 1) apply(s, { type: 'orders', player: 0, orders: aiOrders(s, 0, { level: 'steel' }) });
      const level = { level: 'steel' as const, samples: 2 };
      const base = JSON.stringify(aiOrders(s, me, level));
      const variants: [string, (c: GameState) => boolean][] = [
        ['hand<->deck swap', (c) => swapHandDeck(c, opp)],
        ['cloaked<->hand swap', (c) => { const r = swapCloakedWithHand(c, opp); if (r) cloakedSwaps++; return r; }],
        ['opp submitted orders removed/changed', (c) => { c.players[opp].orders = null; return true; }],
        ['opp rng-irrelevant discard order', () => true],
      ];
      for (const [name, f] of variants) {
        const c = clone(s);
        if (!f(c)) continue;
        ok(JSON.stringify(aiOrders(c, me, level)) === base, `${fa}v${fb} seed ${seed} round ${s.round}: ${name} changed the decision`);
        ok(aiWantsRetreat(c, me) === aiWantsRetreat(s, me), `${name}: retreat changed`);
      }
      // Determinism: same state → same orders.
      ok(JSON.stringify(aiOrders(clone(s), me, level)) === base, 'non-deterministic for a fixed state');
      if (me === 1) { apply(s, { type: 'orders', player: 1, orders: JSON.parse(base) }); }
      else { apply(s, { type: 'orders', player: 0, orders: JSON.parse(base) }); apply(s, { type: 'orders', player: 1, orders: aiOrders(s, 1, { level: 'steel' }) }); }
    }
  }
}
ok(cloakedSwaps > 0, 'test never exercised a cloaked swap (no cloaked non-token unit appeared)');
console.log(`ai-honesty: ${checks - fails}/${checks} checks passed, ${cloakedSwaps} cloaked swaps exercised`);
process.exit(fails ? 1 : 0);
