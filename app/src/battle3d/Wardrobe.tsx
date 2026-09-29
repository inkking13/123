import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useLoader } from './r3f';
import { ArmourPiece, ArmourSetId } from '../data/armourSets';

// Worn armour-set pieces on a Meshy hero. Each set was fitted offline to each
// race body it can go on (tools: split8/fit8 — cut by body zone, skinned from
// the nearest body vertex, un-posed to the bind pose), one file per set and
// body holding the eight pieces as skinned meshes on that body's skeleton.
// Here the worn pieces are re-bound to the hero's own bones by name, and the
// body under them is hidden so it can't poke through.

const url = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));

export type WardrobeBody = 'human' | 'elf-male' | 'elf' | 'dwarf' | 'orc';

const FILES: Record<WardrobeBody, Record<ArmourSetId, number>> = {
  human: {
    leather: require('../../assets/models/wardrobe/leather-human.glb'),
    knight: require('../../assets/models/wardrobe/knight-human.glb'),
    arcane: require('../../assets/models/wardrobe/arcane-human.glb'),
    templar: require('../../assets/models/wardrobe/templar-human.glb'),
  },
  'elf-male': {
    leather: require('../../assets/models/wardrobe/leather-elf-male.glb'),
    knight: require('../../assets/models/wardrobe/knight-elf-male.glb'),
    arcane: require('../../assets/models/wardrobe/arcane-elf-male.glb'),
    templar: require('../../assets/models/wardrobe/templar-elf-male.glb'),
  },
  elf: {
    leather: require('../../assets/models/wardrobe/leather-elf.glb'),
    knight: require('../../assets/models/wardrobe/knight-elf.glb'),
    arcane: require('../../assets/models/wardrobe/arcane-elf.glb'),
    templar: require('../../assets/models/wardrobe/templar-elf.glb'),
  },
  // Dwarves and the orc: the outfits widened to their build before fitting.
  dwarf: {
    leather: require('../../assets/models/wardrobe/leather-dwarf.glb'),
    knight: require('../../assets/models/wardrobe/knight-dwarf.glb'),
    arcane: require('../../assets/models/wardrobe/arcane-dwarf.glb'),
    templar: require('../../assets/models/wardrobe/templar-dwarf.glb'),
  },
  orc: {
    leather: require('../../assets/models/wardrobe/leather-orc.glb'),
    knight: require('../../assets/models/wardrobe/knight-orc.glb'),
    arcane: require('../../assets/models/wardrobe/arcane-orc.glb'),
    templar: require('../../assets/models/wardrobe/templar-orc.glb'),
  },
};

export interface WornPiece { set: ArmourSetId; piece: ArmourPiece; closedHelm: boolean }

/** Body parts, from each vertex's strongest bone. */
type Part = 'head' | 'torso' | 'pelvis' | 'upperArm' | 'forearm' | 'hand' | 'thigh' | 'shin' | 'foot' | 'other';
const partOf = (bone: string): Part =>
  /Head|Neck|neck/.test(bone) ? 'head'
    : /Hand/.test(bone) ? 'hand'
      : /ForeArm/.test(bone) ? 'forearm'
        : /Arm$/.test(bone) ? 'upperArm'
          : /Spine|Shoulder/.test(bone) ? 'torso'
            : /Hips/.test(bone) ? 'pelvis'
              : /UpLeg/.test(bone) ? 'thigh'
                : /Foot|Toe/.test(bone) ? 'foot'
                  : /Leg$/.test(bone) ? 'shin' : 'other';
/** What of the body each piece covers. */
const COVERS: Partial<Record<ArmourPiece, Part[]>> = {
  jacket: ['torso'],
  shoulders: ['upperArm'],
  gloves: ['hand', 'forearm'],
  pants: ['pelvis', 'thigh'],
  boots: ['foot', 'shin'],
};

export function Wardrobe({ body, pieces, bodyMeshes, materials }: {
  body: WardrobeBody; pieces: WornPiece[]; bodyMeshes: THREE.SkinnedMesh[]; materials: THREE.Material[];
}) {
  const sets = [...new Set(pieces.map((p) => p.set))];
  const gltfs = useLoader(GLTFLoader, sets.map((s) => url(FILES[body][s])) as any) as unknown as { scene: THREE.Group }[];
  const key = pieces.map((p) => p.set + ':' + p.piece).join(',');
  useEffect(() => {
    const bodyMesh = bodyMeshes[0];
    if (!bodyMesh?.parent) return;
    const bones = new Map<string, THREE.Bone>();
    for (const b of bodyMesh.skeleton.bones) bones.set(b.name, b);
    const added: THREE.SkinnedMesh[] = [];
    for (const p of pieces) {
      const g = gltfs[sets.indexOf(p.set)];
      let src: THREE.SkinnedMesh | undefined;
      g.scene.traverse((o) => { if (!src && (o as THREE.SkinnedMesh).isSkinnedMesh && (o.name === 'armour_' + p.piece || o.parent?.name === 'armour_' + p.piece)) src = o as THREE.SkinnedMesh; });
      if (!src) continue;
      const std = src.material as THREE.MeshStandardMaterial;
      // Lambert like the rest of the cast, so it sits in the same light.
      const mat = new THREE.MeshLambertMaterial({ map: std.map, normalMap: std.normalMap });
      const m = new THREE.SkinnedMesh(src.geometry, mat);
      m.frustumCulled = false;
      const skel = new THREE.Skeleton(src.skeleton.bones.map((b) => bones.get(b.name) ?? b), src.skeleton.boneInverses);
      bodyMesh.parent.add(m);
      m.bind(skel, bodyMesh.bindMatrix);
      materials.push(mat);
      added.push(m);
    }
    // Hide the body where the armour covers it (a closed helm takes the head too).
    const hidden = new Set<Part>(pieces.flatMap((p) => [...(COVERS[p.piece] ?? []), ...(p.piece === 'hood' && p.closedHelm ? ['head' as Part] : [])]));
    const restore: (() => void)[] = [];
    if (hidden.size) for (const bm of bodyMeshes) {
      // Heroes share a body's geometry; give this one its own index to cut.
      if (!bm.userData.ownGeometry) { bm.geometry = bm.geometry.clone(); bm.userData.ownGeometry = true; }
      const geo = bm.geometry;
      const full = (geo.userData.fullIndex ??= geo.index!.array.slice()) as ArrayLike<number>;
      const j = geo.attributes.skinIndex, w = geo.attributes.skinWeight;
      const part: Part[] = [];
      for (let i = 0; i < j.count; i++) {
        let best = 0; for (let k = 1; k < 4; k++) if (w.getComponent(i, k) > w.getComponent(i, best)) best = k;
        part.push(partOf(bm.skeleton.bones[j.getComponent(i, best)]?.name ?? ''));
      }
      const keep: number[] = [];
      for (let t = 0; t < full.length; t += 3) {
        const n = +hidden.has(part[full[t]]) + +hidden.has(part[full[t + 1]]) + +hidden.has(part[full[t + 2]]);
        if (n < 2) keep.push(full[t], full[t + 1], full[t + 2]);
      }
      geo.setIndex(keep);
      restore.push(() => geo.setIndex(Array.from(full)));
    }
    return () => {
      for (const m of added) { m.removeFromParent(); const i = materials.indexOf(m.material as THREE.Material); if (i >= 0) materials.splice(i, 1); (m.material as THREE.Material).dispose(); }
      restore.forEach((f) => f());
    };
  }, [gltfs, key, bodyMeshes, materials]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
