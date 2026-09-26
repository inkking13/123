import { GRID_COLS, GRID_ROWS } from './types';

// 2.5D battlefield: the shared grid is laid on a floor plane seen from behind
// the party, projected with a simple pinhole camera. Depth z runs from the near
// edge (0, the party's bottom row) away from the camera; every row is one unit
// deep, so the enemies' top rows are the farthest.

const FOCAL = 9;
const TILE_INSET_X = 0.012; // in board-width fractions
const TILE_INSET_Z = 0.05; // in rows

export interface Pt { x: number; y: number }

export interface FieldGeometry {
  width: number;
  height: number;
  /** Depth scale at z: 1 on the near edge, shrinking with distance. */
  scale: (z: number) => number;
  project: (xn: number, z: number) => Pt;
  /** Depth span [near, far] of a grid row. */
  rowSpan: (row: number) => [number, number];
  /** Floor quad of a tile, as an SVG points string. */
  tilePoints: (row: number, col: number) => string;
  /** Tap rectangle of a tile (its mid-depth width, full depth height). */
  tileRect: (row: number, col: number) => { left: number; top: number; width: number; height: number };
  /** Where a figure standing on the tile has its feet. */
  foot: (row: number, col: number) => Pt;
  /** Feet of a figure centred on fractional cell coordinates (the boss's footprint centre). */
  footAt: (row: number, col: number) => Pt;
  /** Depth scale at a tile's centre. */
  tileScale: (row: number, col: number) => number;
  /** Floor polygon of the whole board, for the stage backdrop. */
  boardPoints: string;
  /** Screen y of the board's far edge, where the scenery meets the floor. */
  horizon: number;
}

/**
 * @param width measured field width
 * @param headroom how tall the tallest enemy figure is, so the far row leaves
 *   room for it above the floor
 */
export function fieldGeometry(width: number, headroom: number): FieldGeometry {
  const scale = (z: number) => FOCAL / (FOCAL + z);
  const zFar = GRID_ROWS;
  const sFar = scale(zFar);
  const k = width * 1.2;
  const rowSpan = (row: number): [number, number] => [GRID_ROWS - 1 - row, GRID_ROWS - row];
  // The tallest enemy stands around the second row from the top.
  const tallZ = GRID_ROWS - 1.6;
  // The horizon sits above the view; shift so the far rows leave `headroom`.
  const top = Math.max(8, headroom + 6 - k * (scale(tallZ) - sFar));
  const project = (xn: number, z: number): Pt => {
    const s = scale(z);
    return { x: width / 2 + (xn - 0.5) * width * s, y: top + k * (s - sFar) };
  };
  const quad = (xn0: number, xn1: number, z0: number, z1: number) =>
    [project(xn0, z1), project(xn1, z1), project(xn1, z0), project(xn0, z0)].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const tileBounds = (row: number, col: number) => {
    const [z0, z1] = rowSpan(row);
    return { xn0: col / GRID_COLS + TILE_INSET_X, xn1: (col + 1) / GRID_COLS - TILE_INSET_X, z0: z0 + TILE_INSET_Z, z1: z1 - TILE_INSET_Z };
  };
  return {
    width,
    height: top + k * (1 - sFar) + 12,
    scale,
    project,
    rowSpan,
    tilePoints: (row, col) => {
      const b = tileBounds(row, col);
      return quad(b.xn0, b.xn1, b.z0, b.z1);
    },
    tileRect: (row, col) => {
      const b = tileBounds(row, col);
      const zm = (b.z0 + b.z1) / 2;
      const l = project(b.xn0, zm); const r = project(b.xn1, zm);
      const near = project(b.xn0, b.z0); const far = project(b.xn0, b.z1);
      return { left: l.x, top: far.y, width: r.x - l.x, height: near.y - far.y };
    },
    foot: (row, col) => project((col + 0.5) / GRID_COLS, GRID_ROWS - row - 0.6),
    footAt: (row, col) => project((col + 0.5) / GRID_COLS, GRID_ROWS - row - 0.6),
    tileScale: (row) => {
      const [z0, z1] = rowSpan(row);
      return scale((z0 + z1) / 2);
    },
    boardPoints: quad(0, 1, 0, zFar),
    horizon: top,
  };
}
