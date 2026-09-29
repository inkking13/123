import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from './r3f';
import type { Quality } from './quality';

// One place that turns a Meshy model's material into what the game draws.
// Low graphics keep Lambert (diffuse only, the cheapest shader, for weak
// phones). Medium and high draw the cast in the physical material with a
// torchlit hall to reflect, so plate and blades catch the light and cloth stays matte.
// The files carry only colour and normal maps, so how shiny a surface is
// comes from what the part is (its finish), not from a texture.

export type Finish = 'skin' | 'cloth' | 'leather' | 'metal' | 'stone';
// envMapIntensity: how strongly the torchlit hall below reflects — most on metal.
const FINISH: Record<Exclude<Finish, 'stone'>, { roughness: number; metalness: number; envMapIntensity: number }> = {
  skin: { roughness: 0.7, metalness: 0, envMapIntensity: 0.6 },
  cloth: { roughness: 0.92, metalness: 0, envMapIntensity: 0.5 },
  leather: { roughness: 0.62, metalness: 0.05, envMapIntensity: 0.8 },
  metal: { roughness: 0.4, metalness: 0.45, envMapIntensity: 1.6 },
};

export type ModelMaterial = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;

let rich = false;
/** Called by each Canvas for its quality before its models build their materials. */
export function setModelQuality(q: Quality) {
  rich = q !== 'low';
}

/** The game's material for a mesh loaded from a file. */
export function modelMaterial(src: THREE.Material, finish: Finish, extra: { side?: THREE.Side } = {}): ModelMaterial {
  const std = src as THREE.MeshStandardMaterial;
  // Stone (the keep, decor) stays Lambert: it has no shine to show, and it is most of the screen.
  if (!rich || finish === 'stone') return new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap, ...extra });
  return new THREE.MeshStandardMaterial({ map: std.map, normalMap: std.normalMap, ...FINISH[finish], ...extra });
}

/**
 * What the cast reflects: a near-black hall with a few warm torch panels and a
 * cold one high up. A bright studio room would wash the whole dungeon grey
 * (the environment lights every physical material in the scene); this one adds
 * almost no fill, only highlights on plate and blades.
 */
function torchlitHall(): THREE.Scene {
  const scene = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const hall = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.018, 0.014, 0.012), side: THREE.BackSide }));
  hall.scale.set(20, 10, 20);
  scene.add(hall);
  const panel = (color: THREE.Color, pos: [number, number, number], size: [number, number, number]) => {
    const m = new THREE.Mesh(box.clone(), new THREE.MeshBasicMaterial({ color }));
    m.position.set(...pos); m.scale.set(...size); scene.add(m);
  };
  const torch = new THREE.Color(5, 2.6, 1.1);
  panel(torch, [-6, 1, -5], [0.8, 1.6, 0.8]);
  panel(torch, [6, 1, -5], [0.8, 1.6, 0.8]);
  panel(new THREE.Color(3, 1.6, 0.7), [0, 0.5, 7], [3, 1, 0.5]);
  panel(new THREE.Color(1.2, 1.4, 2), [0, 4.8, 0], [6, 0.2, 6]);
  return scene;
}

/** Gives the cast something to reflect, on medium and high graphics. */
export function ModelEnvironment({ quality }: { quality: Quality }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (quality === 'low') return;
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = torchlitHall();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    room.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    pmrem.dispose();
    return () => { if (scene.environment === env) scene.environment = null; env.dispose(); };
  }, [gl, scene, quality]);
  return null;
}
