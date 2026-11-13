# SHATTERLINE: Game Design (v0.2)

> A sci-fi hex-board card game where armies are beaten by **breaking their will**, not by
> grinding hit points. You make decisions only at placement time: hidden, simultaneous,
> Hive-style placement. Combat then resolves on its own, predictably, with intent shown in
> advance. Stacking reinforcements and a doubling-stakes gamble complete the loop.

All numbers come from headless AI-vs-AI simulation (`npm run sim`, `npm run sim -- 16 --arch`).
See §11 for the latest results.

---

## 1. Design pillars

| Pillar | Why | How |
|---|---|---|
| **Morale is the real health bar** | Every attack becomes a choice between killing and breaking. | Normal attacks deal **Shock** (morale damage). Real casualties come from *Lethal* units, from running down broken troops, and from surrenders. |
| **Every decision is a placement** | Players should not micromanage. A drawn-out tactics game drives away new players (Faeria, Duelyst). | You choose *what*, *where* and *how much to stake*. Combat resolves on its own. |
| **Deterministic and telegraphed** | Opaque automatic combat feels random (Artifact, Battlegrounds). Telegraphing makes every loss your own fault (Into the Breach). | One targeting rule for every unit, no dice, and intent arrows shown while you plan. |
| **Position over arithmetic** | Get depth from simple rules (Marvel Snap). | Flanking, high ground, cover, firing lines and Hive placement decide fights. |
| **Hidden, simultaneous orders** | No downtime, and room to bluff. | Both players place face-down, then reveal. |
| **Every rout has an author** | Morale must come from something a player did, not from slow attrition. | Breaks come from flanks, surrounds, cut synapse links and decoys that someone placed. |
| **Obvious faction goals** | Like Infinity Wars and 40k, you should read a faction's plan at a glance. | Concord holds the line. Brood swarms and evolves. The Hush strike unseen. |
| **Three numbers per card** | Avoid spreadsheet play (Gwent's single number). | **Cost, Power, Nerve.** Range and speed are icons. |
| **The gamble** | Snap-style stakes turn confidence into a resource. | **Escalate** doubles the stakes. **Sound the Retreat** concedes at the current stakes. |

---

## 2. Components

- **Board:** 45 hexes in rows of 6/7/6/7/6/7/6, point-symmetric. Hexes have **elevation**
  (0–2) and a terrain type: `open`, `ruins` (cover), `crater` (stops movement) or `relay` (objective).
  There are 3 Relays in the centre row.
- **HQ:** each player starts with an HQ on their home edge. It is Fearless, has 12 Power and
  never moves. Your army grows outward from it.
- **Deck:** 20 cards, max 2 copies. You draw 5 to start and **2 per round** (hand limit 8).
- **Resolve:** 16. This is your army's will to fight. At 0 your army collapses.
- **Command (CP):** `min(round+1, 7)` + 1 per Relay you hold. 1 unspent CP carries over.

## 3. Cards

**Units** show **Cost / Power / Nerve**, plus icons for range and speed (defaults: melee, speed 1).
- **Power** is both strength and toughness. A unit strikes for its Power, and damage
  lowers Power, so wounded units hit softer.
- **Nerve** is morale. Shock lowers it. At 0 the formation **Breaks**.

**Tactics** are one-round orders (Over the Top!, Hold Fast, False Orders, …). You play them
on a formation, and they compete with units for the same Command. These are the only
"orders" in the game.

**Heavy** units (cost 5+) are ordered one round ahead. A face-down drop marker sits on the hex
for a round, then the unit lands. Heavies are a telegraphed gamble.

### Formations and stacking
A formation is 1–3 cards on one hex (Swarm: up to 5).
- **Reinforce** by playing a card onto your own formation of the same class.
  Officers can join any stack.
- **A stack is the sum of its cards.** Power and Nerve add up. Only the **top card's** (the Lead's)
  keyword is active.
- Reinforcing a **Broken** formation rallies it.
- **Trade-off:** spread units make more strikes and get flanking and firing lines. A stack is
  harder to break but is one big target, and it costs more Resolve when it breaks.

## 4. Placement (Hive rule)

A new formation must be placed **touching one of your formations** and **not touching an
enemy**. Exceptions:
- Infiltrate units, and hexes next to your spawn structures (Spore Pod, Shroud Lantern), may touch enemies.
- Brood Infiltrators may also be placed anywhere next to Creep.

You may also place onto your own formation to reinforce it. You may place at most one unit
per hex per round.

## 5. Round structure

1. **Orders (simultaneous, hidden).** Both players place cards face-down and may Escalate.
2. **Reveal.** Heavy drops land first. Then the initiative player's cards, then the other
   player's (units first, then tactics).
3. **Advance.** Each formation that has nothing in reach moves its speed toward the nearest
   enemy or unheld Relay. Exceptions:
   - It doesn't move if it is Shaken, holding a Relay, just deployed, or immobile.
   - It stops when it touches an enemy or when something comes into reach.
   - Initiative player's formations move first.
4. **Ranged volley.** Every ranged unit not in contact fires **simultaneously**.
5. **Melee clash.** Every formation in contact strikes **simultaneously**. Ranged units in contact fire at point-blank range.
6. **Routs.** Broken formations act out their faction's break behaviour (§7).
7. **Upkeep:**
   - Rallies.
   - Nerve recovery: +1 Nerve if not in contact.
   - Brood evolve.
   - Hush re-cloak.
   - Creep.
   - **Relays** drain 1 enemy Resolve each.
   - **Siege:** each formation touching the enemy HQ drains 1.
8. **Next round.** Initiative goes to the player with **lower Resolve** (a catch-up mechanic). You gain Command and draw 2.

## 6. Combat

**Targeting rule (used by every unit):** strike the **nearest** enemy in reach. Ties go to
an enemy in your **front arc**, then the **lowest Nerve**, then the **leftmost**. *Hunters*
instead pick the costliest enemy in reach. Ranged attacks need line of sight unless the unit
is *Indirect*. Cloaked enemies can only be hit when adjacent.

**Strike value** = formation Power, then apply these modifiers:

| | |
|---|---|
| Flank (attacker outside the target's front arc) | +1 |
| Higher ground / lower ground | +1 / −1 |
| Target in cover (ranged attack) | −1 |
| Target supported by 2+ adjacent allies | −1 |
| Shaken attacker | −1 |
| Ambush (attacking from cloak) | +2 |
| Firing Line, Officer aura, Synapse, Frenzy, Charge, Volley | per card |

The strike value is dealt as **Shock** (Nerve damage). It is dealt as **damage** instead when:
- the attacker is **Lethal**;
- the target is already **Broken** (it gets run down);
- the target is **Fearless**: HQs and structures take it in full, and **linked Brood** take half.

**Breaks:**
- The owner loses **3 Resolve** (Brood: 1; a Synapse: 3; all-token formations: 0).
- Adjacent friends **panic** (−1 Nerve).

**Deaths:** each card destroyed costs **1 Resolve** (Synapse 3, HQ 6, tokens 0). It also
panics the formation and its neighbours.

**Surrender:** a broken formation with no escape route is captured, and all its cards are lost.
Encircling an enemy is how morale play turns into outright kills.

## 7. Factions (15 cards each, 3 archetypes)

### Concord Vanguard: "Hold the line"
- **Firing Line:** +1 when 3 or more Concord units stand side by side in a row.
- **Rout & Regroup:** a broken formation flees toward home. It rallies in the home zone, or next to a Whistle-Lieutenant.
- **Archetypes:**
  - **Gunline:** riflemen, officers, a sniper.
  - **Bastion:** sappers, pillboxes, mortars, artillery.
  - **Iron Tide:** ram-tracks, walkers, siege-crawler, Over the Top!.

### Vhorr Brood: "Swarm & evolve"
- **Synaptic Link:** Brood within 2 of a Synapse (3 for the Overmind) are **Fearless**. They take half of any Shock as damage.
- **Feral:** a broken Brood formation doesn't flee. It attacks whatever is adjacent, friend or foe, and rallies only once it is relinked.
- **Evolve:** a Brood unit that draws blood gains +1 Power (max +3).
- Brood breaks cost only 1 Resolve.
- **Archetypes:**
  - **Endless Tide:** Skitterlings, Pods, Spawning.
  - **Apex:** grubs, Ravager, Gorgemaw, Pheromone.
  - **Synaptic Terror:** Wardens, Howler, Leech, Overmind, Psychic Scream.

### The Hush: "Unseen"
- **Cloak:** Hush units arrive cloaked. Enemies see that something is there but not what. Cloaked units can only be hit when adjacent, and they are spotted when an enemy steps next to them.
- **Ambush:** an attack from cloak gets +2.
- **Vanish:** a broken Hush formation melts away. Its Lead returns to your hand, unless it is caught while adjacent to an enemy, in which case it surrenders.
- **Archetypes:**
  - **Phantom Host:** decoys, Mirage Weaver, Smoke & Mirrors.
  - **Night of Knives:** assassins, Quiet Needle, the Faceless.
  - **Dread:** Rumor-Wrights, Hollow Choir, Dread Herald, False Orders.

Full card list: `src/shared/cards.ts`.

## 8. The gamble: Escalation
- Stakes start at 1.
- Each player may **Escalate** once per match, as part of their hidden orders.
- Stakes double at the **start of the next round**, which gives the opponent a round to react. They also auto-double before round 8. Stakes are capped at 8.
- At any time, a player may **Sound the Retreat**: they concede at the **current** stakes, before any pending escalation applies.

## 9. Victory
- Reduce the enemy's Resolve to 0, **or**
- after round 8, have the higher Resolve. Ties go to the player with more Relays, otherwise the game is a draw.

## 10. Backlog / future factions
- **Ossuary Engines** (undying machines): destroyed units leave husks that rebuild unless an enemy holds the hex.
- **Choir of the Pyre** (zealots): Fervor rises as allies die, until their standard falls.
- **Grukkan Surge** (momentum horde): fearless while winning, collapses all at once when stalled.
- **Hollow Lattice** (resonant crystal machines): shelved concept from v0.1.
- Deck-building: Gwent-style provision limits.

## 11. Latest simulation (greedy 1-ply AI, 432 games)
- **Win rate by archetype** (range 37–59%):

  | Faction | Archetypes |
  |---|---|
  | Concord | gunline 48, bastion 49, iron 46 |
  | Brood | tide 54, apex 52, synapse 59 |
  | Hush | phantom 45, knives 38, dread 50 |

- **Game length:** most games end in rounds 5–7.
- **Resolve lost by source:** morale 47%, relays 25%, kills 23%, surrender 4%.
- **Known AI limit:** it assumes the opponent plays nothing this round. This undervalues stealth and ambush play.
