import { CARD_BY_ID, CardDef, FACTION_INFO, KEYWORD_HELP, isTactic, rangeOf } from '../shared/cards';
import { glyph } from './board3d';

export function cardEl(d: CardDef, opts: { big?: boolean } = {}): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'card' + (opts.big ? ' big' : '');
  el.style.setProperty('--fc', FACTION_INFO[d.faction].color);
  const tactic = isTactic(d);
  const icons: string[] = [];
  if (!tactic) {
    const r = rangeOf(d);
    if (r >= 2) icons.push(`<span title="Range">⌖${r}</span>`);
    if (r === 0) icons.push(`<span title="Does not strike">—</span>`);
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
  const kws = d.keywords.map((k) => KEYWORD_HELP[k]).filter(Boolean) as string[];
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = `<b>${d.cls}</b>${d.arch.length ? ' · ' + d.arch.join(', ') : ''}${d.niche ? '<br><i>' + d.niche + '</i>' : ''}${kws.length ? '<br>' + kws.join('<br>') : ''}${extra ? '<br>' + extra : ''}`;
  wrap.appendChild(meta);
  return wrap;
}
