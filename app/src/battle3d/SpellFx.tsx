import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from './r3f';
import { softDotTexture } from './Atmosphere';

// Combat effects: spells and arrows in flight, bursts where they land, slashes
// on melee hits, healing motes and ground rings. Each one lives for well under
// a second, draws with additive blending (so it glows over the dark stage) and
// calls onDone to be removed.

const add = { transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending } as const;

/** A glowing spell with a comet tail, or an arrow, flying from one point to another. */
export function Comet({ from, to, color, arc, ms, arrow, onArrive }: {
  from: THREE.Vector3; to: THREE.Vector3; color: string; arc: number; ms: number; arrow?: boolean; onArrive: (at: THREE.Vector3) => void;
}) {
  const head = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Points>(null);
  const start = useRef<number | null>(null);
  const done = useRef(false);
  const N = arrow ? 0 : 18;
  const { geo, hist } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(Math.max(1, N) * 3);
    for (let i = 0; i < N; i++) from.toArray(pos, i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, hist: Array.from({ length: N }, () => from.clone()) };
  }, [from, N]);
  const p = useMemo(() => new THREE.Vector3(), []);
  const prev = useMemo(() => from.clone(), [from]);
  useFrame((st) => {
    if (done.current) return;
    if (start.current === null) start.current = st.clock.elapsedTime;
    const k = Math.min(1, (st.clock.elapsedTime - start.current) / (ms / 1000));
    const e = arrow ? k : k * k * (3 - 2 * k);
    p.lerpVectors(from, to, e); p.y += Math.sin(Math.PI * e) * arc;
    const h = head.current;
    if (h) {
      h.position.copy(p);
      if (arrow && p.distanceToSquared(prev) > 1e-6) h.lookAt(p.clone().add(p.clone().sub(prev)));
    }
    prev.copy(p);
    if (N) {
      hist.pop(); hist.unshift(p.clone());
      const a = geo.attributes.position as THREE.BufferAttribute;
      hist.forEach((v, i) => v.toArray(a.array as Float32Array, i * 3));
      a.needsUpdate = true;
    }
    if (k >= 1) { done.current = true; onArrive(to.clone()); }
  });
  const tex = softDotTexture();
  return (
    <>
      <group ref={head} position={from.toArray() as [number, number, number]}>
        {arrow ? (
          // Shaft along its flight (lookAt aims +Z), a pale fletching glow at the back.
          <>
            <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.6, 5]} /><meshBasicMaterial color="#d8c8a8" /></mesh>
            <mesh position={[0, 0, 0.32]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.03, 0.08, 6]} /><meshBasicMaterial color="#c8ccd4" /></mesh>
            <sprite scale={[0.35, 0.35, 1]} position={[0, 0, -0.25]}><spriteMaterial map={tex} color={color} opacity={0.5} {...add} /></sprite>
          </>
        ) : (
          <>
            <sprite scale={[0.3, 0.3, 1]}><spriteMaterial map={tex} color="#ffffff" {...add} /></sprite>
            <sprite scale={[0.85, 0.85, 1]}><spriteMaterial map={tex} color={color} opacity={0.9} {...add} /></sprite>
            <pointLight color={color} intensity={4} distance={4} decay={1.5} />
          </>
        )}
      </group>
      {N ? (
        <points geometry={geo}>
          <pointsMaterial map={tex} color={color} size={0.32} sizeAttenuation opacity={0.7} {...add} />
        </points>
      ) : null}
    </>
  );
}

/** Sparks flying out from a point, with a flash; `up` sends them upward (healing), `n` is how many. */
export function Burst({ at, color, n = 26, speed = 3, up = 0, size = 0.16, life = 0.6, flash = 1, onDone }: {
  at: THREE.Vector3; color: string; n?: number; speed?: number; up?: number; size?: number; life?: number; flash?: number; onDone: () => void;
}) {
  const start = useRef<number | null>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const glow = useRef<THREE.Sprite>(null);
  const { geo, vel } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3); const v: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      at.toArray(pos, i * 3);
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 + up, Math.random() - 0.5).normalize();
      v.push(d.multiplyScalar(speed * (0.4 + Math.random() * 0.8)));
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, vel: v };
  }, [at, n, speed, up]);
  useFrame((st, dt) => {
    if (start.current === null) start.current = st.clock.elapsedTime;
    const k = (st.clock.elapsedTime - start.current) / life;
    const a = geo.attributes.position as THREE.BufferAttribute; const arr = a.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const v = vel[i]; v.multiplyScalar(Math.exp(-dt * 3)); v.y -= dt * (up ? -1 : 4);
      arr[i * 3] += v.x * dt; arr[i * 3 + 1] += v.y * dt; arr[i * 3 + 2] += v.z * dt;
    }
    a.needsUpdate = true;
    if (mat.current) mat.current.opacity = Math.max(0, 1 - k);
    if (glow.current) { const f = Math.max(0, 1 - k * 2.5); glow.current.scale.setScalar(0.4 + (1 - f) * 1.4 * flash); (glow.current.material as THREE.SpriteMaterial).opacity = f * flash; }
    if (k >= 1) onDone();
  });
  const tex = softDotTexture();
  return (
    <>
      <points geometry={geo}>
        <pointsMaterial ref={mat} map={tex} color={color} size={size} sizeAttenuation {...add} />
      </points>
      {flash ? <sprite ref={glow} position={at}><spriteMaterial map={tex} color={color} {...add} /></sprite> : null}
    </>
  );
}

/** A ring spreading over the ground. */
export function GroundRing({ at, color, radius = 1.6, life = 0.7, onDone }: { at: THREE.Vector3; color: string; radius?: number; life?: number; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame((st) => {
    if (start.current === null) start.current = st.clock.elapsedTime;
    const k = (st.clock.elapsedTime - start.current) / life;
    if (ref.current) {
      ref.current.scale.setScalar(0.2 + k * radius);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
    }
    if (k >= 1) onDone();
  });
  return (
    <mesh ref={ref} position={[at.x, 0.06, at.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.7, 1, 48]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} {...add} />
    </mesh>
  );
}

/** A bright crescent swept across a target on a melee hit. */
export function Slash({ at, color = '#fff4dc', flip = false, onDone }: { at: THREE.Vector3; color?: string; flip?: boolean; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  const tilt = useMemo(() => (Math.random() - 0.5) * 1.2 + (flip ? Math.PI : 0), [flip]);
  useFrame((st) => {
    if (start.current === null) start.current = st.clock.elapsedTime;
    const k = (st.clock.elapsedTime - start.current) / 0.28;
    const m = ref.current;
    if (m) {
      m.lookAt(st.camera.position);
      m.rotateZ(tilt - 1.2 + k * 2.4);
      m.scale.setScalar(0.8 + k * 0.4);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k * k);
    }
    if (k >= 1) onDone();
  });
  return (
    <mesh ref={ref} position={at}>
      <ringGeometry args={[0.45, 0.55, 24, 1, 0, Math.PI * 0.8]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} {...add} />
    </mesh>
  );
}
