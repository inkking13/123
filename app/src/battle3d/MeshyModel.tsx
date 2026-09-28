import React, { Component, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useFrame, useLoader } from './r3f';
import { HeroAnim, HeroModel } from './HeroModel';
import { GearLook, withGear } from './gearLooks';
import { HERO_LOOKS, HeroLook } from './heroLooks';
import { HeadFit, WornHelm, tuckHair } from './HelmModel';

// Race base bodies from Meshy: rigged (Mixamo skeleton) bipeds with their
// own animation clips. Each race's uploaded exports (one GLB per clip, same
// mesh) are merged into one file in assets/models with 1K JPEG textures.
// Unlike Vex, nothing here is procedural: the clips drive the skeleton and
// the hero's weapon rides the hand bones.

const url = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));

/** Which clip of the file plays for each thing a hero does. */
interface Body {
  url: string;
  /** Standing height in the game; every Meshy export is 1.7 units tall, feet at 0, facing +Z. */
  height: number;
  idle: string | { clip: string; frame: number };
  walk: string;
  run: string;
  /** Per action kind (melee, ranged, ability, heal, rally), falling back to `default`. */
  act: Partial<Record<string, string>> & { default: string };
  /** Clip speed-up per clip, so long Meshy clips fit a turn. */
  speed?: Record<string, number>;
  /** Looped while defending. */
  guard?: string;
  /** Second tap on the equipment preview. */
  flourish?: string;
  /** Played once when the hero falls, instead of tipping the model over. */
  death?: string;
}

export const BODIES = {
  // Female elf: walk, run, five spell casts, dance. No idle clip: the walk's first frame, held.
  elf: {
    url: url(require('../../assets/models/elf.glb')), height: 1.2,
    idle: { clip: 'walk', frame: 0 }, walk: 'walk', run: 'run', act: { default: 'cast' }, flourish: 'dance',
    speed: { cast1: 1.8, cast2: 1.6, cast4: 1.3, cast6: 1.3 },
  },
  // Braided dwarf: breathing idle, shield bash, war cry, shield-up alert.
  dwarf: {
    url: url(require('../../assets/models/dwarf.glb')), height: 1.0,
    idle: 'idle', walk: 'walk', run: 'run', act: { default: 'bash', rally: 'shout', ability: 'shout' },
    speed: { bash: 1.5, shout: 2.2 }, guard: 'alert', flourish: 'shout',
  },
  // Human male: combat stance, sword attack, blade spins, eight spell casts, knocked flying.
  human: {
    url: url(require('../../assets/models/human.glb')), height: 1.12,
    idle: 'stance', walk: 'walk', run: 'run',
    act: { default: 'attack', ability: 'spin', heal: 'cast1', ranged: 'cast6', rally: 'cast4' },
    speed: { attack: 1.6, spin: 2.6, cast1: 1.8, cast2: 1.6, cast3: 1.6, cast4: 1.3, cast6: 1.3, spinjump: 1.2, hit: 1.2 },
    flourish: 'spinjump', death: 'hit',
  },
  // Skeleton warrior in a loincloth (1.62 tall in its file): idle, claw attack, spin attack, block, knocked flying.
  skeleton: {
    url: url(require('../../assets/models/skeleton.glb')), height: 1.2,
    idle: 'idle', walk: 'walk', run: 'run', act: { default: 'attack', ability: 'spin' },
    speed: { attack: 2, spin: 2, hit: 1.2 }, guard: 'block', flourish: 'spin', death: 'hit',
  },
} satisfies Record<string, Body>;

/** Meshy-made weapons that replace a hero's built one. */
const PROPS = {
  // Boar-headed double axe with runes, 1.9 units long along Y, grip on the leather wrap.
  runeAxe: { url: url(require('../../assets/models/rune-axe.glb')), scale: 0.5, grip: -0.55, rot: [-2.2, 0, 0] as const },
};
export type PropName = keyof typeof PROPS;

/** Loads a prop and puts it in the given hand bone; nothing is drawn by the component itself. */
function HeldProp({ name, hand }: { name: PropName; hand: THREE.Bone }) {
  const P = PROPS[name];
  const gltf = useLoader(GLTFLoader, P.url as any) as unknown as { scene: THREE.Group };
  useEffect(() => {
    const prop = gltf.scene.clone();
    prop.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { const std = m.material as THREE.MeshStandardMaterial; m.material = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap }); }
    });
    prop.scale.setScalar(P.scale);
    prop.position.y = -P.grip * P.scale;
    const pivot = new THREE.Group();
    pivot.rotation.set(P.rot[0], P.rot[1], P.rot[2]);
    pivot.position.set(0, 0.08, 0.02);
    pivot.add(prop);
    hand.add(pivot);
    return () => { pivot.removeFromParent(); prop.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); }); };
  }, [gltf, hand, P]);
  return null;
}
export type BodyName = keyof typeof BODIES;

const MODEL_H = 1.7;
/** How long an action holds its clip before blending back, seconds. */
const ACTION_S = 1.4;

function weaponMesh(kind: string | undefined, glow: string, metal: string): THREE.Object3D | null {
  const g = new THREE.Group();
  if (kind === 'mace') {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.5, 8), new THREE.MeshLambertMaterial({ color: '#4a3424' }));
    haft.position.y = 0.16;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), new THREE.MeshLambertMaterial({ color: metal }));
    head.position.y = 0.42;
    g.add(haft, head);
    return g;
  }
  if (kind === 'bow') {
    // Held in the left hand, limbs along the forearm's line.
    const wood = new THREE.MeshLambertMaterial({ color: '#5a3e26' });
    // An arc whose middle is the grip, at the bone's origin; the string closes it.
    const R = 0.34, half = Math.PI * 0.425;
    const limb = new THREE.Mesh(new THREE.TorusGeometry(R, 0.014, 6, 20, half * 2), wood);
    limb.rotation.z = Math.PI - half;
    limb.position.x = R;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 2 * R * Math.sin(half), 4), new THREE.MeshBasicMaterial({ color: '#d8d2c0' }));
    string.position.x = R * (1 - Math.cos(half));
    g.add(limb, string);
    return g;
  }
  if (kind === 'axe') {
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.62, 8), new THREE.MeshLambertMaterial({ color: '#5a3e26' }));
    haft.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.025), new THREE.MeshLambertMaterial({ color: metal }));
    head.position.set(0.1, 0.44, 0);
    g.add(haft, head);
    return g;
  }
  if (kind === 'orb' || kind === 'staff' || kind === 'flask') {
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 2), new THREE.MeshBasicMaterial({ color: glow, toneMapped: false }));
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 2), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
    g.add(orb, halo);
    g.position.set(0, 0.1, 0.06);
    return g;
  }
  if (kind) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.012), new THREE.MeshLambertMaterial({ color: metal }));
    blade.position.y = 0.36;
    g.add(blade);
    return g;
  }
  return null;
}

function shieldMesh(color: string, metal: string): THREE.Object3D {
  const g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), new THREE.MeshLambertMaterial({ color }));
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshLambertMaterial({ color: metal }));
  boss.position.y = 0.02;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 6, 24), new THREE.MeshLambertMaterial({ color: metal }));
  rim.rotation.x = Math.PI / 2;
  g.add(face, boss, rim);
  // Strapped to the back of the hand, facing out from the palm.
  g.rotation.z = Math.PI / 2;
  g.position.set(-0.06, 0.06, 0);
  return g;
}

function Meshy({ id, body: B, anim, gear, opts }: { id: number; body: Body; anim: React.MutableRefObject<HeroAnim>; gear?: GearLook; opts: HeroOpts }) {
  const gltf = useLoader(GLTFLoader, B.url as any) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const SCALE = B.height / MODEL_H;
  const look = useMemo(() => (HERO_LOOKS[id] ? withGear(HERO_LOOKS[id], gear) : null), [id, gear]);
  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    const materials: THREE.MeshLambertMaterial[] = [];
    const meshes: { mesh: THREE.SkinnedMesh; rest: THREE.Matrix4 }[] = [];
    let hips: THREE.Bone | null = null; let spine: THREE.Bone | null = null; let handL: THREE.Bone | null = null; let handR: THREE.Bone | null = null;
    let headBone: THREE.Bone | null = null; let headTop: THREE.Bone | null = null;
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        // Lambert like the rest of the cast, so it sits in the same light.
        const std = m.material as THREE.MeshStandardMaterial;
        const lam = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap });
        m.material = lam; materials.push(lam);
        m.frustumCulled = false;
        meshes.push({ mesh: m, rest: new THREE.Matrix4() });
      }
      if ((o as THREE.Bone).isBone) {
        if (o.name.endsWith('Hips')) hips = o as THREE.Bone;
        if (o.name.endsWith('Spine2')) spine = o as THREE.Bone;
        if (o.name.endsWith('LeftHand')) handL = o as THREE.Bone;
        if (o.name.endsWith('RightHand')) handR = o as THREE.Bone;
        if (o.name.endsWith('Head')) headBone = o as THREE.Bone;
        if (o.name.endsWith('HeadTop_End')) headTop = o as THREE.Bone;
      }
    });
    // Where the head and body sit at rest, for fitting a helmet.
    scene.updateMatrixWorld(true);
    for (const m of meshes) m.rest.copy(m.mesh.matrixWorld);
    let head: HeadFit | null = null;
    if (headBone && headTop) {
      const hb = headBone as THREE.Bone;
      const top = new THREE.Vector3().setFromMatrixPosition((headTop as THREE.Bone).matrixWorld);
      head = { bone: hb, rest: hb.matrixWorld.clone(), top, height: top.y - hb.matrixWorld.elements[13] + 0.02 };
    }
    const mixer = new THREE.AnimationMixer(scene);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const c of gltf.animations) actions[c.name] = mixer.clipAction(c);
    if (typeof B.idle === 'string') actions.idle = actions[B.idle];
    else {
      // A held frame of another clip; cloned so it runs as its own action.
      const still = gltf.animations.find((c) => c.name === (B.idle as { clip: string }).clip)!.clone();
      still.name = 'idle';
      actions.idle = mixer.clipAction(still);
      actions.idle.timeScale = 0;
      actions.idle.time = (B.idle as { frame: number }).frame;
    }
    for (const [name, a] of Object.entries(actions)) { a.timeScale = name === 'idle' && typeof B.idle !== 'string' ? 0 : B.speed?.[name] ?? 1; a.play(); a.setEffectiveWeight(0); }
    actions.idle.setEffectiveWeight(1);
    const h = hips as THREE.Bone | null;
    return { scene, materials, mixer, actions, head, meshes, hips: h, hipsXZ: h ? [h.position.x, h.position.z] : [0, 0], spine: spine as THREE.Bone | null, handL: handL as THREE.Bone | null, handR: handR as THREE.Bone | null };
  }, [gltf]);

  // The hero's weapon in hand: bows in the left, everything else in the right.
  useEffect(() => {
    if (!look) return;
    const held: [THREE.Object3D, THREE.Bone | null][] = [];
    const w = opts.weapon ? null : weaponMesh(look.weapon, gear?.weapon?.glow ?? look.glow ?? '#ffffff', look.metal);
    if (w) held.push([w, look.weapon === 'bow' ? rig.handL : rig.handR]);
    if (look.offHand === 'roundShield' || look.offHand === 'kiteShield' || look.offHand === 'towerShield') held.push([shieldMesh(look.shieldColor ?? look.secondary, look.metal), rig.handL]);
    // Bones are in model units (metres); the hand bone points down the fingers (+Y).
    for (const [o, hand] of held) hand?.add(o);
    return () => held.forEach(([o]) => {
      o.removeFromParent();
      o.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    });
  }, [rig, look, gear?.weapon?.glow, opts.weapon]);

  useEffect(() => () => { rig.mixer.stopAllAction(); rig.materials.forEach((m) => m.dispose()); }, [rig]);

  // Under a helmet the hair is pressed onto the skull so it doesn't poke through.
  const helmed = !!gear?.helm?.model;
  useEffect(() => {
    if (!helmed || !rig.head) return;
    const head = rig.head;
    const swapped = rig.meshes.map(({ mesh: m, rest }) => {
      const own = m.geometry;
      m.geometry = tuckHair(own, rest, head);
      return [m, own] as const;
    });
    return () => swapped.forEach(([m, own]) => { m.geometry = own; });
  }, [rig, helmed]);

  const fallRef = useRef<THREE.Group>(null);
  const weights = useRef<Record<string, number>>({ idle: 1 });
  const playing = useRef('');
  const lastAt = useRef(-99);
  const flashCol = useMemo(() => new THREE.Color('#ff4a3a'), []);
  const frozenCol = useMemo(() => new THREE.Color('#9fd6ff'), []);

  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const A = rig.actions;
    // A fresh action restarts its clip from the top.
    if (a.at !== lastAt.current && a.kind) {
      lastAt.current = a.at;
      playing.current = a.kind === 'dance' ? B.flourish ?? B.act.default : opts.act?.[a.kind] ?? B.act[a.kind] ?? B.act.default;
      A[playing.current]?.reset().play();
    }
    const at = t - a.at;
    const cur = A[playing.current];
    let want = 'idle';
    if (a.kind === 'dance' && cur && at < cur.getClip().duration / cur.timeScale) want = playing.current;
    else if (a.kind && a.kind !== 'dance' && at < ACTION_S) want = playing.current;
    else if (a.defending && B.guard) want = B.guard;
    else if (a.speed > 1.6) want = B.run;
    else if (a.speed > 0.05) want = B.walk;
    if (a.frozen) want = 'idle';
    if (!a.alive) {
      if (B.death && A[B.death]) {
        // Once, held on its last frame.
        const d = A[B.death];
        if (d.loop !== THREE.LoopOnce) { d.setLoop(THREE.LoopOnce, 1); d.clampWhenFinished = true; d.reset().play(); if (a.deadAt < 0 || t - a.deadAt > 3) d.time = d.getClip().duration; }
        want = B.death;
      } else want = 'idle';
    } else if (B.death && A[B.death]?.loop === THREE.LoopOnce) {
      A[B.death].setLoop(THREE.LoopRepeat, Infinity); A[B.death].clampWhenFinished = false;
    }
    A[B.walk].timeScale = Math.max(0.6, Math.min(1.6, a.speed / 0.9));
    const k = 1 - Math.exp(-dt * 10);
    weights.current[want] ??= 0;
    for (const c of Object.keys(weights.current)) {
      weights.current[c] += ((c === want ? 1 : 0) - weights.current[c]) * k;
      A[c]?.setEffectiveWeight(weights.current[c]);
    }
    rig.mixer.update(a.frozen ? 0 : dt);
    // Clips play in place: lunges and knock-backs would carry the body off its tile.
    if (rig.hips) { rig.hips.position.x = rig.hipsXZ[0]; rig.hips.position.z = rig.hipsXZ[1]; }

    // Breathing, a guard hunch and a flinch on top of the clips.
    if (rig.spine) {
      const ht = t - a.hit;
      let x = weights.current.idle * 0.02 * Math.sin(t * 2.2);
      if (a.defending && !B.guard) x += 0.25;
      if (ht >= 0 && ht < 0.35) x -= 0.35 * (1 - ht / 0.35);
      rig.spine.rotation.x += x;
    }

    const fall = a.alive || B.death ? 0 : a.deadAt >= 0 ? Math.min(1, (t - a.deadAt) / 0.55) : 1;
    const eased = 1 - (1 - fall) * (1 - fall);
    if (fallRef.current) { fallRef.current.rotation.x = -1.45 * eased; fallRef.current.position.y = -0.05 * eased; }

    const ht = t - a.hit;
    const f = ht >= 0 && ht < 0.3 ? 1 - ht / 0.3 : 0;
    for (const m of rig.materials) {
      m.emissive.copy(a.frozen ? frozenCol : flashCol);
      m.emissiveIntensity = a.frozen ? 0.45 : f * 0.9;
    }
  });

  return (
    <group ref={fallRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={rig.scene} />
      </group>
      {opts.weapon && rig.handR ? <React.Suspense fallback={null}><HeldProp name={opts.weapon} hand={rig.handR} /></React.Suspense> : null}
      <WornHelm name={gear?.helm?.model} head={rig.head} />
    </group>
  );
}

/** Falls back to the primitive-built hero if the model can't load or draw. */
class Fallback extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('Meshy model failed, using the built hero', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

interface HeroOpts {
  /** A Meshy-made weapon in the right hand instead of the built one. */
  weapon?: PropName;
  /** Per-hero choice of clip for an action kind. */
  act?: Partial<Record<string, string>>;
}

/** A monster on a Meshy body, falling back to its built look. */
export function MeshyFoe({ body, look, anim }: { body: BodyName; look: HeroLook; anim: React.MutableRefObject<HeroAnim> }) {
  const fallback = <HeroModel look={look} anim={anim} />;
  return (
    <Fallback fallback={fallback}>
      <React.Suspense fallback={fallback}>
        <Meshy id={-1} body={BODIES[body]} opts={{}} anim={anim} />
      </React.Suspense>
    </Fallback>
  );
}

/** A sheet model for one hero on a race body, by candidate id. */
export function meshyModel(id: number, body: BodyName, opts: HeroOpts = {}) {
  return function MeshyHero(props: { anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
    const fallback = HERO_LOOKS[id] ? <HeroModel look={HERO_LOOKS[id]} {...props} /> : null;
    return (
      <Fallback fallback={fallback}>
        <React.Suspense fallback={fallback}>
          <Meshy id={id} body={BODIES[body]} opts={opts} {...props} />
        </React.Suspense>
      </Fallback>
    );
  };
}
