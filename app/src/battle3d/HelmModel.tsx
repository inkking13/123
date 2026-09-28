import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useLoader } from './r3f';

// Meshy-made helmets worn over any hero's head. Each file is a static mesh
// (simplified to ~17k triangles, 512 px textures), 1.9 units tall, facing +Z.
// A helmet is fitted by two heights in its own units: `crown`, where the top
// of the head touches the inside, and `eye`, the middle of the face opening.

const url = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));

export const HELM_MODELS = {
  // Closed great helm with a visor slit and a gorget.
  knight: { url: url(require('../../assets/models/helm-knight.glb')), crown: 0.86, eye: 0.2, z: 0 },
  // Arcane hood with a rune-trimmed mantle.
  veil: { url: url(require('../../assets/models/helm-veil.glb')), crown: 0.84, eye: 0.3, z: 0.05 },
  // Ragged, strapped hood and mantle over a covered face.
  warden: { url: url(require('../../assets/models/helm-warden.glb')), crown: 0.84, eye: 0.35, z: 0.05 },
};
export type HelmModelName = keyof typeof HELM_MODELS;

/** Where a head is: its top and height in the model's own space, and the bone it rides at rest. */
export interface HeadFit {
  bone: THREE.Object3D;
  /** The bone's rest transform in the same space as `top`. */
  rest: THREE.Matrix4;
  top: THREE.Vector3;
  /** Crown to chin. */
  height: number;
}

/** Puts a Meshy helmet on a head bone; nothing is drawn by the component itself. */
export function HelmOn({ name, head }: { name: HelmModelName; head: HeadFit }) {
  const H = HELM_MODELS[name];
  const gltf = useLoader(GLTFLoader, H.url as any) as unknown as { scene: THREE.Group };
  const helm = useMemo(() => {
    const g = gltf.scene.clone();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        // Lambert like the rest of the cast, so it sits in the same light.
        const std = m.material as THREE.MeshStandardMaterial;
        m.material = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap, side: THREE.DoubleSide });
      }
    });
    return g;
  }, [gltf]);
  useEffect(() => {
    // Crown on the top of the head, the face opening at eye height (0.45 of the way down),
    // a little roomy so the pressed-down hair stays inside.
    const s = (1.05 * head.height * 0.45) / (H.crown - H.eye);
    const want = new THREE.Matrix4().compose(
      new THREE.Vector3(head.top.x, head.top.y - H.crown * s, head.top.z - H.z * s),
      new THREE.Quaternion(),
      new THREE.Vector3(s, s, s),
    );
    const local = head.rest.clone().invert().multiply(want);
    local.decompose(helm.position, helm.quaternion, helm.scale);
    head.bone.add(helm);
    return () => { helm.removeFromParent(); };
  }, [helm, head, H]);
  useEffect(() => () => helm.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) (m.material as THREE.Material).dispose(); }), [helm]);
  return null;
}

/** A helmet if the worn one has a model, loading quietly. */
export function WornHelm({ name, head }: { name?: HelmModelName; head: HeadFit | null }) {
  if (!name || !head) return null;
  return <React.Suspense fallback={null}><HelmOn name={name} head={head} /></React.Suspense>;
}

/** A Meshy helmet on a built hero's head: centred on the origin, crown at 0.115, 0.23 to the chin. */
export function BuiltHeadHelm({ name }: { name: HelmModelName }) {
  const [group, setGroup] = React.useState<THREE.Group | null>(null);
  const head = useMemo<HeadFit | null>(() => (group ? { bone: group, rest: new THREE.Matrix4(), top: new THREE.Vector3(0, 0.125, 0), height: 0.27 } : null), [group]);
  return <group ref={setGroup}><WornHelm name={name} head={head} /></group>;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const tucked = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/**
 * A copy of a scanned body's geometry with the hair pressed down onto the
 * skull, so it stays inside a helmet: every vertex above the neck that lies
 * outside an ellipsoid round the skull is pulled onto it, except the face.
 * Hair below the neck is left alone and hangs out from under the helmet.
 * `toHead` takes the geometry's positions into the space `head` is in.
 */
export function tuckHair(src: THREE.BufferGeometry, toHead: THREE.Matrix4, head: Pick<HeadFit, 'top' | 'height'>): THREE.BufferGeometry {
  const hit = tucked.get(src);
  if (hit) return hit;
  const g = src.clone();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const back = toHead.clone().invert();
  const { top, height: H } = head;
  const c = new THREE.Vector3(top.x, top.y - 0.44 * H, top.z - 0.01);
  const r = new THREE.Vector3(0.33 * H, 0.4 * H, 0.35 * H);
  const neckY = top.y - H + 0.02;
  const browY = top.y - 0.3 * H;
  const p = new THREE.Vector3(); const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(toHead);
    const k = smooth(neckY - 0.01, neckY + 0.04, p.y);
    if (k <= 0) continue;
    if (p.z > c.z + 0.02 && p.y < browY) continue; // the face
    d.copy(p).sub(c).divide(r);
    const len = d.length();
    if (len <= 1) continue;
    d.multiplyScalar(1 / len).multiply(r).add(c);
    p.lerp(d, k).applyMatrix4(back);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  tucked.set(src, g);
  return g;
}
