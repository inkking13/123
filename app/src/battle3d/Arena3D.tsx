import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from './r3f';
import { useArt } from './textures';
import { HeroAnim, HeroModel } from './HeroModel';
import { HERO_LOOKS } from './heroLooks';
import { CreatureAnim, CreatureModel } from './CreatureModel';
import { MonsterLook } from './monsterLooks';
import { Projection } from './projection';
import { Scenery, sunDirection } from './Scenery';
import {
  BOSS_CARD, CAMERA_HOME, CAMERA_LOOK, RAIDER_CARD, ROOM_CARD, TILE_SIZE, bossPos, colX, rowZ, tilePos,
} from './world';
import { BattleTheme } from '../components/BattleBackdrop';
import { BOSS_H, BOSS_W, CombatFx, EnemyRole, GRID_COLS, GRID_ROWS, Raider, Sim } from '../combat/types';
import { impactDelay, PROJECTILE_MS } from '../components/CombatFx';
import { portraitSource } from '../data/portraits';
import { colors, roleColor } from '../theme/theme';

const WHITE = new THREE.Color('#ffffff');
/** Approximate standing height of each low-poly build, for anchoring HP bars above the head. */
const MODEL_HEIGHT = { human: 1.12, dwarf: 0.92, orc: 1.26, elf: 1.2, gnome: 0.95, brute: 1.35, golem: 1.5, imp: 0.95 } as const;
const HURT = new THREE.Color('#ff7a6a');
const DEAD = new THREE.Color('#5a5a66');
const UP = new THREE.Vector3(0, 1, 0);

/** Crops a texture to its centre square, like resizeMode="cover" on a square view. */
function coverSquare(tex: THREE.Texture) {
  const img = tex.image as { width?: number; height?: number } | undefined;
  if (!img?.width || !img?.height) return;
  const a = img.width / img.height;
  if (a > 1) { tex.repeat.set(1 / a, 1); tex.offset.set((1 - 1 / a) / 2, 0); }
  else if (a < 1) { tex.repeat.set(1, a); tex.offset.set(0, (1 - a) / 2); }
}

function Portrait({ art, size, matRef }: { art: any; size: number; matRef: React.MutableRefObject<THREE.MeshBasicMaterial | null> }) {
  const tex = useArt(art);
  useMemo(() => coverSquare(tex), [tex]);
  return (
    <mesh position={[0, 0, 0.004]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial ref={matRef} map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

/** A board-game standee: a framed portrait card on a round base, always turned to the camera. */
function Card({ art, size, frame, matRef, cardRef, children }: {
  art: any; size: number; frame: string; matRef: React.MutableRefObject<THREE.MeshBasicMaterial | null>;
  cardRef: React.MutableRefObject<THREE.Group | null>; children?: React.ReactNode;
}) {
  return (
    <group ref={cardRef} rotation-order="YXZ">
      {/* pivot at the card's bottom edge so it can tip over; set back on the base so the rim stays in front */}
      <group position={[0, 0.08 + size / 2, -Math.min(0.14, size * 0.12)]}>
        <mesh position={[0, 0, -0.004]}>
          <planeGeometry args={[size + 0.07, size + 0.07]} />
          <meshBasicMaterial color={frame} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[size + 0.07, size + 0.07]} />
          <meshLambertMaterial color="#1c1c26" />
        </mesh>
        <Suspense fallback={null}>{art ? <Portrait art={art} size={size} matRef={matRef} /> : null}</Suspense>
        {children}
      </group>
    </group>
  );
}

function Base({ radius, color }: { radius: number; color: string }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[radius * 1.35, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[radius, radius * 1.08, 0.06, 24]} />
        <meshLambertMaterial color="#5a5a6a" />
      </mesh>
      <mesh position={[0, 0.062, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.98, radius * 0.07, 6, 28]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </>
  );
}

function PulseRing({ radius, color, speed = 3, y = 0.07 }: { radius: number; color: string; speed?: number; y?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    if (!ref.current) return;
    const k = (Math.sin(st.clock.elapsedTime * speed) + 1) / 2;
    ref.current.scale.setScalar(1 + k * 0.12);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + k * 0.55;
  });
  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.035, 6, 32]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} />
    </mesh>
  );
}

function faceCamera(obj: THREE.Object3D, from: THREE.Vector3, camera: THREE.Camera) {
  obj.rotation.y = Math.atan2(camera.position.x - from.x, camera.position.z - from.z);
}

function RaiderFigure({ r, sim, proj, active, poisoned }: { r: Raider; sim: Sim; proj: Projection; active: boolean; poisoned: boolean }) {
  const clock = useThree((s) => s.clock);
  const root = useRef<THREE.Group>(null);
  const card = useRef<THREE.Group | null>(null);
  const mat = useRef<THREE.MeshBasicMaterial | null>(null);
  const pos = useRef(tilePos(r.row, r.col));
  const ev = useRef({ lunge: -99, kind: '' as string, hit: -99, deadAt: r.alive ? -1 : -99 });
  const look = HERO_LOOKS[r.candidateId];
  const model = useRef<THREE.Group>(null);
  const anim = useRef<HeroAnim>({ kind: '', at: -99, hit: -99, deadAt: r.alive ? -1 : -99, alive: r.alive, defending: false, speed: 0, frozen: false });
  const yaw = useRef(Math.PI);
  const prevPos = useMemo(() => new THREE.Vector3(), []);
  const figH = look ? MODEL_HEIGHT[look.build] : 0.08 + RAIDER_CARD;
  const prevHp = useRef(r.hp);
  const head = useMemo(() => new THREE.Vector3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const key = 'r' + r.id;
  useEffect(() => {
    proj.setPoints(key, [head]);
    proj.world.set(key, center);
    return () => { proj.world.delete(key); };
  }, [proj, key, head, center]);
  useEffect(() => {
    if (sim.fx.seq && sim.fx.actor === r.id) { ev.current.lunge = clock.elapsedTime; ev.current.kind = sim.fx.kind ?? ''; }
  }, [sim.fx.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (r.hp < prevHp.current) {
      const fx = sim.fx;
      const delay = (fx.kind === 'heal' || fx.kind === 'ability') && fx.targetRaider === r.id ? impactDelay(fx) : 0;
      ev.current.hit = clock.elapsedTime + delay / 1000;
    }
    prevHp.current = r.hp;
  }, [r.hp]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ev.current.deadAt = r.alive ? -1 : clock.elapsedTime; }, [r.alive, clock]);

  useFrame((st, dt) => {
    const g = root.current; if (!g) return;
    const t = st.clock.elapsedTime;
    prevPos.copy(pos.current);
    pos.current.lerp(tilePos(r.row, r.col), 1 - Math.exp(-dt * (look ? 6 : 9)));
    // Models turn to face the nearest enemy; lunges go that way too.
    let fx = 0, fz = -1;
    if (look && r.alive) {
      let best: THREE.Vector3 | null = null; let bd = Infinity;
      for (const [k, v] of proj.world) {
        if (k !== 'boss' && !k.startsWith('e')) continue;
        const d = (v.x - pos.current.x) ** 2 + (v.z - pos.current.z) ** 2;
        if (d < bd) { bd = d; best = v; }
      }
      if (best) {
        const want = Math.atan2(best.x - pos.current.x, best.z - pos.current.z);
        let diff = want - yaw.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        yaw.current += diff * (1 - Math.exp(-dt * 8));
      }
      fx = Math.sin(yaw.current); fz = Math.cos(yaw.current);
    }
    let dz = 0, dx = 0, dy = 0, sx = 0, scale = 1;
    const e = ev.current; const lt = t - e.lunge;
    if (e.kind === 'melee' && lt < 0.33) {
      const k = lt < 0.11 ? lt / 0.11 : 1 - (lt - 0.11) / 0.22;
      dx = fx * 0.6 * k; dz = fz * 0.6 * k; dy = look ? 0 : 0.2 * Math.sin(Math.PI * (lt / 0.33));
    } else if (e.kind === 'ranged' && lt < 0.3 && !look) {
      dz = 0.14 * Math.sin(Math.PI * (lt / 0.3));
    } else if (lt < 0.5 && !look && (e.kind === 'ability' || e.kind === 'heal' || e.kind === 'rally')) {
      scale = 1 + 0.16 * Math.sin(Math.PI * (lt / 0.5)); dy = 0.1 * Math.sin(Math.PI * (lt / 0.5));
    }
    const ht = t - e.hit;
    if (ht >= 0 && ht < 0.3) sx = Math.sin(ht * 70) * 0.07 * (1 - ht / 0.3);
    g.position.set(pos.current.x + sx + dx, dy, pos.current.z + dz);
    if (look && model.current) {
      model.current.rotation.y = yaw.current;
      const a = anim.current;
      a.kind = e.kind; a.at = e.lunge; a.hit = e.hit; a.deadAt = e.deadAt; a.alive = r.alive;
      a.defending = r.defending; a.frozen = r.alive && sim.frozen?.targetId === r.id;
      a.speed = prevPos.distanceTo(pos.current) / Math.max(dt, 1e-3);
    }
    const c = card.current;
    if (c) {
      faceCamera(c, g.position, st.camera);
      const fall = r.alive ? 0 : e.deadAt >= 0 ? Math.min(1, (t - e.deadAt) / 0.5) : 1;
      c.rotation.x = -1.3 * fall;
      c.scale.setScalar(scale);
    }
    if (mat.current) {
      if (!r.alive) mat.current.color.copy(DEAD);
      else {
        const f = ht >= 0 && ht < 0.35 ? 1 - ht / 0.35 : 0;
        mat.current.color.copy(WHITE).lerp(HURT, f);
      }
    }
    head.set(g.position.x, g.position.y + figH + 0.14, g.position.z);
    center.set(g.position.x, g.position.y + figH * 0.6, g.position.z);
  });

  const alive = r.alive;
  const frozen = alive && sim.frozen?.targetId === r.id;
  const shielded = alive && ((r.ability.kind === 'selfShield' && r.ability.active) || !!sim.partyWard);
  const berserk = alive && r.ability.kind === 'berserk' && r.ability.active;
  const frame = active ? roleColor[r.role] : alive ? '#3a3a48' : '#2a2a30';
  return (
    <group ref={root}>
      <Base radius={0.3} color={alive ? roleColor[r.role] : '#44444c'} />
      {active ? <PulseRing radius={0.43} color={roleColor[r.role]} /> : null}
      {shielded ? <PulseRing radius={0.5} color="#8fb8ff" speed={2} y={0.2} /> : null}
      {berserk ? <PulseRing radius={0.5} color={colors.danger} speed={8} y={0.2} /> : null}
      {poisoned && alive ? <PulseRing radius={0.36} color="#7ac874" speed={4} y={0.12} /> : null}
      {look ? (
        <group ref={model} position={[0, 0.06, 0]}>
          <HeroModel look={look} anim={anim} />
        </group>
      ) : (
        <Card art={portraitSource(r.candidateId)} size={RAIDER_CARD} frame={frame} matRef={mat} cardRef={card}>
          {frozen ? (
            <mesh>
              <boxGeometry args={[RAIDER_CARD + 0.16, RAIDER_CARD + 0.16, 0.22]} />
              <meshBasicMaterial color="#bfe6ff" transparent opacity={0.4} depthWrite={false} />
            </mesh>
          ) : null}
        </Card>
      )}
    </group>
  );
}

function FoeFigure({
  id, art, x, z, size, alive, hp, focused, stunned, windup, poisoned, shell, phase, isBoss, fx, proj, monster,
}: {
  id: string; art: any; x: number; z: number; size: number; alive: boolean; hp: number; focused: boolean; stunned: boolean;
  windup: boolean; poisoned: boolean; shell: boolean; phase: number; isBoss: boolean; fx: CombatFx; proj: Projection;
  /** Low-poly body; without one the enemy stays a portrait card. */
  monster?: MonsterLook;
}) {
  const mscale = isBoss ? 2.1 : 1.15;
  const mH = monster ? monster.height * mscale : 0;
  const model = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const heroAnim = useRef<HeroAnim>({ kind: '', at: -99, hit: -99, deadAt: alive ? -1 : -99, alive, defending: false, speed: 0, frozen: false });
  const creAnim = useRef<CreatureAnim>({ at: -99, hit: -99, deadAt: alive ? -1 : -99, alive, speed: 0, rear: 0, stunned: false });
  const clock = useThree((s) => s.clock);
  const root = useRef<THREE.Group>(null);
  const card = useRef<THREE.Group | null>(null);
  const mat = useRef<THREE.MeshBasicMaterial | null>(null);
  const glow = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ev = useRef({ lunge: -99, hit: -99, deadAt: alive ? -1 : -99, windAt: -99, phaseAt: -99, rear: 0 });
  const at = useRef(new THREE.Vector3(x, 0, z));
  const prevHp = useRef(hp);
  const prevPhase = useRef(phase);
  const box = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], []);
  const center = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    proj.setPoints(id, box);
    proj.world.set(id, center);
    return () => { proj.world.delete(id); };
  }, [proj, id, box, center]);
  useEffect(() => {
    if (fx.seq && fx.actor === 'enemy' && fx.kind === 'enemy' && alive) ev.current.lunge = clock.elapsedTime;
  }, [fx.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hp < prevHp.current) ev.current.hit = clock.elapsedTime + (fx.actor !== 'enemy' ? impactDelay(fx) : 0) / 1000;
    prevHp.current = hp;
  }, [hp]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ev.current.deadAt = alive ? -1 : clock.elapsedTime + 0.12; }, [alive, clock]);
  useEffect(() => {
    if (phase > prevPhase.current) ev.current.phaseAt = clock.elapsedTime;
    prevPhase.current = phase;
  }, [phase, clock]);

  useFrame((st, dt) => {
    const g = root.current; if (!g) return;
    const t = st.clock.elapsedTime;
    const e = ev.current;
    e.rear += ((windup && alive ? 1 : 0) - e.rear) * (1 - Math.exp(-dt * (windup ? 4.5 : 20)));
    // Models turn to the nearest raider and lunge that way; cards just lunge toward the party.
    let fx0 = 0, fz0 = 1;
    if (monster && alive) {
      let best: THREE.Vector3 | null = null; let bd = Infinity;
      for (const [k, v] of proj.world) {
        if (!k.startsWith('r')) continue;
        const d = (v.x - at.current.x) ** 2 + (v.z - at.current.z) ** 2;
        if (d < bd) { bd = d; best = v; }
      }
      if (best) {
        const want = Math.atan2(best.x - at.current.x, best.z - at.current.z);
        let diff = want - yaw.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        yaw.current += diff * (1 - Math.exp(-dt * 6));
      }
      fx0 = Math.sin(yaw.current); fz0 = Math.cos(yaw.current);
    }
    let dz = 0, dx = 0, sx = 0;
    const lt = t - e.lunge;
    if (lt < 0.33) { const k = 0.7 * (lt < 0.11 ? lt / 0.11 : 1 - (lt - 0.11) / 0.22); dz = fz0 * k; dx = fx0 * k; }
    const ht = t - e.hit;
    if (ht >= 0 && ht < 0.3) sx = Math.sin(ht * 70) * 0.08 * (1 - ht / 0.3);
    sx += e.rear * Math.sin(t * 80) * 0.03;
    // Walks to its new cell; a small bob while moving sells the step.
    const before = at.current.clone();
    at.current.lerp(new THREE.Vector3(x, 0, z), 1 - Math.exp(-dt * (isBoss ? 3 : 5)));
    const moving = before.distanceTo(at.current) / Math.max(dt, 1e-3);
    const bob = Math.min(1, moving) * Math.abs(Math.sin(t * 12)) * (isBoss ? 0.12 : 0.08);
    g.position.set(at.current.x + sx + dx, (monster ? 0 : e.rear * (isBoss ? 0.3 : 0.15)) + (monster ? 0 : bob), at.current.z + dz);
    if (monster && model.current) {
      model.current.rotation.y = yaw.current;
      model.current.rotation.z = stunned && alive && 'humanoid' in monster ? Math.sin(t * 6) * 0.08 : 0;
      model.current.scale.setScalar(mscale * (1 + e.rear * 0.14));
      const h = heroAnim.current;
      h.kind = lt < 0.6 ? 'melee' : ''; h.at = e.lunge; h.hit = e.hit; h.deadAt = e.deadAt; h.alive = alive; h.speed = moving / mscale;
      const c = creAnim.current;
      c.at = e.lunge; c.hit = e.hit; c.deadAt = e.deadAt; c.alive = alive; c.speed = moving / mscale; c.rear = e.rear; c.stunned = stunned;
    }
    const c = card.current;
    if (c) {
      faceCamera(c, g.position, st.camera);
      const fall = alive ? 0 : e.deadAt >= 0 ? Math.max(0, Math.min(1, (t - e.deadAt) / 0.45)) : 1;
      c.rotation.x = -1.35 * fall;
      c.rotation.z = stunned && alive ? Math.sin(t * 6) * 0.12 : 0;
      c.scale.setScalar(1 + e.rear * 0.14);
    }
    if (mat.current) {
      if (!alive) { mat.current.color.copy(DEAD); mat.current.opacity = 0.55; }
      else {
        const f = ht >= 0 && ht < 0.35 ? 1 - ht / 0.35 : 0;
        mat.current.color.copy(WHITE).lerp(HURT, Math.max(f, e.rear * 0.25));
        mat.current.opacity = 1;
      }
    }
    if (glow.current) {
      (glow.current.material as THREE.MeshBasicMaterial).opacity = e.rear * (0.32 + Math.sin(t * 14) * 0.1);
      glow.current.scale.setScalar(0.7 + e.rear * 0.5);
    }
    if (ring.current) {
      const pt = t - e.phaseAt;
      const m = ring.current.material as THREE.MeshBasicMaterial;
      if (pt < 0.7) { ring.current.visible = true; ring.current.scale.setScalar(1 + pt * 2.5); m.opacity = 1 - pt / 0.7; }
      else ring.current.visible = false;
    }
    const s = (monster ? mH : size) * (1 + e.rear * 0.14);
    const w = monster ? Math.min(s * 0.85, isBoss ? 2.6 : 0.95) : s;
    const cy = g.position.y + (monster ? 0 : 0.08);
    box[0].set(g.position.x - w / 2, cy, g.position.z);
    box[1].set(g.position.x + w / 2, cy, g.position.z);
    box[2].set(g.position.x - w / 2, cy + s, g.position.z);
    box[3].set(g.position.x + w / 2, cy + s, g.position.z);
    center.set(g.position.x, cy + s / 2, g.position.z);
  });

  const baseR = isBoss ? 1.25 : 0.4;
  return (
    <group ref={root}>
      <Base radius={baseR} color={alive ? colors.danger : '#44444c'} />
      {focused && alive ? <PulseRing radius={baseR * 1.2} color={colors.warn} /> : null}
      {poisoned && alive ? <PulseRing radius={baseR * 1.05} color="#7ac874" speed={4} y={0.12} /> : null}
      <mesh ref={ring} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[baseR * 1.2, 0.05, 6, 36]} />
        <meshBasicMaterial color={colors.danger} transparent toneMapped={false} />
      </mesh>
      {monster ? (<>
        <group ref={model}>
          {'humanoid' in monster ? <HeroModel look={monster.humanoid} anim={heroAnim} /> : <CreatureModel look={monster.creature} anim={creAnim} />}
        </group>
        {/* wind-up halo and ice shell wrap the whole figure */}
        <mesh ref={glow} position={[0, mH * 0.5, 0]}>
          <sphereGeometry args={[mH * 0.55, 16, 10]} />
          <meshBasicMaterial color="#ff4a2a" transparent opacity={0} depthWrite={false} toneMapped={false} side={THREE.BackSide} />
        </mesh>
        {shell && alive ? (
          <mesh position={[0, mH * 0.5, 0]}>
            <boxGeometry args={[mH * 0.8, mH * 1.05, mH * 0.8]} />
            <meshBasicMaterial color="#bfe6ff" transparent opacity={0.3} depthWrite={false} />
          </mesh>
        ) : null}
      </>) : (
        <Card art={art} size={size} frame={alive ? (focused ? colors.warn : colors.danger) : '#3a3a44'} matRef={mat} cardRef={card}>
          <mesh ref={glow} position={[0, 0, -0.05]}>
            <circleGeometry args={[size * 0.85, 32]} />
            <meshBasicMaterial color="#ff4a2a" transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
          {shell && alive ? (
            <mesh>
              <boxGeometry args={[size + 0.2, size + 0.2, 0.3]} />
              <meshBasicMaterial color="#bfe6ff" transparent opacity={0.35} depthWrite={false} />
            </mesh>
          ) : null}
        </Card>
      )}
    </group>
  );
}

type TileState = 'plain' | 'reachable' | 'self' | 'danger' | 'lava' | 'foe';
const TILE_COLOR: Record<Exclude<TileState, 'plain'>, string> = {
  reachable: '#9184d9', self: '#d2cefd', danger: '#d1685c', lava: '#ff7a2a', foe: '#7a2a30',
};

function Tile({ row, col, state, activeColor, theme }: { row: number; col: number; state: TileState; activeColor: string | null; theme: BattleTheme }) {
  const mat = useRef<THREE.MeshLambertMaterial>(null);
  const plain = useMemo(() => new THREE.Color(theme.floor.near).lerp(new THREE.Color('#ffffff'), 0.12), [theme]);
  useFrame((st) => {
    const m = mat.current; if (!m) return;
    const t = st.clock.elapsedTime;
    if (state === 'plain') {
      m.color.copy(plain);
      m.emissive.set(activeColor ?? '#000000');
      m.emissiveIntensity = activeColor ? 0.25 + 0.2 * Math.sin(t * 4) : 0;
    } else {
      m.color.set(TILE_COLOR[state]);
      m.emissive.set(TILE_COLOR[state]);
      const pulse = state === 'danger' || state === 'lava' ? 0.35 + 0.3 * Math.sin(t * (state === 'danger' ? 6 : 3)) : state === 'foe' ? 0.15 : 0.3;
      m.emissiveIntensity = pulse;
    }
  });
  return (
    <mesh position={[colX(col), 0.012, rowZ(row)]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
      <meshLambertMaterial ref={mat} transparent opacity={state === 'plain' ? 0.55 : 0.85} />
    </mesh>
  );
}

function Board({ sim, theme, current, reachable, proj }: { sim: Sim; theme: BattleTheme; current: Raider | null; reachable: { row: number; col: number }[]; proj: Projection }) {
  useEffect(() => {
    const h = TILE_SIZE / 2;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = colX(col); const z = rowZ(row);
        proj.setPoints(`tile-${row}-${col}`, [
          new THREE.Vector3(x - h * 0.8, 0, z - h), new THREE.Vector3(x + h * 0.8, 0, z - h),
          new THREE.Vector3(x - h, 0, z + h * 0.6), new THREE.Vector3(x + h, 0, z + h * 0.6),
        ]);
      }
    }
  }, [proj]);
  const danger = new Set(sim.danger?.cells ?? []);
  const foeCells = new Set<string>();
  if (sim.bossPos && sim.boss.hp > 0) {
    for (let dr = 0; dr < BOSS_H; dr++) for (let dc = 0; dc < BOSS_W; dc++) foeCells.add((sim.bossPos.row + dr) + ',' + (sim.bossPos.col + dc));
  }
  for (const e of sim.enemies) if (e.alive) foeCells.add(e.row + ',' + e.col);
  const stateOf = (row: number, col: number): TileState => {
    const k = row + ',' + col;
    if (danger.has(k)) return 'danger';
    if (sim.lava.includes(k)) return 'lava';
    if (sim.movePhase && reachable.some((c) => c.row === row && c.col === col)) return 'reachable';
    if (sim.movePhase && current && current.row === row && current.col === col) return 'self';
    if (foeCells.has(k)) return 'foe';
    return 'plain';
  };
  return (
    <>
      <mesh position={[0, -0.07, 0]}>
        <boxGeometry args={[GRID_COLS + 0.5, 0.14, GRID_ROWS + 0.5]} />
        <meshLambertMaterial color={theme.floor.far} />
      </mesh>
      {Array.from({ length: GRID_ROWS }).flatMap((_, row) => Array.from({ length: GRID_COLS }).map((__, col) => (
        <Tile
          key={row + '-' + col} row={row} col={col} state={stateOf(row, col)} theme={theme}
          activeColor={current && !sim.movePhase && current.row === row && current.col === col ? roleColor[current.role] : null}
        />
      )))}
    </>
  );
}

// ── transient effects ──────────────────────────────────────

function Bolt({ from, to, color, arc, onDone }: { from: THREE.Vector3; to: THREE.Vector3; color: string; arc: number; onDone: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  useFrame((st) => {
    const g = ref.current; if (!g) return;
    if (start.current === null) start.current = st.clock.elapsedTime;
    const k = Math.min(1, (st.clock.elapsedTime - start.current) / (PROJECTILE_MS / 1000));
    const e = k * k;
    g.position.lerpVectors(from, to, e);
    g.position.y += Math.sin(Math.PI * e) * arc;
    if (k >= 1) onDone();
  });
  return (
    <group ref={ref} position={from.toArray() as [number, number, number]}>
      <mesh><sphereGeometry args={[0.08, 12, 8]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
      <mesh><sphereGeometry args={[0.2, 12, 8]} /><meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} toneMapped={false} /></mesh>
    </group>
  );
}

function Pillar({ row, col, hot, onDone }: { row: number; col: number; hot: boolean; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame((st) => {
    if (start.current === null) start.current = st.clock.elapsedTime;
    const k = (st.clock.elapsedTime - start.current) / 0.6;
    if (ref.current) {
      ref.current.scale.set(1, Math.max(0.01, Math.min(1, k / 0.3)) * 1.6, 1);
      ref.current.position.y = ref.current.scale.y / 2;
      (ref.current.material as THREE.MeshBasicMaterial).opacity = k < 0.5 ? 0.85 : Math.max(0, 0.85 * (1 - (k - 0.5) / 0.5));
    }
    if (flash.current) (flash.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
    if (k >= 1) onDone();
  });
  const color = hot ? '#ff8a3a' : '#e8e8f4';
  return (
    <group position={[colX(col), 0, rowZ(row)]}>
      <mesh ref={ref}>
        <cylinderGeometry args={[0.28, 0.4, 1, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={flash} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Wave({ at, onDone }: { at: THREE.Vector3; onDone: () => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  useFrame((st) => {
    if (start.current === null) start.current = st.clock.elapsedTime;
    const k = (st.clock.elapsedTime - start.current) / 0.8;
    if (ref.current) {
      ref.current.scale.setScalar(0.3 + k * 4.5);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - k));
    }
    if (k >= 1) onDone();
  });
  return (
    <mesh ref={ref} position={[at.x, 0.05, at.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.85, 1, 48]} />
      <meshBasicMaterial color={colors.warn} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Pulsing beam between two moving figures (death-beam lock-on, chains). */
function Beam({ proj, a, b, color, width }: { proj: Projection; a: string; b: string; color: string; width: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame((st) => {
    const m = ref.current; if (!m) return;
    const pa = proj.world.get(a); const pb = proj.world.get(b);
    if (!pa || !pb) { m.visible = false; return; }
    m.visible = true;
    dir.subVectors(pb, pa);
    const len = dir.length();
    m.position.copy(pa).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    m.scale.set(1, len, 1);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.4 * Math.sin(st.clock.elapsedTime * 10);
  });
  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[width, width, 1, 8]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Effects({ sim, proj, foeKeyFor }: { sim: Sim; proj: Projection; foeKeyFor: (enemyId: number) => string }) {
  const [bolts, setBolts] = useState<{ key: number; from: THREE.Vector3; to: THREE.Vector3; color: string; arc: number }[]>([]);
  const [pillars, setPillars] = useState<{ key: string; row: number; col: number; hot: boolean }[]>([]);
  const [waves, setWaves] = useState<{ key: number; at: THREE.Vector3 }[]>([]);
  useEffect(() => {
    const fx = sim.fx;
    if (!fx.seq || typeof fx.actor !== 'number') return;
    const from = proj.world.get('r' + fx.actor)?.clone();
    if (!from) return;
    if (fx.kind === 'rally') setWaves((w) => [...w, { key: fx.seq, at: from }]);
    let to: THREE.Vector3 | undefined; let color = '#ffb35c'; let arc = 0.9;
    if ((fx.kind === 'ranged' || fx.kind === 'ability') && fx.targetEnemy != null) {
      to = proj.world.get(foeKeyFor(fx.targetEnemy))?.clone();
      if (fx.kind === 'ability') color = colors.accent;
    } else if (fx.targetRaider != null && fx.targetRaider !== fx.actor) {
      to = proj.world.get('r' + fx.targetRaider)?.clone(); color = colors.good; arc = 0.6;
    }
    if (to) setBolts((b) => [...b, { key: fx.seq, from, to: to!, color, arc }]);
  }, [sim.fx.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sim.impact.seq || !sim.impact.cells.length) return;
    const hot = sim.impact.kind === 'meteor' || sim.impact.kind === 'devour';
    setPillars((p) => [...p, ...sim.impact.cells.map((k) => {
      const [row, col] = k.split(',').map(Number);
      return { key: sim.impact.seq + ':' + k, row, col, hot };
    })]);
  }, [sim.impact.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {bolts.map((b) => <Bolt key={b.key} from={b.from} to={b.to} color={b.color} arc={b.arc} onDone={() => setBolts((xs) => xs.filter((x) => x.key !== b.key))} />)}
      {pillars.map((p) => <Pillar key={p.key} row={p.row} col={p.col} hot={p.hot} onDone={() => setPillars((xs) => xs.filter((x) => x.key !== p.key))} />)}
      {waves.map((w) => <Wave key={w.key} at={w.at} onDone={() => setWaves((xs) => xs.filter((x) => x.key !== w.key))} />)}
      {sim.pendingCast ? <Beam proj={proj} a="boss" b={'r' + sim.pendingCast.targetId} color={colors.danger} width={0.035} /> : null}
      {sim.chain ? <Beam proj={proj} a={'r' + sim.chain.aId} b={'r' + sim.chain.bId} color={colors.accent} width={0.025} /> : null}
    </>
  );
}

// ── camera ─────────────────────────────────────────────────

function CameraRig({ sim, current, proj }: { sim: Sim; current: Raider | null; proj: Projection }) {
  const { camera, size } = useThree();
  const look = useRef(CAMERA_LOOK.clone());
  const shakeAt = useRef(-99);
  const prevShake = useRef(sim.shakeSeq);
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    if (sim.shakeSeq !== prevShake.current) { shakeAt.current = clock.elapsedTime; prevShake.current = sim.shakeSeq; }
  }, [sim.shakeSeq, clock]);
  const want = useMemo(() => new THREE.Vector3(), []);
  const wantLook = useMemo(() => new THREE.Vector3(), []);
  const focus = useMemo(() => new THREE.Vector3(), []);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const enemyTurn = sim.order[sim.turnPos]?.kind === 'boss';
    let dist = 1; let pull = 0;
    const foe = proj.world.get('boss') ?? [...proj.world.entries()].find(([k]) => k.startsWith('e'))?.[1];
    if (sim.windup && foe) { focus.copy(foe); dist = 0.78; pull = 0.35; }
    else if (enemyTurn && foe) { focus.copy(foe); dist = 0.94; pull = 0.2; }
    else if (current) { const c = proj.world.get('r' + current.id); if (c) focus.copy(c); else focus.copy(tilePos(current.row, current.col)); dist = 0.97; pull = 0.12; }
    else { focus.copy(CAMERA_LOOK); }
    wantLook.copy(CAMERA_LOOK).lerp(focus, pull);
    want.copy(CAMERA_HOME).sub(CAMERA_LOOK).multiplyScalar(dist).add(wantLook);
    want.x += Math.sin(t * 0.35) * 0.12 + focus.x * pull * 0.5;
    want.y += Math.sin(t * 0.5) * 0.05;
    const k = 1 - Math.exp(-dt * (sim.windup ? 3 : 2.4));
    camera.position.lerp(want, k);
    look.current.lerp(wantLook, k);
    const st2 = t - shakeAt.current;
    if (st2 < 0.35) {
      const a = 0.12 * (1 - st2 / 0.35);
      camera.position.x += Math.sin(t * 90) * a;
      camera.position.y += Math.cos(t * 77) * a * 0.6;
    }
    camera.lookAt(look.current);
    const pc = camera as THREE.PerspectiveCamera;
    const fov = 50 - (st2 < 0.4 ? 3 * Math.sin(Math.PI * (st2 / 0.4)) : 0);
    if (Math.abs(pc.fov - fov) > 0.01) { pc.fov = fov; pc.updateProjectionMatrix(); }
    proj.project(camera, size.width, size.height);
  });
  return null;
}

export interface ArenaProps {
  sim: Sim; theme: BattleTheme; proj: Projection; isBoss: boolean; bossArt?: any; roomArt?: Record<EnemyRole, any>;
  focusId?: number; current: Raider | null; reachable: { row: number; col: number }[];
  bossMonster?: MonsterLook; roomMonsters?: Record<EnemyRole, MonsterLook>;
}

export function Arena3D({ sim, theme, proj, isBoss, bossArt, roomArt, focusId, current, reachable, bossMonster, roomMonsters }: ArenaProps) {
  const bp = sim.bossPos ? bossPos(sim.bossPos.row, sim.bossPos.col) : bossPos(0, Math.floor((GRID_COLS - BOSS_W) / 2));
  const sun = useMemo(() => sunDirection(theme).multiplyScalar(20), [theme]);
  const stunned = sim.stunned || sim.vulnerableRounds > 0;
  const foeKeyFor = (enemyId: number) => (isBoss || enemyId < 0 ? 'boss' : 'e' + enemyId);
  return (
    <>
      <fog attach="fog" args={[theme.sky[2], 12, 55]} />
      <color attach="background" args={[theme.sky[1]]} />
      <hemisphereLight args={[theme.sky[2], theme.ground[0], 1.6]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={sun.toArray() as [number, number, number]} intensity={2.4} color={theme.glow.color} />
      <directionalLight position={[0, 6, 8]} intensity={1.2} color="#ffffff" />
      <Scenery theme={theme} />
      <Board sim={sim} theme={theme} current={current} reachable={reachable} proj={proj} />
      {isBoss ? (
        <FoeFigure
          id="boss" art={bossArt} monster={bossMonster} x={bp.x} z={bp.z} size={BOSS_CARD} alive={sim.boss.hp > 0} hp={sim.boss.hp} focused={false}
          stunned={stunned} windup={sim.windup} poisoned={!!sim.bossPoison} shell={sim.iceShell} phase={sim.phase} isBoss fx={sim.fx} proj={proj}
        />
      ) : sim.enemies.map((e) => (
        <FoeFigure
          key={e.id} id={'e' + e.id} art={roomArt ? roomArt[e.role] : undefined} monster={roomMonsters?.[e.role]} x={colX(e.col)} z={rowZ(e.row)}
          size={ROOM_CARD} alive={e.alive} hp={e.hp} focused={e.alive && e.id === focusId} stunned={stunned} windup={sim.windup}
          poisoned={sim.bossPoison?.enemyId === e.id} shell={false} phase={1} isBoss={false} fx={sim.fx} proj={proj}
        />
      ))}
      {sim.raiders.map((r) => (
        <RaiderFigure key={r.id} r={r} sim={sim} proj={proj} active={current?.id === r.id} poisoned={sim.poison?.targetId === r.id} />
      ))}
      <Effects sim={sim} proj={proj} foeKeyFor={foeKeyFor} />
      <CameraRig sim={sim} current={current} proj={proj} />
    </>
  );
}
