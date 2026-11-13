# Shatterline — Design Process

Up to v0.6 we worked like this: an idea comes up, we add it, run the sim and keep it if the
numbers look fine. Rules piled up (HQ, hexes, Hive placement, reforming) and later had to be
removed. This document replaces that habit with the loop that experienced designers use.
The sources are in RESEARCH.md §14.

## 1. Target experience (the yardstick for every change)

> **"Two commanders, hidden orders, one breaking point.** Each round you read the opponent's
> line, commit units in secret and watch the reveal decide which column holds. You win by
> making their army lose its nerve, not by grinding it to dust. Games last about 10 minutes.
> Losing should feel like *I misread them*, not *the dice hated me*."

Feelings we want, in order: **tension at reveal**, **readable cause → effect** (I saw *why*
that column routed), **asymmetric identity** (Concord holds, Brood floods, Hush deceives),
**comeback hope** until the last two rounds.

A rule that serves none of these four gets cut, however clever it is (Brode: *"what's the fantasy, and does this rule
deliver it?"*; Chvátil: theme and feel come first).

## 2. Pillars, each with a kill test

| Pillar | Kill test: remove or redesign the rule if… |
|---|---|
| Morale beats attrition | the sim shows morale < 50% of Resolve lost, or players describe Nerve as "a second health bar" |
| Hidden simultaneous orders | the best play doesn't depend on predicting the opponent (e.g. the same deploy is always correct) |
| Position matters, units don't move | a rule needs the player to move or retarget units each round |
| Each faction has an obvious goal | a first-time player can't say in one sentence what their faction wants |
| Casual surface, skill underneath | a new rule needs a sentence of explanation without adding a decision a good player makes differently from a weak one |

## 3. The iteration loop (one variable at a time)

Taken from Mega Crit's metric-driven balancing (Slay the Spire), Subset Games' "cut until it hurts"
(Into the Breach), Brode/Dodds' "find the fun fast, then iterate fast" (Hearthstone/Snap),
and Knizia's paper-prototype-first habit:

1. **Hypothesis.** Write *one* sentence in DESIGN_LOG.md: "X is weak because Y; changing Z will move metric M from a to b."
2. **Change one variable.** Never bundle a rule change with a stat change. If two things need to change, run two experiments.
3. **Measure.** Run `npm run sim -- 20 --arch --cards` before and after. Log both, including the exit-criteria block.
4. **Check the explanation, not just the number.** Read 1–2 verbose game logs (`--verbose`). If the win rate moved for a reason other than the hypothesis, the experiment failed even if the number looks good.
5. **Human playtest** (every rule change, and every ~5 stat changes): run the §6 protocol.
6. **Decide and log**: keep / revert / follow-up. A reverted experiment is still a result; log it.

**The sim is a hypothesis generator, not the truth.** The AI is a greedy 1-ply planner. It
misjudges cards whose value is delayed or conditional (tactics, bluffs, setup). A card the sim
calls "dead" might really be weak, or the AI might be failing to use it. Check which before
nerfing or buffing anything (Mega Crit used real player data; we only have a bot).

## 4. Exit criteria (printed by `npm run sim -- N --arch --cards`)

| Criterion | Threshold | Why |
|---|---|---|
| Win rate per archetype | 40–60% | every archetype can win (Gwent/Snap band) |
| Game length | ≥ 80% of games reach round 6 | the stakes ladder and late reinforcements matter |
| Morale share | ≥ 50% of Resolve lost | pillar 1 |
| Comeback | ≥ 25% of games won by the player behind after R4 | hope until the end (Garfield: you need a chance even when behind) |
| Seat advantage | 45–55% | initiative rules are fair |
| Card outliers | no card outside 35–65% win-when-played (n ≥ 150; below that the noise is ±8–15 points) | no auto-include and no trap card |
| Dead cards | every card played in ≥ 15% of the games where it's in the deck | every card earns its slot |

A version counts as **done** when every criterion passes *and* a human playtest round shows no
"I don't get why that happened" moments.

## 5. Complexity budget

Count every rule a player must hold in their head (each keyword, phase step and faction rule).
v0.6 baseline: **7 phase steps + 30 keywords + 7 faction rules = 44.** No new rule goes in unless
one comes out, or a playtest shows the new one carries its weight (Rosewater: *"complexity is a
budget; spend it where the fun is"*). Keywords used by only one card are the first to cut. Write
the effect on the card instead.

**Card first-read test.** Show a card to someone who hasn't seen it. Within 5 seconds they
should be able to say when it's good. If they can't, rewrite the text, not the numbers.

## 6. Playtest protocol (human)

- 1 match vs AI per faction. The tester thinks aloud; the observer doesn't help.
- The observer notes every **confusion** (a "why did that happen?"), every **dead moment** (nothing
  to decide) and every **spike** (a sound, a laugh, a "no!").
- Questions after the match: (1) What did your faction want to do? (2) Which decision was hardest?
  (3) When did you know you'd won or lost? (4) What would you cut?
- If answer (3) is "round 3", the game is decided too early. Pull the comeback lever.

## 7. Variant testing

Before any rule change, write it as a toggle (`RULES.x`, `--flag`) and simulate A/B. That's how
we tested `--no-formations` and `--cols=`. Never hard-code a rule we haven't compared against
its absence.
