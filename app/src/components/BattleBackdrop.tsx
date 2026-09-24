import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

// Painted-silhouette backdrops for the 2.5D battlefield: a sky, a glow, a few
// parallax layers of scenery sitting on the horizon behind the enemy row, a
// fog band, ground on either side of the board and drifting ambient particles.
// Everything is procedural (seeded) so each location keeps the same skyline.

type Shape = 'mountains' | 'snowpeaks' | 'hills' | 'palisade' | 'tents' | 'deadtrees' | 'spire' | 'farm' | 'city' | 'fort' | 'graves' | 'volcano' | 'cliffs' | 'towers' | 'arches';
type Particles = 'dust' | 'snow' | 'embers' | 'rain' | 'fog' | 'wisps' | 'gold';

interface Layer { shape: Shape; color: string; height: number; seed: number; parallax: number; accent?: string }
export interface BattleTheme {
  sky: [string, string, string];
  glow: { x: number; y: number; r: number; color: string; opacity: number };
  layers: Layer[];
  fog: string;
  ground: [string, string];
  particles: Particles;
  /** Floor slab gradient (far → near) and the plain tile tint. */
  floor: { far: string; near: string; tile: string; stroke: string };
}

export const BATTLE_THEMES: Record<string, BattleTheme> = {
  outskirts: {
    sky: ['#2a1f3d', '#6b3f4f', '#c27a4e'],
    glow: { x: 0.72, y: 0.9, r: 0.22, color: '#ffb46b', opacity: 0.55 },
    layers: [
      { shape: 'hills', color: '#4a3246', height: 0.5, seed: 3, parallax: 0.15 },
      { shape: 'tents', color: '#2e2130', height: 0.4, seed: 7, parallax: 0.3, accent: '#ffb46b' },
      { shape: 'palisade', color: '#1d1620', height: 0.3, seed: 11, parallax: 0.45 },
    ],
    fog: 'rgba(210,150,110,0.25)', ground: ['#2b2126', '#17131a'], particles: 'dust',
    floor: { far: '#3a2e33', near: '#4a3b3c', tile: 'rgba(230,200,170,0.07)', stroke: 'rgba(240,210,170,0.22)' },
  },
  icefrontier: {
    sky: ['#0d1a33', '#27466e', '#8fb4d6'],
    glow: { x: 0.3, y: 0.35, r: 0.08, color: '#e8f4ff', opacity: 0.85 },
    layers: [
      { shape: 'snowpeaks', color: '#3c5a80', height: 0.85, seed: 5, parallax: 0.1, accent: '#dbe9f7' },
      { shape: 'snowpeaks', color: '#253c5c', height: 0.55, seed: 9, parallax: 0.25, accent: '#b9cde3' },
      { shape: 'deadtrees', color: '#15243a', height: 0.35, seed: 13, parallax: 0.45 },
    ],
    fog: 'rgba(200,225,250,0.3)', ground: ['#2a3a52', '#141d2b'], particles: 'snow',
    floor: { far: '#3b4d66', near: '#56708f', tile: 'rgba(220,235,255,0.10)', stroke: 'rgba(225,240,255,0.3)' },
  },
  ashlands: {
    sky: ['#1a0c0c', '#4a1c14', '#9c3f1f'],
    glow: { x: 0.5, y: 1, r: 0.35, color: '#ff6a2a', opacity: 0.45 },
    layers: [
      { shape: 'mountains', color: '#3a1812', height: 0.6, seed: 17, parallax: 0.12 },
      { shape: 'spire', color: '#241010', height: 0.8, seed: 19, parallax: 0.25, accent: '#ff7a3a' },
      { shape: 'deadtrees', color: '#140909', height: 0.4, seed: 23, parallax: 0.45 },
    ],
    fog: 'rgba(120,60,40,0.35)', ground: ['#2a1612', '#140b09'], particles: 'embers',
    floor: { far: '#33201b', near: '#46291f', tile: 'rgba(255,140,90,0.07)', stroke: 'rgba(255,150,100,0.22)' },
  },
  debtprovince: {
    sky: ['#1d2226', '#3d4a4a', '#7d8a7e'],
    glow: { x: 0.2, y: 0.5, r: 0.2, color: '#d9e0c8', opacity: 0.25 },
    layers: [
      { shape: 'hills', color: '#3a4540', height: 0.45, seed: 29, parallax: 0.12 },
      { shape: 'farm', color: '#252d2a', height: 0.7, seed: 31, parallax: 0.28, accent: '#e8c56a' },
      { shape: 'palisade', color: '#171c1a', height: 0.18, seed: 37, parallax: 0.45 },
    ],
    fog: 'rgba(170,185,170,0.3)', ground: ['#262d29', '#131715'], particles: 'rain',
    floor: { far: '#303833', near: '#414b44', tile: 'rgba(210,225,200,0.07)', stroke: 'rgba(210,225,200,0.2)' },
  },
  shadowguild: {
    sky: ['#07071a', '#1a1840', '#3b2f63'],
    glow: { x: 0.78, y: 0.3, r: 0.07, color: '#f3ecd0', opacity: 0.9 },
    layers: [
      { shape: 'city', color: '#1a1734', height: 0.75, seed: 41, parallax: 0.12, accent: '#e8b85a' },
      { shape: 'city', color: '#100e24', height: 0.5, seed: 43, parallax: 0.3, accent: '#f0c060' },
    ],
    fog: 'rgba(110,100,170,0.3)', ground: ['#18162b', '#0b0a16'], particles: 'fog',
    floor: { far: '#221f38', near: '#2e2a4a', tile: 'rgba(180,170,255,0.07)', stroke: 'rgba(190,180,255,0.22)' },
  },
  forgottenlegion: {
    sky: ['#14141a', '#33323d', '#6a6570'],
    glow: { x: 0.4, y: 0.6, r: 0.25, color: '#b8c4d8', opacity: 0.2 },
    layers: [
      { shape: 'mountains', color: '#35343f', height: 0.5, seed: 47, parallax: 0.1 },
      { shape: 'fort', color: '#22212a', height: 0.6, seed: 53, parallax: 0.25, accent: '#8a2b2b' },
      { shape: 'graves', color: '#15141a', height: 0.2, seed: 59, parallax: 0.45 },
    ],
    fog: 'rgba(160,165,185,0.35)', ground: ['#23222a', '#111015'], particles: 'wisps',
    floor: { far: '#2c2b33', near: '#3b3a44', tile: 'rgba(210,210,230,0.07)', stroke: 'rgba(210,210,230,0.2)' },
  },
  dragonwastes: {
    sky: ['#1b0a08', '#5a1a0e', '#c2521c'],
    glow: { x: 0.62, y: 0.55, r: 0.3, color: '#ff8a2a', opacity: 0.5 },
    layers: [
      { shape: 'volcano', color: '#2f130d', height: 0.95, seed: 61, parallax: 0.1, accent: '#ff7a2a' },
      { shape: 'cliffs', color: '#1f0d09', height: 0.5, seed: 67, parallax: 0.3 },
    ],
    fog: 'rgba(170,70,30,0.3)', ground: ['#2b120c', '#150907'], particles: 'embers',
    floor: { far: '#3a1d14', near: '#4d261a', tile: 'rgba(255,150,80,0.08)', stroke: 'rgba(255,160,90,0.25)' },
  },
  hierarchy: {
    sky: ['#140d24', '#3b2553', '#a0764a'],
    glow: { x: 0.5, y: 0.75, r: 0.3, color: '#ffd27a', opacity: 0.4 },
    layers: [
      { shape: 'towers', color: '#2b1f3f', height: 0.95, seed: 71, parallax: 0.1, accent: '#ffd27a' },
      { shape: 'towers', color: '#1a1228', height: 0.6, seed: 73, parallax: 0.28, accent: '#ffcf70' },
    ],
    fog: 'rgba(200,160,110,0.28)', ground: ['#231a30', '#110c18'], particles: 'gold',
    floor: { far: '#2e2440', near: '#3e3152', tile: 'rgba(255,220,150,0.07)', stroke: 'rgba(255,220,150,0.24)' },
  },
  arena: {
    sky: ['#140f14', '#3a2626', '#6e4a36'],
    glow: { x: 0.5, y: 0.8, r: 0.35, color: '#ffae5a', opacity: 0.35 },
    layers: [
      { shape: 'arches', color: '#2c1f1c', height: 0.8, seed: 79, parallax: 0.15, accent: '#ffae5a' },
    ],
    fog: 'rgba(200,140,90,0.25)', ground: ['#2a1f1a', '#140f0c'], particles: 'dust',
    floor: { far: '#3a2c24', near: '#4c3a2e', tile: 'rgba(240,200,150,0.08)', stroke: 'rgba(240,200,150,0.24)' },
  },
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

const f = (n: number) => n.toFixed(1);

/** Builds one scenery layer as a filled path plus optional accent path (snow caps, lit windows, lava…). */
function buildLayer(l: Layer, w: number, base: number, sky: number): { body: string; accent?: string; accentStroke?: boolean } {
  const r = rng(l.seed);
  const h = sky * l.height;
  const x0 = -w * 0.3; const x1 = w * 1.3; // overscan for parallax
  switch (l.shape) {
    case 'mountains':
    case 'snowpeaks': {
      let d = `M${f(x0)},${f(base)}`; let caps = '';
      let x = x0;
      while (x < x1) {
        const pw = w * (0.12 + r() * 0.16); const ph = h * (0.45 + r() * 0.55);
        const px = x + pw / 2;
        d += ` L${f(px)},${f(base - ph)} L${f(x + pw)},${f(base - ph * (0.15 + r() * 0.3))}`;
        if (l.shape === 'snowpeaks') {
          const cw = pw * 0.18; const ch = ph * 0.22;
          caps += `M${f(px - cw)},${f(base - ph + ch)} L${f(px)},${f(base - ph)} L${f(px + cw)},${f(base - ph + ch)} L${f(px + cw * 0.3)},${f(base - ph + ch * 0.7)} Z `;
        }
        x += pw;
      }
      return { body: d + ` L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z`, accent: caps || undefined };
    }
    case 'hills': {
      let d = `M${f(x0)},${f(base)}`; let x = x0;
      while (x < x1) {
        const hw = w * (0.2 + r() * 0.2); const hh = h * (0.4 + r() * 0.6);
        d += ` Q${f(x + hw / 2)},${f(base - hh * 2)} ${f(x + hw)},${f(base - hh * 0.2)}`;
        x += hw;
      }
      return { body: d + ` L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z` };
    }
    case 'palisade': {
      let d = ''; let x = x0;
      while (x < x1) {
        const sw = 5 + r() * 4; const sh = h * (0.7 + r() * 0.3);
        d += `M${f(x)},${f(base + 2)} L${f(x)},${f(base - sh + sw)} L${f(x + sw / 2)},${f(base - sh)} L${f(x + sw)},${f(base - sh + sw)} L${f(x + sw)},${f(base + 2)} Z `;
        x += sw + (r() < 0.12 ? w * 0.08 : 0.6);
      }
      return { body: d };
    }
    case 'tents': {
      let d = `M${f(x0)},${f(base)} L${f(x1)},${f(base)} L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z `; let fires = '';
      let x = x0 + r() * w * 0.1;
      while (x < x1) {
        const tw = w * (0.06 + r() * 0.05); const th = h * (0.5 + r() * 0.5);
        d += `M${f(x)},${f(base)} L${f(x + tw / 2)},${f(base - th)} L${f(x + tw)},${f(base)} Z M${f(x + tw / 2)},${f(base - th)} L${f(x + tw / 2)},${f(base - th - 7)} L${f(x + tw / 2 + 6)},${f(base - th - 5)} L${f(x + tw / 2)},${f(base - th - 3)} Z `;
        if (r() < 0.4) fires += `M${f(x + tw + 6)},${f(base)} L${f(x + tw + 9)},${f(base - 7)} L${f(x + tw + 12)},${f(base)} Z `;
        x += tw + w * (0.05 + r() * 0.12);
      }
      return { body: d, accent: fires || undefined };
    }
    case 'deadtrees': {
      let d = ''; let x = x0;
      while (x < x1) {
        const th = h * (0.5 + r() * 0.5); const tx = x;
        d += `M${f(tx)},${f(base + 2)} L${f(tx + (r() - 0.5) * 6)},${f(base - th)} `;
        for (let i = 0; i < 3; i++) {
          const by = base - th * (0.45 + i * 0.18); const dir = r() < 0.5 ? -1 : 1;
          d += `M${f(tx)},${f(by)} L${f(tx + dir * th * (0.2 + r() * 0.15))},${f(by - th * 0.2)} `;
        }
        x += w * (0.07 + r() * 0.14);
      }
      return { body: d, accentStroke: true };
    }
    case 'spire': {
      const cx = w * (0.25 + r() * 0.5);
      const bw = w * 0.14; const sh = h;
      let d = `M${f(x0)},${f(base)} L${f(x1)},${f(base)} L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z `;
      d += `M${f(cx - bw / 2)},${f(base)} L${f(cx - bw / 2)},${f(base - sh * 0.45)} L${f(cx - bw * 0.2)},${f(base - sh * 0.55)} L${f(cx)},${f(base - sh)} L${f(cx + bw * 0.2)},${f(base - sh * 0.55)} L${f(cx + bw / 2)},${f(base - sh * 0.45)} L${f(cx + bw / 2)},${f(base)} Z `;
      // broken nave walls either side
      d += `M${f(cx - bw * 1.6)},${f(base)} L${f(cx - bw * 1.6)},${f(base - sh * 0.25)} L${f(cx - bw * 1.1)},${f(base - sh * 0.32)} L${f(cx - bw * 0.9)},${f(base - sh * 0.2)} L${f(cx - bw / 2)},${f(base - sh * 0.3)} L${f(cx - bw / 2)},${f(base)} Z `;
      d += `M${f(cx + bw / 2)},${f(base)} L${f(cx + bw / 2)},${f(base - sh * 0.28)} L${f(cx + bw)},${f(base - sh * 0.18)} L${f(cx + bw * 1.5)},${f(base - sh * 0.24)} L${f(cx + bw * 1.5)},${f(base)} Z `;
      const win = `M${f(cx - 3)},${f(base - sh * 0.42)} L${f(cx - 3)},${f(base - sh * 0.5)} L${f(cx)},${f(base - sh * 0.54)} L${f(cx + 3)},${f(base - sh * 0.5)} L${f(cx + 3)},${f(base - sh * 0.42)} Z`;
      return { body: d, accent: win };
    }
    case 'farm': {
      let d = `M${f(x0)},${f(base)} L${f(x1)},${f(base)} L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z `; let lights = '';
      // windmill
      const mx = w * (0.15 + r() * 0.2); const mh = h * 0.9; const mw = w * 0.05;
      d += `M${f(mx - mw)},${f(base)} L${f(mx - mw * 0.5)},${f(base - mh)} L${f(mx + mw * 0.5)},${f(base - mh)} L${f(mx + mw)},${f(base)} Z `;
      const hubY = base - mh; const blade = mh * 0.55;
      for (const a of [0.3, 1.87, 3.44, 5.01]) {
        const bx = mx + Math.cos(a) * blade; const by = hubY + Math.sin(a) * blade;
        const nx = -Math.sin(a) * 4; const ny = Math.cos(a) * 4;
        d += `M${f(mx)},${f(hubY)} L${f(bx)},${f(by)} L${f(bx + nx)},${f(by + ny)} L${f(mx + nx)},${f(hubY + ny)} Z `;
      }
      // barns / prison tower
      let x = mx + w * 0.12;
      while (x < x1) {
        const bw = w * (0.07 + r() * 0.06); const bh = h * (0.25 + r() * 0.25);
        const tower = r() < 0.25;
        const top = tower ? bh * 2.2 : bh;
        d += `M${f(x)},${f(base)} L${f(x)},${f(base - top)} L${f(x + bw / 2)},${f(base - top - bw * 0.4)} L${f(x + bw)},${f(base - top)} L${f(x + bw)},${f(base)} Z `;
        if (r() < 0.5) lights += `M${f(x + bw * 0.4)},${f(base - top * 0.55)} h4 v4 h-4 Z `;
        x += bw + w * (0.06 + r() * 0.12);
      }
      return { body: d, accent: lights || undefined };
    }
    case 'city': {
      let d = ''; let lights = ''; let x = x0;
      while (x < x1) {
        const bw = w * (0.05 + r() * 0.07); const bh = h * (0.3 + r() * 0.7);
        const roof = r();
        d += `M${f(x)},${f(base + 2)} L${f(x)},${f(base - bh)} `;
        if (roof < 0.45) d += `L${f(x + bw / 2)},${f(base - bh - bw * 0.5)} `;
        else if (roof < 0.6) d += `L${f(x + bw * 0.2)},${f(base - bh)} L${f(x + bw * 0.2)},${f(base - bh - 8)} L${f(x + bw * 0.32)},${f(base - bh - 8)} L${f(x + bw * 0.32)},${f(base - bh)} `;
        d += `L${f(x + bw)},${f(base - bh)} L${f(x + bw)},${f(base + 2)} Z `;
        for (let wy = base - bh + 6; wy < base - 4; wy += 7) {
          for (let wx = x + 3; wx < x + bw - 4; wx += 6) if (r() < 0.12) lights += `M${f(wx)},${f(wy)} h2.5 v3 h-2.5 Z `;
        }
        x += bw + (r() < 0.2 ? 3 : 0);
      }
      return { body: d, accent: lights || undefined };
    }
    case 'fort': {
      const fx0 = w * 0.05; const fx1 = w * 0.95; const wh = h * 0.45;
      let d = `M${f(x0)},${f(base)} L${f(x1)},${f(base)} L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z `;
      d += `M${f(fx0)},${f(base)} L${f(fx0)},${f(base - wh)} `;
      for (let x = fx0; x < fx1; x += 10) d += `L${f(x + 5)},${f(base - wh)} L${f(x + 5)},${f(base - wh - 5)} L${f(x + 10)},${f(base - wh - 5)} L${f(x + 10)},${f(base - wh)} `;
      d += `L${f(fx1)},${f(base - wh)} L${f(fx1)},${f(base)} Z `;
      let banners = '';
      for (const tx of [0.12, 0.5, 0.86]) {
        const cx = w * tx; const tw = w * 0.07; const th = h * (0.8 + r() * 0.2);
        d += `M${f(cx - tw / 2)},${f(base)} L${f(cx - tw / 2)},${f(base - th)} L${f(cx - tw / 2 - 3)},${f(base - th)} L${f(cx)},${f(base - th - tw * 0.8)} L${f(cx + tw / 2 + 3)},${f(base - th)} L${f(cx + tw / 2)},${f(base - th)} L${f(cx + tw / 2)},${f(base)} Z `;
        banners += `M${f(cx + 2)},${f(base - th * 0.85)} L${f(cx + 2 + tw * 0.35)},${f(base - th * 0.85)} L${f(cx + 2 + tw * 0.3)},${f(base - th * 0.5)} L${f(cx + 2 + tw * 0.17)},${f(base - th * 0.58)} L${f(cx + 2)},${f(base - th * 0.5)} Z `;
      }
      return { body: d, accent: banners };
    }
    case 'graves': {
      let d = `M${f(x0)},${f(base)} L${f(x1)},${f(base)} L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z `; let x = x0;
      while (x < x1) {
        const gh = h * (0.5 + r() * 0.5);
        d += `M${f(x)},${f(base)} L${f(x)},${f(base - gh)} L${f(x + 2.5)},${f(base - gh)} L${f(x + 2.5)},${f(base)} Z M${f(x - 3.5)},${f(base - gh * 0.72)} h9.5 v2.5 h-9.5 Z `;
        x += w * (0.03 + r() * 0.08);
      }
      return { body: d };
    }
    case 'volcano': {
      const cx = w * (0.55 + r() * 0.15); const vh = h; const vw = w * 0.9;
      const d = `M${f(x0)},${f(base)} L${f(cx - vw / 2)},${f(base - vh * 0.2)} L${f(cx - vw * 0.12)},${f(base - vh)} L${f(cx - vw * 0.04)},${f(base - vh * 0.94)} L${f(cx + vw * 0.04)},${f(base - vh * 0.96)} L${f(cx + vw * 0.12)},${f(base - vh)} L${f(cx + vw / 2)},${f(base - vh * 0.25)} L${f(x1)},${f(base - vh * 0.1)} L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z`;
      let lava = `M${f(cx - vw * 0.1)},${f(base - vh * 0.99)} L${f(cx + vw * 0.1)},${f(base - vh * 0.99)} L${f(cx + vw * 0.04)},${f(base - vh * 0.93)} L${f(cx - vw * 0.04)},${f(base - vh * 0.92)} Z `;
      for (let i = 0; i < 3; i++) {
        const sx = cx + (r() - 0.5) * vw * 0.12; const len = vh * (0.3 + r() * 0.4); const dx = (r() - 0.5) * vw * 0.3;
        lava += `M${f(sx - 1.5)},${f(base - vh * 0.95)} L${f(sx + dx - 1)},${f(base - vh * 0.95 + len)} L${f(sx + dx + 1.5)},${f(base - vh * 0.95 + len)} L${f(sx + 1.5)},${f(base - vh * 0.95)} Z `;
      }
      return { body: d, accent: lava };
    }
    case 'cliffs': {
      let d = `M${f(x0)},${f(base)}`; let x = x0;
      while (x < x1) {
        const cw = w * (0.08 + r() * 0.12); const ch = h * (0.3 + r() * 0.7);
        d += ` L${f(x)},${f(base - ch)} L${f(x + cw * 0.3)},${f(base - ch - 6)} L${f(x + cw)},${f(base - ch * 0.7)}`;
        x += cw;
      }
      return { body: d + ` L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z` };
    }
    case 'towers': {
      let d = `M${f(x0)},${f(base)} L${f(x1)},${f(base)} L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z `; let lights = ''; let x = x0;
      while (x < x1) {
        const tw = w * (0.04 + r() * 0.05); const th = h * (0.4 + r() * 0.6);
        d += `M${f(x)},${f(base)} L${f(x)},${f(base - th)} L${f(x + tw / 2)},${f(base - th - tw * 2.2)} L${f(x + tw)},${f(base - th)} L${f(x + tw)},${f(base)} Z `;
        for (let wy = base - th + 8; wy < base - 6; wy += 11) if (r() < 0.35) lights += `M${f(x + tw / 2 - 1.5)},${f(wy)} h3 v5 h-3 Z `;
        x += tw + w * (0.02 + r() * 0.07);
      }
      return { body: d, accent: lights || undefined };
    }
    case 'arches': {
      let d = `M${f(x0)},${f(base - h)} L${f(x1)},${f(base - h)} L${f(x1)},${f(base + 4)} L${f(x0)},${f(base + 4)} Z `;
      let holes = ''; let torches = '';
      const aw = w * 0.11;
      for (let x = x0 + aw * 0.3; x < x1; x += aw * 1.3) {
        const top = base - h * 0.75;
        holes += `M${f(x)},${f(base + 4)} L${f(x)},${f(top + aw / 2)} Q${f(x)},${f(top)} ${f(x + aw / 2)},${f(top)} Q${f(x + aw)},${f(top)} ${f(x + aw)},${f(top + aw / 2)} L${f(x + aw)},${f(base + 4)} Z `;
        torches += `M${f(x + aw * 1.15)},${f(base - h * 0.55)} l3,-8 l3,8 Z `;
      }
      // the arch openings are painted as darker cut-outs
      return { body: d + holes, accent: torches };
    }
  }
}

function Particle({ kind, w, h, seed }: { kind: Particles; w: number; h: number; seed: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const r = useMemo(() => rng(seed * 97 + 13), [seed]);
  const p = useMemo(() => ({ x: r() * w, y: r() * h, d: r(), s: r() }), [r, w, h]);
  const dur = { dust: 9000, snow: 6000, embers: 4200, rain: 900, fog: 16000, wisps: 7000, gold: 3200 }[kind] * (0.7 + p.d * 0.6);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }));
    const t = setTimeout(() => loop.start(), p.s * dur);
    return () => { clearTimeout(t); loop.stop(); };
  }, [v, dur, p.s]);
  const base = { position: 'absolute' as const, left: p.x, top: 0 };
  switch (kind) {
    case 'snow': {
      const sz = 2 + p.d * 2.5;
      return <Animated.View style={{ ...base, width: sz, height: sz, borderRadius: sz, backgroundColor: 'rgba(240,248,255,0.85)',
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-10, h + 10] }) }, { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 14, -6] }) }] }} />;
    }
    case 'rain':
      return <Animated.View style={{ ...base, width: 1, height: 12, backgroundColor: 'rgba(190,210,220,0.35)',
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-20, h + 20] }) }, { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }, { rotate: '12deg' }] }} />;
    case 'embers': {
      const sz = 2 + p.d * 2;
      return <Animated.View style={{ ...base, width: sz, height: sz, borderRadius: sz, backgroundColor: '#ffab4a',
        shadowColor: '#ff7a2a', shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 0.7, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [h * 0.9, h * 0.1] }) }, { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 10, -4] }) }] }} />;
    }
    case 'gold': {
      const sz = 2 + p.d * 2;
      return <Animated.View style={{ ...base, top: p.y * 0.8, width: sz, height: sz, borderRadius: sz, backgroundColor: '#ffe29a',
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }] }} />;
    }
    case 'wisps': {
      const sz = 5 + p.d * 5;
      return <Animated.View style={{ ...base, width: sz, height: sz * 1.6, borderRadius: sz, backgroundColor: 'rgba(170,220,230,0.35)',
        opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [h * 0.85, h * 0.3] }) }, { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -8, 6] }) }] }} />;
    }
    case 'fog': {
      const fw = w * (0.4 + p.d * 0.4);
      return <Animated.View style={{ ...base, left: 0, top: h * (0.25 + p.d * 0.45), width: fw, height: fw * 0.22, borderRadius: fw, backgroundColor: 'rgba(150,140,200,0.12)',
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-fw, w] }) }] }} />;
    }
    default: {
      const sz = 1.5 + p.d * 1.5;
      return <Animated.View style={{ ...base, top: p.y, width: sz, height: sz, borderRadius: sz, backgroundColor: 'rgba(255,225,190,0.55)',
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 0] }),
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }} />;
    }
  }
}

const PARTICLE_COUNT: Record<Particles, number> = { dust: 14, snow: 28, embers: 18, rain: 34, fog: 5, wisps: 8, gold: 16 };

/**
 * @param horizon y of the board's far edge — scenery sits on it
 * @param pan camera pan; layers follow it by their parallax factor for depth
 */
export function BattleBackdrop({ theme, width, height, horizon, pan }: { theme: BattleTheme; width: number; height: number; horizon: number; pan: Animated.Value }) {
  const sky = Math.max(40, horizon);
  const layers = useMemo(
    () => theme.layers.map((l) => buildLayer(l, width, horizon + 3, sky)),
    [theme, width, horizon, sky],
  );
  const g = theme.glow;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.sky[0]} />
            <Stop offset="0.6" stopColor={theme.sky[1]} />
            <Stop offset="1" stopColor={theme.sky[2]} />
          </SvgGradient>
          <SvgGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.ground[0]} />
            <Stop offset="1" stopColor={theme.ground[1]} />
          </SvgGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
            <Stop offset="0.35" stopColor={g.color} stopOpacity={g.opacity * 0.5} />
            <Stop offset="1" stopColor={g.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={horizon + 4} fill="url(#sky)" />
        <Circle cx={width * g.x} cy={sky * g.y} r={width * g.r * 2.2} fill="url(#glow)" />
        {g.r < 0.1 ? <Circle cx={width * g.x} cy={sky * g.y} r={width * g.r * 0.45} fill={g.color} opacity={0.95} /> : null}
        <Rect x={0} y={horizon} width={width} height={height - horizon} fill="url(#ground)" />
      </Svg>
      {theme.layers.map((l, i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: 0, top: 0, width, height, transform: [{ translateX: Animated.multiply(pan, l.parallax) }] }}>
          <Svg width={width} height={height}>
            {l.shape === 'deadtrees'
              ? <Path d={layers[i].body} stroke={l.color} strokeWidth={2.2} strokeLinecap="round" fill="none" />
              : <Path d={layers[i].body} fill={l.color} fillRule="evenodd" />}
            {layers[i].accent ? <Path d={layers[i].accent} fill={l.accent ?? l.color} opacity={l.shape === 'arches' || l.shape === 'fort' ? 0.9 : 0.85} /> : null}
          </Svg>
        </Animated.View>
      ))}
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id="fog" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.fog} stopOpacity={0} />
            <Stop offset="0.6" stopColor={theme.fog} stopOpacity={1} />
            <Stop offset="1" stopColor={theme.fog} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Rect x={0} y={horizon - sky * 0.35} width={width} height={sky * 0.5} fill="url(#fog)" />
      </Svg>
    </View>
  );
}

/** Ambient weather drifting across the whole stage, in front of the figures. */
export function BattleParticles({ theme, width, height }: { theme: BattleTheme; width: number; height: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}>
      {Array.from({ length: PARTICLE_COUNT[theme.particles] }).map((_, i) => (
        <Particle key={i} kind={theme.particles} w={width} h={height} seed={i + 1} />
      ))}
    </View>
  );
}
