export type Faction = 'concord' | 'brood' | 'hush';

export type UnitClass =
  | 'Infantry' | 'Vehicle' | 'Officer'
  | 'Beast' | 'Swarm' | 'Synapse'
  | 'Operative' | 'Psion' | 'Illusion'
  | 'Structure' | 'HQ' | 'Tactic';

/** Keywords. Global ones (any faction) are listed first. Each card carries ONE
 *  keyword/trigger (a few have a passive + range icon). */
export type Keyword =
  // global
  | 'lethal'       // deals damage to Power instead of Shock to Nerve
  | 'hunter'       // strikes the enemy Back row first
  | 'guard'        // strikes aimed at the allies beside it hit it instead
  | 'artillery'    // ignores Ruins and Guard
  | 'armor'        // takes 1 less damage
  | 'fearless'     // no Nerve: Shock hits it as damage (structures, linked Brood)
  | 'raider'       // +2 on rear strikes
  | 'cleave'       // also strikes the enemies beside its target
  | 'splash'       // also Shocks the enemies beside its target by 1
  | 'terror'       // +2 against units at half Nerve or less
  | 'hq'
  // concord
  | 'volley' | 'officer' | 'standard' | 'fortify' | 'shove' | 'breach'
  // brood
  | 'swarm' | 'hatch' | 'pack' | 'grow' | 'synapse' | 'overmind' | 'infect' | 'burst' | 'drain'
  // hush
  | 'decoy' | 'shroud' | 'mirage' | 'echo' | 'fade' | 'silent' | 'assassin' | 'dirge' | 'dread' | 'nightmare';

export type Archetype = string;

export type TacticKind = 'power' | 'powerArea' | 'nerve' | 'scream' | 'silence' | 'cloak' | 'knives' | 'shell';
export interface TacticEffect { kind: TacticKind; n: number; target: 'ally' | 'enemy' }

/** Every unit card shows three numbers: Cost, Power, Nerve.
 *  Power – how hard it hits AND how much damage it can take.
 *  Nerve – morale. Shock lowers it; at 0 the unit breaks and leaves the battle.
 *  Range is an icon (default: melee). Units never move unless a card says so. */
export interface CardDef {
  id: string;
  name: string;
  faction: Faction;
  cost: number;
  power: number;
  nerve: number;
  range?: number;   // 0 = never strikes, 1 melee (default), 2+ ranged
  cls: UnitClass;
  keywords: Keyword[];
  tactic?: TacticEffect;
  arch: Archetype[];
  /** One line of rules text. */
  text: string;
  /** Why this card exists: the placement question it answers. */
  niche: string;
  art: string;
}

export const rangeOf = (d: CardDef) => d.range ?? 1;
export const isTactic = (d: CardDef) => d.cls === 'Tactic';

const c = (d: CardDef) => d;

export const CARDS: CardDef[] = [
  // ═══════════════ CONCORD VANGUARD: "Hold the line" ═══════════════
  // Faction rule: SHOULDER TO SHOULDER: a Concord unit next to 2+ allies strikes +1.
  // Archetypes: GUNLINE (rows of rifles + officers) · BASTION (walls, cover, artillery) · IRON TIDE (armour that bulldozes)
  c({ id: 'c_trooper', name: 'Dustcoat Fusiliers', faction: 'concord', cost: 1, power: 2, nerve: 4, cls: 'Infantry', arch: ['gunline', 'bastion'],
    keywords: [], text: 'Third Ashline Regiment. Never broke.',
    niche: 'Cheapest body to fill out a tight formation or plug a gap.',
    art: 'a squad of weary fusiliers standing shoulder to shoulder in a muddy trench line, bayonet rail-rifles raised' }),
  c({ id: 'c_rifles', name: 'Ashline Riflemen', faction: 'concord', cost: 2, power: 2, nerve: 3, range: 2, cls: 'Infantry', arch: ['gunline'],
    keywords: ['volley'], text: 'Volley: +1 if another ally strikes the same target.',
    niche: 'Rewards lining several shooters up on one enemy.',
    art: 'a kneeling rifle section firing a coordinated volley, muzzle flashes and ash falling' }),
  c({ id: 'c_lieutenant', name: 'Whistle-Lieutenant', faction: 'concord', cost: 2, power: 1, nerve: 4, cls: 'Officer', arch: ['gunline', 'iron'],
    keywords: ['officer'], text: 'Officer: adjacent allies strike +1.',
    niche: 'Place in the middle of your line; the enemy wants it dead first.',
    art: 'a scarred young officer with a whistle in their teeth and a pistol raised, waving soldiers forward out of the smoke' }),
  c({ id: 'c_sergeant', name: 'Colour Sergeant Hale', faction: 'concord', cost: 3, power: 2, nerve: 6, cls: 'Officer', arch: ['gunline', 'bastion'],
    keywords: ['standard'], text: 'Standard: adjacent allies take 1 less Shock.',
    niche: 'Anchors a shaky line so it does not panic-cascade.',
    art: 'a broad-shouldered sergeant planting a tattered battle standard into the mud, bullets cracking past, refusing to move' }),
  c({ id: 'c_marksman', name: '"Widow" Varn, Longshot', faction: 'concord', cost: 3, power: 2, nerve: 2, range: 3, cls: 'Infantry', arch: ['gunline'],
    keywords: ['lethal', 'hunter'], text: 'Lethal. Hunter: shoots the enemy Back row first.',
    niche: 'Picks off the big expensive threat from far back; fragile if reached.',
    art: 'a lone hooded sniper lying prone on a ruined gantry with an extremely long rail rifle, scope glint, scrap-cloth camouflage' }),
  c({ id: 'c_sapper', name: 'Mole Brigade Sappers', faction: 'concord', cost: 2, power: 2, nerve: 3, cls: 'Infantry', arch: ['bastion'],
    keywords: ['fortify'], text: 'On Reveal: dig in. Its column becomes Ruins (ranged strikes into it −1).',
    niche: 'Turns a contested column into Ruins, blunting enemy fire for the rest of the game.',
    art: 'three combat engineers crouched mid-action, shovelling earth and hammering riveted plate-steel barricade panels into place under floodlights, seen from the side at ground level, nobody standing still, sparks and flying mud' }),
  c({ id: 'c_shieldwall', name: 'Iron Shieldwall', faction: 'concord', cost: 2, power: 1, nerve: 6, cls: 'Infantry', arch: ['bastion'],
    keywords: ['guard'], text: 'Guard: strikes aimed at the allies beside it hit it instead.',
    niche: 'Soaks the hits meant for your officers and snipers.',
    art: 'a tight row of soldiers kneeling behind huge riveted tower shields locked edge to edge, shields dented and bristling with bullet strikes, sparks flying off them, seen head-on at shield height, only helmets and eyepieces visible over the shield rim' }),
  c({ id: 'c_pillbox', name: 'Bastion Pillbox', faction: 'concord', cost: 2, power: 3, nerve: 0, range: 2, cls: 'Structure', arch: ['bastion'],
    keywords: ['fearless'], text: 'Fearless: Shock hits it as damage.',
    niche: 'An unbreakable gun that plugs a column; only damage removes it.',
    art: 'close-up of a squat hexagonal concrete-and-riveted-plate pillbox bunker as the sole central subject, no people visible, heavy machine gun barrel jutting from a narrow firing slit spitting orange tracer fire, sandbags and barbed wire at its base, red chevron painted on its armored face, searchlight on top' }),
  c({ id: 'c_mortar', name: 'Rainmaker Mortar Team', faction: 'concord', cost: 3, power: 2, nerve: 2, range: 3, cls: 'Infantry', arch: ['bastion'],
    keywords: ['splash'], text: 'Splash: also Shocks the enemies beside its target by 1.',
    niche: 'Punishes enemies that clump together.',
    art: 'a two-soldier mortar crew dropping a glowing shell into a stubby tube on a cratered hillside, explosions lighting low clouds' }),
  c({ id: 'c_battery', name: 'Hammerfall 380 Battery', faction: 'concord', cost: 5, power: 3, nerve: 3, range: 4, cls: 'Vehicle', arch: ['bastion'],
    keywords: ['artillery', 'lethal'], text: 'Artillery: ignores Ruins and Guard. Lethal.',
    niche: 'The answer to walls, Guards and dug-in enemies, from anywhere.',
    art: 'as the sole dominant central subject, a colossal self-propelled artillery gun firing into the night, recoil blasting a wall of dust, crew covering their ears' }),
  c({ id: 'c_halftrack', name: 'Lancer Ram-Track', faction: 'concord', cost: 2, power: 4, nerve: 4, cls: 'Vehicle', arch: ['iron'],
    keywords: ['shove'], text: 'On Reveal: rams the enemy Front unit opposite one column aside. If it can’t move, 2 Shock.',
    niche: 'The rare mover: shoves the enemy unit opposite aside to open a breach, or crushes it against its neighbours.',
    art: 'as the sole dominant central subject, a riveted armored halftrack with a huge ram plow charging through dust, soldiers clinging to its sides' }),
  c({ id: 'c_walker', name: 'Bulwark Mk.III Walker', faction: 'concord', cost: 4, power: 6, nerve: 5, cls: 'Vehicle', arch: ['iron', 'bastion'],
    keywords: ['armor'], text: 'Armor: takes 1 less damage.',
    niche: 'Shrugs off snipers and acid. Spearheads a push.',
    art: 'a huge two-legged armored walker with a heavy cannon, infantry sheltering behind its legs in the rain' }),
  c({ id: 'c_tank', name: 'Iron Saint Siege-Crawler', faction: 'concord', cost: 5, power: 6, nerve: 6, range: 2, cls: 'Vehicle', arch: ['iron'],
    keywords: ['breach'], text: 'Breach: +2 against Fearless units and units in cover.',
    niche: 'Cracks fortresses and unbreakable swarms.',
    art: 'as the sole dominant central subject, a cathedral-sized siege crawler on grinding treads with a massive cannon, votive banners and searchlights, infantry marching in its shadow' }),
  c({ id: 'c_overthetop', name: 'Over the Top!', faction: 'concord', cost: 1, power: 0, nerve: 0, cls: 'Tactic', arch: ['iron', 'gunline'],
    keywords: [], tactic: { kind: 'power', n: 3, target: 'ally' }, text: 'Target ally strikes +3 this round.',
    niche: 'Turns one strike into a break, the round you need it.',
    art: 'soldiers scrambling up wooden trench ladders and over the sandbag lip into no-mans-land, seen from inside the trench looking up at them, a single red flare bursting overhead, bayonets fixed, urgent diagonal motion' }),
  c({ id: 'c_broadcast', name: 'Loudhorn Broadcast', faction: 'concord', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['gunline', 'bastion', 'iron'],
    keywords: [], tactic: { kind: 'nerve', n: 3, target: 'ally' }, text: 'Target ally and the allies around it regain 3 Nerve.',
    niche: 'The rally: saves a line that is about to break.',
    art: 'a towering riveted radio mast crowned with brass loudspeaker horns blaring, as the sole dominant central subject seen from far below, tattered red banners snapping in the wind around it, tiny soldiers at its base lifting their heads' }),

  // ═══════════════ VHORR BROOD: "Swarm & evolve" ═══════════════
  // Faction rules: SYNAPSE LINK: Brood next to a Synapse are Fearless.
  //                EVOLVE: a Brood unit that strikes gains +1 Power (max +3).
  // Archetypes: TIDE (bodies everywhere) · APEX (feed a monster) · SYNAPSE (unbreakable linked terror)
  c({ id: 'b_skitter', name: 'Skitterling Tide', faction: 'brood', cost: 1, power: 2, nerve: 2, cls: 'Swarm', arch: ['tide'],
    keywords: ['swarm'], text: 'Swarm: stacks up to 5.',
    niche: 'Bodies for flanking bonuses, or one huge stacked swarm.',
    art: 'a fast swarm of small sleek beetle-like hunters racing over a ridge toward the viewer, one in sharp focus in front, the rest silhouettes trailing behind, glowing green eyes' }),
  c({ id: 'b_pod', name: 'Sporemother Pod', faction: 'brood', cost: 2, power: 3, nerve: 0, range: 0, cls: 'Structure', arch: ['tide'],
    keywords: ['fearless', 'hatch'], text: 'Each round: hatches a Skitterling beside it (max 2 alive).',
    niche: 'A nest to protect; kill it early or drown in bugs.',
    art: 'as the sole dominant central subject, a tall armoured alien hive-spire like a giant closed seed of glossy carapace plates rooted in the ground, its plates parting along glowing green seams, small sleek hatchlings emerging' }),
  c({ id: 'b_mimic', name: 'Skinwalker Mimics', faction: 'brood', cost: 2, power: 2, nerve: 3, cls: 'Swarm', arch: ['tide'],
    keywords: ['burst'], text: 'Last Breath: bursts into 2 Skitterlings.',
    niche: 'Breaking it only makes more of them.',
    art: 'three tall thin alien hunters standing upright in fog, wearing torn olive greatcoats and stolen red-striped helmets over glossy black carapace bodies, far too many joints, glowing green eye slits under the helmets, backlit, deeply uncanny' }),
  c({ id: 'b_pack', name: 'Gnasher Pack', faction: 'brood', cost: 2, power: 1, nerve: 3, cls: 'Beast', arch: ['tide', 'apex'],
    keywords: ['pack'], text: 'Pack: +1 for each adjacent ally.',
    niche: 'Wants to be buried in the middle of the swarm.',
    art: 'a pack of five sleek six-legged panther-like alien hounds running low and fast together in a hunting formation, seen from the side, glossy armoured bodies, glowing green eyes, dust streaming behind' }),
  c({ id: 'b_grub', name: 'Broodling Grub', faction: 'brood', cost: 1, power: 1, nerve: 3, cls: 'Beast', arch: ['apex'],
    keywords: ['grow'], text: 'Each round: grows +1 Power (max +3).',
    niche: 'Play early, hide it behind the swarm, let it become a monster.',
    art: 'a young armoured larva curled protectively on a rock, glossy segmented plates, through a translucent window in its shell a glowing green silhouette of the predator it will become' }),
  c({ id: 'b_lashworm', name: 'Lashworm Burrower', faction: 'brood', cost: 2, power: 2, nerve: 3, range: 2, cls: 'Beast', arch: ['apex', 'synapse'],
    keywords: ['hunter'], text: 'Hunter: bursts up under the enemy Back row first.',
    niche: 'Pops up behind their line to hit their backline.',
    art: 'a single enormous armoured serpent-worm erupting vertically from cracked earth, smooth glossy segmented plates, a crown of blade-like mandibles opening like a flower, rocks exploding outward, seen from below' }),
  c({ id: 'b_spitter', name: 'Acidbelly Spitter', faction: 'brood', cost: 3, power: 2, nerve: 3, range: 3, cls: 'Beast', arch: ['apex'],
    keywords: ['lethal'], text: 'Lethal: its acid deals damage, not Shock.',
    niche: 'Kills the unbreakables: structures, officers, armour.',
    art: 'a sleek wasp-like alien artillery beast reared up on four legs, abdomen arched forward, launching a glowing green bolt of acid in a bright arc' }),
  c({ id: 'b_ravager', name: 'Scythe Ravager', faction: 'brood', cost: 4, power: 4, nerve: 4, cls: 'Beast', arch: ['apex', 'tide'],
    keywords: ['cleave'], text: 'Cleave: also strikes the enemies beside its target.',
    niche: 'Drop it into the middle of their line.',
    art: 'a sleek armoured mantis-like predator mid-leap with huge blade forelimbs raised, landing on an overturned riveted olive vehicle' }),
  c({ id: 'b_gorgemaw', name: 'The Gorgemaw', faction: 'brood', cost: 5, power: 7, nerve: 5, cls: 'Beast', arch: ['apex'],
    keywords: ['drain'], text: 'Drain: heals 2 every time it strikes.',
    niche: 'The apex: wins a straight fight against anything.',
    art: 'a colossal armoured alien behemoth with a vast jaw of blade-like teeth opening wide, smooth glossy plates, towering over colonial soldiers in olive greatcoats and red-striped steel helmets fleeing in the foreground' }),
  c({ id: 'b_synapse', name: 'Thoughtstalk Warden', faction: 'brood', cost: 2, power: 2, nerve: 5, cls: 'Synapse', arch: ['synapse', 'tide'],
    keywords: ['synapse'], text: 'Synapse: Brood beside, in front of or behind it are Fearless.',
    niche: 'Makes the swarm around it unbreakable. Kill it and they can panic again.',
    art: 'a tall elegant alien conductor creature with a smooth glowing translucent crest, thin luminous green psychic threads linking it to sleek hunters around it' }),
  c({ id: 'b_howler', name: 'Throat-Sac Howler', faction: 'brood', cost: 2, power: 2, nerve: 3, cls: 'Beast', arch: ['synapse'],
    keywords: ['terror'], text: 'Terror: +2 against units at half Nerve or less.',
    niche: 'Finishes off wavering units.',
    art: 'a lean alien beast with its armoured throat plates flared wide open like a frill, screaming, visible rings of sonic distortion bursting outward' }),
  c({ id: 'b_leech', name: 'Nightmaw Leech', faction: 'brood', cost: 3, power: 2, nerve: 3, range: 2, cls: 'Beast', arch: ['synapse', 'tide'],
    keywords: ['infect'], text: 'Infect: each enemy it breaks rises as a Skitterling in your line.',
    niche: 'Turns their losses into your swarm.',
    art: 'a sleek eel-like flying alien predator with glowing green eyes swooping down onto colonial soldiers in olive greatcoats and red-striped steel helmets who scatter below' }),
  c({ id: 'b_overseer', name: 'Overmind Aspect', faction: 'brood', cost: 4, power: 3, nerve: 5, range: 2, cls: 'Synapse', arch: ['synapse'],
    keywords: ['synapse', 'overmind'], text: 'Synapse. Linked Brood strike +2.',
    niche: 'The army-wide upgrade; the enemy must go through the swarm to reach it.',
    art: 'an enormous floating alien sovereign with a smooth glowing crown-like crest and long trailing tendrils, a sleek swarm moving in perfect unison beneath it' }),
  c({ id: 'b_pheromone', name: 'Frenzy Pheromone', faction: 'brood', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['tide', 'apex'],
    keywords: [], tactic: { kind: 'powerArea', n: 2, target: 'ally' }, text: 'Target ally and the allies around it strike +2 this round.',
    niche: 'Swarm-wide surge for the decisive round.',
    art: 'a sleek alien beast throwing back its head and releasing a vast luminous green cloud of spores into the sky, the hunters around it rearing up with glowing eyes' }),
  c({ id: 'b_scream', name: 'Psychic Scream', faction: 'brood', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['synapse'],
    keywords: [], tactic: { kind: 'scream', n: 2, target: 'ally' }, text: 'Enemy Front units in target ally’s column and the columns beside it take 2 Shock.',
    niche: 'Shatters whatever is pressed against your swarm.',
    art: 'a synapse creature with its glowing crest flaring, a visible shockwave of green psychic force rippling outward and knocking colonial soldiers in olive greatcoats and red-striped steel helmets to their knees' }),

  // ═══════════════ THE HUSH: "Unseen" ═══════════════
  // Faction rules: CLOAK: Hush units arrive cloaked; only adjacent enemies can strike them.
  //   A cloaked unit's first strike is an AMBUSH (+1), then it is revealed. Placing next to a cloaked unit reveals it.
  // Archetypes: PHANTOM (decoys & bluffs) · KNIVES (ambush & assassinate) · DREAD (break minds, not bodies)
  c({ id: 'v_phantom', name: 'Phantom Echo', faction: 'hush', cost: 1, power: 1, nerve: 1, range: 0, cls: 'Illusion', arch: ['phantom'],
    keywords: ['decoy'], text: 'Decoy: when struck it pops and the striker takes 1 Shock. Fades after a round. Costs no Resolve.',
    niche: 'A cloaked bluff the enemy must waste effort on.',
    art: 'a holographic silhouette of a hooded operative breaking apart into violet static, scanlines and glitching fragments drifting away like ash, half of the figure already gone, an empty dark ruined street' }),
  c({ id: 'v_projector', name: 'Shroud Lantern', faction: 'hush', cost: 2, power: 3, nerve: 0, range: 0, cls: 'Structure', arch: ['phantom', 'knives'],
    keywords: ['fearless', 'shroud'], text: 'Each round: re-cloaks the Hush units around it.',
    niche: 'A base that resets your ambushes every round.',
    art: 'as the sole dominant central subject, a tall spindly lantern-like device planted in the ground exhaling a dome of distortion haze, everything inside blurred' }),
  c({ id: 'v_weaver', name: 'Mirage Weaver', faction: 'hush', cost: 3, power: 1, nerve: 4, range: 2, cls: 'Psion', arch: ['phantom'],
    keywords: ['mirage'], text: 'On Reveal: conjures 2 Phantom Echoes beside it.',
    niche: 'Turns one placement into three cloaked threats.',
    art: 'a gaunt robed psion with hands raised conjuring illusory copies of soldiers out of glowing mist' }),
  c({ id: 'v_twins', name: 'Echo-Twin Operatives', faction: 'hush', cost: 2, power: 2, nerve: 3, cls: 'Operative', arch: ['phantom', 'knives'],
    keywords: ['echo'], text: 'On Reveal: a Phantom Echo appears beside them.',
    niche: 'Two cloaked threats for one card: which is real?',
    art: 'two identical masked operatives standing back to back in perfect mirror symmetry, blades drawn, one solid and one subtly translucent with violet static at its edges, centered waist-up close-up' }),
  c({ id: 'v_smoke', name: 'Smoke & Mirrors', faction: 'hush', cost: 1, power: 0, nerve: 0, cls: 'Tactic', arch: ['phantom', 'knives'],
    keywords: [], tactic: { kind: 'cloak', n: 1, target: 'ally' }, text: 'Target ally re-cloaks and a Phantom Echo appears beside it.',
    niche: 'Re-arms an ambush.',
    art: 'a sudden burst of violet smoke exploding outward in a sphere, the faint shape of a masked figure vanishing at its center, three identical silhouettes stepping out of the smoke cloud in different directions' }),
  c({ id: 'v_blade', name: 'Hushblade Initiates', faction: 'hush', cost: 1, power: 2, nerve: 2, cls: 'Operative', arch: ['knives'],
    keywords: [], text: 'They are already behind you.',
    niche: 'Cheap ambusher: 3 Shock out of nowhere for 1 Command.',
    art: 'a slender masked assassin crouched on a rooftop ledge at night with twin curved blades, rain' }),
  c({ id: 'v_stalker', name: 'Glasswalk Stalkers', faction: 'hush', cost: 2, power: 2, nerve: 3, cls: 'Operative', arch: ['knives'],
    keywords: ['fade'], text: 'Fade: re-cloaks each round if nothing faces it.',
    niche: 'Hit, step back into the dark, ambush again.',
    art: 'an almost invisible stalker in active camouflage, its whole body a transparent glass-like distortion refracting the ruined street behind it, only the edges of its silhouette, its porcelain mask and its blade clearly visible, mid-stride' }),
  c({ id: 'v_needle', name: 'Quiet Needle', faction: 'hush', cost: 3, power: 2, nerve: 2, range: 3, cls: 'Operative', arch: ['knives'],
    keywords: ['lethal', 'silent'], text: 'Lethal. Silent: striking never reveals it (but it gets no ambush bonus).',
    niche: 'An invisible sniper; find it by walking into it.',
    art: 'a prone sniper wrapped in a cloak beneath a collapsed bridge, a long needle rifle, a single tracer streak into the fog' }),
  c({ id: 'v_skimmer', name: 'Nightglass Skiff', faction: 'hush', cost: 3, power: 3, nerve: 3, cls: 'Vehicle', arch: ['knives'],
    keywords: ['raider'], text: 'Raider: +2 on rear strikes.',
    niche: 'Strikes deep behind their lines.',
    art: 'a sleek angular black-glass hover-skiff, shaped like a curved obsidian blade with thin violet light-lines along its hull, as the dominant central subject seen from a low front three-quarter angle, skimming over dark marsh water throwing spray, two small masked riders crouched on its deck' }),
  c({ id: 'v_faceless', name: 'The Faceless', faction: 'hush', cost: 3, power: 4, nerve: 4, cls: 'Operative', arch: ['knives'],
    keywords: ['assassin', 'hunter'], text: 'Hunter. Its ambush is Lethal against Officers and Synapses.',
    niche: 'Decapitation: kills the unit their army leans on.',
    art: 'an elite assassin whose smooth featureless porcelain mask is laced with many glowing violet kintsugi seams, standing over a fallen officer of the colonial soldiers in olive greatcoats and red-striped steel helmets, a burning command tent behind' }),
  c({ id: 'v_knives', name: 'Night of Knives', faction: 'hush', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['knives'],
    keywords: [], tactic: { kind: 'knives', n: 3, target: 'ally' }, text: 'All your cloaked units strike +3 this round.',
    niche: 'One coordinated massacre.',
    art: 'a wide view of a sleeping military camp of olive canvas tents at night lit by one dying campfire, surrounded by pitch-black darkness in which the operatives themselves are completely invisible, only a dozen pairs of floating thin violet-glowing eye slits and the glint of curved blades hang in the dark around the camp, nobody in the foreground' }),
  c({ id: 'v_whisper', name: 'Rumor-Wright', faction: 'hush', cost: 2, power: 1, nerve: 3, range: 2, cls: 'Operative', arch: ['dread'],
    keywords: ['dirge'], text: 'Its Shock ignores Standards and other auras.',
    niche: 'Gets around officers and standards.',
    art: 'a hooded figure whispering into a field radio in a shadowed alcove, leaflets swirling, a distant army camp lit by fires' }),
  c({ id: 'v_choir', name: 'Hollow Choir', faction: 'hush', cost: 3, power: 1, nerve: 4, cls: 'Psion', arch: ['dread'],
    keywords: ['dread'], text: 'Each round: the enemy units facing it take 1 Shock.',
    niche: 'Slowly unravels anything that stands next to it.',
    art: 'a circle of masked figures humming in fog, the air around them warped, distant soldiers covering their ears in dread' }),
  c({ id: 'v_herald', name: 'Dread Herald', faction: 'hush', cost: 3, power: 2, nerve: 4, range: 2, cls: 'Psion', arch: ['dread'],
    keywords: ['nightmare'], text: 'On Reveal: enemies in its column and the columns beside it take 1 Shock.',
    niche: 'Softens a whole cluster before the knives go in.',
    art: 'a towering cloaked figure with a cracked mask and nothing behind it, colonial soldiers in olive greatcoats and red-striped steel helmets around it clutching their heads in terror' }),
  c({ id: 'v_false', name: 'False Orders', faction: 'hush', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['dread', 'phantom'],
    keywords: [], tactic: { kind: 'silence', n: 2, target: 'enemy' }, text: 'Target enemy loses its ability and strikes −2 this round.',
    niche: 'Switches off their key piece (Synapse, Guard, Officer) for a round.',
    art: 'a radio operator of the colonial soldiers in olive greatcoats and red-striped steel helmets listening in confusion to a distorted voice, a masked figure in the shadows behind them' }),

];

/** Placeholder for hidden cards (cloaked enemies, opponent's hand) in redacted views. */
export const UNKNOWN_CARD: CardDef = { id: '?', name: 'Unknown', faction: 'hush', cost: 0, power: 2, nerve: 3, cls: 'Operative', arch: [], keywords: [], text: 'Cloaked. Place a unit next to it to reveal it.', niche: '', art: '' };

export const CARD_BY_ID: Record<string, CardDef> = { ...Object.fromEntries(CARDS.map((d) => [d.id, d])), '?': UNKNOWN_CARD };

export const KEYWORD_HELP: Partial<Record<Keyword, string>> = {
  lethal: 'Lethal: deals damage to Power instead of Shock to Nerve.',
  hunter: 'Hunter: strikes the enemy Back row first.',
  guard: 'Guard: strikes aimed at the allies beside it hit the Guard instead.',
  artillery: 'Artillery: ignores Ruins and Guard.',
  armor: 'Armor: takes 1 less damage.',
  fearless: 'Fearless: never breaks; Shock hits it as damage instead.',
  raider: 'Raider: +2 on rear strikes.',
  cleave: 'Cleave: also strikes the enemies beside its target.',
  splash: 'Splash: also Shocks the enemies beside its target by 1.',
  terror: 'Terror: +2 against units at half Nerve or less.',
  synapse: 'Synapse: Brood beside, in front of or behind it are Fearless.',
};

export const FACTION_INFO: Record<Faction, { name: string; color: string; blurb: string; rules: string[]; archetypes: Record<string, string> }> = {
  concord: { name: 'Concord Vanguard', color: '#c8553d', blurb: 'Hold the line. Rows of rifles, officers and armour.',
    rules: ['Hold the Line: Concord Front units cannot be Flanked.', 'Drilled: regains up to 3 Nerve per round from the allies around it (others: up to 2).'],
    archetypes: { gunline: 'Gunline: ranked riflemen and officers', bastion: 'Bastion: walls, cover and artillery', iron: 'Iron Tide: armour that bulldozes' } },
  brood: { name: 'Vhorr Brood', color: '#8fbf3a', blurb: 'Swarm & evolve. Fearless while linked; every bite makes them bigger.',
    rules: ['One Organism: Swarms and Beasts count as one class for column hands.', 'Flood: a Brood unit In Breach flanks for +2 instead of +1.', 'Synapse Link: Brood around a Synapse are Fearless.', 'Evolve: a Brood unit that strikes gains +1 Power (max +3).'],
    archetypes: { tide: 'Endless Tide: drown them in bodies', apex: 'Apex: feed a monster', synapse: 'Synaptic Terror: linked, unbreakable horrors' } },
  hush: { name: 'The Hush', color: '#7a5cff', blurb: 'Unseen. Cloaks, decoys and ambush.',
    rules: ['Cloak: arrives cloaked; ranged units cannot target it (their shots fall through to the unit behind). Being struck reveals it.', 'Ambush: its first strike from cloak is +1, then it is revealed.'],
    archetypes: { phantom: 'Phantom Host: decoys and bluffs', knives: 'Night of Knives: ambush and assassinate', dread: 'Dread: break them without a fight' } },
};

/** Starter decks: 20 cards, built around one archetype with a splash of the rest. */
export function starterDeck(f: Faction, arch?: string): string[] {
  const pool = CARDS.filter((d) => d.faction === f && d.cls !== 'HQ');
  if (!arch) {
    const cheap = [...pool].sort((a, b) => a.cost - b.cost).slice(0, 5);
    return [...pool, ...cheap].map((d) => d.id);
  }
  const core = pool.filter((d) => d.arch.includes(arch));
  const rest = pool.filter((d) => !d.arch.includes(arch)).sort((a, b) => a.cost - b.cost);
  const deck: string[] = [];
  for (const d of core) deck.push(d.id, d.id);
  for (const d of rest) if (deck.length < 20) deck.push(d.id);
  return deck.slice(0, 20);
}
