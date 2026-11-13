export type Faction = 'concord' | 'brood' | 'hush';

export type UnitClass =
  | 'Infantry' | 'Vehicle' | 'Officer'
  | 'Beast' | 'Swarm' | 'Synapse'
  | 'Operative' | 'Psion' | 'Illusion'
  | 'Structure' | 'HQ';

export type Keyword =
  // concord
  | 'reinforceMorale' | 'volley' | 'officerAura' | 'rally' | 'digIn'
  | 'indirect' | 'ignoreCover' | 'highRange' | 'charge' | 'unflankable'
  | 'coverAura' | 'marshal' | 'barrage' | 'immobile'
  // brood
  | 'swarm5' | 'spawn' | 'creep' | 'burrow' | 'shriek' | 'infiltrate'
  | 'synapse' | 'synapseBig' | 'meltCover' | 'frenzy' | 'devour'
  // hush
  | 'flying' | 'decoy' | 'fade' | 'dirge' | 'silent' | 'shroud'
  | 'mirage' | 'nightmare' | 'assassinate'
  // generic
  | 'rapid' | 'hq';

export interface CardDef {
  id: string;
  name: string;
  faction: Faction;
  cost: number;
  power: number;   // ⚔ damage
  shock: number;   // ☠ morale damage
  str: number;     // ♥ strength
  morale: number;  // ⚑
  range: number;   // 0 = cannot attack, 1 melee, 2+ ranged
  speed: number;
  cls: UnitClass;
  keywords: Keyword[];
  text: string;
  art: string;     // art prompt subject (style is appended by the generator)
}

const c = (d: CardDef) => d;

export const CARDS: CardDef[] = [
  // ───────────────────────── CONCORD VANGUARD ─────────────────────────
  c({ id: 'c_trooper', name: 'Line Trooper', faction: 'concord', cost: 1, power: 1, shock: 1, str: 3, morale: 3, range: 1, speed: 1, cls: 'Infantry',
    keywords: ['reinforceMorale'], text: 'Reinforce: formation gains +1 ⚑ (above max).',
    art: 'a squad of weary colonial line infantry in olive greatcoats and rebreather masks, bayonet rifles, standing shoulder to shoulder in a muddy trench line on an alien world' }),
  c({ id: 'c_rifles', name: 'Rifle Section', faction: 'concord', cost: 2, power: 2, shock: 1, str: 3, morale: 3, range: 2, speed: 1, cls: 'Infantry',
    keywords: ['volley'], text: 'Volley: +1 ☠ against a target already attacked this round.',
    art: 'a kneeling rifle section of space-colonial soldiers firing a coordinated volley, muzzle flashes, spent casings, ash falling, red signal armbands' }),
  c({ id: 'c_lieutenant', name: 'Field Lieutenant', faction: 'concord', cost: 2, power: 1, shock: 0, str: 2, morale: 5, range: 1, speed: 1, cls: 'Officer',
    keywords: ['officerAura', 'rally'], text: 'Adjacent friendly formations take −1 ☠. Order: rally an adjacent Broken formation.',
    art: 'a scarred young officer with a peaked cap and pistol raised, shouting orders, greatcoat billowing, soldiers rallying behind them in smoke' }),
  c({ id: 'c_sapper', name: 'Sapper Team', faction: 'concord', cost: 2, power: 2, shock: 1, str: 2, morale: 3, range: 1, speed: 2, cls: 'Infantry',
    keywords: ['digIn'], text: 'Dig In: instead of attacking, fortify this hex (cover).',
    art: 'combat engineers in heavy work armor with shovels and demolition charges, building sandbag and plate-steel barricades under floodlights' }),
  c({ id: 'c_mortar', name: 'Mortar Crew', faction: 'concord', cost: 3, power: 1, shock: 3, str: 2, morale: 2, range: 3, speed: 1, cls: 'Infantry',
    keywords: ['indirect'], text: 'Indirect: no line of sight needed.',
    art: 'a two-soldier mortar crew dropping a glowing shell into a stubby tube, crater-pocked hillside, distant explosions lighting the overcast sky' }),
  c({ id: 'c_marksman', name: 'Longshot Marksman', faction: 'concord', cost: 2, power: 3, shock: 1, str: 1, morale: 2, range: 3, speed: 1, cls: 'Infantry',
    keywords: ['ignoreCover', 'highRange'], text: 'Ignores cover. +1 range on high ground.',
    art: 'a lone hooded sniper lying prone on a ruined gantry with a very long rail rifle, scope glint, cloak of scrap camouflage, vast alien wasteland below' }),
  c({ id: 'c_halftrack', name: 'Lancer Halftrack', faction: 'concord', cost: 3, power: 2, shock: 1, str: 4, morale: 3, range: 1, speed: 3, cls: 'Vehicle',
    keywords: ['charge', 'rapid'], text: 'Rapid. Charge: if it moved 2+ hexes this activation, +2 ☠.',
    art: 'a riveted armored halftrack with a ram plow and mounted autogun charging through dust, troops clinging to its sides, painted unit numbers' }),
  c({ id: 'c_walker', name: 'Bulwark Walker', faction: 'concord', cost: 4, power: 3, shock: 2, str: 6, morale: 4, range: 1, speed: 1, cls: 'Vehicle',
    keywords: ['unflankable', 'coverAura'], text: 'Cannot be flanked. Adjacent friendly Infantry count as in cover.',
    art: 'a huge two-legged armored walker with a riveted hull and heavy cannon, infantry sheltering behind its legs, smoke stacks, rain-soaked battlefield' }),
  c({ id: 'c_marshal', name: 'Signal Marshal', faction: 'concord', cost: 3, power: 0, shock: 0, str: 3, morale: 6, range: 0, speed: 1, cls: 'Officer',
    keywords: ['marshal'], text: 'End phase: Concord formations within 2 regain +1 ⚑.',
    art: 'a grizzled marshal standing beside a tall radio mast and a battle standard, loudspeaker horns, banners snapping in the wind, ranks of soldiers below' }),
  c({ id: 'c_battery', name: 'Hammerfall Battery', faction: 'concord', cost: 5, power: 3, shock: 3, str: 4, morale: 3, range: 4, speed: 0, cls: 'Vehicle',
    keywords: ['indirect', 'barrage', 'immobile'], text: 'Indirect. Immobile. Barrage: 1 ☠ to every formation adjacent to the target.',
    art: 'a colossal self-propelled artillery gun firing into the night, the recoil kicking up a wall of dust, crew covering their ears, sky lit orange' }),

  // ───────────────────────── VHORR BROOD ─────────────────────────
  c({ id: 'b_skitter', name: 'Skitterling Brood', faction: 'brood', cost: 1, power: 1, shock: 1, str: 2, morale: 2, range: 1, speed: 3, cls: 'Swarm',
    keywords: ['swarm5'], text: 'Swarm: stacks up to 5.',
    art: 'a tide of small chitinous many-legged alien creatures pouring over a ridge, dozens of glistening eyes, bruised purple carapaces' }),
  c({ id: 'b_pod', name: 'Spore Pod', faction: 'brood', cost: 1, power: 0, shock: 0, str: 3, morale: 3, range: 0, speed: 0, cls: 'Structure',
    keywords: ['spawn', 'creep', 'immobile'], text: 'Adjacent hexes are Creep. Brood may deploy adjacent to it even when touching enemies.',
    art: 'a pulsing fleshy alien spore pod rooted in the ground, veins spreading organic creep across cracked earth, bioluminescent green spores drifting' }),
  c({ id: 'b_lashworm', name: 'Lashworm', faction: 'brood', cost: 2, power: 2, shock: 1, str: 3, morale: 2, range: 2, speed: 2, cls: 'Beast',
    keywords: ['burrow'], text: 'Burrow: ignores zone of control when moving.',
    art: 'a huge segmented burrowing worm bursting from the soil, ring of hooked barbed tendrils lashing out, soil and rocks flying' }),
  c({ id: 'b_howler', name: 'Howler', faction: 'brood', cost: 2, power: 0, shock: 2, str: 2, morale: 2, range: 1, speed: 2, cls: 'Beast',
    keywords: ['shriek'], text: 'Shriek: its attack hits every adjacent enemy with ☠ only.',
    art: 'a gaunt eyeless alien beast with a split throat sac screaming, visible sonic distortion rings, soldiers in the distance covering their helmets' }),
  c({ id: 'b_mimic', name: 'Mimic Swarm', faction: 'brood', cost: 2, power: 1, shock: 2, str: 2, morale: 2, range: 1, speed: 2, cls: 'Swarm',
    keywords: ['infiltrate'], text: 'Infiltrate: may deploy touching enemies, or anywhere adjacent to Creep.',
    art: 'shadowy alien creatures mimicking human silhouettes emerging from fog behind a battle line, wrong proportions, too many joints' }),
  c({ id: 'b_synapse', name: 'Synapse Warden', faction: 'brood', cost: 3, power: 1, shock: 2, str: 4, morale: 5, range: 1, speed: 1, cls: 'Synapse',
    keywords: ['synapse'], text: 'Synapse: links Brood within 2 (they ignore ☠).',
    art: 'a tall hunched alien creature with a swollen glowing translucent cranium, psychic tendrils linking it to smaller beasts around it' }),
  c({ id: 'b_spitter', name: 'Acid Spitter', faction: 'brood', cost: 3, power: 2, shock: 1, str: 2, morale: 2, range: 3, speed: 1, cls: 'Beast',
    keywords: ['meltCover'], text: 'Its attacks remove cover/fortification from the target hex.',
    art: 'a bloated six-legged alien artillery beast arching back and spewing a glowing green arc of acid, metal barricades melting' }),
  c({ id: 'b_ravager', name: 'Ravager', faction: 'brood', cost: 4, power: 4, shock: 2, str: 5, morale: 3, range: 1, speed: 2, cls: 'Beast',
    keywords: ['frenzy'], text: 'Frenzy: +1 ⚔ per other Brood formation adjacent to the target.',
    art: 'a hulking armored alien predator with scythe forelimbs mid-leap, plated carapace, drool, overturned vehicle behind it' }),
  c({ id: 'b_overseer', name: 'Hivemind Overseer', faction: 'brood', cost: 5, power: 2, shock: 2, str: 5, morale: 6, range: 2, speed: 1, cls: 'Synapse',
    keywords: ['synapseBig'], text: 'Synapse (range 3). Linked Brood get +1 ⚔.',
    art: 'an enormous floating alien brain-beast trailing nerve tendrils, crowned with glowing nodes, a swarm below moving in perfect unison' }),
  c({ id: 'b_gorgemaw', name: 'Gorgemaw', faction: 'brood', cost: 5, power: 4, shock: 4, str: 8, morale: 3, range: 1, speed: 1, cls: 'Beast',
    keywords: ['devour'], text: 'Devour: when it destroys a card, heal 3 and 2 ☠ to adjacent enemies.',
    art: 'a colossal alien beast that is mostly mouth, rows of teeth, swallowing a tank whole, horrified soldiers fleeing in the foreground' }),

  // ───────────────────────── THE HUSH (stealth / deception) ─────────────────────────
  c({ id: 'v_blade', name: 'Hushblade', faction: 'hush', cost: 1, power: 2, shock: 1, str: 1, morale: 2, range: 1, speed: 2, cls: 'Operative',
    keywords: [], text: 'A knife in the dark.',
    art: 'a slender masked assassin in layered dark-teal wraps crouched on a rooftop ledge at night, twin curved monomolecular blades, faint violet glow from the mask eye slits, rain' }),
  c({ id: 'v_phantom', name: 'Phantom', faction: 'hush', cost: 1, power: 0, shock: 0, str: 1, morale: 1, range: 0, speed: 2, cls: 'Illusion',
    keywords: ['decoy'], text: 'Decoy: when revealed or attacked it vanishes (no Resolve loss) and deals 1 ☠ to adjacent enemies.',
    art: 'a ghostly holographic silhouette of a cloaked soldier flickering and dissolving into violet static and smoke in a dark ruined street' }),
  c({ id: 'v_stalker', name: 'Veil Stalker', faction: 'hush', cost: 2, power: 2, shock: 1, str: 2, morale: 3, range: 1, speed: 2, cls: 'Operative',
    keywords: ['fade'], text: 'Fade: at end phase, re-cloaks if no enemy is adjacent.',
    art: 'a half-invisible stalker in an active-camouflage suit, its body shimmering and refracting the ruined city behind it, only the outline and a gleaming blade visible' }),
  c({ id: 'v_whisper', name: 'Whisper Agent', faction: 'hush', cost: 2, power: 0, shock: 2, str: 2, morale: 3, range: 2, speed: 2, cls: 'Operative',
    keywords: ['dirge', 'silent'], text: 'Sow Doubt: its ☠ ignores Support and officer auras. Silent: attacking does not reveal it.',
    art: 'a hooded figure whispering into a field radio in a shadowed alcove, propaganda leaflets swirling in the wind, a distant army camp lit by fires' }),
  c({ id: 'v_projector', name: 'Shroud Projector', faction: 'hush', cost: 2, power: 0, shock: 0, str: 3, morale: 3, range: 0, speed: 0, cls: 'Structure',
    keywords: ['spawn', 'immobile', 'shroud'], text: 'Hush may deploy adjacent even when touching enemies. Adjacent Hush formations re-cloak at end phase.',
    art: 'a tall spindly alien device planted in the ground emitting a dome of violet distortion haze, everything inside it blurred and indistinct' }),
  c({ id: 'v_needle', name: 'Needle Sniper', faction: 'hush', cost: 3, power: 3, shock: 2, str: 1, morale: 2, range: 3, speed: 1, cls: 'Operative',
    keywords: ['silent', 'ignoreCover'], text: 'Silent. Ignores cover.',
    art: 'a prone sniper wrapped in a dark-teal cloak beneath a collapsed bridge, a long needle rifle with a violet scope, a single tracer line streaking into the fog' }),
  c({ id: 'v_weaver', name: 'Mirage Weaver', faction: 'hush', cost: 3, power: 0, shock: 1, str: 2, morale: 4, range: 2, speed: 1, cls: 'Psion',
    keywords: ['mirage'], text: 'End phase: create a cloaked Phantom on an adjacent empty hex (max 2 Phantoms on board).',
    art: 'a gaunt robed psion with hands raised conjuring multiple illusory copies of soldiers out of violet mist, the copies staring blankly' }),
  c({ id: 'v_skimmer', name: 'Nightglass Skimmer', faction: 'hush', cost: 3, power: 2, shock: 2, str: 3, morale: 3, range: 1, speed: 4, cls: 'Vehicle',
    keywords: ['flying', 'rapid'], text: 'Flying. Rapid.',
    art: 'a sleek black glass hover-skiff with no lights skimming low over a dark marsh, riders in masks leaning out with carbines, mist trailing' }),
  c({ id: 'v_herald', name: 'Dread Herald', faction: 'hush', cost: 4, power: 1, shock: 3, str: 3, morale: 4, range: 2, speed: 1, cls: 'Psion',
    keywords: ['nightmare'], text: 'Nightmare: when it is revealed, every enemy formation within 2 takes 1 ☠.',
    art: 'a towering cloaked figure with a cracked porcelain mask and no face behind it, enemy soldiers around it clutching their heads in terror, violet light' }),
  c({ id: 'v_faceless', name: 'The Faceless', faction: 'hush', cost: 5, power: 4, shock: 3, str: 4, morale: 4, range: 1, speed: 2, cls: 'Operative',
    keywords: ['assassinate'], text: 'Assassinate: Ambush attacks against an Officer or Synapse deal +3 ⚔.',
    art: 'an elite assassin with a smooth featureless chrome mask reflecting a burning command tent, standing over a fallen officer, long coat, blade dripping' }),
  // ───────────────────────── HQs (start on the board, not in decks) ─────────────────────────
  c({ id: 'c_hq', name: 'Command Bunker', faction: 'concord', cost: 0, power: 0, shock: 0, str: 12, morale: 9, range: 0, speed: 0, cls: 'HQ',
    keywords: ['hq', 'immobile'], text: 'HQ. Your army deploys outward from here. Each adjacent enemy drains 1 Resolve per round.',
    art: 'a fortified colonial command bunker of riveted plate and sandbags on a hill, radio masts and searchlights, red signal flags, armored doors' }),
  c({ id: 'b_hq', name: 'Brood Heart', faction: 'brood', cost: 0, power: 0, shock: 0, str: 12, morale: 9, range: 0, speed: 0, cls: 'HQ',
    keywords: ['hq', 'immobile'], text: 'HQ. Your army deploys outward from here. Each adjacent enemy drains 1 Resolve per round.',
    art: 'a colossal pulsing alien heart-hive mound of flesh and chitin, birthing sacs glowing bile green, tendrils spreading across the ground' }),
  c({ id: 'v_hq', name: 'Veil Nexus', faction: 'hush', cost: 0, power: 0, shock: 0, str: 12, morale: 9, range: 0, speed: 0, cls: 'HQ',
    keywords: ['hq', 'immobile'], text: 'HQ. Your army deploys outward from here. Each adjacent enemy drains 1 Resolve per round.',
    art: 'a hidden temple-like structure of dark teal stone half-dissolved into violet fog, masked sentinels at the gate, flickering illusions' }),
];

export const HQ_ID: Record<Faction, string> = { concord: 'c_hq', brood: 'b_hq', hush: 'v_hq' };

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((d) => [d.id, d]));

export const FACTION_INFO: Record<Faction, { name: string; color: string; blurb: string }> = {
  concord: { name: 'Concord Vanguard', color: '#c8553d', blurb: 'Discipline & firing lines. Routs, regroups.' },
  brood:   { name: 'Vhorr Brood',      color: '#8fbf3a', blurb: 'Swarm & evolve. Fearless when linked, feral when not; grows as it feeds.' },
  hush:    { name: 'The Hush',         color: '#7a5cff', blurb: 'Cloaks, decoys & ambush. Strikes unseen, vanishes when broken.' },
};

export function starterDeck(f: Faction): string[] {
  return CARDS.filter((d) => d.faction === f && d.cls !== 'HQ').flatMap((d) => [d.id, d.id]);
}
