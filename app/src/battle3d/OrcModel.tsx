import React, { Component, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useFrame, useLoader } from './r3f';
import { HeroAnim, HeroModel } from './HeroModel';
import { GearLook, withGear } from './gearLooks';
import { HERO_LOOKS } from './heroLooks';
import { HeadFit, WornHelm } from './HelmModel';

// Громмаш as the Meshy orc warrior (repo: models/raw/Meshy_AI_Orc_Warrior_
// Blueprint…glb on the models-upload branch, repacked with 1K JPEG textures
// into assets/models/orc.glb). Like Vex, the scan has no skeleton, so one is
// fitted here from where each vertex sits on the body, and the arms swing a
// built great axe.

const ORC_GLB = require('../../assets/models/orc.glb');
const ORC_URL: string = Platform.OS === 'web' ? Asset.fromModule(ORC_GLB).uri : ORC_GLB;

/** Model units: 1.9 tall, feet at y = -0.95, facing +Z, arms hanging, fists closed. */
const FEET = -0.95;
const MODEL_H = 1.9;
export const ORC_HEIGHT = 1.3;
const SCALE = ORC_HEIGHT / MODEL_H;

type V2 = [number, number];
// Joints on the figure's left side (+x); mirrored for the right.
const SHOULDER: V2 = [0.28, 0.55];
const ELBOW: V2 = [0.42, 0.26];
const WRIST: V2 = [0.43, 0.0];
const HIP: V2 = [0.18, -0.12];
const KNEE: V2 = [0.2, -0.44];
const NECK_Y = 0.64;
const SPINE_Y = 0.12;
/** How far the rest-pose upper arm hangs out from straight down, radians. */
const ARM_REST = Math.atan2(ELBOW[0] - SHOULDER[0], SHOULDER[1] - ELBOW[1]);

const B = { hips: 0, spine: 1, head: 2, armL: 3, foreL: 4, handL: 5, armR: 6, foreR: 7, handR: 8, thighL: 9, shinL: 10, thighR: 11, shinR: 12 } as const;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const bump = (t: number, dur: number, peak = 0.35) => (t < 0 || t > dur ? 0 : t < dur * peak ? t / (dur * peak) : 1 - (t - dur * peak) / (dur * (1 - peak)));

/** Skin weights for one vertex, as bone → weight. */
function weigh(x: number, y: number): Map<number, number> {
  const w = new Map<number, number>();
  const add = (bone: number, v: number) => { if (v > 1e-3) w.set(bone, (w.get(bone) ?? 0) + v); };
  const left = x >= 0;
  const ax = Math.abs(x);
  let rest = 1;

  // Arms: outside the torso's edge (0.325 below the chest, narrowing into the deltoid).
  const edge = lerp(0.325, 0.22, smooth(0.4, 0.56, y));
  const arm = smooth(edge - 0.02, edge + 0.02, ax) * smooth(-0.22, -0.18, y) * (1 - smooth(0.6, 0.66, y));
  if (arm > 0) {
    const fore = smooth(ELBOW[1] + 0.04, ELBOW[1] - 0.04, y);
    const hand = smooth(WRIST[1] + 0.04, WRIST[1] - 0.03, y);
    add(left ? B.armL : B.armR, arm * (1 - fore));
    add(left ? B.foreL : B.foreR, arm * fore * (1 - hand));
    add(left ? B.handL : B.handR, arm * fore * hand);
    rest -= arm;
  }
  if (rest <= 0) return w;

  const head = smooth(NECK_Y - 0.03, NECK_Y + 0.06, y) * (1 - smooth(0.15, 0.2, ax));
  add(B.head, rest * head);
  let body = rest * (1 - head);

  // Legs below the belt, split at the crotch.
  const leg = smooth(-0.06, -0.2, y);
  if (leg > 0) {
    const knee = smooth(KNEE[1] + 0.06, KNEE[1] - 0.06, y);
    add(left ? B.thighL : B.thighR, body * leg * (1 - knee));
    add(left ? B.shinL : B.shinR, body * leg * knee);
    body *= 1 - leg;
  }
  const up = smooth(SPINE_Y - 0.12, SPINE_Y + 0.08, y);
  add(B.spine, body * up);
  add(B.hips, body * (1 - up));
  return w;
}

function skinGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = src.clone();
  const p = g.attributes.position;
  const idx = new Uint16Array(p.count * 4);
  const wts = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const top = [...weigh(p.getX(i), p.getY(i)).entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, e) => s + e[1], 0) || 1;
    top.forEach(([bone, v], k) => { idx[i * 4 + k] = bone; wts[i * 4 + k] = v / sum; });
    if (!top.length) { idx[i * 4] = B.spine; wts[i * 4] = 1; }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
  return g;
}

function makeSkeleton() {
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

/**
 * Double-bitted great axe in model units, haft along +Z from the grip at the
 * origin (in the fist, the haft points forward when the arm hangs and up
 * when the forearm is raised).
 */
function makeGreatAxe(metal: string, wood: string) {
  const g = new THREE.Group();
  const woodM = new THREE.MeshLambertMaterial({ color: wood });
  const metalM = new THREE.MeshLambertMaterial({ color: metal, side: THREE.DoubleSide });
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1.05, 8), woodM);
  haft.rotation.x = Math.PI / 2;
  haft.position.z = 0.3;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), metalM);
  pommel.position.z = -0.22;
  // A crescent bit, extruded thin; mirrored for the second one.
  const bit = new THREE.Shape();
  bit.moveTo(0.03, -0.09);
  bit.quadraticCurveTo(0.14, -0.1, 0.24, -0.2);
  bit.quadraticCurveTo(0.3, 0, 0.24, 0.2);
  bit.quadraticCurveTo(0.14, 0.1, 0.03, 0.09);
  bit.lineTo(0.03, -0.09);
  const bitGeo = new THREE.ExtrudeGeometry(bit, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
  bitGeo.translate(0, 0, -0.011);
  const head = new THREE.Group();
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(bitGeo, metalM);
    // Shape's x is out from the haft, its y along it.
    m.rotation.set(-Math.PI / 2, 0, 0);
    m.scale.x = s;
    head.add(m);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8), metalM);
  collar.rotation.x = Math.PI / 2;
  head.add(collar);
  head.position.z = 0.72;
  g.add(haft, pommel, head);
  return g;
}

function Orc({ anim, gear }: { anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
  const gltf = useLoader(GLTFLoader, ORC_URL as any) as unknown as { scene: THREE.Group };
  const look = useMemo(() => withGear(HERO_LOOKS[5], gear), [gear]);
  const rig = useMemo(() => {
    let src: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => { if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh; });
    const mesh0 = src as unknown as THREE.Mesh;
    // Lambert like the rest of the cast, so it sits in the same light.
    const std = mesh0.material as THREE.MeshStandardMaterial;
    // Double-sided so a stretched armpit shows skin, not the inside.
    const material = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap, side: THREE.DoubleSide });
    const s = makeSkeleton();
    const skinned = new THREE.SkinnedMesh(skinGeometry(mesh0.geometry), material);
    skinned.add(s.hips);
    skinned.updateMatrixWorld(true);
    skinned.bind(new THREE.Skeleton(s.bones));
    skinned.frustumCulled = false;
    // Crown of the bald head and crown-to-chin, in model units.
    const head: HeadFit = { bone: s.head, rest: s.head.matrixWorld.clone(), top: new THREE.Vector3(0, 0.97, 0.07), height: 0.42 };
    return { skinned, material, s, head };
  }, [gltf]);
  useEffect(() => () => { rig.material.dispose(); rig.skinned.geometry.dispose(); }, [rig]);

  // The great axe in the right fist.
  useEffect(() => {
    const axe = makeGreatAxe(look.metal, look.primary);
    axe.position.set(0, -0.07, 0.02);
    rig.s.handR.add(axe);
    return () => {
      axe.removeFromParent();
      axe.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    };
  }, [rig, look.metal, look.primary]);

  const fallRef = useRef<THREE.Group>(null);
  const walkPhase = useRef(0);
  const flashCol = useMemo(() => new THREE.Color('#ff4a3a'), []);
  const frozenCol = useMemo(() => new THREE.Color('#9fd6ff'), []);

  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const walk = Math.min(1, a.speed / 1.2);
    if (!a.frozen) walkPhase.current += dt * (3 + walk * 7);
    const ph = walkPhase.current;
    const breathe = Math.sin(t * 1.8);
    const at = t - a.at;

    // Heavy stance: knees soft, axe raised across the body in the right fist.
    let thighL = walk * Math.sin(ph) * 0.5 - 0.08, thighR = -walk * Math.sin(ph) * 0.5 - 0.08;
    let shinL = walk * Math.max(0, -Math.sin(ph)) * 0.7 + 0.12, shinR = walk * Math.max(0, Math.sin(ph)) * 0.7 + 0.12;
    let armLx = -0.1 - walk * Math.sin(ph) * 0.3 + 0.03 * breathe, armRx = -0.3 + 0.03 * breathe;
    let foreL = -0.4, foreR = -0.95;
    let armLz = 0, armRz = 0;
    let spineX = 0.06 + 0.025 * breathe, spineY = 0;
    let lift = walk * Math.abs(Math.sin(ph)) * 0.02 + 0.004 * breathe;

    if (a.kind === 'melee' && at < 0.7) {
      // Overhead chop: wind up behind the head, then bring it down in front.
      const up = bump(at, 0.3, 0.9), down = bump(at - 0.24, 0.4, 0.3);
      armRx = lerp(lerp(armRx, -2.7, up), -0.9, down); foreR = lerp(lerp(foreR, -0.6, up), -0.2, down);
      armLx = lerp(armLx, -1.0, Math.max(up, down)); foreL = lerp(foreL, -1.1, Math.max(up, down));
      spineX += -0.15 * up + 0.3 * down; spineY = -0.2 * up;
    } else if ((a.kind === 'ability' || a.kind === 'rally' || a.kind === 'dance') && at < (a.kind === 'dance' ? 1.6 : 0.9)) {
      // War cry: both fists up and out, chest thrown back.
      const k = bump(at, a.kind === 'dance' ? 1.6 : 0.9, 0.3);
      armRx = lerp(armRx, -2.5, k); armLx = lerp(armLx, -2.5, k); foreR = lerp(foreR, -0.3, k); foreL = lerp(foreL, -0.3, k);
      armLz = -0.4 * k; armRz = 0.4 * k;
      spineX -= 0.25 * k; lift += 0.02 * k;
    } else if ((a.kind === 'ranged' || a.kind === 'heal') && at < 0.6) {
      // Sweeping cut across the front.
      const k = bump(at, 0.6, 0.4);
      armRx = lerp(armRx, -1.4, k); foreR = lerp(foreR, -0.4, k); spineY = lerp(0.35, -0.35, Math.min(1, at / 0.5)) * k;
    }
    if (a.defending) { armRx = -0.9; foreR = -1.3; armLx = -0.9; foreL = -1.5; spineX += 0.1; }
    const ht = t - a.hit;
    if (ht >= 0 && ht < 0.35) spineX -= 0.3 * (1 - ht / 0.35);

    const S = rig.s;
    S.thighL.rotation.x = thighL; S.thighR.rotation.x = thighR;
    S.shinL.rotation.x = shinL; S.shinR.rotation.x = shinR;
    // Arms hang out in a slight A; bring them in a touch, then swing.
    S.armL.rotation.set(armLx, 0, -(ARM_REST - 0.3) + armLz);
    S.armR.rotation.set(armRx, 0, ARM_REST - 0.3 + armRz);
    S.foreL.rotation.set(foreL, 0, 0); S.foreR.rotation.set(foreR, 0, 0);
    S.spine.rotation.set(spineX, spineY, 0);
    S.head.rotation.set(-spineX * 0.5, Math.sin(t * 0.6) * 0.12, 0);
    S.hips.position.y = HIP[1] + lift / SCALE;

    const fall = a.alive ? 0 : a.deadAt >= 0 ? Math.min(1, (t - a.deadAt) / 0.55) : 1;
    const eased = 1 - (1 - fall) * (1 - fall);
    if (fallRef.current) { fallRef.current.rotation.x = -1.45 * eased; fallRef.current.position.y = -0.05 * eased; }

    const f = ht >= 0 && ht < 0.3 ? 1 - ht / 0.3 : 0;
    rig.material.emissive.copy(a.frozen ? frozenCol : flashCol);
    rig.material.emissiveIntensity = a.frozen ? 0.45 : f * 0.9;
  });

  return (
    <group ref={fallRef}>
      <group scale={[SCALE, SCALE, SCALE]} position={[0, -FEET * SCALE, 0]}>
        <primitive object={rig.skinned} />
        <WornHelm name={gear?.helm?.model} head={rig.head} />
      </group>
    </group>
  );
}

/** Falls back to the built orc if the model can't load or draw. */
class Fallback extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('Orc model failed, using the built orc', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function OrcModel(props: { anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
  const fallback = <HeroModel look={HERO_LOOKS[5]} {...props} />;
  return (
    <Fallback fallback={fallback}>
      <React.Suspense fallback={fallback}>
        <Orc {...props} />
      </React.Suspense>
    </Fallback>
  );
}
