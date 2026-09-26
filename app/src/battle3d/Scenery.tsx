import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from './r3f';
import { BattleTheme } from '../components/BattleBackdrop';

// The location's skyline built from low-poly primitives, in three depth bands
// behind the arena, plus a gradient sky dome, sun/moon and ambient weather.

type Piece = {
  geo: THREE.BufferGeometry; pos: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number];
  color: string; emissive?: boolean; opacity?: number; spin?: boolean;
};

function rng(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE4 = new THREE.ConeGeometry(1, 1, 4);
const CONE5 = new THREE.ConeGeometry(1, 1, 5);
const CONE7 = new THREE.ConeGeometry(1, 1, 7);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const SPHERE = new THREE.SphereGeometry(1, 12, 8);
const PLANE = new THREE.PlaneGeometry(1, 1);

// Depth bands, far → near, matching the order of theme.layers.
const BANDS = [
  { z: -27, span: 42, tall: 11 },
  { z: -17, span: 30, tall: 6.5 },
  { z: -10.5, span: 20, tall: 3.2 },
];

function buildLayer(shape: string, color: string, accent: string | undefined, height: number, seed: number, band: { z: number; span: number; tall: number }): Piece[] {
  const r = rng(seed);
  const out: Piece[] = [];
  const H = band.tall * height;
  const z = band.z;
  const acc = accent ?? '#ffcf70';
  const along = (step: () => number, fn: (x: number) => void) => {
    for (let x = -band.span; x < band.span; x += step()) fn(x);
  };
  switch (shape) {
    case 'mountains':
    case 'snowpeaks':
      along(() => band.span * (0.14 + r() * 0.16), (x) => {
        const h = H * (0.5 + r() * 0.5); const w = h * (0.7 + r() * 0.4);
        const zz = z - r() * 4;
        out.push({ geo: CONE5, pos: [x, h / 2, zz], scale: [w, h, w * 0.7], rot: [0, r() * 3, 0], color });
        if (shape === 'snowpeaks') out.push({ geo: CONE5, pos: [x, h * 0.86, zz], scale: [w * 0.3, h * 0.28, w * 0.21], rot: [0, r() * 3, 0], color: accent ?? '#e6eef8' });
      });
      break;
    case 'hills':
      along(() => band.span * (0.2 + r() * 0.2), (x) => {
        const w = band.span * (0.18 + r() * 0.12);
        out.push({ geo: SPHERE, pos: [x, 0, z - r() * 3], scale: [w, H * (0.5 + r() * 0.5), w * 0.5], color });
      });
      break;
    case 'palisade':
      along(() => 0.34 + (r() < 0.1 ? 2.5 : 0), (x) => {
        const h = H * (0.8 + r() * 0.2);
        out.push({ geo: CYL, pos: [x, h / 2, z], scale: [0.14, h, 0.14], color });
        out.push({ geo: CONE5, pos: [x, h + 0.14, z], scale: [0.15, 0.3, 0.15], color });
      });
      break;
    case 'tents':
      along(() => band.span * (0.1 + r() * 0.14), (x) => {
        const h = H * (0.7 + r() * 0.5); const zz = z - r() * 3;
        out.push({ geo: CONE4, pos: [x, h / 2, zz], scale: [h * 0.8, h, h * 0.8], rot: [0, Math.PI / 4, 0], color });
        if (r() < 0.45) out.push({ geo: CONE5, pos: [x + h, 0.3, zz + 1], scale: [0.25, 0.6, 0.25], color: acc, emissive: true });
      });
      break;
    case 'deadtrees':
      along(() => band.span * (0.07 + r() * 0.12), (x) => {
        const h = H * (0.7 + r() * 0.5); const zz = z - r() * 3;
        out.push({ geo: CYL, pos: [x, h / 2, zz], scale: [0.08, h, 0.08], color });
        for (let i = 0; i < 3; i++) {
          const y = h * (0.45 + i * 0.17); const dir = r() < 0.5 ? -1 : 1; const len = h * (0.25 + r() * 0.15);
          out.push({ geo: CYL, pos: [x + dir * len * 0.35, y + len * 0.3, zz], rot: [0, 0, -dir * 0.9], scale: [0.04, len, 0.04], color });
        }
      });
      break;
    case 'spire': {
      const x = (r() - 0.5) * band.span * 0.4;
      const w = H * 0.18;
      out.push({ geo: BOX, pos: [x, H * 0.25, z], scale: [w, H * 0.5, w], color });
      out.push({ geo: CONE4, pos: [x, H * 0.72, z], scale: [w * 0.75, H * 0.45, w * 0.75], rot: [0, Math.PI / 4, 0], color });
      out.push({ geo: BOX, pos: [x - w * 1.6, H * 0.14, z + 0.5], scale: [w * 2, H * 0.28, w * 0.5], color });
      out.push({ geo: BOX, pos: [x + w * 1.5, H * 0.1, z + 0.5], scale: [w * 1.6, H * 0.2, w * 0.5], rot: [0, 0, 0.12], color });
      out.push({ geo: BOX, pos: [x, H * 0.36, z + w / 2 + 0.02], scale: [w * 0.18, H * 0.08, 0.02], color: acc, emissive: true });
      break;
    }
    case 'farm': {
      const mx = -band.span * (0.2 + r() * 0.2);
      const mh = H * 0.85;
      out.push({ geo: CYL, pos: [mx, mh / 2, z], scale: [0.45, mh, 0.45], color });
      out.push({ geo: CONE7, pos: [mx, mh + 0.35, z], scale: [0.6, 0.7, 0.6], color });
      for (let i = 0; i < 4; i++) {
        out.push({ geo: BOX, pos: [mx, mh, z + 0.6], rot: [0, 0, i * Math.PI / 2 + 0.3], scale: [0.18, mh * 0.55, 0.05], color, spin: true });
      }
      along(() => band.span * (0.12 + r() * 0.14), (x) => {
        if (Math.abs(x - mx) < 3) return;
        const w = 1.5 + r() * 1.5; const h = H * (0.25 + r() * 0.2); const tower = r() < 0.2;
        const hh = tower ? h * 2.2 : h; const zz = z - r() * 3;
        out.push({ geo: BOX, pos: [x, hh / 2, zz], scale: [tower ? w * 0.6 : w, hh, w * 0.8], color });
        out.push({ geo: CONE4, pos: [x, hh + w * 0.3, zz], scale: [(tower ? w * 0.6 : w) * 0.75, w * 0.6, w * 0.6], rot: [0, Math.PI / 4, 0], color });
        if (r() < 0.5) out.push({ geo: BOX, pos: [x, hh * 0.55, zz + w * 0.41], scale: [0.25, 0.3, 0.02], color: acc, emissive: true });
      });
      break;
    }
    case 'city':
      along(() => 1 + r() * 1.6, (x) => {
        const w = 1 + r() * 1.5; const h = H * (0.3 + r() * 0.7); const zz = z - r() * 4;
        out.push({ geo: BOX, pos: [x, h / 2, zz], scale: [w, h, w], color });
        if (r() < 0.45) out.push({ geo: CONE4, pos: [x, h + w * 0.35, zz], scale: [w * 0.72, w * 0.7, w * 0.72], rot: [0, Math.PI / 4, 0], color });
        for (let i = 0; i < 3; i++) if (r() < 0.45) {
          out.push({ geo: BOX, pos: [x + (r() - 0.5) * w * 0.6, h * (0.2 + r() * 0.7), zz + w / 2 + 0.02], scale: [0.18, 0.24, 0.02], color: acc, emissive: true });
        }
      });
      break;
    case 'fort': {
      const wallH = H * 0.45; const half = band.span * 0.55;
      out.push({ geo: BOX, pos: [0, wallH / 2, z], scale: [half * 2, wallH, 1], color });
      for (let x = -half; x <= half; x += 0.9) out.push({ geo: BOX, pos: [x, wallH + 0.25, z], scale: [0.45, 0.5, 1], color });
      for (const tx of [-0.7, 0, 0.7]) {
        const x = tx * half; const th = H * (0.85 + r() * 0.15);
        out.push({ geo: CYL, pos: [x, th / 2, z + 0.3], scale: [1.1, th, 1.1], color });
        out.push({ geo: CONE7, pos: [x, th + 0.8, z + 0.3], scale: [1.35, 1.6, 1.35], color });
        out.push({ geo: PLANE, pos: [x + 0.9, th * 0.72, z + 1.45], scale: [0.7, th * 0.35, 1], color: acc });
      }
      break;
    }
    case 'graves':
      along(() => 0.9 + r() * 1.8, (x) => {
        const h = H * (0.5 + r() * 0.5); const zz = z + r() * 2;
        out.push({ geo: BOX, pos: [x, h / 2, zz], scale: [0.1, h, 0.1], rot: [0, 0, (r() - 0.5) * 0.3], color });
        out.push({ geo: BOX, pos: [x, h * 0.72, zz], scale: [0.42, 0.1, 0.1], color });
      });
      break;
    case 'volcano': {
      const x = band.span * (0.05 + r() * 0.2); const h = H * 1.1; const w = h * 1.5;
      out.push({ geo: CONE7, pos: [x, h / 2, z - 4], scale: [w, h, w * 0.7], color });
      out.push({ geo: CYL, pos: [x, h * 0.96, z - 4], scale: [w * 0.1, h * 0.06, w * 0.07], color: acc, emissive: true });
      for (let i = 0; i < 4; i++) {
        const dx = (r() - 0.5) * w * 0.35; const len = h * (0.3 + r() * 0.3);
        out.push({ geo: BOX, pos: [x + dx, h * 0.92 - len / 2, z - 4 + w * 0.2], rot: [0.5, 0, -dx / w], scale: [0.25, len, 0.2], color: acc, emissive: true });
      }
      break;
    }
    case 'cliffs':
      along(() => 1.8 + r() * 2.4, (x) => {
        const h = H * (0.4 + r() * 0.6); const w = 1.6 + r() * 2.2;
        out.push({ geo: BOX, pos: [x, h / 2, z - r() * 3], rot: [0, r() * 0.6, (r() - 0.5) * 0.25], scale: [w, h, w * 0.8], color });
      });
      break;
    case 'towers':
      along(() => 1.4 + r() * 2.6, (x) => {
        const w = 0.7 + r() * 0.9; const h = H * (0.4 + r() * 0.6); const zz = z - r() * 4;
        out.push({ geo: BOX, pos: [x, h / 2, zz], scale: [w, h, w], color });
        out.push({ geo: CONE4, pos: [x, h + w * 1.1, zz], scale: [w * 0.72, w * 2.2, w * 0.72], rot: [0, Math.PI / 4, 0], color });
        for (let y = h * 0.2; y < h * 0.95; y += 1.1) if (r() < 0.35) out.push({ geo: BOX, pos: [x, y, zz + w / 2 + 0.02], scale: [0.14, 0.35, 0.02], color: acc, emissive: true });
      });
      break;
    case 'arches': {
      const half = band.span * 0.6; const h = H;
      out.push({ geo: BOX, pos: [0, h * 0.92, z], scale: [half * 2, h * 0.16, 1], color });
      for (let x = -half; x <= half; x += 2.4) {
        out.push({ geo: BOX, pos: [x, h * 0.42, z], scale: [0.6, h * 0.84, 1], color });
        out.push({ geo: CONE5, pos: [x + 1.2, h * 0.5, z + 0.6], scale: [0.14, 0.4, 0.14], color: acc, emissive: true });
      }
      break;
    }
  }
  return out;
}

function Pieces({ pieces }: { pieces: Piece[] }) {
  const spinners = useRef<THREE.Mesh[]>([]);
  useFrame((_, dt) => { for (const m of spinners.current) m.rotation.z += dt * 0.5; });
  return (
    <>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          ref={p.spin ? (m) => { if (m && !spinners.current.includes(m)) spinners.current.push(m); } : undefined}
          geometry={p.geo}
          position={p.pos}
          rotation={p.rot ?? [0, 0, 0]}
          scale={p.scale ?? [1, 1, 1]}
        >
          {p.emissive
            ? <meshBasicMaterial color={p.color} toneMapped={false} />
            : <meshLambertMaterial color={p.color} side={p.geo === PLANE ? THREE.DoubleSide : THREE.FrontSide} />}
        </mesh>
      ))}
    </>
  );
}

function SkyDome({ theme }: { theme: BattleTheme }) {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(70, 24, 16);
    const top = new THREE.Color(theme.sky[0]); const mid = new THREE.Color(theme.sky[1]); const low = new THREE.Color(theme.sky[2]);
    const cols: number[] = [];
    const pos = g.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / 70; // −1 … 1
      if (t > 0.35) c.copy(mid).lerp(top, Math.min(1, (t - 0.35) / 0.65));
      else if (t > 0) c.copy(low).lerp(mid, t / 0.35);
      else c.copy(low);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, [theme]);
  return (
    <mesh geometry={geo} renderOrder={-1} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Sun or moon on the dome, placed from the 2D theme's glow position. */
export function sunDirection(theme: BattleTheme) {
  const az = (theme.glow.x - 0.5) * 1.4;
  const el = 0.08 + (1 - theme.glow.y) * 0.45;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

function Sun({ theme }: { theme: BattleTheme }) {
  const d = sunDirection(theme).multiplyScalar(60);
  const small = theme.glow.r < 0.1;
  return (
    <group position={d.toArray() as [number, number, number]}>
      <mesh>
        <sphereGeometry args={[small ? 2.4 : 5, 16, 12]} />
        <meshBasicMaterial color={theme.glow.color} fog={false} transparent opacity={small ? 1 : 0.55} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[small ? 6 : 14, 16, 12]} />
        <meshBasicMaterial color={theme.glow.color} fog={false} transparent opacity={theme.glow.opacity * 0.35} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

const WEATHER: Record<string, { count: number; color: string; size: number; opacity: number }> = {
  snow: { count: 180, color: '#f2f8ff', size: 0.07, opacity: 0.9 },
  embers: { count: 110, color: '#ffab4a', size: 0.07, opacity: 0.95 },
  rain: { count: 260, color: '#b9cfdc', size: 0.035, opacity: 0.55 },
  dust: { count: 90, color: '#ffe2c0', size: 0.045, opacity: 0.6 },
  gold: { count: 100, color: '#ffe29a', size: 0.06, opacity: 0.9 },
  wisps: { count: 50, color: '#aee3ee', size: 0.14, opacity: 0.45 },
  fog: { count: 40, color: '#a79ed6', size: 0.9, opacity: 0.08 },
};

function Weather({ kind }: { kind: string }) {
  const cfg = WEATHER[kind] ?? WEATHER.dust;
  const { geo, speed } = useMemo(() => {
    const r = rng(5);
    const pos = new Float32Array(cfg.count * 3);
    const sp = new Float32Array(cfg.count);
    for (let i = 0; i < cfg.count; i++) {
      pos[i * 3] = (r() - 0.5) * 16;
      pos[i * 3 + 1] = r() * 7;
      pos[i * 3 + 2] = -9 + r() * 15;
      sp[i] = 0.6 + r() * 0.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, speed: sp };
  }, [cfg]);
  useFrame((state, dt) => {
    const a = geo.attributes.position as THREE.BufferAttribute;
    const p = a.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < cfg.count; i++) {
      const s = speed[i];
      const k = i * 3;
      switch (kind) {
        case 'snow': p[k + 1] -= dt * 0.7 * s; p[k] += Math.sin(t * s + i) * dt * 0.25; break;
        case 'rain': p[k + 1] -= dt * 9 * s; p[k] -= dt * 1.2; break;
        case 'embers': p[k + 1] += dt * 0.8 * s; p[k] += Math.sin(t * 2 * s + i) * dt * 0.3; break;
        case 'wisps': p[k + 1] += dt * 0.25 * s; p[k] += Math.sin(t * s + i) * dt * 0.2; break;
        case 'fog': p[k] += dt * 0.3 * s; break;
        default: p[k] += dt * 0.25 * s; p[k + 1] += Math.sin(t * s + i) * dt * 0.05; break;
      }
      if (p[k + 1] < 0) p[k + 1] += 7;
      if (p[k + 1] > 7) p[k + 1] -= 7;
      if (p[k] > 8) p[k] -= 16;
      if (p[k] < -8) p[k] += 16;
    }
    a.needsUpdate = true;
  });
  return (
    <points geometry={geo}>
      <pointsMaterial color={cfg.color} size={cfg.size} transparent opacity={cfg.opacity} depthWrite={false} sizeAttenuation />
    </points>
  );
}

export function Scenery({ theme }: { theme: BattleTheme }) {
  const pieces = useMemo(() => {
    const bands = theme.layers.length === 1 ? [BANDS[1]] : theme.layers.length === 2 ? [BANDS[0], BANDS[1]] : BANDS;
    return theme.layers.flatMap((l, i) => buildLayer(l.shape, l.color, l.accent, l.height, l.seed, bands[i]));
  }, [theme]);
  return (
    <>
      <SkyDome theme={theme} />
      <Sun theme={theme} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -10]}>
        <planeGeometry args={[140, 90]} />
        <meshLambertMaterial color={theme.ground[0]} />
      </mesh>
      <Pieces pieces={pieces} />
      <Weather kind={theme.particles} />
    </>
  );
}
