# Shatterline — Art Direction

**Status:** no card art is generated until the rules and card list are final.
The pipeline was tested only to confirm the OpenRouter key works.

## Principles

1. **One painterly style across the whole game.** Every faction is painted by "the same hand".
2. **Each faction looks like one civilization.** All of a faction's units share
   the same materials, armour language, colours, emblems and light sources. For example,
   if Concord helmets carry a red signal stripe, *every* Concord soldier has that stripe.
   A **Faction Visual Bible** paragraph is injected into every prompt for that faction.
3. **Text-free base images.** The client draws cost, Power, Nerve, name and icons as
   overlays. Keep the top ~18% and bottom ~28% of each image low-detail (sky, fog, ground
   shadow) so the overlays don't cover the subject.
4. **Readable at thumbnail size.** One subject, a bold silhouette, value contrast, rim light,
   one accent colour.

Influences (described in words only, never named in prompts): heroic character-centric
sci-fi TCG illustration with emissive glows; dark painterly oil fantasy with chiaroscuro
and fog; WWII poster and model-kit box-art composition (low heroic angles, diagonal
light rays, limited ink-like palette); gothic grimdark industrial decay with smoke,
embers and a vast sense of scale.

## Global style suffix (appended to every prompt)

> Traditional oil painting on textured canvas, thick impasto brushwork and visible
> palette-knife strokes, painterly lost-and-found edges, hand-painted collectible card
> illustration (NOT a smooth digital render, NOT airbrushed), gritty grimdark military science
> fiction, muted desaturated palette with a single saturated accent color, dramatic low-key
> chiaroscuro with strong rim light, drifting smoke, ash and embers. One heroic subject
> occupying the middle 60% of a vertical portrait frame, slightly low camera angle, bold
> readable silhouette against a simple atmospheric background; the top fifth of the image is
> empty dark sky or haze and the bottom quarter is simple dark ground in shadow.

_(v2 of the meta-prompt, chosen after the pilot rounds. The authoritative copy is in `scripts/gen-art.ts`; see `docs/ART_LOG.md`.)_

## Negative list

text, letters, numbers, captions, logos, watermark, signature, card frame or border, UI
elements, stat boxes, title banner, multiple panels, collage, split image, cropped head or
limbs, subject cut off, cluttered background, multiple competing subjects, tiny distant
subject, flat even lighting, oversaturated neon outside the accent, cartoon/anime/chibi,
photographic realism, 3D render look, blurry, deformed hands, real-world flags or
insignia, recognizable franchise symbols.

## Faction Visual Bibles

### Concord Vanguard: "Hold the line"
Human colonial militia from a poor, industrial frontier world.
- **Uniform:** olive-drab wool greatcoats over dented gunmetal chest plates; deep
  brimmed steel helmets with **one red signal stripe** down the crown; round brass-rimmed
  rebreather masks with corrugated hoses; **red cloth armbands**; cream stencilled unit
  numbers on helmets and plates.
- **Weapons:** long bolt-action rail-rifles with brass coil housings, wooden stocks and bayonets.
- **Vehicles/structures:** riveted olive plate, cream stencils, **red chevrons**,
  smokestacks, searchlights, sandbags and corrugated steel.
- **Light & palette:** low sodium-orange sun or flare light, dusty haze, smoke plumes;
  olive, rust, khaki, cream, with signal-red as the only accent.
- **Mood:** stoic, disciplined, desperate and heroic. Poster-like low angles and diagonal
  searchlight rays.

### Vhorr Brood: "Swarm & evolve"
A bio-swarm, one organism in many bodies.
- **Anatomy:** wet **black-oil chitin** with an iridescent sheen, **overgrown with fungal gills and
  coral-like growths in flesh-pink**, the same growth pattern on every creature. **Bile-green
  glowing spore sacs and veins**, clusters of small glossy black eyes, **dark hooked glass-like spurs
  and mandibles** (no bone-white scythes). This motif was chosen in the pilot so the swarm doesn't read as Tyranids or Zerg.
- **Synapse creatures:** swollen translucent craniums glowing green, linked to the others
  by faint green psychic threads.
- **Environment:** organic creep of purple veins over cracked earth, spore mist, dripping ichor.
- **Light & palette:** sickly green under-light and back-light; purple, black,
  flesh-pink, with bile-green as the only accent.
- **Mood:** overwhelming, predatory, humid. Asymmetric silhouettes with many limbs and no
  straight lines.

### The Hush: "Unseen"
A secretive, ritualised stealth culture.
- **Look:** layered **dark-teal wrap cloaks** and hoods; **smooth expressionless
  porcelain-white masks with thin violet-glowing eye slits and a glowing violet kintsugi-style
  repaired crack** on every operative (the signature motif, chosen in the pilot); no visible skin.
- **Tech:** black glass and obsidian devices with **thin violet light-lines**; curved
  black-glass blades.
- **Effects:** units half-dissolve into shadow or show doubled after-images; illusions are
  violet static.
- **Light & palette:** cool moonlight, heavy ground fog, volumetric haze; teal, ink black,
  slate, with violet glow as the only accent.
- **Mood:** uncanny and quiet. Most of the frame in shadow, with thin rim light only.

## Pipeline

- Model: `openai/gpt-image-2.6-sunburst` for finals, or `openai/gpt-image-2.6-flare` for fast drafts,
  via OpenRouter `POST /api/v1/images` (OpenAI-compatible body: `model`, `prompt`, `size`, `n`;
  returns `data[0].b64_json`). A 1024×1024 flare draft cost about $0.025.
- Size: 1024×1536 portrait. Output: `public/art/<card_id>.png` (committed).
- Prompt = card subject + faction visual bible + global style suffix + negatives.
- The key lives only in `.env` (gitignored) and is never committed.

## Generation process (staged, quality-gated)

Card art is generated in small rounds. The meta-prompt is iterated before scaling up.

1. **Pilot (2–3 images).** Generate one hero card per faction, e.g. Dustcoat Fusiliers,
   Scythe Ravager and Hushblade Initiates, with `gpt-image-2.6-sunburst`.
2. **Review against references.** Place the drafts side by side with reference card art
   from Infinity Wars, Gwent, KARDS and 40k. References are only for comparison; they are
   never used as image inputs or copied. Score each draft on:
   - **Beauty / finish:** painterly quality, lighting, no AI artefacts (hands, faces, extra limbs outside the Brood).
   - **Faction distinctness:** can you tell the faction from a thumbnail without colour cues? Does it match the faction's visual bible?
   - **Civilisation consistency:** same armour, masks, materials and glow colour as the other units of that faction.
   - **Pose and composition:** a strong silhouette, a dynamic or heroic pose, and a focal point in the middle band.
   - **Overlay space:** quiet top ~18% and bottom ~28%.
   - **Mood:** the faction's feel (stoic and desperate / predatory and humid / uncanny and quiet).
3. **Iterate the meta-prompt** (global style suffix + faction bible + subject template) until
   all three pilots pass every check. Record each prompt revision and its verdict in
   `docs/ART_LOG.md`.
4. **Scale gradually:**
   - 1 card per archetype (9 images) → review.
   - Then one full faction (15) → review.
   - Then the rest.

   Any failure stops the batch, and the prompt is fixed before continuing.
5. **Regenerate individual misses** with a per-card subject tweak; don't change the global prompt for one card.

Script: `npm run art -- --ids c_trooper,b_ravager,v_blade --round pilot1`. Drafts go to
`art-drafts/<round>/` with each prompt saved next to its image. Approved images are copied
to `public/art/<card_id>.png`, which the client loads automatically. All approved art is committed.
