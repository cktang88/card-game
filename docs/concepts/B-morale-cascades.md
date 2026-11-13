# FAULT LINES

*Every army has a weakest unit; you win by finding it, striking it, and watching the panic run down the line.*

## Core rules (the complete list)

**Board:** each commander has 6 slots: 3 columns (Left, Centre, Right) x 2 rows (Front, Rear). Units never move. Cards have **Cost**, **Power** (fear dealt) and **Nerve** (fear withstood).

1. **Round 1-5.** Draw to a hand of 5. You have **3 Command** per round.
2. **Deploy in secret.** Place face-down cards into empty slots, or stack a card onto your own unit. Stacking adds the stacked card's Nerve (not Power) to that unit. Cost is paid from Command.
3. **Stake.** Secretly choose **Hold** or **Press** (twice per game). Press gives all your units +1 Power this round, but each of your units that routs counts double toward breaking you.
4. **Reveal.** Flip everything at once.
5. **Pressure.** Each unit aims its Power at the first enemy in its column (Front before Rear). If its column is empty, it **Flanks** the nearest enemy column at +1. A unit's Pressure is the total Power aimed at it.
6. **Rout.** A unit with Pressure >= Nerve routs and is removed. Pressure is **recalculated every round from scratch**; nothing carries over.
7. **Panic.** Each rout adds +1 Pressure to its orthogonal friendly neighbours. The unit behind it is also **Exposed**: it now takes the Power that was aimed at the routed unit. Then re-check. Repeat in waves until stable.
8. **Slain, not routed:** Pressure >= 2x Nerve kills a unit outright. A slain unit spreads **no** panic. Kills are quiet; routs are loud.
9. **Break.** Every removed unit is a Break marker (x2 if routed under Press). Reach **4** and your army breaks and you lose. After round 5, fewer markers wins.
10. **Rally.** After the reveal, each unit you lost this round gives you +1 Command next round.

## Why morale is not a health bar

Health is a ledger you spend. Nerve is a **threshold on a temporary number**. Pressure wipes every round, so you can't grind a unit down. A unit is either fine or it is gone, and often it routs without being "hit" much at all: it breaks because of what happened next to it.

The reveal plays as **waves**. Wave 0 routs flash. Panic ripples out as a visible pulse into neighbours, each unit showing a ring that fills toward its Nerve number (3/4... 4/4, snap). Every rout has a traceable chain: "Flank hit the Right front, which routed, which pushed the Centre front to its limit, which exposed the Rear." Players see the cause because the ripple *is* the cause.

## Bluff and reading

The bluff is in **where and how much** you commit, and in **Press**.

- **Decision 1, the weak link.** Your opponent has an obvious strong Centre and an empty Right. A weak player stacks the Centre for safety. A strong player knows the opponent will Flank the empty side, so they place a cheap high-Nerve anchor on the Right and leave the Centre thin, since a Centre rout won't cascade if the Right holds.
- **Decision 2, Press.** At 2-1 down, a weak player Presses every round and breaks themselves. A strong player holds Press for the round where they have predicted a Flank on a cluster of low-Nerve units, because doubling routs works both ways, and they only Press when the opponent's rout chain would be longer than their own.

## Faction identity

- **CONCORD:** *Officers* give adjacent units +1 Nerve, and **a full Front row is immune to Panic** ("hold the line"). They are slow but crumble all at once if an officer is exposed.
- **BROOD:** *Synapse* units link all Brood units in their column: linked units ignore Panic. A routing Synapse gives its linked units +2 Pressure ("the hive-mind collapses"). Stacking on Brood adds Power as well as Nerve ("evolve").
- **HUSH:** *Decoys* are placed face-down and may be hollow: they are revealed as "nothing" and shift enemy Flank aim. *Terror* Power ignores the front-first rule and hits the Rear directly.

## Comeback and snowball control

Rallying (+1 Command per loss) lets the loser flood the next round. **Cornered:** at 3 Break markers, your surviving units get +1 Nerve. Press makes a leader's lopsided routs expensive. Because Pressure never persists, a single well-read round can reverse a loss that took three rounds to build. There are no dice.

## Example cards

**CONCORD**
- *Shield Warden:* Cost 1, P1 / N4. Stalwart front-line anchor.
- *Line Captain:* Cost 2, P1 / N3. Adjacent allies +1 Nerve.
- *Lance Battery:* Cost 2, P4 / N1. Rear: fires over the Front row.

**BROOD**
- *Skitterlings:* Cost 1, P2 / N1. Cheap flood; panic fodder.
- *Hive Tyrant:* Cost 3, P3 / N4. Synapse: links its column.
- *Gorger:* Cost 2, P2 / N2. Stacked on: gains the stacked card's Power.

**HUSH**
- *Phantom:* Cost 1, P0 / N1. Decoy: face-down; may be revealed as nothing.
- *Nightblade:* Cost 2, P3 / N1. Ambush: hits the Rear directly.
- *Dread Whisper:* Cost 2, P1 / N2. When it applies Pressure, the target's neighbours gain +1 Pressure.

## Biggest risk and cheapest test

**Risk:** deterministic cascades may be solved ("always anchor the flank"), or a single long chain may feel like a coin-flip win at reveal.

**Test:** a paper prototype with 6-slot boards, CONCORD vs BROOD only, ten stat cards each, no abilities. Play 20 rounds with a facilitator resolving waves, and track how often the loser says "I misread them" instead of "that was luck", and whether Press changes decisions.
