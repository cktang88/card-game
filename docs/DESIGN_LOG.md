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

## 1. Are tactics dead because of the AI or the card?
- **Hypothesis:** `simulate()` assumes the opponent adds nothing this round, so reactive tactics (+strike, rally) look like overkill to the greedy AI. Units also add lasting board value in `evaluate`. The cards are probably fine.
- **Change (AI only, no card edits):** `AI_TUNING.tacticBonus` (`--tactic-bonus=N`) adds N to the evaluation of any tactic play.
- **Result (N=20):** with bonus 0, c_overthetop is played 6%, c_broadcast 12%, b_pheromone 4%, v_knives 6%. With bonus 4 they're played 80/64/52/53% and win 52/55/56/43% when played. Bonus 10 overshoots: Hush plays its weak tactics too much and new outliers appear.
- **Side finding:** noise is large. With nothing changed, hush/dread came out at 38 in one run and 46 in the next, from `Math.random` in the AI heuristic. At N=40, two identical runs still differ by up to 8 points (hush/knives 34 vs 42). **From now on, use N=40 run twice and treat differences under ~8 points as noise.**
- **Decision:** KEEP bonus 4 as the default (it's also used by the in-game AI opponent). Dead-card criterion: PASS. Card outliers: PASS.
- **New baseline (N=40, 2 runs):** gunline 56/54, bastion 45/45, iron 60/51, tide 52/59, apex 43/41, synapse 43/43, phantom 46/43, knives 34/42, dread 38/35. Comeback 22% (FAIL).
- **Next:** Hush is now the weakest faction (knives, dread). Hush tactics win only ~43% when played (smoke 44, false 43, knives 43). Investigate Hush before touching Brood.
