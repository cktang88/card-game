import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CARD_BY_ID, FACTION_INFO, Faction } from '../shared/cards';
import { ART } from './art-manifest';
import { Pos, ROWS, key, rowWidth } from '../shared/hex';
import {
  Formation, GameEvent, GameState, PlayerId, has, isFearless, isHQ, lead, leadDef, linkSource, maxNerve, power,
} from '../shared/engine';

const R = 1;              // hex radius
const SQ3 = Math.sqrt(3);
const ELEV_H = 0.32;
const BASE_H = 0.22;

export const ME_COLOR = new THREE.Color('#e0a03c');
export const OPP_COLOR = new THREE.Color('#c8452f');

export function hexXZ(p: Pos): [number, number] {
  const x = SQ3 * R * (p.col + (p.row % 2 === 0 ? 0.5 : 0)) - SQ3 * R * 3;
  const z = 1.5 * R * p.row - 1.5 * R * (ROWS - 1) / 2;
  return [x, z];
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
  tex.rotation = -Math.PI / 2;   // token faces are rotated 90° to align the hex
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

function labelCanvas(f: Formation, s: GameState, viewer: PlayerId): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d')!;
  const unknown = f.cards[0]?.id === '?';
  const pw = unknown ? '?' : String(power(f));
  const fearless = !unknown && isFearless(s, f);
  const nv = unknown ? '?' : fearless ? '∞' : `${Math.max(0, f.morale)}`;
  if (!unknown && isHQ(f)) return c;
  const box = (x: number, bg1: string, bg2: string, txt: string) => {
    const gr = g.createLinearGradient(0, 8, 0, 64); gr.addColorStop(0, bg1); gr.addColorStop(1, bg2);
    g.fillStyle = gr; g.beginPath(); g.roundRect(x, 8, 76, 56, 8); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#fff'; g.font = '700 44px Oswald, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, x + 38, 38);
  };
  box(40, '#e07a2c', '#6d2c08', pw);
  box(140, '#4a90d0', '#173b63', nv);
  // stack pips
  if (f.cards.length > 1) {
    g.fillStyle = '#f2e0b0';
    for (let i = 0; i < f.cards.length; i++) { g.beginPath(); g.arc(128 - (f.cards.length - 1) * 9 + i * 18, 82, 6, 0, Math.PI * 2); g.fill(); }
  }
  if (!unknown && !fearless && wavering(f)) { g.fillStyle = '#ffb03a'; g.font = '700 20px Oswald'; g.textAlign = 'center'; g.fillText('WAVERING', 128, 84); }
  void viewer; void maxNerve;
  return c;
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
    this.scene.background = new THREE.Color('#0d0e10');
    this.scene.fog = new THREE.Fog('#0d0e10', 18, 40);
    this.scene.add(this.root);
    this.root.add(this.overlays, this.fx, this.links);

    const hemi = new THREE.HemisphereLight('#b9a88a', '#141210', 0.9);
    const key = new THREE.DirectionalLight('#ffd9a0', 2.2);
    key.position.set(-6, 14, 8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
    const rim = new THREE.DirectionalLight('#6a7cff', 0.8);
    rim.position.set(6, 6, -10);
    this.scene.add(hemi, key, rim);

    // ground plane
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: '#16130f', roughness: 1 }));
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
    const dist = portrait ? 22 + (h / w - 1) * 10 : 15.5;
    this.camera.position.set(0, dist * 0.92, dist * 0.62 + 1.5);
    this.camera.lookAt(0, 0, portrait ? 0.8 : 1.1);
    this.camera.updateProjectionMatrix();
  }

  setSeat(seat: PlayerId) {
    this.seat = seat;
    this.root.rotation.y = seat === 1 ? Math.PI : 0;
  }

  // ───────── board tiles ─────────
  buildTiles(s: GameState) {
    for (const t of s.tiles) {
      const k = key(t.pos);
      if (this.tiles.has(k)) continue;
      const h = BASE_H + t.elev * ELEV_H;
      const geo = new THREE.CylinderGeometry(R * 0.96, R * 0.98, h, 6);
      geo.translate(0, h / 2, 0);
      const base = t.terrain === 'ruins' ? '#4b4640' : t.terrain === 'crater' ? '#2a2420' : t.terrain === 'relay' ? '#3a3a40' : ['#5a5246', '#6a604f', '#7a6e58'][t.elev];
      const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.92, metalness: 0.05, flatShading: true });
      const m = new THREE.Mesh(geo, mat);
      const [x, z] = hexXZ(t.pos);
      m.position.set(x, 0, z);
      m.rotation.y = Math.PI / 6 * 0; // pointy-top: cylinder's default vertex at +z → rotate 30° for pointy
      m.rotation.y = 0;
      m.castShadow = true; m.receiveShadow = true;
      m.userData.pos = t.pos;
      this.root.add(m);
      this.tiles.set(k, m);
      this.tileTop.set(k, h);
      // decorations
      if (t.terrain === 'ruins') {
        for (let i = 0; i < 4; i++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.18 + Math.random() * 0.2, 0.15 + Math.random() * 0.35, 0.18), mat);
          const a = (i / 4) * Math.PI * 2 + 0.4;
          b.position.set(x + Math.cos(a) * 0.62, h + 0.1, z + Math.sin(a) * 0.62);
          b.rotation.y = Math.random() * 3; b.castShadow = true;
          this.root.add(b);
        }
      }
      if (t.terrain === 'crater') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 6, 18), new THREE.MeshStandardMaterial({ color: '#3a302a', roughness: 1 }));
        ring.rotation.x = Math.PI / 2; ring.position.set(x, h + 0.02, z);
        this.root.add(ring);
      }
      if (t.terrain === 'relay') {
        const rm = ringMat(new THREE.Color('#9aa0b0'));
        this.shaders.push(rm);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.84, 6), rm);
        ring.rotation.x = -Math.PI / 2; ring.position.set(x, h + 0.015, z);
        this.root.add(ring);
        this.relayRings.set(k, ring);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.2, 6), new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8, roughness: 0.3 }));
        mast.position.set(x + 0.62, h + 0.6, z - 0.3);
        this.root.add(mast);
      }
    }
  }

  topY(p: Pos) { return this.tileTop.get(key(p)) ?? BASE_H; }

  // ───────── sync formations ─────────
  sync(s: GameState, viewer: PlayerId) {
    this.buildTiles(s);
    // tiles state (relay owners, fortified)
    for (const t of s.tiles) {
      const ring = this.relayRings.get(key(t.pos));
      if (ring) (ring.material as THREE.ShaderMaterial).uniforms.uColor.value = t.relayOwner === -1 ? new THREE.Color('#9aa0b0') : t.relayOwner === viewer ? ME_COLOR : OPP_COLOR;
      const tile = this.tiles.get(key(t.pos))!;
      const mat = tile.material as THREE.MeshStandardMaterial;
      mat.emissive = new THREE.Color(t.fortified ? '#3a2a10' : '#000');
    }
    const seen = new Set<number>();
    for (const f of s.formations) {
      seen.add(f.fid);
      let tk = this.tokens.get(f.fid);
      if (!tk) tk = this.makeToken(f, s, viewer);
      this.updateToken(tk, f, s, viewer);
    }
    for (const [fid, tk] of this.tokens) if (!seen.has(fid)) { this.root.remove(tk.group); this.tokens.delete(fid); }
    this.drawLinks(s);
  }

  private makeToken(f: Formation, s: GameState, viewer: PlayerId): Token {
    const group = new THREE.Group();
    const isHq = isHQ(f);
    const rad = isHq ? 0.86 : 0.7;
    const h = isHq ? 0.6 : 0.22;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.05, h, 6), new THREE.MeshStandardMaterial({ color: '#1c1b1e', metalness: 0.6, roughness: 0.4 }));
    body.position.y = h / 2; body.castShadow = true;
    const topGeo = new THREE.CircleGeometry(rad * 0.86, 6);
    const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }));
    top.rotation.x = -Math.PI / 2; top.rotation.z = Math.PI / 2; top.position.y = h + 0.005;
    const ring = new THREE.Mesh(new THREE.RingGeometry(rad * 0.88, rad * 1.02, 6), new THREE.MeshBasicMaterial({ color: f.owner === viewer ? ME_COLOR : OPP_COLOR }));
    ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 2; ring.position.y = h + 0.01;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    label.scale.set(1.3, 0.49, 1); label.position.y = h + 0.75; label.renderOrder = 10;
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
    const sig = [id, power(f), f.morale, f.cards.length, f.cloaked, isFearless(s, f), lead(f)?.grow ?? 0].join('|');
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
      tk.cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.8, 1.1, 6, 1, true), m);
      tk.cloak.position.y = 0.55;
      tk.group.add(tk.cloak);
    } else if (!f.cloaked && tk.cloak) { tk.group.remove(tk.cloak); tk.cloak = undefined; }
    (tk.top.material as THREE.MeshStandardMaterial).transparent = f.cloaked;
    (tk.top.material as THREE.MeshStandardMaterial).opacity = f.cloaked ? (f.owner === viewer ? 0.6 : 0.25) : 1;
    // broken smoke
    const shaky = id !== '?' && !isHQ(f) && !isFearless(s, f) && wavering(f);
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
      const m = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.92, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2;
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
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.62, 6), new THREE.MeshBasicMaterial({ map: tokenTexture(id, faction), transparent: true, opacity: 0.75 }));
    top.rotation.x = -Math.PI / 2; top.rotation.z = Math.PI / 2;
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
      tk.top.rotation.z = Math.PI / 2 + (tk.group.userData.shaken ? Math.sin(t * 30) * 0.03 : 0);
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

export { rowWidth };
