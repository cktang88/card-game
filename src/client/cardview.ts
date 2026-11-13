import { CARD_BY_ID, CardDef, FACTION_INFO, Faction, KEYWORD_HELP, isTactic, rangeOf } from '../shared/cards';
import { glyph } from './board3d';
import { ART } from './art-manifest';
import UI from '../../public/ui/ui.json';

/** Frame window insets (percent) measured from the generated frame art. */
export function frameVars(f: Faction): string {
  const w = (UI as Record<string, { window?: number[] }>)[`frame_${f}`]?.window ?? [8, 5, 8, 11];
  return `--wl:${w[0]}%;--wt:${w[1]}%;--wr:${w[2]}%;--wb:${w[3]}%;--frame:url(/ui/frame_${f}.webp)`;
}

export function cardEl(d: CardDef, opts: { big?: boolean; tilt?: boolean } = {}): HTMLDivElement {
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
    <div class="tilt">
      <div class="art${ART.has(d.id) ? '' : ' ph'}" data-glyph="${glyph(d.name)}" ${ART.has(d.id) ? `style="background-image:url(/art/${d.id}.webp)"` : ''}></div>
      <div class="shade"></div>
      <div class="frame"></div>
      <div class="sheen"></div>
      <div class="tags">${tags.join('')}</div>
      <div class="plaque"><div class="name">${d.name}</div><div class="rules">${d.text}</div></div>
      <div class="badge cost"><span>${d.cost}</span></div>
      ${tactic ? '<div class="ribbon">Tactic</div>' : `<div class="badge pow" title="Power"><span>${d.power}</span></div><div class="badge nrv" title="Nerve"><span>${d.nerve}</span></div>`}
      <div class="glare"></div>
    </div>
  `;
  if (opts.tilt !== false) enableTilt(el);
  return el;
}

/** Mouse-follow 3D tilt + glare/sheen tracking. Values are CSS custom properties so all
 *  layers (art parallax, glare hotspot, metal sheen) move together. */
export function enableTilt(el: HTMLElement, strength = 1) {
  const set = (px: number, py: number) => {
    el.style.setProperty('--rx', `${((0.5 - py) * 16 * strength).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((px - 0.5) * 20 * strength).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    el.style.setProperty('--dx', (px - 0.5).toFixed(3));
    el.style.setProperty('--dy', (py - 0.5).toFixed(3));
    // the sheen band travels opposite to the tilt, like light sliding across metal
    el.style.setProperty('--sx', `${(100 - px * 100).toFixed(1)}%`);
    el.style.setProperty('--sy', `${(100 - py * 100).toFixed(1)}%`);
  };
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.classList.add('tilting');
    set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  });
  el.addEventListener('pointerleave', () => {
    el.classList.remove('tilting');
    for (const k of ['--rx', '--ry', '--mx', '--my', '--dx', '--dy', '--sx', '--sy']) el.style.removeProperty(k);
  });
}

export function previewEl(id: string, extra = ''): HTMLDivElement {
  const d = CARD_BY_ID[id];
  const wrap = document.createElement('div');
  const card = cardEl(d, { big: true, tilt: false });
  card.classList.add('floating');
  wrap.appendChild(card);
  const kws = d.keywords.map((k) => KEYWORD_HELP[k]).filter(Boolean) as string[];
  const meta = document.createElement('div');
  meta.className = 'meta plate';
  meta.innerHTML = `<div class="cls">${d.cls}${d.arch.length ? ' · ' + d.arch.join(' · ') : ''}</div>${d.niche ? `<p class="niche">${d.niche}</p>` : ''}${kws.length ? `<p>${kws.join('<br>')}</p>` : ''}${extra ? `<p>${extra}</p>` : ''}<p class="hint">Right-click to inspect</p>`;
  wrap.appendChild(meta);
  return wrap;
}

/** Full-screen inspect view: huge tilting card + a detail plate. */
export function openInspect(id: string, extraHtml = '') {
  const d = CARD_BY_ID[id];
  closeInspect();
  const ov = document.createElement('div');
  ov.id = 'inspect';
  const card = cardEl(d, { big: true });
  card.classList.add('huge');
  const info = FACTION_INFO[d.faction];
  const kws = d.keywords.map((k) => KEYWORD_HELP[k]).filter(Boolean) as string[];
  const r = rangeOf(d);
  const plate = document.createElement('div');
  plate.className = 'detail plate';
  plate.innerHTML = `
    <div class="fac" style="color:${info.color}">${info.name}</div>
    <h2>${d.name}</h2>
    <div class="cls">${d.cls}${isTactic(d) ? '' : ` · ${r === 0 ? 'does not strike' : r === 1 ? 'melee' : `ranged ${r}`}`}${d.arch.length ? ' · ' + d.arch.join(' · ') : ''}</div>
    <div class="orn"></div>
    <p class="rules">${d.text}</p>
    ${d.niche ? `<p class="niche">“${d.niche}”</p>` : ''}
    ${kws.length ? `<h4>Keywords</h4><ul>${kws.map((k) => `<li>${k}</li>`).join('')}</ul>` : ''}
    ${extraHtml ? `<h4>On the battlefield</h4><div class="extra">${extraHtml}</div>` : ''}
    <h4>${info.name}</h4><ul>${info.rules.map((x) => `<li>${x}</li>`).join('')}</ul>
    <div class="close">Click anywhere or press Esc to close</div>`;
  ov.append(card, plate);
  ov.addEventListener('click', closeInspect);
  ov.addEventListener('contextmenu', (e) => { e.preventDefault(); closeInspect(); });
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
}

export function closeInspect() {
  document.getElementById('inspect')?.remove();
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInspect(); });
