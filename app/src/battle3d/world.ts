import * as THREE from 'three';
import { BOSS_H, BOSS_W, GRID_COLS, GRID_ROWS } from '../combat/types';

// World layout: the shared grid lies on the XZ plane, columns along X, rows
// along Z. Row 0 (where the enemies come in) is farthest from the camera; the
// party's bottom row is nearest (+Z). A tile is TILE world units across, and
// the board is centred on the origin.

/** Tile pitch; figures keep their size, so a bigger tile leaves more room around each one. */
export const TILE = 1.25;
export const TILE_SIZE = 0.9 * TILE;

export const colX = (col: number) => (col - (GRID_COLS - 1) / 2) * TILE;
export const rowZ = (row: number) => (row - (GRID_ROWS - 1) / 2) * TILE;
export const tilePos = (row: number, col: number) => new THREE.Vector3(colX(col), 0, rowZ(row));
/** Centre of the boss's footprint, given its top-left cell. */
export const bossPos = (row: number, col: number) => new THREE.Vector3(colX(col + (BOSS_W - 1) / 2), 0, rowZ(row + (BOSS_H - 1) / 2));

export const RAIDER_CARD = 0.66;
export const ROOM_CARD = 0.9;
export const BOSS_CARD = 2.3;

/** Default camera: behind and above the party, looking out over the field. */
// Pulled back with the tile, and a little more, so all seven columns fit a phone's width.
const CAMERA_PULL = TILE * 1.12;
export const CAMERA_HOME = new THREE.Vector3(0, 5.1, 6.5).multiplyScalar(CAMERA_PULL);
export const CAMERA_LOOK = new THREE.Vector3(0, 0.2, -0.7).multiplyScalar(TILE);

/** Heroes and room monsters are drawn this much larger than their build size, to read on a phone. */
export const FIGURE_SCALE = 1.3;
