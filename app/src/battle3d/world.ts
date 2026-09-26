import * as THREE from 'three';
import { GRID_COLS } from '../combat/types';

// World layout: the grid lies on the XZ plane, columns along X, rows along Z.
// The party's back row is nearest the camera (+Z), the enemies stand beyond
// the front row (−Z). One tile is one world unit.

export const TILE = 1;
export const TILE_SIZE = 0.9;
export const ENEMY_Z = -1.75;
export const BOSS_Z = -2.25;

export const colX = (col: number) => (col - (GRID_COLS - 1) / 2) * TILE;
export const rowZ = (row: number) => row * TILE;
export const tilePos = (row: number, col: number) => new THREE.Vector3(colX(col), 0, rowZ(row));
/** Room enemies stand a little wider than the tiles so their cards don't overlap. */
export const enemyX = (col: number) => (col - (GRID_COLS - 1) / 2) * TILE * 1.25;

export const RAIDER_CARD = 0.66;
export const ROOM_CARD = 1.15;
export const BOSS_CARD = 1.9;

/** Default camera: behind and above the party, looking out over the field. */
export const CAMERA_HOME = new THREE.Vector3(0, 3.1, 6.2);
export const CAMERA_LOOK = new THREE.Vector3(0, 0.5, -1.1);
