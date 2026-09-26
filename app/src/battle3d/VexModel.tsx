import React, { Component, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useFrame, useLoader } from './r3f';
import { HeroAnim } from './HeroModel';
import { GearLook } from './gearLooks';
import { WandererModel } from './WandererModel';
import { ARM_REST, HIP, aimBlades, armFists, makeSkeleton, skinGeometry } from './vexRig';

// Vex as the textured hooded rogue generated in Meshy from his model sheet
// (repo root: "Hooded Rogue Character Sheet_Meshy_AI…glb", repacked with
// 1K JPEG textures into assets/models/vex.glb). The scan has no skeleton, so
// one is fitted here: vertices are weighted to hips, spine, head, arms and
// legs by where they sit on the A-pose body, the cloak and hood riding the
// spine. It then plays the same HeroAnim inputs as the other heroes.

const VEX_GLB = require('../../assets/models/vex.glb');
const VEX_URL: string = Platform.OS === 'web' ? Asset.fromModule(VEX_GLB).uri : VEX_GLB;

/** Model units: 1.9 tall, feet at y = -0.951, facing +Z, A-pose. */
const FEET = -0.951;
const MODEL_H = 1.9;
export const VEX_HEIGHT = 1.16;
const SCALE = VEX_HEIGHT / MODEL_H;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const bump = (t: number, dur: number, peak = 0.35) => (t < 0 || t > dur ? 0 : t < dur * peak ? t / (dur * peak) : 1 - (t - dur * peak) / (dur * (1 - peak)));

function Rogue({ anim, gear }: { anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
  const gltf = useLoader(GLTFLoader, VEX_URL as any) as unknown as { scene: THREE.Group };
  const bladeColor = gear?.weapon?.glow ?? '#ff3a3a';
  const rig = useMemo(() => {
    let src: THREE.Mesh | null = null;
    gltf.scene.traverse((o) => { if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh; });
    const mesh0 = src as unknown as THREE.Mesh;
    // Lambert like the rest of the cast, so it sits in the same light.
    const std = mesh0.material as THREE.MeshStandardMaterial;
    const material = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap, side: THREE.DoubleSide });
    const s = makeSkeleton();
    const skinned = new THREE.SkinnedMesh(skinGeometry(mesh0.geometry), material);
    skinned.add(s.hips);
    skinned.updateMatrixWorld(true);
    skinned.bind(new THREE.Skeleton(s.bones));
    skinned.frustumCulled = false;
    // Fists round the grips of his two red blades.
    const blades = armFists(s, bladeColor);
    return { skinned, material, s, blades };
  }, [gltf, bladeColor]);
  useEffect(() => () => {
    rig.material.dispose();
    rig.blades.forEach((b) => b.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    }));
  }, [rig]);
  // Amulet and ring as glowing gems.
  useEffect(() => {
    const added: THREE.Mesh[] = [];
    const gem = (color: string, parent: THREE.Object3D, x: number, y: number, z: number, r: number) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      m.position.set(x, y, z);
      parent.add(m);
      added.push(m);
    };
    if (gear?.amulet) gem(gear.amulet, rig.s.spine, 0, 0.3, 0.2, 0.025);
    if (gear?.ring) gem(gear.ring, rig.s.handL, 0.03, -0.05, 0.03, 0.012);
    return () => added.forEach((m) => { m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
  }, [rig, gear?.amulet, gear?.ring]);

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

    // Crouched assassin's stance, blades low and forward (same beats as the other rigs).
    let thighL = walk * Math.sin(ph) * 0.6 - 0.1, thighR = -walk * Math.sin(ph) * 0.6 - 0.1;
    let shinL = walk * Math.max(0, -Math.sin(ph)) * 0.8 + 0.18, shinR = walk * Math.max(0, Math.sin(ph)) * 0.8 + 0.18;
    let armLx = -0.35 - walk * Math.sin(ph) * 0.35 + 0.04 * breathe, armRx = -0.35 + walk * Math.sin(ph) * 0.35 - 0.04 * breathe;
    const hang = 0.28; // how far out from the body the arms hang
    let foreL = -0.85, foreR = -0.85;
    let spineX = 0.1 + 0.025 * breathe, spineY = 0;
    let lift = -0.012 + walk * Math.abs(Math.sin(ph)) * 0.025 + 0.004 * breathe;

    if (a.kind === 'melee' && at < 0.5) {
      const kR = bump(at, 0.22, 0.4), kL = bump(at - 0.14, 0.22, 0.4);
      armRx = lerp(armRx, -1.5, kR); foreR = lerp(foreR, -0.1, kR);
      armLx = lerp(armLx, -1.5, kL); foreL = lerp(foreL, -0.1, kL);
      spineX += 0.12 * Math.max(kR, kL); spineY = 0.22 * (kR - kL);
    } else if ((a.kind === 'ability' || a.kind === 'heal' || a.kind === 'rally' || a.kind === 'ranged') && at < 0.7) {
      const k = bump(at, 0.7, 0.4);
      armRx = lerp(armRx, -2.0, k); armLx = lerp(armLx, -2.0, k); foreR = lerp(foreR, -0.35, k); foreL = lerp(foreL, -0.35, k);
      lift += 0.03 * k;
    }
    if (a.defending) { armRx = -1.15; armLx = -1.15; foreR = -1.5; foreL = -1.5; spineX += 0.08; }
    const ht = t - a.hit;
    if (ht >= 0 && ht < 0.35) spineX -= 0.35 * (1 - ht / 0.35);

    const S = rig.s;
    S.thighL.rotation.x = thighL; S.thighR.rotation.x = thighR;
    S.shinL.rotation.x = shinL; S.shinR.rotation.x = shinR;
    // Arms rest out in an A; bring them in to `hang`, then swing forward.
    S.armL.rotation.set(armLx, 0, -(ARM_REST - hang));
    S.armR.rotation.set(armRx, 0, ARM_REST - hang);
    // Forearms turned out a touch so the fists stay in front of the shoulders.
    S.foreL.rotation.set(foreL, 0, 0.3); S.foreR.rotation.set(foreR, 0, -0.3);
    S.spine.rotation.set(spineX, spineY, 0);
    S.head.rotation.set(-0.08, Math.sin(t * 0.7) * 0.15, 0);
    S.hips.position.y = HIP[1] + lift / SCALE;
    aimBlades(rig.blades, rig.skinned, a.kind === 'ability' && at < 0.7 ? bump(at, 0.7, 0.4) : 0);

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
      </group>
    </group>
  );
}

/** Falls back to the code-built wanderer if the model can't load or draw. */
class Fallback extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('Vex model failed, using the built wanderer', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function VexModel(props: { anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
  const fallback = <WandererModel {...props} />;
  return (
    <Fallback fallback={fallback}>
      <React.Suspense fallback={fallback}>
        <Rogue {...props} />
      </React.Suspense>
    </Fallback>
  );
}
