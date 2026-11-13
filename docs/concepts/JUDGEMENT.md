# Divergent round: judgement

Five contenders: the incumbent v0.6 (0), plus four unanchored pitches from independent designers who saw
only the target experience and the client's constraints, never our rules:
A *Formation* (hands & bluffs), B *Fault Lines* (morale cascades), C *Fault Line* (minimal core),
D *Ledger of Nerve* (commitment/fold).

## Convergence (the strongest signal)
All four outsiders independently arrived at:
| Element | A | B | C | D | v0.6 |
|---|---|---|---|---|---|
| **3 lanes** (not 7) | ✓ | ✓ | ✓ | ✓ | ✗ (7) |
| Front/Rear slots per lane | rows of 3 | ✓ | ✓ | ✓ | ✓ |
| **Threshold morale, fresh each round** (no carried damage) | relative (hand vs hand) | ✓ | binary Shaken/Routed | ✓ | ✗ (Shock accumulates like HP) |
| **Rout spreads panic to neighbours; kills are quiet** | — | ✓ | ✓ | ✓ | weak (1 Shock panic) |
| **Secret bet on one lane** | Banner ×2 | Press (global) | Stake | Press + Fold | ✗ (global Escalate) |
| Core rules | 10 | 10 | **6** | 9 | ~14 + 30 keywords |

When independent designers agree, that's the design space telling us something. v0.6 is the outlier on
every one of these, and those are exactly the places where it fails the target experience (see 0-incumbent-v06.md).

## Scoring against the target experience (1–5)
| | Tension at reveal | Readable cause → effect | Faction identity | Comeback hope | Rule budget | Fits client constraints* |
|---|---|---|---|---|---|---|
| 0 v0.6 | 2 | 1 | 4 | 3 | 1 | 5 |
| A Formation | 4 (fronts flip one by one, Banner) | 4 | 3 | 4 | 3 | 3 (hands push out positional synergy; stragglers removed ≈ no stacking depth) |
| B Fault Lines | **5** (cascade waves) | 4 (ripple *is* the cause) | 4 | 4 | 3 | **5** (columns, rows, flank, exposure, stacking) |
| C Fault Line | 4 (lane flips, Stake) | **5** (one number, binary states) | 3 (identity only on cards) | 4 | **5** | 4 (positional = adjacency only) |
| D Ledger | 4 (second decision after reveal: Fold) | 3 | 4 | 3 (3-round match is swingy) | 3 | 3 (a 3-round, whole-match supply is a different game length) |
\* morale-first, units don't move, stacking to reinforce, positional synergy, hidden simultaneous play + gamble, no micromanagement.

## Decision: prototype before committing
Following the process (find the fun fast, diverge then converge), no concept is adopted on paper. Next:
1. Build a tiny **prototype engine** for the converged skeleton with *vanilla* cards (stats only, no abilities),
   the digital equivalent of each pitch's paper test.
2. Run it under the steelman bot and the fun proxies (skill, lead changes, decided round, close decisions, comeback),
   **alongside v0.6**, and A/B the pieces each pitch argued about:
   - B's Pressure-vs-Nerve-with-cascade vs C's lane-total clash with Shaken/Routed states
   - with and without the secret lane Stake
   - D's Fold window as an add-on
3. Read actual game logs (does a rout chain read as a story?), then decide what becomes v0.7.
4. The factions and card art/names carry over whichever wins. Abilities get re-expressed on the new core.
