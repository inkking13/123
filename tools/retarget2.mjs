// Retarget Meshy auto-rig clips onto an existing mixamo-rigged body of the same mesh.
// usage: node retarget2.mjs target.glb out.glb Clip1,Clip2 src1.glb [src2.glb ...]
// World-rotation retargeting: each target bone takes the source bone's world rotation
// delta from bind; Hips translation is scaled by the ratio of hip heights.
// Needs @gltf-transform/core and three.
import {NodeIO} from '@gltf-transform/core';
import * as THREE from 'three';
const io = new NodeIO();
const [,, tgtPath, outPath, clipCsv, ...srcPaths] = process.argv;
const want = new Set(clipCsv.split(','));
const FPS = 30;

const MAP = { Hips: 'Hips', Spine02: 'Spine', Spine01: 'Spine1', Spine: 'Spine2', neck: 'Neck', Head: 'Head' };
for (const s of ['Left', 'Right']) for (const b of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase']) MAP[s + b] = s + b;
const bare = (n) => n.replace(/^mixamorig:?/, '');

function rigInfo(doc) {
  const skin = doc.getRoot().listSkins()[0];
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const rest = new Map(); // node -> world (armature-space) matrix at bind
  joints.forEach((j, i) => rest.set(j, new THREE.Matrix4().fromArray(ibm.getElement(i, [])).invert()));
  const parent = new Map();
  for (const j of joints) for (const c of j.listChildren()) parent.set(c, j);
  return { joints, rest, parent };
}
const rotOf = (m) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return q; };
const posOf = (m) => new THREE.Vector3().setFromMatrixPosition(m);

function sampler(ch) {
  const s = ch.getSampler(); const t = s.getInput().getArray(); const v = s.getOutput().getArray();
  const n = ch.getTargetPath() === 'rotation' ? 4 : 3;
  return (time) => {
    let i = 0; while (i < t.length - 1 && t[i + 1] < time) i++;
    const j = Math.min(i + 1, t.length - 1);
    const a = t[i], b = t[j]; const k = b > a ? Math.min(1, Math.max(0, (time - a) / (b - a))) : 0;
    if (n === 4) { const qa = new THREE.Quaternion().fromArray(v, i * 4), qb = new THREE.Quaternion().fromArray(v, j * 4); return qa.slerp(qb, k); }
    return new THREE.Vector3().fromArray(v, i * 3).lerp(new THREE.Vector3().fromArray(v, j * 3), k);
  };
}

const tdoc = await io.read(tgtPath);
const T = rigInfo(tdoc);
const tByName = new Map(T.joints.map((j) => [bare(j.getName()), j]));
const tHipsRestY = posOf(T.rest.get(tByName.get('Hips'))).y;
const tRoot = tdoc.getRoot();
const tbuf = tRoot.listBuffers()[0];

for (const sp of srcPaths) {
  const sdoc = await io.read(sp);
  const S = rigInfo(sdoc);
  const sHipsNode = S.joints.find((j) => bare(j.getName()) === 'Hips');
  const sHipsRest = new THREE.Vector3().fromArray(sHipsNode.getTranslation()); // armature space, like the FK below
  const sHipsRestY = sHipsRest.y;
  const k = tHipsRestY / sHipsRestY;
  // Topological order from Hips.
  const order = []; const visit = (n) => { if (S.rest.has(n)) order.push(n); n.listChildren().forEach(visit); };
  visit(S.joints.find((j) => bare(j.getName()) === 'Hips'));
  for (const anim of sdoc.getRoot().listAnimations()) {
    if (!want.has(anim.getName())) continue;
    const tracks = new Map(); // node -> {rotation, translation}
    let dur = 0;
    for (const ch of anim.listChannels()) {
      const n = ch.getTargetNode(); if (!n) continue;
      dur = Math.max(dur, ch.getSampler().getInput().getMax([])[0]);
      const e = tracks.get(n) ?? {}; e[ch.getTargetPath()] = sampler(ch); tracks.set(n, e);
    }
    const frames = Math.round(dur * FPS) + 1;
    const times = new Float32Array(frames);
    const outRot = new Map(); // target joint -> Float32Array
    const outHips = new Float32Array(frames * 3);
    const tHips = tByName.get('Hips');
    for (let f = 0; f < frames; f++) {
      const time = Math.min(dur, f / FPS); times[f] = time;
      // Source FK in armature space.
      const world = new Map();
      for (const n of order) {
        const tr = tracks.get(n) ?? {};
        const p = tr.translation ? tr.translation(time) : new THREE.Vector3().fromArray(n.getTranslation());
        const q = tr.rotation ? tr.rotation(time) : new THREE.Quaternion().fromArray(n.getRotation());
        const l = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
        const par = S.parent.get(n);
        world.set(n, par ? world.get(par).clone().multiply(l) : l);
      }
      // Target world rotations.
      const tWorld = new Map();
      const tOrder = []; const tv = (n) => { if (T.rest.has(n)) tOrder.push(n); n.listChildren().forEach(tv); }; tv(tHips);
      for (const tn of tOrder) {
        const srcName = order.some((n) => n.getName() === tn.getName()) ? tn.getName() : Object.keys(MAP).find((s) => MAP[s] === bare(tn.getName()));
        const sn = srcName && order.find((n) => n.getName() === srcName);
        const par = T.parent.get(tn);
        const parW = par ? tWorld.get(par) : new THREE.Quaternion();
        let w;
        if (sn) {
          const d = rotOf(world.get(sn)).multiply(rotOf(S.rest.get(sn)).invert());
          w = d.multiply(rotOf(T.rest.get(tn)));
        } else {
          w = parW.clone().multiply(new THREE.Quaternion().fromArray(tn.getRotation()));
        }
        tWorld.set(tn, w);
        if (sn) {
          const local = parW.clone().invert().multiply(w);
          let a = outRot.get(tn); if (!a) { a = new Float32Array(frames * 4); outRot.set(tn, a); }
          if (f > 0) { const prev = new THREE.Quaternion().fromArray(a, (f - 1) * 4); if (prev.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w); }
          local.toArray(a, f * 4);
        }
      }
      // Hips: rest position plus the source's scaled offset.
      const sh = order[0];
      const off = posOf(world.get(sh)).sub(sHipsRest).multiplyScalar(k);
      const p = posOf(T.rest.get(tHips)).add(off); // Hips parent is the armature root (identity here)
      p.toArray(outHips, f * 3);
    }
    const name = anim.getName();
    const ta = tdoc.createAnimation(name);
    const input = tdoc.createAccessor().setType('SCALAR').setArray(times).setBuffer(tbuf);
    for (const [tn, arr] of outRot) {
      const smp = tdoc.createAnimationSampler().setInput(input).setOutput(tdoc.createAccessor().setType('VEC4').setArray(arr).setBuffer(tbuf)).setInterpolation('LINEAR');
      ta.addSampler(smp).addChannel(tdoc.createAnimationChannel().setTargetNode(tn).setTargetPath('rotation').setSampler(smp));
    }
    const hs = tdoc.createAnimationSampler().setInput(input).setOutput(tdoc.createAccessor().setType('VEC3').setArray(outHips).setBuffer(tbuf)).setInterpolation('LINEAR');
    ta.addSampler(hs).addChannel(tdoc.createAnimationChannel().setTargetNode(tHips).setTargetPath('translation').setSampler(hs));
    console.log(sp.split('/').pop(), name, frames, 'frames', outRot.size, 'bones', 'k', k.toFixed(4));
  }
}
await io.write(outPath, tdoc);
