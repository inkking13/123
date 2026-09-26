import * as THREE from 'three';

// Fits a skeleton to the Meshy rogue (assets/models/vex.glb), which comes
// without one: vertices are weighted to hips, spine, head, arms and legs by
// where they sit on the A-pose body, the cloak and hood riding the spine.
// Model units: 1.9 tall, feet at y = -0.951, facing +Z.

export type V2 = [number, number];
// Joint positions on the model (x for the figure's left side; mirrored for the right).
export const SHOULDER: V2 = [0.2, 0.56];
export const ELBOW: V2 = [0.39, 0.33];
export const WRIST: V2 = [0.55, 0.12];
export const TIP: V2 = [0.62, -0.07];
export const HIP: V2 = [0.1, -0.1];
export const KNEE: V2 = [0.12, -0.5];
export const NECK_Y = 0.66;
export const SPINE_Y = 0.15;
/** How far the rest-pose arm hangs out from straight down, radians. */
export const ARM_REST = Math.atan2(ELBOW[0] - SHOULDER[0], SHOULDER[1] - ELBOW[1]);

// Bone order in the skeleton.
export const B = { hips: 0, spine: 1, head: 2, armL: 3, foreL: 4, handL: 5, armR: 6, foreR: 7, handR: 8, thighL: 9, shinL: 10, thighR: 11, shinR: 12 } as const;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Distance from p to segment ab and the position along it (0..1). */
function seg(px: number, py: number, a: V2, b: V2): [number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy);
  const c = Math.min(1, Math.max(0, t));
  return [Math.hypot(px - (a[0] + dx * c), py - (a[1] + dy * c)), t];
}

/** Skin weights for one vertex, as bone → weight. */
export function weigh(x: number, y: number, z: number): Map<number, number> {
  const w = new Map<number, number>();
  const add = (bone: number, v: number) => { if (v > 1e-3) w.set(bone, (w.get(bone) ?? 0) + v); };
  const left = x >= 0;
  const ax = Math.abs(x);
  let rest = 1;

  // Arms: close to the shoulder→elbow→wrist→fingertip line and out past the shoulder.
  const [d1, t1] = seg(ax, y, SHOULDER, ELBOW);
  const [d2, t2] = seg(ax, y, ELBOW, WRIST);
  const [d3, t3] = seg(ax, y, WRIST, TIP);
  const reach = Math.min(d1, d2, d3);
  const arm = (1 - smooth(0.09, 0.13, reach)) * smooth(0.0, 0.25, t1) * (z > -0.14 && z < 0.27 ? 1 : 0);
  if (arm > 0) {
    // Along the chain: 0..1 upper arm, 1..2 forearm, 2..3 hand.
    const along = d1 <= d2 && d1 <= d3 ? t1 : d2 <= d3 ? 1 + t2 : 2 + t3;
    const fore = smooth(0.85, 1.1, along);
    const hand = smooth(1.9, 2.05, along);
    add(left ? B.armL : B.armR, arm * (1 - fore));
    add(left ? B.foreL : B.foreR, arm * fore * (1 - hand));
    add(left ? B.handL : B.handR, arm * fore * hand);
    rest -= arm;
  }
  if (rest <= 0) return w;

  // Head and hood.
  const head = smooth(NECK_Y - 0.04, NECK_Y + 0.05, y) * (ax < 0.2 ? 1 : 0);
  add(B.head, rest * head);
  let body = rest * (1 - head);

  // Legs: below the belt, inside the leg columns and in front of the cloak.
  const cloak = z < -0.12 || ax > 0.3;
  const leg = cloak ? 0 : smooth(-0.02, -0.22, y);
  if (leg > 0) {
    const knee = smooth(KNEE[1] + 0.06, KNEE[1] - 0.06, y);
    add(left ? B.thighL : B.thighR, body * leg * (1 - knee));
    add(left ? B.shinL : B.shinR, body * leg * knee);
    body *= 1 - leg;
  }
  // Torso: hips blending into the spine above the belt; the cloak rides the spine.
  const up = cloak ? 1 : smooth(SPINE_Y - 0.12, SPINE_Y + 0.05, y);
  add(B.spine, body * up);
  add(B.hips, body * (1 - up));
  return w;
}

const skinCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

export function skinGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const hit = skinCache.get(src);
  if (hit) return hit;
  const g = src.clone();
  const p = g.attributes.position;
  const idx = new Uint16Array(p.count * 4);
  const wts = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const m = weigh(p.getX(i), p.getY(i), p.getZ(i));
    const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, e) => s + e[1], 0) || 1;
    top.forEach(([bone, v], k) => { idx[i * 4 + k] = bone; wts[i * 4 + k] = v / sum; });
    if (!top.length) { idx[i * 4] = B.spine; wts[i * 4] = 1; }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
  skinCache.set(src, g);
  return g;
}

export function makeSkeleton() {
  const bone = (x: number, y: number, parent?: THREE.Bone) => {
    const b = new THREE.Bone();
    const px = parent ? parent.userData.world as THREE.Vector3 : new THREE.Vector3();
    b.position.set(x - px.x, y - px.y, 0);
    b.userData.world = new THREE.Vector3(x, y, 0);
    parent?.add(b);
    return b;
  };
  const hips = bone(0, HIP[1]);
  const spine = bone(0, SPINE_Y, hips);
  const head = bone(0, NECK_Y, spine);
  const arm = (s: number) => {
    const a = bone(s * SHOULDER[0], SHOULDER[1], spine);
    const f = bone(s * ELBOW[0], ELBOW[1], a);
    const h = bone(s * WRIST[0], WRIST[1], f);
    return [a, f, h];
  };
  const [armL, foreL, handL] = arm(1);
  const [armR, foreR, handR] = arm(-1);
  const leg = (s: number) => {
    const t = bone(s * HIP[0], HIP[1], hips);
    const k = bone(s * KNEE[0], KNEE[1], t);
    return [t, k];
  };
  const [thighL, shinL] = leg(1);
  const [thighR, shinR] = leg(-1);
  const bones = [hips, spine, head, armL, foreL, handL, armR, foreR, handR, thighL, shinL, thighR, shinR];
  return { bones, hips, spine, head, armL, foreL, handL, armR, foreR, handR, thighL, shinL, thighR, shinR };
}

