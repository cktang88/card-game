import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CARD_BY_ID, FACTION_INFO, Faction } from '../shared/cards';
import { ART } from './art-manifest';
import {
  COLS, HAND_NAMES, columnHand, Formation, GameEvent, GameState, PlayerId, Pos, allCells, key, isFearless, lead, leadDef, linkSource, maxNerve, power, Terrain,
} from '../shared/engine';

const R = 1;              // hex radius
const SQ3 = Math.sqrt(3);
const ELEV_H = 0.32;
const BASE_H = 0.22;

export const ME_COLOR = new THREE.Color('#e0a03c');
export const OPP_COLOR = new THREE.Color('#c8452f');

const CELL = 1.75;            // column spacing
const ROW_Z = [-3.05, -1.2, 1.2, 3.05];
/** World x/z of a battle-line cell (kept the old name for minimal churn). */
export function hexXZ(p: Pos): [number, number] {
  return [(p.col - (COLS - 1) / 2) * CELL, ROW_Z[p.row]];
}

// ───────────────────────── shaders ─────────────────────────
const cloakMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#8a6bff') } },
  vertexShader: `varying vec3 vPos; varying vec3 vN; void main(){ vPos = position; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vPos; varying vec3 vN;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      float bands = sin(vPos.y*28.0 - uTime*6.0)*0.5+0.5;
      float n = h(floor(vPos.xz*18.0) + floor(uTime*8.0));
      float rim = pow(1.0 - abs(vN.y), 1.5);
      float a = (0.18 + 0.5*rim) * (0.55 + 0.45*bands) * (0.7 + 0.3*n);
      gl_FragColor = vec4(uColor*a*1.6, a);
    }`,
});

const beamMat = (color: THREE.Color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uColor: { value: color } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
    void main(){ float s = 0.5+0.5*sin(vUv.y*30.0 + uTime*8.0); float a = (1.0 - vUv.y) * (0.35 + 0.4*s);
      gl_FragColor = vec4(uColor*a*1.8, a); }`,
});

const ringMat = (color: THREE.Color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uColor: { value: color }, uSpeed: { value: 2.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uSpeed; varying vec2 vUv;
    void main(){ float p = 0.55 + 0.45*sin(uTime*uSpeed); gl_FragColor = vec4(uColor*p*1.5, p*0.85); }`,
});

// ───────────────────────── textures ─────────────────────────
const artCache = new Map<string, THREE.Texture>();
function tokenTexture(id: string, faction: Faction): THREE.Texture {
  const k = id + faction;
  if (artCache.has(k)) return artCache.get(k)!;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const d = CARD_BY_ID[id];
  const col = FACTION_INFO[faction].color;
  const grd = g.createRadialGradient(128, 110, 10, 128, 128, 150);
  grd.addColorStop(0, col); grd.addColorStop(1, '#0b0b0d');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.font = '600 90px Oswald, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(id === '?' ? '?' : glyph(d?.name ?? '?'), 128, 118);
  g.font = '600 22px Oswald, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.7)';
  g.fillText((d?.cls ?? '').toUpperCase(), 128, 196);
  const tex: THREE.Texture = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.center.set(0.5, 0.5);
  artCache.set(k, tex);
  // try real art
  if (ART.has(id)) {
    new THREE.TextureLoader().load(`/art/${id}.webp`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      // crop portrait to square centre
      t.repeat.set(1, 2 / 3); t.offset.set(0, 1 / 6);
      // dispose first: the GPU storage was sized for the placeholder canvas
      tex.dispose();
      (tex as THREE.Texture).image = t.image; tex.repeat.copy(t.repeat); tex.offset.copy(t.offset); tex.needsUpdate = true;
    }, undefined, () => {});
  }
  return tex;
}

export function glyph(name: string): string {
  const w = name.replace(/["']/g, '').split(/[\s-]+/).filter((x) => /^[A-Za-z]/.test(x));
  return ((w[0]?.[0] ?? '?') + (w[1]?.[0] ?? '')).toUpperCase();
}

/** Wavering: at half Nerve or less. Purely a warning label; no rules attached. */
const wavering = (f: Formation) => f.morale * 2 <= maxNerve(f);

const BADGE = { pow: new Image(), nrv: new Image() };
BADGE.pow.src = '/ui/badge_power.webp';
BADGE.nrv.src = '/ui/badge_nerve.webp';
export const badgesReady = () => BADGE.pow.complete && BADGE.nrv.complete && BADGE.pow.naturalWidth > 0;

function labelCanvas(f: Formation, s: GameState, viewer: PlayerId): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 112;
  const g = c.getContext('2d')!;
  const unknown = f.cards[0]?.id === '?';
  const pw = unknown ? '?' : String(power(f));
  const fearless = !unknown && isFearless(s, f);
  const nv = unknown ? '?' : fearless ? '∞' : `${Math.max(0, f.morale)}`;
  const num = (txt: string, x: number, y: number, fill: string, stroke: string) => {
    g.font = '900 40px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 7; g.strokeStyle = stroke; g.strokeText(txt, x, y);
    g.fillStyle = fill; g.fillText(txt, x, y);
  };
  if (badgesReady()) {
    g.drawImage(BADGE.pow, 34, 0, 86, 92);
    g.drawImage(BADGE.nrv, 140, 0, 80, 86);
  }
  num(pw, 77, 42, '#fff1d6', '#2a0805');
  num(nv, 180, 40, '#eaf0ff', '#0a1530');
  if (f.cards.length > 1) {
    for (let i = 0; i < f.cards.length; i++) {
      const x = 128 - (f.cards.length - 1) * 11 + i * 22;
      g.save(); g.translate(x, 100); g.rotate(Math.PI / 4);
      g.fillStyle = '#f3d999'; g.strokeStyle = '#3a280c'; g.lineWidth = 2; g.fillRect(-6, -6, 12, 12); g.strokeRect(-6, -6, 12, 12);
      g.restore();
    }
  } else if (!unknown && !fearless && wavering(f)) {
    g.font = '700 19px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#000';
    g.strokeText('WAVERING', 128, 100); g.fillStyle = '#ffb03a'; g.fillText('WAVERING', 128, 100);
  }
  void viewer;
  return c;
}

/** Procedural painted-dirt texture shared by all tiles (mud, grit, scorch marks). */
let groundTex: THREE.Texture | null = null;
function groundTexture(): THREE.Texture {
  if (groundTex) return groundTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    const v = 110 + rnd() * 120;
    g.fillStyle = `rgba(${v * 0.85},${v},${v * 0.6},${0.08 + rnd() * 0.2})`;
    g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 14, 1 + rnd() * 7, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 14; i++) { // cracks
    g.strokeStyle = `rgba(30,24,18,${0.15 + rnd() * 0.25})`; g.lineWidth = 0.6 + rnd() * 1.2;
    g.beginPath(); let x = rnd() * 256, y = rnd() * 256; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  groundTex = new THREE.CanvasTexture(c);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.colorSpace = THREE.SRGBColorSpace;
  return groundTex;
}

// ───────────────────────── token ─────────────────────────
interface Token {
  fid: number;
  group: THREE.Group;
  body: THREE.Mesh;
  top: THREE.Mesh;
  label: THREE.Sprite;
  ring: THREE.Mesh;
  cloak?: THREE.Mesh;
  smoke?: THREE.Points;
  evolve?: THREE.Mesh;
  sig: string;
  pos: Pos;
}

interface Tween { t0: number; dur: number; fn: (k: number) => void; done?: () => void }

export class Board3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  root = new THREE.Group();
  tiles = new Map<string, THREE.Mesh>();
  tileTop = new Map<string, number>();
  tokens = new Map<number, Token>();
  overlays = new THREE.Group();     // highlights, ghosts, intents
  fx = new THREE.Group();
  links = new THREE.Group();
  tweens: Tween[] = [];
  shaders: THREE.ShaderMaterial[] = [];
  seat: PlayerId = 0;
  clock = new THREE.Timer();
  raycaster = new THREE.Raycaster();
  onFloat?: (x: number, y: number, text: string, color: string) => void;
  private relayRings = new Map<string, THREE.Mesh>();

  constructor(private el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    el.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.scene.background = new THREE.Color('#2a3a2c');
    this.scene.fog = new THREE.Fog('#34463a', 20, 46);
    this.renderer.toneMappingExposure = 1.25;
    this.scene.add(this.root);
    this.root.add(this.overlays, this.fx, this.links);

    const hemi = new THREE.HemisphereLight('#dfe9ff', '#3a4a2a', 1.6);
    const key = new THREE.DirectionalLight('#fff0d0', 3.0);
    key.position.set(-6, 14, 8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    const rim = new THREE.DirectionalLight('#6a7cff', 0.8);
    rim.position.set(6, 6, -10);
    this.scene.add(hemi, key, rim);

    // ground plane
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#3d5232', roughness: 1, map: groundTexture() }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true;
    this.scene.add(ground);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.6, 0.82));
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.el.clientWidth || window.innerWidth, h = this.el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // fit board: portrait screens need the camera further away
    const portrait = h > w;
    const dist = portrait ? 25 + (h / w - 1) * 12 : 16.8;
    this.camera.position.set(0, dist * 0.92, dist * 0.62 + 1.5);
    this.camera.lookAt(0, 0, portrait ? 2.2 : 2.0);
    this.camera.updateProjectionMatrix();
  }

  setSeat(seat: PlayerId) {
    this.seat = seat;
    this.root.rotation.y = seat === 1 ? Math.PI : 0;
  }

  // ───────── board: the battle line ─────────
  private terrainSig = '';
  private boardObjs: THREE.Object3D[] = [];
  buildTiles(s: GameState) {
    const sig = s.terrain.join(',');
    if (sig === this.terrainSig) return;
    this.terrainSig = sig;
    for (const o of this.boardObjs) this.root.remove(o);
    this.boardObjs = []; this.tiles.clear(); this.tileTop.clear();
    const add = (o: THREE.Object3D) => { this.root.add(o); this.boardObjs.push(o); };
    for (const pos of allCells()) {
      const t: Terrain = s.terrain[pos.col];
      const h = BASE_H + (t === 'ridge' ? 0.32 : 0);
      const geo = new THREE.BoxGeometry(CELL * 0.92, h, 1.62);
      geo.translate(0, h / 2, 0);
      const back = pos.row === 0 || pos.row === 3;
      const base = t === 'ruins' ? '#8a867a' : t === 'ridge' ? '#8fae5a' : back ? '#5f8a45' : '#6c9a4c';
      const mat = new THREE.MeshStandardMaterial({ color: base, map: groundTexture(), roughness: 0.95, metalness: 0.04 });
      const m = new THREE.Mesh(geo, mat);
      const [x, z] = hexXZ(pos);
      m.position.set(x, 0, z);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.pos = pos;
      add(m);
      this.tiles.set(key(pos), m);
      this.tileTop.set(key(pos), h);
      if (t !== 'ruins') {
        const tuftMat = new THREE.MeshStandardMaterial({ color: t === 'ridge' ? '#a8c46a' : '#7fae55', roughness: 1 });
        for (let i = 0; i < 5; i++) {
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16 + Math.random() * 0.12, 4), tuftMat);
          const ex = (Math.random() < 0.5 ? -1 : 1) * (0.62 + Math.random() * 0.15), ez = (Math.random() - 0.5) * 1.4;
          tuft.position.set(x + (i % 2 ? ex : (Math.random() - 0.5) * 1.3), h + 0.08, z + (i % 2 ? ez : (Math.random() < 0.5 ? -0.72 : 0.72)));
          add(tuft);
        }
      }
      if (t === 'ruins') {
        for (let i = 0; i < 3; i++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.16 + Math.random() * 0.2, 0.12 + Math.random() * 0.3, 0.16), mat);
          b.position.set(x + (i - 1) * 0.6, h + 0.08, z + (i % 2 ? 0.66 : -0.66));
          b.rotation.y = Math.random() * 3; b.castShadow = true;
          add(b);
        }
      }
    }
    // the trench: no-man's-land between the two front rows
    const trench = new THREE.Mesh(new THREE.BoxGeometry(CELL * COLS + 0.6, 0.06, 0.55), new THREE.MeshStandardMaterial({ color: '#3a2c1e', roughness: 1 }));
    trench.position.set(0, 0.03, 0); add(trench);
    for (let i = 0; i < COLS * 2 - 1; i++) {
      const wire = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 4, 10), new THREE.MeshStandardMaterial({ color: '#4a4038', metalness: 0.6, roughness: 0.5 }));
      wire.position.set((i - (COLS - 1)) * CELL / 2, 0.16, 0); wire.rotation.y = Math.PI / 2; add(wire);
    }
    // terrain labels at both ends of each special column
    for (let c = 0; c < COLS; c++) {
      const t = s.terrain[c];
      if (t === 'open') continue;
      for (const z of [this.seat === 0 ? 4.25 : -4.25]) {
        const lbl = textSprite(t === 'ridge' ? 'RIDGE  +1' : 'RUINS  −1 RANGED', t === 'ridge' ? '#f3d999' : '#c9b9a0');
        lbl.position.set((c - (COLS - 1) / 2) * CELL, 0.25, z); add(lbl);
      }
    }
  }

  topY(p: Pos) { return this.tileTop.get(key(p)) ?? BASE_H; }

  // ───────── sync formations ─────────
  sync(s: GameState, viewer: PlayerId) {
    this.buildTiles(s);
    const seen = new Set<number>();
    for (const f of s.formations) {
      seen.add(f.fid);
      let tk = this.tokens.get(f.fid);
      if (!tk) tk = this.makeToken(f, s, viewer);
      this.updateToken(tk, f, s, viewer);
    }
    for (const [fid, tk] of this.tokens) if (!seen.has(fid)) { this.root.remove(tk.group); this.tokens.delete(fid); }
    this.drawLinks(s);
    this.drawHands(s);
  }

  private hands = new THREE.Group();
  /** Column hand names along the trench (yours on your side, theirs on theirs). */
  private drawHands(s: GameState) {
    if (!this.hands.parent) this.root.add(this.hands);
    this.hands.clear();
    for (let c = 0; c < COLS; c++) {
      for (const p of [0, 1] as PlayerId[]) {
        const h = columnHand(s, p, c);
        if (!h.rank) continue;
        const lbl = textSprite(HAND_NAMES[h.rank].toUpperCase(), p === this.seat ? '#f3d999' : '#ff9a85');
        lbl.scale.set(1.5, 0.19, 1);
        const [x] = hexXZ({ col: c, row: 0 });
        lbl.position.set(x, 0.42, p === 0 ? 0.2 : -0.2);
        this.hands.add(lbl);
      }
    }
  }

  private makeToken(f: Formation, s: GameState, viewer: PlayerId): Token {
    const group = new THREE.Group();
    const h = 0.22;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.32, h, 1.32), new THREE.MeshStandardMaterial({ color: '#1c1b1e', metalness: 0.6, roughness: 0.4 }));
    body.position.y = h / 2; body.castShadow = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 1.14), new THREE.MeshStandardMaterial({ roughness: 0.7 }));
    top.rotation.x = -Math.PI / 2; top.position.y = h + 0.005;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.93, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: f.owner === viewer ? ME_COLOR : OPP_COLOR }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = h + 0.01;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    label.scale.set(1.35, 0.59, 1); label.position.y = h + 0.75; label.renderOrder = 10;
    group.add(body, top, ring, label);
    this.root.add(group);
    const tk: Token = { fid: f.fid, group, body, top, label, ring, sig: '', pos: f.pos };
    const [x, z] = hexXZ(f.pos);
    group.position.set(x, this.topY(f.pos), z);
    this.tokens.set(f.fid, tk);
    void s;
    return tk;
  }

  private updateToken(tk: Token, f: Formation, s: GameState, viewer: PlayerId) {
    const [x, z] = hexXZ(f.pos);
    tk.group.position.set(x, this.topY(f.pos), z);
    tk.pos = f.pos;
    const id = lead(f)?.id ?? '?';
    const fac = s.players[f.owner].faction;
    const sig = [id, power(f), f.morale, f.cards.length, f.cloaked, isFearless(s, f), lead(f)?.grow ?? 0, badgesReady()].join('|');
    if (sig === tk.sig) return;
    tk.sig = sig;
    (tk.top.material as THREE.MeshStandardMaterial).map = tokenTexture(id, fac);
    (tk.top.material as THREE.MeshStandardMaterial).needsUpdate = true;
    // label
    const tex = new THREE.CanvasTexture(labelCanvas(f, s, viewer));
    tex.colorSpace = THREE.SRGBColorSpace;
    const lm = tk.label.material as THREE.SpriteMaterial;
    lm.map?.dispose(); lm.map = tex; lm.needsUpdate = true;
    // stack height
    tk.body.scale.y = 1 + (f.cards.length - 1) * 0.6;
    const h = (tk.body.geometry as THREE.CylinderGeometry).parameters.height * tk.body.scale.y;
    tk.body.position.y = h / 2;
    tk.top.position.y = h + 0.005; tk.ring.position.y = h + 0.01; tk.label.position.y = h + 0.75;
    // cloak shimmer
    if (f.cloaked && !tk.cloak) {
      const m = cloakMat(); this.shaders.push(m);
      tk.cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.0, 1.1, 4, 1, true), m);
      tk.cloak.position.y = 0.55; tk.cloak.rotation.y = Math.PI / 4;
      tk.group.add(tk.cloak);
    } else if (!f.cloaked && tk.cloak) { tk.group.remove(tk.cloak); tk.cloak = undefined; }
    (tk.top.material as THREE.MeshStandardMaterial).transparent = f.cloaked;
    (tk.top.material as THREE.MeshStandardMaterial).opacity = f.cloaked ? (f.owner === viewer ? 0.6 : 0.25) : 1;
    // broken smoke
    const shaky = id !== '?' && !isFearless(s, f) && wavering(f);
    if (shaky && !tk.smoke) { tk.smoke = makeSmoke(); tk.group.add(tk.smoke); }
    else if (!shaky && tk.smoke) { tk.group.remove(tk.smoke); tk.smoke = undefined; }
    (tk.body.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(shaky ? '#3a0e08' : '#000');
    // evolve glow
    const grow = lead(f)?.grow ?? 0;
    if (grow > 0 && !tk.evolve) {
      const m = ringMat(new THREE.Color('#8fff4a')); m.uniforms.uSpeed.value = 3; this.shaders.push(m);
      tk.evolve = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9 + grow * 0.05, 24), m);
      tk.evolve.rotation.x = -Math.PI / 2; tk.evolve.position.y = 0.02;
      tk.group.add(tk.evolve);
    } else if (grow === 0 && tk.evolve) { tk.group.remove(tk.evolve); tk.evolve = undefined; }
    tk.group.userData.shaken = shaky;
    void leadDef;
  }

  private drawLinks(s: GameState) {
    this.links.clear();
    for (const f of s.formations) {
      if (f.cards[0]?.id === '?') continue;
      const src = linkSource(s, f);
      if (!src) continue;
      const [x0, z0] = hexXZ(src.pos), [x1, z1] = hexXZ(f.pos);
      const y0 = this.topY(src.pos) + 0.5, y1 = this.topY(f.pos) + 0.5;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3((x0 + x1) / 2, Math.max(y0, y1) + 0.9, (z0 + z1) / 2), new THREE.Vector3(x1, y1, z1));
      const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
      const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#9dff5a', dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.8 }));
      line.computeLineDistances();
      this.links.add(line);
    }
  }

  // ───────── overlays ─────────
  clearOverlays() { this.overlays.clear(); }

  highlight(hexes: Pos[], color = '#e0a03c') {
    for (const p of hexes) {
      const [x, z] = hexXZ(p);
      const m = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.12, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, this.topY(p) + 0.03, z);
      this.overlays.add(m);
    }
  }

  ghost(p: Pos, id: string, faction: Faction, isTacticCard: boolean) {
    const [x, z] = hexXZ(p);
    if (isTacticCard) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 24), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
      m.rotation.x = Math.PI / 2; m.position.set(x, this.topY(p) + 1.3, z);
      this.overlays.add(m);
      return;
    }
    const top = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: tokenTexture(id, faction), transparent: true, opacity: 0.75 }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(x, this.topY(p) + (this.occupied(p) ? 1.0 : 0.3), z);
    this.overlays.add(top);
  }

  private occupied(p: Pos) { for (const t of this.tokens.values()) if (t.pos.col === p.col && t.pos.row === p.row) return true; return false; }

  /** Draw intent arrows from simulated strike/move events. */
  intents(events: GameEvent[], ownerOf: (fid: number) => PlayerId | undefined, viewer: PlayerId) {
    for (const e of events) {
      if (e.t === 'move') {
        const [x0, z0] = hexXZ(e.from), [x1, z1] = hexXZ(e.to);
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, this.topY(e.from) + 0.12, z0), new THREE.Vector3(x1, this.topY(e.to) + 0.12, z1)]);
        const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: ownerOf(e.fid) === viewer ? '#f3d38a' : '#ff8a7a', dashSize: 0.15, gapSize: 0.1 }));
        l.computeLineDistances();
        this.overlays.add(l);
        this.overlays.add(arrowHead(new THREE.Vector3(x0, 0.12 + this.topY(e.from), z0), new THREE.Vector3(x1, this.topY(e.to) + 0.12, z1), ownerOf(e.fid) === viewer ? '#f3d38a' : '#ff8a7a', 0.18));
      } else if (e.t === 'edge') {
        const [x] = hexXZ({ col: e.col, row: 0 });
        const mine = e.owner === viewer;
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.86, 0.5), new THREE.MeshBasicMaterial({ color: mine ? '#ffcf6a' : '#ff5a40', transparent: true, opacity: 0.55, depthWrite: false }));
        strip.rotation.x = -Math.PI / 2; strip.position.set(x, 0.08, 0);
        this.overlays.add(strip);
        const lbl = textSprite('EDGE +1', mine ? '#ffe39a' : '#ff8a6a');
        lbl.scale.set(1.3, 0.17, 1); lbl.position.set(x, 0.7, 0);
        this.overlays.add(lbl);
      } else if (e.t === 'breach') {
        // gold chevrons charging into the empty enemy column
        const [x, z] = hexXZ(e.pos);
        const dir = e.pos.row >= 2 ? -1 : 1;
        for (let k = 0; k < 3; k++) {
          const ch = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 3), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.95 - k * 0.22 }));
          ch.rotation.x = dir * Math.PI / 2; ch.rotation.y = 0;
          ch.position.set(x, 0.5, z + dir * (1.0 + k * 0.42));
          this.overlays.add(ch);
        }
      } else if (e.t === 'flank') {
        // red brackets on both sides of a flanked unit
        const [x, z] = hexXZ(e.pos);
        for (const sx of [-1, 1]) {
          const br = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 1.2), new THREE.MeshBasicMaterial({ color: '#ff4a32' }));
          br.position.set(x + sx * 0.8, this.topY(e.pos) + 0.3, z);
          this.overlays.add(br);
        }
        const lbl = textSprite(`FLANKED +${e.amount}`, '#ff8a6a');
        lbl.position.set(x, this.topY(e.pos) + 1.45, z); lbl.scale.set(1.8, 0.23, 1);
        this.overlays.add(lbl);
      } else if (e.t === 'strike') {
        const mine = ownerOf(e.fid) === viewer;
        const col = e.lethal ? '#ff3b2b' : mine ? '#ffd27a' : '#ff7a5a';
        const [x0, z0] = hexXZ(e.from), [x1, z1] = hexXZ(e.to);
        const a = new THREE.Vector3(x0, this.topY(e.from) + 0.9, z0), b = new THREE.Vector3(x1, this.topY(e.to) + 0.6, z1);
        const mid = a.clone().lerp(b, 0.5); mid.y += 0.5 + a.distanceTo(b) * 0.15;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.035, 5), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 }));
        this.overlays.add(tube);
        this.overlays.add(arrowHead(curve.getPoint(0.9), b, col, 0.22));
      }
    }
  }

  // ───────── picking ─────────
  pick(clientX: number, clientY: number): Pos | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const objs: THREE.Object3D[] = [...this.tiles.values(), ...[...this.tokens.values()].map((t) => t.group)];
    const hit = this.raycaster.intersectObjects(objs, true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      if (o.userData.pos) return o.userData.pos as Pos;
      for (const t of this.tokens.values()) if (t.group === o) return t.pos;
      o = o.parent;
    }
    return null;
  }

  screenOf(p: Pos, yOff = 1.0): [number, number] {
    const [x, z] = hexXZ(p);
    const v = new THREE.Vector3(x, this.topY(p) + yOff, z);
    this.root.localToWorld(v);
    v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height];
  }

  // ───────── animation ─────────
  tween(dur: number, fn: (k: number) => void): Promise<void> {
    return new Promise((res) => this.tweens.push({ t0: performance.now(), dur, fn, done: res }));
  }

  async animateMove(fid: number, to: Pos) {
    const tk = this.tokens.get(fid);
    if (!tk) return;
    const from = tk.group.position.clone();
    const [x, z] = hexXZ(to);
    const y1 = this.topY(to);
    tk.pos = to;
    await this.tween(260, (k) => {
      const e = k * k * (3 - 2 * k);
      tk.group.position.set(from.x + (x - from.x) * e, from.y + (y1 - from.y) * e + Math.sin(k * Math.PI) * 0.3, from.z + (z - from.z) * e);
    });
  }

  async animateStrike(e: Extract<GameEvent, { t: 'strike' }>) {
    const [x0, z0] = hexXZ(e.from), [x1, z1] = hexXZ(e.to);
    const a = new THREE.Vector3(x0, this.topY(e.from) + 0.6, z0), b = new THREE.Vector3(x1, this.topY(e.to) + 0.5, z1);
    const melee = Math.hypot(x1 - x0, z1 - z0) < 2.0;
    const tk = this.tokens.get(e.fid);
    if (melee && tk) {
      const p0 = tk.group.position.clone();
      await this.tween(220, (k) => { const s = Math.sin(k * Math.PI) * 0.45; tk.group.position.set(p0.x + (x1 - x0) * s, p0.y, p0.z + (z1 - z0) * s); });
      tk.group.position.copy(p0);
    } else {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: e.lethal ? '#ff5a3a' : '#ffd27a' }));
      this.fx.add(bolt);
      const mid = a.clone().lerp(b, 0.5); mid.y += 1 + a.distanceTo(b) * 0.2;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      await this.tween(320, (k) => bolt.position.copy(curve.getPoint(k)));
      this.fx.remove(bolt);
    }
    this.burst(e.to, e.lethal ? '#ff4a2a' : '#ffb84a');
  }

  burst(p: Pos, color: string, n = 26) {
    const [x, z] = hexXZ(p);
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), vel: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) { pos.set([x, this.topY(p) + 0.5, z], i * 3); vel.push(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3)); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.14, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fx.add(pts);
    const t0 = performance.now();
    this.tweens.push({ t0, dur: 650, fn: (k) => {
      const a = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) { a.setXYZ(i, x + vel[i].x * k * 0.5, this.topY(p) + 0.5 + vel[i].y * k * 0.5 - 2 * k * k, z + vel[i].z * k * 0.5); }
      a.needsUpdate = true; (pts.material as THREE.PointsMaterial).opacity = 1 - k;
    }, done: () => this.fx.remove(pts) });
  }

  async animateRemove(fid: number) {
    const tk = this.tokens.get(fid);
    if (!tk) return;
    const y0 = tk.group.position.y;
    await this.tween(380, (k) => { tk.group.position.y = y0 - k * 0.6; tk.group.scale.setScalar(1 - k * 0.6); });
    this.root.remove(tk.group); this.tokens.delete(fid);
  }

  async animateDeploy(f: Formation, s: GameState, viewer: PlayerId) {
    let tk = this.tokens.get(f.fid);
    if (!tk) { tk = this.makeToken(f, s, viewer); this.updateToken(tk, f, s, viewer); }
    const g = tk.group;
    await this.tween(300, (k) => { g.scale.setScalar(0.2 + 0.8 * (1 - Math.pow(1 - k, 3))); g.position.y = this.topY(f.pos) + (1 - k) * 2; });
    this.burst(f.pos, '#ffe0a0', 14);
  }

  float(p: Pos, text: string, color: string) {
    const [sx, sy] = this.screenOf(p, 1.3);
    this.onFloat?.(sx, sy, text, color);
  }

  private frame() {
    this.clock.update();
    const t = this.clock.getElapsed();
    const now = performance.now();
    this.tweens = this.tweens.filter((tw) => {
      const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(k);
      if (k >= 1) { tw.done?.(); return false; }
      return true;
    });
    for (const m of this.shaders) if (m.uniforms.uTime) m.uniforms.uTime.value = t;
    for (const tk of this.tokens.values()) {
      if (tk.smoke) animateSmoke(tk.smoke, t);
      tk.top.rotation.z = tk.group.userData.shaken ? Math.sin(t * 30) * 0.03 : 0;
    }
    for (const l of this.links.children) ((l as THREE.Line).material as THREE.LineDashedMaterial & { dashOffset?: number });
    this.composer.render();
  }
}

function arrowHead(from: THREE.Vector3, to: THREE.Vector3, color: string, size: number): THREE.Mesh {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(size * 0.6, size * 1.4, 8), new THREE.MeshBasicMaterial({ color }));
  cone.position.copy(to);
  const dir = to.clone().sub(from).normalize();
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return cone;
}

function makeSmoke(): THREE.Points {
  const n = 18;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const seeds = new Float32Array(n);
  for (let i = 0; i < n; i++) seeds[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.userData.seeds = seeds;
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#5a4a44', size: 0.45, transparent: true, opacity: 0.5, depthWrite: false }));
}
function animateSmoke(p: THREE.Points, t: number) {
  const a = p.geometry.getAttribute('position') as THREE.BufferAttribute;
  const seeds = p.geometry.userData.seeds as Float32Array;
  for (let i = 0; i < seeds.length; i++) {
    const k = (t * 0.35 + seeds[i]) % 1;
    a.setXYZ(i, Math.sin(seeds[i] * 40) * 0.4 + Math.sin(t + i) * 0.1 * k, 0.4 + k * 2.2, Math.cos(seeds[i] * 40) * 0.4);
  }
  a.needsUpdate = true;
}

/** Small always-facing-camera text label (terrain names, etc.). */
function textSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '700 34px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(text, 256, 32);
  g.fillStyle = color; g.fillText(text, 256, 32);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.2, 0.28, 1);
  return sp;
}
