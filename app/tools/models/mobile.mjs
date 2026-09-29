// Phone copies of the 3D models: fewer triangles, 512px textures, no normal
// maps. Metro serves assets/models/mobile/<name>.glb instead of
// assets/models/<name>.glb on Android and iOS (see metro.config.js).
//
//   node mobile.mjs ../../assets/models
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const root = path.resolve(process.argv[2] ?? '../../assets/models');
const out = path.join(root, 'mobile');

// Triangle budget per file, by what it is.
function budget(rel) {
  const n = path.basename(rel, '.glb');
  if (rel.startsWith('wardrobe/')) return 7000;
  if (n.startsWith('helm-')) return 2500;
  if (n.startsWith('weapon-') || n.startsWith('shield-')) return 1500;
  if (n.startsWith('decor-')) return 1800;
  if (n === 'rune-axe') return 2500;
  return 6000; // bodies, foes
}

const skip = new Set(['battlefield.glb', 'battlefield-mobile.glb']);
const files = [
  ...fs.readdirSync(root).filter((f) => f.endsWith('.glb') && !skip.has(f)),
  ...fs.readdirSync(path.join(root, 'wardrobe')).filter((f) => f.endsWith('.glb')).map((f) => 'wardrobe/' + f),
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

const tris = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
  .reduce((a, p) => a + (p.getIndices() ?? p.getAttribute('POSITION')).getCount() / 3, 0);

for (const rel of files) {
  const doc = await io.read(path.join(root, rel));
  const before = tris(doc);
  // Normal maps cost a texture fetch per pixel and barely show at battle distance.
  for (const m of doc.getRoot().listMaterials()) m.setNormalTexture(null);
  const ratio = Math.min(1, budget(rel) / before);
  await doc.transform(
    weld(),
    ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.05, lockBorder: false })] : []),
    prune(), dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [512, 512], quality: 82 }),
  );
  const dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  await io.write(dst, doc);
  const kb = (f) => Math.round(fs.statSync(f).size / 1024);
  console.log(rel.padEnd(28), String(Math.round(before)).padStart(7), '->', String(Math.round(tris(doc))).padStart(6), 'tris', kb(path.join(root, rel)), '->', kb(dst), 'KB');
}
