// Generates docs/CARDS.md from src/shared/cards.ts so the card review never drifts.
//   npm run cards
import { writeFileSync } from 'node:fs';
import { CARDS, FACTION_INFO, Faction, KEYWORD_HELP, rangeOf } from '../src/shared/cards';

let md = `# Shatterline: Card List & Niche Review\n\n_Generated from \`src/shared/cards.ts\` by \`npm run cards\`. Do not edit by hand._\n\n`;
md += `Every card must answer one question: **where do I want to be placed, and why?** That answer is the "niche" column. Review checklist (from docs/RESEARCH.md §9):\n\n`;
md += `- One keyword or trigger, one line of text.\n- Its Cost/Power/Nerve/Range combination is unique within the faction.\n- It names its counter (another card or a positional answer).\n- Its outcome is decidable at reveal from visible board state.\n- It serves an archetype and reads as its faction from name and text alone.\n\n`;
md += `## Global keywords\n\n`;
for (const [, v] of Object.entries(KEYWORD_HELP)) md += `- ${v}\n`;
for (const f of Object.keys(FACTION_INFO) as Faction[]) {
  const info = FACTION_INFO[f];
  md += `\n## ${info.name}\n\n_${info.blurb}_\n\n**Faction rules:** ${info.rules.join(' ')}\n\n**Archetypes:** ${Object.values(info.archetypes).join(' · ')}\n\n`;
  md += `| Card | Cost | Power | Nerve | Range | Class | Text | Niche | Archetypes |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const d of CARDS.filter((c) => c.faction === f && c.cls !== 'HQ')) {
    const tactic = d.cls === 'Tactic';
    const r = rangeOf(d);
    md += `| **${d.name}** | ${d.cost} | ${tactic ? '–' : d.power} | ${tactic ? '–' : d.nerve} | ${tactic ? '–' : r === 0 ? 'none' : r === 1 ? 'melee' : r} | ${d.cls} | ${d.text} | ${d.niche} | ${d.arch.join(', ')} |\n`;
  }
  // uniqueness check
  const sigs = new Map<string, string>();
  for (const d of CARDS.filter((c) => c.faction === f && c.cls !== 'HQ' && c.cls !== 'Tactic')) {
    const sig = `${d.cost}/${d.power}/${d.nerve}/${rangeOf(d)}/${d.keywords.join('+')}`;
    if (sigs.has(sig)) md += `\n> ⚠ ${d.name} duplicates ${sigs.get(sig)}\n`;
    sigs.set(sig, d.name);
  }
}
writeFileSync('docs/CARDS.md', md);
console.log('wrote docs/CARDS.md');
