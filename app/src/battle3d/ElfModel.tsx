import React, { Component, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useFrame, useLoader } from './r3f';
import { HeroAnim, HeroModel } from './HeroModel';
import { GearLook, withGear } from './gearLooks';
import { HERO_LOOKS } from './heroLooks';

// The elf base body from Meshy: a rigged (Mixamo skeleton) biped with its own
// walk, run, spell-cast and dance clips, merged from the four uploaded
// Meshy exports into assets/models/elf.glb (textures shrunk to 1K JPEG).
// Unlike Vex, nothing here is procedural: the clips drive the skeleton and
// the hero's weapon rides the hand bones.

const ELF_GLB = require('../../assets/models/elf.glb');
const ELF_URL: string = Platform.OS === 'web' ? Asset.fromModule(ELF_GLB).uri : ELF_GLB;

/** Model units: 1.7 tall, feet at y = 0, facing +Z. */
const MODEL_H = 1.7;
export const ELF_HEIGHT = 1.2;
const SCALE = ELF_HEIGHT / MODEL_H;
/** How long an action plays the cast clip, seconds. */
const ACTION_S = 1.1;

type Clip = 'idle' | 'walk' | 'run' | 'cast' | 'dance';

function weaponMesh(kind: string | undefined, glow: string, metal: string): THREE.Object3D | null {
  const g = new THREE.Group();
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

function Elf({ id, anim, gear }: { id: number; anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
  const gltf = useLoader(GLTFLoader, ELF_URL as any) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const look = useMemo(() => (HERO_LOOKS[id] ? withGear(HERO_LOOKS[id], gear) : null), [id, gear]);
  const rig = useMemo(() => {
    const scene = cloneSkinned(gltf.scene) as THREE.Group;
    const materials: THREE.MeshLambertMaterial[] = [];
    let spine: THREE.Bone | null = null; let handL: THREE.Bone | null = null; let handR: THREE.Bone | null = null;
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        // Lambert like the rest of the cast, so it sits in the same light.
        const std = m.material as THREE.MeshStandardMaterial;
        const lam = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap });
        m.material = lam; materials.push(lam);
        m.frustumCulled = false;
      }
      if ((o as THREE.Bone).isBone) {
        if (o.name.endsWith('Spine2')) spine = o as THREE.Bone;
        if (o.name.endsWith('LeftHand')) handL = o as THREE.Bone;
        if (o.name.endsWith('RightHand')) handR = o as THREE.Bone;
      }
    });
    const mixer = new THREE.AnimationMixer(scene);
    const byName = (n: string) => gltf.animations.find((c) => c.name === n);
    const actions = {} as Record<Clip, THREE.AnimationAction>;
    const walk = byName('walk')!;
    // Standing pose: the walk's first frame, held.
    const idleClip = walk.clone(); idleClip.name = 'idle';
    actions.idle = mixer.clipAction(idleClip);
    actions.walk = mixer.clipAction(walk);
    actions.run = mixer.clipAction(byName('run')!);
    actions.cast = mixer.clipAction(byName('cast')!);
    actions.dance = mixer.clipAction(byName('dance')!);
    actions.idle.timeScale = 0;
    for (const a of Object.values(actions)) { a.play(); a.setEffectiveWeight(0); }
    actions.idle.setEffectiveWeight(1);
    return { scene, materials, mixer, actions, spine: spine as THREE.Bone | null, handL: handL as THREE.Bone | null, handR: handR as THREE.Bone | null };
  }, [gltf]);

  // The hero's weapon in hand: bows in the left, everything else in the right.
  useEffect(() => {
    if (!look) return;
    const w = weaponMesh(look.weapon, gear?.weapon?.glow ?? look.glow ?? '#ffffff', look.metal);
    const hand = look.weapon === 'bow' ? rig.handL : rig.handR;
    if (!w || !hand) return;
    // Bones are in model units (metres); the hand bone points down the fingers (+Y).
    hand.add(w);
    return () => {
      w.removeFromParent();
      w.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    };
  }, [rig, look, gear?.weapon?.glow]);

  useEffect(() => () => { rig.mixer.stopAllAction(); rig.materials.forEach((m) => m.dispose()); }, [rig]);

  const fallRef = useRef<THREE.Group>(null);
  const weights = useRef<Record<Clip, number>>({ idle: 1, walk: 0, run: 0, cast: 0, dance: 0 });
  const lastAt = useRef(-99);
  const flashCol = useMemo(() => new THREE.Color('#ff4a3a'), []);
  const frozenCol = useMemo(() => new THREE.Color('#9fd6ff'), []);

  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const A = rig.actions;
    // A fresh action restarts its clip from the top.
    if (a.at !== lastAt.current && a.kind) {
      lastAt.current = a.at;
      const clip = a.kind === 'dance' ? A.dance : A.cast;
      clip.reset().play();
    }
    const at = t - a.at;
    let want: Clip = 'idle';
    if (a.kind === 'dance' && at < A.dance.getClip().duration) want = 'dance';
    else if (a.kind && at < ACTION_S) want = 'cast';
    else if (a.speed > 1.6) want = 'run';
    else if (a.speed > 0.05) want = 'walk';
    if (!a.alive || a.frozen) want = 'idle';
    A.walk.timeScale = Math.max(0.6, Math.min(1.6, a.speed / 0.9));
    const k = 1 - Math.exp(-dt * 10);
    for (const c of Object.keys(weights.current) as Clip[]) {
      weights.current[c] += ((c === want ? 1 : 0) - weights.current[c]) * k;
      A[c].setEffectiveWeight(weights.current[c]);
    }
    rig.mixer.update(a.frozen ? 0 : dt);

    // Breathing, a guard hunch and a flinch on top of the clips.
    if (rig.spine) {
      const ht = t - a.hit;
      let x = weights.current.idle * 0.02 * Math.sin(t * 2.2);
      if (a.defending) x += 0.25;
      if (ht >= 0 && ht < 0.35) x -= 0.35 * (1 - ht / 0.35);
      rig.spine.rotation.x += x;
    }

    const fall = a.alive ? 0 : a.deadAt >= 0 ? Math.min(1, (t - a.deadAt) / 0.55) : 1;
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
    </group>
  );
}

/** Falls back to the primitive-built hero if the model can't load or draw. */
class Fallback extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('Elf model failed, using the built hero', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** A sheet model for one elf hero, by candidate id. */
export function elfModel(id: number) {
  return function ElfHero(props: { anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
    const fallback = HERO_LOOKS[id] ? <HeroModel look={HERO_LOOKS[id]} {...props} /> : null;
    return (
      <Fallback fallback={fallback}>
        <React.Suspense fallback={fallback}>
          <Elf id={id} {...props} />
        </React.Suspense>
      </Fallback>
    );
  };
}
