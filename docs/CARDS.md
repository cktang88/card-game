# Shatterline: Card List & Niche Review

_Generated from `src/shared/cards.ts` by `npm run cards`. Do not edit by hand._

Every card must answer one question: **where do I want to be placed, and why?** That answer is the "niche" column. Review checklist (from docs/RESEARCH.md §9):

- One keyword or trigger, one line of text.
- Its Cost/Power/Nerve/Range combination is unique within the faction.
- It names its counter (another card or a positional answer).
- Its outcome is decidable at reveal from visible board state.
- It serves an archetype and reads as its faction from name and text alone.

## Global keywords

- Lethal: deals damage to Power instead of Shock to Nerve.
- Hunter: strikes the enemy Back row first.
- Guard: strikes aimed at the allies beside it hit the Guard instead.
- Artillery: ignores Ruins and Guard.
- Armor: takes 1 less damage.
- Fearless: never breaks; Shock hits it as damage instead.
- Raider: +2 on rear strikes.
- Cleave: also strikes the enemies beside its target.
- Splash: also Shocks the enemies beside its target by 1.
- Terror: +2 against units at half Nerve or less.
- Synapse: Brood beside, in front of or behind it are Fearless.

## Concord Vanguard

_Hold the line. Rows of rifles, officers and armour._

**Faction rules:** Hold the Line: Concord Front units cannot be Flanked. Drilled: regains up to 3 Nerve per round from the allies around it (others: up to 2).

**Archetypes:** Gunline: ranked riflemen and officers · Bastion: walls, cover and artillery · Iron Tide: armour that bulldozes

| Card | Cost | Power | Nerve | Range | Class | Text | Niche | Archetypes |
|---|---|---|---|---|---|---|---|---|
| **Dustcoat Fusiliers** | 1 | 2 | 4 | melee | Infantry | Third Ashline Regiment. Never broke. | Cheapest body to fill out a tight formation or plug a gap. | gunline, bastion |
| **Ashline Riflemen** | 2 | 2 | 3 | 2 | Infantry | Volley: +1 if another ally strikes the same target. | Rewards lining several shooters up on one enemy. | gunline |
| **Whistle-Lieutenant** | 2 | 1 | 4 | melee | Officer | Officer: adjacent allies strike +1. | Place in the middle of your line; the enemy wants it dead first. | gunline, iron |
| **Colour Sergeant Hale** | 3 | 2 | 6 | melee | Officer | Standard: adjacent allies take 1 less Shock. | Anchors a shaky line so it does not panic-cascade. | gunline, bastion |
| **"Widow" Varn, Longshot** | 3 | 2 | 2 | 3 | Infantry | Lethal. Hunter: shoots the enemy Back row first. | Picks off the big expensive threat from far back; fragile if reached. | gunline |
| **Mole Brigade Sappers** | 2 | 2 | 3 | melee | Infantry | On Reveal: dig in. Its column becomes Ruins (ranged strikes into it −1). | Turns a contested column into Ruins, blunting enemy fire for the rest of the game. | bastion |
| **Iron Shieldwall** | 2 | 1 | 6 | melee | Infantry | Guard: strikes aimed at the allies beside it hit it instead. | Soaks the hits meant for your officers and snipers. | bastion |
| **Bastion Pillbox** | 2 | 3 | 0 | 2 | Structure | Fearless: Shock hits it as damage. | An unbreakable gun that plugs a column; only damage removes it. | bastion |
| **Rainmaker Mortar Team** | 3 | 2 | 2 | 3 | Infantry | Splash: also Shocks the enemies beside its target by 1. | Punishes enemies that clump together. | bastion |
| **Hammerfall 380 Battery** | 5 | 3 | 3 | 4 | Vehicle | Artillery: ignores Ruins and Guard. Lethal. | The answer to walls, Guards and dug-in enemies, from anywhere. | bastion |
| **Lancer Ram-Track** | 2 | 4 | 4 | melee | Vehicle | On Reveal: rams the enemy Front unit opposite one column aside. If it can’t move, 2 Shock. | The rare mover: shoves the enemy unit opposite aside to open a breach, or crushes it against its neighbours. | iron |
| **Bulwark Mk.III Walker** | 4 | 6 | 5 | melee | Vehicle | Armor: takes 1 less damage. | Shrugs off snipers and acid. Spearheads a push. | iron, bastion |
| **Iron Saint Siege-Crawler** | 5 | 6 | 6 | 2 | Vehicle | Breach: +2 against Fearless units and units in cover. | Cracks fortresses and unbreakable swarms. | iron |
| **Over the Top!** | 1 | – | – | – | Tactic | Target ally strikes +3 this round. | Turns one strike into a break, the round you need it. | iron, gunline |
| **Loudhorn Broadcast** | 2 | – | – | – | Tactic | Target ally and the allies around it regain 3 Nerve. | The rally: saves a line that is about to break. | gunline, bastion, iron |

## Vhorr Brood

_Swarm & evolve. Fearless while linked; every bite makes them bigger._

**Faction rules:** One Organism: Swarms and Beasts count as one class for column hands. Flood: a Brood unit In Breach flanks for +2 instead of +1. Synapse Link: Brood around a Synapse are Fearless. Evolve: a Brood unit that strikes gains +1 Power (max +3).

**Archetypes:** Endless Tide: drown them in bodies · Apex: feed a monster · Synaptic Terror: linked, unbreakable horrors

| Card | Cost | Power | Nerve | Range | Class | Text | Niche | Archetypes |
|---|---|---|---|---|---|---|---|---|
| **Skitterling Tide** | 1 | 2 | 2 | melee | Swarm | Swarm: stacks up to 5. | Bodies for flanking bonuses, or one huge stacked swarm. | tide |
| **Sporemother Pod** | 2 | 3 | 0 | none | Structure | Each round: hatches a Skitterling beside it (max 2 alive). | A nest to protect; kill it early or drown in bugs. | tide |
| **Skinwalker Mimics** | 2 | 2 | 3 | melee | Swarm | Last Breath: bursts into 2 Skitterlings. | Breaking it only makes more of them. | tide |
| **Gnasher Pack** | 2 | 1 | 3 | melee | Beast | Pack: +1 for each adjacent ally. | Wants to be buried in the middle of the swarm. | tide, apex |
| **Broodling Grub** | 1 | 1 | 3 | melee | Beast | Each round: grows +1 Power (max +3). | Play early, hide it behind the swarm, let it become a monster. | apex |
| **Lashworm Burrower** | 2 | 2 | 3 | 2 | Beast | Hunter: bursts up under the enemy Back row first. | Pops up behind their line to hit their backline. | apex, synapse |
| **Acidbelly Spitter** | 3 | 2 | 3 | 3 | Beast | Lethal: its acid deals damage, not Shock. | Kills the unbreakables: structures, officers, armour. | apex |
| **Scythe Ravager** | 4 | 4 | 4 | melee | Beast | Cleave: also strikes the enemies beside its target. | Drop it into the middle of their line. | apex, tide |
| **The Gorgemaw** | 6 | 7 | 5 | melee | Beast | Drain: heals 2 every time it strikes. | The apex: wins a straight fight against anything. | apex |
| **Thoughtstalk Warden** | 2 | 2 | 5 | melee | Synapse | Synapse: Brood beside, in front of or behind it are Fearless. | Makes the swarm around it unbreakable. Kill it and they can panic again. | synapse, tide |
| **Throat-Sac Howler** | 2 | 2 | 3 | melee | Beast | Terror: +2 against units at half Nerve or less. | Finishes off wavering units. | synapse |
| **Nightmaw Leech** | 3 | 2 | 3 | 2 | Beast | Infect: each enemy it breaks rises as a Skitterling in your line. | Turns their losses into your swarm. | synapse, tide |
| **Overmind Aspect** | 5 | 3 | 5 | 2 | Synapse | Synapse. Linked Brood strike +1. | The army-wide upgrade; the enemy must go through the swarm to reach it. | synapse |
| **Frenzy Pheromone** | 2 | – | – | – | Tactic | Target ally and the allies around it strike +2 this round. | Swarm-wide surge for the decisive round. | tide, apex |
| **Psychic Scream** | 2 | – | – | – | Tactic | Enemy Front units in target ally’s column and the columns beside it take 2 Shock. | Shatters whatever is pressed against your swarm. | synapse |

## The Hush

_Unseen. Cloaks, decoys and ambush._

**Faction rules:** Cloak: arrives cloaked; ranged units cannot target it (their shots fall through to the unit behind). Being struck reveals it. Ambush: its first strike from cloak is +1, then it is revealed.

**Archetypes:** Phantom Host: decoys and bluffs · Night of Knives: ambush and assassinate · Dread: break them without a fight

| Card | Cost | Power | Nerve | Range | Class | Text | Niche | Archetypes |
|---|---|---|---|---|---|---|---|---|
| **Phantom Echo** | 1 | 1 | 1 | none | Illusion | Decoy: when struck it pops and the striker takes 1 Shock. Fades after a round. Costs no Resolve. | A cloaked bluff the enemy must waste effort on. | phantom |
| **Shroud Lantern** | 2 | 3 | 0 | none | Structure | Each round: re-cloaks the Hush units around it. | A base that resets your ambushes every round. | phantom, knives |
| **Mirage Weaver** | 3 | 1 | 4 | 2 | Psion | On Reveal: conjures 2 Phantom Echoes beside it. | Turns one placement into three cloaked threats. | phantom |
| **Echo-Twin Operatives** | 2 | 2 | 3 | melee | Operative | On Reveal: a Phantom Echo appears beside them. | Two cloaked threats for one card: which is real? | phantom, knives |
| **Smoke & Mirrors** | 1 | – | – | – | Tactic | Target ally re-cloaks and a Phantom Echo appears beside it. | Re-arms an ambush. | phantom, knives |
| **Hushblade Initiates** | 1 | 2 | 2 | melee | Operative | They are already behind you. | Cheap ambusher: 3 Shock out of nowhere for 1 Command. | knives |
| **Glasswalk Stalkers** | 2 | 2 | 3 | melee | Operative | Fade: re-cloaks each round if nothing faces it. | Hit, step back into the dark, ambush again. | knives |
| **Quiet Needle** | 3 | 2 | 2 | 3 | Operative | Lethal. Silent: striking never reveals it (but it gets no ambush bonus). | An invisible sniper; find it by walking into it. | knives |
| **Nightglass Skiff** | 3 | 3 | 3 | melee | Vehicle | Raider: +2 on rear strikes. | Strikes deep behind their lines. | knives |
| **The Faceless** | 4 | 4 | 4 | melee | Operative | Hunter. Its ambush is Lethal against Officers and Synapses. | Decapitation: kills the unit their army leans on. | knives |
| **Night of Knives** | 2 | – | – | – | Tactic | All your cloaked units strike +3 this round. | One coordinated massacre. | knives |
| **Rumor-Wright** | 2 | 1 | 3 | 2 | Operative | Its Shock ignores Standards and other auras. | Gets around officers and standards. | dread |
| **Hollow Choir** | 3 | 1 | 4 | melee | Psion | Each round: the enemy units facing it take 1 Shock. | Slowly unravels anything that stands next to it. | dread |
| **Dread Herald** | 4 | 2 | 4 | 2 | Psion | On Reveal: enemies in its column and the columns beside it take 1 Shock. | Softens a whole cluster before the knives go in. | dread |
| **False Orders** | 2 | – | – | – | Tactic | Target enemy loses its ability and strikes −2 this round. | Switches off their key piece (Synapse, Guard, Officer) for a round. | dread, phantom |
