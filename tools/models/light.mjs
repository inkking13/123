// Light copy of a Meshy export for budget phones: fewer triangles, JPEG textures
// at one size, no normal map unless asked. Needs, in any scratch folder:
//   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
//
//   node light.mjs <src.glb> <dst.glb> <triangles> <texturePx> [keepNormal]
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune, dedup, resample } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [src, dst, budget, px, keepNormal] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const doc = await io.read(src);
const tris = () => doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((a,p)=>a+(p.getIndices()??p.getAttribute('POSITION')).getCount()/3,0);
const before = tris();
for (const m of doc.getRoot().listMaterials()) {
  if (!keepNormal) m.setNormalTexture(null);
  // Without a metal/rough map a metallic factor of 1 renders the whole model as dark chrome.
  if (!m.getMetallicRoughnessTexture()) m.setMetallicFactor(0);
  // Meshy sometimes copies the colour map into emission at full strength, which renders unlit.
  if (m.getEmissiveTexture() && m.getEmissiveTexture() === m.getBaseColorTexture()) { m.setEmissiveTexture(null); m.setEmissiveFactor([0,0,0]); }
}
const ratio = Math.min(1, Number(budget) / before);
await doc.transform(
  weld(),
  ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.05, lockBorder: false })] : []),
  resample(), prune(), dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [Number(px), Number(px)], quality: 85 }),
);
await io.write(dst, doc);
console.log(dst, Math.round(before), '->', Math.round(tris()), 'tris', Math.round(fs.statSync(src).size/1024), '->', Math.round(fs.statSync(dst).size/1024), 'KB');
