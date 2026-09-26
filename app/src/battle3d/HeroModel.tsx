import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from './r3f';
import { HeroLook } from './heroLooks';
import { GearLook, TWO_HANDED, withGear } from './gearLooks';

// A low-poly hero built from primitives: faceted, flat-shaded, no textures.
// It is a small skeleton of pivots (hips, knees, shoulders, elbows, neck) so
// every action can be posed: idle breathing, walking, swings, shots, casts,
// flinching and falling. The figure faces +Z; the caller turns it.

/** Live animation inputs, written by the owner each frame. Times are clock seconds. */
export interface HeroAnim {
  kind: string;        // last action: 'melee' | 'ranged' | 'ability' | 'heal' | 'rally' | ''
  at: number;          // when that action started
  hit: number;         // when the last hit landed
  deadAt: number;      // -1 while alive
  alive: boolean;
  defending: boolean;
  speed: number;       // world units / second the figure is currently moving
  frozen: boolean;
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 6),
  taper: new THREE.CylinderGeometry(0.78, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  disc: new THREE.CylinderGeometry(1, 1, 1, 8),
  bow: new THREE.TorusGeometry(1, 0.05, 4, 10, Math.PI * 0.9),
};

const BUILD = {
  human: { size: 1, width: 1, legs: 1, head: 1 },
  dwarf: { size: 0.86, width: 1.32, legs: 0.66, head: 1.12 },
  orc: { size: 1.1, width: 1.34, legs: 1, head: 1.05 },
  elf: { size: 1.05, width: 0.88, legs: 1.06, head: 0.96 },
  gnome: { size: 0.74, width: 0.96, legs: 0.8, head: 1.35 },
  brute: { size: 1.18, width: 1.75, legs: 0.85, head: 1 },
  golem: { size: 1.3, width: 1.6, legs: 0.9, head: 0.85 },
  imp: { size: 0.82, width: 1, legs: 0.9, head: 1.25 },
} as const;

type Mats = Record<'skin' | 'hair' | 'primary' | 'secondary' | 'metal' | 'dark' | 'cape' | 'shield' | 'emblem' | 'wood' | 'leaf', THREE.MeshLambertMaterial> & { glow: THREE.MeshBasicMaterial; eye: THREE.MeshBasicMaterial; crack: THREE.MeshBasicMaterial };

function makeMats(look: HeroLook): Mats {
  const m = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, transparent: !!look.ghost, opacity: look.ghost ? 0.82 : 1 });
  return {
    skin: m(look.skin), hair: m(look.hair), primary: m(look.primary), secondary: m(look.secondary), metal: m(look.metal),
    dark: m('#141214'), cape: m(look.fishTail ?? look.cape ?? look.primary), shield: m(look.shieldColor ?? look.secondary), emblem: m(look.emblem ?? look.metal),
    wood: m('#6a4a2e'),
    leaf: m(look.leaves ?? look.hair),
    glow: new THREE.MeshBasicMaterial({ color: look.glow ?? '#ffffff', toneMapped: false }),
    eye: new THREE.MeshBasicMaterial({ color: look.eyes ?? look.glow ?? '#ffffff', toneMapped: false }),
    crack: new THREE.MeshBasicMaterial({ color: look.cracks ?? '#ffffff', toneMapped: false }),
  };
}

type V3 = [number, number, number];
function Part({ g, m, p, s, r }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V3; s: V3; r?: V3 }) {
  return <mesh geometry={g} material={m} position={p ?? [0, 0, 0]} scale={s} rotation={r ?? [0, 0, 0]} />;
}

/** Weapon in the right hand, modelled pointing up its local +Y from the grip. */
function WeaponMesh({ look, mats }: { look: HeroLook; mats: Mats }) {
  switch (look.weapon) {
    case 'sword': return (<>
      <Part g={G.cyl} m={mats.secondary} p={[0, 0.02, 0]} s={[0.018, 0.1, 0.018]} />
      <Part g={G.box} m={mats.metal} p={[0, 0.08, 0]} s={[0.13, 0.025, 0.03]} />
      <Part g={G.box} m={mats.metal} p={[0, 0.34, 0]} s={[0.045, 0.5, 0.012]} />
    </>);
    case 'axe': return (<>
      <Part g={G.cyl} m={mats.wood} p={[0, 0.2, 0]} s={[0.02, 0.5, 0.02]} />
      <Part g={G.box} m={mats.metal} p={[0.07, 0.4, 0]} s={[0.14, 0.13, 0.02]} />
      <Part g={G.cone4} m={mats.metal} p={[0.15, 0.4, 0]} s={[0.07, 0.02, 0.1]} r={[0, 0, Math.PI / 2]} />
    </>);
    case 'mace': return (<>
      <Part g={G.cyl} m={mats.wood} p={[0, 0.18, 0]} s={[0.02, 0.44, 0.02]} />
      <Part g={G.ico} m={mats.metal} p={[0, 0.42, 0]} s={[0.075, 0.075, 0.075]} />
      <Part g={G.cone} m={mats.metal} p={[0, 0.5, 0]} s={[0.03, 0.06, 0.03]} />
    </>);
    case 'greatAxe': return (<>
      <Part g={G.cyl} m={mats.wood} p={[0, 0.25, 0]} s={[0.025, 0.85, 0.025]} />
      <Part g={G.box} m={mats.metal} p={[0.1, 0.6, 0]} s={[0.2, 0.24, 0.025]} />
      <Part g={G.box} m={mats.metal} p={[-0.08, 0.6, 0]} s={[0.14, 0.16, 0.025]} />
    </>);
    case 'greatHammer': return (<>
      <Part g={G.cyl} m={mats.wood} p={[0, 0.25, 0]} s={[0.025, 0.85, 0.025]} />
      <Part g={G.box} m={mats.metal} p={[0, 0.66, 0]} s={[0.3, 0.14, 0.14]} />
    </>);
    case 'dagger': return (<>
      <Part g={G.cyl} m={mats.secondary} p={[0, 0.02, 0]} s={[0.016, 0.07, 0.016]} />
      <Part g={G.box} m={look.glow ? mats.glow : mats.metal} p={[0, 0.15, 0]} s={[0.035, 0.2, 0.01]} />
    </>);
    case 'staff': return (<>
      <Part g={G.cyl} m={mats.wood} p={[0, 0.12, 0]} s={[0.022, 1.0, 0.022]} />
      <Part g={G.cone} m={mats.metal} p={[0, 0.66, 0]} s={[0.05, 0.1, 0.05]} r={[Math.PI, 0, 0]} />
      <Part g={G.ico} m={mats.glow} p={[0, 0.72, 0]} s={[0.065, 0.065, 0.065]} />
    </>);
    case 'bow': return null; // held in the left hand, see OffHandMesh
    case 'flask': return (<>
      <Part g={G.ico1} m={mats.glow} p={[0, 0.06, 0]} s={[0.055, 0.055, 0.055]} />
      <Part g={G.cyl} m={mats.metal} p={[0, 0.13, 0]} s={[0.018, 0.05, 0.018]} />
    </>);
    case 'claws': return null;
    case 'trident': return (<>
      <Part g={G.cyl} m={mats.metal} p={[0, 0.12, 0]} s={[0.02, 1.0, 0.02]} />
      <Part g={G.box} m={mats.metal} p={[0, 0.62, 0]} s={[0.2, 0.025, 0.025]} />
      <Part g={G.cone} m={mats.metal} p={[0, 0.72, 0]} s={[0.025, 0.16, 0.025]} />
      <Part g={G.cone} m={mats.metal} p={[0.09, 0.69, 0]} s={[0.02, 0.12, 0.02]} />
      <Part g={G.cone} m={mats.metal} p={[-0.09, 0.69, 0]} s={[0.02, 0.12, 0.02]} />
    </>);
    case 'orb': return (<>
      <Part g={G.ico1} m={mats.glow} p={[0, 0.08, 0.02]} s={[0.07, 0.07, 0.07]} />
    </>);
    case 'scythe': return (<>
      <Part g={G.cyl} m={mats.wood} p={[0, 0.25, 0]} s={[0.022, 0.95, 0.022]} />
      <Part g={G.box} m={look.glow ? mats.glow : mats.metal} p={[0.13, 0.68, 0]} s={[0.3, 0.05, 0.012]} r={[0, 0, -0.35]} />
      <Part g={G.cone4} m={look.glow ? mats.glow : mats.metal} p={[0.29, 0.6, 0]} s={[0.03, 0.1, 0.01]} r={[0, 0, -2.2]} />
    </>);
    case 'flail': return (<>
      <Part g={G.cyl} m={mats.wood} p={[0, 0.1, 0]} s={[0.02, 0.28, 0.02]} />
      <Part g={G.cyl} m={mats.dark} p={[0.04, 0.26, 0]} s={[0.008, 0.14, 0.008]} r={[0, 0, -0.6]} />
      <Part g={G.ico} m={mats.metal} p={[0.09, 0.31, 0]} s={[0.06, 0.06, 0.06]} />
      <Part g={G.cone} m={mats.metal} p={[0.09, 0.38, 0]} s={[0.02, 0.05, 0.02]} />
      <Part g={G.cone} m={mats.metal} p={[0.16, 0.31, 0]} s={[0.02, 0.05, 0.02]} r={[0, 0, -Math.PI / 2]} />
    </>);
    case 'book': return (<>
      <Part g={G.box} m={mats.secondary} p={[0, 0.06, 0.02]} s={[0.14, 0.17, 0.05]} />
      <Part g={G.box} m={mats.glow} p={[0, 0.06, 0.047]} s={[0.05, 0.05, 0.006]} />
    </>);
  }
}

/** Off-hand item on the left forearm/hand. */
function OffHandMesh({ look, mats }: { look: HeroLook; mats: Mats }) {
  if (look.weapon === 'bow') return (<>
    <Part g={G.bow} m={mats.wood} p={[0, 0, 0.02]} s={[0.32, 0.32, 0.32]} r={[0, Math.PI / 2, Math.PI / 2 + 0.16]} />
    <Part g={G.cyl} m={mats.dark} p={[0, 0, -0.07]} s={[0.004, 0.6, 0.004]} />
  </>);
  switch (look.offHand) {
    case 'roundShield': return (<>
      <Part g={G.disc} m={mats.shield} p={[-0.05, 0.05, 0]} s={[0.2, 0.03, 0.2]} r={[0, 0, Math.PI / 2]} />
      <Part g={G.ico} m={mats.emblem} p={[-0.07, 0.05, 0]} s={[0.05, 0.05, 0.05]} />
    </>);
    case 'kiteShield': return (<>
      <Part g={G.box} m={mats.shield} p={[-0.05, 0.05, 0]} s={[0.025, 0.36, 0.24]} />
      <Part g={G.cone4} m={mats.shield} p={[-0.05, -0.19, 0]} s={[0.012, 0.12, 0.17]} r={[Math.PI, Math.PI / 4, 0]} />
      <Part g={G.box} m={mats.emblem} p={[-0.07, 0.07, 0]} s={[0.01, 0.12, 0.09]} />
    </>);
    case 'towerShield': return (<>
      <Part g={G.box} m={mats.shield} p={[-0.05, 0.02, 0]} s={[0.03, 0.46, 0.26]} />
      <Part g={G.box} m={mats.emblem} p={[-0.07, 0.08, 0]} s={[0.01, 0.2, 0.035]} />
      <Part g={G.box} m={mats.emblem} p={[-0.07, 0.12, 0]} s={[0.01, 0.035, 0.14]} />
    </>);
    case 'dagger': return (
      <group rotation={[Math.PI / 2, 0, 0]}><WeaponMesh look={look} mats={mats} /></group>
    );
    case 'flask': return (<>
      <Part g={G.ico1} m={mats.glow} p={[0, -0.02, 0]} s={[0.045, 0.045, 0.045]} />
    </>);
    default: return null;
  }
}

function Head({ look, mats, helm }: { look: HeroLook; mats: Mats; helm?: React.ReactNode }) {
  const hood = look.headGear !== 'none' && !helm;
  return (
    <>
      <Part g={G.ico} m={mats.skin} s={[0.105, 0.115, 0.105]} />
      {/* eyes */}
      <Part g={G.box} m={look.eyes ? mats.eye : look.glow && look.weapon === 'orb' ? mats.glow : mats.dark} p={[0.037, 0.012, 0.094]} s={look.skeleton ? [0.035, 0.03, 0.012] : [0.022, 0.014, 0.01]} />
      <Part g={G.box} m={look.eyes ? mats.eye : look.glow && look.weapon === 'orb' ? mats.glow : mats.dark} p={[-0.037, 0.012, 0.094]} s={look.skeleton ? [0.035, 0.03, 0.012] : [0.022, 0.014, 0.01]} />
      {look.skeleton ? <Part g={G.box} m={mats.dark} p={[0, -0.06, 0.085]} s={[0.07, 0.025, 0.02]} /> : null}
      {look.wolfHead ? (<>
        <Part g={G.box} m={mats.skin} p={[0, -0.03, 0.13]} s={[0.09, 0.08, 0.14]} />
        <Part g={G.box} m={mats.dark} p={[0, -0.01, 0.205]} s={[0.04, 0.03, 0.02]} />
        <Part g={G.cone4} m={mats.skin} p={[0.06, 0.12, -0.01]} s={[0.035, 0.1, 0.03]} />
        <Part g={G.cone4} m={mats.skin} p={[-0.06, 0.12, -0.01]} s={[0.035, 0.1, 0.03]} />
      </>) : null}
      {look.crown ? [0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return <Part key={i} g={G.cone4} m={mats.emblem} p={[Math.sin(a) * 0.085, 0.12, Math.cos(a) * 0.085]} s={[0.025, 0.08, 0.025]} />;
      }) : null}
      {look.crown ? <Part g={G.cyl} m={mats.emblem} p={[0, 0.09, 0]} s={[0.1, 0.03, 0.1]} /> : null}
      {look.leaves ? (<>
        <Part g={G.ico} m={mats.leaf} p={[0, 0.13, -0.02]} s={[0.2, 0.14, 0.18]} />
        <Part g={G.ico} m={mats.leaf} p={[0.12, 0.08, -0.04]} s={[0.1, 0.09, 0.1]} />
        <Part g={G.ico} m={mats.leaf} p={[-0.12, 0.1, -0.03]} s={[0.1, 0.09, 0.1]} />
      </>) : null}
      {look.ears ? (<>
        <Part g={G.cone4} m={mats.skin} p={[0.105, 0.03, -0.01]} s={[0.02, 0.075, 0.016]} r={[0, 0, -1.1]} />
        <Part g={G.cone4} m={mats.skin} p={[-0.105, 0.03, -0.01]} s={[0.02, 0.075, 0.016]} r={[0, 0, 1.1]} />
      </>) : null}
      {look.horns ? (<>
        <Part g={G.cone} m={mats.dark} p={[0.06, 0.13, -0.02]} s={[0.025, 0.12, 0.025]} r={[-0.5, 0, -0.4]} />
        <Part g={G.cone} m={mats.dark} p={[-0.06, 0.13, -0.02]} s={[0.025, 0.12, 0.025]} r={[-0.5, 0, 0.4]} />
      </>) : null}
      {helm}
      {!hood && !helm && look.hairStyle === 'short' ? <Part g={G.ico} m={mats.hair} p={[0, 0.05, -0.02]} s={[0.112, 0.085, 0.112]} /> : null}
      {!hood && !helm && look.hairStyle === 'long' ? (<>
        <Part g={G.ico} m={mats.hair} p={[0, 0.05, -0.02]} s={[0.114, 0.088, 0.114]} />
        <Part g={G.box} m={mats.hair} p={[0, -0.09, -0.07]} s={[0.19, 0.24, 0.07]} />
      </>) : null}
      {!hood && !helm && look.hairStyle === 'mohawk' ? <Part g={G.box} m={mats.hair} p={[0, 0.11, -0.01]} s={[0.035, 0.08, 0.19]} /> : null}
      {look.beard === 'short' ? <Part g={G.box} m={mats.hair} p={[0, -0.075, 0.06]} s={[0.13, 0.07, 0.07]} /> : null}
      {look.beard === 'long' ? <Part g={G.cone} m={mats.hair} p={[0, -0.15, 0.065]} s={[0.085, 0.22, 0.06]} r={[Math.PI, 0, 0]} /> : null}
      {hood ? (<>
        <Part g={G.cone} m={look.headGear === 'maskHood' ? mats.dark : mats.primary} p={[0, 0.06, -0.02]} s={[0.15, 0.22, 0.155]} />
        <Part g={G.box} m={look.headGear === 'maskHood' ? mats.dark : mats.primary} p={[0, -0.05, -0.08]} s={[0.24, 0.2, 0.08]} />
      </>) : null}
      {hood && look.headGear === 'maskHood' ? <Part g={G.box} m={mats.dark} p={[0, -0.045, 0.085]} s={[0.17, 0.08, 0.03]} /> : null}
    </>
  );
}


// ── Worn gear drawn over the rig ─────────────────────────────────────────

const GEAR_BASE: Record<string, string> = {
  leather: '#6a4a30', chain: '#8e949c', plate: '#b4b9c0', cloak: '#2c2830', bone: '#dcd2bc', scale: '#3f6e56',
};

interface GearMats {
  of: (color: string) => THREE.MeshLambertMaterial;
  glowOf: (color: string) => THREE.MeshBasicMaterial;
  list: THREE.Material[];
}

function makeGearMats(): GearMats {
  const lam = new Map<string, THREE.MeshLambertMaterial>();
  const glo = new Map<string, THREE.MeshBasicMaterial>();
  const list: THREE.Material[] = [];
  return {
    of: (c) => { let m = lam.get(c); if (!m) { m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }); lam.set(c, m); list.push(m); } return m; },
    glowOf: (c) => { let m = glo.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false }); glo.set(c, m); list.push(m); } return m; },
    list,
  };
}

function HelmMesh({ gear, gm }: { gear: NonNullable<GearLook['helm']>; gm: GearMats }) {
  const trim = gm.of(gear.rarity);
  switch (gear.kind) {
    case 'cap': return (<>
      <Part g={G.ico1} m={gm.of('#8e949c')} p={[0, 0.045, -0.01]} s={[0.122, 0.095, 0.124]} />
      <Part g={G.disc} m={gear.rich ? trim : gm.of('#6e737a')} p={[0, 0.01, -0.01]} s={[0.126, 0.022, 0.128]} />
    </>);
    case 'nasal': return (<>
      <Part g={G.ico1} m={gm.of('#a8adb4')} p={[0, 0.045, -0.01]} s={[0.124, 0.1, 0.126]} />
      <Part g={G.disc} m={trim} p={[0, 0.01, -0.01]} s={[0.128, 0.024, 0.13]} />
      <Part g={G.box} m={gm.of('#a8adb4')} p={[0, -0.02, 0.112]} s={[0.022, 0.08, 0.02]} />
      <Part g={G.box} m={trim} p={[0, 0.12, -0.01]} s={[0.02, 0.05, 0.16]} />
    </>);
    case 'horned': return (<>
      <Part g={G.ico1} m={gm.of('#8a8e94')} p={[0, 0.045, -0.01]} s={[0.124, 0.1, 0.126]} />
      <Part g={G.disc} m={trim} p={[0, 0.01, -0.01]} s={[0.128, 0.024, 0.13]} />
      <Part g={G.cone} m={gm.of('#e6dcc6')} p={[0.12, 0.1, -0.01]} s={[0.03, 0.14, 0.03]} r={[0, 0, -0.9]} />
      <Part g={G.cone} m={gm.of('#e6dcc6')} p={[-0.12, 0.1, -0.01]} s={[0.03, 0.14, 0.03]} r={[0, 0, 0.9]} />
    </>);
    case 'infernal': return (<>
      <Part g={G.ico1} m={gm.of('#3a1c18')} p={[0, 0.01, 0]} s={[0.132, 0.14, 0.132]} />
      <Part g={G.box} m={gm.glowOf('#ff4a2a')} p={[0.04, 0.015, 0.125]} s={[0.035, 0.014, 0.01]} />
      <Part g={G.box} m={gm.glowOf('#ff4a2a')} p={[-0.04, 0.015, 0.125]} s={[0.035, 0.014, 0.01]} />
      <Part g={G.cone} m={gm.of('#1c1010')} p={[0.1, 0.15, -0.03]} s={[0.035, 0.18, 0.035]} r={[-0.5, 0, -0.5]} />
      <Part g={G.cone} m={gm.of('#1c1010')} p={[-0.1, 0.15, -0.03]} s={[0.035, 0.18, 0.035]} r={[-0.5, 0, 0.5]} />
      <Part g={G.disc} m={trim} p={[0, -0.06, 0]} s={[0.134, 0.02, 0.134]} />
    </>);
    case 'plague': return (<>
      <Part g={G.ico1} m={gm.of('#2a2624')} p={[0, 0.03, -0.01]} s={[0.13, 0.13, 0.13]} />
      <Part g={G.cone} m={gm.of('#d8cfb8')} p={[0, -0.03, 0.2]} s={[0.04, 0.16, 0.04]} r={[Math.PI / 2 + 0.3, 0, 0]} />
      <Part g={G.disc} m={gm.glowOf(gear.rarity)} p={[0.045, 0.02, 0.118]} s={[0.028, 0.01, 0.028]} r={[Math.PI / 2, 0, 0]} />
      <Part g={G.disc} m={gm.glowOf(gear.rarity)} p={[-0.045, 0.02, 0.118]} s={[0.028, 0.01, 0.028]} r={[Math.PI / 2, 0, 0]} />
      <Part g={G.cone} m={gm.of('#2a2624')} p={[0, 0.2, -0.02]} s={[0.1, 0.1, 0.1]} />
    </>);
  }
}

function ChestMesh({ gear, gm, W, torsoH, shoulderX }: { gear: NonNullable<GearLook['chest']>; gm: GearMats; W: number; torsoH: number; shoulderX: number }) {
  const m = gm.of(GEAR_BASE[gear.kind]);
  const trim = gm.of(gear.rarity);
  const pauldrons = gear.kind === 'plate' || gear.kind === 'scale' || gear.kind === 'bone';
  return (
    <>
      {gear.kind !== 'cloak' && gear.kind !== 'bone' ? <Part g={G.taper} m={m} p={[0, torsoH * 0.52, 0]} s={[0.182 * W, torsoH * 0.9, 0.132 * W]} /> : null}
      {gear.kind === 'plate' ? <Part g={G.box} m={m} p={[0, torsoH * 0.62, 0.085 * W]} s={[0.26 * W, 0.17, 0.05]} /> : null}
      {gear.kind === 'chain' ? <Part g={G.box} m={trim} p={[0, torsoH * 0.35, 0.13 * W]} s={[0.1 * W, torsoH * 0.8, 0.012]} /> : null}
      {gear.kind === 'leather' ? <Part g={G.box} m={gm.of('#3a2618')} p={[0, torsoH * 0.5, 0.125 * W]} s={[0.035, 0.38, 0.02]} r={[0, 0, 0.7]} /> : null}
      {gear.kind === 'bone' ? (<>
        <Part g={G.box} m={gm.of('#4a3a2c')} p={[0, torsoH * 0.5, 0]} s={[0.35 * W, 0.03, 0.25 * W]} r={[0, 0, 0.6]} />
        {[0.42, 0.56, 0.7].map((y) => <Part key={y} g={G.box} m={m} p={[0, torsoH * y, 0.12 * W]} s={[0.22 * W, 0.022, 0.02]} />)}
      </>) : null}
      {gear.kind === 'scale' ? [0.25, 0.45, 0.65].map((y) => (
        <Part key={y} g={G.box} m={gm.of('#2e5a44')} p={[0, torsoH * y, 0.128 * W]} s={[0.24 * W, 0.02, 0.012]} />
      )) : null}
      {gear.kind === 'cloak' ? (<>
        <Part g={G.box} m={m} p={[0, torsoH * 0.35, -0.12 * W]} s={[0.34 * W, 0.66, 0.02]} r={[0.12, 0, 0]} />
        <Part g={G.ico} m={m} p={[0, torsoH + 0.01, -0.02]} s={[0.17 * W, 0.06, 0.12 * W]} />
        <Part g={G.ico} m={trim} p={[0.07 * W, torsoH - 0.02, 0.09 * W]} s={[0.025, 0.025, 0.025]} />
      </>) : null}
      {pauldrons ? [1, -1].map((sx) => (
        <group key={sx} position={[sx * shoulderX, torsoH - 0.005, 0]}>
          <Part g={G.ico1} m={m} s={[0.095, 0.075, 0.1]} />
          {gear.kind === 'bone'
            ? <Part g={G.cone} m={m} p={[sx * 0.04, 0.08, 0]} s={[0.025, 0.12, 0.025]} r={[0, 0, -sx * 0.5]} />
            : <Part g={G.disc} m={trim} p={[0, -0.035, 0]} s={[0.1, 0.018, 0.105]} />}
        </group>
      )) : null}
      <Part g={G.box} m={trim} p={[0, 0.045, 0]} s={[0.29 * W, 0.028, 0.185 * W]} />
    </>
  );
}

function GloveMesh({ gear, gm }: { gear: NonNullable<GearLook['hands']>; gm: GearMats }) {
  const base = gear.kind === 'plate' ? '#b4b9c0' : gear.kind === 'claw' ? '#3a3430' : '#5a3e28';
  const m = gm.of(base);
  return (
    <>
      <Part g={G.ico} m={m} p={[0, -0.2, 0]} s={[0.054, 0.054, 0.054]} />
      <Part g={G.taper} m={m} p={[0, -0.15, 0]} s={[0.052, 0.07, 0.052]} r={[Math.PI, 0, 0]} />
      <Part g={G.disc} m={gm.of(gear.rarity)} p={[0, -0.118, 0]} s={[0.054, 0.012, 0.054]} />
      {gear.kind === 'claw' ? [-0.03, 0, 0.03].map((x) => (
        <Part key={x} g={G.cone} m={gm.of('#e6dcc6')} p={[x, -0.28, 0.02]} s={[0.012, 0.08, 0.012]} r={[Math.PI, 0, 0]} />
      )) : null}
    </>
  );
}

function BootMesh({ gear, gm, W, shin }: { gear: NonNullable<GearLook['feet']>; gm: GearMats; W: number; shin: number }) {
  const base = gear.kind === 'plate' ? '#b4b9c0' : gear.kind === 'chain' ? '#8e949c' : '#5a3e28';
  const m = gm.of(base);
  return (
    <>
      <Part g={G.box} m={m} p={[0, -shin - 0.02, 0.035]} s={[0.1 * W, 0.066, 0.17]} />
      <Part g={G.cyl} m={m} p={[0, -shin * 0.72, 0]} s={[0.056 * W, shin * 0.5, 0.056 * W]} />
      <Part g={G.disc} m={gm.of(gear.rarity)} p={[0, -shin * 0.47, 0]} s={[0.06 * W, 0.016, 0.06 * W]} />
      {gear.kind === 'plate' ? <Part g={G.ico} m={m} p={[0, -0.01, 0.045]} s={[0.05, 0.045, 0.04]} /> : null}
    </>
  );
}

/** Held upright along the body rather than pointed forward. */
const UPRIGHT = new Set(['staff', 'orb', 'flask', 'trident', 'book']);

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0→1→0 bump over [0, dur], peaking at `peak`. */
const bump = (t: number, dur: number, peak = 0.35) => (t < 0 || t > dur ? 0 : t < dur * peak ? t / (dur * peak) : 1 - (t - dur * peak) / (dur * (1 - peak)));

export function HeroModel({ look: baseLook, anim, gear }: { look: HeroLook; anim: React.MutableRefObject<HeroAnim>; gear?: GearLook }) {
  const look = useMemo(() => withGear(baseLook, gear), [baseLook, gear]);
  const b = BUILD[look.build];
  const mats = useMemo(() => makeMats(look), [look]);
  const gm = useMemo(makeGearMats, []);
  useEffect(() => () => { gm.list.forEach((m) => m.dispose()); }, [gm]);
  const W = b.width;
  const thigh = 0.24 * b.legs; const shin = 0.22 * b.legs;
  const hipY = thigh + shin + 0.05;
  const torsoH = 0.32;
  const shoulderX = 0.17 * W + 0.035;
  const robe = look.outfit === 'robe';
  const plate = look.outfit === 'plate';
  const armMat = plate ? mats.metal : look.outfit === 'bare' ? mats.skin : mats.primary;
  const twoHanded = TWO_HANDED.has(look.weapon);

  const r = {
    fall: useRef<THREE.Group>(null), body: useRef<THREE.Group>(null), torso: useRef<THREE.Group>(null), head: useRef<THREE.Group>(null),
    legL: useRef<THREE.Group>(null), legR: useRef<THREE.Group>(null), kneeL: useRef<THREE.Group>(null), kneeR: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null), armR: useRef<THREE.Group>(null), elbowL: useRef<THREE.Group>(null), elbowR: useRef<THREE.Group>(null),
    cape: useRef<THREE.Mesh>(null), wingL: useRef<THREE.Group>(null), wingR: useRef<THREE.Group>(null), flies: useRef<THREE.Group>(null),
  };
  const noLegs = !!(look.ghost || look.fishTail);
  const walkPhase = useRef(0);
  const flashCol = useMemo(() => new THREE.Color('#ff4a3a'), []);
  const frozenCol = useMemo(() => new THREE.Color('#9fd6ff'), []);

  useFrame((st, dt) => {
    const a = anim.current; const t = st.clock.elapsedTime;
    const walk = Math.min(1, a.speed / 1.2);
    walkPhase.current += dt * (4 + walk * 8);
    const ph = walkPhase.current;
    const breathe = Math.sin(t * 2.2);
    const at = t - a.at;

    // base pose
    let legL = walk * Math.sin(ph) * 0.7, legR = -walk * Math.sin(ph) * 0.7;
    let kneeL = walk * Math.max(0, -Math.sin(ph)) * 0.9, kneeR = walk * Math.max(0, Math.sin(ph)) * 0.9;
    let armLx = -walk * Math.sin(ph) * 0.5 + 0.05 * breathe, armRx = walk * Math.sin(ph) * 0.5 - 0.05 * breathe;
    let armLz = 0.12, armRz = -0.12;
    let elbowL = -0.25, elbowR = -0.25;
    let torsoX = 0.03 * breathe + (look.hunch ?? 0), torsoY = 0, bodyY = walk * Math.abs(Math.sin(ph)) * 0.04 + 0.006 * breathe;
    if (look.ghost) bodyY = 0.12 + Math.sin(t * 1.8) * 0.05;
    if (look.weapon === 'claws') { armLx -= 0.35; armRx -= 0.35; elbowL = -0.7; elbowR = -0.7; }

    // hold poses
    if (twoHanded) { armRx = -0.5; elbowR = -0.9; armLx = -0.7; elbowL = -1.1; armLz = -0.35; }
    if (look.weapon === 'bow') { armLx = -0.35; elbowL = -0.3; }
    if (look.weapon === 'staff') { armRx = -0.25; elbowR = -0.55; }
    if (a.defending && look.offHand.endsWith('Shield')) { armLx = -1.35; elbowL = -0.4; armLz = -0.25; }

    // actions
    const kind = a.kind;
    if (kind === 'melee' && at < 0.5) {
      const wind = bump(at, 0.5, 0.3); const strike = at > 0.15 ? bump(at - 0.15, 0.3, 0.3) : 0;
      if (look.weapon === 'dagger') {
        armRx = lerp(armRx, -1.6, bump(at, 0.22, 0.4)); elbowR = lerp(elbowR, -0.1, bump(at, 0.22, 0.4));
        armLx = lerp(armLx, -1.6, bump(at - 0.14, 0.22, 0.4)); elbowL = lerp(elbowL, -0.1, bump(at - 0.14, 0.22, 0.4));
      } else {
        armRx = lerp(armRx, -2.8, wind) + strike * 2.3; elbowR = lerp(elbowR, -0.3, wind);
        if (twoHanded) { armLx = armRx; armLz = -0.2; }
        torsoX += strike * 0.25; torsoY = -0.3 * wind;
      }
    } else if (kind === 'ranged' && at < 0.55) {
      if (look.weapon === 'bow') {
        const draw = bump(at, 0.55, 0.55);
        armLx = lerp(armLx, -1.55, Math.min(1, at / 0.12)); elbowL = lerp(elbowL, 0, Math.min(1, at / 0.12));
        armRx = lerp(armRx, -1.55, Math.min(1, at / 0.12)); elbowR = lerp(-0.2, -2.0, draw); armRz = lerp(armRz, 0.25, draw);
      } else {
        const throwK = bump(at, 0.45, 0.45);
        armRx = lerp(armRx, -2.6, throwK) + (at > 0.2 ? bump(at - 0.2, 0.3, 0.3) * 1.6 : 0);
        elbowR = lerp(elbowR, -0.6, throwK);
      }
    } else if ((kind === 'ability' || kind === 'heal' || kind === 'rally') && at < 0.7) {
      const k = bump(at, 0.7, 0.3);
      armRx = lerp(armRx, kind === 'rally' ? -2.9 : -1.9, k); elbowR = lerp(elbowR, -0.05, k);
      if (kind === 'rally' || look.weapon === 'orb') { armLx = lerp(armLx, -1.7, k); elbowL = lerp(elbowL, -0.1, k); }
      bodyY += 0.05 * k;
    }
    // flinch
    const ht = t - a.hit;
    if (ht >= 0 && ht < 0.35) torsoX -= 0.4 * (1 - ht / 0.35);

    const R = r;
    if (R.legL.current && R.legR.current && R.kneeL.current && R.kneeR.current) {
      R.legL.current.rotation.x = legL; R.legR.current.rotation.x = legR;
      R.kneeL.current.rotation.x = kneeL; R.kneeR.current.rotation.x = kneeR;
    }
    R.armL.current!.rotation.set(armLx, 0, armLz); R.armR.current!.rotation.set(armRx, 0, armRz);
    R.elbowL.current!.rotation.x = elbowL; R.elbowR.current!.rotation.x = elbowR;
    R.torso.current!.rotation.set(torsoX, torsoY, 0);
    R.body.current!.position.y = bodyY;
    if (R.head.current) R.head.current.rotation.y = Math.sin(t * 0.7) * 0.12;
    if (R.cape.current) R.cape.current.rotation.x = 0.12 + walk * 0.3 + Math.sin(t * 2.5) * 0.04;
    if (R.wingL.current && R.wingR.current) {
      const flap = Math.sin(t * (kind === 'melee' && at < 0.5 ? 18 : 4)) * 0.35;
      R.wingL.current.rotation.y = -0.5 + flap; R.wingR.current.rotation.y = 0.5 - flap;
    }
    if (R.flies.current) R.flies.current.rotation.y = t * 3;

    // falling over (backwards) and lying still
    const fall = a.alive ? 0 : a.deadAt >= 0 ? Math.min(1, (t - a.deadAt) / 0.55) : 1;
    const eased = 1 - (1 - fall) * (1 - fall);
    R.fall.current!.rotation.x = -1.45 * eased;
    R.fall.current!.position.y = -0.05 * eased;

    // hit flash / frozen tint / death grey
    const f = ht >= 0 && ht < 0.3 ? 1 - ht / 0.3 : 0;
    for (const m of [...Object.values(mats), ...gm.list]) {
      if (m instanceof THREE.MeshLambertMaterial) {
        m.emissive.copy(a.frozen ? frozenCol : flashCol);
        m.emissiveIntensity = a.frozen ? 0.45 : f * 0.9;
        m.opacity = look.ghost ? 0.82 : a.alive ? 1 : 0.85;
      }
    }
  });

  return (
    <group ref={r.fall}>
      <group ref={r.body} scale={[b.size, b.size, b.size]}>
        {/* legs — or a ghostly trail / fish tail */}
        {look.ghost ? <Part g={G.cone} m={mats.primary} p={[0, hipY * 0.45, 0]} s={[0.2 * W, hipY * 1.1, 0.16 * W]} r={[Math.PI, 0, 0]} /> : null}
        {look.fishTail ? (<>
          <Part g={G.cone} m={mats.cape} p={[0, hipY * 0.5, -0.05]} s={[0.13 * W, hipY * 1.05, 0.11 * W]} r={[Math.PI + 0.25, 0, 0]} />
          <Part g={G.cone4} m={mats.cape} p={[0, 0.04, -0.22]} s={[0.16, 0.12, 0.05]} r={[-1.2, 0, 0]} />
        </>) : null}
        {noLegs ? null : ([['L', -1], ['R', 1]] as const).map(([side, sx]) => (
          <group key={side} ref={side === 'L' ? r.legL : r.legR} position={[sx * 0.075 * W, hipY, 0]}>
            <Part g={G.cyl} m={plate ? mats.metal : mats.secondary} p={[0, -thigh / 2, 0]} s={[0.055 * W, thigh, 0.055 * W]} />
            <group ref={side === 'L' ? r.kneeL : r.kneeR} position={[0, -thigh, 0]}>
              <Part g={G.cyl} m={mats.secondary} p={[0, -shin / 2, 0]} s={[0.047 * W, shin, 0.047 * W]} />
              <Part g={G.box} m={mats.dark} p={[0, -shin - 0.02, 0.03]} s={[0.085 * W, 0.05, 0.15]} />
              {gear?.feet ? <BootMesh gear={gear.feet} gm={gm} W={W} shin={shin} /> : null}
            </group>
          </group>
        ))}
        {/* pelvis + torso */}
        <group position={[0, hipY, 0]}>
          <Part g={G.box} m={mats.secondary} p={[0, 0.02, 0]} s={[0.25 * W, 0.1, 0.16]} />
          {robe ? <Part g={G.taper} m={mats.primary} p={[0, -0.18, 0]} s={[0.24 * W, 0.44, 0.2]} r={[Math.PI, 0, 0]} /> : null}
          <group ref={r.torso} position={[0, 0.06, 0]}>
            <Part g={G.taper} m={look.outfit === 'bare' ? mats.skin : mats.primary} p={[0, torsoH / 2, 0]} s={[0.17 * W, torsoH, 0.12 * W]} />
            {plate ? <Part g={G.box} m={mats.metal} p={[0, torsoH * 0.62, 0.075 * W]} s={[0.24 * W, 0.16, 0.05]} /> : null}
            {look.outfit === 'bare' && !look.eyes ? (<>
              <Part g={G.box} m={mats.primary} p={[0, torsoH * 0.5, 0.105 * W]} s={[0.035, 0.36, 0.02]} r={[0, 0, 0.7]} />
              <Part g={G.box} m={mats.primary} p={[0, torsoH * 0.5, -0.105 * W]} s={[0.035, 0.36, 0.02]} r={[0, 0, -0.7]} />
              <Part g={G.cone} m={mats.metal} p={[shoulderX, torsoH + 0.02, 0]} s={[0.04, 0.12, 0.04]} r={[0, 0, -0.5]} />
            </>) : null}
            <Part g={G.box} m={mats.secondary} p={[0, 0.02, 0]} s={[0.27 * W, 0.045, 0.17 * W]} />
            {gear?.chest ? <ChestMesh gear={gear.chest} gm={gm} W={W} torsoH={torsoH} shoulderX={shoulderX} /> : null}
            {gear?.amulet ? (<>
              <Part g={G.cyl} m={mats.dark} p={[0, torsoH * 0.86, 0.1 * W]} s={[0.006, 0.08, 0.006]} r={[0.3, 0, 0]} />
              <Part g={G.ico} m={gm.glowOf(gear.amulet)} p={[0, torsoH * 0.74, 0.135 * W]} s={[0.028, 0.034, 0.02]} />
            </>) : null}
            {look.skeleton && look.outfit === 'bare' ? [0.12, 0.19, 0.26].map((y) => (
              <Part key={y} g={G.box} m={mats.dark} p={[0, y, 0.1 * W]} s={[0.2 * W, 0.018, 0.02]} />
            )) : null}
            {look.cracks ? (<>
              <Part g={G.box} m={mats.crack} p={[0.03, torsoH * 0.5, 0.13 * W]} s={[0.018, torsoH * 0.8, 0.012]} r={[0, 0, 0.4]} />
              <Part g={G.box} m={mats.crack} p={[-0.05, torsoH * 0.62, 0.125 * W]} s={[0.015, torsoH * 0.5, 0.012]} r={[0, 0, -0.6]} />
              <Part g={G.box} m={mats.crack} p={[0.06, torsoH * 0.3, 0.12 * W]} s={[0.1, 0.014, 0.012]} r={[0, 0, 0.2]} />
            </>) : null}
            {look.wings ? ([['L', -1], ['R', 1]] as const).map(([side, sx]) => (
              <group key={side} ref={side === 'L' ? r.wingL : r.wingR} position={[sx * 0.06, torsoH * 0.8, -0.1 * W]}>
                <Part g={G.cone4} m={mats.cape} p={[sx * 0.28, 0, -0.02]} s={[0.3, 0.02, 0.22]} r={[Math.PI / 2, 0, sx * 1.4]} />
              </group>
            )) : null}
            {look.cape ? <mesh ref={r.cape} geometry={G.box} material={mats.cape} position={[0, torsoH - 0.02, -0.115 * W]} scale={[0.3 * W, 0.58, 0.015]} /> : null}
            {plate ? (<>
              <Part g={G.ico} m={mats.metal} p={[shoulderX, torsoH - 0.01, 0]} s={[0.085, 0.07, 0.09]} />
              <Part g={G.ico} m={mats.metal} p={[-shoulderX, torsoH - 0.01, 0]} s={[0.085, 0.07, 0.09]} />
            </>) : null}
            {/* neck + head (empty armour just glows where the head should be) */}
            {look.headless ? (
              <Part g={G.ico} m={mats.eye} p={[0, torsoH + 0.04, 0]} s={[0.05, 0.03, 0.05]} />
            ) : (<>
              <Part g={G.cyl} m={mats.skin} p={[0, torsoH + 0.03, 0]} s={[0.045, 0.07, 0.045]} />
              <group ref={r.head} position={[0, torsoH + 0.14, 0]} scale={[b.head, b.head, b.head]}>
                <Head look={look} mats={mats} helm={gear?.helm && !look.headless ? <HelmMesh gear={gear.helm} gm={gm} /> : undefined} />
              </group>
            </>)}
            {look.flies ? (
              <group ref={r.flies} position={[0, torsoH + 0.15, 0]}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Part key={i} g={G.ico} m={mats.dark} p={[Math.sin(i * 1.7) * 0.3, Math.cos(i * 2.3) * 0.12, Math.cos(i * 1.7) * 0.3]} s={[0.018, 0.018, 0.018]} />
                ))}
              </group>
            ) : null}
            {/* arms */}
            {([['L', -1], ['R', 1]] as const).map(([side, sx]) => (
              <group key={side} ref={side === 'L' ? r.armL : r.armR} position={[sx * shoulderX, torsoH - 0.03, 0]}>
                <Part g={G.cyl} m={armMat} p={[0, -0.1, 0]} s={[0.045, 0.2, 0.045]} />
                <group ref={side === 'L' ? r.elbowL : r.elbowR} position={[0, -0.2, 0]}>
                  <Part g={G.cyl} m={look.outfit === 'bare' ? mats.skin : plate ? mats.metal : mats.primary} p={[0, -0.09, 0]} s={[0.04, 0.18, 0.04]} />
                  <Part g={G.ico} m={plate ? mats.secondary : mats.skin} p={[0, -0.2, 0]} s={look.weapon === 'claws' ? [0.06, 0.06, 0.06] : [0.043, 0.043, 0.043]} />
                  {gear?.hands ? <GloveMesh gear={gear.hands} gm={gm} /> : null}
                  {side === 'L' && gear?.ring ? <Part g={G.ico} m={gm.glowOf(gear.ring)} p={[0.03, -0.22, 0.03]} s={[0.014, 0.014, 0.014]} /> : null}
                  {look.weapon === 'claws' ? [-0.03, 0, 0.03].map((x) => (
                    <Part key={x} g={G.cone} m={mats.eye} p={[x, -0.28, 0.02]} s={[0.012, 0.08, 0.012]} r={[Math.PI, 0, 0]} />
                  )) : null}
                  <group position={[0, -0.21, 0.02]} rotation={[UPRIGHT.has(look.weapon) ? 0 : 0.6, 0, 0]}>
                    {side === 'R' ? <WeaponMesh look={look} mats={mats} /> : null}
                  </group>
                  {side === 'L' ? (
                    <group position={[sx * 0.02, -0.14, 0]} rotation={[0, look.offHand.endsWith('Shield') ? -0.7 : 0, 0]}>
                      <OffHandMesh look={look} mats={mats} />
                    </group>
                  ) : null}
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}
