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
    // Crown on the top of the head, the face opening at eye height (0.45 of the way down).
    const s = (head.height * 0.45) / (H.crown - H.eye);
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
