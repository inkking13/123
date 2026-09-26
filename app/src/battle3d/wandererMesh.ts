import * as THREE from 'three';

// The hooded wanderer from the model sheet in the repo root
// (Gemini_Generated_Image_uaer8…), built as a low-poly mesh. Every part is a
// loft — a stack of rings — so the silhouette follows the drawing; rings can
// carry folds (a wave around the ring) and ragged edges. Faces are painted
// with vertex colours: a soft top-to-bottom gradient plus a little per-face
// variation, like the hand-painted sheet. Real scale (≈1.86 m to the hood
// tip), Y up, facing +Z, origin between the feet; posed via named pivots.

type Ring = {
  y: number; rx: number; rz: number; x?: number; z?: number;
  /** Open ring covering this share of the circle, centred at the back. */
  arc?: number;
  /** Fold depth: radius wobbles by ±fold around the ring. */
  fold?: number;
  /** Vertical offset of vertex j (ragged hems). */
  jag?: (j: number) => number;
};

interface LoftOpts {
  capTop?: boolean;
  capBottom?: boolean;
  /** Folds around the ring. */
  folds?: number;
  /** Brightness at the bottom and top of the part. */
  shade?: [number, number];
  /** Per-face brightness jitter. */
  grain?: number;
  /** Colour of the inside (open or hollow parts); omit for a solid part. */
  inner?: string;
}

export const WANDERER_COLORS = {
  skin: '#d6a585', tunic: '#5a4739', trousers: '#4b4845', boots: '#5c3f2b', bootCuff: '#4c3424',
  bracer: '#5e4330', linen: '#8c857c', belt: '#4a3222', buckle: '#a8977a', pouch: '#5a3c28',
  cloak: '#4f4843', cloakIn: '#2e2926', hoodIn: '#0d0b0a', lace: '#1c1612', face: '#4a3428',
  grip: '#1c1618', guard: '#3a3034', blade: '#ff3a3a',
};

/** Height of the built figure (tip of the hood). */
export const WANDERER_BUILT_HEIGHT = 1.86;

export interface WandererRig {
  root: THREE.Group;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
  joints: Record<'hips' | 'spine' | 'neck' | 'head' | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'armL' | 'armR' | 'foreL' | 'foreR' | 'cloak', THREE.Object3D>;
}

/** Deterministic 0..1 noise per face. */
const hash = (i: number, s: number) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function buildWanderer(C = WANDERER_COLORS, lambert = true): WandererRig {
  const make = (side: THREE.Side) => (lambert
    ? new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side })
    : new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side, roughness: 0.9 }));
  const front = make(THREE.FrontSide);
  const back = make(THREE.BackSide);
  const glow = new THREE.MeshBasicMaterial({ color: C.blade, toneMapped: false });
  const geometries: THREE.BufferGeometry[] = [];
  let seed = 1;

  const paint = (g: THREE.BufferGeometry, color: string, shade: [number, number], grain: number) => {
    const p = g.attributes.position;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); }
    const base = new THREE.Color(color);
    const col = new Float32Array(p.count * 3);
    const s = seed++;
    for (let f = 0; f < p.count / 3; f++) {
      const y = (p.getY(f * 3) + p.getY(f * 3 + 1) + p.getY(f * 3 + 2)) / 3;
      const t = hi > lo ? (y - lo) / (hi - lo) : 1;
      const k = (shade[0] + (shade[1] - shade[0]) * t) * (1 + (hash(f, s) - 0.5) * 2 * grain);
      for (let v = 0; v < 3; v++) {
        col[(f * 3 + v) * 3] = base.r * k; col[(f * 3 + v) * 3 + 1] = base.g * k; col[(f * 3 + v) * 3 + 2] = base.b * k;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  };

  const loft = (rings: Ring[], n: number, color: string, o: LoftOpts = {}): THREE.Object3D => {
    const { capTop = true, capBottom = true, folds = 0, shade = [0.78, 1.06], grain = 0.06 } = o;
    const open = rings.some((r) => (r.arc ?? 1) < 1);
    const pos: number[] = [];
    const idx: number[] = [];
    rings.forEach((r, ri) => {
      for (let j = 0; j < n; j++) {
        const a = open ? Math.PI + (j / (n - 1) - 0.5) * Math.PI * 2 * (r.arc ?? 0.999) : (j / n) * Math.PI * 2;
        const w = 1 + (r.fold ?? 0) * Math.sin(a * folds + ri * 0.7);
        pos.push((r.x ?? 0) + r.rx * w * Math.sin(a), r.y + (r.jag ? r.jag(j) : 0), (r.z ?? 0) + r.rz * w * Math.cos(a));
      }
    });
    const segs = open ? n - 1 : n;
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * n + j, b = i * n + ((j + 1) % n), c = (i + 1) * n + j, d = (i + 1) * n + ((j + 1) % n);
        idx.push(a, c, b, b, c, d);
      }
    }
    const cap = (ri: number, up: boolean) => {
      const r = rings[ri];
      if (r.rx < 1e-4 || open) return;
      const ci = pos.length / 3;
      pos.push(r.x ?? 0, r.y, r.z ?? 0);
      for (let j = 0; j < n; j++) {
        const a = ri * n + j, b = ri * n + ((j + 1) % n);
        if (up) idx.push(ci, a, b); else idx.push(ci, b, a);
      }
    };
    const dir = Math.sign(rings[rings.length - 1].y - rings[0].y) || 1;
    if (capBottom) cap(0, dir < 0);
    if (capTop) cap(rings.length - 1, dir > 0);
    const tri = dir < 0 ? idx : idx.map((_, k) => idx[k - (k % 3) + (2 - (k % 3))]);
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(tri);
    g = g.toNonIndexed();
    g.computeVertexNormals();
    paint(g, color, shade, grain);
    geometries.push(g);
    const outer = new THREE.Mesh(g, front);
    if (!o.inner) return outer;
    // Hollow part: the same shell seen from inside, in its own colour.
    const gi = g.clone();
    paint(gi, o.inner, [0.8, 1], grain);
    geometries.push(gi);
    const grp = new THREE.Group();
    grp.add(outer, new THREE.Mesh(gi, back));
    return grp;
  };

  const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, shade: [number, number] = [0.85, 1.05]) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    paint(g, color, shade, 0.04);
    geometries.push(g);
    const m = new THREE.Mesh(g, front);
    m.position.set(x, y, z);
    return m;
  };
  const glowBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    geometries.push(g);
    const m = new THREE.Mesh(g, glow);
    m.position.set(x, y, z);
    return m;
  };
  const pivot = (name: string, x: number, y: number, z: number, parent: THREE.Object3D) => {
    const o = new THREE.Group();
    o.name = name;
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const band = (y: number, rx: number, rz: number, h: number, color: string, n = 10, z = 0) =>
    loft([{ y: y - h / 2, rx, rz, z }, { y: y + h / 2, rx, rz, z }], n, color, { capTop: false, capBottom: false, shade: [0.9, 1] });
  const rag = (amp: number, pattern: number[]) => (j: number) => pattern[j % pattern.length] * amp;

  const root = new THREE.Group();
  root.name = 'Wanderer';

  // ── Hips, trousers, boots ─────────────────────────────────────
  const hips = pivot('hips', 0, 0.97, 0, root);
  hips.add(loft([
    { y: -0.2, rx: 0.2, rz: 0.13 }, { y: -0.06, rx: 0.2, rz: 0.135 }, { y: 0.05, rx: 0.18, rz: 0.115 },
  ], 12, C.trousers));
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const hip = pivot(side < 0 ? 'thigh.R' : 'thigh.L', side * 0.1, -0.1, 0, hips);
    // Loose trousers, a little baggy over the knee.
    hip.add(loft([
      { y: 0.02, rx: 0.1, rz: 0.105 }, { y: -0.12, rx: 0.097, rz: 0.1, z: 0.01, fold: 0.04 },
      { y: -0.26, rx: 0.082, rz: 0.086, z: 0.012, fold: 0.05 }, { y: -0.38, rx: 0.07, rz: 0.074, z: 0.018 },
      { y: -0.44, rx: 0.066, rz: 0.07, z: 0.018 },
    ], 10, C.trousers, { folds: 3, shade: [0.8, 1.02] }));
    hip.add(box(0.012, 0.3, 0.012, C.lace, side * 0.098, -0.2, 0.0, [0.9, 1])); // side seam
    const knee = pivot(side < 0 ? 'shin.R' : 'shin.L', 0, -0.42, 0.01, hip);
    knee.add(loft([
      { y: 0.03, rx: 0.068, rz: 0.072, z: 0.008 }, { y: -0.08, rx: 0.07, rz: 0.076, z: -0.008 },
      { y: -0.2, rx: 0.062, rz: 0.066, z: -0.006 },
    ], 10, C.trousers, { folds: 4 }));
    // Knee patch.
    knee.add(box(0.07, 0.07, 0.015, C.bootCuff, 0, -0.01, 0.075, [0.9, 1]));
    // Slouched boot with a wide folded cuff.
    knee.add(loft([
      { y: -0.41, rx: 0.05, rz: 0.055 }, { y: -0.34, rx: 0.052, rz: 0.058 }, { y: -0.24, rx: 0.06, rz: 0.066, z: -0.006, fold: 0.05 },
      { y: -0.16, rx: 0.066, rz: 0.072, z: -0.008 },
    ], 10, C.boots, { capBottom: false, folds: 3, shade: [0.75, 1] }));
    knee.add(loft([
      { y: -0.2, rx: 0.074, rz: 0.08, z: -0.008 }, { y: -0.15, rx: 0.08, rz: 0.086, z: -0.008 },
      { y: -0.09, rx: 0.088, rz: 0.094, z: -0.008, jag: rag(0.012, [0, 1, -1, 0.5, 0, -0.5, 1, 0, -1, 0.5]) },
    ], 10, C.bootCuff, { inner: C.lace, capBottom: false, capTop: false, shade: [0.85, 1.08] }));
    const ankle = pivot(side < 0 ? 'foot.R' : 'foot.L', 0, -0.41, 0, knee);
    ankle.add(loft([
      { y: 0.06, rx: 0.052, rz: 0.05, z: -0.03 }, { y: 0.045, rx: 0.062, rz: 0.1, z: 0.02 },
      { y: 0.01, rx: 0.066, rz: 0.15, z: 0.06 }, { y: -0.04, rx: 0.064, rz: 0.155, z: 0.06 }, { y: -0.05, rx: 0.058, rz: 0.14, z: 0.06 },
    ], 10, C.boots, { shade: [0.55, 1] }));
    legs.push(hip, knee);
  }

  // ── Torso: tunic, collar lacing, belt, pouch, skirt ────────────
  const chest = pivot('spine', 0, 0.05, 0, hips);
  chest.add(loft([
    { y: -0.02, rx: 0.185, rz: 0.12 }, { y: 0.08, rx: 0.178, rz: 0.118, z: 0.006, fold: 0.03 }, { y: 0.2, rx: 0.198, rz: 0.126, z: 0.01, fold: 0.03 },
    { y: 0.3, rx: 0.218, rz: 0.134, z: 0.014 }, { y: 0.38, rx: 0.226, rz: 0.128, z: 0.01 }, { y: 0.44, rx: 0.2, rz: 0.104 },
    { y: 0.49, rx: 0.12, rz: 0.078, z: -0.01 }, { y: 0.51, rx: 0.065, rz: 0.058 },
  ], 14, C.tunic, { folds: 5, shade: [0.82, 1.08] }));
  // V-neck opening with criss-cross laces.
  const vneck = box(0.05, 0.1, 0.01, C.hoodIn, 0, 0.42, 0.112);
  vneck.rotation.x = -0.3;
  chest.add(vneck);
  for (let k = 0; k < 3; k++) {
    for (const s of [-1, 1]) {
      const l = box(0.05, 0.007, 0.006, C.lace, 0, 0.395 + k * 0.028, 0.121 - k * 0.006);
      l.rotation.z = s * 0.55;
      chest.add(l);
    }
  }
  // Tunic skirt below the belt: ragged hem, a few folds.
  chest.add(loft([
    { y: 0.02, rx: 0.188, rz: 0.122 }, { y: -0.12, rx: 0.21, rz: 0.142, fold: 0.04 },
    { y: -0.3, rx: 0.232, rz: 0.162, fold: 0.06, jag: rag(0.03, [0, -1, 0.3, -1.4, 0, -0.6, 0.5, -1.1, -0.3, 0.6, -1.3, 0.1, -0.5, 0.4, -0.9, 0]) },
  ], 16, C.tunic, { folds: 6, capTop: false, capBottom: false, inner: C.lace, shade: [0.72, 1] }));
  // Belt, buckle, hanging tail.
  chest.add(band(0, 0.196, 0.13, 0.05, C.belt, 14));
  chest.add(box(0.05, 0.055, 0.02, C.buckle, 0.03, 0, 0.13));
  chest.add(box(0.028, 0.03, 0.022, C.belt, 0.03, 0, 0.132));
  const tail = box(0.034, 0.16, 0.012, C.belt, 0.075, -0.08, 0.13, [0.8, 1]);
  tail.rotation.z = 0.08;
  chest.add(tail);
  // Pouch with a flap, on the right hip.
  const pouch = new THREE.Group();
  pouch.position.set(-0.14, -0.06, 0.085);
  pouch.rotation.y = -0.55;
  pouch.add(box(0.085, 0.09, 0.05, C.pouch, 0, 0, 0, [0.8, 1.05]));
  const flap = box(0.09, 0.045, 0.012, C.belt, 0, 0.028, 0.028);
  flap.rotation.x = -0.15;
  pouch.add(flap);
  pouch.add(box(0.014, 0.014, 0.01, C.buckle, 0, 0.012, 0.036));
  chest.add(pouch);

  // Cowl: the hood's capelet over the shoulders, deep folds, ragged edge.
  chest.add(loft([
    { y: 0.53, rx: 0.1, rz: 0.1, z: -0.005 }, { y: 0.47, rx: 0.2, rz: 0.15 },
    { y: 0.4, rx: 0.25, rz: 0.18, fold: 0.05 },
    { y: 0.3, rx: 0.27, rz: 0.19, fold: 0.08, jag: rag(0.03, [0, -1, 0.2, -1.5, -0.3, 0.4, -1.1, 0, -0.7, 0.3, -1.3, 0.2, -0.6, 0.1, -1, 0.4, -0.4, 0]) },
  ], 18, C.cloak, { folds: 7, capBottom: false, inner: C.cloakIn, shade: [0.8, 1.12] }));
  // Long cloak hanging down the back.
  const cloak = pivot('cloak', 0, 0.44, -0.03, chest);
  cloak.add(loft([
    { y: 0, rx: 0.2, rz: 0.13, arc: 0.56 },
    { y: -0.3, rx: 0.26, rz: 0.18, z: -0.02, arc: 0.6, fold: 0.04 },
    { y: -0.7, rx: 0.29, rz: 0.21, z: -0.03, arc: 0.62, fold: 0.08 },
    { y: -1.12, rx: 0.3, rz: 0.23, z: -0.04, arc: 0.64, fold: 0.11, jag: rag(0.07, [0, 1, 0.3, 1.4, 0.4, 0.9, 0, 1.6, 0.5, 1, 0.1, 1.3, 0.6, 0.8, 0.2, 1.5, 0.3, 0.7, 0]) },
  ], 19, C.cloak, { folds: 8, capTop: false, capBottom: false, inner: C.cloakIn, shade: [0.72, 1.1], grain: 0.05 }));

  // ── Neck & hooded head ────────────────────────────────────────
  const neck = pivot('neck', 0, 0.49, 0, chest);
  neck.add(loft([{ y: 0, rx: 0.058, rz: 0.058 }, { y: 0.09, rx: 0.052, rz: 0.055, z: 0.005 }], 8, C.face, { shade: [0.8, 0.5] }));
  const head = pivot('head', 0, 0.08, 0.01, neck);
  // A face half-lost in shadow: only the jaw and chin catch the light.
  head.add(loft([
    { y: -0.005, rx: 0.045, rz: 0.04, z: 0.015 }, { y: 0.03, rx: 0.072, rz: 0.082, z: -0.002 }, { y: 0.09, rx: 0.082, rz: 0.094, z: -0.014 },
    { y: 0.16, rx: 0.086, rz: 0.096, z: -0.02 }, { y: 0.21, rx: 0.07, rz: 0.08, z: -0.02 },
  ], 10, C.face, { shade: [1.1, 0.25], grain: 0.03 }));
  for (const s of [-1, 1]) head.add(glowBox(0.026, 0.009, 0.01, s * 0.03, 0.125, 0.074));
  // Deep pointed hood, open at the front, its tip falling back.
  head.add(loft([
    { y: -0.08, rx: 0.16, rz: 0.16, z: -0.01, arc: 0.84 },
    { y: 0.02, rx: 0.145, rz: 0.15, z: 0.005, arc: 0.83, fold: 0.03 },
    { y: 0.13, rx: 0.142, rz: 0.15, z: 0.0, arc: 0.84, fold: 0.03 },
    { y: 0.22, rx: 0.128, rz: 0.142, z: -0.01, arc: 0.9 },
    { y: 0.28, rx: 0.1, rz: 0.122, z: -0.035, arc: 0.95 },
    { y: 0.315, rx: 0.06, rz: 0.085, z: -0.075, arc: 0.99 },
    { y: 0.33, rx: 0.01, rz: 0.02, z: -0.15, arc: 0.99 },
  ], 16, C.cloak, { folds: 4, capTop: false, capBottom: false, inner: C.hoodIn, shade: [0.85, 1.15] }));

  // ── Arms: torn sleeves, linen wraps, laced bracers, hands, blades ──
  const arms: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const sh = pivot(side < 0 ? 'upperArm.R' : 'upperArm.L', side * 0.2, 0.41, -0.005, chest);
    sh.add(loft([
      { y: 0.04, rx: 0.07, rz: 0.075 }, { y: -0.04, rx: 0.078, rz: 0.075 }, { y: -0.12, rx: 0.066, rz: 0.068, z: 0.008 },
      { y: -0.2, rx: 0.056, rz: 0.06, z: 0.01 }, { y: -0.29, rx: 0.047, rz: 0.05 },
    ], 10, C.linen, { shade: [0.8, 1] }));
    for (const y of [-0.2, -0.24]) sh.add(band(y, 0.058, 0.061, 0.008, C.lace, 10, 0.008));
    // Short tunic sleeve with a torn edge.
    sh.add(loft([
      { y: 0.05, rx: 0.08, rz: 0.084 }, { y: -0.06, rx: 0.086, rz: 0.084, fold: 0.05 },
      { y: -0.15, rx: 0.08, rz: 0.08, z: 0.008, fold: 0.07, jag: rag(0.025, [0, -1, 0.2, -1.3, -0.2, 0.3, -0.8, 0, -1.1, 0.3]) },
    ], 10, C.tunic, { folds: 3, capTop: false, capBottom: false, inner: C.lace }));
    const el = pivot(side < 0 ? 'foreArm.R' : 'foreArm.L', 0, -0.29, 0, sh);
    el.add(loft([{ y: 0.02, rx: 0.048, rz: 0.052 }, { y: -0.05, rx: 0.052, rz: 0.055 }], 10, C.linen));
    // Leather bracer, criss-cross laced along the outside.
    el.add(loft([
      { y: -0.04, rx: 0.058, rz: 0.06 }, { y: -0.1, rx: 0.058, rz: 0.058 }, { y: -0.2, rx: 0.046, rz: 0.044 }, { y: -0.245, rx: 0.042, rz: 0.038 },
    ], 10, C.bracer, { shade: [0.8, 1.1] }));
    el.add(band(-0.045, 0.061, 0.063, 0.012, C.belt));
    el.add(band(-0.238, 0.045, 0.041, 0.01, C.belt));
    for (let k = 0; k < 4; k++) {
      for (const s of [-1, 1]) {
        const l = box(0.006, 0.04, 0.006, C.lace, side * 0.056, -0.075 - k * 0.04, 0);
        l.rotation.x = s * 0.6;
        el.add(l);
      }
    }
    const hand = pivot(side < 0 ? 'hand.R' : 'hand.L', 0, -0.25, 0, el);
    hand.add(loft([
      { y: 0.01, rx: 0.028, rz: 0.034 }, { y: -0.04, rx: 0.024, rz: 0.048 }, { y: -0.085, rx: 0.026, rz: 0.044 }, { y: -0.12, rx: 0.02, rz: 0.03 },
    ], 8, C.skin, { shade: [0.85, 1] }));
    const thumb = loft([{ y: 0, rx: 0.013, rz: 0.013 }, { y: -0.055, rx: 0.01, rz: 0.01 }], 6, C.skin);
    thumb.position.set(-side * 0.012, -0.03, 0.036);
    thumb.rotation.x = -0.6;
    hand.add(thumb);
    // Vex's blade: dark grip, guard, glowing red edge with a point.
    const blade = new THREE.Group();
    blade.name = 'blade';
    blade.position.set(0, -0.07, 0.02);
    blade.rotation.x = 1.1;
    blade.add(box(0.024, 0.11, 0.024, C.grip, 0, 0.02, 0));
    blade.add(box(0.1, 0.022, 0.034, C.guard, 0, 0.08, 0));
    blade.add(glowBox(0.046, 0.26, 0.012, 0, 0.22, 0));
    const tipG = new THREE.ConeGeometry(0.033, 0.07, 4);
    geometries.push(tipG);
    const tip = new THREE.Mesh(tipG, glow);
    tip.position.set(0, 0.385, 0);
    tip.scale.set(1, 1, 0.3);
    tip.rotation.y = Math.PI / 4;
    blade.add(tip);
    hand.add(blade);
    arms.push(sh, el);
  }

  return {
    root,
    materials: [front, back, glow],
    geometries,
    joints: {
      hips, spine: chest, neck, head,
      thighR: legs[0], shinR: legs[1], thighL: legs[2], shinL: legs[3],
      armR: arms[0], foreR: arms[1], armL: arms[2], foreL: arms[3], cloak,
    },
  };
}

/** The sheet's A-pose, for previews and export. */
export function aPose(rig: WandererRig) {
  const J = rig.joints;
  J.armR.rotation.z = -0.6; J.armL.rotation.z = 0.6;
  J.foreR.rotation.set(0.1, 0, 0.08); J.foreL.rotation.set(0.1, 0, -0.08);
  J.thighR.rotation.z = -0.07; J.thighL.rotation.z = 0.07;
}
