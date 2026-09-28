import React, { Component, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useLoader } from './r3f';
import { BattleTheme } from '../components/BattleBackdrop';
import { GRID_COLS, GRID_ROWS } from '../combat/types';
import { TILE } from './world';

// Meshy-made scenery around the board. A stage is one or more static
// textured meshes, simplified with 1-2K textures. Sizes and places are in
// tiles, so the scenery grows with the board.

const url = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));

interface Piece {
  url: string;
  /** Tiles per file unit. */
  scale: number;
  /** The file's floor height, in file units; it is put on the ground. */
  floorY: number;
  /** Where it stands, in tiles (x, z), and its turn about Y. */
  at?: [number, number];
  turn?: number;
  /** Sunk this far below the ground, metres. */
  drop?: number;
}

const STAGES: Record<string, { pieces: Piece[]; slab: boolean }> = {
  // Ruined keep: stone floor ringed by broken walls, an arch and banner towers behind the enemy rows.
  // The export is 1.9 units across with its floor at y = -0.39; scaled so the floor holds the board.
  cursedBattlefield: { slab: false, pieces: [{ url: url(require('../../assets/models/battlefield.glb')), scale: 7, floorY: -0.39, drop: 0.04 }] },
};
export type StageName = keyof typeof STAGES;

function PieceMesh({ piece: S }: { piece: Piece }) {
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
  const k = S.scale * TILE;
  const [x, z] = S.at ?? [0, 0];
  return <primitive object={scene} scale={[k, k, k]} rotation={[0, S.turn ?? 0, 0]} position={[x * TILE, -S.floorY * k - (S.drop ?? 0), z * TILE]} />;
}

function Piece({ piece }: { piece: Piece }) {
  return (
    <Fallback fallback={null}>
      <React.Suspense fallback={null}>
        <PieceMesh piece={piece} />
      </React.Suspense>
    </Fallback>
  );
}

/** The board's own slab, drawn while the stage loads or if it can't. */
function Slab({ theme }: { theme: BattleTheme }) {
  return (
    <mesh position={[0, -0.07, 0]}>
      <boxGeometry args={[(GRID_COLS + 0.5) * TILE, 0.14, (GRID_ROWS + 0.5) * TILE]} />
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

/** The ground under the board: the location's stage models, and the plain slab unless a stage has its own floor. */
export function Stage({ theme }: { theme: BattleTheme }) {
  const slab = <Slab theme={theme} />;
  const S = theme.stage && STAGES[theme.stage];
  if (!S) return slab;
  const floor = S.pieces.find((p) => !p.at);
  return (
    <>
      {S.slab ? slab : null}
      {floor ? (
        <Fallback fallback={slab}>
          <React.Suspense fallback={slab}>
            <PieceMesh piece={floor} />
          </React.Suspense>
        </Fallback>
      ) : null}
      {S.pieces.filter((p) => p !== floor).map((p, i) => <Piece key={i} piece={p} />)}
    </>
  );
}
