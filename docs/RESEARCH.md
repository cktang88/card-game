# Shatterline: Research Log

Every piece of research behind the design, with summaries and sources. Each section notes
the decisions it led to. Newest entries are at the bottom.

> Caveat that applies throughout: several sources are fan guides, forum threads or
> secondhand quotes. Where a claim was only the researching agent's own knowledge, it
> is marked **[unsourced]**.

---

## 1. What makes games fun (initial pass)

**Summary**
- Sid Meier: a game is "a series of interesting decisions." A choice only matters if the
  options differ meaningfully and the player understands their scope. Cosmetic variety
  does not count.
- Dominant strategies drain fun, because once found, no real choice remains.
- Too many options cause decision paralysis.
- Raph Koster, *Theory of Fun*: fun comes from mastering a skill.

**Decisions:** no dice; every rule must create a decision; keep options few but
meaningful; stacking vs spreading as a built-in trade-off.

**Sources**
- https://gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions
- https://medium.com/@doandaniel/gamedev-thoughts-the-power-of-meaningful-choices-in-game-design-50dbdeb0348a
- https://gamedeveloper.com/design/meaningful-choice-in-games-practical-guide-case-studies
- https://www.gamedeveloper.com/design/designing-interesting-decisions-in-games-and-when-not-to-
- https://creatinggames.press.plymouth.edu/?p=120

## 2. Marvel Snap

**Summary**
- Ben Brode's goal is elegance: depth without complexity. Snap has only one card type.
- Matches last about 3 minutes; reaching that length took a lot of playtesting.
- Simultaneous turns remove downtime and create mind games.
- The "Snap" stake-doubling mechanic is the clearest example of the game's elegant design.
- The game mixes randomness and skill, but the randomness is "output" randomness: you
  decide, then learn whether you were right.

**Decisions:**
- Hidden, simultaneous placement.
- Escalate (Snap) and Retreat (concede at current stakes).
- An 8-round cap.
- One line of text per card.

**Sources**
- https://cur.at/6yjBQb9?m=web (Behind the Design: Marvel Snap)
- https://www.gamedeveloper.com/game-platforms/designers-don-t-sleep-on-marvel-snap-s-simultaneous-turns
- https://www.gdcvault.com/play/1029024/Designing-MARVEL-SNAP
- https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/
- https://www.pressreader.com/usa/the-guardian-usa/20221112/282024741243323
- https://gamesbeat.com/ben-brode-bets-super-speed-will-make-marvel-snap-stand-out/
- https://gamesradar.com/marvel-snap-is-turning-the-entire-multiverse-into-a-chaotic-card-game-where-bluffing-is-half-the-battle
- https://toucharcade.com/2023/05/05/marvel-snap-gdc-2023-talk-ben-brode-inspiration-design-complexity-iphone-android-youtube/

## 3. Wargame morale mechanics

**Summary**
- The classic tactical morale check: a unit tests against its rating when something
  triggers it. Failure leads to disruption, suppression, retreat or rout.
- Some modern sci-fi rule sets prefer suppression over binary "OK / run away" morale.
- Fatigue-threshold systems, where a unit routs once accumulated fatigue passes a
  threshold, avoid dice entirely.
- Combine a few mechanics rather than all of them.

**Decision:** Nerve is a deterministic fatigue pool. Shock lowers it; at 0 the unit breaks.

**Sources**
- https://lerugray.github.io/wargame-design-book/chapter_11.html
- https://wargamingweekly.substack.com/p/how-should-we-model-morale-in-wargaming
- https://www.bgdf.com/forum/game-creation/mechanics/turn-system-morale-system-and-more
- https://grogheads.com/featured-posts/11300
- https://www.wtj.com/games/1916/rule_morale.htm

## 4. Art references: Infinity Wars, Gwent, KARDS, 40k (agent report)

**Summary**
- **Infinity Wars:** clean, saturated digital painting. One character in a heroic
  low-angle pose with a strong silhouette, simple glowing backgrounds, rim light and
  emissive glows. Built for animated cards. Some art was AI-assisted, then painted over.
- **Gwent:** oil-painting feel with soft edges and a muted earthy palette. Moody
  chiaroscuro lighting; portrait framing with gazes out of frame; one symbolic prop;
  fog hiding the background.
- **KARDS:** licensed WWII propaganda posters plus 1970s–80s model-kit box art. Low
  heroic angles, diagonal light rays, a limited ink-like palette, a dominant silhouette.
- **40k grimdark:** gothic industrial decay with skulls, cables, incense and embers.
  Dirty restricted palette with blood-red or glow accents; monumental scale contrast.
- **Readable at card size:** one subject, value contrast first, focal point in the
  middle band, top 18% and bottom 28% kept quiet for the UI overlay, rim light, one accent
  colour.

**Decisions:** the style suffix, negative list and per-faction visual bibles in
`docs/ART_DIRECTION.md`.

**Sources**
- https://www.playgwent.com/en/news/38255/secrets-of-card-art-design-with-lorenzo-mastroianni
- https://www.pcgamer.com/it-all-started-with-a-gif-of-a-cat-how-gwent-went-from-minigame-to-gorgeous-standalone-ccg
- https://www.pcgamer.com/anna-podedwornas-art-brings-the-world-of-the-witcher-to-life
- https://www.creativebloq.com/features/the-witcher-art-behind-the-scenes-at-cd-projekt-red
- https://en.wikipedia.com/wiki/Kards
- https://www.gamereactor.eu/playing-kards-the-wwii-card-game-with-1939-games/
- https://www.denofgeek.com/us/games/pc-gaming/284930/kards-game-preview-impressions
- https://creativemarket.com/blog/propaganda-graphic-design
- https://infinity-wars.fandom.com/wiki/Category:Artist-_Pat_Boiteux
- https://hardcoregamer.com/previews/reforming-digital-trading-card-games-with-infinity-wars/79600/
- https://store.steampowered.com/app/257730
- https://www.warhammerart.com/pages/the-evolution-of-warhammer-art-styles
- https://aesdes.org/2025/01/22/the-grim-darkness-of-the-far-future-a-look-into-the-aesthetic-of-warhammer-40k
- https://www.grimdarkmagazine.com/warhammer-40k-an-inspiration-rich-environment-for-artists/

## 5. Warhammer 40k faction design and morale; Infinity Wars factions (agent report)

**40k archetypes:** every faction is one idea pushed to an extreme, readable from its
silhouette and its army rule.

| Archetype | Mechanical identity (10th edition) | One-line fantasy |
|---|---|---|
| Imperial Guard | Officers issue Orders to nearby squads; cheap mass infantry plus tanks | "Hold the line; there are always more of us" |
| Space Marines | Oath of Moment: re-roll hits against one marked target | "Few, perfect and fearless" |
| Tyranids | Synapse creatures; Shadow in the Warp forces enemies to test morale | "Endless hunger that thinks as one" |
| Necrons | Reanimation Protocols bring models back | "You can't kill what was never alive" |
| Orks | Waaagh!: one huge momentum turn | "Winning makes us winnier" |
| Aeldari | Battle Focus: move-shoot-move tricks | "A dying race fighting with grace" |
| Drukhari | Power from Pain; strike and vanish | "Feed on suffering" |
| Chaos | Dark Pacts: power at a price | "Power at a price" |
| Tau | Spotter units mark targets for the gunline | "Precision firepower, coordinated" |
| Genestealer Cults | Cult Ambush: hidden infiltration | "They were among you all along" |

**40k morale history**
- **10th-edition Battle-shock:** a unit that fails loses objective control and can't
  receive stratagems. Players like that it matters for scoring without deleting models.
  They dislike that it's a binary state, and that armies which can force the test spike in power.
- **Older editions (fall back and regroup):** cinematic, but involved bookkeeping, and
  Fearless units made the system moot.
- **7th–9th editions:** morale was reduced to extra casualties and widely called useless.
- **Lesson:** morale must change what a unit can do, and each faction should bend the
  rules rather than switch them off.

**Infinity Wars**
- Simultaneous turns with initiative.
- You win by reducing the enemy's **Health OR Morale** to 0 (both start at 100).
- Factions and their obvious goals:
  - Flame Dawn: aggressive swarm.
  - Genesis Industries: combine into giants.
  - The Warpath: bruisers.
  - Cult of Verore: units grow by killing.
  - Descendants of the Dragon: stall and win by Morale.
  - Sleepers of Avarrach: raise dead enemies as Undead.
  - The Exiles: sacrifice.
  - Later additions: Zombies, Monks.

**Suggestions adopted**
- Brood **evolve**.
- Feral Brood hit harder (v0.2; removed in v0.3).
- Hush **break morale without killing** (the Dread archetype).
- A single readable mechanic per faction.

**Backlog factions:** Ossuary Engines (husks rebuild), Choir of the Pyre (zeal rises as
allies die), Grukkan Surge (momentum).

**Sources**
- https://wahapedia.ru/wh40k10ed/the-rules/quick-start-guide
- https://goonhammer.com/goonhammer-reviews-warhammer-40000-10th-edition-part-2-playing-the-game
- https://www.goonhammer.com/hammer-of-math-tyranids-and-battle-shock
- https://spikeybits.com/10th-edition-40k-core-rules-command-phase-battle-shock-tests-warhammer/
- https://wahapedia.ru/wh40k10ed/factions/astra-militarum
- https://wahapedia.ru/wh40k10ed/factions/necrons
- https://www.wahapedia.ru/wh40k10ed/factions/orks
- https://www.belloflostsouls.net/?p=187193
- https://www.goonhammer.com/hammer-of-math-9th-edition-morale-and-attrition/
- https://frontlinegaming.org/2017/05/03/newhammer-40k-morale/?amp=1
- https://www.tentonhammer.com/infinity-wars/guides/beginners-guide
- https://mmobomb.com/news/infinity-wars-debuts-campaigns-zombie-monk-factions
- https://store.steampowered.com/app/257730

## 6. Adversarial debate: how much unit control? (3 agents)

### 6a. Pure auto-resolve advocate
**Thesis:** remove the activation phase. Players choose a card, a hex and the stakes.
Combat should be deterministic and telegraphed.

**Evidence**
- **Stormbound:** grid board, units auto-advance and auto-attack; depth comes from placement.
- **Snap:** no combat phase at all.
- **Mechabellum:** placement-only, praised as deeply tactical.
- **Into the Breach:** telegraphed intents make every loss feel like your own fault.
- **Hearthstone:** most attack choices are forced, so they are clicks rather than decisions.

**Proposal:** fixed facing, a front arc, auto-advance toward Relays, simultaneous
strikes, a lowest-Nerve targeting priority, and flank bonuses. Clever play becomes
placement: diagonals, pre-placing in the enemy's path, decoys, closing escape hexes.

### 6b. Minimal-command advocate
**Thesis:** auto combat plus 1–2 hidden Orders per round (Charge / Hold / Fall Back / Focus).

**Evidence**
- Combat Commander: limited order cards.
- KARDS: actions cost Kredits.
- Runeterra: one attack token per round.
- Battle Brothers: players accept harsh morale losses when they own the mistake.

**Warning:** pure auto-advance only works on lane boards.

### 6c. Red-team critic
**Case studies**
- Stormbound and Inscryption: placement-only works when targeting is readable.
- Artifact: random arrows were poison; 2.0 removed them.
- Battlegrounds: an opaque combat algorithm.
- Mechabellum: risk of players becoming spectators.
- KARDS: per-action cost adds arithmetic.
- Duelyst, Faeria, Mythgard: manual tactics are loved, but the audience stayed niche.
  Faeria matches ran 30 minutes.

**Failure modes**
- Auto-resolve: spectator syndrome, opaque resolution, "unearned routs", solved placement.
- Orders: they become a tax, players must learn two rulebooks, timing disputes arise.
- Full control: too slow, analysis paralysis.

**Design tests**
- A player can predict a unit's target in 3 seconds.
- A player can explain every hit after the fact.
- Zero randomness in targeting.
- Preview before committing.
- At least 3 meaningful placements per round.
- Position changes results.
- Every rout traces back to a player's decision.
- Resolution takes under 15 seconds per round.
- Faction identity shows in placement.
- A player down a Relay at round 5 still wins at least 25% of the time.

**Recommendation:** auto-resolve, all decisions made at placement. Orders appear only as
cards that cost the same resource as units. Get deterministic targeting and its preview right.

### Decision (v0.2)
Auto-resolve with intent arrows. Orders exist only as Tactic cards.
(v0.3 goes further and removes movement entirely; see §8.)

**Sources (all three agents)**
- https://stormbound-kitty-fsuggqadj-stormbound.vercel.app/guides/beginner
- https://www.supercheats.com/stormbound-kingdom-wars/walkthrough/how-do-units-attack
- https://player.one/stormbound-kingdom-wars-guide-battle-deck-cards-120360
- https://statelyplay.com/2017/09/27/review-stormbound/
- https://statelyplay.com/2017/10/06/strategy-101-stormbound-basics-edition/
- https://mobilesyrup.com/2018/12/15/stormbound-kingdom-wars-hearthstone-chess-review/
- https://toucharcade.com/2017/09/22/stormbound-first-impressions-tactical-and-smart-but-long-matches/
- https://www.levelwinner.com/?p=91232
- https://www.dbltap.com/reviews/mechabellum-review
- https://www.pcgamer.com/i-cant-stop-playing-this-autobattling-strategy-masterpiece
- https://en.wikipedia.org/wiki/Mechabellum
- https://gamebrain.co/game/mechabellum
- https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and
- https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-
- https://www.gdcvault.com/play/1026333/contactUs
- https://www.gdcvault.com/play/1025772/
- https://www.popmatters.com/182503-the-change-economics-wrought-on-design-a-study-of-magic-and-hearthst-2495653503.html
- https://wasitanyfun.blogspot.com/2022/05/hearthstones-rules.html
- https://www.pcgamer.com/duelyst-review/
- https://www.gosugamers.net/hearthstone/features/43295-beyond-hearthstone-on-the-battlegrid-with-duelyst-and-faeria
- https://www.gameshub.com/news/features/duelyst-the-rise-fall-rebirth-of-hearthstone-killer-12451/
- https://www.pcgamer.com/duelyst-to-shut-down-servers-forever
- https://www.pcgamer.com/uk/artifact-20-is-less-complicated-but-is-it-a-better-game
- https://lesswrong.com/posts/DTravCjZCWbbQC8YG/review-artifact
- https://destructoid.com/?p=240883
- https://eu.forums.blizzard.com/en/hearthstone/t/battlegrounds-combat-algorithm-is-so-bad/9664
- https://us.forums.blizzard.com/en/hearthstone/t/red-whelp-in-battlegrounds/25306
- https://keithburgun.net/hsbg-end/
- https://kards.com/how-to-play
- https://earlyguides.com/kards-the-wwii-card-game/combat
- https://gamingtrend.com/reviews/this-is-my-rifle-this-is-my-deck-kards-the-wwii-card-game-review
- https://www.cubed3.com/games/reviews/pc/faeria-3
- https://boards.faeria.com/t/im-worried-about-faeria/12050
- https://steamdb.info/app/397060/charts
- https://quartertothree.com/fp/?p=51763
- https://www.gamedeveloper.com/design/how-game-jam-sacrifices-became-inscryption
- https://rulespal.com/combat-commander-europe/rulebook
- https://mobalytics.gg/blog/legends-of-runeterra-guide/
- https://www.pcgamer.com/uk/with-legends-of-runeterra-riot-wants-to-overhaul-the-crowded-card-game-market
- https://battlebrothersgame.com/?p=883
- https://steamcommunity.com/app/365360/discussions/0/3158630999998210776
- https://gog.com/forum/general/gwent_the_positioning_update_c62fb/page2
- https://gamespot.com/reviews/gwent-review-heart-of-the-cards/1900-6417024/
- https://www.gamesradar.com/games/subnautica-2-publisher-says-the-studios-previous-game-was-a-failure-a-strategy-game-thats-nothing-like-subnautica-and-peaked-at-under-1-000-steam-players

## 7. Image generation pipeline test

- OpenRouter lists `openai/gpt-image-2.6-sunburst` (detail) and `openai/gpt-image-2.6-flare`
  (speed) under the `/api/v1/images` endpoint. The body is OpenAI-compatible
  (`model`, `prompt`, `size`, `n`) and the response returns `data[0].b64_json`.
- A test call with flare at 1024×1024 returned a PNG for about $0.025.
- No card art has been generated yet, by design.

## 8. Simulation findings (balance log)

All runs use the greedy AI in `src/shared/ai.ts`. It plans by simulating the round
and assumes the opponent plays nothing.

| Version | Finding | Change |
|---|---|---|
| v0.1 | Hush won 76% (ambush plus untargetable plus free regroup) | Hush vanish returns the Lead to hand instead of regrouping; cloaks are spotted on contact |
| v0.1 | Kills were 39% of Resolve loss, morale only 28% | A wipe-out panics neighbours; break cost raised to 3 |
| v0.2 | Unlinked Brood with double Shock were far too weak (22%) | Removed the double Shock |
| v0.2 | Rumor-Wright (cheap, cloaked, ranged, ignores support) carried Dread to 78% (ablation) | Power 2 → 1, lost Silent |
| v0.2 | Tokens cost Resolve; cheap decks ran out of cards | Tokens cost no Resolve; draw 2 per round |
| v0.2 | Final: archetypes 37–59%; morale 47% of Resolve loss | — |
| v0.3 | Movement, regrouping, LOS, front arcs, Shaken, heavies and siege removed for simplicity | See GAME_DESIGN §12 |

## 9. TCG card-design patterns: Infinity Wars, Snap, Gwent, KARDS, Runeterra, Hearthstone (agent report)

**Infinity Wars keywords**
- Every card has a morale cost, lost when it is *Destroyed*. *Removed* and *Sacrificed* cards cost no morale.
- Infect: kills come back as undead under your control.
- Raise.
- Consume X: grows on a kill.
- Bloodthirst.
- Lives X.
- Barrier/Shield.
- Garrison: a wall that never attacks.
- Flame Strike: delayed damage.
- Deadly.
- Recall.
- Ascended.
- Overcharge.
- Flying/Reach.
- Preemptive.
- Card names carry the faction goal: Wall, Shieldbearer, Rally, Pacify; Thrall, Spawn.

**Marvel Snap**
- Only two text types: On Reveal (timing skill) and Ongoing (an aura you build around).
- One or two short lines of text; vanilla cards get flavour text.
- Movement is a capped, premium exception.

**Gwent**
- Deploy vs Order (an Order can't be used the turn it lands, unless the card has Zeal).
- Row tags.
- One number plus one ability gives a card its niche.
- Range lesson: Reach 1 was nearly unplayable, Reach 2 was effectively unrestricted.

**KARDS**
- Unit types: Infantry, Tank, Artillery, Fighter, Bomber.
- Guard protects adjacent allies; Artillery and Bombers ignore it.
- Smokescreen.
- Ambush.
- Blitz.
- Fury.
- Heavy Armor X (capped).
- Names are short military nouns that double as the rule.

**Runeterra / Hearthstone**
- Elusive.
- Challenger.
- Fearsome.
- Tough.
- Last Breath / Deathrattle.
- Taunt.

**Patterns adopted in v0.3**
- Guard, and Artillery that ignores Guard and cover.
- Armor (−1 damage).
- Cleave, Splash, Terror.
- Infect: Nightmaw Leech raises a Skitterling from a unit it breaks.
- Last Breath: Skinwalker Mimics burst into Skitterlings.
- On Reveal effects: fortify, nightmare, echo, mirage, shove.
- Lethal vs Shock as a clear split between "killer" and "breaker".
- Breach (+2 vs Fearless and cover) as the counter to unbreakables.
- One premium mover: the Ram-Track's shove.
- Capped growth.

**Niche checklist (applied in docs/CARDS.md)**
- One keyword or trigger.
- A unique stat/range cell within its faction.
- Names its counter.
- Decidable from the visible board.
- Creates a decision for the opponent.
- Has a reason to play it early or late.
- Has a deliberate stance on stacking.
- Its name evokes the rule.

**Anti-patterns avoided**
- Text over 15 words.
- Stacked conditionals.
- Hidden counters.
- Reveal-order dependence.
- Unbounded growth.
- A unit that is both untargetable and unhittable: Cloak can still be hit by adjacent units and Artillery.
- Keyword bloat.

**Sources**
- https://infinitywars.wiki.gg/wiki/Keywords
- https://infinitywars.wiki.gg/wiki/Cult_of_Verore
- https://infinitywars.wiki.gg/wiki/Descendants_Of_The_Dragon
- https://www.tentonhammer.com/guides/beginner-s-guide-to-infinity-wars.amp
- https://www.kards.com/news/homefront-combat-keywords
- https://kards.com/how-to-play
- https://www.kards.com/kards-academy
- https://progameguides.com/marvel-snap/how-do-on-reveal-and-ongoing-abilities-work-in-marvel-snap/
- https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/
- https://www.gdcvault.com/play/1029024/Designing-MARVEL-SNAP
- https://pcgamer.com/former-hearthstone-boss-says-marvel-snap-is-going-to-be-the-biggest-card-game-of-all-time
- https://gwent.fandom.com/wiki/Drain
- https://www.gamerevolution.com/guides/574863-gwent-update-3-1-patch-notes
- https://support.riotgames.com/legends-of-runeterra/gameplay/keywords-and-game-vocab-legends-of-runeterra
- https://wiki.leagueoflegends.com/en-us/Keywords_(Legends_of_Runeterra)
- https://hearthstone.wiki.gg/wiki/Keywords

**Caveats**
- KARDS rules text came from search snippets and fan wikis.
- The Infinity Wars faction identities were inferred from card names.
- The Stormbound and Snap prediction-card notes are the agent's own knowledge.

## 10. v0.3 simplification: simulation log

| Step | Result | Change |
|---|---|---|
| First v0.3 run | Concord 13%, Synapse 81%. Relays were 48% of Resolve loss; most games went to time | — |
| Synapse range 2 → adjacent | Concord 23% | Kept |
| Relays: 1 per relay → majority drains 1; Infiltrate 3 → 2 | Morale 49%, relays 26%. Infiltrate had let Brood and Hush grab a Relay on turn 1 | Kept |
| Starting Resolve 15 → 10 → 9 | Fewer timeouts | Kept |
| Firing Line (3 in a row) → Shoulder to Shoulder (next to 2+ allies) | Easier to read and to trigger | Kept |
| Hush Vanish off (ablation) | Hush 70% → 45% | Cut |
| Unified Fearless (linked Brood take Shock as damage); Battery gains Lethal; Breach works vs Fearless | Concord 43–51%, Synapse 53% | Kept |
| Decoys no longer Shock on vanishing; Herald Power 3 → 2; Brood Nerve +1 on five cards | Brood back up, Hush down | Kept |
| Skitterling Power 1 → 2; tiebreak on Relays at time | Tide 46% | Kept |
| Faceless cost 5 → 4; Night of Knives +2 → +3 | Final: factions 46 / 50 / 46; archetypes 41–62% | — |
