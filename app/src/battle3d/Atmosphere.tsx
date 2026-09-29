import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from './r3f';
import { BattleTheme } from '../components/BattleBackdrop';

// Mood for the Meshy stages: a drifting cloud layer lit from below by a fire
// glow, low mist crawling over the ground, and brazier flames that light the
// stone around them. Textures are generated here (no image files), so it works
// the same on web and on a phone's GL.

function rng(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise with a few octaves, 0…1, on a w × h grid. */
function fbm(w: number, h: number, seed: number, octaves = 5): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(w * h);
  let amp = 1; let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cw = 4 << o; const ch = Math.max(2, (4 << o) >> 1);
    const grid = new Float32Array(cw * ch).map(() => r());
    const at = (x: number, y: number) => grid[((y % ch) + ch) % ch * cw + ((x % cw) + cw) % cw];
    for (let y = 0; y < h; y++) {
      const gy = (y / h) * ch; const y0 = Math.floor(gy); const fy = gy - y0; const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < w; x++) {
        const gx = (x / w) * cw; const x0 = Math.floor(gx); const fx = gx - x0; const sx = fx * fx * (3 - 2 * fx);
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        out[y * w + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function dataTexture(w: number, h: number, px: (x: number, y: number, i: number) => [number, number, number, number]) {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; const [r, g, b, a] = px(x, y, i);
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = a;
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** A soft round blob, for mist puffs and flame glows. */
let softDot: THREE.DataTexture | null = null;
export function softDotTexture() {
  if (softDot) return softDot;
  const n = 64;
  softDot = dataTexture(n, n, (x, y) => {
    const dx = (x + 0.5) / n - 0.5; const dy = (y + 0.5) / n - 0.5;
    const k = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
    return [255, 255, 255, Math.round(255 * k * k)];
  });
  softDot.wrapS = softDot.wrapT = THREE.ClampToEdgeWrapping;
  return softDot;
}

/**
 * Heavy clouds over the stage, thin near the horizon where a fire glow shows
 * through, slowly turning. Drawn just inside the sky dome.
 */
export function StormClouds({ theme }: { theme: BattleTheme }) {
  const tex = useMemo(() => {
    const w = 256; const h = 128;
    const n = fbm(w, h, 17);
    const lit = new THREE.Color(theme.glow.color); const dark = new THREE.Color(theme.sky[0]);
    const c = new THREE.Color();
    return dataTexture(w, h, (x, y, i) => {
      const v = y / (h - 1); // 0 at the horizon … 1 overhead
      const cover = Math.min(1, Math.max(0, (n[i] - 0.42) * 3.2));
      // Clouds low on the sky catch the fire glow; higher ones stay dark.
      c.copy(lit).lerp(dark, Math.min(1, v * 1.6 + (1 - cover) * 0.3));
      const a = cover * Math.min(1, v * 3) * 0.85;
      return [c.r * 255, c.g * 255, c.b * 255, a * 255];
    });
  }, [theme]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 0.004; });
  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[66, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} transparent fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** A band of fire glow along the horizon behind the ruins, as if the land beyond were burning. */
export function HorizonGlow({ theme }: { theme: BattleTheme }) {
  const tex = useMemo(() => dataTexture(4, 64, (_x, y) => {
    const v = y / 63; const a = Math.pow(1 - v, 2.2);
    return [255, 255, 255, Math.round(255 * a)];
  }), []);
  return (
    <mesh position={[0, 0, 0]} renderOrder={-1} frustumCulled={false}>
      <cylinderGeometry args={[60, 60, 22, 32, 1, true]} />
      <meshBasicMaterial map={tex} color={theme.glow.color} side={THREE.BackSide} transparent opacity={0.55} fog={false} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/** Low mist: a few big soft puffs lying on the ground, drifting sideways. */
export function GroundMist({ color = '#d2bcc6', count = 18, spread = 10 }: { color?: string; count?: number; spread?: number }) {
  const puffs = useMemo(() => {
    const r = rng(29);
    return Array.from({ length: count }, () => ({
      x: (r() - 0.5) * spread * 2, z: (r() - 0.5) * spread * 1.4, y: 0.12 + r() * 0.35,
      s: 3 + r() * 4, speed: 0.08 + r() * 0.14, op: 0.16 + r() * 0.14,
    }));
  }, [count, spread]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => {
    puffs.forEach((p, i) => {
      p.x += p.speed * dt;
      if (p.x > spread) p.x -= spread * 2;
      const m = refs.current[i]; if (m) m.position.x = p.x;
    });
  });
  const tex = softDotTexture();
  return (
    <>
      {puffs.map((p, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[p.x, p.y, p.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[p.s, p.s * 0.6]} />
          <meshBasicMaterial map={tex} color={color} transparent opacity={p.op} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** A flickering flame with its own light, set on top of a brazier. `at` is the flame's base in world units. */
export function Flame({ at, size = 0.5, color = '#ff9a3c', light = true }: { at: [number, number, number]; size?: number; color?: string; light?: boolean }) {
  const core = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Mesh>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const seed = useMemo(() => at[0] * 7.1 + at[2] * 3.3, [at]);
  useFrame((st) => {
    const t = st.clock.elapsedTime + seed;
    const f = 0.82 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 23.7) * 0.06 + Math.sin(t * 3.3) * 0.06;
    if (core.current) { core.current.scale.set(size * (0.9 + f * 0.1), size * 1.5 * f, 1); core.current.position.y = at[1] + size * 0.6 * f; }
    if (halo.current) halo.current.scale.setScalar(size * 4 * (0.85 + f * 0.15));
    if (lamp.current) lamp.current.intensity = 5.5 * f;
  });
  const tex = softDotTexture();
  return (
    <group>
      <sprite ref={core} position={at}>
        <spriteMaterial map={tex} color="#ffd27a" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <sprite ref={halo as any} position={[at[0], at[1] + size * 0.5, at[2]]}>
        <spriteMaterial map={tex} color={color} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {light ? <pointLight ref={lamp} position={[at[0], at[1] + size, at[2]]} color={color} intensity={5.5} distance={7} decay={1.6} /> : null}
    </group>
  );
}
