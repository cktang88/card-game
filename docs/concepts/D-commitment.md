# THE LEDGER OF NERVE

**Hook:** You get one pool of supply for the whole match, and every lane is a bet you can double on or walk away from after seeing the enemy's cards.

## 2. Board and core loop

Three lanes. Each side has a Front slot and a Rear slot per lane. Units never move.

1. **Match:** 3 rounds. Each commander has **Resolve 10** and a **Supply pool of 12 for the entire match**. It never refills. Hand: 9 of your 15 cards, chosen blind.
2. **Commit (secret, simultaneous):** Place face-down cards into lanes, paying their cost from Supply. Placing on your own unit **stacks** it: add the new card's Fire and Nerve to it (max 2 cards per slot). Holding cards back is a decision.
3. **Press (secret):** For 1 Supply, put a Press marker in a lane. A lane's **Stake** is 1, +1 per Press by either side. Stakes are also +1 in round 3.
4. **Reveal:** Flip everything. Fire and Nerve are public.
5. **Fold window (simultaneous):** Each player may **Fold** any lanes. A folded lane is conceded: you lose **1 Resolve** (never the Stake) and your cards there return to your hand. Their Supply cost is not refunded.
6. **Resolve (automatic):** In each unfolded lane, the sum of each side's Fire is **Pressure** on the enemy Front. If Pressure ≥ Nerve, that unit **routs**. Excess Pressure spills onto the Rear unit. Each routed unit **shakes** the adjacent Fronts in neighbouring lanes (−1 Nerve), applied once, left to right.
7. **Break:** A lane whose Front and Rear are both routed or empty is **Broken**. Its owner loses Resolve equal to the Stake. If neither side breaks, Stake carries to next round's same lane, so the pot grows.
8. **Persist:** Surviving units stay in place for free, but are **Weary** (−1 Nerve each round). Routed cards are gone for good.
9. **Win:** Reduce the enemy to 0 Resolve, or have more Resolve after round 3.

(Nine rules. Fold's return-to-hand is what gives it value.)

## 3. Morale vs health

There is no damage counter. A unit is steady or it routs, and the check is **Pressure ≥ Nerve** fresh each round. Wearing a unit down over rounds does nothing, so there is no grinding. Chip damage cannot win. What wins is concentrating Pressure above a threshold. Rout also **spreads**: one broken front weakens its neighbours, so a break can chain. You see the cause on screen: "Pressure 5 vs Nerve 4, routs, shakes the lane to its right." A broken **lane** costs Resolve, not a dead unit, and Resolve is only ever lost by breaking or folding. Your army loses its nerve, it does not lose its hit points.

## 4. Bluff and reading

The gamble is two questions asked in secret: **where do I spend, and who presses?** The second gamble comes after the reveal, when you decide whether to fold.

- **Decision A, round 1 with 12 Supply:** A weak player spends 7 to win lane one decisively. A strong player spends 3 per lane, takes a 1-Stake loss on purpose in one lane, and keeps 4 Supply for round 3, where Stakes are higher.
- **Decision B, the fold window:** Both players Pressed the centre (Stake 3). You see Pressure 6 against your Nerve 5. A weak player stays because they paid so much. A strong player folds, loses 1 Resolve instead of 3, recovers two cards and takes a free round-3 ambush. A strong player also knows when a Press was a bluff: the opponent has a 1-Fire unit and is hoping you fold.

## 5. Faction identity

- **CONCORD, Orders:** Officers can Fold their lane at **no Resolve cost** (orderly retreat). Concord lines are strong, steady and cost-efficient. Concord is the master of cutting losses.
- **BROOD, Flood:** Stacking onto a Brood unit costs **0 Supply**, and a Brood unit in a lane with a Synapse card **cannot be shaken**. Brood wins by cheap bulk and by refusing to chain-rout.
- **HUSH, Ambush:** Hush cards are revealed **after** the Fold window. The enemy must decide whether to fold blind. Hush wins by manipulating the fold decision itself.

## 6. Comeback and snowball control

- **Escalating Stakes:** Round 3 lanes are worth more, and carried Stakes plus Presses make a late swing worth 3–4 Resolve. A 6-point early lead can vanish in one lane.
- **Weary:** Veterans lose Nerve each round, so the leader's standing line becomes brittle.
- **Fixed Supply:** The leader who spent heavily early has less late. Winning big now costs you later.
- **Desperation:** At Resolve ≤ 4, gain +2 Supply once, to be spent immediately in the next Commit.
- **Fold is a safety valve:** You can always limit a lost round to 1 Resolve and keep cards.

## 7. Example cards (cost, Fire/Nerve)

**CONCORD**
- **Line Trooper** (1, 1/3): Rear: the Front ally here gains +1 Nerve.
- **Bulwark Walker** (3, 2/6): Cannot be shaken.
- **Field Marshal** (2, 1/3): Officer. Folds this lane free. Your other lanes' Fronts get +1 Nerve while this unit is unrouted.

**BROOD**
- **Skitter Brood** (1, 1/1): Stacking on it is free. Stack limit is 3 on Brood.
- **Synapse Tyrant** (4, 2/5): Linked units in this lane cannot rout this round unless it routs first.
- **Spore Burster** (2, 3/1): When routed, its lane's Pressure on the enemy Front is +2 (applies after resolve for spill).

**HUSH**
- **Hollow Decoy** (1, 0/1): Ambush. When routed, enemy adjacent Fronts get −2 Nerve (terror).
- **Night Blade** (2, 4/2): Ambush. Rear attacks: counts as Pressure on the Rear first.
- **Choir of Silence** (3, 1/3): Ambush. On reveal after the Fold window, every enemy unit in this lane has −1 Nerve.

## 8. Biggest risk and cheapest test

**Risk:** The Fold window might become the only decision. Players might fold constantly (turtling) or never fold (a dumb brawl). The fixed Supply pool might make optimal play solvable. Hush's late reveal might feel like a cheat if the fold information is too opaque.

**Test:** Paper test in an evening. Use 3 lanes, 12 supply tokens, a hand of 9 cards from hand-written cards, and simple Resolve tokens. Run 20 matches with 2 players and track:
- Fold rate per match (target 20–40%).
- Whether the early leader wins more than 70% of the time (snowball check).
- Whether players say "I misread them" after losses, not "I ran out of Supply."
If Folds are under 10% or over 60%, the Stake and Fold values are wrong, and the core loop needs a rewrite before building anything.
