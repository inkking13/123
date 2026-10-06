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

/** A basic material whose per-instance `instanceOpacity` scales its alpha, so one instanced draw can fade cells separately. */
function instancedFadeMaterial(map: THREE.Texture) {
  const m = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'attribute float instanceOpacity;\nvarying float vInstOpacity;\nvoid main() {\n\tvInstOpacity = instanceOpacity;');
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'varying float vInstOpacity;\nvoid main() {')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vInstOpacity );');
  };
  return m;
}

/**
 * Every cell of the board in two draw calls (fills, then frames) instead of two
 * meshes and a frame callback per cell: the cells' colours and strengths live in
 * per-instance attributes that one callback eases towards each cell's state.
 */
export function TileGrid({ rows, cols, states, active, theme }: {
  rows: number; cols: number;
  /** Row-major state of every cell. */
  states: TileState[];
  /** The acting raider's cell, pulsing in their role colour (outside the move phase). */
  active: { row: number; col: number; color: string } | null;
  theme: BattleTheme;
}) {
  const { frame, fill } = tileMaps();
  const n = rows * cols;
  const fillRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const latest = useRef({ states, active });
  latest.current = { states, active };
  const plain = useMemo(() => strokeColor(theme).lerp(new THREE.Color('#ffffff'), 0.25), [theme]);
  const parts = useMemo(() => {
    const geo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const fillOp = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    const frameOp = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    const fillGeo = geo.clone(); fillGeo.setAttribute('instanceOpacity', fillOp);
    const frameGeo = geo.clone(); frameGeo.setAttribute('instanceOpacity', frameOp);
    geo.dispose();
    // Each cell's current colour (shared by its fill and frame) and strengths, eased every frame.
    const colors = Array.from({ length: n }, () => new THREE.Color());
    const a = new Float32Array(n), b = new Float32Array(n);
    return { fillGeo, frameGeo, fillOp, frameOp, fillMat: instancedFadeMaterial(fill), frameMat: instancedFadeMaterial(frame), colors, a, b };
  }, [n, fill, frame]);
  const want = useMemo(() => new THREE.Color(), []);

  // Place the cells once (and start every cell at its plain look).
  React.useLayoutEffect(() => {
    const fm = fillRef.current, rm = frameRef.current; if (!fm || !rm) return;
    const o = new THREE.Object3D();
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.position.set(colX(col), 0.012, rowZ(row)); o.updateMatrix(); fm.setMatrixAt(i, o.matrix);
      o.position.y = 0.014; o.updateMatrix(); rm.setMatrixAt(i, o.matrix);
      parts.colors[i].copy(plain); parts.a[i] = (row + col) % 2 ? 0.3 : 0.38; parts.b[i] = 0;
      fm.setColorAt(i, plain); rm.setColorAt(i, plain);
    }
    fm.instanceMatrix.needsUpdate = rm.instanceMatrix.needsUpdate = true;
    fm.computeBoundingSphere(); rm.computeBoundingSphere();
  }, [parts, rows, cols, plain]);

  useFrame((st, dt) => {
    const fm = fillRef.current, rm = frameRef.current; if (!fm || !rm || !fm.instanceColor || !rm.instanceColor) return;
    const t = st.clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 12);
    const { states: cur, active: act } = latest.current;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const state = cur[i] ?? 'plain';
      let a: number, b: number;
      if (state === 'plain' && act && act.row === row && act.col === col) {
        want.set(act.color);
        const p = 0.5 + 0.5 * Math.sin(t * 4);
        a = 0.75 + 0.25 * p; b = 0.18 + 0.12 * p;
      } else if (state === 'plain') {
        want.copy(plain); a = (row + col) % 2 ? 0.3 : 0.38; b = 0;
      } else {
        const L = LOOK[state];
        want.set(L.color);
        const p = L.pulse ? 0.5 + 0.5 * Math.sin(t * L.pulse + (row + col) * 0.5) : 1;
        a = L.frame * (0.75 + 0.25 * p); b = L.fill * (0.7 + 0.3 * p);
      }
      // Ease between states so cells fade in and out rather than blink.
      const c = parts.colors[i].lerp(want, k);
      parts.a[i] += (a - parts.a[i]) * k; parts.b[i] += (b - parts.b[i]) * k;
      fm.setColorAt(i, c); rm.setColorAt(i, c);
      parts.frameOp.setX(i, parts.a[i]); parts.fillOp.setX(i, parts.b[i]);
    }
    fm.instanceColor.needsUpdate = rm.instanceColor.needsUpdate = true;
    parts.fillOp.needsUpdate = parts.frameOp.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={fillRef} args={[parts.fillGeo, parts.fillMat, n]} renderOrder={1} frustumCulled={false} />
      <instancedMesh ref={frameRef} args={[parts.frameGeo, parts.frameMat, n]} renderOrder={2} frustumCulled={false} />
    </>
  );
}
