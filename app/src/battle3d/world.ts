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

// Aimed a little past the middle of the board, so it sits low in the frame with the ruins above it,
// and a little to the left, so the near-left corner (the party's flank), which the corner-on
// view pushes furthest out, stays on screen.
export const CAMERA_LOOK = new THREE.Vector3(-1.7, 0.2, -1.0).multiplyScalar(TILE);
/** Default camera: high behind the party, looking down on the field at about 52°, the way
 *  Wartales frames a fight (before the turn by CAMERA_YAW). Far enough back that the board,
 *  seen corner-on, still fits a phone's width. */
export const CAMERA_HOME = CAMERA_LOOK.clone().add(new THREE.Vector3(0, 10.4, 8.1).multiplyScalar(TILE * 0.92));
/** The camera stands off to one side of the party by default, so the board is seen corner-on. */
export const CAMERA_YAW = 0.5;
/** How far a pinch can bring the camera in or send it back, as a share of its distance. */
export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 1.4;

/** Heroes and room monsters are drawn this much larger than their build size, to read on a phone. */
export const FIGURE_SCALE = 1.3;
