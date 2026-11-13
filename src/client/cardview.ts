import { CARD_BY_ID, CardDef, Faction, KEYWORD_HELP, isTactic, rangeOf } from '../shared/cards';
import { glyph } from './board3d';
import { ART } from './art-manifest';
import UI from '../../public/ui/ui.json';

/** Frame window insets (percent) measured from the generated frame art. */
export function frameVars(f: Faction): string {
  const w = (UI as Record<string, { window?: number[] }>)[`frame_${f}`]?.window ?? [8, 5, 8, 11];
  return `--wl:${w[0]}%;--wt:${w[1]}%;--wr:${w[2]}%;--wb:${w[3]}%;--frame:url(/ui/frame_${f}.webp)`;
}

export function cardEl(d: CardDef, opts: { big?: boolean } = {}): HTMLDivElement {
  const el = document.createElement('div');
  const tactic = isTactic(d);
  el.className = `card fac-${d.faction}${opts.big ? ' big' : ''}${tactic ? ' tactic' : ''}`;
  el.setAttribute('style', frameVars(d.faction));
  const r = rangeOf(d);
  const tags: string[] = [];
  if (!tactic && r >= 2) tags.push(`<span class="tag" title="Ranged: reaches ${r} hexes">⌖ ${r}</span>`);
  if (!tactic && r === 0) tags.push(`<span class="tag" title="Never strikes">—</span>`);
  if (d.keywords.includes('lethal')) tags.push(`<span class="tag lethal" title="Lethal: deals damage">✠</span>`);
  el.innerHTML = `
    <div class="art${ART.has(d.id) ? '' : ' ph'}" data-glyph="${glyph(d.name)}" ${ART.has(d.id) ? `style="background-image:url(/art/${d.id}.webp)"` : ''}></div>
    <div class="shade"></div>
    <div class="frame"></div>
    <div class="tags">${tags.join('')}</div>
    <div class="plaque"><div class="name">${d.name}</div><div class="rules">${d.text}</div></div>
    <div class="badge cost"><span>${d.cost}</span></div>
    ${tactic ? '<div class="ribbon">Tactic</div>' : `<div class="badge pow" title="Power"><span>${d.power}</span></div><div class="badge nrv" title="Nerve"><span>${d.nerve}</span></div>`}
  `;
  return el;
}

export function previewEl(id: string, extra = ''): HTMLDivElement {
  const d = CARD_BY_ID[id];
  const wrap = document.createElement('div');
  wrap.appendChild(cardEl(d, { big: true }));
  const kws = d.keywords.map((k) => KEYWORD_HELP[k]).filter(Boolean) as string[];
  const meta = document.createElement('div');
  meta.className = 'meta plate';
  meta.innerHTML = `<div class="cls">${d.cls}${d.arch.length ? ' · ' + d.arch.join(' · ') : ''}</div>${d.niche ? `<p class="niche">${d.niche}</p>` : ''}${kws.length ? `<p>${kws.join('<br>')}</p>` : ''}${extra ? `<p>${extra}</p>` : ''}`;
  wrap.appendChild(meta);
  return wrap;
}
