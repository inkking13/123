import React, { Component, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useLoader } from './r3f';
import { BattleTheme } from '../components/BattleBackdrop';
import { GRID_COLS, GRID_ROWS } from '../combat/types';

// Meshy-made battlefields the board sits in, replacing the flat ground and
// the board's slab. Each file is one static textured mesh, simplified to
// ~67k triangles with a 2K base colour and 1K normal map.

const url = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));

const STAGES = {
  // Ruined keep: stone floor ringed by broken walls, an arch and banner towers behind the enemy rows.
  // The export is 1.9 units across with its floor at y = -0.39; scaled so the floor holds the board.
  cursedBattlefield: { url: url(require('../../assets/models/battlefield.glb')), scale: 7, floorY: -0.39, drop: 0.04 },
};
export type StageName = keyof typeof STAGES;

function StageMesh({ name }: { name: StageName }) {
  const S = STAGES[name];
  const gltf = useLoader(GLTFLoader, S.url as any) as unknown as { scene: THREE.Group };
  const { scene, materials } = useMemo(() => {
    const scene = gltf.scene.clone();
    const materials: THREE.Material[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        // Lambert like the rest of the arena, so it sits in the same light.
        const std = m.material as THREE.MeshStandardMaterial;
        const lam = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap });
        m.material = lam; materials.push(lam);
      }
    });
    return { scene, materials };
  }, [gltf]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  // Floor just under the tiles, so its bumps don't poke through them.
  return <primitive object={scene} scale={[S.scale, S.scale, S.scale]} position={[0, -S.floorY * S.scale - S.drop, 0]} />;
}

/** The board's own slab, drawn while the stage loads or if it can't. */
function Slab({ theme }: { theme: BattleTheme }) {
  return (
    <mesh position={[0, -0.07, 0]}>
      <boxGeometry args={[GRID_COLS + 0.5, 0.14, GRID_ROWS + 0.5]} />
      <meshLambertMaterial color={theme.floor.far} />
    </mesh>
  );
}

class Fallback extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('Stage model failed, using the slab', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** The ground under the board: the location's stage model, or the plain slab. */
export function Stage({ theme }: { theme: BattleTheme }) {
  const slab = <Slab theme={theme} />;
  if (!theme.stage) return slab;
  return (
    <Fallback fallback={slab}>
      <React.Suspense fallback={slab}>
        <StageMesh name={theme.stage} />
      </React.Suspense>
    </Fallback>
  );
}
