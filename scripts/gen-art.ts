// Staged card-art generation via OpenRouter (see docs/ART_DIRECTION.md "Generation process").
//   npm run art -- --ids c_trooper,b_ravager,v_blade --round pilot1 [--model openai/gpt-image-2.6-flare]
// Reads OPENROUTER_API_KEY from .env (gitignored). Writes art-drafts/<round>/<id>.png + <id>.prompt.txt
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { CARD_BY_ID, Faction } from '../src/shared/cards';

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ids = (arg('ids') ?? '').split(',').filter(Boolean);
const round = arg('round', 'draft')!;
const model = arg('model', 'openai/gpt-image-2.6-sunburst')!;
if (!ids.length) { console.error('usage: --ids a,b,c --round name'); process.exit(1); }

const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const KEY = process.env.OPENROUTER_API_KEY ?? env.match(/OPENROUTER_API_KEY=(\S+)/)?.[1];
if (!KEY) { console.error('OPENROUTER_API_KEY missing'); process.exit(1); }

// Keep in sync with docs/ART_DIRECTION.md. Log every revision in docs/ART_LOG.md.
export const STYLE = 'Traditional oil painting on textured canvas, thick impasto brushwork and visible palette-knife strokes, painterly lost-and-found edges, hand-painted collectible card illustration (NOT a smooth digital render, NOT airbrushed), gritty grimdark military science fiction, muted desaturated palette with a single saturated accent color, dramatic low-key chiaroscuro with strong rim light, drifting smoke, ash and embers. One heroic subject occupying the middle 60% of a vertical portrait frame, slightly low camera angle, bold readable silhouette against a simple atmospheric background; the top fifth of the image is empty dark sky or haze and the bottom quarter is simple dark ground in shadow.';
export const NEGATIVE = 'No text, no letters, no numbers, no logos, no watermark, no signature, no card frame or border, no UI, no multiple panels, no cropped heads, no cartoon or anime style, no photographic realism, no 3D render look, no real-world flags or insignia.';
export const BIBLE: Record<Faction, string> = {
  concord: 'Faction look (human colonial militia): olive-drab wool greatcoats over dented gunmetal chest plates, deep brimmed steel helmets with one red signal stripe down the crown, round brass-rimmed rebreather masks with corrugated hoses, red cloth armbands, cream stenciled unit numbers; long bolt-action rail-rifles with brass coils; vehicles of riveted olive plate with cream stencils and red chevrons, smokestacks, searchlights. Low sodium-orange light, dusty haze. Palette olive, rust, khaki, cream; signal red is the only accent. Mood stoic, desperate, heroic, poster-like low angle.',
  brood: 'Faction look (alien bio-swarm, one organism in many bodies): wet black-oil chitin with an iridescent sheen, overgrown with fungal gills and coral-like growths in flesh-pink, glowing bile-green spore sacs and veins, clusters of small glossy black eyes, dark hooked glass-like spurs and mandibles instead of bone, drifting green spores; every creature shares the same fungal-coral growth pattern. Ground of cracked earth covered in pink fungal creep. Sickly green under-light. Palette oil-black, flesh-pink, grey; bile green is the only accent. Mood overwhelming, predatory, humid; asymmetric many-limbed silhouettes, no straight lines.',
  hush: 'Faction look (secretive ritual stealth culture): layered dark-teal wrap cloaks and hoods, smooth expressionless porcelain-white masks with thin violet-glowing eye slits and a glowing violet kintsugi-style repaired crack running across every mask, no visible skin; black glass and obsidian devices with thin violet light-lines, curved black-glass blades; figures half-dissolving into shadow or with doubled after-images. Cool moonlight, heavy ground fog. Palette teal, ink black, slate; violet glow is the only accent. Mood uncanny, quiet; mostly shadow with thin rim light.',
};

const outDir = `art-drafts/${round}`;
mkdirSync(outDir, { recursive: true });

async function gen(id: string) {
  const d = CARD_BY_ID[id];
  if (!d) throw new Error('unknown card ' + id);
  const prompt = `${d.art}. ${BIBLE[d.faction]} ${STYLE} ${NEGATIVE}`;
  const res = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: '1024x1536', n: 1 }),
  });
  const j = await res.json() as { data?: { b64_json: string }[]; usage?: { cost?: number }; error?: unknown };
  if (!res.ok || !j.data?.[0]) throw new Error(`${id}: ${res.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  writeFileSync(`${outDir}/${id}.png`, Buffer.from(j.data[0].b64_json, 'base64'));
  writeFileSync(`${outDir}/${id}.prompt.txt`, `model: ${model}\n\n${prompt}\n`);
  console.log(`ok ${id} ($${j.usage?.cost?.toFixed(3) ?? '?'})`);
}

// one at a time (OpenRouter reserves credit per in-flight request)
const queue = [...ids];
await Promise.all([0].map(async () => {
  while (queue.length) { const id = queue.shift()!; await gen(id).catch((e) => console.error('FAIL', e.message)); }
}));
