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

> Painterly digital oil illustration, gritty grimdark military science fiction, visible
> textured brushstrokes, muted desaturated palette with a single saturated accent color,
> dramatic low-key chiaroscuro lighting with strong rim light, drifting smoke, ash and
> floating embers, single heroic subject centered in frame, slightly low camera angle,
> bold readable silhouette with high value contrast against a simplified atmospheric
> background, empty dark negative space at top and bottom of the frame, vertical portrait
> composition, highly detailed focal point, no text, no letters, no logos, no border.

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
- **Anatomy:** wet glossy **bruised purple-black chitin** in overlapping plates with the
  **same ridged plate pattern** on every creature; **bile-green bioluminescent veins and
  sacs**; clusters of small glossy black eyes; **bone-white scythe-tipped limbs**;
  flesh-pink membranes between plates.
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
  porcelain-white masks with thin violet-glowing eye slits** on every operative; no visible skin.
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
