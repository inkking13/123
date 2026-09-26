import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from './r3f';

// Low-poly monsters that aren't built like people: beasts, birds, spiders,
// serpents, dragons, blobs and sprites. Same faceted, flat-shaded style as the
// heroes, each with its own procedural walk, attack and wind-up. Faces +Z.

export interface CreatureAnim {
  at: number;       // last attack start (clock seconds)
  hit: number;      // last time it was hit
  deadAt: number;   // -1 while alive
  alive: boolean;
  speed: number;    // world units / second
  rear: number;     // wind-up 0..1
  stunned: boolean;
}

export type CreatureLook =
  | { kind: 'beast'; variant: 'wolf' | 'rat' | 'lion'; body: string; belly: string; eyes: string; mane?: string; horns?: string; tail?: string; riders?: boolean }
  | { kind: 'bird'; variant: 'raptor' | 'crow' | 'vulture'; body: string; wing: string; beak: string; eyes: string; crest?: string; head?: string }
  | { kind: 'spider'; variant: 'spider' | 'scorpion'; body: string; legs: string; eyes: string; marks?: string; crystals?: string; eggs?: string }
  | { kind: 'serpent'; variant: 'snake' | 'worm' | 'wyrm'; body: string; belly: string; eyes: string; spikes?: string; glow?: string }
  | { kind: 'dragon'; body: string; wing: string; belly: string; eyes: string; horns: string; stars?: string }
  | { kind: 'blob'; variant: 'ooze' | 'fungus'; body: string; eyes: string; cap?: string; spots?: string }
  | { kind: 'sprite'; body: string; wing: string; eyes: string; spots?: string };

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 6),
  taper: new THREE.CylinderGeometry(0.6, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  cap: new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.3, 4, 8),
};

type V3 = [number, number, number];
function Part({ g, m, p, s, r }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V3; s: V3; r?: V3 }) {
  return <mesh geometry={g} material={m} position={p ?? [0, 0, 0]} scale={s} rotation={r ?? [0, 0, 0]} />;
}

function useMats(colors: Record<string, string | undefined>, glowKeys: string[]) {
  return useMemo(() => {
    const out: Record<string, THREE.MeshLambertMaterial | THREE.MeshBasicMaterial> = {};
    for (const [k, c] of Object.entries(colors)) {
      if (!c) continue;
      out[k] = glowKeys.includes(k)
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    }
    out.dark = new THREE.MeshLambertMaterial({ color: '#141214', flatShading: true });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(colors)]);
}

const bump = (t: number, dur: number, peak = 0.35) => (t < 0 || t > dur ? 0 : t < dur * peak ? t / (dur * peak) : 1 - (t - dur * peak) / (dur * (1 - peak)));
const FLASH = new THREE.Color('#ff4a3a');

/** Shared per-frame bits: hit flash on every lit material, and tipping over on death. */
function useCommon(anim: React.MutableRefObject<CreatureAnim>, mats: Record<string, THREE.Material>, fallRef: React.RefObject<THREE.Group | null>) {
  useFrame((st) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const ht = t - a.hit;
    const f = ht >= 0 && ht < 0.3 ? 1 - ht / 0.3 : 0;
    for (const m of Object.values(mats)) {
      if (m instanceof THREE.MeshLambertMaterial) { m.emissive.copy(FLASH); m.emissiveIntensity = f * 0.9; }
    }
    const g = fallRef.current; if (!g) return;
    const fall = a.alive ? 0 : a.deadAt >= 0 ? Math.min(1, (t - a.deadAt) / 0.6) : 1;
    const e = 1 - (1 - fall) * (1 - fall);
    g.rotation.z = 1.5 * e;
    g.position.y = -0.05 * e;
    if (a.stunned && a.alive) g.rotation.x = Math.sin(t * 6) * 0.1; else g.rotation.x = 0;
  });
}

function Beast({ look, anim }: { look: Extract<CreatureLook, { kind: 'beast' }>; anim: React.MutableRefObject<CreatureAnim> }) {
  const m = useMats({ body: look.body, belly: look.belly, eyes: look.eyes, mane: look.mane, horns: look.horns, tail: look.tail }, ['eyes']);
  const fall = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null); const head = useRef<THREE.Group>(null); const jaw = useRef<THREE.Mesh>(null); const tail = useRef<THREE.Group>(null);
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const phase = useRef(0);
  useCommon(anim, m, fall);
  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const walk = Math.min(1, a.speed / 1.2);
    phase.current += dt * (3 + walk * 10);
    const at = t - a.at; const bite = bump(at, 0.45, 0.4);
    legs.forEach((l, i) => { if (l.current) l.current.rotation.x = walk * Math.sin(phase.current + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 - (i < 2 ? a.rear * 0.9 : 0); });
    if (body.current) { body.current.rotation.x = -a.rear * 0.45; body.current.position.y = walk * Math.abs(Math.sin(phase.current)) * 0.03 + Math.sin(t * 2) * 0.008; }
    if (head.current) { head.current.rotation.x = bite * 0.5 - a.rear * 0.2; head.current.rotation.y = Math.sin(t * 0.8) * 0.15; }
    if (jaw.current) jaw.current.rotation.x = 0.15 + bite * 0.6 + a.rear * 0.4;
    if (tail.current) tail.current.rotation.y = Math.sin(t * (look.variant === 'wolf' ? 5 : 2)) * 0.35;
  });
  const rat = look.variant === 'rat'; const lion = look.variant === 'lion';
  return (
    <group ref={fall}>
      {[[-0.15, 0.25], [0.15, 0.25], [-0.15, -0.25], [0.15, -0.25]].map(([x, z], i) => (
        <group key={i} ref={legs[i]} position={[x, 0.42, z]}>
          <Part g={G.cyl} m={m.body} p={[0, -0.2, 0]} s={[0.05, 0.42, 0.05]} />
          <Part g={G.box} m={m.dark} p={[0, -0.41, 0.03]} s={[0.08, 0.04, 0.1]} />
        </group>
      ))}
      <group ref={body} >
        <group position={[0, 0.5, 0]}>
          <Part g={G.ico1} m={m.body} s={[0.25, 0.22, 0.46]} />
          <Part g={G.ico} m={m.belly} p={[0, -0.08, 0.05]} s={[0.18, 0.12, 0.34]} />
          {look.variant === 'wolf' ? [0.25, 0.1, -0.05, -0.2].map((z) => <Part key={z} g={G.cone4} m={m.dark} p={[0, 0.2, z]} s={[0.04, 0.1, 0.05]} r={[-0.4, 0, 0]} />) : null}
          {look.riders ? [[-0.12, -0.1], [0.12, 0.05], [0, -0.28]].map(([x, z], i) => (
            <group key={i} position={[x, 0.2, z]}>
              <Part g={G.ico} m={m.body} s={[0.09, 0.07, 0.13]} />
              <Part g={G.ico} m={m.belly} p={[0, 0.06, 0.08]} s={[0.04, 0.04, 0.04]} />
              <Part g={G.ico} m={m.eyes} p={[0.03, 0.03, 0.12]} s={[0.012, 0.012, 0.012]} />
            </group>
          )) : null}
          <group ref={tail} position={[0, 0.05, -0.44]}>
            {rat ? <Part g={G.cyl} m={m.belly} p={[0, -0.1, -0.25]} s={[0.018, 0.55, 0.018]} r={[1.2, 0, 0]} /> : null}
            {look.variant === 'wolf' ? <Part g={G.cone} m={m.body} p={[0, 0.02, -0.16]} s={[0.08, 0.36, 0.08]} r={[-2.0, 0, 0]} /> : null}
            {lion ? (<>
              <Part g={G.cyl} m={m.tail ?? m.body} p={[0, 0.1, -0.15]} s={[0.035, 0.36, 0.035]} r={[-2.3, 0, 0]} />
              <Part g={G.ico} m={m.tail ?? m.body} p={[0, 0.26, -0.28]} s={[0.07, 0.05, 0.09]} />
              <Part g={G.ico} m={m.eyes} p={[0.03, 0.28, -0.22]} s={[0.012, 0.012, 0.012]} />
            </>) : null}
          </group>
          <group ref={head} position={[0, 0.14, 0.44]}>
            {lion && look.mane ? <Part g={G.ico1} m={m.mane} p={[0, 0, -0.03]} s={[0.24, 0.24, 0.17]} /> : null}
            <Part g={G.ico} m={m.body} s={[0.15, 0.14, 0.16]} />
            <Part g={G.box} m={rat ? m.belly : m.body} p={[0, -0.02, 0.16]} s={[0.1, 0.08, rat ? 0.22 : 0.16]} />
            <mesh ref={jaw} geometry={G.box} material={m.belly} position={[0, -0.07, 0.1]} scale={[0.09, 0.03, rat ? 0.2 : 0.16]} />
            <Part g={G.ico} m={m.dark} p={[0, 0.0, rat ? 0.28 : 0.24]} s={[0.025, 0.02, 0.02]} />
            <Part g={G.ico} m={m.eyes} p={[0.06, 0.05, 0.12]} s={[0.022, 0.022, 0.022]} />
            <Part g={G.ico} m={m.eyes} p={[-0.06, 0.05, 0.12]} s={[0.022, 0.022, 0.022]} />
            {rat ? (<>
              <Part g={G.ico} m={m.belly} p={[0.1, 0.12, -0.02]} s={[0.06, 0.06, 0.02]} />
              <Part g={G.ico} m={m.belly} p={[-0.1, 0.12, -0.02]} s={[0.06, 0.06, 0.02]} />
            </>) : (<>
              <Part g={G.cone4} m={m.body} p={[0.08, 0.15, -0.02]} s={[0.04, 0.12, 0.03]} />
              <Part g={G.cone4} m={m.body} p={[-0.08, 0.15, -0.02]} s={[0.04, 0.12, 0.03]} />
            </>)}
            {look.horns ? (<>
              <Part g={G.cone} m={m.horns} p={[0.1, 0.16, -0.06]} s={[0.035, 0.2, 0.035]} r={[-0.9, 0, -0.3]} />
              <Part g={G.cone} m={m.horns} p={[-0.1, 0.16, -0.06]} s={[0.035, 0.2, 0.035]} r={[-0.9, 0, 0.3]} />
            </>) : null}
          </group>
        </group>
      </group>
    </group>
  );
}

function Bird({ look, anim }: { look: Extract<CreatureLook, { kind: 'bird' }>; anim: React.MutableRefObject<CreatureAnim> }) {
  const m = useMats({ body: look.body, wing: look.wing, beak: look.beak, eyes: look.eyes, crest: look.crest, head: look.head }, ['eyes']);
  const fall = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null); const head = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null); const wingR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null); const legR = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const raptor = look.variant === 'raptor'; const flyer = look.variant === 'crow';
  useCommon(anim, m, fall);
  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const walk = Math.min(1, a.speed / 1.2);
    phase.current += dt * (3 + walk * 11);
    const at = t - a.at; const peck = bump(at, 0.4, 0.4);
    const flapSpeed = flyer ? 9 : walk > 0.1 || peck > 0 || a.rear > 0.1 ? 12 : 1.5;
    const flap = Math.sin(t * flapSpeed) * (flyer || walk > 0.1 || a.rear > 0.1 ? 0.7 : 0.08);
    if (wingL.current && wingR.current) { wingL.current.rotation.z = 0.2 + flap + a.rear * 0.6; wingR.current.rotation.z = -0.2 - flap - a.rear * 0.6; }
    if (legL.current && legR.current) { legL.current.rotation.x = walk * Math.sin(phase.current) * 0.7; legR.current.rotation.x = -walk * Math.sin(phase.current) * 0.7; }
    if (rig.current) { rig.current.position.y = (flyer ? 0.35 + Math.sin(t * 2) * 0.06 : 0) + walk * Math.abs(Math.sin(phase.current)) * 0.03; rig.current.rotation.x = -a.rear * 0.4; }
    if (head.current) head.current.rotation.x = peck * 0.9 + Math.sin(t * 3) * 0.05;
  });
  return (
    <group ref={fall}>
      <group ref={rig}>
        {([[legL, -1], [legR, 1]] as const).map(([ref, sx], i) => (
          <group key={i} ref={ref} position={[sx * 0.09, raptor ? 0.5 : 0.38, 0]}>
            <Part g={G.cyl} m={raptor ? m.body : m.beak} p={[0, raptor ? -0.24 : -0.18, 0]} s={[raptor ? 0.05 : 0.018, raptor ? 0.48 : 0.36, raptor ? 0.05 : 0.018]} />
            <Part g={G.box} m={m.beak} p={[0, raptor ? -0.48 : -0.36, 0.04]} s={[0.07, 0.02, 0.1]} />
          </group>
        ))}
        <group position={[0, raptor ? 0.62 : 0.55, 0]}>
          <Part g={G.ico1} m={m.body} s={raptor ? [0.18, 0.18, 0.34] : [0.19, 0.22, 0.27]} />
          {/* tail */}
          <Part g={raptor ? G.cone : G.cone4} m={raptor ? m.body : m.wing} p={[0, raptor ? 0.02 : -0.05, raptor ? -0.5 : -0.3]} s={raptor ? [0.1, 0.55, 0.1] : [0.13, 0.22, 0.03]} r={[raptor ? -1.45 : -1.9, 0, 0]} />
          {([[wingL, -1], [wingR, 1]] as const).map(([ref, sx], i) => (
            <group key={i} ref={ref} position={[sx * 0.17, 0.05, 0]}>
              <Part g={G.box} m={m.wing} p={[sx * (raptor ? 0.14 : 0.24), 0, -0.04]} s={[raptor ? 0.28 : 0.48, 0.025, raptor ? 0.16 : 0.26]} />
            </group>
          ))}
          {/* neck + head */}
          <group ref={head} position={[0, raptor ? 0.14 : 0.18, raptor ? 0.3 : 0.18]}>
            {look.variant === 'vulture' ? <Part g={G.ico} m={m.wing} p={[0, -0.06, -0.03]} s={[0.12, 0.07, 0.1]} /> : null}
            <Part g={G.ico} m={look.head ? m.head : m.body} p={[0, 0.06, 0.05]} s={raptor ? [0.12, 0.11, 0.17] : [0.1, 0.1, 0.11]} />
            <Part g={G.cone4} m={m.beak} p={[0, 0.04, raptor ? 0.24 : 0.17]} s={raptor ? [0.07, 0.16, 0.05] : [0.04, 0.13, 0.035]} r={[Math.PI / 2, 0, 0]} />
            <Part g={G.ico} m={m.eyes} p={[0.06, 0.09, 0.1]} s={[0.018, 0.018, 0.018]} />
            <Part g={G.ico} m={m.eyes} p={[-0.06, 0.09, 0.1]} s={[0.018, 0.018, 0.018]} />
            {look.crest ? [-0.05, 0, 0.05].map((z) => <Part key={z} g={G.cone4} m={m.crest} p={[0, 0.17, z]} s={[0.025, 0.14, 0.04]} r={[-0.5, 0, 0]} />) : null}
          </group>
        </group>
      </group>
    </group>
  );
}

function Spider({ look, anim }: { look: Extract<CreatureLook, { kind: 'spider' }>; anim: React.MutableRefObject<CreatureAnim> }) {
  const m = useMats({ body: look.body, legs: look.legs, eyes: look.eyes, marks: look.marks, crystals: look.crystals, eggs: look.eggs }, ['eyes', 'marks', 'eggs']);
  const fall = useRef<THREE.Group>(null); const rig = useRef<THREE.Group>(null); const tail = useRef<THREE.Group>(null);
  const scorp = look.variant === 'scorpion';
  const count = scorp ? 3 : 4;
  const legRefs = useRef<(THREE.Group | null)[]>([]);
  const claws = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const phase = useRef(0);
  useCommon(anim, m, fall);
  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const walk = Math.min(1, a.speed / 1.2);
    phase.current += dt * (2 + walk * 14);
    const at = t - a.at; const strike = bump(at, 0.45, 0.4);
    legRefs.current.forEach((l, i) => { if (l) l.rotation.x = walk * Math.sin(phase.current + i * 1.3) * 0.35; });
    if (rig.current) { rig.current.rotation.x = -(scorp ? 0 : strike * 0.35) - a.rear * 0.3; rig.current.position.y = Math.sin(t * 2.5) * 0.01; }
    if (tail.current) tail.current.rotation.x = -strike * 0.9 - a.rear * 0.3 + Math.sin(t * 2) * 0.05;
    claws.forEach((c, i) => { if (c.current) c.current.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 3) * 0.1 + strike * 0.3); });
  });
  return (
    <group ref={fall}>
      <group ref={rig}>
        {/* legs */}
        {Array.from({ length: count * 2 }).map((_, i) => {
          const side = i < count ? -1 : 1; const k = i % count;
          const z = 0.14 - k * 0.1;
          return (
            <group key={i} ref={(g) => { legRefs.current[i] = g; }} position={[side * 0.1, 0.32, z]} rotation={[0, side * (0.3 - k * 0.25), 0]}>
              <Part g={G.cyl} m={m.legs} p={[side * 0.24, 0.14, 0]} s={[0.03, 0.52, 0.03]} r={[0, 0, side * -1.0]} />
              <Part g={G.ico} m={m.legs} p={[side * 0.46, 0.28, 0]} s={[0.04, 0.04, 0.04]} />
              <Part g={G.cyl} m={m.legs} p={[side * 0.55, 0.0, 0]} s={[0.024, 0.6, 0.024]} r={[0, 0, side * -0.28]} />
            </group>
          );
        })}
        {/* body */}
        <Part g={G.ico} m={m.body} p={[0, 0.32, 0.12]} s={[0.15, 0.1, 0.16]} />
        {[[0.04, 0.03], [-0.04, 0.03], [0.07, 0], [-0.07, 0]].map(([x, y], i) => <Part key={i} g={G.ico} m={m.eyes} p={[x, 0.36 + y, 0.26]} s={[0.018, 0.018, 0.018]} />)}
        {scorp ? (<>
          <Part g={G.ico1} m={m.body} p={[0, 0.3, -0.12]} s={[0.17, 0.1, 0.28]} />
          {[-1, 1].map((side, i) => (
            <group key={side} ref={claws[i]} position={[side * 0.1, 0.32, 0.22]}>
              <Part g={G.cyl} m={m.legs} p={[side * 0.08, 0, 0.12]} s={[0.03, 0.26, 0.03]} r={[1.2, 0, side * -0.4]} />
              <Part g={G.box} m={m.body} p={[side * 0.14, 0, 0.28]} s={[0.08, 0.05, 0.14]} />
              <Part g={G.box} m={m.body} p={[side * 0.1, 0, 0.36]} s={[0.03, 0.04, 0.1]} r={[0, side * 0.4, 0]} />
            </group>
          ))}
          <group ref={tail} position={[0, 0.34, -0.38]}>
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 4) * Math.PI * 0.95;
              return <Part key={i} g={G.ico} m={m.body} p={[0, Math.sin(a) * 0.38, -Math.cos(a) * 0.2 + (i > 2 ? 0.1 * (i - 2) : 0)]} s={[0.075 - i * 0.008, 0.07, 0.075]} />;
            })}
            <Part g={G.cone} m={m.eyes} p={[0, 0.42, 0.28]} s={[0.03, 0.12, 0.03]} r={[2.2, 0, 0]} />
          </group>
        </>) : (<>
          <Part g={G.ico1} m={m.body} p={[0, 0.4, -0.22]} s={[0.26, 0.22, 0.32]} />
          {look.marks ? (<>
            <Part g={G.box} m={m.marks} p={[0, 0.6, -0.2]} s={[0.05, 0.02, 0.22]} />
            <Part g={G.box} m={m.marks} p={[0, 0.58, -0.25]} s={[0.18, 0.02, 0.04]} />
          </>) : null}
          {look.crystals ? [[0, 0.62, -0.2, 0], [0.12, 0.55, -0.3, -0.5], [-0.12, 0.55, -0.15, 0.5], [0.05, 0.5, -0.45, -0.3]].map(([x, y, z, r], i) => (
            <Part key={i} g={G.cone4} m={m.crystals} p={[x, y, z]} s={[0.05, 0.2, 0.05]} r={[0, 0, r]} />
          )) : null}
          {look.eggs ? [[-0.35, 0.3], [0.35, 0.25], [-0.25, -0.5], [0.3, -0.45], [0, -0.6]].map(([x, z], i) => (
            <Part key={i} g={G.ico1} m={m.eggs} p={[x, 0.07, z]} s={[0.07, 0.09, 0.07]} />
          )) : null}
        </>)}
      </group>
    </group>
  );
}

function Serpent({ look, anim }: { look: Extract<CreatureLook, { kind: 'serpent' }>; anim: React.MutableRefObject<CreatureAnim> }) {
  const m = useMats({ body: look.body, belly: look.belly, eyes: look.eyes, spikes: look.spikes, glow: look.glow }, ['eyes', 'glow']);
  const fall = useRef<THREE.Group>(null);
  const segs = useRef<(THREE.Group | null)[]>([]);
  const jaw = useRef<THREE.Mesh>(null);
  const N = 9;
  const worm = look.variant === 'worm';
  useCommon(anim, m, fall);
  useFrame((st) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const at = t - a.at; const strike = bump(at, 0.45, 0.4);
    segs.current.forEach((g, i) => {
      if (!g) return;
      const k = i / (N - 1); // 0 tail … 1 head
      const rise = Math.max(0, (k - 0.55) / 0.45);
      const y = 0.1 + rise * rise * (0.75 + a.rear * 0.35) - strike * rise * 0.35;
      const z = -0.45 + k * 0.7 + strike * rise * 0.35;
      const x = Math.sin(t * 2.2 - k * 4) * 0.06 * (1 - rise) + (worm ? 0 : Math.sin(k * 5) * 0.05 * (1 - rise));
      g.position.set(x, y, z);
    });
    if (jaw.current) jaw.current.rotation.x = 0.2 + strike * 0.8 + a.rear * 0.5;
  });
  return (
    <group ref={fall}>
      {Array.from({ length: N }).map((_, i) => {
        const k = i / (N - 1);
        const r = (worm ? 0.12 : 0.11) + k * (worm ? 0.05 : 0.05);
        const isHead = i === N - 1;
        return (
          <group key={i} ref={(g) => { segs.current[i] = g; }}>
            <Part g={worm ? G.torus : G.ico} m={i % 2 && !worm ? m.belly : m.body} s={worm ? [r * 0.95, r * 0.95, r * 1.2] : [r, r * 0.9, r * 1.25]} r={worm ? [0, 0, 0] : [0, 0, 0]} />
            {worm ? <Part g={G.ico} m={m.body} s={[r * 0.85, r * 0.85, r * 0.9]} /> : null}
            {look.spikes && !isHead && i % 2 === 0 ? <Part g={G.cone4} m={m.spikes} p={[0, r * 0.9, 0]} s={[0.035, 0.12, 0.05]} /> : null}
            {look.glow && !isHead && i % 3 === 1 ? <Part g={G.ico} m={m.glow} p={[r * 0.8, r * 0.3, 0]} s={[0.025, 0.025, 0.025]} /> : null}
            {isHead ? (worm ? (<>
              <Part g={G.torus} m={m.dark} p={[0, 0.02, 0.1]} s={[0.1, 0.1, 0.1]} r={[0.2, 0, 0]} />
              {[0, 1, 2, 3, 4, 5].map((j) => <Part key={j} g={G.cone4} m={m.belly} p={[Math.sin(j) * 0.07, 0.02 + Math.cos(j) * 0.07, 0.12]} s={[0.012, 0.04, 0.012]} r={[Math.PI / 2, 0, 0]} />)}
            </>) : (<>
              <Part g={G.ico} m={m.body} p={[0, 0.02, 0.1]} s={[0.14, 0.1, 0.2]} />
              <mesh ref={jaw} geometry={G.box} material={m.belly} position={[0, -0.06, 0.12]} scale={[0.12, 0.03, 0.2]} />
              <Part g={G.ico} m={m.eyes} p={[0.07, 0.07, 0.17]} s={[0.022, 0.022, 0.022]} />
              <Part g={G.ico} m={m.eyes} p={[-0.07, 0.07, 0.17]} s={[0.022, 0.022, 0.022]} />
              {look.spikes ? (<>
                <Part g={G.cone} m={m.spikes} p={[0.07, 0.12, 0.0]} s={[0.025, 0.14, 0.025]} r={[-1, 0, -0.3]} />
                <Part g={G.cone} m={m.spikes} p={[-0.07, 0.12, 0.0]} s={[0.025, 0.14, 0.025]} r={[-1, 0, 0.3]} />
              </>) : null}
            </>)) : null}
          </group>
        );
      })}
    </group>
  );
}

function Dragon({ look, anim }: { look: Extract<CreatureLook, { kind: 'dragon' }>; anim: React.MutableRefObject<CreatureAnim> }) {
  const m = useMats({ body: look.body, wing: look.wing, belly: look.belly, eyes: look.eyes, horns: look.horns, stars: look.stars }, ['eyes', 'stars']);
  const fall = useRef<THREE.Group>(null); const rig = useRef<THREE.Group>(null); const neck = useRef<THREE.Group>(null); const jaw = useRef<THREE.Mesh>(null);
  const wingL = useRef<THREE.Group>(null); const wingR = useRef<THREE.Group>(null); const tail = useRef<THREE.Group>(null);
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const phase = useRef(0);
  useCommon(anim, m, fall);
  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const walk = Math.min(1, a.speed / 1.2);
    phase.current += dt * (2 + walk * 8);
    const at = t - a.at; const bite = bump(at, 0.5, 0.4);
    legs.forEach((l, i) => { if (l.current) l.current.rotation.x = walk * Math.sin(phase.current + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 - (i < 2 ? a.rear * 0.8 : 0); });
    if (rig.current) rig.current.rotation.x = -a.rear * 0.4;
    if (neck.current) neck.current.rotation.x = -0.5 + bite * 0.9 - a.rear * 0.3 + Math.sin(t * 1.2) * 0.05;
    if (jaw.current) jaw.current.rotation.x = 0.1 + bite * 0.6 + a.rear * 0.4;
    const flap = Math.sin(t * (a.rear > 0.1 || bite > 0 ? 8 : 1.6)) * (a.rear > 0.1 ? 0.6 : 0.15);
    if (wingL.current && wingR.current) { wingL.current.rotation.z = 0.5 + flap + a.rear * 0.5; wingR.current.rotation.z = -0.5 - flap - a.rear * 0.5; }
    if (tail.current) tail.current.rotation.y = Math.sin(t * 1.3) * 0.3;
  });
  return (
    <group ref={fall}>
      {[[-0.18, 0.25], [0.18, 0.25], [-0.18, -0.25], [0.18, -0.25]].map(([x, z], i) => (
        <group key={i} ref={legs[i]} position={[x, 0.42, z]}>
          <Part g={G.cyl} m={m.body} p={[0, -0.2, 0]} s={[0.07, 0.42, 0.07]} />
          <Part g={G.box} m={m.horns} p={[0, -0.41, 0.05]} s={[0.1, 0.04, 0.14]} />
        </group>
      ))}
      <group ref={rig} position={[0, 0.52, 0]}>
        <Part g={G.ico1} m={m.body} s={[0.27, 0.24, 0.45]} />
        <Part g={G.ico} m={m.belly} p={[0, -0.09, 0.05]} s={[0.2, 0.13, 0.34]} />
        {look.stars ? [[0.18, 0.12, 0.1], [-0.15, 0.15, -0.1], [0.05, 0.22, -0.25], [-0.2, 0.05, 0.2]].map(([x, y, z], i) => <Part key={i} g={G.ico} m={m.stars} p={[x, y, z]} s={[0.025, 0.025, 0.025]} />) : null}
        {([[wingL, -1], [wingR, 1]] as const).map(([ref, sx], i) => (
          <group key={i} ref={ref} position={[sx * 0.18, 0.18, 0.05]}>
            <Part g={G.cone4} m={m.wing} p={[sx * 0.42, 0.05, -0.1]} s={[0.45, 0.02, 0.4]} r={[Math.PI / 2, 0, sx * 1.35]} />
            <Part g={G.cyl} m={m.body} p={[sx * 0.35, 0.12, 0]} s={[0.025, 0.7, 0.025]} r={[0, 0, sx * -1.2]} />
          </group>
        ))}
        <group ref={tail} position={[0, 0, -0.42]}>
          {[0, 1, 2, 3].map((i) => <Part key={i} g={G.ico} m={m.body} p={[0, -0.05 - i * 0.04, -0.12 - i * 0.16]} s={[0.1 - i * 0.02, 0.09 - i * 0.02, 0.13]} />)}
          <Part g={G.cone4} m={m.horns} p={[0, -0.2, -0.78]} s={[0.08, 0.14, 0.02]} r={[-1.6, 0, 0]} />
        </group>
        <group ref={neck} position={[0, 0.12, 0.38]}>
          <Part g={G.cyl} m={m.body} p={[0, 0.2, 0]} s={[0.08, 0.42, 0.08]} />
          <group position={[0, 0.42, 0.05]}>
            <Part g={G.ico} m={m.body} s={[0.13, 0.11, 0.18]} />
            <Part g={G.box} m={m.body} p={[0, -0.01, 0.18]} s={[0.1, 0.07, 0.18]} />
            <mesh ref={jaw} geometry={G.box} material={m.belly} position={[0, -0.06, 0.12]} scale={[0.09, 0.03, 0.2]} />
            <Part g={G.ico} m={m.eyes} p={[0.07, 0.05, 0.12]} s={[0.022, 0.022, 0.022]} />
            <Part g={G.ico} m={m.eyes} p={[-0.07, 0.05, 0.12]} s={[0.022, 0.022, 0.022]} />
            <Part g={G.cone} m={m.horns} p={[0.07, 0.12, -0.08]} s={[0.03, 0.2, 0.03]} r={[-1.1, 0, -0.2]} />
            <Part g={G.cone} m={m.horns} p={[-0.07, 0.12, -0.08]} s={[0.03, 0.2, 0.03]} r={[-1.1, 0, 0.2]} />
          </group>
        </group>
      </group>
    </group>
  );
}

function Blob({ look, anim }: { look: Extract<CreatureLook, { kind: 'blob' }>; anim: React.MutableRefObject<CreatureAnim> }) {
  const m = useMats({ body: look.body, eyes: look.eyes, cap: look.cap, spots: look.spots }, ['eyes', 'spots']);
  const fall = useRef<THREE.Group>(null); const rig = useRef<THREE.Group>(null);
  useCommon(anim, m, fall);
  useFrame((st) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const at = t - a.at; const lunge = bump(at, 0.45, 0.4);
    const j = Math.sin(t * 4) * 0.04 + a.rear * 0.25;
    if (rig.current) rig.current.scale.set(1 - j * 0.5 + lunge * 0.1, 1 + j - lunge * 0.15, 1 - j * 0.5 + lunge * 0.3);
  });
  if (look.variant === 'fungus') {
    return (
      <group ref={fall}>
        <group ref={rig}>
          {[[0, 0, 1.2], [0.28, -0.1, 0.7], [-0.26, 0.05, 0.8], [0.12, 0.3, 0.55], [-0.2, -0.3, 0.6]].map(([x, z, h], i) => (
            <group key={i} position={[x, 0, z]}>
              <Part g={G.taper} m={m.body} p={[0, h * 0.3, 0]} s={[0.05 * h, h * 0.6, 0.05 * h]} />
              <Part g={G.cap} m={m.cap} p={[0, h * 0.58, 0]} s={[0.2 * h, 0.14 * h, 0.2 * h]} />
              <Part g={G.ico} m={m.spots} p={[0.08 * h, h * 0.66, 0.08 * h]} s={[0.02, 0.02, 0.02]} />
              <Part g={G.ico} m={m.spots} p={[-0.09 * h, h * 0.64, 0.02]} s={[0.018, 0.018, 0.018]} />
            </group>
          ))}
          <Part g={G.ico} m={m.eyes} p={[0.05, 0.5, 0.12]} s={[0.025, 0.025, 0.025]} />
          <Part g={G.ico} m={m.eyes} p={[-0.05, 0.5, 0.12]} s={[0.025, 0.025, 0.025]} />
        </group>
      </group>
    );
  }
  return (
    <group ref={fall}>
      <group ref={rig}>
        <Part g={G.ico1} m={m.body} p={[0, 0.3, 0]} s={[0.4, 0.33, 0.38]} />
        {[[0.3, 0.2], [-0.32, 0.05], [0.1, -0.33], [-0.15, 0.3]].map(([x, z], i) => <Part key={i} g={G.ico} m={m.body} p={[x, 0.06, z]} s={[0.11, 0.07, 0.11]} />)}
        <Part g={G.ico} m={m.eyes} p={[0.12, 0.45, 0.3]} s={[0.05, 0.05, 0.03]} />
        <Part g={G.ico} m={m.eyes} p={[-0.12, 0.45, 0.3]} s={[0.05, 0.05, 0.03]} />
        <Part g={G.box} m={m.dark} p={[0, 0.3, 0.36]} s={[0.18, 0.09, 0.04]} />
      </group>
    </group>
  );
}

function Sprite({ look, anim }: { look: Extract<CreatureLook, { kind: 'sprite' }>; anim: React.MutableRefObject<CreatureAnim> }) {
  const m = useMats({ body: look.body, wing: look.wing, eyes: look.eyes, spots: look.spots }, ['eyes', 'spots']);
  const fall = useRef<THREE.Group>(null); const rig = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Group>(null); const wingR = useRef<THREE.Group>(null);
  useCommon(anim, m, fall);
  useFrame((st) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const at = t - a.at; const cast = bump(at, 0.5, 0.4);
    const flap = Math.sin(t * 10) * 0.5;
    if (wingL.current && wingR.current) { wingL.current.rotation.y = -0.4 - flap; wingR.current.rotation.y = 0.4 + flap; }
    if (rig.current) { rig.current.position.y = 0.45 + Math.sin(t * 2.5) * 0.08 + a.rear * 0.2 + cast * 0.1; rig.current.rotation.x = -cast * 0.3; }
  });
  return (
    <group ref={fall}>
      <group ref={rig}>
        <Part g={G.cone} m={m.body} p={[0, 0.15, 0]} s={[0.07, 0.35, 0.06]} r={[Math.PI, 0, 0]} />
        <Part g={G.ico} m={m.body} p={[0, 0.42, 0]} s={[0.08, 0.09, 0.08]} />
        <Part g={G.ico} m={m.eyes} p={[0.03, 0.43, 0.07]} s={[0.015, 0.015, 0.015]} />
        <Part g={G.ico} m={m.eyes} p={[-0.03, 0.43, 0.07]} s={[0.015, 0.015, 0.015]} />
        <Part g={G.cyl} m={m.body} p={[0.04, 0.55, 0]} s={[0.006, 0.12, 0.006]} r={[0, 0, -0.4]} />
        <Part g={G.cyl} m={m.body} p={[-0.04, 0.55, 0]} s={[0.006, 0.12, 0.006]} r={[0, 0, 0.4]} />
        {([[wingL, -1], [wingR, 1]] as const).map(([ref, sx], i) => (
          <group key={i} ref={ref} position={[sx * 0.03, 0.28, -0.04]}>
            <Part g={G.cone4} m={m.wing} p={[sx * 0.22, 0.12, 0]} s={[0.24, 0.02, 0.2]} r={[Math.PI / 2, 0, sx * 1.1]} />
            <Part g={G.cone4} m={m.wing} p={[sx * 0.16, -0.08, 0]} s={[0.16, 0.02, 0.14]} r={[Math.PI / 2, 0, sx * 2.0]} />
            {look.spots ? <Part g={G.ico} m={m.spots} p={[sx * 0.24, 0.14, 0.01]} s={[0.035, 0.035, 0.01]} /> : null}
          </group>
        ))}
      </group>
    </group>
  );
}

export function CreatureModel({ look, anim }: { look: CreatureLook; anim: React.MutableRefObject<CreatureAnim> }) {
  switch (look.kind) {
    case 'beast': return <Beast look={look} anim={anim} />;
    case 'bird': return <Bird look={look} anim={anim} />;
    case 'spider': return <Spider look={look} anim={anim} />;
    case 'serpent': return <Serpent look={look} anim={anim} />;
    case 'dragon': return <Dragon look={look} anim={anim} />;
    case 'blob': return <Blob look={look} anim={anim} />;
    case 'sprite': return <Sprite look={look} anim={anim} />;
  }
}
