# FORMATION: Hands and Bluffs

**Hook:** Three contested fronts, three slots a side: you build battle-line "hands" in the open, but the card that completes the hand goes down face-down, and a hidden Banner bets which front breaks.

## 2. Board and core loop (complete rules)
Board: 3 Fronts. On each Front, each side has a row of 3 slots (adjacent slots = neighbours). A shared **Resolve track** runs -8..+8, marker at 0. Push it to your enemy's end to win. Units have a **Class** (Line, Shock, Aux) and **Rank** 1-5, and never move.

1. **Supply.** Each round: draw to 5 cards, get 6 Supply. Unspent Supply is lost.
2. **Commit.** Simultaneously, each player pays Supply and places up to 3 cards face-down into empty slots. Previous rounds' units stay face-up and are visible to both.
3. **Stack.** A card may instead be placed under your own unit (max 2 cards a unit): adds its Rank, keeps the top card's Class.
4. **Banner.** Each player secretly puts one Banner token on a Front. That Front's swing is doubled, for the winner.
5. **Reveal.** Fronts flip one at a time, left to right. Each side shows its **Hand** (best formation, below).
6. **Hands**, high to low: **Phalanx** (3 same Class) > **Column** (3 consecutive Ranks) > **Pair** (2 same Class) > **Mob** (nothing). Ties: higher total Rank. Still tied: no swing.
7. **Swing.** Winner moves the marker by the winning Hand's tier (Phalanx 3, Column 2, Pair 1, Mob 1) x2 if Banner'd.
8. **Rout.** On the losing side, units *not in their Hand* (stragglers) rout and are removed. Units in the Hand stay.
9. **Rally.** Routed slots are empty next round. Discard to 5, repeat from 1.
10. **Win:** the marker reaches an end, or after round 6, the marker is further your way.

## 3. Why morale isn't health
- One shared tug-of-war marker. Nothing "has HP"; no unit is worn down. A unit is either holding in a Hand or it is a straggler.
- Morale is **relative**: you never lose nerve for being hit, only for showing a worse Hand than the enemy at that Front.
- Cause is visible: "my Rank-2 Shock sat outside my Pair, so he broke." Stragglers rout, formation members don't.
- Moves come in lumps at the reveal, not as per-turn chip damage. A big Phalanx can flip the game in one flip.
- Killing units is secondary: routed units free slots, which weaken the enemy's *next* Hand.

## 4. Bluff and reading
Face-up units telegraph your Hands. The face-down card is the answer to "what are you building?". Banner is the poker bet.
- **Example 1 (Banner).** Front 2 shows enemy Line 4 + Line 3 face-up, one slot open (Column or Phalanx threat). A weak player puts the Banner on the Front they are strongest on. A strong player Banners the Front where the enemy's open slot makes the enemy *likely* to overcommit, and plays a cheap Mob decoy there. Often they bank the 1-point loss to win a Banner'd 6 elsewhere.
- **Example 2 (Stack).** Holding a Line 2 and a Line 3 beside a Line 4: a weak player slots all three (reveals a Column, loses to a Phalanx). A strong player stacks the 3 under the 4 (a face-down Rank 7), reading that the enemy fears the Column, and saves Supply for the next round.

## 5. Factions
- **CONCORD.** *Hold the line:* units in a Phalanx or Column can't be stacked on or targeted by enemy effects. Officers (Aux) count as any Class for Hands, so Concord reliably makes Phalanxes. Archetypes: Gunline (Phalanx), Armour (big stacked Ranks).
- **BROOD.** *Flood:* Brood fronts have a **4th slot**. *Synapse:* stragglers adjacent to a Synapse unit do not rout. Archetypes: Swarm (many cheap Pair/Mob), Evolver (stack to mutate).
- **HUSH.** *Cloak:* Hush units may be placed face-down and stay face-down after reveal (they show only as "a unit" and count for a Hand only if you flip them). *Terror:* when Hush wins a Front, each enemy rout also moves the marker 1. Archetypes: Ambush (Banner tricks), Terror.

## 6. Comeback and snowball control
- **Comeback:** the trailing player (marker nearer their end) gets 7 Supply and a second Banner at +/-5 or beyond (a "Last Stand"). Doubled swings let one good read recover 6 points.
- **Anti-snowball:** the tug-of-war is zero-sum so there is no stored lead beyond the marker. Routed enemy slots are open, but only the winning side's stragglers survive, so a loser with only a Hand of 2 units is *thin*, not dead. A Banner you lose on gives the enemy the double swing, so over-betting is punished.

## 7. Example cards
**CONCORD**
- Line Trooper: 2 Supply, Line 2. "Cheap Line to make Pairs."
- Captain Vael (Officer): 3 Supply, Aux 3. "Counts as any Class for Hands."
- Siege Walker: 4 Supply, Shock 5. "Can't be stacked on; Rank +1 when in a Phalanx."

**BROOD**
- Skitter: 1 Supply, Shock 1. "Place two Skitters in one slot-action."
- Synapse Queen: 4 Supply, Aux 3. "Adjacent stragglers don't rout."
- Mutating Drone: 2 Supply, Line 2. "When stacked on, change its Class."

**HUSH**
- Phantom: 2 Supply, Shock 2. "Stays face-down after reveal."
- Decoy: 1 Supply, Aux 1. "Counts as any Class, but routs if it is the only straggler."
- Dread Stalker: 4 Supply, Shock 4. "On a won Front, rout also moves the marker 1."

## 8. Biggest risk and cheapest test
**Risk:** The face-down cards may not carry enough bluff, since Hands are mostly deduced from face-up units; Banner could be a coin flip. The 3-slot Hands may also compute so obviously that play becomes solved.
**Test:** Paper prototype with a standard deck: Ranks 1-5 across 3 suits (Classes), 3 Fronts, a coin as Banner. Play 10 games by two people. Success = on at least half the Banner placements, the player can name a specific read, and the loser says "I misread," not "I lacked cards."
