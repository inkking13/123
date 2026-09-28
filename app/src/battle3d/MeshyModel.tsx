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

// Race base bodies from Meshy: rigged bipeds with their own animation clips.
// Each race's uploaded exports (one GLB per clip, same mesh) are merged into
// one file in assets/models with 1K JPEG textures. The human, elf, dwarf and
// skeleton are on a Mixamo skeleton; Meshy's combat set (the capitalised
// clips) was retargeted onto it. The orc is on Meshy's own rig, in centimetres.
// Unlike Vex, nothing here is procedural: the clips drive the skeleton and
// the hero's weapon rides the hand bones.

const url = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));

/** Which clip of the file plays for each thing a hero does. */
interface Body {
  url: string;
  /** Standing height in the game. */
  height: number;
  /** Height in the file, feet at 0, facing +Z; 1.7 unless given. */
  modelH?: number;
  /** Turn about Y for a file that faces another way. */
  turn?: number;
  /** Size of held weapons against a 1.7 m hero's, for a bulkier body. */
  propScale?: number;
  /** From the wrist to the middle of the closed fist, metres; the fingers are curled in the file. */
  fist?: number;
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
  /** Played when struck while idle, walking or guarding. */
  hit?: string;
  /** What a body with no hero look holds. */
  hold?: { right?: PropName; left?: PropName };
}

/** Meshy's combat set runs 2–4 s a clip; sped up so the blow lands inside a turn. */
const COMBAT_SPEED = { Attack: 2, Double_Combo_Attack: 2.1, Triple_Combo_Attack: 3, Charged_Slash: 1.6, Charged_Spell_Cast: 1.8, Hit_Reaction: 1.4, Dead: 1.3 };

export const BODIES = {
  // Female elf: idle, walk, run, five spell casts, dance, and the combat set.
  elf: {
    url: url(require('../../assets/models/elf.glb')), height: 1.2, fist: 0.08,
    idle: 'Idle', walk: 'walk', run: 'run', act: { default: 'cast' }, flourish: 'dance',
    speed: { ...COMBAT_SPEED, cast1: 1.8, cast2: 1.6, cast4: 1.3, cast6: 1.3 },
    guard: 'Block1', death: 'Dead', hit: 'Hit_Reaction',
  },
  // Male elf (Meshy rig, mesh cut to ~14k triangles): breathing idle, walk, run, a proud strut and eight spell casts.
  // Fingers curled into a fist in the file; block, flinch and fall taken from the female elf.
  elfMale: {
    url: url(require('../../assets/models/elf-male.glb')), height: 1.2, fist: 0.08,
    idle: 'Long_Breathe_and_Look_Around', walk: 'Walking', run: 'Running', act: { default: 'mage_soell_cast' }, flourish: 'Proud_Strut',
    speed: { ...COMBAT_SPEED, mage_soell_cast: 1.4, mage_soell_cast_1: 1.8, mage_soell_cast_2: 1.6, mage_soell_cast_3: 1.6, mage_soell_cast_4: 1.3, mage_soell_cast_6: 1.3, mage_soell_cast_7: 1.4, Proud_Strut: 1.2 },
    guard: 'Block1', death: 'Dead', hit: 'Hit_Reaction',
  },
  // The male elf in the owner's arcane robe (hood, robe, cloak, gloves, trousers, boots), skinned like the leather set.
  elfMaleArcane: {
    url: url(require('../../assets/models/faelar-arcane.glb')), height: 1.2, fist: 0.08,
    idle: 'Long_Breathe_and_Look_Around', walk: 'Walking', run: 'Running', act: { default: 'mage_soell_cast' }, flourish: 'Proud_Strut',
    speed: { ...COMBAT_SPEED, mage_soell_cast: 1.4, mage_soell_cast_1: 1.8, mage_soell_cast_2: 1.6, mage_soell_cast_3: 1.6, mage_soell_cast_4: 1.3, mage_soell_cast_6: 1.3, mage_soell_cast_7: 1.4, Proud_Strut: 1.2 },
    guard: 'Block1', death: 'Dead', hit: 'Hit_Reaction',
  },
  // Braided dwarf: breathing idle, shield bash, war cry, and the combat set.
  dwarf: {
    url: url(require('../../assets/models/dwarf.glb')), height: 1.0, fist: 0.125,
    idle: 'idle', walk: 'walk', run: 'run', act: { default: 'bash', rally: 'shout', ability: 'shout' },
    speed: { ...COMBAT_SPEED, bash: 1.5, shout: 2.2 }, guard: 'Block1', flourish: 'Victory_Cheer', death: 'Dead', hit: 'Hit_Reaction',
  },
  // Human male: relaxed idle, combat stance, sword attack, blade spins, eight spell casts, and the combat set.
  human: {
    url: url(require('../../assets/models/human.glb')), height: 1.12, fist: 0.11,
    idle: 'Idle', walk: 'walk', run: 'run',
    act: { default: 'attack', ability: 'spin', heal: 'cast1', ranged: 'cast6', rally: 'cast4' },
    speed: { ...COMBAT_SPEED, attack: 1.6, spin: 2.6, cast1: 1.8, cast2: 1.6, cast3: 1.6, cast4: 1.3, cast6: 1.3, spinjump: 1.2 },
    guard: 'Block1', flourish: 'spinjump', death: 'Dead', hit: 'Hit_Reaction',
  },
  // The human body dressed in the leather set (hood, jerkin, cloak, gloves, trousers, boots), each piece
  // skinned to the same skeleton from the nearest body vertex; only the head is left of the body itself.
  humanLeather: {
    url: url(require('../../assets/models/vex-leather.glb')), height: 1.12, fist: 0.11,
    idle: 'Idle', walk: 'walk', run: 'run',
    act: { default: 'attack', ability: 'spin', heal: 'cast1', ranged: 'cast6', rally: 'cast4' },
    speed: { ...COMBAT_SPEED, attack: 1.6, spin: 2.6, cast1: 1.8, cast2: 1.6, cast3: 1.6, cast4: 1.3, cast6: 1.3, spinjump: 1.2 },
    guard: 'Block1', flourish: 'spinjump', death: 'Dead', hit: 'Hit_Reaction',
  },
  // The human body in the owner's knight armour, closed helm and all (nothing of the body shows).
  humanKnight: {
    url: url(require('../../assets/models/roderick-knight.glb')), height: 1.12, fist: 0.11,
    idle: 'Idle', walk: 'walk', run: 'run',
    act: { default: 'attack', ability: 'spin', heal: 'cast1', ranged: 'cast6', rally: 'cast4' },
    speed: { ...COMBAT_SPEED, attack: 1.6, spin: 2.6, cast1: 1.8, cast2: 1.6, cast3: 1.6, cast4: 1.3, cast6: 1.3, spinjump: 1.2 },
    guard: 'Block1', flourish: 'spinjump', death: 'Dead', hit: 'Hit_Reaction',
  },
  // Skeleton warrior in a loincloth (1.62 tall in its file): idle, claw attack, spin attack, block, and the combat set.
  skeleton: {
    url: url(require('../../assets/models/skeleton.glb')), height: 1.2,
    idle: 'idle', walk: 'walk', run: 'run', act: { default: 'attack', ability: 'Double_Combo_Attack' },
    speed: { ...COMBAT_SPEED, attack: 2 }, guard: 'block', flourish: 'spin', death: 'Dead', hit: 'Hit_Reaction',
    hold: { right: 'boneSword', left: 'skullShield' },
  },
  // The same skeleton with a bow in the left hand, loosing with the spell-cast reach.
  skeletonArcher: {
    url: url(require('../../assets/models/skeleton.glb')), height: 1.2,
    idle: 'idle', walk: 'walk', run: 'run', act: { default: 'Charged_Spell_Cast' },
    speed: COMBAT_SPEED, guard: 'Block1', flourish: 'Victory_Cheer', death: 'Dead', hit: 'Hit_Reaction',
    hold: { right: 'bow' },
  },
  // And with a mage's staff, casting.
  skeletonMage: {
    url: url(require('../../assets/models/skeleton.glb')), height: 1.2,
    idle: 'idle', walk: 'walk', run: 'run', act: { default: 'Charged_Spell_Cast', ability: 'Charged_Slash' },
    speed: COMBAT_SPEED, guard: 'Block1', flourish: 'Victory_Cheer', death: 'Dead', hit: 'Hit_Reaction',
    hold: { right: 'staff' },
  },
  // Громмаш, on Meshy's rig: relaxed idle, fighting stance, hammer swing, axe chop, chest-pound war cry, and the combat set.
  orc: {
    url: url(require('../../assets/models/orc.glb')), height: 1.3, modelH: 2.0, propScale: 1.4,
    idle: 'Idle', walk: 'Walk_Fight_Forward', run: 'RunFast',
    act: { default: 'Heavy_Hammer_Swing', ability: 'Triple_Combo_Attack', rally: 'Chest_Pound_Taunt', heal: 'Chest_Pound_Taunt' },
    speed: { ...COMBAT_SPEED, Heavy_Hammer_Swing: 1.4, Chest_Pound_Taunt: 1.6 },
    guard: 'Block1', flourish: 'Chest_Pound_Taunt', death: 'Dead', hit: 'Hit_Reaction',
  },
  // Некромант, boss of Разрушенная крепость, on a Mixamo skeleton: upright stance, walk, run,
  // nine spell casts, a finger-wag taunt and a fall. Clip_A/B/C came out of Meshy under task ids.
  necromancer: {
    url: url(require('../../assets/models/necromancer.glb')), height: 1.12,
    idle: 'Clip_B_3s', walk: 'Walking', run: 'Running',
    act: { default: 'mage_soell_cast_2', ranged: 'mage_soell_cast_6', ability: 'mage_soell_cast_5', heal: 'mage_soell_cast_1', rally: 'Finger_Wag_No' },
    speed: { mage_soell_cast_1: 1.8, mage_soell_cast_2: 1.6, mage_soell_cast_5: 4, mage_soell_cast_6: 1.3, Finger_Wag_No: 2, Dead: 1.3 },
    flourish: 'Finger_Wag_No', death: 'Dead',
  },
} satisfies Record<string, Body>;

// Meshy-made weapons and shields, scaled to a 1.7 m hero (a long sword to the
// hip, a staff to the shoulder, a bow near head height). All but the rune axe were baked in metres
// with the grip at the origin, the head or blade up +Y and its width along X;
// shields face -X. The grip comes from the hand's pose at rest (arms down,
// thumbs forward), so it is the same on every rig however its hand bone is
// turned: the haft runs out past the thumb, the edge faces where the fingers
// point, and a shield is strapped to the back of the hand.
const prop = (mod: number, scale = 1, grip = 0, shine?: number) => ({ url: url(mod), scale, grip, shine });
const PROPS = {
  // Boar-headed double axe with runes, 1.9 units long along Y, grip on the leather wrap.
  runeAxe: prop(require('../../assets/models/rune-axe.glb'), 0.5, -0.55),
  warhammer: prop(require('../../assets/models/weapon-warhammer.glb'), 0.85),
  greatAxe: prop(require('../../assets/models/weapon-greataxe.glb'), 1.15),
  longsword: prop(require('../../assets/models/weapon-longsword.glb')),
  boneSword: prop(require('../../assets/models/weapon-bone-sword.glb')),
  dagger: prop(require('../../assets/models/weapon-dagger.glb'), 0.85),
  staff: prop(require('../../assets/models/weapon-staff.glb'), 1.25),
  bow: prop(require('../../assets/models/weapon-bow.glb'), 1.55),
  roundShield: prop(require('../../assets/models/shield-round.glb'), 1.2),
  skullShield: prop(require('../../assets/models/shield-skull.glb'), 1.35),
  mace: prop(require('../../assets/models/weapon-mace.glb')),
  handAxe: prop(require('../../assets/models/weapon-hand-axe.glb')),
  // Glowing in the hero's colour; `shine` is the height of the glowing part.
  orb: prop(require('../../assets/models/weapon-orb.glb'), 0.6, 0, 0.12),
  flask: prop(require('../../assets/models/weapon-flask.glb'), 0.6, 0, 0.02),
};
export type PropName = keyof typeof PROPS;

/** The Meshy model for a hero's weapon kind or off-hand, where there is one. */
const WEAPON_PROP: Partial<Record<string, PropName>> = { sword: 'longsword', greatHammer: 'warhammer', greatAxe: 'greatAxe', dagger: 'dagger', staff: 'staff', bow: 'bow', mace: 'mace', axe: 'handAxe', orb: 'orb', flask: 'flask' };
const OFFHAND_PROP: Partial<Record<string, PropName>> = { roundShield: 'roundShield', kiteShield: 'roundShield', towerShield: 'roundShield', dagger: 'dagger', flask: 'flask' };

/** From the wrist to the middle of the fist, in metres: along the fingers, then into the palm (or out of the back of the hand for a shield). */
const TO_FIST = 0.075, TO_PALM = 0.025, TO_BACK = 0.05;

const UPRIGHT = new Set<PropName>(['staff', 'bow', 'orb', 'flask']);

/**
 * A prop's turn and place in a hand bone whose rest turn is `rest` and idle turn is `pose`
 * (both in model space); `left` for the left hand. The rigs have no finger bones and each
 * animation twists the hand its own way, so the aim is set in the first frame of idle.
 */
function gripIn(rest: THREE.Quaternion, pose: THREE.Quaternion, left: boolean, how: 'fist' | 'upright' | 'shield', toFist = TO_FIST) {
  const toBone = rest.clone().invert();
  // The hand at rest, in model space: fingers, thumb (towards the front), palm.
  const F = new THREE.Vector3(0, 1, 0).applyQuaternion(rest);
  const T = new THREE.Vector3(0, 0, 1).addScaledVector(F, -F.z).normalize();
  const P = left ? F.clone().cross(T) : T.clone().cross(F);
  // Rest model space to idle model space.
  const toIdle = pose.clone().multiply(toBone);
  const out = left ? 1 : -1;
  // Where the prop's Y goes; X lies across the palm and Z follows.
  let x: THREE.Vector3, y: THREE.Vector3;
  if (how === 'shield') { x = P; y = F.clone().negate(); }
  else {
    if (how === 'upright') {
      // A staff, bow, orb or flask stands straight up in idle.
      y = new THREE.Vector3(0.1 * out, 1, 0.1).normalize().applyQuaternion(toIdle.clone().invert());
    } else {
      // A blade or head rises up, forward and a little out in idle, but not back along the forearm.
      const want = new THREE.Vector3(0.3 * out, 1, 0.9).normalize();
      const arm = F.clone().negate().applyQuaternion(toIdle);
      const along = want.dot(arm);
      if (along > 0.5) want.addScaledVector(arm, 0.5 - along).normalize();
      y = want.applyQuaternion(toIdle.clone().invert());
    }
    x = y.clone().cross(P);
    if (x.lengthSq() < 1e-4) x = y.clone().cross(F);
    x.normalize();
  }
  const basis = new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y));
  const quaternion = toBone.clone().multiply(new THREE.Quaternion().setFromRotationMatrix(basis));
  const position = new THREE.Vector3(0, how === 'shield' ? TO_FIST : toFist, 0).add(P.clone().multiplyScalar(how === 'shield' ? -TO_BACK : TO_PALM).applyQuaternion(toBone));
  return { quaternion, position };
}

/** Loads a prop and puts it in the given hand bone; nothing is drawn by the component itself. */
function HeldProp({ name, hand, unit, size, fist, rest, pose, left, glow, steady }: { name: PropName; hand: THREE.Bone; unit: number; size: number; fist?: number; rest: THREE.Quaternion; pose: THREE.Quaternion; left: boolean; glow?: string; steady: Steady[] }) {
  const P = PROPS[name];
  const gltf = useLoader(GLTFLoader, P.url as any) as unknown as { scene: THREE.Group };
  useEffect(() => {
    const prop = gltf.scene.clone();
    prop.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const std = m.material as THREE.MeshStandardMaterial;
        const lam = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap });
        if (P.shine !== undefined && glow) { lam.emissive.set(glow); lam.emissiveMap = std.map; lam.emissiveIntensity = 0.8; }
        m.material = lam;
      }
    });
    if (P.shine !== undefined && glow) {
      const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 2), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
      halo.position.y = P.shine;
      prop.add(halo);
    }
    prop.scale.setScalar(P.scale * size);
    prop.position.y = -P.grip * P.scale * size;
    const g = gripIn(rest, pose, left, name === 'roundShield' || name === 'skullShield' ? 'shield' : UPRIGHT.has(name) ? 'upright' : 'fist', fist);
    const holder = new THREE.Group();
    holder.quaternion.copy(g.quaternion);
    holder.position.copy(g.position).multiplyScalar(unit);
    holder.scale.setScalar(unit);
    holder.add(prop);
    hand.add(holder);
    // Held things keep their idle stand while the hand sways in idle; see steadyProps.
    const s: Steady = { holder, hand, grip: g.quaternion, idle: pose.clone().multiply(g.quaternion) };
    steady.push(s);
    return () => { steady.splice(steady.indexOf(s) >>> 0, 1); holder.removeFromParent(); prop.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); }); };
  }, [gltf, hand, P, unit, size, fist, rest, pose, left, name, glow, steady]);
  return null;
}

/** A held prop's holder, its grip in the hand, and its turn in model space in idle. */
interface Steady { holder: THREE.Object3D; hand: THREE.Bone; grip: THREE.Quaternion; idle: THREE.Quaternion }
const _hq = new THREE.Quaternion(), _cq = new THREE.Quaternion();
/** Holds props at their idle stand in proportion to how much idle is playing, so they follow the hand only in actions. */
function steadyProps(steady: Steady[], root: THREE.Object3D, idle: number) {
  for (const s of steady) {
    _hq.identity();
    for (let b: THREE.Object3D | null = s.hand; b && b !== root; b = b.parent) _hq.premultiply(b.quaternion);
    _cq.copy(_hq).multiply(s.grip).slerp(s.idle, idle);
    s.holder.quaternion.copy(_hq.invert()).multiply(_cq);
  }
}
export type BodyName = keyof typeof BODIES;

const MODEL_H = 1.7;
/** How long an action holds its clip before blending back, seconds. */
const ACTION_S = 1.4;

/** A built stand-in for weapon kinds with no Meshy model. */
function weaponMesh(kind: string | undefined, metal: string): THREE.Object3D | null {
  const g = new THREE.Group();
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
  const SCALE = B.height / (B.modelH ?? MODEL_H);
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
        // Mixamo names (colon stripped by the loader) or Meshy's own.
        if (o.name.endsWith('Hips')) hips = o as THREE.Bone;
        if (o.name.endsWith('Spine2') || o.name === 'Spine') spine = o as THREE.Bone;
        if (o.name.endsWith('LeftHand')) handL = o as THREE.Bone;
        if (o.name.endsWith('RightHand')) handR = o as THREE.Bone;
        if (o.name.endsWith('Head')) headBone = o as THREE.Bone;
        if (o.name.endsWith('HeadTop_End') || o.name === 'head_end') headTop = o as THREE.Bone;
      }
    });
    // Where the head and body sit at rest, for fitting a helmet.
    scene.updateMatrixWorld(true);
    for (const m of meshes) m.rest.copy(m.mesh.matrixWorld);
    let head: HeadFit | null = null;
    if (headBone && headTop) {
      const hb = headBone as THREE.Bone;
      // Straight above the head joint: Meshy's head end sits back on the skull.
      const top = new THREE.Vector3().setFromMatrixPosition((headTop as THREE.Bone).matrixWorld);
      top.x = hb.matrixWorld.elements[12]; top.z = hb.matrixWorld.elements[14];
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
    // The hands' turn at rest, from the skin's bind pose.
    const restOf = (b: THREE.Bone | null) => {
      const q = new THREE.Quaternion();
      for (const { mesh } of meshes) {
        const i = mesh.skeleton.bones.indexOf(b as THREE.Bone);
        if (i >= 0) { mesh.skeleton.boneInverses[i].clone().invert().decompose(new THREE.Vector3(), q, new THREE.Vector3()); break; }
      }
      return q;
    };
    const restR = restOf(handR), restL = restOf(handL);
    // And in the first frame of idle, which aims what they hold.
    mixer.update(0);
    scene.updateMatrixWorld(true);
    const poseOf = (b: THREE.Bone | null) => (b ? b.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion());
    const poseR = poseOf(handR as THREE.Bone | null), poseL = poseOf(handL as THREE.Bone | null);
    // Bone space per metre: 100 on a centimetre rig, so held things are scaled back.
    const unit = handR ? 1 / new THREE.Vector3().setFromMatrixScale((handR as THREE.Bone).matrixWorld).x : 1;
    return { scene, unit, restR, restL, poseR, poseL, steady: [] as Steady[], materials, mixer, actions, head, meshes, hips: h, hipsXZ: h ? [h.position.x, h.position.z] : [0, 0], spine: spine as THREE.Bone | null, handL: handL as THREE.Bone | null, handR: handR as THREE.Bone | null };
  }, [gltf]);

  // Meshy-made things in hand: the hero's own pick, else the model for their weapon and off-hand.
  const main = opts.weapon ?? (look ? WEAPON_PROP[look.weapon] : B.hold?.right);
  const off = look ? OFFHAND_PROP[look.offHand] : B.hold?.left;
  // Bows go in the left hand, whether the hero's look or the body's own kit holds one.
  const bow = look ? look.weapon === 'bow' : main === 'bow';
  const mainHand = bow ? rig.handL : rig.handR;

  // The rest built from primitives: bows in the left, everything else in the right.
  useEffect(() => {
    if (!look) return;
    const held: [THREE.Object3D, THREE.Bone | null][] = [];
    const w = main ? null : weaponMesh(look.weapon, look.metal);
    if (w) held.push([w, rig.handR]);
    if (!off && (look.offHand === 'roundShield' || look.offHand === 'kiteShield' || look.offHand === 'towerShield')) held.push([shieldMesh(look.shieldColor ?? look.secondary, look.metal), rig.handL]);
    // Meshes are in metres; the hand bone points down the fingers (+Y).
    for (const [o, hand] of held) { o.scale.multiplyScalar(rig.unit); o.position.multiplyScalar(rig.unit); hand?.add(o); }
    return () => held.forEach(([o]) => {
      o.removeFromParent();
      o.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    });
  }, [rig, look, main, off]);
  const glow = gear?.weapon?.glow ?? look?.glow ?? '#ffffff';

  useEffect(() => () => { rig.mixer.stopAllAction(); rig.materials.forEach((m) => m.dispose()); }, [rig]);

  // Under a helmet the hair is pressed onto the skull so it doesn't poke through.
  const helmed = gear?.helm?.model;
  useEffect(() => {
    if (!helmed || !rig.head) return;
    const head = rig.head;
    const swapped = rig.meshes.map(({ mesh: m, rest }) => {
      const own = m.geometry;
      m.geometry = tuckHair(own, rest, head, helmed);
      return [m, own] as const;
    });
    return () => swapped.forEach(([m, own]) => { m.geometry = own; });
  }, [rig, helmed]);

  const fallRef = useRef<THREE.Group>(null);
  const weights = useRef<Record<string, number>>({ idle: 1 });
  const playing = useRef('');
  const lastAt = useRef(-99);
  const lastHit = useRef(-99);
  const flashCol = useMemo(() => new THREE.Color('#ff4a3a'), []);
  const frozenCol = useMemo(() => new THREE.Color('#9fd6ff'), []);

  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const A = rig.actions;
    // A fresh action restarts its clip from the top.
    if (a.at !== lastAt.current && a.kind) {
      lastAt.current = a.at;
      playing.current = a.kind === 'dance' ? B.flourish ?? B.act.default : opts.act?.[a.kind] ?? B.act[a.kind] ?? opts.act?.default ?? B.act.default;
      A[playing.current]?.reset().play();
    }
    const at = t - a.at;
    const cur = A[playing.current];
    let want = 'idle';
    if (a.kind === 'dance' && cur && at < cur.getClip().duration / cur.timeScale) want = playing.current;
    else if (a.kind && a.kind !== 'dance' && at < ACTION_S) want = playing.current;
    else if (B.hit && A[B.hit] && a.hit >= 0 && at >= ACTION_S && t - a.hit < A[B.hit].getClip().duration / A[B.hit].timeScale) {
      if (lastHit.current !== a.hit) { lastHit.current = a.hit; A[B.hit].reset().play(); }
      want = B.hit;
    } else if (a.defending && B.guard) want = B.guard;
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
    steadyProps(rig.steady, rig.scene, weights.current.idle ?? 0);

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
      <group scale={[SCALE, SCALE, SCALE]} rotation={[0, B.turn ?? 0, 0]}>
        <primitive object={rig.scene} />
      </group>
      {main && mainHand ? <React.Suspense fallback={null}><HeldProp name={main} hand={mainHand} unit={rig.unit} size={B.propScale ?? 1} fist={B.fist} steady={rig.steady} rest={bow ? rig.restL : rig.restR} pose={bow ? rig.poseL : rig.poseR} left={bow} glow={glow} /></React.Suspense> : null}
      {off && rig.handL ? <React.Suspense fallback={null}><HeldProp name={off} hand={rig.handL} unit={rig.unit} size={B.propScale ?? 1} fist={B.fist} steady={rig.steady} rest={rig.restL} pose={rig.poseL} left glow={glow} /></React.Suspense> : null}
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
