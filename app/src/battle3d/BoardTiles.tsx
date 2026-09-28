import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from './r3f';
import { TILE_SIZE, colX, rowZ } from './world';
import { BattleTheme } from '../components/BattleBackdrop';

// The battle grid's cells: a thin rounded frame with brighter corner brackets
// and a soft glow on its inner edge, over a fill that is empty on a plain cell
// and lights up for moves, danger and enemies. Both are white alpha maps made
// in plain JS (no canvas, so expo-gl gets the same) and tinted per state.

export type TileState = 'plain' | 'reachable' | 'self' | 'danger' | 'lava' | 'foe';

const SIZE = 128;
/** Half the frame's side and its corner radius, in texture units (the tile is 1 across). */
const HALF = 0.46, RADIUS = 0.1;

/** Signed distance to the rounded square: negative inside. */
function sdf(u: number, v: number) {
  const qx = Math.abs(u - 0.5) - HALF + RADIUS, qy = Math.abs(v - 0.5) - HALF + RADIUS;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - RADIUS;
}

function alphaMap(alpha: (u: number, v: number) => number) {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const a = Math.max(0, Math.min(1, alpha((x + 0.5) / SIZE, (y + 0.5) / SIZE)));
    const i = (y * SIZE + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
  }
  const t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

let maps: { frame: THREE.DataTexture; fill: THREE.DataTexture } | null = null;
function tileMaps() {
  if (maps) return maps;
  const frame = alphaMap((u, v) => {
    const d = sdf(u, v);
    const line = Math.exp(-((d / 0.012) ** 2));
    const inner = d < 0 ? 0.35 * Math.exp(d / 0.05) : 0;
    // Brackets: the frame is brighter and thicker near its corners, fainter mid-edge.
    const cx = Math.abs(u - 0.5), cy = Math.abs(v - 0.5);
    const corner = Math.min(1, Math.max(0, (Math.min(cx, cy) - 0.22) / 0.1));
    const bracket = Math.exp(-((d / 0.022) ** 2)) * corner;
    return (0.55 + 0.45 * corner) * line + bracket * 0.8 + inner;
  });
  const fill = alphaMap((u, v) => {
    const d = sdf(u, v);
    if (d > 0) return Math.exp(-d / 0.008) * 0.8;
    // Brighter towards the rim, a faint wash in the middle.
    return 0.3 + 0.7 * Math.exp(d / 0.09);
  });
  maps = { frame, fill };
  return maps;
}

/** Colour of the frame, the frame's and the fill's strength, and how fast it pulses. */
const LOOK: Record<Exclude<TileState, 'plain'>, { color: string; frame: number; fill: number; pulse: number }> = {
  reachable: { color: '#b4a8ff', frame: 0.95, fill: 0.3, pulse: 3 },
  self: { color: '#ece8ff', frame: 1, fill: 0.42, pulse: 2 },
  danger: { color: '#ff5646', frame: 1, fill: 0.5, pulse: 7 },
  lava: { color: '#ff8a2a', frame: 0.9, fill: 0.65, pulse: 3 },
  foe: { color: '#d8434e', frame: 0.7, fill: 0.2, pulse: 0 },
};

/** The theme's grid stroke colour, without its alpha. */
function strokeColor(theme: BattleTheme) {
  const m = theme.floor.stroke.match(/rgba?\(([^)]+)\)/);
  if (!m) return new THREE.Color(theme.floor.stroke);
  const [r, g, b] = m[1].split(',').map((x) => parseFloat(x) / 255);
  return new THREE.Color(r, g, b);
}

export function Tile({ row, col, state, activeColor, theme }: { row: number; col: number; state: TileState; activeColor: string | null; theme: BattleTheme }) {
  const { frame, fill } = tileMaps();
  const frameMat = useRef<THREE.MeshBasicMaterial>(null);
  const fillMat = useRef<THREE.MeshBasicMaterial>(null);
  const plain = useMemo(() => strokeColor(theme).lerp(new THREE.Color('#ffffff'), 0.25), [theme]);
  const want = useMemo(() => new THREE.Color(), []);
  // A faint checker so rows and columns read at a glance.
  const plainFrame = (row + col) % 2 ? 0.3 : 0.38;
  useFrame((st, dt) => {
    const fm = frameMat.current, im = fillMat.current; if (!fm || !im) return;
    const t = st.clock.elapsedTime;
    let a: number, b: number;
    if (state === 'plain' && activeColor) {
      want.set(activeColor);
      const p = 0.5 + 0.5 * Math.sin(t * 4);
      a = 0.75 + 0.25 * p; b = 0.18 + 0.12 * p;
    } else if (state === 'plain') {
      want.copy(plain); a = plainFrame; b = 0;
    } else {
      const L = LOOK[state];
      want.set(L.color);
      const p = L.pulse ? 0.5 + 0.5 * Math.sin(t * L.pulse + (row + col) * 0.5) : 1;
      a = L.frame * (0.75 + 0.25 * p); b = L.fill * (0.7 + 0.3 * p);
    }
    // Ease between states so cells fade in and out rather than blink.
    const k = 1 - Math.exp(-dt * 12);
    fm.color.lerp(want, k); im.color.lerp(want, k);
    fm.opacity += (a - fm.opacity) * k; im.opacity += (b - im.opacity) * k;
  });
  return (
    <group position={[colX(col), 0.012, rowZ(row)]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh renderOrder={1}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshBasicMaterial ref={fillMat} map={fill} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.002]} renderOrder={2}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshBasicMaterial ref={frameMat} map={frame} transparent opacity={plainFrame} color={plain} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
