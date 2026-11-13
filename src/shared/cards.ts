export type Faction = 'concord' | 'brood' | 'hush';

export type UnitClass =
  | 'Infantry' | 'Vehicle' | 'Officer'
  | 'Beast' | 'Swarm' | 'Synapse'
  | 'Operative' | 'Psion' | 'Illusion'
  | 'Structure' | 'HQ' | 'Tactic';

export type Keyword =
  // shared
  | 'lethal' | 'indirect' | 'ignoreCover' | 'flying' | 'immobile' | 'hq' | 'spawn' | 'fearless'
  | 'unflankable' | 'charge' | 'hunter'
  // concord
  | 'volley' | 'officerAura' | 'rally' | 'digIn' | 'coverAura' | 'marshal' | 'barrage' | 'standard' | 'breach'
  // brood
  | 'swarm5' | 'creep' | 'burrow' | 'shriek' | 'infiltrate' | 'synapse' | 'synapseBig'
  | 'meltCover' | 'frenzy' | 'devour' | 'grub' | 'hatch' | 'terror'
  // hush
  | 'decoy' | 'fade' | 'dirge' | 'silent' | 'shroud' | 'mirage' | 'nightmare' | 'assassinate'
  | 'echo' | 'dread';

export type Archetype = string;

/** Every unit card shows three numbers: Cost, Power, Nerve.
 *  Power – fighting strength AND toughness (damage lowers it).
 *  Nerve – morale. Shock lowers it; at 0 the formation Breaks.
 *  Range/speed are icons (default: melee, speed 1).
 *  Tactic cards have no Power/Nerve: they are one-round orders played on a formation. */
export interface CardDef {
  id: string;
  name: string;
  faction: Faction;
  cost: number;
  power: number;
  nerve: number;
  range?: number;   // 0 = never strikes, 1 melee (default), 2+ ranged
  speed?: number;   // default 1
  cls: UnitClass;
  keywords: Keyword[];
  tactic?: TacticEffect;
  arch: Archetype[];
  text: string;
  art: string;      // subject prompt; faction look + global style are appended by the generator
}

export type TacticEffect =
  | { kind: 'overTheTop' }          // ally: +1 speed, charge (+2) this round
  | { kind: 'holdFast' }            // ally: +3 Nerve, won't advance, +1 vs melee attackers
  | { kind: 'broadcast' }           // ally hex: allies within 2 recover 2 Nerve, broken ones rally
  | { kind: 'spawning' }            // ally: 2 Skitterling tokens next to it
  | { kind: 'pheromone' }           // ally: it and adjacent Brood +2 Power this round
  | { kind: 'scream' }              // ally synapse: enemies within 1 take 2 Shock now
  | { kind: 'falseOrders' }         // enemy: won't advance or strike this round, 1 Shock
  | { kind: 'smoke' }               // ally: re-cloak, +1 Phantom next to it
  | { kind: 'knives' };             // all your cloaked formations +2 Power this round

export const rangeOf = (d: CardDef) => d.range ?? 1;
export const speedOf = (d: CardDef) => d.speed ?? 1;
export const isTactic = (d: CardDef) => d.cls === 'Tactic';
/** Heavy cards arrive one round after being ordered (telegraphed drop). */
export const isHeavy = (d: CardDef) => d.cost >= 5 && !isTactic(d);

const c = (d: CardDef) => d;

export const CARDS: CardDef[] = [
  // ════════════════════════ CONCORD VANGUARD — "Hold the line" ════════════════════════
  // Archetypes: GUNLINE (ranged rows + officers), BASTION (dig in, artillery, hold relays), IRON TIDE (armour push)
  c({ id: 'c_trooper', name: 'Dustcoat Fusiliers', faction: 'concord', cost: 1, power: 2, nerve: 3, cls: 'Infantry', arch: ['gunline', 'bastion'],
    keywords: [], text: '',
    art: 'a squad of weary fusiliers standing shoulder to shoulder in a muddy trench line, bayonet rail-rifles raised' }),
  c({ id: 'c_rifles', name: 'Ashline Riflemen', faction: 'concord', cost: 2, power: 2, nerve: 3, range: 2, cls: 'Infantry', arch: ['gunline'],
    keywords: ['volley'], text: 'Volley: +1 if another ally hits the same target this round.',
    art: 'a kneeling rifle section firing a coordinated volley, muzzle flashes and ash falling' }),
  c({ id: 'c_lieutenant', name: 'Whistle-Lieutenant', faction: 'concord', cost: 2, power: 1, nerve: 5, cls: 'Officer', arch: ['gunline', 'iron'],
    keywords: ['officerAura', 'rally'], text: 'Adjacent allies strike +1. Adjacent Broken allies rally at end of round.',
    art: 'a scarred young officer with a whistle in their teeth and a pistol raised, waving soldiers forward out of the smoke' }),
  c({ id: 'c_sergeant', name: 'Colour Sergeant Hale', faction: 'concord', cost: 3, power: 2, nerve: 6, cls: 'Officer', arch: ['gunline', 'bastion'],
    keywords: ['standard'], text: 'Standard: adjacent allies take 1 less Shock.',
    art: 'a broad-shouldered sergeant planting a tattered battle standard into the mud, bullets cracking past, refusing to move' }),
  c({ id: 'c_marksman', name: '"Widow" Varn, Longshot', faction: 'concord', cost: 3, power: 2, nerve: 2, range: 3, cls: 'Infantry', arch: ['gunline'],
    keywords: ['lethal', 'ignoreCover', 'hunter'], text: 'Lethal. Ignores cover. Hunter: targets the costliest enemy in range.',
    art: 'a lone hooded sniper lying prone on a ruined gantry with an extremely long rail rifle, scope glint, scrap-cloth camouflage' }),
  c({ id: 'c_sapper', name: 'Mole Brigade Sappers', faction: 'concord', cost: 2, power: 2, nerve: 3, cls: 'Infantry', arch: ['bastion'],
    keywords: ['digIn'], text: 'Dig In: fortifies its hex (cover) when placed. Never advances.',
    art: 'combat engineers with shovels and demolition charges building plate-steel barricades under floodlights' }),
  c({ id: 'c_pillbox', name: 'Bastion Pillbox', faction: 'concord', cost: 2, power: 4, nerve: 0, range: 2, speed: 0, cls: 'Structure', arch: ['bastion'],
    keywords: ['immobile', 'fearless'], text: 'Fearless. Immobile. Ranged.',
    art: 'a squat concrete-and-plate pillbox with a heavy gun slit spitting tracer fire into the night' }),
  c({ id: 'c_mortar', name: 'Rainmaker Mortar Team', faction: 'concord', cost: 3, power: 2, nerve: 2, range: 3, cls: 'Infantry', arch: ['bastion'],
    keywords: ['indirect', 'barrage'], text: 'Indirect. Barrage: 1 Shock to every unit next to its target.',
    art: 'a two-soldier mortar crew dropping a glowing shell into a stubby tube on a cratered hillside, explosions lighting low clouds' }),
  c({ id: 'c_battery', name: 'Hammerfall 380 Battery', faction: 'concord', cost: 5, power: 3, nerve: 3, range: 4, speed: 0, cls: 'Vehicle', arch: ['bastion'],
    keywords: ['indirect', 'lethal', 'barrage', 'immobile'], text: 'Heavy. Indirect. Lethal. Barrage. Immobile.',
    art: 'a colossal self-propelled artillery gun firing into the night, recoil blasting a wall of dust, crew covering their ears' }),
  c({ id: 'c_halftrack', name: 'Lancer Ram-Track', faction: 'concord', cost: 3, power: 3, nerve: 4, speed: 2, cls: 'Vehicle', arch: ['iron'],
    keywords: ['charge'], text: 'Charge: +2 the round it moves into contact.',
    art: 'a riveted armored halftrack with a huge ram plow charging through dust, soldiers clinging to its sides' }),
  c({ id: 'c_walker', name: 'Bulwark Mk.III Walker', faction: 'concord', cost: 4, power: 5, nerve: 5, cls: 'Vehicle', arch: ['iron', 'bastion'],
    keywords: ['unflankable', 'coverAura'], text: 'Cannot be flanked. Adjacent Infantry are in cover.',
    art: 'a huge two-legged armored walker with a heavy cannon, infantry sheltering behind its legs in the rain' }),
  c({ id: 'c_tank', name: 'Iron Saint Siege-Crawler', faction: 'concord', cost: 6, power: 7, nerve: 5, range: 2, cls: 'Vehicle', arch: ['iron'],
    keywords: ['lethal', 'breach', 'unflankable'], text: 'Heavy. Lethal. Cannot be flanked. Breach: +3 against Structures and HQs.',
    art: 'a cathedral-sized siege crawler on grinding treads with a massive cannon, votive banners and searchlights, infantry marching in its shadow' }),
  c({ id: 'c_overthetop', name: 'Over the Top!', faction: 'concord', cost: 1, power: 0, nerve: 0, cls: 'Tactic', arch: ['iron', 'gunline'],
    keywords: [], tactic: { kind: 'overTheTop' }, text: 'Order an ally: +1 speed and Charge (+2) this round.',
    art: 'soldiers climbing out of a trench at the whistle into smoke and searchlights, bayonets fixed, a single flare overhead' }),
  c({ id: 'c_holdfast', name: 'Hold Fast', faction: 'concord', cost: 1, power: 0, nerve: 0, cls: 'Tactic', arch: ['bastion', 'gunline'],
    keywords: [], tactic: { kind: 'holdFast' }, text: 'Order an ally: +3 Nerve, it holds its ground this round.',
    art: 'a line of soldiers bracing behind a barricade as a dark wave approaches, an officer with a raised sword holding them steady' }),
  c({ id: 'c_broadcast', name: 'Loudhorn Broadcast', faction: 'concord', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['gunline', 'bastion', 'iron'],
    keywords: [], tactic: { kind: 'broadcast' }, text: 'Allies within 2 of the target recover 2 Nerve; Broken ones rally.',
    art: 'a towering loudspeaker mast blaring over a battlefield at dusk, soldiers lifting their heads, banners snapping' }),

  // ════════════════════════ VHORR BROOD — "Swarm & evolve" ════════════════════════
  // Archetypes: TIDE (endless cheap swarms), APEX (feed & grow monsters), SYNAPSE (linked terror)
  c({ id: 'b_skitter', name: 'Skitterling Tide', faction: 'brood', cost: 1, power: 1, nerve: 2, speed: 2, cls: 'Swarm', arch: ['tide'],
    keywords: ['swarm5'], text: 'Stacks up to 5.',
    art: 'a tide of small many-legged creatures pouring over a ridge, dozens of glistening black eyes' }),
  c({ id: 'b_pod', name: 'Sporemother Pod', faction: 'brood', cost: 2, power: 3, nerve: 0, range: 0, speed: 0, cls: 'Structure', arch: ['tide'],
    keywords: ['spawn', 'creep', 'immobile', 'fearless', 'hatch'], text: 'Creep around it. Hatch: each round, births a Skitterling next to it (max 2 alive).',
    art: 'a pulsing fleshy spore pod rooted in cracked earth, veins of organic creep spreading outward, spores drifting' }),
  c({ id: 'b_mimic', name: 'Skinwalker Mimics', faction: 'brood', cost: 2, power: 2, nerve: 2, speed: 2, cls: 'Swarm', arch: ['tide', 'synapse'],
    keywords: ['infiltrate'], text: 'Infiltrate: may be placed touching enemies, or anywhere next to Creep.',
    art: 'creatures mimicking human silhouettes emerging from fog behind a battle line, wrong proportions, too many joints' }),
  c({ id: 'b_spawning', name: 'Brood Spawning', faction: 'brood', cost: 3, power: 0, nerve: 0, cls: 'Tactic', arch: ['tide'],
    keywords: [], tactic: { kind: 'spawning' }, text: 'Target ally births 2 Skitterlings next to it.',
    art: 'a split-open birthing sac spilling out a wave of glistening newborn creatures onto organic creep' }),
  c({ id: 'b_grub', name: 'Broodling Grub', faction: 'brood', cost: 1, power: 1, nerve: 2, cls: 'Beast', arch: ['apex'],
    keywords: ['grub'], text: 'Grows +1 Power at the end of every round (max +4).',
    art: 'a fat pale larval creature curled on the ground, translucent skin showing something large forming inside' }),
  c({ id: 'b_lashworm', name: 'Lashworm Burrower', faction: 'brood', cost: 2, power: 2, nerve: 2, range: 2, speed: 2, cls: 'Beast', arch: ['apex'],
    keywords: ['burrow'], text: 'Burrow: moves through anything.',
    art: 'a huge segmented worm bursting from the soil, ring of barbed tendrils lashing outward, rocks flying' }),
  c({ id: 'b_spitter', name: 'Acidbelly Spitter', faction: 'brood', cost: 3, power: 2, nerve: 2, range: 3, cls: 'Beast', arch: ['apex', 'synapse'],
    keywords: ['lethal', 'meltCover'], text: 'Lethal. Melts cover off its target hex.',
    art: 'a bloated six-legged beast arching its back and spewing a glowing arc of acid, metal barricades melting' }),
  c({ id: 'b_ravager', name: 'Scythe Ravager', faction: 'brood', cost: 4, power: 4, nerve: 3, speed: 2, cls: 'Beast', arch: ['apex', 'tide'],
    keywords: ['frenzy'], text: 'Frenzy: +1 for every other Brood next to its target.',
    art: 'a hulking armored predator with scythe forelimbs mid-leap over an overturned vehicle' }),
  c({ id: 'b_gorgemaw', name: 'The Gorgemaw', faction: 'brood', cost: 6, power: 7, nerve: 3, cls: 'Beast', arch: ['apex'],
    keywords: ['lethal', 'devour'], text: 'Heavy. Lethal. Devour: on a kill, heals 3 and Shocks adjacent enemies 2.',
    art: 'a colossal beast that is mostly mouth and rows of teeth, swallowing a tank whole, soldiers fleeing in the foreground' }),
  c({ id: 'b_pheromone', name: 'Frenzy Pheromone', faction: 'brood', cost: 1, power: 0, nerve: 0, cls: 'Tactic', arch: ['apex', 'tide'],
    keywords: [], tactic: { kind: 'pheromone' }, text: 'Target ally and adjacent Brood strike +2 this round.',
    art: 'a cloud of glowing spores bursting over a pack of beasts, their eyes flaring, muscles swelling, jaws wide' }),
  c({ id: 'b_howler', name: 'Throat-Sac Howler', faction: 'brood', cost: 2, power: 2, nerve: 2, speed: 2, cls: 'Beast', arch: ['synapse'],
    keywords: ['shriek'], text: 'Shriek: strikes every adjacent enemy.',
    art: 'a gaunt eyeless beast with a swollen split throat sac screaming, visible sonic distortion rings' }),
  c({ id: 'b_synapse', name: 'Thoughtstalk Warden', faction: 'brood', cost: 3, power: 2, nerve: 5, cls: 'Synapse', arch: ['synapse', 'tide'],
    keywords: ['synapse'], text: 'Synapse: Brood within 2 are Linked (Fearless).',
    art: 'a tall hunched creature with a swollen glowing translucent cranium, psychic threads linking it to smaller beasts' }),
  c({ id: 'b_leech', name: 'Nightmaw Leech', faction: 'brood', cost: 3, power: 2, nerve: 3, speed: 2, cls: 'Beast', arch: ['synapse'],
    keywords: ['terror'], text: 'Terror: double Shock against Shaken targets.',
    art: 'an eel-like flying horror with a lamprey mouth latching onto a screaming soldier, others scattering' }),
  c({ id: 'b_overseer', name: 'Overmind Aspect', faction: 'brood', cost: 5, power: 3, nerve: 6, range: 2, cls: 'Synapse', arch: ['synapse'],
    keywords: ['synapseBig'], text: 'Heavy. Synapse (range 3). Linked Brood strike +1.',
    art: 'an enormous floating brain-beast trailing nerve tendrils, crowned with glowing nodes, a swarm below moving in unison' }),
  c({ id: 'b_scream', name: 'Psychic Scream', faction: 'brood', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['synapse'],
    keywords: [], tactic: { kind: 'scream' }, text: 'Target Synapse: enemies within 1 of it take 2 Shock immediately.',
    art: 'a synapse beast with its glowing cranium flaring, a visible shockwave of green psychic force knocking soldiers to their knees' }),

  // ════════════════════════ THE HUSH — "Unseen" ════════════════════════
  // Archetypes: PHANTOM (decoys & bluff), KNIVES (ambush assassins), DREAD (pure morale attack)
  c({ id: 'v_phantom', name: 'Phantom Echo', faction: 'hush', cost: 1, power: 1, nerve: 1, range: 0, speed: 2, cls: 'Illusion', arch: ['phantom'],
    keywords: ['decoy'], text: 'Decoy: when hit or revealed it vanishes (no Resolve lost) and Shocks adjacent enemies 1.',
    art: 'a holographic silhouette of a cloaked operative flickering and dissolving into glowing static in a dark ruined street' }),
  c({ id: 'v_projector', name: 'Shroud Lantern', faction: 'hush', cost: 2, power: 3, nerve: 0, range: 0, speed: 0, cls: 'Structure', arch: ['phantom', 'knives'],
    keywords: ['spawn', 'immobile', 'shroud', 'fearless'], text: 'Hush may be placed next to it even when touching enemies. Adjacent Hush re-cloak each round.',
    art: 'a tall spindly lantern-like device planted in the ground exhaling a dome of distortion haze, everything inside blurred' }),
  c({ id: 'v_weaver', name: 'Mirage Weaver', faction: 'hush', cost: 3, power: 1, nerve: 4, range: 2, cls: 'Psion', arch: ['phantom'],
    keywords: ['mirage'], text: 'End of round: conjures a cloaked Phantom Echo next to it (max 2).',
    art: 'a gaunt robed psion with hands raised conjuring illusory copies of soldiers out of glowing mist' }),
  c({ id: 'v_twins', name: 'Echo-Twin Operatives', faction: 'hush', cost: 2, power: 2, nerve: 3, speed: 2, cls: 'Operative', arch: ['phantom', 'knives'],
    keywords: ['echo'], text: 'When revealed, leaves a cloaked Phantom Echo behind.',
    art: 'two identical masked operatives back to back, one of them subtly translucent, blades drawn in a dark alley' }),
  c({ id: 'v_smoke', name: 'Smoke & Mirrors', faction: 'hush', cost: 1, power: 0, nerve: 0, cls: 'Tactic', arch: ['phantom', 'knives'],
    keywords: [], tactic: { kind: 'smoke' }, text: 'Target ally re-cloaks and conjures a Phantom Echo next to it.',
    art: 'a masked figure vanishing into a burst of violet smoke while three identical silhouettes step out of it' }),
  c({ id: 'v_blade', name: 'Hushblade Initiates', faction: 'hush', cost: 1, power: 2, nerve: 2, speed: 2, cls: 'Operative', arch: ['knives'],
    keywords: ['fade'], text: 'Fade: re-cloaks at end of round if no enemy is adjacent.',
    art: 'a slender masked assassin crouched on a rooftop ledge at night with twin curved blades, rain' }),
  c({ id: 'v_stalker', name: 'Glasswalk Stalkers', faction: 'hush', cost: 2, power: 2, nerve: 3, speed: 2, cls: 'Operative', arch: ['knives'],
    keywords: ['fade'], text: 'Fade: re-cloaks at end of round if no enemy is adjacent.',
    art: 'a half-invisible stalker in active camouflage, its body refracting the ruined city behind it, only an outline and a blade visible' }),
  c({ id: 'v_needle', name: 'Quiet Needle', faction: 'hush', cost: 3, power: 2, nerve: 2, range: 3, cls: 'Operative', arch: ['knives'],
    keywords: ['silent', 'lethal', 'ignoreCover', 'hunter'], text: 'Silent. Lethal. Ignores cover. Hunter.',
    art: 'a prone sniper wrapped in a cloak beneath a collapsed bridge, a long needle rifle, a single tracer streak into the fog' }),
  c({ id: 'v_skimmer', name: 'Nightglass Skiff', faction: 'hush', cost: 3, power: 3, nerve: 3, speed: 3, cls: 'Vehicle', arch: ['knives'],
    keywords: ['flying'], text: 'Flying.',
    art: 'a sleek black glass hover-skiff with no lights skimming low over a dark marsh, masked riders leaning out with carbines' }),
  c({ id: 'v_faceless', name: 'The Faceless', faction: 'hush', cost: 5, power: 4, nerve: 4, speed: 2, cls: 'Operative', arch: ['knives'],
    keywords: ['assassinate', 'hunter'], text: 'Heavy. Hunter. Assassinate: its ambush is Lethal and +3 vs Officers and Synapses.',
    art: 'an elite assassin with a smooth featureless chrome mask reflecting a burning command tent, standing over a fallen officer' }),
  c({ id: 'v_knives', name: 'Night of Knives', faction: 'hush', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['knives'],
    keywords: [], tactic: { kind: 'knives' }, text: 'All your cloaked units strike +2 this round.',
    art: 'a dozen violet eye-slits opening in total darkness around a sleeping military camp, blades catching moonlight' }),
  c({ id: 'v_whisper', name: 'Rumor-Wright', faction: 'hush', cost: 2, power: 1, nerve: 3, range: 2, cls: 'Operative', arch: ['dread'],
    keywords: ['dirge'], text: 'Its Shock ignores support and officers.',
    art: 'a hooded figure whispering into a field radio in a shadowed alcove, leaflets swirling, a distant army camp lit by fires' }),
  c({ id: 'v_choir', name: 'Hollow Choir', faction: 'hush', cost: 3, power: 1, nerve: 4, range: 2, cls: 'Psion', arch: ['dread'],
    keywords: ['dread'], text: 'Dread: enemies within 2 cannot recover Nerve.',
    art: 'a circle of masked figures humming in fog, the air around them warped, distant soldiers covering their ears in dread' }),
  c({ id: 'v_herald', name: 'Dread Herald', faction: 'hush', cost: 4, power: 3, nerve: 4, range: 2, cls: 'Psion', arch: ['dread'],
    keywords: ['nightmare'], text: 'Nightmare: when revealed, every enemy within 2 takes 1 Shock.',
    art: 'a towering cloaked figure with a cracked mask and nothing behind it, enemy soldiers around it clutching their heads in terror' }),
  c({ id: 'v_false', name: 'False Orders', faction: 'hush', cost: 2, power: 0, nerve: 0, cls: 'Tactic', arch: ['dread', 'phantom'],
    keywords: [], tactic: { kind: 'falseOrders' }, text: 'Target enemy will not advance or strike this round, and takes 1 Shock.',
    art: 'an enemy radio operator listening in confusion to a distorted voice, a masked figure in the shadows behind them' }),

  // ════════════════════════ HQs (start on the board, not in decks) ════════════════════════
  c({ id: 'c_hq', name: 'Command Bunker', faction: 'concord', cost: 0, power: 12, nerve: 0, range: 0, speed: 0, cls: 'HQ', arch: [],
    keywords: ['hq', 'immobile', 'fearless'], text: 'HQ. Your army spreads out from here. Each adjacent enemy drains 1 Resolve per round.',
    art: 'a fortified command bunker of riveted plate and sandbags on a hill, radio masts and searchlights' }),
  c({ id: 'b_hq', name: 'Brood Heart', faction: 'brood', cost: 0, power: 12, nerve: 0, range: 0, speed: 0, cls: 'HQ', arch: [],
    keywords: ['hq', 'immobile', 'fearless'], text: 'HQ. Your army spreads out from here. Each adjacent enemy drains 1 Resolve per round.',
    art: 'a colossal pulsing heart-hive mound of flesh and chitin, birthing sacs glowing, tendrils spreading across the ground' }),
  c({ id: 'v_hq', name: 'Veil Nexus', faction: 'hush', cost: 0, power: 12, nerve: 0, range: 0, speed: 0, cls: 'HQ', arch: [],
    keywords: ['hq', 'immobile', 'fearless'], text: 'HQ. Your army spreads out from here. Each adjacent enemy drains 1 Resolve per round.',
    art: 'a hidden temple of dark stone half-dissolved into fog, masked sentinels at the gate, flickering illusions' }),
];

export const HQ_ID: Record<Faction, string> = { concord: 'c_hq', brood: 'b_hq', hush: 'v_hq' };

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((d) => [d.id, d]));

export const FACTION_INFO: Record<Faction, { name: string; color: string; blurb: string; archetypes: Record<string, string> }> = {
  concord: { name: 'Concord Vanguard', color: '#c8553d', blurb: 'Hold the line. Disciplined ranks that rout, then regroup.',
    archetypes: { gunline: 'Gunline: ranked riflemen and officers', bastion: 'Bastion: dig in, artillery, hold the relays', iron: 'Iron Tide: armoured charge' } },
  brood: { name: 'Vhorr Brood', color: '#8fbf3a', blurb: 'Swarm & evolve. Fearless when linked, feral when not.',
    archetypes: { tide: 'Endless Tide: drown them in bodies', apex: 'Apex: feed the monsters until they grow', synapse: 'Synaptic Terror: linked horrors that break minds' } },
  hush: { name: 'The Hush', color: '#7a5cff', blurb: 'Unseen. Cloaks, decoys and ambush; vanishes when broken.',
    archetypes: { phantom: 'Phantom Host: decoys and bluffs', knives: 'Night of Knives: ambush and assassinate', dread: 'Dread: break them without a fight' } },
};

/** Starter decks: 20 cards, built around one archetype with a splash of the rest. */
export function starterDeck(f: Faction, arch?: string): string[] {
  const pool = CARDS.filter((d) => d.faction === f && d.cls !== 'HQ');
  if (!arch) {
    // balanced: one of each + 5 cheapest duplicated
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
