import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from './r3f';
import { HeroAnim } from './HeroModel';
import { WANDERER_BUILT_HEIGHT, WANDERER_COLORS, buildWanderer } from './wandererMesh';
import { GearLook } from './gearLooks';

// Vex as the hooded wanderer from the model sheet (see wandererMesh.ts),
// shrunk to hero size and posed through its named pivots with the same
// HeroAnim inputs as HeroModel.

export const WANDERER_HEIGHT = 1.14;
const SCALE = WANDERER_HEIGHT / WANDERER_BUILT_HEIGHT;
/** The battlefield is dim and mostly shows his back: lift the cloak so it reads. */
const BATTLE_COLORS = { ...WANDERER_COLORS, cloak: '#4a4441', cloakIn: '#2e2926', tunic: '#624d3e' };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const bump = (t: number, dur: number, peak = 0.35) => (t < 0 || t > dur ? 0 : t < dur * peak ? t / (dur * peak) : 1 - (t - dur * peak) / (dur * (1 - peak)));

export function WandererModel({ anim, gear }: { anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
  // The hood and cloak stay whatever he wears; the weapon's enchantment
  // tints his blades, and amulet and ring show as glowing gems.
  const bladeColor = gear?.weapon?.glow ?? WANDERER_COLORS.blade;
  const b = useMemo(() => buildWanderer({ ...BATTLE_COLORS, blade: bladeColor }), [bladeColor]);
  useEffect(() => {
    const added: THREE.Mesh[] = [];
    const gem = (color: string, parent: THREE.Object3D, x: number, y: number, z: number, r: number) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      m.position.set(x, y, z);
      parent.add(m);
      added.push(m);
    };
    if (gear?.amulet) gem(gear.amulet, b.joints.spine, 0, 0.36, 0.14, 0.03);
    if (gear?.ring) {
      const hand = b.joints.foreL.getObjectByName('hand.L');
      if (hand) gem(gear.ring, hand, 0.028, -0.07, 0.03, 0.013);
    }
    return () => added.forEach((m) => { m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
  }, [b, gear?.amulet, gear?.ring]);
  useEffect(() => () => { b.geometries.forEach((g) => g.dispose()); b.materials.forEach((m) => m.dispose()); }, [b]);
  const tinted = useMemo(() => b.materials.filter((m): m is THREE.MeshLambertMaterial => m instanceof THREE.MeshLambertMaterial), [b]);
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

    const J = b.joints;
    J.thighL.rotation.x = thighL; J.thighR.rotation.x = thighR;
    J.shinL.rotation.x = shinL; J.shinR.rotation.x = shinR;
    J.armL.rotation.set(armLx, 0, armLz); J.armR.rotation.set(armRx, 0, armRz);
    J.foreL.rotation.x = foreL; J.foreR.rotation.x = foreR;
    J.spine.rotation.set(spineX, spineY, 0);
    J.head.rotation.set(-0.1, Math.sin(t * 0.7) * 0.15, 0);
    J.hips.position.y = 0.97 + (lift / SCALE) * 0.6;
    J.cloak.rotation.x = 0.06 + walk * 0.35 + Math.sin(t * 2.5) * 0.03;

    const fall = a.alive ? 0 : a.deadAt >= 0 ? Math.min(1, (t - a.deadAt) / 0.55) : 1;
    const eased = 1 - (1 - fall) * (1 - fall);
    if (fallRef.current) { fallRef.current.rotation.x = -1.45 * eased; fallRef.current.position.y = -0.05 * eased; }

    const f = ht >= 0 && ht < 0.3 ? 1 - ht / 0.3 : 0;
    for (const m of tinted) {
      m.emissive.copy(a.frozen ? frozenCol : flashCol);
      m.emissiveIntensity = a.frozen ? 0.45 : f * 0.9;
    }
  });

  return (
    <group ref={fallRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={b.root} />
      </group>
    </group>
  );
}
