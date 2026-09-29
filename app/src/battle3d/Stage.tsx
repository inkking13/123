import React, { Component, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useLoader } from './r3f';
import { modelMaterial } from './materials';
import { BattleTheme } from '../components/BattleBackdrop';
import { GRID_COLS, GRID_ROWS } from '../combat/types';
import { TILE } from './world';
import { Flame } from './Atmosphere';

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
  /** A burning brazier: its flame (and light) sits this high above the ground, metres. */
  flame?: number;
  /** Ground clutter, left out on phones to spare their GPU. */
  clutter?: boolean;
}

// Meshy decor, each file ~1.9 units across with its centre at the origin.
const decor = (mod: number, scale: number, floorY: number) => (at: [number, number], turn = 0, flame?: number): Piece => ({ url: url(mod), scale, floorY, at, turn, flame });
const clutter = (make: ReturnType<typeof decor>) => (at: [number, number], turn = 0): Piece => ({ ...make(at, turn), clutter: true });
const brazier = decor(require('../../assets/models/decor-brazier.glb'), 0.54, -0.81);
const bones = decor(require('../../assets/models/decor-bones.glb'), 0.5, -0.45);
const weapons = decor(require('../../assets/models/decor-weapons.glb'), 0.46, -0.46);
const pillar = decor(require('../../assets/models/decor-pillar.glb'), 0.8, -0.82);
const grave = decor(require('../../assets/models/decor-grave.glb'), 0.42, -0.95);
const banner = decor(require('../../assets/models/decor-banner.glb'), 0.98, -0.89);

/**
 * Phones get a lighter copy of the keep (55k triangles and 2048px textures instead of 369k and 4096px):
 * the full one needs ~85 MB of video memory for one texture, more than a budget phone's GPU can give
 * (on a Redmi 15C the fight drew nothing). In dev, ?mobile3d on the web previews it.
 */
const LIGHT_STAGE = Platform.OS !== 'web' || (__DEV__ && typeof location !== 'undefined' && location.search.includes('mobile3d'));

const STAGES: Record<string, { pieces: Piece[]; slab: boolean }> = {
  // Ruined keep: stone floor ringed by broken walls, an arch and banner towers behind the enemy rows.
  // The export is 1.9 units across with its floor at y = -0.39; scaled so the floor holds the board.
  cursedBattlefield: {
    slab: false,
    pieces: [
      { url: url(LIGHT_STAGE ? require('../../assets/models/battlefield-mobile.glb') : require('../../assets/models/battlefield.glb')), scale: 7, floorY: -0.39, drop: 0.04 },
      // Four braziers light the board's corners; bones, broken arms and a grave fill the ground round it.
      brazier([-4.3, 2.6], 0, 0.9), brazier([4.3, 2.6], 1, 0.9), brazier([-4.3, -2.3], 2, 0.9), brazier([4.3, -2.3], 3, 0.9),
      clutter(bones)([-2.6, 4.0], 0.6), clutter(weapons)([2.3, 4.1], -0.4), clutter(bones)([4.6, 0.3], 2.2), clutter(weapons)([-4.7, 0.2], 1.3),
      clutter(grave)([-3.7, 4.7], 0.2), clutter(pillar)([-4.6, 3.6], 0.5), clutter(pillar)([4.7, 4.4], 2.1), clutter(grave)([4.4, -0.9], -0.6),
      banner([-4.9, -3.6], 0.3), banner([4.9, -3.6], -0.3),
    ],
  },
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
        const lam = modelMaterial(m.material as THREE.Material, 'stone');
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
  const [x, z] = piece.at ?? [0, 0];
  return (
    <>
      <Fallback fallback={null}>
        <React.Suspense fallback={null}>
          <PieceMesh piece={piece} />
        </React.Suspense>
      </Fallback>
      {piece.flame != null ? <Flame at={[x * TILE, piece.flame, z * TILE]} size={0.45} /> : null}
    </>
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
      {S.pieces.filter((p) => p !== floor && !(LIGHT_STAGE && p.clutter)).map((p, i) => <Piece key={i} piece={p} />)}
    </>
  );
}
