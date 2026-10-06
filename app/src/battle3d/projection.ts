import { useEffect } from 'react';
import { Animated } from 'react-native';
import * as THREE from 'three';

// Bridges the 3D scene and the React Native overlay drawn on top of it: scene
// objects publish world-space points under a key, the projector turns them into
// a screen-space box every frame, and overlay views (HP bars, damage numbers,
// tap targets) are positioned by those boxes.

export interface ScreenBox { left: Animated.Value; top: Animated.Value; width: Animated.Value; height: Animated.Value }
interface Entry { pts: THREE.Vector3[] | null; box: ScreenBox; last: [number, number, number, number]; visible: boolean; watchers: number }

export class Projection {
  private entries = new Map<string, Entry>();
  /** Latest world positions of moving things (figure centres), for beams and projectiles. */
  readonly world = new Map<string, THREE.Vector3>();
  private tmp = new THREE.Vector3();
  private view: { camera: THREE.Camera; width: number; height: number } | null = null;

  box(key: string): ScreenBox {
    return this.entry(key).box;
  }
  /**
   * Only boxes some overlay view is showing get projected: every value pushed
   * re-lays out a view, and with ~50 of them each frame that cost more than the
   * 3D scene on a weak phone. Returns the unwatch call.
   */
  watch(key: string): () => void {
    const e = this.entry(key);
    if (e.watchers++ === 0 && this.view) this.place(e, this.view.camera, this.view.width, this.view.height);
    return () => { e.watchers--; };
  }
  setPoints(key: string, pts: THREE.Vector3[]) {
    this.entry(key).pts = pts;
  }
  private entry(key: string): Entry {
    let e = this.entries.get(key);
    if (!e) {
      e = {
        pts: null,
        box: { left: new Animated.Value(-999), top: new Animated.Value(-999), width: new Animated.Value(0), height: new Animated.Value(0) },
        last: [-999, -999, 0, 0],
        visible: true,
        watchers: 0,
      };
      this.entries.set(key, e);
    }
    return e;
  }

  /** Called from the render loop. Only pushes values that moved by a pixel or more. */
  project(camera: THREE.Camera, width: number, height: number) {
    this.view = { camera, width, height };
    for (const e of this.entries.values()) if (e.watchers) this.place(e, camera, width, height);
  }

  private place(e: Entry, camera: THREE.Camera, width: number, height: number) {
    if (!e.pts || !e.pts.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of e.pts) {
      this.tmp.copy(p).project(camera);
      const sx = ((this.tmp.x + 1) / 2) * width;
      const sy = ((1 - this.tmp.y) / 2) * height;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx;
      if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
    push(e, 0, e.box.left, x0);
    push(e, 1, e.box.top, y0);
    push(e, 2, e.box.width, x1 - x0);
    push(e, 3, e.box.height, y1 - y0);
  }
}

function push(e: Entry, i: number, v: Animated.Value, next: number) {
  if (Math.abs(next - e.last[i]) >= 1) { v.setValue(next); e.last[i] = next; }
}

/** The screen box of `key`, kept up to date while the calling view is mounted. */
export function useScreenBox(proj: Projection, key: string): ScreenBox {
  useEffect(() => proj.watch(key), [proj, key]);
  return proj.box(key);
}
