// Generates UI art (card frames, stat badges) via OpenRouter, on flat chroma-green
// so scripts/process-ui.py can cut out transparency.
//   npm run ui -- --ids frame_concord,badge_power --round ui1
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (k: string, d?: string) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ids = (arg('ids') ?? '').split(',').filter(Boolean);
const round = arg('round', 'ui')!;
const model = arg('model', 'openai/gpt-image-2.6-sunburst')!;
const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const KEY = process.env.OPENROUTER_API_KEY ?? env.match(/OPENROUTER_API_KEY=(\S+)/)?.[1];
if (!KEY) { console.error('OPENROUTER_API_KEY missing'); process.exit(1); }

const STYLE = 'Painted game-asset illustration, traditional oil painting texture with visible brushwork, grimdark military science fiction, worn, battle-scarred, dramatic rim light. Perfectly front-on, flat orthographic view, symmetrical. No text, no letters, no numbers, no symbols of real-world nations, no watermark.';
const GREEN = 'The background (and any empty area) is a perfectly flat, uniform, pure chroma-key green (#00FF00) with no texture, no shading and no shadows.';
const FRAME = (look: string) => `An ornate trading-card frame border, portrait card shape filling the whole image edge to edge. The frame is a thick decorative border only, about 7% of the card width thick, with heavier ornamented corners and a slightly thicker bottom edge. Everything inside the border is one single empty rectangular window filled with ${GREEN.replace('The background (and any empty area) is', 'flat')} Material and style: ${look}`;
const BADGE = (look: string) => `A single game UI badge centered in the frame, occupying about 70% of the image, with a smooth empty flat center plate where a number will later be placed (leave the center plain and blank). ${look} ${GREEN}`;

const ITEMS: Record<string, { prompt: string; size: string }> = {
  frame_concord: { size: '1024x1536', prompt: FRAME('riveted gunmetal and blackened steel plates with brass trim and rivets, olive-drab enamel panels, chipped red signal-stripe chevrons at the corners, stencil-scratched, oil and soot stains, industrial war-machine aesthetic.') },
  frame_brood: { size: '1024x1536', prompt: FRAME('sleek alien border made of glossy iridescent black-green beetle-carapace plates with clean sharp edges, thin glowing venom-green seams between the plates, elegant curved blade-like spines at the corners, polished and sculptural, minimal fine detail, no slime, no fungus.') },
  frame_hush: { size: '1024x1536', prompt: FRAME('smooth black obsidian and dark-teal lacquer border with cracked white porcelain inlays repaired with thin glowing violet kintsugi seams, subtle violet light-lines, elegant, quiet, ritualistic.') },
  badge_cost: { size: '1024x1024', prompt: BADGE('A round heavy brass-and-bronze command medallion coin with an engraved, notched rim and tiny rivets, warm gold highlights, aged patina.') },
  badge_power: { size: '1024x1024', prompt: BADGE('A heater-shaped iron battle shield badge with a riveted steel rim, crossed sword blades engraved behind it, the center plate deep blood-red enamel, chipped and scarred.') },
  badge_nerve: { size: '1024x1024', prompt: BADGE('A hanging war-banner badge shaped like a swallow-tailed pennant on a short iron crossbar, the center plate deep cobalt-blue enamel, gold-trimmed and tattered at the tails.') },
};

const outDir = `art-drafts/${round}`;
mkdirSync(outDir, { recursive: true });
for (const id of ids) {
  const it = ITEMS[id];
  if (!it) { console.error('unknown', id); continue; }
  const prompt = `${it.prompt} ${STYLE}`;
  const res = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: it.size, n: 1 }),
  });
  const j = await res.json() as { data?: { b64_json: string }[]; usage?: { cost?: number }; error?: unknown };
  if (!res.ok || !j.data?.[0]) { console.error('FAIL', id, res.status, JSON.stringify(j).slice(0, 200)); continue; }
  writeFileSync(`${outDir}/${id}.png`, Buffer.from(j.data[0].b64_json, 'base64'));
  writeFileSync(`${outDir}/${id}.prompt.txt`, `model: ${model}\n\n${prompt}\n`);
  console.log(`ok ${id} ($${j.usage?.cost?.toFixed(3) ?? '?'})`);
}
