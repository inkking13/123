import React, { useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Canvas, useFrame, useLoader } from './r3f';
import { Quality, qualityProfile } from './quality';
import { FrameCap } from './FrameCap';
import { HeroAnim, HeroModel } from './HeroModel';
import { HERO_LOOKS } from './heroLooks';
import { SHEET_MODELS } from './heroFigures';
import { Guard } from './Battle3D';
import { use3dProbe } from './probe3d';
import { Flame, GroundMist } from './Atmosphere';
import { GearLook } from './gearLooks';

// The camp at the top of the home screen: the current squad standing round a
// brazier at night, each in their idle, turned in toward the fire and a little
// to the camera. A hero taps into their flourish now and then.

const url = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));
const BRAZIER = url(require('../../assets/models/decor-brazier.glb'));

function Brazier() {
  const gltf = useLoader(GLTFLoader, BRAZIER as any) as unknown as { scene: THREE.Group };
  const scene = useMemo(() => {
    const s = gltf.scene.clone();
    s.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const std = m.material as THREE.MeshStandardMaterial; m.material = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap }); } });
    return s;
  }, [gltf]);
  // The file is ~1.9 across with its floor at -0.81.
  return <primitive object={scene} scale={[0.34, 0.34, 0.34]} position={[0, 0.81 * 0.34, 0]} />;
}

function CampHero({ id, at, gear, flourishAt }: { id: number; at: [number, number]; gear?: GearLook; flourishAt: number }) {
  const sheet = SHEET_MODELS[id];
  const look = HERO_LOOKS[id];
  const anim = useRef<HeroAnim>({ kind: '', at: -99, hit: -99, deadAt: -1, alive: true, defending: false, speed: 0, frozen: false });
  // Facing the fire, turned a little toward the camera so faces show.
  const yaw = Math.atan2(-at[0], -at[1]) * 0.55 + Math.atan2(-at[0] * 0.2, 3) * 0.45;
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (sheet?.dance && t > flourishAt && anim.current.at < flourishAt) { anim.current.kind = 'dance'; anim.current.at = t; }
  });
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, yaw, 0]}>
      {sheet ? <sheet.Model anim={anim} gear={gear} /> : look ? <HeroModel look={look} anim={anim} gear={gear} /> : null}
    </group>
  );
}

/** Slow drift of the camera round the fire. */
function Drift() {
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    st.camera.position.set(Math.sin(t * 0.08) * 0.5, 1.7, 4.3);
    st.camera.lookAt(0, 0.55, -0.6);
  });
  return null;
}

function Camp({ ids, gear }: { ids: number[]; gear: Record<number, GearLook | undefined> }) {
  // Up to five in an arc behind the fire, the middle one furthest back.
  const spots = useMemo(() => {
    const n = ids.length; const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : -0.95 + (1.9 * i) / (n - 1);
      out.push([Math.sin(a) * 1.8, -Math.cos(a) * 1.35 - 0.1]);
    }
    return out;
  }, [ids.length]);
  // Each takes a turn at a flourish, a few seconds apart.
  const flourish = useMemo(() => ids.map((_, i) => 4 + i * 5 + Math.random() * 2), [ids]);
  return (
    <>
      <color attach="background" args={['#0d0b10']} />
      <fog attach="fog" args={['#0d0b10', 5, 11]} />
      <hemisphereLight args={['#7a7fb0', '#2a1c12', 1.1]} />
      <directionalLight position={[-3, 4, 2]} intensity={0.6} color="#9fb4ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[6, 40]} />
        <meshLambertMaterial color="#231b16" />
      </mesh>
      <React.Suspense fallback={null}><Brazier /></React.Suspense>
      <Flame at={[0, 0.58, 0]} size={0.34} color="#ff9a3c" />
      <GroundMist color="#8a7a8a" count={8} spread={4} />
      {ids.map((id, i) => <CampHero key={id} id={id} at={spots[i]} gear={gear[id]} flourishAt={flourish[i]} />)}
      <Drift />
    </>
  );
}

export function CampScene3D({ ids, gear, height, quality = 'medium', onFail }: {
  ids: number[]; gear: Record<number, GearLook | undefined>; height: number; quality?: Quality; onFail: (e: unknown) => void;
}) {
  use3dProbe();
  const q = useMemo(() => qualityProfile(quality), [quality]);
  const camera = useMemo(() => ({ position: [0, 1.45, 4.1] as [number, number, number], fov: 38, near: 0.05, far: 40 }), []);
  return (
    <Guard onFail={onFail}>
      <Canvas key={quality} camera={camera} style={{ height }} frameloop={q.fps ? 'demand' : 'always'} gl={{ antialias: q.antialias }} onCreated={(st) => st.setDpr(q.dpr)}>
        <FrameCap fps={q.fps} />
        <Camp ids={ids} gear={gear} />
      </Canvas>
    </Guard>
  );
}
