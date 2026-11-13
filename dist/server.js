// src/server/index.ts
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";

// src/shared/cards.ts
var rangeOf = (d) => d.range ?? 1;
var speedOf = (d) => d.speed ?? 1;
var isTactic = (d) => d.cls === "Tactic";
var isHeavy = (d) => d.cost >= 5 && !isTactic(d);
var c = (d) => d;
var CARDS = [
  // ════════════════════════ CONCORD VANGUARD — "Hold the line" ════════════════════════
  // Archetypes: GUNLINE (ranged rows + officers), BASTION (dig in, artillery, hold relays), IRON TIDE (armour push)
  c({
    id: "c_trooper",
    name: "Dustcoat Fusiliers",
    faction: "concord",
    cost: 1,
    power: 2,
    nerve: 3,
    cls: "Infantry",
    arch: ["gunline", "bastion"],
    keywords: [],
    text: "",
    art: "a squad of weary fusiliers standing shoulder to shoulder in a muddy trench line, bayonet rail-rifles raised"
  }),
  c({
    id: "c_rifles",
    name: "Ashline Riflemen",
    faction: "concord",
    cost: 2,
    power: 2,
    nerve: 3,
    range: 2,
    cls: "Infantry",
    arch: ["gunline"],
    keywords: ["volley"],
    text: "Volley: +1 if another ally hits the same target this round.",
    art: "a kneeling rifle section firing a coordinated volley, muzzle flashes and ash falling"
  }),
  c({
    id: "c_lieutenant",
    name: "Whistle-Lieutenant",
    faction: "concord",
    cost: 2,
    power: 1,
    nerve: 5,
    cls: "Officer",
    arch: ["gunline", "iron"],
    keywords: ["officerAura", "rally"],
    text: "Adjacent allies strike +1. Adjacent Broken allies rally at end of round.",
    art: "a scarred young officer with a whistle in their teeth and a pistol raised, waving soldiers forward out of the smoke"
  }),
  c({
    id: "c_sergeant",
    name: "Colour Sergeant Hale",
    faction: "concord",
    cost: 3,
    power: 2,
    nerve: 6,
    cls: "Officer",
    arch: ["gunline", "bastion"],
    keywords: ["standard"],
    text: "Standard: adjacent allies take 1 less Shock.",
    art: "a broad-shouldered sergeant planting a tattered battle standard into the mud, bullets cracking past, refusing to move"
  }),
  c({
    id: "c_marksman",
    name: '"Widow" Varn, Longshot',
    faction: "concord",
    cost: 3,
    power: 2,
    nerve: 2,
    range: 3,
    cls: "Infantry",
    arch: ["gunline"],
    keywords: ["lethal", "ignoreCover", "hunter"],
    text: "Lethal. Ignores cover. Hunter: targets the costliest enemy in range.",
    art: "a lone hooded sniper lying prone on a ruined gantry with an extremely long rail rifle, scope glint, scrap-cloth camouflage"
  }),
  c({
    id: "c_sapper",
    name: "Mole Brigade Sappers",
    faction: "concord",
    cost: 2,
    power: 2,
    nerve: 3,
    cls: "Infantry",
    arch: ["bastion"],
    keywords: ["digIn"],
    text: "Dig In: fortifies its hex (cover) when placed. Never advances.",
    art: "combat engineers with shovels and demolition charges building plate-steel barricades under floodlights"
  }),
  c({
    id: "c_pillbox",
    name: "Bastion Pillbox",
    faction: "concord",
    cost: 2,
    power: 4,
    nerve: 0,
    range: 2,
    speed: 0,
    cls: "Structure",
    arch: ["bastion"],
    keywords: ["immobile", "fearless"],
    text: "Fearless. Immobile. Ranged.",
    art: "a squat concrete-and-plate pillbox with a heavy gun slit spitting tracer fire into the night"
  }),
  c({
    id: "c_mortar",
    name: "Rainmaker Mortar Team",
    faction: "concord",
    cost: 3,
    power: 2,
    nerve: 2,
    range: 3,
    cls: "Infantry",
    arch: ["bastion"],
    keywords: ["indirect", "barrage"],
    text: "Indirect. Barrage: 1 Shock to every unit next to its target.",
    art: "a two-soldier mortar crew dropping a glowing shell into a stubby tube on a cratered hillside, explosions lighting low clouds"
  }),
  c({
    id: "c_battery",
    name: "Hammerfall 380 Battery",
    faction: "concord",
    cost: 5,
    power: 3,
    nerve: 3,
    range: 4,
    speed: 0,
    cls: "Vehicle",
    arch: ["bastion"],
    keywords: ["indirect", "lethal", "barrage", "immobile"],
    text: "Heavy. Indirect. Lethal. Barrage. Immobile.",
    art: "a colossal self-propelled artillery gun firing into the night, recoil blasting a wall of dust, crew covering their ears"
  }),
  c({
    id: "c_halftrack",
    name: "Lancer Ram-Track",
    faction: "concord",
    cost: 3,
    power: 3,
    nerve: 4,
    speed: 2,
    cls: "Vehicle",
    arch: ["iron"],
    keywords: ["charge"],
    text: "Charge: +2 the round it moves into contact.",
    art: "a riveted armored halftrack with a huge ram plow charging through dust, soldiers clinging to its sides"
  }),
  c({
    id: "c_walker",
    name: "Bulwark Mk.III Walker",
    faction: "concord",
    cost: 4,
    power: 5,
    nerve: 5,
    cls: "Vehicle",
    arch: ["iron", "bastion"],
    keywords: ["unflankable", "coverAura"],
    text: "Cannot be flanked. Adjacent Infantry are in cover.",
    art: "a huge two-legged armored walker with a heavy cannon, infantry sheltering behind its legs in the rain"
  }),
  c({
    id: "c_tank",
    name: "Iron Saint Siege-Crawler",
    faction: "concord",
    cost: 6,
    power: 7,
    nerve: 5,
    range: 2,
    cls: "Vehicle",
    arch: ["iron"],
    keywords: ["lethal", "breach", "unflankable"],
    text: "Heavy. Lethal. Cannot be flanked. Breach: +3 against Structures and HQs.",
    art: "a cathedral-sized siege crawler on grinding treads with a massive cannon, votive banners and searchlights, infantry marching in its shadow"
  }),
  c({
    id: "c_overthetop",
    name: "Over the Top!",
    faction: "concord",
    cost: 1,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["iron", "gunline"],
    keywords: [],
    tactic: { kind: "overTheTop" },
    text: "Order an ally: +1 speed and Charge (+2) this round.",
    art: "soldiers climbing out of a trench at the whistle into smoke and searchlights, bayonets fixed, a single flare overhead"
  }),
  c({
    id: "c_holdfast",
    name: "Hold Fast",
    faction: "concord",
    cost: 1,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["bastion", "gunline"],
    keywords: [],
    tactic: { kind: "holdFast" },
    text: "Order an ally: +3 Nerve, it holds its ground this round.",
    art: "a line of soldiers bracing behind a barricade as a dark wave approaches, an officer with a raised sword holding them steady"
  }),
  c({
    id: "c_broadcast",
    name: "Loudhorn Broadcast",
    faction: "concord",
    cost: 2,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["gunline", "bastion", "iron"],
    keywords: [],
    tactic: { kind: "broadcast" },
    text: "Allies within 2 of the target recover 2 Nerve; Broken ones rally.",
    art: "a towering loudspeaker mast blaring over a battlefield at dusk, soldiers lifting their heads, banners snapping"
  }),
  // ════════════════════════ VHORR BROOD — "Swarm & evolve" ════════════════════════
  // Archetypes: TIDE (endless cheap swarms), APEX (feed & grow monsters), SYNAPSE (linked terror)
  c({
    id: "b_skitter",
    name: "Skitterling Tide",
    faction: "brood",
    cost: 1,
    power: 1,
    nerve: 2,
    speed: 2,
    cls: "Swarm",
    arch: ["tide"],
    keywords: ["swarm5"],
    text: "Stacks up to 5.",
    art: "a tide of small many-legged creatures pouring over a ridge, dozens of glistening black eyes"
  }),
  c({
    id: "b_pod",
    name: "Sporemother Pod",
    faction: "brood",
    cost: 2,
    power: 3,
    nerve: 0,
    range: 0,
    speed: 0,
    cls: "Structure",
    arch: ["tide"],
    keywords: ["spawn", "creep", "immobile", "fearless", "hatch"],
    text: "Creep around it. Hatch: each round, births a Skitterling next to it (max 2 alive).",
    art: "a pulsing fleshy spore pod rooted in cracked earth, veins of organic creep spreading outward, spores drifting"
  }),
  c({
    id: "b_mimic",
    name: "Skinwalker Mimics",
    faction: "brood",
    cost: 2,
    power: 2,
    nerve: 2,
    speed: 2,
    cls: "Swarm",
    arch: ["tide", "synapse"],
    keywords: ["infiltrate"],
    text: "Infiltrate: may be placed touching enemies, or anywhere next to Creep.",
    art: "creatures mimicking human silhouettes emerging from fog behind a battle line, wrong proportions, too many joints"
  }),
  c({
    id: "b_spawning",
    name: "Brood Spawning",
    faction: "brood",
    cost: 3,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["tide"],
    keywords: [],
    tactic: { kind: "spawning" },
    text: "Target ally births 2 Skitterlings next to it.",
    art: "a split-open birthing sac spilling out a wave of glistening newborn creatures onto organic creep"
  }),
  c({
    id: "b_grub",
    name: "Broodling Grub",
    faction: "brood",
    cost: 1,
    power: 1,
    nerve: 2,
    cls: "Beast",
    arch: ["apex"],
    keywords: ["grub"],
    text: "Grows +1 Power at the end of every round (max +4).",
    art: "a fat pale larval creature curled on the ground, translucent skin showing something large forming inside"
  }),
  c({
    id: "b_lashworm",
    name: "Lashworm Burrower",
    faction: "brood",
    cost: 2,
    power: 2,
    nerve: 2,
    range: 2,
    speed: 2,
    cls: "Beast",
    arch: ["apex"],
    keywords: ["burrow"],
    text: "Burrow: moves through anything.",
    art: "a huge segmented worm bursting from the soil, ring of barbed tendrils lashing outward, rocks flying"
  }),
  c({
    id: "b_spitter",
    name: "Acidbelly Spitter",
    faction: "brood",
    cost: 3,
    power: 2,
    nerve: 2,
    range: 3,
    cls: "Beast",
    arch: ["apex", "synapse"],
    keywords: ["lethal", "meltCover"],
    text: "Lethal. Melts cover off its target hex.",
    art: "a bloated six-legged beast arching its back and spewing a glowing arc of acid, metal barricades melting"
  }),
  c({
    id: "b_ravager",
    name: "Scythe Ravager",
    faction: "brood",
    cost: 4,
    power: 4,
    nerve: 3,
    speed: 2,
    cls: "Beast",
    arch: ["apex", "tide"],
    keywords: ["frenzy"],
    text: "Frenzy: +1 for every other Brood next to its target.",
    art: "a hulking armored predator with scythe forelimbs mid-leap over an overturned vehicle"
  }),
  c({
    id: "b_gorgemaw",
    name: "The Gorgemaw",
    faction: "brood",
    cost: 6,
    power: 7,
    nerve: 3,
    cls: "Beast",
    arch: ["apex"],
    keywords: ["lethal", "devour"],
    text: "Heavy. Lethal. Devour: on a kill, heals 3 and Shocks adjacent enemies 2.",
    art: "a colossal beast that is mostly mouth and rows of teeth, swallowing a tank whole, soldiers fleeing in the foreground"
  }),
  c({
    id: "b_pheromone",
    name: "Frenzy Pheromone",
    faction: "brood",
    cost: 1,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["apex", "tide"],
    keywords: [],
    tactic: { kind: "pheromone" },
    text: "Target ally and adjacent Brood strike +2 this round.",
    art: "a cloud of glowing spores bursting over a pack of beasts, their eyes flaring, muscles swelling, jaws wide"
  }),
  c({
    id: "b_howler",
    name: "Throat-Sac Howler",
    faction: "brood",
    cost: 2,
    power: 2,
    nerve: 2,
    speed: 2,
    cls: "Beast",
    arch: ["synapse"],
    keywords: ["shriek"],
    text: "Shriek: strikes every adjacent enemy.",
    art: "a gaunt eyeless beast with a swollen split throat sac screaming, visible sonic distortion rings"
  }),
  c({
    id: "b_synapse",
    name: "Thoughtstalk Warden",
    faction: "brood",
    cost: 3,
    power: 2,
    nerve: 5,
    cls: "Synapse",
    arch: ["synapse", "tide"],
    keywords: ["synapse"],
    text: "Synapse: Brood within 2 are Linked (Fearless).",
    art: "a tall hunched creature with a swollen glowing translucent cranium, psychic threads linking it to smaller beasts"
  }),
  c({
    id: "b_leech",
    name: "Nightmaw Leech",
    faction: "brood",
    cost: 3,
    power: 2,
    nerve: 3,
    speed: 2,
    cls: "Beast",
    arch: ["synapse"],
    keywords: ["terror"],
    text: "Terror: double Shock against Shaken targets.",
    art: "an eel-like flying horror with a lamprey mouth latching onto a screaming soldier, others scattering"
  }),
  c({
    id: "b_overseer",
    name: "Overmind Aspect",
    faction: "brood",
    cost: 5,
    power: 3,
    nerve: 6,
    range: 2,
    cls: "Synapse",
    arch: ["synapse"],
    keywords: ["synapseBig"],
    text: "Heavy. Synapse (range 3). Linked Brood strike +1.",
    art: "an enormous floating brain-beast trailing nerve tendrils, crowned with glowing nodes, a swarm below moving in unison"
  }),
  c({
    id: "b_scream",
    name: "Psychic Scream",
    faction: "brood",
    cost: 2,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["synapse"],
    keywords: [],
    tactic: { kind: "scream" },
    text: "Target Synapse: enemies within 1 of it take 2 Shock immediately.",
    art: "a synapse beast with its glowing cranium flaring, a visible shockwave of green psychic force knocking soldiers to their knees"
  }),
  // ════════════════════════ THE HUSH — "Unseen" ════════════════════════
  // Archetypes: PHANTOM (decoys & bluff), KNIVES (ambush assassins), DREAD (pure morale attack)
  c({
    id: "v_phantom",
    name: "Phantom Echo",
    faction: "hush",
    cost: 1,
    power: 1,
    nerve: 1,
    range: 0,
    speed: 2,
    cls: "Illusion",
    arch: ["phantom"],
    keywords: ["decoy"],
    text: "Decoy: when hit or revealed it vanishes (no Resolve lost) and Shocks adjacent enemies 1.",
    art: "a holographic silhouette of a cloaked operative flickering and dissolving into glowing static in a dark ruined street"
  }),
  c({
    id: "v_projector",
    name: "Shroud Lantern",
    faction: "hush",
    cost: 2,
    power: 3,
    nerve: 0,
    range: 0,
    speed: 0,
    cls: "Structure",
    arch: ["phantom", "knives"],
    keywords: ["spawn", "immobile", "shroud", "fearless"],
    text: "Hush may be placed next to it even when touching enemies. Adjacent Hush re-cloak each round.",
    art: "a tall spindly lantern-like device planted in the ground exhaling a dome of distortion haze, everything inside blurred"
  }),
  c({
    id: "v_weaver",
    name: "Mirage Weaver",
    faction: "hush",
    cost: 3,
    power: 1,
    nerve: 4,
    range: 2,
    cls: "Psion",
    arch: ["phantom"],
    keywords: ["mirage"],
    text: "End of round: conjures a cloaked Phantom Echo next to it (max 2).",
    art: "a gaunt robed psion with hands raised conjuring illusory copies of soldiers out of glowing mist"
  }),
  c({
    id: "v_twins",
    name: "Echo-Twin Operatives",
    faction: "hush",
    cost: 2,
    power: 2,
    nerve: 3,
    speed: 2,
    cls: "Operative",
    arch: ["phantom", "knives"],
    keywords: ["echo"],
    text: "When revealed, leaves a cloaked Phantom Echo behind.",
    art: "two identical masked operatives back to back, one of them subtly translucent, blades drawn in a dark alley"
  }),
  c({
    id: "v_smoke",
    name: "Smoke & Mirrors",
    faction: "hush",
    cost: 1,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["phantom", "knives"],
    keywords: [],
    tactic: { kind: "smoke" },
    text: "Target ally re-cloaks and conjures a Phantom Echo next to it.",
    art: "a masked figure vanishing into a burst of violet smoke while three identical silhouettes step out of it"
  }),
  c({
    id: "v_blade",
    name: "Hushblade Initiates",
    faction: "hush",
    cost: 1,
    power: 2,
    nerve: 2,
    speed: 2,
    cls: "Operative",
    arch: ["knives"],
    keywords: ["fade"],
    text: "Fade: re-cloaks at end of round if no enemy is adjacent.",
    art: "a slender masked assassin crouched on a rooftop ledge at night with twin curved blades, rain"
  }),
  c({
    id: "v_stalker",
    name: "Glasswalk Stalkers",
    faction: "hush",
    cost: 2,
    power: 2,
    nerve: 3,
    speed: 2,
    cls: "Operative",
    arch: ["knives"],
    keywords: ["fade"],
    text: "Fade: re-cloaks at end of round if no enemy is adjacent.",
    art: "a half-invisible stalker in active camouflage, its body refracting the ruined city behind it, only an outline and a blade visible"
  }),
  c({
    id: "v_needle",
    name: "Quiet Needle",
    faction: "hush",
    cost: 3,
    power: 2,
    nerve: 2,
    range: 3,
    cls: "Operative",
    arch: ["knives"],
    keywords: ["silent", "lethal", "ignoreCover", "hunter"],
    text: "Silent. Lethal. Ignores cover. Hunter.",
    art: "a prone sniper wrapped in a cloak beneath a collapsed bridge, a long needle rifle, a single tracer streak into the fog"
  }),
  c({
    id: "v_skimmer",
    name: "Nightglass Skiff",
    faction: "hush",
    cost: 3,
    power: 3,
    nerve: 3,
    speed: 3,
    cls: "Vehicle",
    arch: ["knives"],
    keywords: ["flying"],
    text: "Flying.",
    art: "a sleek black glass hover-skiff with no lights skimming low over a dark marsh, masked riders leaning out with carbines"
  }),
  c({
    id: "v_faceless",
    name: "The Faceless",
    faction: "hush",
    cost: 5,
    power: 4,
    nerve: 4,
    speed: 2,
    cls: "Operative",
    arch: ["knives"],
    keywords: ["assassinate", "hunter"],
    text: "Heavy. Hunter. Assassinate: its ambush is Lethal and +3 vs Officers and Synapses.",
    art: "an elite assassin with a smooth featureless chrome mask reflecting a burning command tent, standing over a fallen officer"
  }),
  c({
    id: "v_knives",
    name: "Night of Knives",
    faction: "hush",
    cost: 2,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["knives"],
    keywords: [],
    tactic: { kind: "knives" },
    text: "All your cloaked units strike +2 this round.",
    art: "a dozen violet eye-slits opening in total darkness around a sleeping military camp, blades catching moonlight"
  }),
  c({
    id: "v_whisper",
    name: "Rumor-Wright",
    faction: "hush",
    cost: 2,
    power: 1,
    nerve: 3,
    range: 2,
    cls: "Operative",
    arch: ["dread"],
    keywords: ["dirge"],
    text: "Its Shock ignores support and officers.",
    art: "a hooded figure whispering into a field radio in a shadowed alcove, leaflets swirling, a distant army camp lit by fires"
  }),
  c({
    id: "v_choir",
    name: "Hollow Choir",
    faction: "hush",
    cost: 3,
    power: 1,
    nerve: 4,
    range: 2,
    cls: "Psion",
    arch: ["dread"],
    keywords: ["dread"],
    text: "Dread: enemies within 2 cannot recover Nerve.",
    art: "a circle of masked figures humming in fog, the air around them warped, distant soldiers covering their ears in dread"
  }),
  c({
    id: "v_herald",
    name: "Dread Herald",
    faction: "hush",
    cost: 4,
    power: 3,
    nerve: 4,
    range: 2,
    cls: "Psion",
    arch: ["dread"],
    keywords: ["nightmare"],
    text: "Nightmare: when revealed, every enemy within 2 takes 1 Shock.",
    art: "a towering cloaked figure with a cracked mask and nothing behind it, enemy soldiers around it clutching their heads in terror"
  }),
  c({
    id: "v_false",
    name: "False Orders",
    faction: "hush",
    cost: 2,
    power: 0,
    nerve: 0,
    cls: "Tactic",
    arch: ["dread", "phantom"],
    keywords: [],
    tactic: { kind: "falseOrders" },
    text: "Target enemy will not advance or strike this round, and takes 1 Shock.",
    art: "an enemy radio operator listening in confusion to a distorted voice, a masked figure in the shadows behind them"
  }),
  // ════════════════════════ HQs (start on the board, not in decks) ════════════════════════
  c({
    id: "c_hq",
    name: "Command Bunker",
    faction: "concord",
    cost: 0,
    power: 12,
    nerve: 0,
    range: 0,
    speed: 0,
    cls: "HQ",
    arch: [],
    keywords: ["hq", "immobile", "fearless"],
    text: "HQ. Your army spreads out from here. Each adjacent enemy drains 1 Resolve per round.",
    art: "a fortified command bunker of riveted plate and sandbags on a hill, radio masts and searchlights"
  }),
  c({
    id: "b_hq",
    name: "Brood Heart",
    faction: "brood",
    cost: 0,
    power: 12,
    nerve: 0,
    range: 0,
    speed: 0,
    cls: "HQ",
    arch: [],
    keywords: ["hq", "immobile", "fearless"],
    text: "HQ. Your army spreads out from here. Each adjacent enemy drains 1 Resolve per round.",
    art: "a colossal pulsing heart-hive mound of flesh and chitin, birthing sacs glowing, tendrils spreading across the ground"
  }),
  c({
    id: "v_hq",
    name: "Veil Nexus",
    faction: "hush",
    cost: 0,
    power: 12,
    nerve: 0,
    range: 0,
    speed: 0,
    cls: "HQ",
    arch: [],
    keywords: ["hq", "immobile", "fearless"],
    text: "HQ. Your army spreads out from here. Each adjacent enemy drains 1 Resolve per round.",
    art: "a hidden temple of dark stone half-dissolved into fog, masked sentinels at the gate, flickering illusions"
  })
];
var HQ_ID = { concord: "c_hq", brood: "b_hq", hush: "v_hq" };
var UNKNOWN_CARD = { id: "?", name: "Unknown", faction: "hush", cost: 0, power: 2, nerve: 3, cls: "Operative", arch: [], keywords: [], text: "Cloaked. Get adjacent to reveal it.", art: "" };
var CARD_BY_ID = { ...Object.fromEntries(CARDS.map((d) => [d.id, d])), "?": UNKNOWN_CARD };
function starterDeck(f, arch) {
  const pool = CARDS.filter((d) => d.faction === f && d.cls !== "HQ");
  if (!arch) {
    const cheap = [...pool].sort((a, b) => a.cost - b.cost).slice(0, 5);
    return [...pool, ...cheap].map((d) => d.id);
  }
  const core = pool.filter((d) => d.arch.includes(arch));
  const rest = pool.filter((d) => !d.arch.includes(arch)).sort((a, b) => a.cost - b.cost);
  const deck = [];
  for (const d of core) deck.push(d.id, d.id);
  for (const d of rest) if (deck.length < 20) deck.push(d.id);
  return deck.slice(0, 20);
}

// src/shared/hex.ts
var ROWS = 7;
var rowWidth = (row) => row % 2 === 0 ? 6 : 7;
var key = (p) => `${p.col},${p.row}`;
var samePos = (a, b) => a.col === b.col && a.row === b.row;
function inBounds(p) {
  return p.row >= 0 && p.row < ROWS && p.col >= 0 && p.col < rowWidth(p.row);
}
function toAxial(p) {
  return { q: p.col - (p.row + (p.row & 1) >> 1), r: p.row };
}
function fromAxial(q, r) {
  return { col: q + (r + (r & 1) >> 1), row: r };
}
var AXIAL_DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1]
];
function neighbors(p) {
  const a = toAxial(p);
  const out = [];
  for (const [dq, dr] of AXIAL_DIRS) {
    const n = fromAxial(a.q + dq, a.r + dr);
    if (inBounds(n)) out.push(n);
  }
  return out;
}
function distance(a, b) {
  const A = toAxial(a), B = toAxial(b);
  const dq = A.q - B.q, dr = A.r - B.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
function lineBetween(a, b) {
  const n = distance(a, b);
  if (n <= 1) return [];
  const A = toAxial(a), B = toAxial(b);
  const out = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const q = A.q + (B.q - A.q) * t + 1e-6;
    const r = A.r + (B.r - A.r) * t + 1e-6;
    out.push(cubeRound(q, r));
  }
  return out;
}
function cubeRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return fromAxial(rq, rr);
}
function mirror(p) {
  const a = toAxial(p);
  return fromAxial(2 - a.q, 6 - a.r);
}
function allHexes() {
  const out = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < rowWidth(row); col++) out.push({ col, row });
  return out;
}

// src/shared/map.ts
var HALF = {
  // row 0 (6 wide) - player 1 home edge
  "2,0": { elev: 1, terrain: "open" },
  "3,0": { elev: 1, terrain: "open" },
  // row 1 (7 wide)
  "3,1": { elev: 1, terrain: "open" },
  "0,1": { elev: 0, terrain: "ruins" },
  // row 2 (6 wide)
  "0,2": { elev: 1, terrain: "open" },
  "5,2": { elev: 2, terrain: "open" },
  "2,2": { elev: 0, terrain: "ruins" },
  "4,2": { elev: 0, terrain: "open" },
  // row 3 (7 wide) - centre: relays at 1, 3, 5; craters at 2 and 4
  "1,3": { elev: 1, terrain: "relay" },
  "3,3": { elev: 0, terrain: "relay" },
  "5,3": { elev: 1, terrain: "relay" },
  "2,3": { elev: 0, terrain: "crater" },
  "4,3": { elev: 0, terrain: "crater" }
};
function buildMap() {
  const m = /* @__PURE__ */ new Map();
  for (const p of allHexes()) m.set(key(p), { elev: 0, terrain: "open" });
  for (const [k, v] of Object.entries(HALF)) {
    const [col, row] = k.split(",").map(Number);
    const p = { col, row };
    m.set(key(p), v);
    m.set(key(mirror(p)), v);
  }
  return m;
}

// src/shared/engine.ts
var RULES = {
  maxRounds: 8,
  startResolve: 16,
  handStart: 5,
  handMax: 8,
  drawPerRound: 2,
  stackMax: 3,
  swarmStackMax: 5,
  breakCost: 3,
  broodBreakCost: 1,
  synapseLossCost: 3,
  cardDeathCost: 1,
  hqLossCost: 6,
  siegeDrain: 1,
  relayDrain: 1,
  cpCap: 7,
  carryOver: 1,
  maxStakes: 8,
  ambush: 2,
  flank: 1,
  feralPower: 1
};
var cpForRound = (round) => Math.min(round + 1, RULES.cpCap);
var noBuffs = () => ({ power: 0, hold: false, charge: false, speed: 0, confused: false });
function rand(s) {
  let t = s.rng = s.rng + 1831565813 | 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function shuffle(s, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
var HQ_POS = [{ col: 2, row: ROWS - 1 }, { col: 3, row: 0 }];
function newGame(f0, f1, seed = Date.now() & 4294967295, decks) {
  const map = buildMap();
  const s = {
    rng: seed,
    round: 1,
    phase: "orders",
    players: [mkPlayer(f0), mkPlayer(f1)],
    tiles: allHexes().map((pos) => ({ pos, elev: map.get(key(pos)).elev, terrain: map.get(key(pos)).terrain, fortified: false, melted: false, relayOwner: -1 })),
    formations: [],
    inbound: [],
    nextId: 1,
    initiative: 0,
    stakes: 1,
    pendingEscalations: 0,
    winner: null,
    endReason: "",
    fedThisRound: [],
    log: [],
    events: [],
    stats: { breaks: [0, 0], cardsLost: [0, 0], surrenders: [0, 0], resolveBy: {} }
  };
  s.initiative = rand(s) < 0.5 ? 0 : 1;
  for (const p of [0, 1]) {
    s.formations.push(mkFormation(s, p, HQ_POS[p], { uid: s.nextId++, id: HQ_ID[s.players[p].faction], dmg: 0, token: true }, 0));
    const ids = decks?.[p] ?? starterDeck(s.players[p].faction);
    s.players[p].deck = ids.map((id) => ({ uid: s.nextId++, id, dmg: 0 }));
    shuffle(s, s.players[p].deck);
    for (let i = 0; i < RULES.handStart; i++) draw(s, p);
    s.players[p].cp = cpForRound(1);
  }
  return s;
}
function mkPlayer(f) {
  return { faction: f, deck: [], hand: [], discard: [], resolve: RULES.startResolve, cp: 0, escalateUsed: false, orders: null };
}
function mkFormation(s, owner, pos, card, round) {
  const d = def(card);
  return {
    fid: s.nextId++,
    owner,
    pos: { ...pos },
    cards: [card],
    morale: d.nerve,
    broken: false,
    deployedRound: round,
    cloaked: s.players[owner].faction === "hush" && d.cls !== "HQ",
    moved: false,
    buffs: noBuffs()
  };
}
function draw(s, p) {
  const pl = s.players[p];
  const c2 = pl.deck.pop();
  if (!c2) return;
  if (pl.hand.length >= RULES.handMax) pl.discard.push(c2.id);
  else pl.hand.push(c2);
}
var def = (c2) => CARD_BY_ID[c2.id];
var lead = (f) => f.cards[f.cards.length - 1];
var leadDef = (f) => def(lead(f));
var has = (f, k) => leadDef(f).keywords.includes(k);
var other = (p) => 1 - p;
var cardPower = (c2) => def(c2).power + (c2.grow ?? 0) - c2.dmg;
var power = (f) => f.cards.reduce((a, c2) => a + Math.max(0, cardPower(c2)), 0);
var maxNerve = (f) => f.cards.reduce((a, c2) => a + def(c2).nerve, 0);
var isFearlessBase = (f) => has(f, "fearless") || has(f, "hq");
var isShaken = (f) => !f.broken && !isFearlessBase(f) && f.morale <= Math.floor(maxNerve(f) / 2);
var faction = (s, f) => s.players[f.owner].faction;
function tileAt(s, p) {
  return s.tiles.find((t) => samePos(t.pos, p));
}
function formationAt(s, p) {
  return s.formations.find((f) => samePos(f.pos, p));
}
var elev = (s, p) => tileAt(s, p).elev;
var alive = (s, f) => s.formations.includes(f);
function homeRows(p) {
  return p === 0 ? [ROWS - 1, ROWS - 2] : [0, 1];
}
var homeEdge = (p) => p === 0 ? ROWS - 1 : 0;
var inHome = (p, pos) => homeRows(p).includes(pos.row);
var fwd = (p) => p === 0 ? -1 : 1;
var inFrontArc = (f, p) => distance(f.pos, p) === 1 && p.row === f.pos.row + fwd(f.owner);
function adjFormations(s, pos) {
  return neighbors(pos).map((n) => formationAt(s, n)).filter((x) => !!x);
}
var adjEnemies = (s, f) => adjFormations(s, f.pos).filter((o) => o.owner !== f.owner && !o.broken);
var adjFriends = (s, f) => adjFormations(s, f.pos).filter((o) => o.owner === f.owner && !o.broken);
function linkSource(s, f) {
  if (faction(s, f) !== "brood") return void 0;
  return s.formations.find((o) => o !== f && o.owner === f.owner && !o.broken && (has(o, "synapse") || has(o, "synapseBig")) && distance(o.pos, f.pos) <= (has(o, "synapseBig") ? 3 : 2));
}
var isLinked = (s, f) => !!linkSource(s, f);
var isFearless = (s, f) => isFearlessBase(f) || isLinked(s, f);
function inFiringLine(s, f) {
  if (faction(s, f) !== "concord" || has(f, "hq")) return false;
  let n = 1;
  for (const dc of [-1, 1]) {
    for (let k = 1; k < 3; k++) {
      const o = formationAt(s, { col: f.pos.col + dc * k, row: f.pos.row });
      if (!o || o.owner !== f.owner || o.broken || has(o, "hq")) break;
      n++;
    }
  }
  return n >= 3;
}
function isCreep(s, pos, owner) {
  return adjFormations(s, pos).some((o) => o.owner === owner && has(o, "creep"));
}
function hasCover(s, f) {
  const t = tileAt(s, f.pos);
  if (!t.melted && (t.terrain === "ruins" || t.fortified)) return true;
  if (leadDef(f).cls === "Infantry" && adjFriends(s, f).some((o) => has(o, "coverAura"))) return true;
  return false;
}
function hasLOS(s, from, to, indirect) {
  if (indirect) return true;
  const e0 = elev(s, from), e1 = elev(s, to);
  for (const p of lineBetween(from, to)) {
    if (!inBounds(p)) continue;
    const e = elev(s, p);
    if (e > Math.max(e0, e1)) return false;
    if (formationAt(s, p) && e0 <= e) return false;
  }
  return true;
}
function targetsInReach(s, f) {
  const d = leadDef(f);
  const r = rangeOf(d);
  if (r === 0 || f.broken) return [];
  const indirect = d.keywords.includes("indirect");
  return s.formations.filter((o) => {
    if (o.owner === f.owner) return false;
    const dist = distance(o.pos, f.pos);
    if (dist === 1) return true;
    if (dist > r) return false;
    if (o.cloaked && !indirect) return false;
    return hasLOS(s, f.pos, o.pos, indirect);
  });
}
function chooseTarget(s, f) {
  const ts = targetsInReach(s, f);
  if (!ts.length) return void 0;
  const hunter = has(f, "hunter");
  const score = (o) => [
    hunter ? -leadDef(o).cost : 0,
    distance(o.pos, f.pos),
    inFrontArc(f, o.pos) ? 0 : 1,
    has(o, "hq") ? 1 : 0,
    o.cloaked ? 99 : isFearless(s, o) ? 50 + power(o) : o.morale,
    o.pos.col,
    o.pos.row
  ];
  return ts.sort((a, b) => {
    const A = score(a), B = score(b);
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return A[i] - B[i];
    return 0;
  })[0];
}
function loseResolve(s, p, n, reason) {
  if (n <= 0 || s.winner !== null) return;
  s.players[p].resolve -= n;
  const cat = /broke/.test(reason) ? "morale" : /surrender/.test(reason) ? "surrender" : /relay/.test(reason) ? "relays" : /besieged/.test(reason) ? "siege" : "kills";
  s.stats.resolveBy[cat] = (s.stats.resolveBy[cat] ?? 0) + n;
  s.events.push({ t: "resolve", player: p, delta: -n, reason });
  s.log.push(`P${p} \u2212${n} Resolve (${reason}) \u2192 ${s.players[p].resolve}`);
}
function checkWin(s) {
  if (s.winner !== null) return;
  const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
  if (r0 <= 0 && r1 <= 0) end(s, r0 === r1 ? -1 : r0 > r1 ? 0 : 1, "mutual collapse");
  else if (r0 <= 0) end(s, 1, "army collapsed");
  else if (r1 <= 0) end(s, 0, "army collapsed");
}
function end(s, w, reason) {
  s.winner = w;
  s.endReason = reason;
  s.phase = "over";
  s.log.push(`GAME OVER: ${w === -1 ? "draw" : "P" + w + " wins"} (${reason}), stakes ${s.stakes}`);
}
function removeFormation(s, f) {
  s.formations = s.formations.filter((o) => o !== f);
}
function applyDamage(s, f, amount) {
  if (amount <= 0 || !alive(s, f)) return 0;
  if (has(f, "decoy")) {
    vanishDecoy(s, f);
    return 0;
  }
  s.events.push({ t: "damage", fid: f.fid, pos: f.pos, amount });
  let killed = 0;
  while (amount > 0 && f.cards.length) {
    const top = lead(f);
    const take = Math.min(cardPower(top), amount);
    top.dmg += take;
    amount -= take;
    if (cardPower(top) <= 0) {
      f.cards.pop();
      killed++;
      if (!top.token) s.players[f.owner].discard.push(top.id);
      s.stats.cardsLost[f.owner]++;
      const d = def(top);
      const cost = d.cls === "HQ" ? RULES.hqLossCost : top.token ? 0 : d.cls === "Synapse" ? RULES.synapseLossCost : RULES.cardDeathCost;
      loseResolve(s, f.owner, cost, `${d.name} destroyed`);
    }
  }
  if (!f.cards.length) {
    removeFormation(s, f);
    s.events.push({ t: "destroy", fid: f.fid, pos: f.pos });
    s.log.push(`#${f.fid} (P${f.owner}) wiped out`);
    for (const o of adjFormations(s, f.pos)) if (o.owner === f.owner) panic(s, o, 1);
  } else {
    f.morale = Math.min(f.morale, maxNerve(f));
    if (killed) panic(s, f, 1);
  }
  return killed;
}
function applyShock(s, f, amount, opts = {}) {
  if (amount <= 0 || !alive(s, f) || f.broken) return;
  if (has(f, "decoy")) {
    vanishDecoy(s, f);
    return;
  }
  if (!opts.dirge && adjFriends(s, f).some((o) => has(o, "standard"))) amount -= 1;
  if (amount <= 0) return;
  if (isFearless(s, f)) {
    applyDamage(s, f, isFearlessBase(f) ? amount : Math.floor(amount / 2));
    return;
  }
  f.morale -= amount;
  s.events.push({ t: "shock", fid: f.fid, pos: f.pos, amount });
  if (f.morale <= 0) breakFormation(s, f);
}
function panic(s, f, n) {
  if (!alive(s, f) || f.broken || isFearless(s, f) || has(f, "decoy")) return;
  f.morale -= n;
  s.events.push({ t: "shock", fid: f.fid, pos: f.pos, amount: n });
  if (f.morale <= 0) breakFormation(s, f);
}
function breakFormation(s, f) {
  f.broken = true;
  f.morale = 0;
  s.stats.breaks[f.owner]++;
  s.events.push({ t: "break", fid: f.fid, pos: f.pos });
  const d = leadDef(f);
  const fac = faction(s, f);
  const cost = f.cards.every((c2) => c2.token) ? 0 : fac === "brood" ? d.cls === "Synapse" ? RULES.synapseLossCost : RULES.broodBreakCost : RULES.breakCost;
  s.log.push(`#${f.fid} ${d.name} (P${f.owner}) BREAKS`);
  loseResolve(s, f.owner, cost, `${d.name} broke`);
  for (const o of adjFormations(s, f.pos)) if (o.owner === f.owner) panic(s, o, 1);
}
function vanishDecoy(s, f) {
  if (!alive(s, f)) return;
  removeFormation(s, f);
  for (const c2 of f.cards) if (!c2.token) s.players[f.owner].discard.push(c2.id);
  s.events.push({ t: "destroy", fid: f.fid, pos: f.pos });
  s.log.push(`#${f.fid} was only a Phantom`);
  for (const o of adjFormations(s, f.pos)) if (o.owner !== f.owner) panic(s, o, 1);
}
function uncloak(s, f) {
  if (!f.cloaked || !alive(s, f)) return;
  f.cloaked = false;
  s.events.push({ t: "reveal", fid: f.fid, pos: f.pos });
  if (has(f, "decoy")) return vanishDecoy(s, f);
  if (has(f, "nightmare")) {
    for (const o of [...s.formations]) if (o.owner !== f.owner && distance(o.pos, f.pos) <= 2) applyShock(s, o, 1);
  }
  if (has(f, "echo")) {
    const spot = neighbors(f.pos).find((n) => !formationAt(s, n));
    if (spot) spawnToken(s, f.owner, spot, "v_phantom");
  }
}
function spawnToken(s, owner, pos, id) {
  const nf = mkFormation(s, owner, pos, { uid: s.nextId++, id, dmg: 0, token: true }, s.round);
  s.formations.push(nf);
  s.events.push({ t: "deploy", fid: nf.fid, pos, id, reinforce: false, owner });
  return nf;
}
function strikeValue(s, a, t) {
  const ad = leadDef(a);
  const melee = distance(a.pos, t.pos) === 1;
  let v = power(a) + a.buffs.power;
  if (inFiringLine(s, a)) v += 1;
  const link = linkSource(s, a);
  if (link && has(link, "synapseBig")) v += 1;
  if (adjFriends(s, a).some((o) => has(o, "officerAura"))) v += 1;
  if (ad.keywords.includes("frenzy"))
    v += adjFormations(s, t.pos).filter((o) => o.owner === a.owner && o !== a && !o.broken && faction(s, o) === "brood").length;
  if ((ad.keywords.includes("charge") || a.buffs.charge) && a.moved && melee) v += 2;
  if (isShaken(a)) v -= 1;
  if (a.broken && faction(s, a) === "brood") v += RULES.feralPower;
  if (!inFrontArc(t, a.pos) && !has(t, "unflankable") && !isFearlessBase(t)) v += RULES.flank;
  const ea = elev(s, a.pos), et = elev(s, t.pos);
  if (ea > et) v += 1;
  else if (et > ea) v -= 1;
  if (!melee && hasCover(s, t) && !ad.keywords.includes("ignoreCover")) v -= 1;
  if (!ad.keywords.includes("dirge") && adjFriends(s, t).length >= 2) v -= 1;
  if (t.buffs.hold && melee) v -= 1;
  let lethal = ad.keywords.includes("lethal") || t.broken;
  if (a.cloaked && !ad.keywords.includes("silent")) {
    v += RULES.ambush;
    if (ad.keywords.includes("assassinate") && ["Officer", "Synapse"].includes(leadDef(t).cls)) {
      v += 3;
      lethal = true;
    }
  }
  if (ad.keywords.includes("breach") && (leadDef(t).cls === "Structure" || has(t, "hq"))) v += 3;
  if (ad.keywords.includes("terror") && isShaken(t)) v *= 2;
  return { amount: Math.max(0, v), lethal };
}
function canStrike(f) {
  return !f.broken && !f.buffs.confused && rangeOf(leadDef(f)) > 0;
}
function resolveStrikes(s, rangedStep) {
  const plans = [];
  for (const f of s.formations) {
    if (!canStrike(f)) continue;
    const isRanged = rangeOf(leadDef(f)) >= 2;
    const engaged = adjEnemies(s, f).length > 0;
    const myStep = isRanged && !engaged;
    if (myStep !== rangedStep) continue;
    if (has(f, "shriek")) {
      for (const e of adjFormations(s, f.pos).filter((o) => o.owner !== f.owner)) {
        const v2 = strikeValue(s, f, e);
        plans.push({ a: f, ad: leadDef(f), t: e, amount: v2.amount, lethal: v2.lethal, dirge: false });
      }
      continue;
    }
    const t = chooseTarget(s, f);
    if (!t) continue;
    const v = strikeValue(s, f, t);
    plans.push({ a: f, ad: leadDef(f), t, amount: v.amount, lethal: v.lethal, dirge: has(f, "dirge") });
  }
  for (const p of plans) if (p.ad.keywords.includes("volley") && plans.some((q) => q !== p && q.t === p.t)) p.amount += 1;
  const cloakedAttackers = /* @__PURE__ */ new Set();
  for (const p of plans) {
    if (!alive(s, p.t)) continue;
    s.events.push({ t: "strike", fid: p.a.fid, target: p.t.fid, from: { ...p.a.pos }, to: { ...p.t.pos }, amount: p.amount, lethal: p.lethal });
    s.log.push(`${p.ad.name}(#${p.a.fid}) \u2192 ${leadDef(p.t).name}(#${p.t.fid}) ${p.amount}${p.lethal ? " lethal" : ""}`);
    if (p.a.cloaked && !p.ad.keywords.includes("silent")) cloakedAttackers.add(p.a);
    if (p.t.cloaked) uncloak(s, p.t);
    if (!alive(s, p.t)) continue;
    if (faction(s, p.a) === "brood" && p.amount > 0 && !s.fedThisRound.includes(p.a.fid)) s.fedThisRound.push(p.a.fid);
    if (p.lethal || p.t.broken) {
      const k = applyDamage(s, p.t, p.amount);
      if (k && p.ad.keywords.includes("devour") && alive(s, p.a)) {
        const top = lead(p.a);
        top.dmg = Math.max(0, top.dmg - 3);
        for (const e of adjEnemies(s, p.a)) applyShock(s, e, 2);
      }
    } else applyShock(s, p.t, p.amount, { dirge: p.dirge });
    if (p.ad.keywords.includes("barrage")) {
      for (const o of adjFormations(s, p.t.pos)) if (o !== p.a) panic(s, o, 1);
    }
    if (p.ad.keywords.includes("meltCover")) {
      const tt = tileAt(s, p.t.pos);
      tt.melted = true;
      tt.fortified = false;
    }
  }
  for (const a of cloakedAttackers) uncloak(s, a);
}
function goals(s, f) {
  const enemies = s.formations.filter((o) => o.owner !== f.owner).map((o) => o.pos);
  const relays = s.tiles.filter((t) => t.terrain === "relay" && t.relayOwner !== f.owner && !formationAt(s, t.pos)).map((t) => t.pos);
  return [...enemies, ...relays];
}
function canAdvance(s, f) {
  const d = leadDef(f);
  if (f.broken || f.buffs.hold || f.buffs.confused || d.keywords.includes("immobile") || speedOf(d) === 0) return false;
  if (d.keywords.includes("digIn")) return false;
  if (f.deployedRound === s.round) return false;
  if (isShaken(f)) return false;
  if (tileAt(s, f.pos).terrain === "relay") return false;
  if (targetsInReach(s, f).length) return false;
  return true;
}
function stepToward(s, f, gs) {
  if (!gs.length) return void 0;
  const d = leadDef(f);
  const flying = d.keywords.includes("flying") || d.keywords.includes("burrow");
  const dist = (p) => Math.min(...gs.map((g) => distance(g, p)));
  const cur = dist(f.pos);
  const cands = neighbors(f.pos).filter((n) => !formationAt(s, n) && (flying || Math.abs(elev(s, n) - elev(s, f.pos)) <= 1) && dist(n) < cur);
  if (!cands.length) return void 0;
  const ranged = rangeOf(d) >= 2;
  cands.sort((a, b) => dist(a) - dist(b) || (ranged ? elev(s, b) - elev(s, a) : 0) || a.col - b.col);
  return cands[0];
}
function advanceAll(s) {
  const order = [...s.formations].sort((a, b) => (a.owner === s.initiative ? 0 : 1) - (b.owner === s.initiative ? 0 : 1) || a.fid - b.fid);
  for (const f of order) {
    if (!alive(s, f) || !canAdvance(s, f)) continue;
    const d = leadDef(f);
    const steps = speedOf(d) + f.buffs.speed;
    const ignoreZoc = d.keywords.includes("flying") || d.keywords.includes("burrow");
    for (let i = 0; i < steps; i++) {
      const to = stepToward(s, f, goals(s, f));
      if (!to) break;
      s.events.push({ t: "move", fid: f.fid, from: { ...f.pos }, to });
      f.pos = to;
      f.moved = true;
      for (const o of adjFormations(s, f.pos)) if (o.owner !== f.owner && o.cloaked) uncloak(s, o);
      if (!alive(s, f)) break;
      if (tileAt(s, f.pos).terrain === "crater" && !d.keywords.includes("flying")) break;
      if (tileAt(s, f.pos).terrain === "relay") break;
      if (!ignoreZoc && adjEnemies(s, f).length) break;
      if (targetsInReach(s, f).length) break;
    }
  }
}
function stackLimit(cards) {
  if (cards.every((c2) => def(c2).keywords.includes("swarm5"))) return RULES.swarmStackMax;
  if (cards.some((c2) => ["Structure", "Illusion", "HQ"].includes(def(c2).cls))) return 1;
  return RULES.stackMax;
}
function canReinforce(f, card) {
  const ld = leadDef(f);
  if (["Structure", "Illusion", "HQ"].includes(ld.cls) || ["Structure", "Illusion", "Tactic"].includes(card.cls)) return false;
  const ok = card.cls === "Officer" || f.cards.every((c2) => def(c2).cls === card.cls || def(c2).cls === "Officer");
  if (!ok) return false;
  return f.cards.length < stackLimit([...f.cards, { uid: 0, id: card.id, dmg: 0 }]);
}
function tacticTargetOk(s, p, card, pos) {
  const occ = formationAt(s, pos);
  const k = card.tactic.kind;
  if (!occ) return false;
  if (k === "falseOrders") return occ.owner !== p && !occ.cloaked && !has(occ, "hq");
  if (occ.owner !== p) return false;
  if (k === "scream") return has(occ, "synapse") || has(occ, "synapseBig");
  if (k === "broadcast" || k === "knives" || k === "spawning") return true;
  return !has(occ, "hq");
}
function canDeployAt(s, p, card, pos) {
  if (!inBounds(pos)) return false;
  if (isTactic(card)) return tacticTargetOk(s, p, card, pos);
  const occ = formationAt(s, pos);
  if (occ) return occ.owner === p && canReinforce(occ, card);
  if (s.inbound.some((i) => samePos(i.pos, pos))) return false;
  const adj = adjFormations(s, pos);
  const mine = adj.filter((o) => o.owner === p && !o.broken);
  const touchesEnemy = adj.some((o) => o.owner !== p);
  const infiltrate = card.keywords.includes("infiltrate");
  if (infiltrate && (isCreep(s, pos, p) || neighbors(pos).some((n) => isCreep(s, n, p)))) return true;
  if (!mine.length) return false;
  if (!touchesEnemy || infiltrate) return true;
  return mine.some((o) => has(o, "spawn"));
}
function validateOrders(s, p, o) {
  const pl = s.players[p];
  let cost = 0;
  const used = /* @__PURE__ */ new Set();
  const hexes = /* @__PURE__ */ new Set();
  for (const d of o.deploys) {
    const c2 = pl.hand.find((h) => h.uid === d.uid);
    if (!c2) return "card not in hand";
    if (used.has(d.uid)) return "card used twice";
    used.add(d.uid);
    const cd = def(c2);
    if (!isTactic(cd)) {
      if (hexes.has(key(d.pos))) return "one unit per hex per round";
      hexes.add(key(d.pos));
    }
    cost += cd.cost;
    if (!canDeployAt(s, p, cd, d.pos)) return `can't place ${cd.name} there`;
  }
  if (cost > pl.cp) return "not enough Command";
  if (o.escalate && pl.escalateUsed) return "already escalated";
  return null;
}
function apply(s, a) {
  if (s.phase === "over") return "game over";
  if (a.type === "retreat") {
    s.events = [];
    s.log.push(`P${a.player} sounds the retreat`);
    end(s, other(a.player), "retreat");
    return null;
  }
  const err = validateOrders(s, a.player, a.orders);
  if (err) return err;
  s.players[a.player].orders = a.orders;
  if (s.players[0].orders && s.players[1].orders) resolveRound(s);
  return null;
}
function placeCard(s, p, c2, pos, landing) {
  const cd = def(c2);
  const tgt = formationAt(s, pos);
  if (tgt && tgt.owner === p && canReinforce(tgt, cd)) {
    tgt.cards.push(c2);
    if (tgt.broken) {
      tgt.broken = false;
      tgt.morale = Math.max(1, Math.floor(maxNerve(tgt) / 2));
      s.events.push({ t: "rally", fid: tgt.fid, pos: tgt.pos });
    } else tgt.morale = Math.min(maxNerve(tgt), tgt.morale + cd.nerve);
    s.events.push({ t: "deploy", fid: tgt.fid, pos, id: c2.id, reinforce: true, owner: p });
    return;
  }
  let at = pos;
  if (tgt || !landing && !canDeployAt(s, p, cd, pos)) {
    const alt = allHexes().filter((h) => !formationAt(s, h) && canDeployAt(s, p, cd, h)).sort((x, y) => distance(x, pos) - distance(y, pos))[0];
    if (!alt) {
      s.players[p].hand.push(c2);
      s.players[p].cp += cd.cost;
      return;
    }
    at = alt;
  }
  const f = mkFormation(s, p, at, c2, landing ? 0 : s.round);
  s.formations.push(f);
  if (cd.keywords.includes("digIn")) {
    tileAt(s, at).fortified = true;
    tileAt(s, at).melted = false;
  }
  s.events.push({ t: "deploy", fid: f.fid, pos: at, id: c2.id, reinforce: false, owner: p });
}
function applyTactic(s, p, c2, pos) {
  const cd = def(c2);
  const tgt = formationAt(s, pos);
  s.events.push({ t: "tactic", id: c2.id, pos, owner: p });
  s.players[p].discard.push(c2.id);
  switch (cd.tactic.kind) {
    case "overTheTop":
      if (tgt) {
        tgt.buffs.speed += 1;
        tgt.buffs.charge = true;
        tgt.deployedRound = 0;
      }
      break;
    case "holdFast":
      if (tgt) {
        tgt.buffs.hold = true;
        tgt.morale += 3;
      }
      break;
    case "broadcast":
      for (const o of s.formations) if (o.owner === p && distance(o.pos, pos) <= 2 && !isFearlessBase(o)) {
        if (o.broken) {
          o.broken = false;
          o.morale = 2;
          s.events.push({ t: "rally", fid: o.fid, pos: o.pos });
        } else o.morale = Math.min(maxNerve(o), o.morale + 2);
      }
      break;
    case "spawning":
      if (tgt) for (let i = 0; i < 2; i++) {
        const spot = neighbors(tgt.pos).find((n) => !formationAt(s, n));
        if (spot) spawnToken(s, p, spot, "b_skitter");
      }
      break;
    case "pheromone":
      if (tgt) {
        for (const o of [tgt, ...adjFriends(s, tgt)]) if (faction(s, o) === "brood") o.buffs.power += 2;
      }
      break;
    case "scream":
      if (tgt) for (const e of adjEnemies(s, tgt)) applyShock(s, e, 2);
      break;
    case "falseOrders":
      if (tgt && tgt.owner !== p) {
        tgt.buffs.confused = true;
        applyShock(s, tgt, 1);
      }
      break;
    case "smoke":
      if (tgt) {
        tgt.cloaked = true;
        const spot = neighbors(tgt.pos).find((n) => !formationAt(s, n));
        if (spot) spawnToken(s, p, spot, "v_phantom");
      }
      break;
    case "knives":
      for (const o of s.formations) if (o.owner === p && o.cloaked) o.buffs.power += 2;
      break;
  }
}
function resolveRound(s) {
  s.events = [];
  s.fedThisRound = [];
  for (const f of s.formations) {
    f.buffs = noBuffs();
    f.moved = false;
  }
  s.events.push({ t: "step", step: "reveal" });
  const landing = s.inbound;
  s.inbound = [];
  for (const i of landing) placeCard(s, i.owner, i.card, i.pos, true);
  for (const p of [s.initiative, other(s.initiative)]) {
    const pl = s.players[p];
    const o = pl.orders;
    if (o.escalate && !pl.escalateUsed) {
      pl.escalateUsed = true;
      s.pendingEscalations++;
      s.log.push(`P${p} ESCALATES`);
    }
    const cardOf = (uid) => pl.hand.find((h) => h.uid === uid);
    const ordered = o.deploys.filter((d) => cardOf(d.uid)).sort((a, b) => Number(isTactic(def(cardOf(a.uid)))) - Number(isTactic(def(cardOf(b.uid)))));
    for (const d of ordered) {
      const idx = pl.hand.findIndex((h) => h.uid === d.uid);
      if (idx < 0) continue;
      const c2 = pl.hand[idx];
      const cd = def(c2);
      if (cd.cost > pl.cp) continue;
      pl.hand.splice(idx, 1);
      pl.cp -= cd.cost;
      if (isTactic(cd)) {
        if (tacticTargetOk(s, p, cd, d.pos)) applyTactic(s, p, c2, d.pos);
        else pl.discard.push(c2.id);
      } else if (isHeavy(cd) && !formationAt(s, d.pos)) {
        s.inbound.push({ owner: p, pos: d.pos, card: c2 });
        s.events.push({ t: "inbound", pos: d.pos, owner: p });
      } else placeCard(s, p, c2, d.pos, false);
    }
    pl.orders = null;
  }
  if (finishIfOver(s)) return;
  s.events.push({ t: "step", step: "advance" });
  advanceAll(s);
  if (finishIfOver(s)) return;
  s.events.push({ t: "step", step: "ranged" });
  resolveStrikes(s, true);
  if (finishIfOver(s)) return;
  s.events.push({ t: "step", step: "melee" });
  resolveStrikes(s, false);
  if (finishIfOver(s)) return;
  s.events.push({ t: "step", step: "rout" });
  for (const f of [...s.formations]) {
    if (!f.broken || !alive(s, f)) continue;
    const fac = faction(s, f);
    if (fac === "concord") flee(s, f);
    else if (fac === "brood") feral(s, f);
    else vanish(s, f);
  }
  if (finishIfOver(s)) return;
  s.events.push({ t: "step", step: "upkeep" });
  upkeep(s);
  if (finishIfOver(s)) return;
  nextRound(s);
}
function finishIfOver(s) {
  checkWin(s);
  return s.winner !== null;
}
function flee(s, f) {
  if (inHome(f.owner, f.pos)) return;
  const d = leadDef(f);
  const immobile = d.keywords.includes("immobile") || speedOf(d) === 0;
  const steps = Math.max(1, speedOf(d));
  const edge = homeEdge(f.owner);
  for (let i = 0; i < steps; i++) {
    if (inHome(f.owner, f.pos)) break;
    const cands = immobile ? [] : neighbors(f.pos).filter((n) => Math.abs(n.row - edge) < Math.abs(f.pos.row - edge) && !formationAt(s, n) && Math.abs(elev(s, n) - elev(s, f.pos)) <= 1 && !neighbors(n).some((m) => {
      const o = formationAt(s, m);
      return o && o.owner !== f.owner && !o.broken;
    }));
    if (!cands.length) {
      if (i === 0) surrender(s, f);
      return;
    }
    const to = cands.sort((a, b) => a.col - b.col)[0];
    s.events.push({ t: "move", fid: f.fid, from: { ...f.pos }, to });
    f.pos = to;
  }
}
function surrender(s, f) {
  s.log.push(`#${f.fid} (P${f.owner}) is ENCIRCLED and surrenders`);
  s.stats.surrenders[f.owner]++;
  const n = f.cards.filter((c2) => !c2.token).length;
  for (const c2 of f.cards) if (!c2.token) s.players[f.owner].discard.push(c2.id);
  s.stats.cardsLost[f.owner] += f.cards.length;
  removeFormation(s, f);
  s.events.push({ t: "surrender", fid: f.fid, pos: f.pos });
  loseResolve(s, f.owner, Math.max(1, n) * RULES.cardDeathCost, "surrender");
}
function feral(s, f) {
  const adj = adjFormations(s, f.pos).filter((o) => !has(o, "hq") || o.owner !== f.owner);
  if (adj.length && rangeOf(leadDef(f)) > 0) {
    const t = adj.sort((a, b) => (a.owner === f.owner ? 1 : 0) - (b.owner === f.owner ? 1 : 0) || a.morale - b.morale)[0];
    const v = power(f) + RULES.feralPower;
    s.events.push({ t: "strike", fid: f.fid, target: t.fid, from: { ...f.pos }, to: { ...t.pos }, amount: v, lethal: t.owner === f.owner });
    if (t.owner === f.owner) applyDamage(s, t, Math.max(1, Math.ceil(v / 2)));
    else applyShock(s, t, v);
    return;
  }
  if (leadDef(f).keywords.includes("immobile")) return;
  const others = s.formations.filter((o) => o !== f);
  const to = stepToward(s, f, others.map((o) => o.pos));
  if (to) {
    s.events.push({ t: "move", fid: f.fid, from: { ...f.pos }, to });
    f.pos = to;
  }
}
function vanish(s, f) {
  if (adjEnemies(s, f).length) {
    s.log.push(`#${f.fid} is caught before it can vanish`);
    return surrender(s, f);
  }
  const pl = s.players[f.owner];
  const top = f.cards.pop();
  top.dmg = 0;
  top.grow = 0;
  if (!top.token) {
    if (pl.hand.length < RULES.handMax) pl.hand.push(top);
    else pl.discard.push(top.id);
  }
  for (const c2 of f.cards) if (!c2.token) pl.discard.push(c2.id);
  s.stats.cardsLost[f.owner] += f.cards.length;
  removeFormation(s, f);
  s.events.push({ t: "destroy", fid: f.fid, pos: f.pos });
  s.log.push(`#${f.fid} (P${f.owner}) vanishes`);
}
function upkeep(s) {
  for (const f of s.formations) {
    if (!f.broken) continue;
    const fac = faction(s, f);
    const officer = adjFriends(s, f).some((o) => has(o, "rally"));
    if (fac === "concord" && (officer || inHome(f.owner, f.pos) && adjEnemies(s, f).length === 0) || fac === "brood" && isLinked(s, f)) {
      f.broken = false;
      f.morale = Math.max(1, Math.floor(maxNerve(f) / 2));
      s.events.push({ t: "rally", fid: f.fid, pos: f.pos });
    }
  }
  for (const f of s.formations) {
    if (f.broken || isFearlessBase(f)) continue;
    const dreaded = s.formations.some((o) => o.owner !== f.owner && !o.broken && has(o, "dread") && distance(o.pos, f.pos) <= 2);
    if (dreaded) continue;
    let gain = adjEnemies(s, f).length === 0 ? 1 : 0;
    if (s.formations.some((o) => o.owner === f.owner && !o.broken && distance(o.pos, f.pos) <= 2 && has(o, "marshal"))) gain += 1;
    f.morale = Math.min(maxNerve(f), f.morale + gain);
  }
  for (const f of s.formations) {
    if (f.broken) continue;
    const top = lead(f);
    const fed = s.fedThisRound.includes(f.fid);
    const grub = has(f, "grub");
    if ((fed || grub) && (top.grow ?? 0) < (grub ? 4 : 3)) {
      top.grow = (top.grow ?? 0) + 1;
      s.events.push({ t: "evolve", fid: f.fid, pos: f.pos });
    }
  }
  for (const f of [...s.formations]) {
    if (f.broken || !has(f, "hatch")) continue;
    const kids = s.formations.filter((o) => o.owner === f.owner && leadDef(o).id === "b_skitter" && lead(o).token).length;
    const spot = neighbors(f.pos).find((n) => !formationAt(s, n) && !adjFormations(s, n).some((o) => o.owner !== f.owner));
    if (kids < 2 && spot) spawnToken(s, f.owner, spot, "b_skitter");
  }
  for (const f of [...s.formations]) if (f.cloaked && adjEnemies(s, f).length) uncloak(s, f);
  for (const f of s.formations) {
    if (f.broken || f.cloaked || faction(s, f) !== "hush" || has(f, "hq")) continue;
    if (adjFriends(s, f).some((o) => has(o, "shroud")) || has(f, "fade") && adjEnemies(s, f).length === 0) f.cloaked = true;
  }
  for (const f of [...s.formations]) {
    if (f.broken || !has(f, "mirage")) continue;
    if (s.formations.filter((o) => o.owner === f.owner && has(o, "decoy")).length >= 2) continue;
    const spot = neighbors(f.pos).find((n) => !formationAt(s, n));
    if (spot) spawnToken(s, f.owner, spot, "v_phantom");
  }
  for (const f of [...s.formations]) {
    if (f.broken || s.players[other(f.owner)].faction !== "brood") continue;
    if (isCreep(s, f.pos, other(f.owner))) panic(s, f, 1);
  }
  for (const t of s.tiles) {
    if (t.terrain !== "relay") continue;
    const o = formationAt(s, t.pos);
    if (o && !o.broken && !has(o, "decoy")) t.relayOwner = o.owner;
  }
  for (const p of [0, 1]) {
    const n = s.tiles.filter((t) => t.terrain === "relay" && t.relayOwner === p).length;
    if (n) loseResolve(s, other(p), n * RULES.relayDrain, "relays held by enemy");
    const hq = s.formations.find((f) => f.owner === other(p) && has(f, "hq"));
    const bt = hq ? adjFormations(s, hq.pos).filter((f) => f.owner === p && !f.broken && !has(f, "decoy")).length : 0;
    if (bt) loseResolve(s, other(p), bt * RULES.siegeDrain, "HQ besieged");
  }
}
function nextRound(s) {
  if (s.round >= RULES.maxRounds) {
    const r02 = s.players[0].resolve, r12 = s.players[1].resolve;
    if (r02 !== r12) return end(s, r02 > r12 ? 0 : 1, "time: higher Resolve");
    const rl = (p) => s.tiles.filter((t) => t.relayOwner === p).length;
    if (rl(0) !== rl(1)) return end(s, rl(0) > rl(1) ? 0 : 1, "time: relays");
    return end(s, -1, "time: dead even");
  }
  const r0 = s.players[0].resolve, r1 = s.players[1].resolve;
  s.initiative = r0 < r1 ? 0 : r1 < r0 ? 1 : other(s.initiative);
  s.round++;
  s.events.push({ t: "round", round: s.round });
  while (s.pendingEscalations > 0) {
    s.stakes = Math.min(RULES.maxStakes, s.stakes * 2);
    s.pendingEscalations--;
  }
  if (s.round === RULES.maxRounds) s.stakes = Math.min(RULES.maxStakes, s.stakes * 2);
  for (const p of [0, 1]) {
    const pl = s.players[p];
    const relays = s.tiles.filter((t) => t.terrain === "relay" && t.relayOwner === p).length;
    pl.cp = Math.min(RULES.carryOver, pl.cp) + cpForRound(s.round) + relays;
    for (let i = 0; i < RULES.drawPerRound; i++) draw(s, p);
  }
  s.phase = "orders";
}
function viewFor(s, viewer) {
  const v = JSON.parse(JSON.stringify(s));
  const opp = v.players[other(viewer)];
  opp.hand = opp.hand.map(() => ({ uid: -1, id: "?", dmg: 0 }));
  opp.orders = opp.orders ? { deploys: [], escalate: false } : null;
  for (const p of v.players) p.deck = p.deck.map(() => ({ uid: -1, id: "?", dmg: 0 }));
  for (const f of v.formations)
    if (f.owner !== viewer && f.cloaked) {
      f.cards = [{ uid: -1, id: "?", dmg: 0 }];
      f.morale = -1;
    }
  for (const i of v.inbound) if (i.owner !== viewer) i.card = { uid: -1, id: "?", dmg: 0 };
  for (const e of v.events) if (e.t === "deploy" && e.owner !== viewer && v.players[e.owner].faction === "hush") e.id = "?";
  v.log = [];
  v.rng = 0;
  return v;
}

// src/server/index.ts
var PORT = Number(process.env.PORT ?? 8080);
var here = fileURLToPath(new URL(".", import.meta.url));
var STATIC = [join(here, "client"), join(here, "../../dist/client")].find((p) => existsSync(p)) ?? join(here, "client");
var MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2"
};
var server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/healthz") {
    res.end("ok");
    return;
  }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || !extname(p)) p = "/index.html";
  try {
    const body = await readFile(join(STATIC, p));
    res.writeHead(200, { "content-type": MIME[extname(p)] ?? "application/octet-stream", "cache-control": p.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
var rooms = /* @__PURE__ */ new Map();
var send = (ws, m) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
};
function code() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c2 = "";
  do {
    c2 = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join("");
  } while (rooms.has(c2));
  return c2;
}
function broadcast(r) {
  if (!r.state) return;
  for (const seat of [0, 1]) {
    const v = viewFor(r.state, seat);
    send(r.sockets[seat], { t: "state", state: v, events: v.events });
  }
}
var wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  let room = null;
  let seat = 0;
  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (m.t === "create") {
      room = { code: code(), sockets: [ws, null], factions: [m.faction, null], state: null, lastActive: Date.now() };
      seat = 0;
      rooms.set(room.code, room);
      send(ws, { t: "room", code: room.code, seat });
    } else if (m.t === "join") {
      const r = rooms.get(m.code.toUpperCase());
      if (!r || r.sockets[1]) return send(ws, { t: "error", msg: "Room not found or full" });
      room = r;
      seat = 1;
      r.sockets[1] = ws;
      r.factions[1] = m.faction;
      r.state = newGame(r.factions[0], r.factions[1]);
      send(r.sockets[0], { t: "start", seat: 0 });
      send(ws, { t: "start", seat: 1 });
      broadcast(r);
    } else if (m.t === "action" && room?.state) {
      const a = { ...m.action, player: seat };
      const err = apply(room.state, a);
      room.lastActive = Date.now();
      if (err) return send(ws, { t: "error", msg: err });
      broadcast(room);
    }
  });
  ws.on("close", () => {
    if (!room) return;
    room.sockets[seat] = null;
    send(room.sockets[1 - seat], { t: "opponentLeft" });
    if (!room.sockets[0] && !room.sockets[1]) rooms.delete(room.code);
  });
});
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rooms) if (now - r.lastActive > 60 * 60 * 1e3) rooms.delete(k);
}, 5 * 60 * 1e3).unref();
server.listen(PORT, () => console.log(`Shatterline server on :${PORT} (static: ${STATIC})`));
