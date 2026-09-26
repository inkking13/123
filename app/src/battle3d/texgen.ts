import * as THREE from 'three';

// Procedural, tileable surface textures for the sheet-built models: wool,
// leather, linen wraps, skin and metal. Each is a greyscale detail map
// (hue comes from the mesh's vertex colours) plus a matching bump map, so
// the weave, cracks and scratches catch the light. Pure JS — no canvas —
// so it runs the same in the browser and in expo-gl.

export type Pattern = 'wool' | 'leather' | 'linen' | 'skin' | 'metal';

const SIZE = 128;

function hash(x: number, y: number, s: number) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Tileable value noise with `period` cells across the texture. */
function noise(u: number, v: number, period: number, s: number) {
  const x = u * period, y = v * period;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const w = (i: number) => ((i % period) + period) % period;
  const a = hash(w(x0), w(y0), s), b = hash(w(x0 + 1), w(y0), s);
  const c = hash(w(x0), w(y0 + 1), s), d = hash(w(x0 + 1), w(y0 + 1), s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(u: number, v: number, base: number, octaves: number, s: number) {
  let sum = 0, amp = 0.5, norm = 0, p = base;
  for (let o = 0; o < octaves; o++) { sum += noise(u, v, p, s + o) * amp; norm += amp; amp *= 0.5; p *= 2; }
  return sum / norm;
}

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Brightness (≈0.6–1, 1 = the vertex colour as is) and height 0..1 at (u, v). */
function sample(p: Pattern, u: number, v: number): [number, number] {
  switch (p) {
    case 'wool': {
      // Soft twill under blotchy wear: fine threads, felted patches, darker creases.
      const rib = 0.5 + 0.5 * Math.sin((u * 64 + v * 64) * Math.PI);
      const thread = noise(u, v, 96, 3);
      const felt = fbm(u, v, 8, 3, 5);
      const wear = fbm(u, v, 3, 4, 9);
      const crease = Math.abs(fbm(u, v, 4, 3, 13) - 0.5) * 2;
      const dark = crease < 0.08 ? (1 - crease / 0.08) * 0.12 : 0;
      const h = rib * 0.3 + thread * 0.4 + felt * 0.3;
      return [0.8 + rib * 0.04 + thread * 0.05 + (felt - 0.5) * 0.12 + (wear - 0.5) * 0.3 - dark, h];
    }
    case 'leather': {
      // Smooth-ish hide: soft grain, a few creases, scuffed lighter patches, a stitched seam.
      const grain = fbm(u, v, 24, 2, 21);
      const crease = Math.abs(fbm(u, v, 5, 3, 33) - 0.5) * 2;
      const crack = crease < 0.035 ? 1 - crease / 0.035 : 0;
      const stitch = Math.abs(v - 0.08) < 0.016 && (u * 24) % 1 < 0.55 ? 1 : 0;
      const scuff = fbm(u, v, 3, 3, 44);
      return [0.84 + (grain - 0.5) * 0.1 - crack * 0.14 - stitch * 0.3 + (scuff - 0.5) * 0.34, 0.5 + (grain - 0.5) * 0.3 - crack * 0.3 - stitch * 0.3];
    }
    case 'linen': {
      // Strips wound round the limb, overlapping at a slant.
      const t = (v * 5 + u * 1) % 1;
      const edge = t < 0.12 ? t / 0.12 : 1;
      const weave = 0.5 + 0.25 * Math.sin(u * 128 * Math.PI) + 0.25 * Math.sin(v * 128 * Math.PI);
      const dirt = fbm(u, v, 5, 3, 51);
      return [0.72 + edge * 0.22 + weave * 0.06 + (dirt - 0.5) * 0.3, edge * 0.7 + weave * 0.3];
    }
    case 'skin': {
      const pores = noise(u, v, 96, 61);
      const blotch = fbm(u, v, 5, 3, 67);
      return [0.92 + (blotch - 0.5) * 0.12 + (pores - 0.5) * 0.04, 0.5 + (pores - 0.5) * 0.3];
    }
    case 'metal': {
      // Brushed, pitted, scratched.
      const brush = noise(u * 0.1, v, 128, 71);
      const pit = fbm(u, v, 12, 3, 77);
      const sc = Math.abs(Math.sin((u * 7 + v * 13) * 9.1 + fbm(u, v, 3, 2, 79) * 12));
      const scratch = sc > 0.985 ? 1 : 0;
      return [0.8 + brush * 0.15 - (pit < 0.35 ? 0.2 : 0) + scratch * 0.3, 0.5 + brush * 0.2 - (pit < 0.35 ? 0.3 : 0)];
    }
  }
}

export interface SurfaceMaps { map: THREE.DataTexture; bump: THREE.DataTexture }

const cache = new Map<Pattern, SurfaceMaps>();

export function surface(p: Pattern): SurfaceMaps {
  const hit = cache.get(p);
  if (hit) return hit;
  const col = new Uint8Array(SIZE * SIZE * 4);
  const bmp = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [b, h] = sample(p, x / SIZE, y / SIZE);
      const i = (y * SIZE + x) * 4;
      const c = Math.round(clamp(b) * 255);
      col[i] = c; col[i + 1] = c; col[i + 2] = c; col[i + 3] = 255;
      const hh = Math.round(clamp(h) * 255);
      bmp[i] = hh; bmp[i + 1] = hh; bmp[i + 2] = hh; bmp[i + 3] = 255;
    }
  }
  const mk = (data: Uint8Array) => {
    const t = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  const out = { map: mk(col), bump: mk(bmp) };
  cache.set(p, out);
  return out;
}
