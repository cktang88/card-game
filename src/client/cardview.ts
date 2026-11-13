import { CARD_BY_ID, CardDef, FACTION_INFO, isHeavy, isTactic, rangeOf, speedOf } from '../shared/cards';
import { glyph } from './board3d';

const KEYWORD_HELP: Record<string, string> = {
  lethal: 'Lethal: deals real damage instead of Shock.',
  indirect: 'Indirect: needs no line of sight.',
  hunter: 'Hunter: targets the costliest enemy in reach.',
  fearless: 'Fearless: no Nerve; Shock hits it as damage.',
  flying: 'Flying: ignores terrain and zone of control.',
  unflankable: 'Cannot be flanked.',
  immobile: 'Immobile: never moves.',
  spawn: 'Allies may be placed next to it even when touching enemies.',
};

export function cardEl(d: CardDef, opts: { big?: boolean } = {}): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'card' + (opts.big ? ' big' : '');
  el.style.setProperty('--fc', FACTION_INFO[d.faction].color);
  const tactic = isTactic(d);
  const icons: string[] = [];
  if (!tactic) {
    const r = rangeOf(d), sp = speedOf(d);
    if (r >= 2) icons.push(`<span title="Range">⌖${r}</span>`);
    if (r === 0) icons.push(`<span title="Does not attack">—</span>`);
    if (sp !== 1) icons.push(`<span title="Speed">»${sp}</span>`);
    if (d.keywords.includes('lethal')) icons.push(`<span title="Lethal" style="color:#ff6a4a">✖</span>`);
  }
  el.innerHTML = `
    <div class="art ph" data-glyph="${glyph(d.name)}"></div>
    <div class="shade"></div>
    <div class="cost">${d.cost}</div>
    <div class="icons">${icons.join('')}</div>
    <div class="name">${d.name}</div>
    <div class="text">${d.text}</div>
    ${tactic ? '<div class="tactic-tag">TACTIC</div>' : `<div class="stat pow" title="Power">${d.power}</div><div class="stat nrv" title="Nerve">${d.nerve}</div>`}
    ${isHeavy(d) ? '<div class="heavy">HEAVY</div>' : ''}
  `;
  // real art if present
  const art = el.querySelector('.art') as HTMLDivElement;
  const img = new Image();
  img.onload = () => { art.classList.remove('ph'); art.style.backgroundImage = `url(/art/${d.id}.png)`; };
  img.src = `/art/${d.id}.png`;
  return el;
}

export function previewEl(id: string, extra = ''): HTMLDivElement {
  const d = CARD_BY_ID[id];
  const wrap = document.createElement('div');
  wrap.appendChild(cardEl(d, { big: true }));
  const kws = d.keywords.map((k) => KEYWORD_HELP[k]).filter(Boolean);
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<b>${d.cls}</b>${d.arch.length ? ' · ' + d.arch.join(', ') : ''}${isHeavy(d) ? '<br>Heavy: arrives one round after you order it.' : ''}${kws.length ? '<br>' + kws.join('<br>') : ''}${extra ? '<br>' + extra : ''}`;
  wrap.appendChild(meta);
  return wrap;
}
