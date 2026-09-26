import React, { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, View } from 'react-native';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from './r3f';
import { HeroAnim, HeroModel } from './HeroModel';
import { HERO_LOOKS } from './heroLooks';
import { MODEL_HEIGHT, SHEET_MODELS } from './heroFigures';
import { Guard } from './Battle3D';
import { GearLook, withGear } from './gearLooks';

// A hero on a pedestal for the equipment sheet: turns slowly on its own,
// follows a horizontal drag, and shows off its attack when tapped.

/** Dragging to turn the hero shouldn't select the page's text on web. */
const NO_SELECT = Platform.OS === 'web' ? ({ userSelect: 'none' } as object) : null;

interface Spin { yaw: number; dragging: boolean; tap: boolean }

function actionFor(id: number, gear?: GearLook): HeroAnim['kind'] {
  const base = HERO_LOOKS[id];
  const w = base ? withGear(base, gear).weapon : undefined;
  if (w === 'bow' || w === 'flask') return 'ranged';
  if (w === 'staff' || w === 'orb' || w === 'book') return 'ability';
  return 'melee';
}

function Stage({ id, spin, gear }: { id: number; spin: React.MutableRefObject<Spin>; gear?: GearLook }) {
  const look = HERO_LOOKS[id];
  const sheet = SHEET_MODELS[id];
  const h = sheet ? sheet.height : look ? MODEL_HEIGHT[look.build] : 1.1;
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    // Feet a quarter of the way up (the name sits below), headroom for raised weapons.
    camera.position.set(0, h * 0.55, h * 2.9);
    camera.lookAt(0, h * 0.39, 0);
  }, [camera, h]);
  const turn = useRef<THREE.Group>(null);
  const anim = useRef<HeroAnim>({ kind: '', at: -99, hit: -99, deadAt: -1, alive: true, defending: false, speed: 0, frozen: false });
  const kind = useMemo(() => actionFor(id, gear), [id, gear]);

  useFrame((st, dt) => {
    const s = spin.current;
    if (!s.dragging) s.yaw += dt * 0.35;
    if (s.tap) { s.tap = false; anim.current.kind = kind; anim.current.at = st.clock.elapsedTime; }
    if (turn.current) turn.current.rotation.y = s.yaw;
  });

  return (
    <>
      <color attach="background" args={['#15120e']} />
      <hemisphereLight args={['#fff1dc', '#2a2118', 1.9]} />
      <directionalLight position={[1.5, 3, 2.5]} intensity={2.2} color="#ffe8c8" />
      <directionalLight position={[-2, 1.5, -2]} intensity={1.1} color="#9fb4ff" />
      {/* pedestal */}
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[h * 0.42, h * 0.46, 0.08, 24]} />
        <meshLambertMaterial color="#2a241c" />
      </mesh>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[h * 0.36, h * 0.41, 32]} />
        <meshBasicMaterial color={gear?.best ?? '#8a7650'} />
      </mesh>
      <group ref={turn}>
        {sheet ? <sheet.Model anim={anim} gear={gear} /> : look ? <HeroModel look={look} anim={anim} gear={gear} /> : null}
      </group>
    </>
  );
}

export function HeroPreview3D({ id, width, height, onFail, gear }: { id: number; width: number; height: number; onFail: (e: unknown) => void; gear?: GearLook }) {
  const spin = useRef<Spin>({ yaw: 0.5, dragging: false, tap: false });
  const startYaw = useRef(0);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
    onPanResponderTerminationRequest: () => true,
    onPanResponderGrant: () => { startYaw.current = spin.current.yaw; spin.current.dragging = true; },
    onPanResponderMove: (_, g) => { spin.current.yaw = startYaw.current + g.dx * 0.018; },
    onPanResponderRelease: (_, g) => {
      spin.current.dragging = false;
      if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) spin.current.tap = true;
    },
    onPanResponderTerminate: () => { spin.current.dragging = false; },
  }), []);
  const camera = useMemo(() => ({ position: [0, 0.8, 2.8] as [number, number, number], fov: 30, near: 0.05, far: 50 }), []);
  return (
    <View testID="hero-3d" style={[{ width, height }, NO_SELECT]}>
      <Guard onFail={onFail}>
        <Canvas camera={camera} style={{ flex: 1 }} gl={{ antialias: true }}>
          <Stage id={id} spin={spin} gear={gear} />
        </Canvas>
      </Guard>
      <View {...pan.panHandlers} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />
    </View>
  );
}
