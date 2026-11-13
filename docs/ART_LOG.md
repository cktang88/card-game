# Shatterline: Art Log

Every generation round: the prompt revision, the verdict, and what changed. Drafts are in
`art-drafts/<round>/`, each with its exact prompt in `<id>.prompt.txt`. Approved images
go to `public/art/`.

Review checklist (docs/ART_DIRECTION.md):
- beauty and finish
- faction distinctness
- same-civilisation consistency
- pose and silhouette
- overlay space
- mood

**References.** Each draft was compared against the documented traits of the reference
games (RESEARCH.md §4):
- Infinity Wars: heroic, character-centric, rim-lit.
- Gwent: oil-painterly, chiaroscuro, fog.
- KARDS: poster composition, low heroic angle, limited palette.
- 40k: grimdark, smoke and embers, monumental scale.

No copyrighted reference images were downloaded or used as inputs.

---

## pilot1: meta-prompt v1
- **Model:** `openai/gpt-image-2.6-sunburst`, 1024×1536.
- **Cost:** $0.118 total.
- **Cards:**
  - Dustcoat Fusiliers (Concord)
  - Scythe Ravager (Brood)
  - Hushblade Initiates (Hush)

| Card | Verdict | Notes |
|---|---|---|
| Dustcoat Fusiliers | ✅ strong | Poster-like low angle and textured oil. Every bible detail is present: red helmet stripe, armbands, rebreathers, red chevrons, brass-coil rifles. Bottom is a bit busy. |
| Scythe Ravager | ❌ derivative | Dynamic, great silhouette, but purple carapace plus bone-white scythes reads as an existing IP (Tyranid/Zerg look). It also came out as a smooth digital render, not oil. Bottom is busy. |
| Hushblade Initiates | ⚠ generic | Mood is good: porcelain mask, violet eyes, teal wraps, crouch pose. But it reads as a generic hooded assassin and has a smooth, almost anime finish. |
| **Set** | ❌ inconsistent | Concord is impasto oil; the other two are smooth digital. They don't look like one painter. |

**Changes for v2:**
1. **Global:** force a single medium: "traditional oil on textured canvas, thick impasto, palette-knife strokes, hand-painted collectible card illustration, NOT a smooth digital render". Also give explicit framing: the subject sits in the middle 60%, the top fifth is empty dark sky, the bottom quarter is simple dark ground.
2. **Brood:** a new original signature motif. Black-oil iridescent chitin overgrown with **fungal gills and coral-like growths** in flesh-pink, bile-green spore glow, and dark hooked glass-like spurs instead of bone scythes.
3. **Hush:** a signature motif: a **glowing violet kintsugi-style repaired crack** across every porcelain mask.

## pilot2: meta-prompt v2
- **Model:** `openai/gpt-image-2.6-sunburst`, 1024×1536.
- **Cost:** $0.094 total.
- **Cards:** the same three.

| Card | Verdict | Notes |
|---|---|---|
| Dustcoat Fusiliers | ✅ approved | Consistent with v1 and now matches the shared impasto look. Minor: the bottom quarter still has figures, but the card's dark gradient covers it. |
| Scythe Ravager | ✅ approved | The fungal-coral chitin is original and unmistakable. Strongest "predatory, humid" mood. Clear many-limbed silhouette. |
| Hushblade Initiates | ✅ approved | The kintsugi mask crack is memorable and reads at thumbnail size. Uncanny mood, a faint after-image behind, good crouch. |
| **Set** | ✅ | One painter, three clearly distinct civilisations (warm sepia and red / toxic green and fungal pink / cold teal and violet). |

**Status:** meta-prompt v2 is locked for the next round.

**Next step:** 9 images, one per archetype. Each faction's motifs must hold across very different subjects (an officer, a structure, a vehicle, a synapse beast, a psion). Watch:
- vehicles and structures keeping the civilisation look;
- the bottom-quarter framing.

## batch1: meta-prompt v2, one card per archetype (9) + 2 redos
- **Cost:** about $0.26.
- **Note:** OpenRouter's in-flight budget rejected 3 parallel requests (account balance ≈ $3.40), so generation now runs one at a time.

| Card | Verdict | Notes |
|---|---|---|
| Whistle-Lieutenant | ✅ | Officer pose, whistle, armband and helmet stripe all on-model. |
| Bastion Pillbox | ❌ → redo ✅ | v1 drew a soldier with a tiny pillbox behind. The subject was rewritten as "sole central subject, no people", and the redo is a strong hero bunker with a red chevron. |
| Bulwark Mk.III Walker | ✅ | The civilisation look holds on vehicles. |
| Sporemother Pod | ✅ | The fungal-coral motif holds on a structure. |
| The Gorgemaw | ✅ | Strong "mostly mouth" read. The fleeing humans were generic, so the subject now specifies Concord soldiers for future regenerations. |
| Thoughtstalk Warden | ✅ | Glowing cranium and psychic threads, unmistakably Brood. |
| Mirage Weaver | ✅ | Conjured copies read clearly. |
| Nightglass Skiff | ⚠ → redo ✅ | v1 riders dominated and the craft was unreadable. The redo shows a blade-shaped obsidian hull with violet lines. |
| Dread Herald | ✅ | Towering presence, terrified soldiers. |

**Learnings, applied to card subjects (not the global prompt)**
- Structure and vehicle cards must say "sole central subject"; otherwise the model adds a person.
- Humans appearing in Brood or Hush art are specified as Concord soldiers, for world coherence.
- The Faceless mask was changed from "chrome" to porcelain with kintsugi seams, per the Hush bible.
- Hush risks sameness (hooded figures). Their subjects deliberately vary: a device, a vehicle, close portraits, an empty-darkness scene, an enemy point of view.

## concord: the remaining 12 Concord cards + 4 redos
- **Cost:** about $0.57.
- **Civilisation consistency:** excellent. Helmet stripes, armbands, rebreathers and chevrons appear on every card.
- **Approved first pass:**
  - Riflemen (kneeling volley)
  - Colour Sergeant (planted standard)
  - Widow Varn (prone sniper on a gantry)
  - Mortar crew
  - Hammerfall Battery
  - Ram-Track
  - Siege-Crawler
  - Command Bunker
- **Failed for sameness:** Loudhorn Broadcast, Mole Brigade Sappers, Iron Shieldwall and Over the Top! all came out as the same "single gas-masked trooper standing with a rifle". The faction bible plus "heroic subject" pulls the model toward that.
- **Fix (per-card, global prompt unchanged):** subjects that state the action, the camera angle, and that nobody stands still. The redos show a towering loudspeaker mast from below, sappers digging at ground level, a shield wall head-on taking fire, and a ladder scramble seen from inside the trench. All four were approved.
- **Learning:** for infantry factions, write subjects as *actions plus camera angle*, not "a squad of X".

## brood: the remaining 11 Brood cards + 4 redos
- **Cost:** about $0.36.
- **Motif consistency:** excellent. The fungal-coral chitin and green glow appear on every card.
- **Approved first pass:**
  - Grub (larva with a shape forming inside)
  - Brood Heart
  - Nightmaw Leech (latching onto a Concord soldier)
  - Overmind (floating brain)
  - Psychic Scream (shockwave, Concord soldiers floored)
  - Skitterlings
  - Acid Spitter (acid arc)
- **Failed for sameness:** Lashworm, Mimics, Pack and Pheromone all came out as the same "many-legged coral beast". The Lashworm wasn't a worm, and the Mimics weren't humanoid.
- **Fix:** silhouette-first subjects:
  - Lashworm: a sinuous worm erupting vertically.
  - Mimics: humanoid fakes in stolen greatcoats and helmets.
  - Pack: hounds running, side view.
  - Pheromone: a bursting spore cloud.

  All four were approved; the Pheromone is still creature-forward but distinct.
- **Learning:** for a creature faction, lead each subject with the *silhouette* (worm, humanoid, hound, cloud), not with "a beast that…".
