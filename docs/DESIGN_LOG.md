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

## 2. Hush faction lever: Ambush 1 → 2 (REVERTED)
- **Hypothesis:** every Hush card wins 41–49% when played, so a faction-wide lever might fix it.
- **Change:** `--rule=ambush=2` (new generic A/B flag, sim only).
- **Result:** phantom 63/66, knives 50/53, dread 52/53, while Concord falls to 36–46 and apex to 33–37. Too coarse: it helps the archetype that was already fine the most.
- **Decision:** REVERT. Faction-wide levers are too blunt here; tune archetype payoff cards instead.

## 3. Dread Herald: On Reveal Shock 1 → 2 (REVERTED)
- **Hypothesis:** dread's payoff card is played 92% of the time but wins only 41%, so its effect is too small for 4 CP.
- **Result:** dread 66/62, Herald win-when-played 69/64 (an outlier). Overshoot.
- **Decision:** REVERT. Shock is a very strong currency here, since every point brings a rout closer.

## 4. Dread Herald: cost 4 → 3 (KEPT)
- **Hypothesis:** the effect size is right but the timing is wrong. At 4 CP it lands a round late, after the lines have already set.
- **Result (2× N=40):** dread 47/45, Herald played 79%, wins 51/47. Knives 43/39, phantom 51/48. Brood synapse 30/40 and apex 38/35 are now the clear bottom.
- **Decision:** KEEP. Lesson: when an effect is the right size but underperforms, try cost/timing before magnitude.

## 5. Brood Gorgemaw: cost 6 → 5 (KEPT)
- **Hypothesis:** at 31% win-when-played, Brood's big finisher arrives too late (cost 6 means round 5 at the earliest) to save a losing line.
- **Result (2× N=40):** Gorgemaw 45/46% when played, apex 44/46.
- **Decision:** KEEP.

## 6. Overmind Aspect: cost 5 → 4 (KEPT, weak effect)
- **Result:** Overseer 41/38% when played (was 36), synapse 41/38. Within noise. Kept because it didn't hurt anything.
- **Follow-up:** the synapse archetype's payoff ("linked Brood strike +1") may be too subtle to matter. Revisit with a card-text change, not another cost change.

## 7. Comeback lever: Underdog Command (KEPT at +1)
- **Hypothesis:** the comeback rate (22–24%) misses the 25% target because the losing side falls behind on board and can never re-contest. Extra Command next round for whoever is ≥3 Resolve behind gives them a real counter-push without erasing the lead.
- **Change:** `RULES.underdogCp` (A/B via `--rule=underdogCp=N`).
- **Result:** +1 → comeback 25/26%, archetypes 38–55. +2 → comeback 28/26%, but every archetype gets squeezed toward 45%. That's rubber-banding that hides skill differences, which goes against pillar 5.
- **Decision:** KEEP +1. Complexity budget unchanged: merged with the existing "player behind gets initiative" into a single **Underdog** rule, shown in the HUD ("Underdog +1 Command").

## Status after #1–7
Passing: length, morale, seat, card outliers (mostly), dead cards, comeback (borderline).
Still failing: knives (~38–44) and synapse (~40–46) sit at the bottom edge, and bastion is around 42–45.
Next: knives' payoff (v_needle and v_knives are both low), then the synapse text change.

## 8. The Faceless: cost 4 → 3 (KEPT)
- **Hypothesis:** knives (~40) lacks a finisher that lands on time. Every knives card was at 37–45%.
- **Result:** knives 50/51, Faceless 50/52% when played.
- **Decision:** KEEP.

## 9. Overmind Aspect: linked strike +1 → +2 (KEPT)
- **Hypothesis (follow-up to #6):** the cost cut didn't help, so the payoff is too subtle. A Synapse deck should feel the Overmind arrive.
- **Result:** synapse 45/47, Overseer 45/48% when played. Apex is still at the bottom edge (38/44).
- **Decision:** KEEP. Card text updated.
