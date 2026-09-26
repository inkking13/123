import { Animated } from 'react-native';
import * as THREE from 'three';

// Bridges the 3D scene and the React Native overlay drawn on top of it: scene
// objects publish world-space points under a key, the projector turns them into
// a screen-space box every frame, and overlay views (HP bars, damage numbers,
// tap targets) are positioned by those boxes.

export interface ScreenBox { left: Animated.Value; top: Animated.Value; width: Animated.Value; height: Animated.Value }
interface Entry { pts: THREE.Vector3[] | null; box: ScreenBox; last: [number, number, number, number]; visible: boolean }

export class Projection {
  private entries = new Map<string, Entry>();
  /** Latest world positions of moving things (figure centres), for beams and projectiles. */
  readonly world = new Map<string, THREE.Vector3>();
  private tmp = new THREE.Vector3();

  box(key: string): ScreenBox {
    return this.entry(key).box;
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
      };
      this.entries.set(key, e);
    }
    return e;
  }

  /** Called from the render loop. Only pushes values that moved by half a pixel or more. */
  project(camera: THREE.Camera, width: number, height: number) {
    for (const e of this.entries.values()) {
      if (!e.pts || !e.pts.length) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of e.pts) {
        this.tmp.copy(p).project(camera);
        const sx = ((this.tmp.x + 1) / 2) * width;
        const sy = ((1 - this.tmp.y) / 2) * height;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx;
        if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
      const next: [number, number, number, number] = [x0, y0, x1 - x0, y1 - y0];
      const vals = [e.box.left, e.box.top, e.box.width, e.box.height];
      for (let i = 0; i < 4; i++) {
        if (Math.abs(next[i] - e.last[i]) >= 0.5) { vals[i].setValue(next[i]); e.last[i] = next[i]; }
      }
    }
  }
}
