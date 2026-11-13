# Design Log

One entry per experiment: hypothesis → single change → before/after metrics → decision.
The process is in DESIGN_PROCESS.md. Baseline command: `npm run sim -- 20 --arch --cards`.

## 0. Baseline audit (v0.6, 540 games)

| Criterion | Result |
|---|---|
| Win rate 40–60% | **FAIL**: brood/apex 38, brood/synapse 34, hush/dread 38 (others 45–54) |
| ≥80% games reach R6 | PASS 100% |
| Morale ≥50% | PASS 58% (breach 30%, kills 12%) |
| Comeback ≥25% | **FAIL** 24% of 393 |
| Seat 45–55% | PASS 50% |
| Card outliers | **FAIL**: b_overseer 32% win-when-played |
| Dead cards | **FAIL**: c_overthetop 5%, b_pheromone 5%, v_knives 8%, c_broadcast 14% |

Observation: three of the four dead cards are tactics. Hypothesis to test *first*: the greedy AI
undervalues tactics (their payoff isn't captured by the 1-ply `evaluate`), so the "dead" signal
may say more about the AI than the cards.

## Queue
1. Are tactics dead because of the AI or the card? (measure: force-play test)
2. b_overseer outlier
3. Brood synapse/apex low
4. Hush dread low
5. Comeback < 25%
