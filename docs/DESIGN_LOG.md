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

## 10. Battery: cost 5 → 4 (REVERTED) and no Lethal (REVERTED)
- Cost 4: played more (54%) but still wins 34–36%, and bastion went down. A trap card, not an expensive one.
- No Lethal (hypothesis: Lethal turns its strike into wounds, which works against a morale game): Battery 27/36. Wrong hypothesis.
- **Meta-finding:** at n≈70 the per-card win% swings ±15 points between identical runs (Marksman 29 vs 45). The outlier criterion now requires n ≥ 150.

## 11. Mortar cost 3 → 2 (REVERTED): no measurable change.

## 12. The Balanced deck was never measured
- `--arch` now includes `<faction>/balanced`, the menu default and the deck online play uses. **Concord balanced was 35%, Hush balanced 55–60%.** The earlier buffs to Brood and Hush had pushed Concord down across the board (≈40% against every opponent, not one bad matchup).
- `--rule=drilled=2` (Concord cohesion +1 more): no effect, because cohesion is capped by the number of allies around a unit. REVERTED.
- `--stat=concord.nerve+1` (all units): Concord 58–71. Huge overshoot. **Nerve is the strongest stat in the game.** +1 Nerve is worth far more than +1 Power or −1 cost.
- `--stat=concord:Infantry.nerve+1` (6 cards): Concord 50–62, Brood 33–40. Still overshoots.
- **Kept:** +1 Nerve on only the five underperforming low-Nerve units (Riflemen, Sappers, Mortar, Marksman, Battery). Result (2× N=30): gunline 53/57, bastion 45/46, iron 50/52, balanced 49/41; Brood tide 49/47, apex 45/40, synapse 40/39, balanced 41/40; Hush phantom 45/48, knives 38/47, dread 47/50, balanced 44/51. Comeback 26/26 PASS.

## Status after #12
All entries fall within roughly 38–57%. Brood synapse and balanced sit at the bottom edge (~40). Length, morale, seat, comeback and dead cards all PASS. Card outliers: occasional single-run flags (b_spitter, v_needle), inside the noise.
**Process note:** every remaining gap is now 2–5 points, about the size of the sim's noise. More stat tuning against a greedy bot risks fitting the bot instead of the game. **The next step is a human playtest (DESIGN_PROCESS §6), not more sim tuning.**

---
# Phase 2: stop tuning, find the fun (user direction: "follow the research process, experiment until we find good mechanics, don't tune cards on bad mechanics, don't tunnel vision")

## 13. Steelman AI (prerequisite for all measurements)
AI v2 (`level: 'steel'`) predicts the opponent's reply on sampled hidden worlds. It never sees their hand or cloaked
identities. It beats the old greedy AI **81%** of 504 games. Per-deck tuning was started and then **stopped on purpose**:
tuning numbers on unvalidated mechanics is the wrong order.

## 14. Fun proxies
Added per game: lead changes, the round the game was decided, comeback rate, and skill expression (steel vs greedy; greedy vs random).
"Close decisions" was tried and **found unreliable** (near-duplicate plans inflate it), so it isn't used for decisions.

## 15. Divergent concept round → docs/concepts/
Four independent designers (each saw only the target experience and constraints, never our rules) pitched A Formation,
B Fault Lines, C Fault Line and D Ledger of Nerve. **All four converged** on 3 lanes, threshold morale, rout contagion with quiet kills,
and a secret per-lane bet. v0.6 was the outlier on every one of these. See concepts/JUDGEMENT.md.

## 16. Prototype cores (src/proto, vanilla cards, steelman bots), 120 games per variant
- **C as pitched stalls:** 1.9 routs/game, lead changes 0.03. Without the Stake, nothing happens (52% draws, 0 routs).
  **Reading the logs** showed why: both bots match lane totals and stack shield-reinforcements, so every hit is absorbed.
- **C − shields:** routs 3.4, draws 3%, comebacks 23%, skill 92%. Hypothesis confirmed: shields caused the turtling.
- **B as pitched is too lethal:** games end in 2.4 of 5 rounds, comebacks 0%. Rank support and +Nerve didn't fix it.
  A sweep found the most alive region at break 8 + Press (lead changes 0.29, 3.9 rounds, chains of 2), but comebacks stay ~8%.
  B snowballs: losing units means taking more Pressure.
- Prototype numbers aren't directly comparable with the full game (different length and board), but both
  pitched cores fail their own risk tests as written, as the pitches predicted.

## 17. Rule ablation of v0.6 (steelman, 240+ games per variant, docs/ablation-v06.txt)
Removing column hands/Edge, flanking, cohesion, terrain, rear bonus, underdog CP or escalation: **no measurable change**.
Those rules are dead weight. Removing **breach drain improves everything** (skill 84→93, lead changes 0.55→0.68, comebacks 23→33,
morale 54→82%). 5 columns beats 7.
**Combined, STRIPPED (all of those off, 5 columns):** skill **92%**, lead changes **0.85**, decided **R6.5**, comebacks **39%**,
morale **82%**. Better than full v0.6 on every proxy, with ~8 fewer rules. (7 columns stripped: 89 / 0.75 / R6.2 / 32%.)
The stripped game is close to the outsiders' skeleton: few lanes, Front/Back, morale as the main path.

**Decision:** STRIPPED becomes the v0.7 baseline. Next, port the converged ideas onto it one at a time, judged on the same proxies
plus log reading: (a) a secret per-lane Stake in place of global escalation, (b) stronger rout contagion with quiet kills,
(c) fresh-threshold morale in place of accumulated Shock (the "morale ≠ health" fix). Faction identity lost with the cut rules
(Hold the Line, Drilled, Flood, One Organism) must be rebuilt on cards or a single faction rule each.

## 18. Stripped needs a breaking point: starting Resolve
Check of the end reasons: **100% of STRIPPED games ended on the clock.** Breach drain had been the only route to collapse,
so the better proxies came partly from close races decided by time. That's not the "one breaking point" experience. **A metric looked better while the game got worse**, which is why we read end reasons and logs, not only the summary.
One-variable sweep of startResolve on STRIPPED (80/matchup):
| Resolve | skill | lead changes | decided | comeback | collapse | morale |
|---|---|---|---|---|---|---|
| 14 | 92 | 0.85 | R6.5 | 39 | **0%** | 82 |
| 10 | 91 | 0.81 | R6.0 | 36 | 61% | 81 |
| **9** | **93** | **0.78** | **R5.7** | **37** | **80%** | **81** |
| 8 | 90 | 0.70 | R5.4 | 28 | 88% | 80 |
**Decision: v0.7 baseline = STRIPPED + Resolve 9.** It beats full v0.6 (84 / 0.55 / R5.1 / 23 / 95% / 54) on every proxy, and armies still break.
Engine defaults updated (5 columns; formations, flank, flood, rear, cohesion, drilled, terrain, breach drain, underdog all off).

## 19. Per-column Stake (from the converged pitches), three forms, all REJECTED for now
| Variant | skill | lead changes | decided | comeback | collapse |
|---|---|---|---|---|---|
| v0.7 baseline | 93 | 0.78 | R5.7 | 37 | 80% |
| doubler: losses in the staked column ×2 | 88 | 0.61 | R4.6 | 32 | 95% |
| bet: win the column +1 Resolve / lose it −1 | 93 | 0.95 | R5.6 | 28 | 57% |
| transfer: win it → enemy −1 / lose it → you −1 | 91 | 0.63 | R4.6 | 26 | 94% |
**Lesson:** any extra in-board Resolve swing speeds up the snowball. The bet adds lead changes but costs comebacks and collapses.
Kept as `RULES.laneStake` (0 = off) for later human tests.

## 20. Correction: Escalate wasn't "dead weight"
#17 called global Escalate dead because removing it changed no in-game proxy. **That's by design:** Escalate (Snap-style)
raises what the *match result* is worth, not the board. In-game bot metrics can't detect a bluff on the stakes.
Restored (maxStakes 8). **The gamble pillar can only be judged by human playtest** (DESIGN_PROCESS §6). Other cuts stand,
since those rules act on the board and were measured there.

## 21. Threshold morale ("morale ≠ health" fix from the pitches). Bots say no; humans decide
| Variant on v0.7 | skill | lead changes | decided | comeback | collapse | morale |
|---|---|---|---|---|---|---|
| baseline (Shock accumulates) | 93 | 0.78 | R5.7 | 37 | 80% | 81 |
| fresh Nerve each round | 88 | 0.66 | R5.7 | 30 | 37% | 68 |
| fresh Nerve + panic 2 | 88 | 0.54 | R5.4 | 25 | 43% | 71 |
| fresh Nerve + panic 2 + quiet kills | 89 | 0.61 | R5.6 | 27 | 37% | 70 |
| panic 2 only | 89 | 0.80 | R5.6 | 36 | 82% | 82 |
Within this engine, accumulated Nerve plays better by every bot proxy. Toggles kept (`freshNerve`, `panic`, `quietKills`).
The complaint ("Nerve feels like a health bar") is about **perception**. Next: a human A/B in the client, and a presentation
pass (show Nerve as a breaking-point gauge under pressure, not as an HP bar).
