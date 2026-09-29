import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from './r3f';
import { useArt } from './textures';
import { HeroAnim, HeroModel } from './HeroModel';
import { HERO_LOOKS } from './heroLooks';
import { MeshyFoe } from './MeshyModel';
import { MODEL_HEIGHT, SHEET_MODELS } from './heroFigures';
import { GearLook } from './gearLooks';
import { CreatureAnim, CreatureModel } from './CreatureModel';
import { MonsterLook } from './monsterLooks';
import { Projection } from './projection';
import { Scenery, sunDirection } from './Scenery';
import { Stage } from './Stage';
import { Tile, TileState } from './BoardTiles';
import { Burst, Comet, GroundRing, Slash } from './SpellFx';
import {
  BOSS_CARD, CAMERA_HOME, CAMERA_LOOK, FIGURE_SCALE, RAIDER_CARD, ROOM_CARD, TILE_SIZE, bossPos, colX, rowZ, tilePos,
} from './world';
import { BattleTheme } from '../components/BattleBackdrop';
import { BOSS_H, BOSS_W, CombatFx, EnemyRole, GRID_COLS, GRID_ROWS, Raider, Sim } from '../combat/types';
import { impactDelay, PROJECTILE_MS } from '../components/CombatFx';
import { portraitSource } from '../data/portraits';
import { colors, roleColor } from '../theme/theme';

const WHITE = new THREE.Color('#ffffff');
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

/**
 * Walks `pos` toward `to` like a person would: it speeds up, keeps a steady
 * pace, and slows to a stop on the cell instead of the old exponential slide
 * (fast start, long crawl). Returns the speed, smoothed, for the walk/run clips.
 */
interface Stride { vel: number; speed: number; dir: THREE.Vector3 }
const newStride = (): Stride => ({ vel: 0, speed: 0, dir: new THREE.Vector3(0, 0, -1) });
const _step = new THREE.Vector3();
function stride(pos: THREE.Vector3, to: THREE.Vector3, s: Stride, dt: number, vmax: number, accel: number): number {
  _step.subVectors(to, pos); _step.y = 0;
  const dist = _step.length();
  if (dist < 1e-3) { pos.x = to.x; pos.z = to.z; s.vel = 0; }
  else {
    // As fast as it may go, but never faster than it can still stop in the distance left.
    const want = Math.min(vmax, Math.sqrt(2 * accel * dist));
    s.vel = s.vel < want ? Math.min(want, s.vel + accel * dt) : want;
    const d = Math.min(dist, s.vel * dt);
    _step.multiplyScalar(1 / dist);
    s.dir.copy(_step);
    pos.addScaledVector(_step, d);
  }
  s.speed += (s.vel - s.speed) * (1 - Math.exp(-dt * 12));
  return s.speed;
}
/** Turns `yaw` toward `want` at a steady rate, the short way round. */
function turnTo(yaw: number, want: number, rate: number, dt: number): number {
  let diff = want - yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return yaw + diff * (1 - Math.exp(-dt * rate));
}

function faceCamera(obj: THREE.Object3D, from: THREE.Vector3, camera: THREE.Camera) {
  obj.rotation.y = Math.atan2(camera.position.x - from.x, camera.position.z - from.z);
}

function RaiderFigure({ r, sim, proj, active, poisoned, gear }: { r: Raider; sim: Sim; proj: Projection; active: boolean; poisoned: boolean; gear?: GearLook }) {
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
  const walk = useRef(newStride());
  const sheet = SHEET_MODELS[r.candidateId];
  const figH = sheet ? sheet.height * FIGURE_SCALE : look ? MODEL_HEIGHT[look.build] * FIGURE_SCALE : 0.08 + RAIDER_CARD;
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
  // A side-step when an area blow lands beside them, and a cheer when the fight is won.
  useEffect(() => {
    if (sim.dodge.seq && sim.dodge.ids.includes(r.id)) { ev.current.lunge = clock.elapsedTime; ev.current.kind = 'dodge'; }
  }, [sim.dodge.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sim.victory && r.alive) { ev.current.lunge = clock.elapsedTime + Math.random() * 0.3; ev.current.kind = 'victory'; }
  }, [sim.victory]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((st, dt) => {
    const g = root.current; if (!g) return;
    const t = st.clock.elapsedTime;
    prevPos.copy(pos.current);
    const speed = stride(pos.current, tilePos(r.row, r.col), walk.current, dt, look ? 1.5 : 4, look ? 5 : 12);
    const walking = speed > 0.15;
    // Models face the nearest enemy while acting (lunges go that way too); waiting
    // for their turn they stand three-quarters on to the camera, so faces show;
    // walking, they look where they are going.
    let fx = 0, fz = -1;
    const busy = active || t - ev.current.lunge < 1.1 || walking;
    if (look && r.alive) {
      let best: THREE.Vector3 | null = null; let bd = Infinity;
      for (const [k, v] of proj.world) {
        if (k !== 'boss' && !k.startsWith('e')) continue;
        const d = (v.x - pos.current.x) ** 2 + (v.z - pos.current.z) ** 2;
        if (d < bd) { bd = d; best = v; }
      }
      if (best) {
        let want = Math.atan2(best.x - pos.current.x, best.z - pos.current.z);
        if (!busy) {
          // Turn ~65° off the enemy towards the camera, opening inwards to the board's middle.
          const inward = pos.current.x > 0.01 ? -1 : 1;
          const a = want + 1.15, b = want - 1.15;
          const score = (y: number) => Math.cos(y) + Math.sin(y) * inward * 0.3;
          want = score(a) >= score(b) ? a : b;
        }
        if (walking) want = Math.atan2(walk.current.dir.x, walk.current.dir.z);
        yaw.current = turnTo(yaw.current, want, walking ? 10 : busy ? 8 : 3, dt);
      }
      const face = look && r.alive && busy ? yaw.current : NaN;
      fx = Number.isNaN(face) ? 0 : Math.sin(face); fz = Number.isNaN(face) ? -1 : Math.cos(face);
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
      a.speed = speed;
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
        <group ref={model} position={[0, 0.06, 0]} scale={[FIGURE_SCALE, FIGURE_SCALE, FIGURE_SCALE]}>
          {sheet ? <sheet.Model anim={anim} gear={gear} /> : <HeroModel look={look} anim={anim} gear={gear} />}
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
  const life = !!monster && 'lifeSize' in monster && !!monster.lifeSize;
  const mscale = life ? FIGURE_SCALE : isBoss ? 2.1 : 1.15 * FIGURE_SCALE;
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
  const walk = useRef(newStride());
  const target = useMemo(() => new THREE.Vector3(), []);
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
      // Walking, it looks where it is going; standing, at the nearest raider.
      const walking = walk.current.speed > 0.15;
      if (walking) yaw.current = turnTo(yaw.current, Math.atan2(walk.current.dir.x, walk.current.dir.z), 10, dt);
      else if (best) yaw.current = turnTo(yaw.current, Math.atan2(best.x - at.current.x, best.z - at.current.z), 6, dt);
      fx0 = Math.sin(yaw.current); fz0 = Math.cos(yaw.current);
    }
    let dz = 0, dx = 0, sx = 0;
    const lt = t - e.lunge;
    if (lt < 0.33) { const k = 0.7 * (lt < 0.11 ? lt / 0.11 : 1 - (lt - 0.11) / 0.22); dz = fz0 * k; dx = fx0 * k; }
    const ht = t - e.hit;
    if (ht >= 0 && ht < 0.3) sx = Math.sin(ht * 70) * 0.08 * (1 - ht / 0.3);
    sx += e.rear * Math.sin(t * 80) * 0.03;
    // Walks to its new cell; a small bob while moving sells the step.
    const moving = stride(at.current, target.set(x, 0, z), walk.current, dt, isBoss ? 1.2 : 1.5, isBoss ? 4 : 5);
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

  const baseR = isBoss && !life ? 1.25 : isBoss ? 0.55 : 0.4;
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
          {'humanoid' in monster
            ? monster.meshy ? <MeshyFoe body={monster.meshy} look={monster.humanoid} anim={heroAnim} /> : <HeroModel look={monster.humanoid} anim={heroAnim} />
            : <CreatureModel look={monster.creature} anim={creAnim} />}
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
      <Stage theme={theme} />
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

/** Spell colour of a raider: their look's glow, else by what they do. */
function fxColor(sim: Sim, raiderId: number, kind: string | null): string {
  const r = sim.raiders.find((x) => x.id === raiderId);
  const glow = r ? HERO_LOOKS[r.candidateId]?.glow : undefined;
  if (kind === 'heal') return '#7dffa8';
  return glow ?? (kind === 'ability' ? colors.accent : '#ffb35c');
}

type Fx =
  | { t: 'comet'; key: string; from: THREE.Vector3; to: THREE.Vector3; color: string; arc: number; arrow: boolean; big: boolean; heal: boolean }
  | { t: 'burst'; key: string; at: THREE.Vector3; color: string; n: number; speed: number; up: number; size: number; flash: number }
  | { t: 'ring'; key: string; at: THREE.Vector3; color: string; radius: number }
  | { t: 'slash'; key: string; at: THREE.Vector3; flip: boolean }
  | { t: 'pillar'; key: string; row: number; col: number; hot: boolean }
  | { t: 'wave'; key: string; at: THREE.Vector3 };

function Effects({ sim, proj, foeKeyFor }: { sim: Sim; proj: Projection; foeKeyFor: (enemyId: number) => string }) {
  const [fx, setFx] = useState<Fx[]>([]);
  const addFx = (...xs: Fx[]) => setFx((cur) => [...cur, ...xs]);
  const drop = (key: string) => setFx((cur) => cur.filter((x) => x.key !== key));
  useEffect(() => {
    const f = sim.fx;
    if (!f.seq || typeof f.actor !== 'number') return;
    const from = proj.world.get('r' + f.actor)?.clone();
    if (!from) return;
    const color = fxColor(sim, f.actor, f.kind);
    const raider = sim.raiders.find((x) => x.id === f.actor);
    const archer = !!raider && HERO_LOOKS[raider.candidateId]?.weapon === 'bow';
    const k = String(f.seq);
    if (f.kind === 'rally') addFx({ t: 'wave', key: 'w' + k, at: from }, { t: 'burst', key: 'rb' + k, at: from.clone().setY(0.3), color: colors.warn, n: 30, speed: 1.2, up: 2, size: 0.12, flash: 0 });
    if ((f.kind === 'ranged' || f.kind === 'ability') && f.targetEnemy != null) {
      const to = proj.world.get(foeKeyFor(f.targetEnemy))?.clone();
      if (to) addFx({ t: 'comet', key: 'c' + k, from: from.clone().setY(from.y + 0.2), to, color, arc: archer ? 0.35 : 0.9, arrow: archer && f.kind === 'ranged', big: f.kind === 'ability', heal: false });
      if (f.kind === 'ability') addFx({ t: 'burst', key: 'cast' + k, at: from.clone().setY(from.y + 0.3), color, n: 14, speed: 1, up: 1.5, size: 0.12, flash: 0.6 });
    } else if (f.kind === 'melee' && f.targetEnemy != null) {
      const to = proj.world.get(foeKeyFor(f.targetEnemy))?.clone();
      if (to) {
        const at = to.clone().lerp(from, 0.25);
        setTimeout(() => addFx({ t: 'slash', key: 's' + k, at, flip: Math.random() < 0.5 }, { t: 'burst', key: 'sb' + k, at, color: f.crit ? '#ffd24a' : '#ffe9c8', n: f.crit ? 30 : 16, speed: f.crit ? 4 : 2.6, up: 0.2, size: 0.1, flash: f.crit ? 0.8 : 0.4 }), impactDelay(f));
      }
    } else if (f.targetRaider != null) {
      const to = proj.world.get('r' + f.targetRaider)?.clone();
      if (to && f.targetRaider !== f.actor) addFx({ t: 'comet', key: 'c' + k, from, to, color, arc: 0.6, arrow: false, big: false, heal: f.kind === 'heal' });
      else if (to) addFx({ t: 'burst', key: 'h' + k, at: to.clone().setY(0.2), color, n: 26, speed: 0.8, up: 3, size: 0.13, flash: 0.5 }, { t: 'ring', key: 'hr' + k, at: to, color, radius: 1.1 });
    }
  }, [sim.fx.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sim.impact.seq || !sim.impact.cells.length) return;
    const hot = sim.impact.kind === 'meteor' || sim.impact.kind === 'devour';
    addFx(...sim.impact.cells.flatMap((c): Fx[] => {
      const [row, col] = c.split(',').map(Number);
      const key = sim.impact.seq + ':' + c;
      const at = new THREE.Vector3(colX(col), 0.25, rowZ(row));
      return [{ t: 'pillar', key: 'p' + key, row, col, hot }, { t: 'burst', key: 'pb' + key, at, color: hot ? '#ff7a2a' : '#dfe4ff', n: 14, speed: 3, up: 0.8, size: 0.14, flash: 0.7 }];
    }));
  }, [sim.impact.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  // A foe falls: a puff of bone dust and a dark ring where it stood.
  const standing = useRef(new Set<string>());
  useEffect(() => {
    const now = new Set([...sim.enemies, ...sim.minions].filter((e) => e.alive).map((e) => 'e' + e.id));
    if (!sim.enemies.length && sim.boss.hp > 0) now.add('boss');
    for (const k of standing.current) if (!now.has(k)) {
      const at = proj.world.get(k)?.clone();
      if (!at) continue;
      const boss = k === 'boss', key = 'd' + k + ':' + sim.fx.seq;
      setTimeout(() => addFx(
        { t: 'burst', key: key + 'b', at: at.clone().setY(0.5), color: '#d8ccb0', n: boss ? 70 : 36, speed: boss ? 3.2 : 2.2, up: 1.4, size: boss ? 0.2 : 0.14, flash: 0.35 },
        { t: 'ring', key: key + 'r', at, color: '#3a2a3e', radius: boss ? 2.6 : 1.4 },
      ), impactDelay(sim.fx) + 80);
    }
    standing.current = now;
  });
  const arrive = (c: Extract<Fx, { t: 'comet' }>) => (at: THREE.Vector3) => {
    drop(c.key);
    if (c.heal) addFx({ t: 'burst', key: 'ha' + c.key, at: at.clone().setY(0.2), color: c.color, n: 26, speed: 0.8, up: 3, size: 0.13, flash: 0.5 }, { t: 'ring', key: 'hra' + c.key, at, color: c.color, radius: 1.1 });
    else if (c.arrow) addFx({ t: 'burst', key: 'a' + c.key, at, color: '#e8dcc8', n: 10, speed: 2, up: 0.3, size: 0.08, flash: 0.3 });
    else addFx(
      { t: 'burst', key: 'a' + c.key, at, color: c.color, n: c.big ? 40 : 24, speed: c.big ? 4.5 : 3, up: 0.3, size: c.big ? 0.2 : 0.15, flash: 1 },
      ...(c.big ? [{ t: 'ring', key: 'ar' + c.key, at, color: c.color, radius: 2 } as Fx] : []),
    );
  };
  return (
    <>
      {fx.map((x) => {
        switch (x.t) {
          case 'comet': return <Comet key={x.key} from={x.from} to={x.to} color={x.color} arc={x.arc} ms={PROJECTILE_MS} arrow={x.arrow} onArrive={arrive(x)} />;
          case 'burst': return <Burst key={x.key} at={x.at} color={x.color} n={x.n} speed={x.speed} up={x.up} size={x.size} flash={x.flash} onDone={() => drop(x.key)} />;
          case 'ring': return <GroundRing key={x.key} at={x.at} color={x.color} radius={x.radius} onDone={() => drop(x.key)} />;
          case 'slash': return <Slash key={x.key} at={x.at} flip={x.flip} onDone={() => drop(x.key)} />;
          case 'pillar': return <Pillar key={x.key} row={x.row} col={x.col} hot={x.hot} onDone={() => drop(x.key)} />;
          case 'wave': return <Wave key={x.key} at={x.at} onDone={() => drop(x.key)} />;
        }
      })}
      {sim.pendingCast ? <Beam proj={proj} a="boss" b={'r' + sim.pendingCast.targetId} color={colors.danger} width={0.035} /> : null}
      {sim.chain ? <Beam proj={proj} a={'r' + sim.chain.aId} b={'r' + sim.chain.bId} color={colors.accent} width={0.025} /> : null}
    </>
  );
}

// ── camera ─────────────────────────────────────────────────

/** The player's turn of the camera round the board, radians (a full circle either way); set by dragging the field. */
export interface Orbit { yaw: number }

function CameraRig({ sim, current, proj, closeUp, focusId, intro, orbit }: { sim: Sim; current: Raider | null; proj: Projection; closeUp: boolean; focusId?: number; intro: boolean; orbit?: React.MutableRefObject<Orbit> }) {
  const yaw = useRef(0);
  const introAt = useRef(-1);
  const { camera, size } = useThree();
  const look = useRef(CAMERA_LOOK.clone());
  const shakeAt = useRef(-99);
  const prevShake = useRef(sim.shakeSeq);
  const clock = useThree((s) => s.clock);
  useEffect(() => {
    if (sim.shakeSeq !== prevShake.current) { shakeAt.current = clock.elapsedTime; prevShake.current = sim.shakeSeq; }
  }, [sim.shakeSeq, clock]);
  // Crits jolt the camera when the blow lands.
  const critFx = useRef(sim.fx.seq);
  useEffect(() => {
    const f = sim.fx;
    if (f.seq !== critFx.current && f.crit && typeof f.actor === 'number') shakeAt.current = clock.elapsedTime + impactDelay(f) / 1000;
    critFx.current = f.seq;
  }, [sim.fx.seq, clock]); // eslint-disable-line react-hooks/exhaustive-deps
  // A foe falls: push in on it for a moment.
  const alive = useRef(new Set<string>());
  const kill = useRef<{ at: number; where: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const now = new Set([...sim.enemies, ...sim.minions].filter((e) => e.alive).map((e) => 'e' + e.id));
    if (!sim.enemies.length && sim.boss.hp > 0) now.add('boss');
    for (const k of alive.current) if (!now.has(k)) {
      const where = proj.world.get(k);
      if (where) { kill.current = { at: clock.elapsedTime, where: where.clone() }; shakeAt.current = clock.elapsedTime + 0.1; }
    }
    alive.current = now;
  });
  const want = useMemo(() => new THREE.Vector3(), []);
  const wantLook = useMemo(() => new THREE.Vector3(), []);
  const focus = useMemo(() => new THREE.Vector3(), []);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const bossAt = proj.world.get('boss');
    if (intro && bossAt) {
      // Title card: a slow half-circle round the boss, rising and pulling back.
      if (introAt.current < 0) introAt.current = t;
      const k = Math.min(1, (t - introAt.current) / 3.6);
      const e = k * k * (3 - 2 * k);
      const ang = -1.25 + e * 1.45;
      const r = 3.1 + e * 1.4;
      camera.position.set(bossAt.x + Math.sin(ang) * r, 0.9 + e * 1.6, bossAt.z + Math.cos(ang) * r);
      look.current.set(bossAt.x, 1.1 + e * 0.2, bossAt.z);
      camera.lookAt(look.current);
      proj.project(camera, size.width, size.height);
      return;
    }
    introAt.current = -1;
    const enemyTurn = sim.order[sim.turnPos]?.kind === 'boss';
    let dist = 1; let pull = 0;
    const foe = proj.world.get('boss') ?? [...proj.world.entries()].find(([k]) => k.startsWith('e'))?.[1];
    if (sim.windup && foe) { focus.copy(foe); dist = 0.78; pull = 0.35; }
    else if (enemyTurn && foe) { focus.copy(foe); dist = 0.94; pull = 0.2; }
    else if (current) { const c = proj.world.get('r' + current.id); if (c) focus.copy(c); else focus.copy(tilePos(current.row, current.col)); dist = 0.97; pull = 0.12; }
    else { focus.copy(CAMERA_LOOK); }
    const kt = kill.current ? t - kill.current.at : 99;
    if (kt < 1.1 && kill.current) {
      // Ease in over 0.25 s, hold, and let go.
      const w = Math.min(1, kt / 0.25) * Math.min(1, (1.1 - kt) / 0.4);
      focus.lerp(kill.current.where, w * 0.8); dist *= 1 - 0.18 * w; pull = Math.max(pull, 0.5 * w);
    }
    if (closeUp) {
      // Close-up: frame whoever is acting. On a hero's turn (after moving) take in their
      // target too, so it stays on screen to tap.
      const hero = current ? proj.world.get('r' + current.id) : undefined;
      const target = proj.world.get(focusId != null ? 'e' + focusId : 'boss') ?? foe;
      if (hero && !enemyTurn && !sim.windup) {
        focus.copy(hero);
        if (!sim.movePhase && target) focus.lerp(target, 0.4);
        // Look a little past the hero, so they stand in the lower part of the frame.
        focus.z -= 1.7;
      }
      dist = sim.movePhase ? 0.84 : 0.72;
      pull = 0.9;
    }
    wantLook.copy(CAMERA_LOOK).lerp(focus, pull);
    want.copy(CAMERA_HOME).sub(CAMERA_LOOK).multiplyScalar(dist).add(wantLook);
    want.x += Math.sin(t * 0.35) * 0.12 + focus.x * pull * (closeUp ? 0.2 : 0.5);
    want.y += Math.sin(t * 0.5) * 0.05;
    // Swing round the look point by the player's orbit (smoothed, so the camera arcs rather than cuts through).
    const target = orbit?.current.yaw ?? 0;
    yaw.current += (target - yaw.current) * (1 - Math.exp(-dt * 8));
    if (Math.abs(yaw.current) > 1e-4) {
      // Turn both the camera and its aim round the board's centre. The stage's ruins stand close
      // behind the enemy rows, so the further round we go the more the camera draws in and rises.
      const away = Math.abs(Math.sin(yaw.current / 2));
      want.applyAxisAngle(UP, yaw.current);
      wantLook.applyAxisAngle(UP, yaw.current);
      want.x *= 1 - 0.4 * away; want.z *= 1 - 0.4 * away; want.y += 1.2 * away;
    }
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
  orbit?: React.MutableRefObject<Orbit>;
  sim: Sim; theme: BattleTheme; proj: Projection; isBoss: boolean; bossArt?: any; roomArt?: Record<EnemyRole, any>;
  focusId?: number; current: Raider | null; reachable: { row: number; col: number }[];
  /** How each hero's worn gear looks, by candidate id. */
  heroGear?: Record<number, GearLook>;
  /** Camera close on whoever is acting instead of the whole board. */
  closeUp?: boolean;
  /** Boss title card showing: the camera circles the boss. */
  intro?: boolean;
  /** Share of weather particles to draw, 0 … 1 (graphics quality). */
  weather?: number;
  bossMonster?: MonsterLook; roomMonsters?: Record<EnemyRole, MonsterLook>;
}

export function Arena3D({ sim, theme, proj, isBoss, bossArt, roomArt, focusId, current, reachable, bossMonster, roomMonsters, heroGear, closeUp = false, intro = false, weather = 1, orbit }: ArenaProps) {
  const bp = sim.bossPos ? bossPos(sim.bossPos.row, sim.bossPos.col) : bossPos(0, Math.floor((GRID_COLS - BOSS_W) / 2));
  const sun = useMemo(() => sunDirection(theme).multiplyScalar(20), [theme]);
  const stunned = sim.stunned || sim.vulnerableRounds > 0;
  // Raised skeletons in a boss fight are keyed like room enemies.
  const foeKeyFor = (enemyId: number) => (enemyId < 0 || (isBoss && !sim.minions.some((m) => m.id === enemyId)) ? 'boss' : 'e' + enemyId);
  return (
    <>
      <fog attach="fog" args={[theme.sky[2], 12, 55]} />
      <color attach="background" args={[theme.sky[1]]} />
      <hemisphereLight args={[theme.sky[2], theme.ground[0], 1.6]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={sun.toArray() as [number, number, number]} intensity={2.4} color={theme.glow.color} />
      <directionalLight position={[0, 6, 8]} intensity={1.2} color="#ffffff" />
      <Scenery theme={theme} weather={weather} />
      <Board sim={sim} theme={theme} current={current} reachable={reachable} proj={proj} />
      {isBoss ? (
        <FoeFigure
          id="boss" art={bossArt} monster={bossMonster} x={bp.x} z={bp.z} size={BOSS_CARD} alive={sim.boss.hp > 0} hp={sim.boss.hp} focused={false}
          stunned={stunned} windup={sim.windup} poisoned={!!sim.bossPoison} shell={sim.iceShell} phase={sim.phase} isBoss fx={sim.fx} proj={proj}
        />
      ) : null}
      {(isBoss ? sim.minions : sim.enemies).map((e) => (
        <FoeFigure
          key={e.id} id={'e' + e.id} art={roomArt ? roomArt[e.role] : undefined} monster={roomMonsters?.[e.role]} x={colX(e.col)} z={rowZ(e.row)}
          size={ROOM_CARD} alive={e.alive} hp={e.hp} focused={e.alive && e.id === focusId} stunned={!isBoss && stunned} windup={!isBoss && sim.windup}
          poisoned={sim.bossPoison?.enemyId === e.id} shell={false} phase={1} isBoss={false} fx={sim.fx} proj={proj}
        />
      ))}
      {sim.raiders.map((r) => (
        <RaiderFigure key={r.id} r={r} sim={sim} proj={proj} active={current?.id === r.id} poisoned={sim.poison?.targetId === r.id} gear={heroGear?.[r.candidateId]} />
      ))}
      <Effects sim={sim} proj={proj} foeKeyFor={foeKeyFor} />
      <CameraRig sim={sim} current={current} proj={proj} closeUp={closeUp} focusId={focusId} intro={intro} orbit={orbit} />
    </>
  );
}
