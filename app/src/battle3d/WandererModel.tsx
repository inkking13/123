import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from './r3f';
import { HeroAnim } from './HeroModel';

// The hooded wanderer from the model sheet in the repo root
// (Gemini_Generated_Image_uaer8…): tunic with a ragged hem, belt and pouch,
// shoulder mantle, long ragged cloak, bracers, tall boots and a pointed hood
// with the face lost in shadow. Every part is a loft — a stack of elliptical
// rings — so the silhouette follows the drawing. Built at real scale (1.8 m,
// facing +Z) and shrunk to hero size; posed through named pivots with the
// same HeroAnim inputs as HeroModel. Vex wears it, with his two red blades.

type Ring = { y: number; rx: number; rz: number; x?: number; z?: number; arc?: number; jag?: (j: number) => number };

const LOOK = {
  skin: '#cf9d7a', tunic: '#4d3e32', pants: '#3a3632', boots: '#4a3222', bootCuff: '#553a28',
  bracer: '#6e6258', belt: '#2e2018', buckle: '#8a7a5a', pouch: '#5a3e28', cloak: '#3b3531', hood: '#3e3834',
  shadow: '#0a0908', grip: '#1c1618', blade: '#ff3a3a',
};

/** Standing height of the built figure (top of the hood), before scaling. */
const BUILT_HEIGHT = 1.86;
export const WANDERER_HEIGHT = 1.14;
const SCALE = WANDERER_HEIGHT / BUILT_HEIGHT;

function loft(rings: Ring[], n: number, mat: THREE.Material, { capTop = true, capBottom = true } = {}) {
  const pos: number[] = [];
  const idx: number[] = [];
  const open = (rings[0].arc ?? 1) < 1;
  for (const r of rings) {
    const arc = r.arc ?? 1;
    for (let j = 0; j < n; j++) {
      const a = arc < 1 ? Math.PI + (j / (n - 1) - 0.5) * Math.PI * 2 * arc : (j / n) * Math.PI * 2;
      pos.push((r.x ?? 0) + r.rx * Math.sin(a), r.y + (r.jag ? r.jag(j) : 0), (r.z ?? 0) + r.rz * Math.cos(a));
    }
  }
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
  const flip = dir < 0 ? idx : idx.map((_, k) => idx[k - (k % 3) + (2 - (k % 3))]);
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(flip);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function pivot(name: string, x: number, y: number, z: number, parent: THREE.Object3D) {
  const o = new THREE.Group();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

interface Built {
  root: THREE.Group;
  mats: THREE.MeshLambertMaterial[];
  glow: THREE.MeshBasicMaterial;
  j: Record<'hips' | 'spine' | 'head' | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'armL' | 'armR' | 'foreL' | 'foreR' | 'cloak', THREE.Object3D>;
  geoms: THREE.BufferGeometry[];
}

function build(): Built {
  const cache = new Map<string, THREE.MeshLambertMaterial>();
  const mat = (c: string, doubleSide = false) => {
    const key = c + doubleSide;
    if (!cache.has(key)) cache.set(key, new THREE.MeshLambertMaterial({ color: c, flatShading: true, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide }));
    return cache.get(key)!;
  };
  const glow = new THREE.MeshBasicMaterial({ color: LOOK.blade, toneMapped: false });
  const L = LOOK;
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);

  // Hips & legs
  const hips = pivot('hips', 0, 0.97, 0, root);
  hips.add(loft([{ y: -0.2, rx: 0.19, rz: 0.12 }, { y: -0.05, rx: 0.19, rz: 0.125 }, { y: 0.05, rx: 0.175, rz: 0.11 }], 10, mat(L.pants)));
  const legs: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const hip = pivot('thigh', side * 0.1, -0.1, 0, hips);
    hip.add(loft([
      { y: 0, rx: 0.095, rz: 0.1 }, { y: -0.12, rx: 0.088, rz: 0.095, z: 0.01 },
      { y: -0.28, rx: 0.07, rz: 0.075, z: 0.01 }, { y: -0.4, rx: 0.052, rz: 0.058, z: 0.015 },
    ], 8, mat(L.pants)));
    const knee = pivot('shin', 0, -0.42, 0.01, hip);
    knee.add(loft([
      { y: 0.02, rx: 0.052, rz: 0.058, z: 0.005 }, { y: -0.1, rx: 0.058, rz: 0.066, z: -0.012 },
      { y: -0.2, rx: 0.048, rz: 0.052, z: -0.008 }, { y: -0.34, rx: 0.034, rz: 0.038 }, { y: -0.4, rx: 0.036, rz: 0.04 },
    ], 8, mat(L.pants)));
    knee.add(loft([
      { y: -0.4, rx: 0.052, rz: 0.058 }, { y: -0.22, rx: 0.056, rz: 0.062, z: -0.005 },
      { y: -0.1, rx: 0.068, rz: 0.074, z: -0.008 }, { y: -0.04, rx: 0.07, rz: 0.076, z: -0.008 },
    ], 8, mat(L.boots), { capBottom: false }));
    knee.add(loft([{ y: -0.1, rx: 0.075, rz: 0.08, z: -0.008 }, { y: -0.02, rx: 0.078, rz: 0.083, z: -0.008 }], 8, mat(L.bootCuff)));
    const ankle = pivot('foot', 0, -0.41, 0, knee);
    ankle.add(loft([
      { y: 0.05, rx: 0.056, rz: 0.04, z: -0.045 }, { y: 0.04, rx: 0.06, rz: 0.1, z: 0.02 },
      { y: 0.0, rx: 0.062, rz: 0.15, z: 0.065 }, { y: -0.045, rx: 0.06, rz: 0.15, z: 0.065 },
    ], 8, mat(L.boots)));
    legs.push(hip, knee);
  }

  // Torso, tunic, belt, pouch, mantle, cloak
  const chest = pivot('spine', 0, 0.05, 0, hips);
  chest.add(loft([
    { y: -0.02, rx: 0.175, rz: 0.11 }, { y: 0.08, rx: 0.165, rz: 0.108, z: 0.005 }, { y: 0.2, rx: 0.19, rz: 0.12, z: 0.01 },
    { y: 0.3, rx: 0.215, rz: 0.13, z: 0.015 }, { y: 0.38, rx: 0.225, rz: 0.125, z: 0.01 }, { y: 0.44, rx: 0.2, rz: 0.1 },
    { y: 0.49, rx: 0.12, rz: 0.075, z: -0.01 }, { y: 0.51, rx: 0.06, rz: 0.055 },
  ], 10, mat(L.tunic)));
  const hem = (j: number) => [0, -0.03, 0.01, -0.045, 0, -0.02, 0.015, -0.035, -0.01, 0.02, -0.04, 0][j % 12];
  chest.add(loft([{ y: 0.02, rx: 0.18, rz: 0.115 }, { y: -0.15, rx: 0.21, rz: 0.14 }, { y: -0.32, rx: 0.235, rz: 0.16, jag: hem }],
    12, mat(L.tunic, true), { capTop: false, capBottom: false }));
  chest.add(loft([{ y: -0.03, rx: 0.19, rz: 0.125 }, { y: 0.03, rx: 0.185, rz: 0.12 }], 12, mat(L.belt), { capTop: false, capBottom: false }));
  chest.add(box(0.05, 0.05, 0.02, mat(L.buckle), 0, 0, 0.125));
  const pouch = box(0.08, 0.085, 0.05, mat(L.pouch), -0.13, -0.05, 0.09);
  pouch.rotation.y = -0.5;
  chest.add(pouch);
  chest.add(box(0.012, 0.1, 0.01, mat('#1c1612'), 0, 0.44, 0.1));
  chest.add(loft([
    { y: 0.5, rx: 0.08, rz: 0.08 }, { y: 0.45, rx: 0.21, rz: 0.16 },
    { y: 0.33, rx: 0.26, rz: 0.19, jag: (j) => (j % 2 ? -0.04 : 0) },
  ], 12, mat(L.cloak, true), { capBottom: false }));
  const cloak = pivot('cloak', 0, 0.44, -0.02, chest);
  const rag = (j: number) => [0, 0.06, 0.02, 0.09, 0.03, 0.07, 0, 0.1, 0.04, 0.06, 0.01, 0.08, 0.03, 0.05][j % 14];
  cloak.add(loft([
    { y: 0, rx: 0.2, rz: 0.13, arc: 0.55 }, { y: -0.34, rx: 0.27, rz: 0.19, z: -0.02, arc: 0.55 },
    { y: -0.79, rx: 0.3, rz: 0.22, z: -0.03, arc: 0.55 }, { y: -1.16, rx: 0.3, rz: 0.24, z: -0.04, arc: 0.55, jag: rag },
  ], 14, mat(L.cloak, true), { capTop: false, capBottom: false }));

  // Neck & hooded head
  const neck = pivot('neck', 0, 0.49, 0, chest);
  neck.add(loft([{ y: 0, rx: 0.058, rz: 0.058 }, { y: 0.09, rx: 0.052, rz: 0.055, z: 0.005 }], 8, mat(L.skin)));
  const head = pivot('head', 0, 0.08, 0.01, neck);
  head.add(loft([
    { y: -0.09, rx: 0.17, rz: 0.15, z: -0.02 }, { y: -0.02, rx: 0.13, rz: 0.13, z: -0.01 }, { y: 0.1, rx: 0.115, rz: 0.13, z: -0.01 },
    { y: 0.2, rx: 0.1, rz: 0.12, z: -0.025 }, { y: 0.26, rx: 0.06, rz: 0.08, z: -0.05 }, { y: 0.3, rx: 0.01, rz: 0.02, z: -0.09 },
  ], 10, mat(L.hood, true), { capBottom: false }));
  head.add(loft([
    { y: 0.0, rx: 0.05, rz: 0.02, z: 0.085 }, { y: 0.07, rx: 0.08, rz: 0.03, z: 0.09 },
    { y: 0.17, rx: 0.075, rz: 0.03, z: 0.085 }, { y: 0.225, rx: 0.025, rz: 0.02, z: 0.07 },
  ], 8, mat(L.shadow)));
  // Two faint red eyes in the dark of the hood.
  for (const side of [-1, 1]) head.add(box(0.03, 0.012, 0.01, glow, side * 0.032, 0.125, 0.118));

  // Arms, bracers, hands, blades
  const arms: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const sh = pivot('upperArm', side * 0.2, 0.41, -0.005, chest);
    sh.add(loft([
      { y: 0.04, rx: 0.07, rz: 0.075 }, { y: -0.04, rx: 0.08, rz: 0.075 }, { y: -0.12, rx: 0.065, rz: 0.068, z: 0.008 },
      { y: -0.2, rx: 0.056, rz: 0.06, z: 0.01 }, { y: -0.29, rx: 0.046, rz: 0.05 },
    ], 8, mat(L.tunic)));
    const el = pivot('foreArm', 0, -0.29, 0, sh);
    el.add(loft([
      { y: 0.0, rx: 0.052, rz: 0.056 }, { y: -0.08, rx: 0.058, rz: 0.06 }, { y: -0.2, rx: 0.046, rz: 0.044 }, { y: -0.25, rx: 0.036, rz: 0.03 },
    ], 8, mat(L.bracer)));
    el.add(loft([{ y: 0.03, rx: 0.06, rz: 0.064 }, { y: -0.03, rx: 0.064, rz: 0.068 }], 8, mat(L.tunic, true), { capTop: false, capBottom: false }));
    const hand = pivot('hand', 0, -0.25, 0, el);
    hand.add(loft([
      { y: 0.01, rx: 0.028, rz: 0.035 }, { y: -0.05, rx: 0.024, rz: 0.046 }, { y: -0.1, rx: 0.026, rz: 0.04 },
    ], 6, mat(L.skin)));
    const blade = new THREE.Group();
    blade.position.set(0, -0.07, 0.02);
    blade.rotation.x = 1.1;
    blade.add(box(0.026, 0.12, 0.026, mat(L.grip), 0, 0.02, 0));
    blade.add(box(0.1, 0.02, 0.03, mat(L.grip), 0, 0.08, 0));
    blade.add(box(0.05, 0.3, 0.014, glow, 0, 0.24, 0));
    hand.add(blade);
    arms.push(sh, el);
  }

  const mats = [...cache.values()];
  const geoms: THREE.BufferGeometry[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) geoms.push((o as THREE.Mesh).geometry); });
  return {
    root, mats, glow, geoms,
    // side -1 is the figure's right (−X when facing +Z)
    j: { hips, spine: chest, head, thighR: legs[0], shinR: legs[1], thighL: legs[2], shinL: legs[3], armR: arms[0], foreR: arms[1], armL: arms[2], foreL: arms[3], cloak },
  };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const bump = (t: number, dur: number, peak = 0.35) => (t < 0 || t > dur ? 0 : t < dur * peak ? t / (dur * peak) : 1 - (t - dur * peak) / (dur * (1 - peak)));

export function WandererModel({ anim }: { anim: React.MutableRefObject<HeroAnim> }) {
  const b = useMemo(build, []);
  useEffect(() => () => { b.geoms.forEach((g) => g.dispose()); b.mats.forEach((m) => m.dispose()); b.glow.dispose(); }, [b]);
  const fallRef = useRef<THREE.Group>(null);
  const walkPhase = useRef(0);
  const flashCol = useMemo(() => new THREE.Color('#ff4a3a'), []);
  const frozenCol = useMemo(() => new THREE.Color('#9fd6ff'), []);

  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const walk = Math.min(1, a.speed / 1.2);
    walkPhase.current += dt * (4 + walk * 8);
    const ph = walkPhase.current;
    const breathe = Math.sin(t * 2.2);
    const at = t - a.at;

    // Crouched assassin's stance: knees soft, blades held low and forward.
    let thighL = walk * Math.sin(ph) * 0.7 - 0.12, thighR = -walk * Math.sin(ph) * 0.7 - 0.12;
    let shinL = walk * Math.max(0, -Math.sin(ph)) * 0.9 + 0.22, shinR = walk * Math.max(0, Math.sin(ph)) * 0.9 + 0.22;
    let armLx = -0.35 - walk * Math.sin(ph) * 0.4 + 0.04 * breathe, armRx = -0.35 + walk * Math.sin(ph) * 0.4 - 0.04 * breathe;
    const armLz = 0.25, armRz = -0.25;
    let foreL = -0.9, foreR = -0.9;
    let spineX = 0.12 + 0.03 * breathe, spineY = 0;
    let lift = -0.02 + walk * Math.abs(Math.sin(ph)) * 0.04 + 0.006 * breathe;

    if (a.kind === 'melee' && at < 0.5) {
      // Alternating stabs, right then left.
      const kR = bump(at, 0.22, 0.4), kL = bump(at - 0.14, 0.22, 0.4);
      armRx = lerp(armRx, -1.55, kR); foreR = lerp(foreR, -0.05, kR);
      armLx = lerp(armLx, -1.55, kL); foreL = lerp(foreL, -0.05, kL);
      spineX += 0.15 * Math.max(kR, kL); spineY = 0.25 * (kR - kL);
    } else if ((a.kind === 'ability' || a.kind === 'heal' || a.kind === 'rally' || a.kind === 'ranged') && at < 0.7) {
      // Crossed blades raised, then slashed apart.
      const k = bump(at, 0.7, 0.4);
      armRx = lerp(armRx, -2.1, k); armLx = lerp(armLx, -2.1, k); foreR = lerp(foreR, -0.3, k); foreL = lerp(foreL, -0.3, k);
      lift += 0.05 * k;
    }
    if (a.defending) { armRx = -1.2; armLx = -1.2; foreR = -1.6; foreL = -1.6; spineX += 0.1; }
    const ht = t - a.hit;
    if (ht >= 0 && ht < 0.35) spineX -= 0.4 * (1 - ht / 0.35);

    const J = b.j;
    J.thighL.rotation.x = thighL; J.thighR.rotation.x = thighR;
    J.shinL.rotation.x = shinL; J.shinR.rotation.x = shinR;
    J.armL.rotation.set(armLx, 0, armLz); J.armR.rotation.set(armRx, 0, armRz);
    J.foreL.rotation.x = foreL; J.foreR.rotation.x = foreR;
    J.spine.rotation.set(spineX, spineY, 0);
    J.head.rotation.set(-0.1, Math.sin(t * 0.7) * 0.15, 0);
    J.hips.position.y = 0.97 + lift / SCALE * 0.6;
    J.cloak.rotation.x = 0.06 + walk * 0.35 + Math.sin(t * 2.5) * 0.03;

    const fall = a.alive ? 0 : a.deadAt >= 0 ? Math.min(1, (t - a.deadAt) / 0.55) : 1;
    const eased = 1 - (1 - fall) * (1 - fall);
    if (fallRef.current) { fallRef.current.rotation.x = -1.45 * eased; fallRef.current.position.y = -0.05 * eased; }

    const f = ht >= 0 && ht < 0.3 ? 1 - ht / 0.3 : 0;
    for (const m of b.mats) {
      m.emissive.copy(a.frozen ? frozenCol : flashCol);
      m.emissiveIntensity = a.frozen ? 0.45 : f * 0.9;
    }
  });

  return (
    <group ref={fallRef}>
      <primitive object={b.root} />
    </group>
  );
}
