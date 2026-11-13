# FAULT LINE

*Win lanes by exactly enough, never more: a squeaker shakes a unit, a second squeaker routs it, and every rout sends a shiver down the line.*

## Core rules (6)

Board: 3 lanes. Each player has a Front and Rear slot per lane. Units never move. Every unit has ONE number, Value (1-4).

1. **Commit.** Rounds 1-5. Each round you have Supply = round + 2 (3,4,5,6,7; unspent is lost). Secretly place cards face-down for their cost into empty slots. You may instead place a card on one of your own units to **Reinforce**: add its Value; the unit absorbs its first Shake (discard the reinforcer instead). Also secretly put your **Stake** token (free, one per round) on a lane.
2. **Clash.** Flip everything. In each lane, total Value (Front + Rear) per side. Higher wins; tie = nothing.
3. **Margin.** The loser's *Front* unit (Rear if no Front) is hit. Margin 1-2: **Shaken** (tilted card). Already Shaken: **Routs**. Margin 3+: **Destroyed**. A Staked lane: its loser's front unit Routs outright, whoever staked.
4. **Contagion.** When a unit Routs, it flees to your Routed pile and each adjacent friendly unit (same lane, or neighbouring lane same rank) becomes Shaken. Destroyed units vanish quietly and spread nothing.
5. **Rally.** After a round, your Shaken units in lanes you *won* recover.
6. **Break.** You lose when 3 of your units have Routed (or you have no units while the enemy has some). After round 5: more Routs on the enemy wins; tie = fewer Shaken units.

## Why morale is not health

- **Margin is nearly irrelevant.** Winning by 1 equals winning by 2. Pouring Supply into one lane is waste, not damage.
- **Binary, visible states.** Steady, Shaken, Routed. No numbers to subtract, so you see why a unit broke: it lost twice without winning a lane between, or its neighbour fled.
- **Damage lives in the board shape, not in the unit.** Routing hurts *neighbours*. A full, clustered line is strong and fragile at once. Placement is the whole skill.
- **It heals by winning, not by waiting.** Rally depends on winning that lane this round.
- **Destruction is the dull path.** Margin 3+ kills cleanly but spreads no fear and does not count toward Break. You can't grind your way to a win; you need Routs.

## Bluff and reading

Hidden info: the *number* of Supply in each lane and the Stake. Everything else is public (Shaken units are visible, Routed pile is visible), like Into the Breach: you know what will hurt, not what they will do about it.

**Decision 1: where to spend.** The enemy's Concord front in lane A is Shaken, so any win there Routs it. A weak player piles 6 Supply on A. A strong player knows the opponent also sees this and will defend A, so they put a cheap +1 push on A, win B and C by 1 each, and let the opponent over-defend. Winning two lanes by 1 beats one by 5.

**Decision 2: the Stake.** Your own Shaken front is a liability, so the obvious Stake is on a lane you *must* hold. A weak player stakes their strongest lane. A strong player stakes the lane the opponent is likely to abandon, to Rout a unit they thought was safe, or stakes a lane they expect to lose to hide a Decoy there. Both players always know a Stake exists, never where.

## Faction identity (cards carry it, plus one rule each)

- **CONCORD, "Hold the line":** Formation. Adjacent units in the same rank add Value. Officers Rally allies even in lost lanes. Strong and tight, so Contagion is the enemy.
- **BROOD, "Flood and evolve":** Cheap bodies, Floods (same-name cards placed together grow). A **Synapse** makes adjacent Brood immune to Contagion; but if it Routs, its linked units are Shaken and *can't* Rally that round.
- **HUSH, "Last word":** The Hush player may move their Stake token *after* the flip, before the Clash. Their units are low Value but punish information (Ambush, Terror).

## Comeback and anti-snowball

- **Underdog Supply:** each Routed unit above the opponent's count gives +1 Supply next round.
- **Leader's Stake costs 1 Supply** if they have more Routs.
- Overwhelming a lane wastes Supply, so the leader can't convert advantage into a bigger one.
- A Routed unit's empty slot is a "free" lane for the enemy, but wasted Supply there is Supply not used elsewhere.
- Rally lets a Shaken army recover if it wins a lane. Nothing is permanent but the Routed pile (3 to lose), so hope lasts until round 4.

## Cards (cost / Value)

**CONCORD**
- *Rifle Line* (2/2): +1 Value if an ally is adjacent in the same rank.
- *Sergeant* (2/1): Officer. Adjacent Shaken allies Rally at end of round regardless of the lane result.
- *Bastion Walker* (4/4): Armour. Margin 3+ hits it as 1-2 instead.

**BROOD**
- *Skitterer* (1/1): Flood. +1 Value for each other Skitterer placed this round.
- *Overmind Node* (3/2): Synapse. Adjacent Brood ignore Contagion. If it Routs, linked units can't Rally this round.
- *Carnivore* (4/4): Evolve. After winning a lane, permanently +1 Value (max 6).

**HUSH**
- *Shade* (2/1): Ambush. Value 3 if the enemy lane has no Rear unit.
- *Decoy* (1/0): Bait. An enemy Stake in this lane is cancelled; it does not Rout.
- *Wraith* (3/2): Terror. When it wins a lane, also Shake the enemy Rear unit.

## Biggest risk and cheapest test

**Risk:** The decision space may collapse into an obvious equilibrium ("spend equally everywhere, Stake the Shaken lane"), and Hush's Stake advantage could be stronger than it sounds.

**Test:** Paper prototype tonight with 3 coins per lane and pennies for Supply, 5 minutes of play, using only vanilla Value-1-to-4 cards and Stakes (no faction abilities). If players still groan "I misread them" and not "obvious", the core holds. Then add each faction's three cards one at a time.
