# SHATTERLINE — Game Design (v0.1, prototype)

> A sci-fi hex-board TCG where armies are beaten by **breaking their will**, not
> just by grinding their hit points. Hidden simultaneous orders, stackable
> formations, terrain geometry, and a doubling-stakes gamble.

Working title: **Shatterline**. Everything here is a prototype hypothesis; numbers
are tuned by headless AI-vs-AI simulation (`npm run sim`) and playtests.

---

## 1. Design pillars (and why)

These come from established design principles; every rule below should serve
one of them.

| Pillar | Principle it serves | How it shows up |
|---|---|---|
| **Morale is the real health bar** | "A game is a series of interesting decisions" (Sid Meier). Two damage tracks (Strength + Morale) means every attack is a *choice* between killing and breaking. | Every attack deals ⚔ Damage *and* ☠ Shock. Breaking is usually faster than killing, but broken troops can come back. |
| **Position over arithmetic** | Depth from simple rules, not long rules text (Marvel Snap's "elegance" goal). | Flanking, support, high ground and faction "geometry" (lines / radius / triangles) decide fights more than raw stats. |
| **Hidden, simultaneous orders** | Simultaneous turns kill downtime and create bluffing; input-randomness from *opponent's* choices, not dice. | Both players secretly place deploys **and reinforcements face-down**, then reveal. |
| **Deterministic combat** | Output randomness makes players feel robbed; hidden info already supplies uncertainty. | No dice. Combat math is fully predictable once revealed. |
| **Short, tense matches** | Short games, clear end point (8 rounds), a final-round crescendo. | Max 8 rounds, ~10–15 minutes. |
| **The gamble** | Snap-style stakes: confidence becomes a resource, and conceding is a skill. | **Escalate** doubles stakes; **Sound the Retreat** concedes at current stakes. |
| **Comebacks without rubber-banding wins** | Avoid snowballing; keep losing player engaged. | Lower-Resolve player gets initiative; broken units regroup; reinforcement rallies. |
| **Asymmetry through rules, not just stats** | StarCraft-like factions that *play* differently. | Each faction breaks, rallies and buffs by a different rule. |
| **No dominant strategy** | Dominant strategies drain choice. | Stack-vs-spread tension; every faction geometry has a counter in the other two. |

---

## 2. Components

- **Board**: hex grid, 7 columns × 8 rows (pointy-top, odd-row offset). Each player's
  **home zone** is their 2 nearest rows. Hexes have:
  - **Elevation** 0 / 1 / 2.
  - **Terrain**: `open`, `ruins` (cover), `crater` (ends movement), `relay` (objective).
  - Three **Relays** sit in the middle rows.
- **Deck**: 20 cards, max 2 copies. Opening hand 5; draw 1 per round.
- **Resolve**: each player starts at **16**. This is your army's will to fight.
- **Command (CP)**: per-round energy for playing cards.

---

## 3. Cards and formations

Every card in the prototype is a **unit card**:

```
Cost   ⚔ Power   ☠ Shock   ♥ Strength   ⚑ Morale   Range   Speed   Class
```

- ⚔ **Power** – damage dealt to Strength.
- ☠ **Shock** – morale damage dealt.
- ♥ **Strength** – the card's hit points.
- ⚑ **Morale** – the card's contribution to the formation's will.
- **Range** – 1 = melee; 2+ = ranged (needs line of sight unless *Indirect*).
- **Speed** – hexes per move.
- **Class** – `Infantry`, `Vehicle`, `Officer`, `Beast`, `Swarm`, `Synapse`,
  `Construct`, `Psion`, `Structure`, `Drone`.

### Formations and stacking ("reinforce")

A **formation** is a stack of 1–3 cards on one hex (Swarm: up to 5).

- You **reinforce** by playing a card onto your own formation of the **same Class**
  (Officers may join any non-Structure stack as an attached commander).
- The **newest card goes on top and becomes the Lead**. Only the Lead's abilities
  are active (plus any *Reinforce:* trigger the new card has).
- Formation stats:
  - ⚔ = Lead ⚔ **+1 per card beneath**
  - ☠ = Lead ☠
  - ♥ = tracked **per card**; damage hits the Lead first. When the Lead dies, the next
    card becomes Lead (abilities change!) and the formation takes **1 ☠ (leader down)**.
  - Max ⚑ = Lead ⚑ **+1 per card beneath**.
- Reinforcing restores ⚑ equal to the new card's ⚑ (capped at max).
- **Reinforcing a Broken formation rallies it** (it becomes Shaken).

Stacking concentrates power and morale, but loses board width, flanks and
support, and one stack breaking costs a lot of Resolve. Stacking is never strictly better.

---

## 4. Round structure

The game lasts up to **8 rounds**. Each round:

### 4.1 Supply
- Gain CP = `min(round, 6)` + **1 per Relay you control**. Up to 1 unspent CP carries over.
- Draw 1 card (hand limit 8).

### 4.2 Orders (simultaneous, hidden)
Both players secretly assign cards:
- **Deploy** face-down to an empty hex in your home zone (or next to a faction
  spawn structure).
- **Reinforce** face-down onto one of your formations. The opponent sees that
  *something* is arriving, but not what.
- You may **Escalate** (see §8).

Then both lock in.

### 4.3 Reveal
Cards flip, **initiative player first**. Deploy collisions (rare; infiltrators) bump the
second card to the nearest legal empty hex. *On Reveal* abilities trigger in that order.

### 4.4 Battle (alternating activations)
Starting with the initiative player, players alternate activating **one formation at a
time**: **move, then attack** (either is optional). A player with no formations left to
activate passes; the other finishes.
- Cards deployed this round can't act (**Deploying**) unless they have *Rapid*.
- Reinforced formations **can** act.

### 4.5 End phase
In order:
1. **Broken formations act** (flee / go feral / recall, by faction, §6).
2. **Regroup**: Concord Broken formations in their home zone and not adjacent to an enemy
   rally to Shaken with ⚑ 1.
3. **Recover**: formations not adjacent to an enemy regain 1 ⚑.
4. **Relays**: a Relay is controlled by whoever last had a non-Broken formation on it.
   Each Relay you control drains **1 enemy Resolve**.
5. **Breakthrough**: each of your non-Broken formations in the enemy home row drains
   **1 enemy Resolve**.
6. **Initiative** goes to the player with **lower Resolve** (tie: it alternates).

---

## 5. Combat

**Targeting**: melee (Range 1) hits adjacent hexes. Ranged needs
`distance ≤ range` and line of sight. Line of sight is blocked by any intervening hex whose
elevation is greater than both endpoints, or by intervening formations, unless the shooter
is higher than them.

**Damage (⚔)** modifiers:
- +1 ranged attacker on higher elevation than the target
- −1 target in *cover* (ruins/fortified) vs ranged
- −1 melee attacking uphill
- +1 target is Broken
- −1 attacker is Shaken
- Ward absorbs damage first (Lattice)

**Shock (☠)** modifiers:
- **Flanking**: +1 for each *other* of your non-Broken formations adjacent to the target (max +2)
- **Support**: −1 if the target has 2+ adjacent friendly non-Broken formations
- **High ground**: −1 if the target is higher than the attacker
- **Casualties**: +1 if the attack destroyed at least one card

**Retaliation**: a melee target that survives and isn't Broken strikes back
with its ⚔ as damage (no shock, no modifiers except Ward/cover).

### Morale states
- **Steady**: ⚑ > half of max.
- **Shaken**: ⚑ ≤ half max. −1 ⚔. Can't end a move closer to the nearest enemy.
- **Broken**: ⚑ reaches 0.
  - Owner loses **2 Resolve** (faction exceptions).
  - **Panic**: every adjacent friendly formation takes 1 ☠. Cascades can chain, but each
    formation takes panic at most once per break event.
  - Can't activate. Attacks against it get +1 ⚔. Doesn't retaliate.

### Destruction
Each card destroyed costs its owner **1 Resolve**. Killing works, but it's slower
than breaking.

### Encirclement
When a fleeing formation has **no legal step** it **surrenders**: all its cards are
destroyed. You get the full kill penalty plus the break you already caused. Encircling is
how a morale army wins outright.

---

## 6. Factions

Each faction's rule is about **geometry**, and each geometry has a natural counter
in another faction.

### 6.1 The Concord Vanguard — *discipline & lines*
Hard-bitten colonial militaries, rifles and walkers, painted unit numbers.
- **Firing Line**: a Concord formation in a straight line of 3+ adjacent Concord
  formations gets **+1 ⚔**.
- **Rout & Regroup**: Broken Concord formations **flee** Speed hexes toward their home
  edge in the end phase. They can't step into hexes adjacent to enemies, and
  surrender if they can't move. In the home zone they regroup.
- Strong Officers: auras that blunt Shock and rally.
- *Countered by*: Lattice push (breaks lines), Brood flanking speed.

### 6.2 The Vhorr Brood — *the synaptic swarm*
A bio-swarm with no individual will, only the Overmind's.
- **Synaptic Link**: Brood within **2 hexes** of a friendly **Synapse** formation are
  **Linked**: they **ignore Shock**.
- **Feral**: unlinked Brood take **double Shock**.
- **Broken Brood go Feral, they don't flee**. In the end phase they attack the nearest
  adjacent formation of **either side**, or move toward the nearest formation. A
  Brood break costs only **1 Resolve**; a Synapse dying or breaking costs **3**.
- **Creep**: hexes next to Spore Pods are Creep. Brood can deploy onto Creep;
  enemies ending a turn on Creep take 1 ☠.
- *Countered by*: snipers/artillery killing Synapses, Lattice *Null* fields.

### 6.3 The Hollow Lattice — *resonance & triangles*
Ancient machine-choirs that think together in geometric harmony.
- **Ward X**: absorbs the first X damage each round (not Shock).
- **Resonance**: a Lattice formation in a **triangle** (3 mutually adjacent Lattice
  formations) is **Resonant**: +1 ⚔ and **immune to Shock**.
- **Dissonance**: when a Lattice formation breaks or is destroyed, every Lattice within 2
  hexes takes 2 ☠.
- **Recall, not rout**: a Broken Lattice formation is **recalled** in the end phase. Its
  Lead returns to your hand, the rest are discarded, and the break costs 2 Resolve as usual.
- *Countered by*: Concord artillery splash (clusters), Brood mass Shock on non-triangles.

---

## 7. Prototype card list (10 per faction)

See `shared/src/cards.ts` for authoritative numbers. Summary:

**Concord Vanguard**
| Card | Cost | ⚔/☠ | ♥/⚑ | Rng/Spd | Class | Ability |
|---|---|---|---|---|---|---|
| Line Trooper | 1 | 1/1 | 3/3 | 1/1 | Infantry | *Reinforce*: +1 ⚑ to formation |
| Rifle Section | 2 | 2/1 | 3/3 | 2/1 | Infantry | Volley: +1 ☠ vs target already attacked this round |
| Field Lieutenant | 2 | 1/0 | 2/5 | 1/1 | Officer | Adjacent friendlies take −1 ☠. Activate: rally adjacent Broken |
| Sapper Team | 2 | 2/1 | 2/3 | 1/2 | Infantry | Dig In: skip attack to fortify own hex (cover) |
| Mortar Crew | 3 | 1/3 | 2/2 | 3/1 | Infantry | Indirect fire |
| Longshot Marksman | 2 | 3/1 | 1/2 | 3/1 | Infantry | Ignores cover; +1 range on high ground |
| Lancer Halftrack | 3 | 2/1 | 4/3 | 1/3 | Vehicle | Charge: moved 2+ → +2 ☠ |
| Bulwark Walker | 4 | 3/2 | 6/4 | 1/1 | Vehicle | Unflankable; adjacent Infantry count as in cover |
| Signal Marshal | 3 | 0/0 | 3/6 | 0/1 | Officer | End: Concord within 2 regain +1 ⚑ |
| Hammerfall Battery | 5 | 3/3 | 4/3 | 4/0 | Vehicle | Indirect; Barrage: 1 ☠ splash to all adjacent formations |

**Vhorr Brood**
| Card | Cost | ⚔/☠ | ♥/⚑ | Rng/Spd | Class | Ability |
|---|---|---|---|---|---|---|
| Skitterling Brood | 1 | 1/1 | 2/2 | 1/3 | Swarm | Stacks to 5 |
| Spore Pod | 1 | 0/0 | 3/3 | 0/0 | Structure | Creep around it; deploy point |
| Lashworm | 2 | 2/1 | 3/2 | 2/2 | Beast | Burrow: ignores zone of control |
| Howler | 2 | 0/2 | 2/2 | 1/2 | Beast | Shriek: hits all adjacent enemies with its ☠ |
| Mimic Swarm | 2 | 1/2 | 2/2 | 1/2 | Swarm | Infiltrate: deploy adjacent to any Creep |
| Synapse Warden | 3 | 1/2 | 4/5 | 1/1 | Synapse | Links Brood within 2 |
| Acid Spitter | 3 | 2/1 | 2/2 | 3/1 | Beast | Melts cover off target hex |
| Ravager | 4 | 4/2 | 5/3 | 1/2 | Beast | Frenzy: +1 ⚔ per other Brood adjacent to target |
| Hivemind Overseer | 5 | 2/2 | 5/6 | 2/1 | Synapse | Link range 3; Linked Brood +1 ⚔ |
| Gorgemaw | 5 | 4/4 | 8/3 | 1/1 | Beast | Devour: on kill, heal 3 and 2 ☠ to adjacent enemies |

**Hollow Lattice**
| Card | Cost | ⚔/☠ | ♥/⚑ | Rng/Spd | Class | Ability |
|---|---|---|---|---|---|---|
| Glasswing Drone | 1 | 1/1 | 1/2 | 1/4 | Drone | Flying; no Dissonance |
| Shardling Sentinel | 2 | 1/1 | 3/4 | 1/1 | Construct | Ward 1 |
| Cantor | 2 | 0/2 | 2/5 | 2/1 | Psion | Dirge: Shock ignores Support & officer auras |
| Fold Anchor | 2 | 0/0 | 4/4 | 0/0 | Structure | Ward 2; deploy point; counts as a triangle vertex |
| Prism Lancer | 3 | 3/1 | 2/3 | 3/1 | Construct | Ward 1; Resonant: also hits the formation behind target |
| Kinetic Warden | 3 | 2/1 | 4/4 | 1/1 | Construct | Ward 2; Repulse: push target 1; blocked → +2 ☠ |
| Null Sphere | 3 | 0/0 | 5/5 | 0/2 | Construct | Ward 2; enemy auras & links don't reach adjacent hexes |
| Echo Choir | 4 | 1/3 | 3/6 | 2/1 | Psion | End: Lattice within 2 +1 ⚑ |
| Requiem Engine | 5 | 2/2 | 5/5 | 3/1 | Construct | Ward 1; Disassemble: tears the bottom card off target stack |
| Hollow Colossus | 6 | 5/2 | 8/6 | 2/1 | Construct | Ward 3; ☠ doubled vs Shaken targets |

---

## 8. The gamble: Escalation (stakes)

Every match is played for **Glory** (ranked points; cosmetic in vs-AI).
- Stakes start at **1**.
- During Orders, each player may **Escalate** once per match. Stakes double at the **start of
  the next round** (so the opponent sees it coming and gets a round to react).
- Stakes also auto-double before the final round.
- At any time, a player may **Sound the Retreat**: they lose immediately, at the
  **current** stakes (before a pending escalation applies).
- Max stakes 8.

So you can bluff confidence, cut losses, and punish an opponent who escalates on
a board that's about to collapse.

---

## 9. Victory
- Reduce enemy Resolve to **0**, or
- After round 8, the higher Resolve wins (tie → more Relays → more cards on board → draw).

---

## 10. Presentation notes

- Card art is **text-free base images** (portrait 2:3). The client draws all
  numbers and frames as overlays (cost gem, ⚔/☠, ♥, ⚑, class pip, ability text).
- Art direction (original): painterly gritty military sci-fi, muted desaturated
  palette with one faction accent color, heavy atmosphere, dramatic rim light,
  propaganda-poster composition crossed with dark oil painting.
  - Concord: olive drab, rust, cream, signal-red accents.
  - Brood: bruised purples, bile green, wet chitin.
  - Lattice: obsidian, pale gold light, cracked porcelain/glass.

## 11. Open questions (to be answered by simulation/playtest)
- Starting Resolve (16?) vs game length. Target: most games end in rounds 6–8.
- Is break (−2) vs card death (−1) the right ratio to make morale the main route?
- Are Relays too swingy (CP *and* drain)?
- Does Brood shock immunity make them unbreakable near Synapses? (Watch Synapse-kill rate.)
