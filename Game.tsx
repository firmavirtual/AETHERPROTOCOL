// tslint:disable
/* eslint-disable */
import {Canvas, useFrame, useThree} from '@react-three/fiber';
import {OrthographicCamera, useGLTF, Clone} from '@react-three/drei';
import {Bloom, EffectComposer} from '@react-three/postprocessing';
import React, {Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {getConfig} from './constants';
import {
  BaseFortress,
  BeamEffect,
  CaptureNode,
  ExplosionParticle,
  FactionId,
  OrbitalStrike,
  Projectile,
  RTSGameState,
  RTSUnit,
  ScorchCrater,
  UnitDef,
  UnitTypeKey,
} from './types';
import {gameAudio} from './utils';

// ============================================================================
// UNIT DEFINITIONS & FACTION ROSTERS
// ============================================================================
export const UNIT_CONFIGS: Record<FactionId, Record<UnitTypeKey, UnitDef>> = {
  terran: {
    striker: {
      key: 'striker',
      name: 'Bot Striker x3',
      cost: 45,
      pop: 1,
      spawnCount: 3,
      reqTech: 1,
      hp: 95,
      shield: 30,
      regen: 0,
      damage: 12,
      range: 22,
      speed: 18,
      fireRate: 0.45,
      splash: 0,
      isAir: false,
      isBeam: false,
      radius: 1.8,
      description: 'Squad of 3 light biped strike mechas with rapid pulse blasters.',
    },
    artillery: {
      key: 'artillery',
      name: 'Manticore Tank x2',
      cost: 80,
      pop: 2,
      spawnCount: 2,
      reqTech: 1,
      hp: 165,
      shield: 45,
      regen: 0,
      damage: 36,
      range: 38,
      speed: 13,
      fireRate: 1.35,
      splash: 8.5,
      isAir: false,
      isBeam: false,
      radius: 2.4,
      description: 'Twin heavy siege tanks with long-range explosive AoE mortars.',
    },
    fighter: {
      key: 'fighter',
      name: 'Raptor Fighter x2',
      cost: 95,
      pop: 2,
      spawnCount: 2,
      reqTech: 1,
      hp: 150,
      shield: 45,
      regen: 0,
      damage: 22,
      range: 26,
      speed: 23,
      fireRate: 0.55,
      splash: 0,
      isAir: true,
      isBeam: false,
      radius: 2.2,
      description: 'High-speed interceptor jets with atmospheric swept wings.',
    },
    titan: {
      key: 'titan',
      name: 'Titan Atlas',
      cost: 165,
      pop: 4,
      spawnCount: 1,
      reqTech: 2,
      hp: 680,
      shield: 180,
      regen: 0,
      damage: 78,
      range: 36,
      speed: 10,
      fireRate: 0.95,
      splash: 10.5,
      isAir: false,
      isBeam: true,
      radius: 4.2,
      description: 'Massive colossus mecha with continuous piercing laser beams.',
    },
    cruiser: {
      key: 'cruiser',
      name: 'Aegis Battlecruiser',
      cost: 250,
      pop: 6,
      spawnCount: 1,
      reqTech: 3,
      hp: 1050,
      shield: 320,
      regen: 0,
      damage: 115,
      range: 44,
      speed: 8.5,
      fireRate: 1.05,
      splash: 12.0,
      isAir: true,
      isBeam: true,
      radius: 5.5,
      description: 'Flying capital dreadnought with devastating ion batteries.',
    },
  },
  xeno: {
    striker: {
      key: 'striker',
      name: 'Bot Marauder x3',
      cost: 45,
      pop: 1,
      spawnCount: 3,
      reqTech: 1,
      hp: 115,
      shield: 0,
      regen: 4.5,
      damage: 13,
      range: 21,
      speed: 19,
      fireRate: 0.42,
      splash: 0,
      isAir: false,
      isBeam: false,
      radius: 1.8,
      description: 'Squad of 3 fast assault bio-mechas with regenerative armor.',
    },
    artillery: {
      key: 'artillery',
      name: 'Scorcher Battery x2',
      cost: 80,
      pop: 2,
      spawnCount: 2,
      reqTech: 1,
      hp: 185,
      shield: 0,
      regen: 5.0,
      damage: 40,
      range: 37,
      speed: 12.5,
      fireRate: 1.30,
      splash: 9.2,
      isAir: false,
      isBeam: false,
      radius: 2.4,
      description: 'Heavy thermobaric artillery batteries that ignite target zones.',
    },
    fighter: {
      key: 'fighter',
      name: 'Vulture Gunship x2',
      cost: 95,
      pop: 2,
      spawnCount: 2,
      reqTech: 1,
      hp: 170,
      shield: 0,
      regen: 6.0,
      damage: 25,
      range: 25,
      speed: 22,
      fireRate: 0.54,
      splash: 0,
      isAir: true,
      isBeam: false,
      radius: 2.2,
      description: 'Armored VTOL gunships with heavy plasma gatlings.',
    },
    titan: {
      key: 'titan',
      name: 'Titan Omega',
      cost: 165,
      pop: 4,
      spawnCount: 1,
      reqTech: 2,
      hp: 840,
      shield: 0,
      regen: 18.0,
      damage: 85,
      range: 35,
      speed: 9.8,
      fireRate: 0.92,
      splash: 11.0,
      isAir: false,
      isBeam: true,
      radius: 4.2,
      description: 'Reactor colossus radiating emerald beams and fast hull regeneration.',
    },
    cruiser: {
      key: 'cruiser',
      name: 'Sovereign Dreadnought',
      cost: 250,
      pop: 6,
      spawnCount: 1,
      reqTech: 3,
      hp: 1250,
      shield: 0,
      regen: 24.0,
      damage: 125,
      range: 42,
      speed: 8.0,
      fireRate: 1.08,
      splash: 13.0,
      isAir: true,
      isBeam: true,
      radius: 5.5,
      description: 'Titan-class airborne warship with searing orange thermal lances.',
    },
  },
};

// ============================================================================
// PROCEDURAL CANVAS TEXTURE BUILDERS
// ============================================================================
function createProceduralSnowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base Snow
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 1024, 1024);

    // Permafrost & Glacial patches
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const r = 40 + Math.random() * 120;
      const grad = ctx.createRadialGradient(x, y, 5, x, y, r);
      if (i % 3 === 0) {
        grad.addColorStop(0, 'rgba(148, 163, 184, 0.45)');
        grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      } else if (i % 3 === 1) {
        grad.addColorStop(0, 'rgba(186, 230, 253, 0.55)');
        grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      } else {
        grad.addColorStop(0, 'rgba(100, 116, 139, 0.35)');
        grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sastrugi wind dunes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 140; i++) {
      const sx = Math.random() * 1024;
      const sy = Math.random() * 1024;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + 30, sy - 10, sx + 70 + Math.random() * 60, sy + Math.random() * 10);
      ctx.stroke();
    }

    // Dimetric Isometric Diamond Grid Lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = -1024; x < 2048; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 1024, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, 1024);
      ctx.lineTo(x + 1024, 0);
      ctx.stroke();
    }

    // Micro grain noise
    for (let i = 0; i < 4000; i++) {
      const gx = Math.random() * 1024;
      const gy = Math.random() * 1024;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(100,116,139,0.3)';
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  return texture;
}

function createProceduralWaterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 20 + Math.random() * 80;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

// ============================================================================
// PROCEDURAL 3D MODELS
// ============================================================================

// Base Command Fortress
function BaseMesh({
  base,
  faction,
}: {
  base: BaseFortress;
  faction: FactionId;
}) {
  const isTerran = faction === 'terran';
  const primaryColor = isTerran ? '#2563eb' : '#dc2626';
  const emissiveColor = isTerran ? '#38bdf8' : '#4ade80';
  const turretRef = useRef<THREE.Group>(null);

  useFrame(({clock}) => {
    if (turretRef.current) {
      turretRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.8) * 0.4;
    }
  });

  return (
    <group position={[base.x, 0, base.z]}>
      {/* Quad Treads */}
      <mesh position={[-4.5, 0.9, -4.5]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.8, 10.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>
      <mesh position={[4.5, 0.9, -4.5]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.8, 10.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>
      <mesh position={[-4.5, 0.9, 4.5]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.8, 10.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>
      <mesh position={[4.5, 0.9, 4.5]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.8, 10.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>

      {/* Main Armored Chassis */}
      <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[11, 2.4, 11]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.5, 1.8, 8.5]} />
        <meshStandardMaterial color={primaryColor} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Glowing Reactor Core */}
      <mesh position={[0, 5.4, 0]}>
        <cylinderGeometry args={[2.2, 2.6, 1.4, 16]} />
        <meshStandardMaterial color="#ffffff" emissive={emissiveColor} emissiveIntensity={2.5} />
      </mesh>

      {/* Defensive Rotating Heavy Turret */}
      <group ref={turretRef} position={[0, 6.2, 0]}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[2.2, 2.6, 1.4, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Dual Heavy Cannons */}
        <mesh position={[-0.8, 0.9, -3.2]} rotation={[0.2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.45, 5.5, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.8, 0.9, -3.2]} rotation={[0.2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.45, 5.5, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Radar Mast */}
        <mesh position={[0, 2.2, 1.2]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.4, 1.6, 0.4]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <mesh position={[0, 2.9, 1.2]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[1.8, 0.2, 0.8]} />
          <meshStandardMaterial color={emissiveColor} emissive={emissiveColor} emissiveIntensity={1.8} />
        </mesh>
      </group>

      {/* Base Perimeter Shield / Health Ring */}
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[base.radius * 0.9, base.radius, 32]} />
        <meshBasicMaterial
          color={base.team === 0 ? '#00f0ff' : '#ef4444'}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}

// Strategic Capture Node
function NodeMesh({node}: {node: CaptureNode}) {
  const crystalRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const ownerColor =
    node.owner === 0 ? '#00f0ff' : node.owner === 1 ? '#ef4444' : '#fbbf24';

  useFrame(({clock}) => {
    const t = clock.getElapsedTime();
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 1.5;
      crystalRef.current.position.y = 4.2 + Math.sin(t * 2.5) * 0.45;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = -t * 0.8;
    }
  });

  return (
    <group position={[node.x, 0, node.z]}>
      {/* Ground Zone Ring */}
      <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[node.radius - 0.8, node.radius, 40]} />
        <meshBasicMaterial color={ownerColor} transparent opacity={0.5} />
      </mesh>

      {/* Industrial Base Pillar */}
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.5, 3.2, 2.4, 8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Energy Conduit Ring */}
      <mesh ref={ringRef} position={[0, 2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, 0.35, 12, 24]} />
        <meshStandardMaterial
          color={ownerColor}
          emissive={ownerColor}
          emissiveIntensity={2.0}
        />
      </mesh>

      {/* Floating Rotating Aether Crystal */}
      <mesh ref={crystalRef} position={[0, 4.2, 0]} castShadow>
        <octahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={ownerColor}
          emissiveIntensity={3.0}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Beacon Light */}
      <pointLight
        position={[0, 5, 0]}
        color={ownerColor}
        intensity={8.0}
        distance={25}
        decay={1.5}
      />
    </group>
  );
}

// ============================================================================
// 3D GLB MODELS & UNIT RENDERERS
// ============================================================================
const SOLDIER_MODEL_URL = './soldier.glb';
const FIGHTER_MODEL_URL = './futuristic_airfighter_cgpt-14.glb';

try {
  useGLTF.preload(SOLDIER_MODEL_URL);
  useGLTF.preload(FIGHTER_MODEL_URL);
} catch (e) {
  // Preload is optional
}

// 3D Soldier Model for the Human Player Bot — enhanced procedural walk animation
function PlayerSoldierMesh({
  unit,
  secondaryColor,
}: {
  unit: RTSUnit;
  secondaryColor: string;
}) {
  const gltf = useGLTF(SOLDIER_MODEL_URL);

  // Enhanced walk cycle — soldier.glb has no skeleton animations, so we
  // drive the whole model procedurally with several overlapping motions.
  const walkPhase = unit.walkCycle * 8;

  // 1. Vertical body-bob: double-bounce per full stride (heel-strike rhythm)
  const strideY = Math.abs(Math.sin(walkPhase)) * 0.22;

  // 2. Lateral sway: weight shift left/right each step
  const sideSwayZ = Math.sin(walkPhase) * 0.10;

  // 3. Forward lean: soldier leans into the run (constant tilt on X)
  const forwardLeanX = -0.10;

  // 4. Footstep compression: body squashes slightly on ground contact
  const groundContact = Math.abs(Math.sin(walkPhase));
  const scaleY = 1.0 - (1 - groundContact) * 0.04;

  // 5. Head counter-sway: subtle opposite motion for realism (applied on inner group)
  const headBob = Math.abs(Math.sin(walkPhase * 2)) * 0.03;

  return (
    <group
      position={[0, 1.05 + strideY + headBob, 0]}
      rotation={[forwardLeanX, 0, sideSwayZ]}
      scale={[1.15, 1.15 * scaleY, 1.15]}
    >
      <Clone object={gltf.scene} castShadow receiveShadow />
      {/* Tactical energy beacon ring at feet — pulses with footstep */}
      <mesh position={[0, -0.98, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.33, 0.50, 16]} />
        <meshBasicMaterial
          color={secondaryColor}
          transparent
          opacity={0.45 + groundContact * 0.35}
        />
      </mesh>
    </group>
  );
}

// 3D Fighter Jet Model replacing the Human Player Fighter
function PlayerFighterMesh({
  unit,
  secondaryColor,
}: {
  unit: RTSUnit;
  secondaryColor: string;
}) {
  const gltf = useGLTF(FIGHTER_MODEL_URL);

  // Dynamic banking and pitch in flight
  const rollZ = Math.sin(unit.walkCycle * 4) * 0.07;
  const pitchX = Math.cos(unit.walkCycle * 3) * 0.04;

  // The GLB model's nose points toward +Z in model-space.
  // The outer UnitMesh group already applies unit.rotY so that -Z = forward.
  // We add Math.PI to flip the model so its +Z nose becomes the local -Z
  // that the outer rotation expects — no extra flip needed, rotY handles it.
  // Exhausts sit at +Z (rear of aircraft after the Math.PI flip becomes -Z
  // in world space, i.e. behind the aircraft as it moves forward).
  return (
    <group position={[0, -0.3, 0]} rotation={[pitchX, 0, rollZ]} scale={[0.35, 0.35, 0.35]}>
      <Clone object={gltf.scene} castShadow receiveShadow />

      {/* Ion engine exhausts — at +Z rear of model (tail direction) */}
      <mesh position={[-1.25, 0.5, 7.5]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={5.0} />
      </mesh>
      <mesh position={[1.25, 0.5, 7.5]}>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={5.0} />
      </mesh>
    </group>
  );
}

// Procedural infantry striker (fallback and enemy unit)
function ProceduralStriker({
  primaryColor,
  secondaryColor,
  chassisColor,
  leftLegRef,
  rightLegRef,
}: {
  primaryColor: string;
  secondaryColor: string;
  chassisColor: string;
  leftLegRef?: React.RefObject<THREE.Group | null>;
  rightLegRef?: React.RefObject<THREE.Group | null>;
}) {
  return (
    <group scale={[1.2, 1.2, 1.2]}>
      {/* Armored Combat Helmet */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[0.55, 0.5, 0.6]} />
        <meshStandardMaterial color={primaryColor} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Helmet Visor Plate (Neon Tactical Glow) */}
      <mesh position={[0, 1.88, -0.32]}>
        <boxGeometry args={[0.42, 0.16, 0.08]} />
        <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={3.8} />
      </mesh>
      {/* Tactical Helmet Crest / Rangefinder */}
      <mesh position={[0.26, 1.95, -0.05]} castShadow>
        <boxGeometry args={[0.08, 0.22, 0.35]} />
        <meshStandardMaterial color={chassisColor} metalness={0.9} />
      </mesh>

      {/* Heavy Armored Exo-Torso */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[0.75, 0.7, 0.55]} />
        <meshStandardMaterial color={primaryColor} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Chest Armored Rig & Faction Core */}
      <mesh position={[0, 1.35, -0.3]} castShadow>
        <boxGeometry args={[0.45, 0.35, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} />
      </mesh>
      <mesh position={[0, 1.35, -0.36]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={3.5} />
      </mesh>

      {/* Life-Support / Power Backpack */}
      <mesh position={[0, 1.3, 0.35]} castShadow>
        <boxGeometry args={[0.5, 0.6, 0.24]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-0.15, 1.45, 0.48]}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 8]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[0.15, 1.45, 0.48]}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 8]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={2.5} />
      </mesh>

      {/* Shoulder Armor Pauldrons */}
      <mesh position={[-0.52, 1.5, 0]} castShadow>
        <boxGeometry args={[0.3, 0.28, 0.36]} />
        <meshStandardMaterial color={primaryColor} metalness={0.8} />
      </mesh>
      <mesh position={[0.52, 1.5, 0]} castShadow>
        <boxGeometry args={[0.3, 0.28, 0.36]} />
        <meshStandardMaterial color={primaryColor} metalness={0.8} />
      </mesh>

      {/* Left Bracing Arm */}
      <group position={[-0.45, 1.35, -0.15]} rotation={[0.4, 0.3, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.08, 0.55, 8]} />
          <meshStandardMaterial color={chassisColor} />
        </mesh>
      </group>

      {/* Right Arm with Tactical Plasma Assault Rifle */}
      <group position={[0.45, 1.35, -0.15]} rotation={[0.5, -0.2, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.08, 0.55, 8]} />
          <meshStandardMaterial color={chassisColor} />
        </mesh>
        {/* Bullpup Combat Rifle Chassis */}
        <mesh position={[-0.2, -0.3, -0.45]} rotation={[-0.5, 0.2, 0]} castShadow>
          <boxGeometry args={[0.14, 0.22, 1.1]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Rifle Barrel */}
        <mesh position={[-0.2, -0.25, -1.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.05, 0.55, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.95} />
        </mesh>
        {/* Holographic Scope */}
        <mesh position={[-0.2, -0.12, -0.55]}>
          <boxGeometry args={[0.06, 0.08, 0.22]} />
          <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={3.0} />
        </mesh>
      </group>

      {/* Articulated Biped Legs & Heavy Combat Boots */}
      <group ref={leftLegRef as any} position={[-0.24, 0.85, 0]}>
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.22, 0.7, 0.25]} />
          <meshStandardMaterial color={chassisColor} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.75, -0.06]} castShadow>
          <boxGeometry args={[0.24, 0.18, 0.42]} />
          <meshStandardMaterial color="#020617" roughness={0.8} />
        </mesh>
      </group>

      <group ref={rightLegRef as any} position={[0.24, 0.85, 0]}>
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.22, 0.7, 0.25]} />
          <meshStandardMaterial color={chassisColor} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.75, -0.06]} castShadow>
          <boxGeometry args={[0.24, 0.18, 0.42]} />
          <meshStandardMaterial color="#020617" roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

// Procedural fighter jet (fallback and enemy unit)
function ProceduralFighter({
  primaryColor,
  secondaryColor,
  chassisColor,
}: {
  primaryColor: string;
  secondaryColor: string;
  chassisColor: string;
}) {
  return (
    <group scale={[1.1, 1.1, 1.1]}>
      {/* Main Needle Cockpit & Forward Fuselage */}
      <mesh position={[0, 0.15, -0.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.55, 2.2, 10]} />
        <meshStandardMaterial color={primaryColor} metalness={0.85} roughness={0.15} />
      </mesh>

      {/* Central Armored Fuselage Core */}
      <mesh position={[0, 0.2, 0.3]} castShadow>
        <boxGeometry args={[1.1, 0.65, 2.8]} />
        <meshStandardMaterial color={chassisColor} metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Panoramic Aerodynamic Tinted Canopy */}
      <mesh position={[0, 0.6, -0.45]} rotation={[0.22, 0, 0]}>
        <boxGeometry args={[0.45, 0.35, 1.25]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={secondaryColor}
          emissiveIntensity={3.8}
          roughness={0.05}
          metalness={0.9}
        />
      </mesh>

      {/* Broad Swept-Forward Delta Wings */}
      <mesh position={[0, 0.12, 0.4]} rotation={[-0.05, 0, 0]} castShadow>
        <boxGeometry args={[5.4, 0.1, 1.8]} />
        <meshStandardMaterial color={primaryColor} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Wingtip Weapon Pods / Laser Disruptors */}
      <mesh position={[-2.7, 0.12, 0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 1.6, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.9} />
      </mesh>
      <mesh position={[2.7, 0.12, 0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 1.6, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.9} />
      </mesh>

      {/* Canting Twin Vertical Stabilizers / V-Tails */}
      <mesh position={[-0.75, 0.75, 1.3]} rotation={[0, 0, -0.35]} castShadow>
        <boxGeometry args={[0.1, 0.95, 0.9]} />
        <meshStandardMaterial color={primaryColor} metalness={0.8} />
      </mesh>
      <mesh position={[0.75, 0.75, 1.3]} rotation={[0, 0, 0.35]} castShadow>
        <boxGeometry args={[0.1, 0.95, 0.9]} />
        <meshStandardMaterial color={primaryColor} metalness={0.8} />
      </mesh>

      {/* Twin Superheated Afterburners / Ion Thruster Nozzles */}
      <mesh position={[-0.38, 0.18, 1.75]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.32, 0.5, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#38bdf8" emissiveIntensity={4.8} />
      </mesh>
      <mesh position={[0.38, 0.18, 1.75]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.32, 0.5, 12]} />
        <meshStandardMaterial color="#ffffff" emissive="#38bdf8" emissiveIntensity={4.8} />
      </mesh>
    </group>
  );
}

// Procedural Unit Model Component
function UnitMesh({
  unit,
  isSelected,
}: {
  unit: RTSUnit;
  isSelected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  const isTerran = unit.team === 0;
  const primaryColor = isTerran ? '#2563eb' : '#dc2626';
  const secondaryColor = isTerran ? '#38bdf8' : '#4ade80';
  const chassisColor = '#0f172a';

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(unit.x, unit.y, unit.z);
    groupRef.current.rotation.y = unit.rotY;

    // Biped stride animation for procedural units
    if (!unit.isAir && (leftLegRef.current || rightLegRef.current)) {
      const walkSwing = Math.sin(unit.walkCycle * 8) * 0.45;
      if (leftLegRef.current) leftLegRef.current.rotation.x = walkSwing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -walkSwing;
    }
  });

  return (
    <group ref={groupRef} position={[unit.x, unit.y, unit.z]} rotation={[0, unit.rotY, 0]}>
      {/* Selection Projector Ring */}
      {isSelected && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[unit.radius * 1.1, unit.radius * 1.35, 24]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.85} />
        </mesh>
      )}

      {/* --- BOT STRIKER / MARAUDER (SOLDIER GLB FOR HUMAN PLAYER) --- */}
      {unit.unitType === 'striker' && (
        unit.team === 0 ? (
          <Suspense
            fallback={
              <ProceduralStriker
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                chassisColor={chassisColor}
                leftLegRef={leftLegRef}
                rightLegRef={rightLegRef}
              />
            }>
            <PlayerSoldierMesh unit={unit} secondaryColor={secondaryColor} />
          </Suspense>
        ) : (
          <ProceduralStriker
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            chassisColor={chassisColor}
            leftLegRef={leftLegRef}
            rightLegRef={rightLegRef}
          />
        )
      )}

      {/* --- ARTILLERY TANK --- */}
      {unit.unitType === 'artillery' && (
        <group>
          {/* Heavy Dual Treads */}
          <mesh position={[-1.1, 0.5, 0]} castShadow>
            <boxGeometry args={[0.65, 0.9, 3.4]} />
            <meshStandardMaterial color={chassisColor} roughness={0.8} />
          </mesh>
          <mesh position={[1.1, 0.5, 0]} castShadow>
            <boxGeometry args={[0.65, 0.9, 3.4]} />
            <meshStandardMaterial color={chassisColor} roughness={0.8} />
          </mesh>
          {/* Armored Hull */}
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[1.9, 0.7, 2.8]} />
            <meshStandardMaterial color={primaryColor} metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Angled Mortar Turret */}
          <mesh position={[0, 1.6, 0.2]} rotation={[0.45, 0, 0]} castShadow>
            <boxGeometry args={[1.4, 0.9, 1.6]} />
            <meshStandardMaterial color={chassisColor} metalness={0.8} />
          </mesh>
          {/* Heavy Mortar Barrels */}
          <mesh position={[-0.35, 2.1, -1.1]} rotation={[0.45, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.28, 2.8, 10]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0.35, 2.1, -1.1]} rotation={[0.45, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.28, 2.8, 10]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      )}

      {/* --- RAPTOR / VULTURE FIGHTER (FIGHTER GLB FOR HUMAN PLAYER) --- */}
      {unit.unitType === 'fighter' && (
        unit.team === 0 ? (
          <Suspense
            fallback={
              <ProceduralFighter
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                chassisColor={chassisColor}
              />
            }>
            <PlayerFighterMesh unit={unit} secondaryColor={secondaryColor} />
          </Suspense>
        ) : (
          <ProceduralFighter
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            chassisColor={chassisColor}
          />
        )
      )}

      {/* --- TITAN ATLAS / OMEGA --- */}
      {unit.unitType === 'titan' && (
        <group scale={[1.45, 1.45, 1.45]}>
          {/* Massive Chest & Reactor Core */}
          <mesh position={[0, 2.8, 0]} castShadow>
            <boxGeometry args={[2.4, 1.8, 1.8]} />
            <meshStandardMaterial color={primaryColor} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 2.9, -0.95]}>
            <cylinderGeometry args={[0.6, 0.6, 0.3, 16]} rotation={[Math.PI / 2, 0, 0]} />
            <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={3.5} />
          </mesh>
          {/* Shoulder Missile Pods */}
          <mesh position={[-1.7, 3.6, 0]} castShadow>
            <boxGeometry args={[1.1, 1.0, 1.6]} />
            <meshStandardMaterial color={chassisColor} />
          </mesh>
          <mesh position={[1.7, 3.6, 0]} castShadow>
            <boxGeometry args={[1.1, 1.0, 1.6]} />
            <meshStandardMaterial color={chassisColor} />
          </mesh>
          {/* Giant Laser Arm Cannons */}
          <mesh position={[-1.7, 2.2, -1.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.4, 2.8, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
          <mesh position={[1.7, 2.2, -1.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.4, 2.8, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
          {/* Heavy Colossus Legs */}
          <group ref={leftLegRef} position={[-0.9, 1.5, 0]}>
            <mesh position={[0, -0.75, 0]} castShadow>
              <boxGeometry args={[0.7, 1.6, 0.8]} />
              <meshStandardMaterial color={chassisColor} roughness={0.7} />
            </mesh>
          </group>
          <group ref={rightLegRef} position={[0.9, 1.5, 0]}>
            <mesh position={[0, -0.75, 0]} castShadow>
              <boxGeometry args={[0.7, 1.6, 0.8]} />
              <meshStandardMaterial color={chassisColor} roughness={0.7} />
            </mesh>
          </group>
        </group>
      )}

      {/* --- AEGIS / SOVEREIGN BATTLECRUISER (AIR CAPITAL) --- */}
      {unit.unitType === 'cruiser' && (
        <group scale={[1.8, 1.8, 1.8]}>
          {/* Twin Catamaran Hulls */}
          <mesh position={[-1.2, 0, 0]} castShadow>
            <boxGeometry args={[1.2, 0.9, 6.4]} />
            <meshStandardMaterial color={primaryColor} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[1.2, 0, 0]} castShadow>
            <boxGeometry args={[1.2, 0.9, 6.4]} />
            <meshStandardMaterial color={primaryColor} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Central Deck & Command Bridge */}
          <mesh position={[0, 0.5, 0.4]} castShadow>
            <boxGeometry args={[1.8, 0.7, 4.2]} />
            <meshStandardMaterial color={chassisColor} metalness={0.8} />
          </mesh>
          <mesh position={[0, 1.3, 1.2]} castShadow>
            <boxGeometry args={[1.1, 0.9, 1.8]} />
            <meshStandardMaterial color={chassisColor} metalness={0.8} />
          </mesh>
          <mesh position={[0, 1.5, 0.5]}>
            <boxGeometry args={[0.9, 0.25, 0.4]} />
            <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={3.0} />
          </mesh>
          {/* Heavy Dorsal Ion Batteries */}
          <mesh position={[0, 1.0, -1.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.35, 3.2, 12]} />
            <meshStandardMaterial color="#475569" metalness={0.9} />
          </mesh>
          {/* Quad Ion Thrusters */}
          <mesh position={[-1.2, 0, 3.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 0.6, 12]} />
            <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={4.5} />
          </mesh>
          <mesh position={[1.2, 0, 3.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.4, 0.5, 0.6, 12]} />
            <meshStandardMaterial color="#ffffff" emissive={secondaryColor} emissiveIntensity={4.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Scenery Pine Trees & Rocks
function SceneryProps() {
  const rocks = useMemo(() => {
    const arr: Array<{x: number; z: number; scale: number; rotY: number}> = [];
    const seeded = (s: number) => {
      let v = s % 2147483647;
      return () => {
        v = (v * 16807) % 2147483647;
        return (v - 1) / 2147483646;
      };
    };
    const rand = seeded(4281);
    for (let i = 0; i < 48; i++) {
      const x = (rand() - 0.5) * 230;
      const z = (rand() - 0.5) * 130;
      // Skip center node and bases
      if (Math.hypot(x, z) < 22 || Math.hypot(x - 90, z) < 18 || Math.hypot(x + 90, z) < 18) {
        continue;
      }
      arr.push({x, z, scale: 0.8 + rand() * 1.6, rotY: rand() * Math.PI * 2});
    }
    return arr;
  }, []);

  const trees = useMemo(() => {
    const arr: Array<{x: number; z: number; scale: number}> = [];
    const seeded = (s: number) => {
      let v = s % 2147483647;
      return () => {
        v = (v * 16807) % 2147483647;
        return (v - 1) / 2147483646;
      };
    };
    const rand = seeded(9182);
    for (let i = 0; i < 55; i++) {
      const x = (rand() - 0.5) * 230;
      const z = (rand() - 0.5) * 130;
      if (Math.hypot(x, z) < 25 || Math.hypot(x - 90, z) < 22 || Math.hypot(x + 90, z) < 22) {
        continue;
      }
      arr.push({x, z, scale: 0.9 + rand() * 1.3});
    }
    return arr;
  }, []);

  return (
    <group>
      {/* Tundra Rocks */}
      {rocks.map((r, i) => (
        <mesh
          key={`rock-${i}`}
          position={[r.x, 0.8 * r.scale, r.z]}
          rotation={[0.2, r.rotY, 0.1]}
          scale={[r.scale * 1.5, r.scale * 0.9, r.scale * 1.2]}
          castShadow
          receiveShadow>
          <dodecahedronGeometry args={[1.6, 0]} />
          <meshStandardMaterial color="#475569" roughness={0.85} metalness={0.1} />
        </mesh>
      ))}

      {/* Conifer Pine Trees */}
      {trees.map((t, i) => (
        <group key={`tree-${i}`} position={[t.x, 0, t.z]} scale={[t.scale, t.scale, t.scale]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.35, 2.4, 6]} />
            <meshStandardMaterial color="#3e2723" roughness={0.9} />
          </mesh>
          {/* Pine Foliage Layers */}
          <mesh position={[0, 2.8, 0]} castShadow>
            <coneGeometry args={[1.8, 2.4, 6]} />
            <meshStandardMaterial color="#1b4332" roughness={0.8} />
          </mesh>
          <mesh position={[0, 4.2, 0]} castShadow>
            <coneGeometry args={[1.3, 2.0, 6]} />
            <meshStandardMaterial color="#2d6a4f" roughness={0.8} />
          </mesh>
          {/* Snow Cap */}
          <mesh position={[0, 4.9, 0]} castShadow>
            <coneGeometry args={[0.8, 1.2, 6]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Coastal Arctic Bay (Upper Left) */}
      <mesh position={[-85, 0.05, -45]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[28, 32]} />
        <meshStandardMaterial
          color="#0284c7"
          roughness={0.1}
          metalness={0.6}
          map={createProceduralWaterTexture()}
        />
      </mesh>
    </group>
  );
}

// Visual Beam Weapon Laser Mesh
function BeamRenderer({beam}: {beam: BeamEffect}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const start = useMemo(() => new THREE.Vector3(beam.sx, beam.sy, beam.sz), [beam]);
  const end = useMemo(() => new THREE.Vector3(beam.tx, beam.ty, beam.tz), [beam]);
  const length = useMemo(() => start.distanceTo(end), [start, end]);
  const mid = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [start, end]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(mid);
      meshRef.current.lookAt(end);
      meshRef.current.rotateX(Math.PI / 2);
    }
  }, [mid, end]);

  return (
    <group>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[beam.width * 0.5, beam.width * 0.5, length, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={beam.life / beam.maxLife} />
      </mesh>
      {/* Outer colored glow corona */}
      <mesh position={mid} lookAt={() => end}>
        <cylinderGeometry args={[beam.width * 1.4, beam.width * 1.4, length, 8]} />
        <meshBasicMaterial
          color={beam.color}
          transparent
          opacity={(beam.life / beam.maxLife) * 0.6}
        />
      </mesh>
    </group>
  );
}

// Volumetric Explosion Particles & Scorch Craters
function Pyrotechnics({
  particles,
  craters,
  orbitalStrike,
}: {
  particles: ExplosionParticle[];
  craters: ScorchCrater[];
  orbitalStrike: OrbitalStrike;
}) {
  return (
    <group>
      {/* Persistent Ground Scorch Craters */}
      {craters.map((c) => (
        <mesh key={`crater-${c.id}`} position={[c.x, 0.08, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[c.radius, 16]} />
          <meshBasicMaterial color="#090d16" transparent opacity={c.opacity} />
        </mesh>
      ))}

      {/* Volumetric Particles */}
      {particles.map((p) => (
        <mesh
          key={`part-${p.id}`}
          position={[p.x, p.y, p.z]}
          scale={[p.size, p.size, p.size]}>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshBasicMaterial
            color={p.color}
            transparent
            opacity={Math.max(0, p.life / p.maxLife)}
          />
        </mesh>
      ))}

      {/* Orbital Satellite Beam Strike (900m Cylinder) */}
      {orbitalStrike.active && (
        <group position={[orbitalStrike.x, 0, orbitalStrike.z]}>
          <mesh position={[0, 50, 0]}>
            <cylinderGeometry args={[4.5, 7.5, 100, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, 50, 0]}>
            <cylinderGeometry args={[9.0, 14.0, 100, 24]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.45} />
          </mesh>
          <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[12, 16, 32]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.8} />
          </mesh>
          <pointLight position={[0, 10, 0]} color="#00f0ff" intensity={25.0} distance={60} />
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MAIN SCENE LOGIC & SIMULATION COMPONENT
// ============================================================================
interface SceneProps {
  gameState: RTSGameState;
  setGameState: React.Dispatch<React.SetStateAction<RTSGameState>>;
  cameraAngle: number;
  cameraTarget: [number, number, number];
  orbitalAiming: boolean;
  onOrbitalFired: (x: number, z: number) => void;
  selectionBox: {x1: number; y1: number; x2: number; y2: number} | null;
  onUnitSelect: (ids: number[]) => void;
  onIssueOrder: (x: number, z: number, targetUnitId: number | null) => void;
}

function Scene({
  gameState,
  setGameState,
  cameraAngle,
  cameraTarget,
  orbitalAiming,
  onOrbitalFired,
  selectionBox,
  onUnitSelect,
  onIssueOrder,
}: SceneProps) {
  const {camera, gl, raycaster, pointer} = useThree();

  // Mutable RTS Simulation State (Zero garbage collection)
  const unitsRef = useRef<RTSUnit[]>([]);
  const basesRef = useRef<BaseFortress[]>([
    {
      team: 0,
      x: -90,
      z: 0,
      hp: getConfig('baseMaxHp'),
      maxHp: getConfig('baseMaxHp'),
      radius: 8.5,
      range: 34,
      damage: 38,
      cooldown: 0,
      fireRate: 0.8,
    },
    {
      team: 1,
      x: 90,
      z: 0,
      hp: getConfig('baseMaxHp'),
      maxHp: getConfig('baseMaxHp'),
      radius: 8.5,
      range: 34,
      damage: 38,
      cooldown: 0,
      fireRate: 0.8,
    },
  ]);

  const nodesRef = useRef<CaptureNode[]>([
    {id: 0, name: 'North Extractor', x: 0, z: -38, radius: 9.5, owner: -1, captureProgress: 0, capturingTeam: -1},
    {id: 1, name: 'Center Nexus', x: 0, z: 0, radius: 11.5, owner: -1, captureProgress: 0, capturingTeam: -1},
    {id: 2, name: 'South Extractor', x: 0, z: 38, radius: 9.5, owner: -1, captureProgress: 0, capturingTeam: -1},
  ]);

  const projectilesRef = useRef<Projectile[]>([]);
  const beamsRef = useRef<BeamEffect[]>([]);
  const particlesRef = useRef<ExplosionParticle[]>([]);
  const cratersRef = useRef<ScorchCrater[]>([]);
  const orbitalStrikeRef = useRef<OrbitalStrike>({
    active: false,
    x: 0,
    z: 0,
    timer: 0,
    duration: 1.2,
    team: 0,
  });

  const nextUnitIdRef = useRef(1);
  const nextProjIdRef = useRef(1);
  const nextPartIdRef = useRef(1);
  const aiDecisionTimerRef = useRef(0);
  const isPlayingRef = useRef(gameState.status === 'PLAYING');
  isPlayingRef.current = gameState.status === 'PLAYING';

  // Spawn Unit Helper
  const spawnUnit = useCallback(
    (team: 0 | 1, key: UnitTypeKey, techBonus = 1) => {
      const faction = team === 0 ? gameState.playerFaction : gameState.enemyFaction;
      const def = UNIT_CONFIGS[faction][key];
      const base = basesRef.current[team];

      for (let i = 0; i < def.spawnCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 7 + Math.random() * 5;
        const spawnX = base.x + Math.cos(angle) * dist;
        const spawnZ = base.z + Math.sin(angle) * dist;

        // Auto rally destination towards tactical nodes or enemy base
        let targetX = base.team === 0 ? 0 : 0;
        let targetZ = (i - 1) * 20;

        const newUnit: RTSUnit = {
          id: nextUnitIdRef.current++,
          team,
          unitType: key,
          name: def.name,
          x: spawnX,
          y: def.isAir ? (key === 'cruiser' ? 12 : 6.5) : 0,
          z: spawnZ,
          targetX,
          targetZ,
          rotY: team === 0 ? -Math.PI / 2 : Math.PI / 2,
          hp: def.hp * techBonus,
          maxHp: def.hp * techBonus,
          shield: def.shield * techBonus,
          maxShield: def.shield * techBonus,
          regen: def.regen,
          damage: def.damage * techBonus,
          range: def.range,
          speed: def.speed,
          fireRate: def.fireRate,
          cooldown: Math.random() * def.fireRate,
          splash: def.splash,
          isAir: def.isAir,
          isBeam: def.isBeam,
          radius: def.radius,
          targetUnitId: null,
          targetBase: false,
          walkCycle: 0,
          firingAnimationTimer: 0,
        };

        unitsRef.current.push(newUnit);
      }
    },
    [gameState.playerFaction, gameState.enemyFaction],
  );

  // Expose global spawn bridge for React UI production deck
  useEffect(() => {
    (window as any).__RTS_SPAWN_UNIT = (key: UnitTypeKey) => {
      const def = UNIT_CONFIGS[gameState.playerFaction][key];
      const techBonus = 1 + (gameState.playerTech - 1) * 0.2;
      spawnUnit(0, key, techBonus);
      gameAudio.playPowerupChime();
    };

    (window as any).__RTS_TRIGGER_EPIC_WAVE = () => {
      // Spawn massive battleclash in the center
      spawnUnit(0, 'titan', 1.4);
      spawnUnit(0, 'cruiser', 1.4);
      spawnUnit(0, 'artillery', 1.4);
      spawnUnit(0, 'fighter', 1.4);
      spawnUnit(1, 'titan', 1.4);
      spawnUnit(1, 'cruiser', 1.4);
      spawnUnit(1, 'artillery', 1.4);
      spawnUnit(1, 'fighter', 1.4);
      gameAudio.playLevelUpStinger();
    };

    (window as any).__RTS_ORDER_UNITS = (tx: number, tz: number, targetId: number | null) => {
      const selected = unitsRef.current.filter((u) => u.team === 0 && u.selected);
      const count = selected.length;
      if (count === 0) return;

      const cols = Math.ceil(Math.sqrt(count));
      selected.forEach((u, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        u.targetX = tx + (col - cols / 2) * (u.radius * 2.5);
        u.targetZ = tz + (row - cols / 2) * (u.radius * 2.5);
        u.targetUnitId = targetId;
      });
      gameAudio.playConfirmSelect();
    };
  }, [spawnUnit, gameState.playerFaction, gameState.playerTech]);

  // Spawn visual explosion helper
  const triggerExplosion = (x: number, y: number, z: number, scale = 1.0, color = '#f97316') => {
    gameAudio.playChiptuneExplosion();
    // Fireball particles
    for (let i = 0; i < 6; i++) {
      particlesRef.current.push({
        id: nextPartIdRef.current++,
        x,
        y: y + 0.5,
        z,
        scale,
        size: scale * 1.0,
        life: 0.45,
        maxLife: 0.45,
        color,
        isSmoke: false,
        vx: (Math.random() - 0.5) * 6 * scale,
        vy: 2 + Math.random() * 4 * scale,
        vz: (Math.random() - 0.5) * 6 * scale,
      });
    }
    // Carbon Smoke
    for (let i = 0; i < 5; i++) {
      particlesRef.current.push({
        id: nextPartIdRef.current++,
        x,
        y: y + 0.8,
        z,
        scale: scale * 1.4,
        size: scale * 1.4,
        life: 1.2,
        maxLife: 1.2,
        color: '#1e293b',
        isSmoke: true,
        vx: (Math.random() - 0.5) * 2 * scale,
        vy: 1.5 + Math.random() * 2 * scale,
        vz: (Math.random() - 0.5) * 2 * scale,
      });
    }

    // Scorch crater on snow
    if (cratersRef.current.length > 70) {
      cratersRef.current.shift();
    }
    cratersRef.current.push({
      id: nextPartIdRef.current++,
      x,
      z,
      radius: 2.2 * scale,
      opacity: 0.45,
    });
  };

  // Main RTS Game Loop
  useFrame((_, delta) => {
    if (!isPlayingRef.current) return;
    const dt = Math.min(delta, 0.08);

    const units = unitsRef.current;
    const bases = basesRef.current;
    const nodes = nodesRef.current;

    // --- 1. CAPTURE NODES REGENERATION & TERRITORY PROGRESSION ---
    let playerNodesCount = 0;
    nodes.forEach((node) => {
      let playerIn = 0;
      let enemyIn = 0;

      units.forEach((u) => {
        if (!u.isAir && Math.hypot(u.x - node.x, u.z - node.z) < node.radius + u.radius) {
          if (u.team === 0) playerIn++;
          else enemyIn++;
        }
      });

      if (playerIn > 0 && enemyIn === 0) {
        if (node.owner === 1) {
          node.captureProgress -= dt * (18 + playerIn * 5);
          if (node.captureProgress <= 0) {
            node.owner = -1;
            node.captureProgress = 0;
          }
        } else {
          node.capturingTeam = 0;
          node.captureProgress = Math.min(100, node.captureProgress + dt * (18 + playerIn * 5));
          if (node.captureProgress >= 100) {
            if (node.owner !== 0) gameAudio.playConfirmSelect();
            node.owner = 0;
          }
        }
      } else if (enemyIn > 0 && playerIn === 0) {
        if (node.owner === 0) {
          node.captureProgress -= dt * (18 + enemyIn * 5);
          if (node.captureProgress <= 0) {
            node.owner = -1;
            node.captureProgress = 0;
          }
        } else {
          node.capturingTeam = 1;
          node.captureProgress = Math.min(100, node.captureProgress + dt * (18 + enemyIn * 5));
          if (node.captureProgress >= 100) {
            node.owner = 1;
          }
        }
      }

      if (node.owner === 0) playerNodesCount++;
    });

    // --- 2. ECONOMY & REGEN TICK ---
    const incomePlayer = getConfig('baseIncomeRate') + playerNodesCount * getConfig('nodeIncomeBonus');
    const enemyNodesCount = nodes.filter((n) => n.owner === 1).length;
    const incomeEnemy = getConfig('baseIncomeRate') + enemyNodesCount * getConfig('nodeIncomeBonus');

    // --- 3. UNIT COMBAT, FLOCKING, ATTACK & PATHING ---
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      u.cooldown -= dt;
      u.walkCycle += dt * u.speed * 0.35;

      // Energy Shield / Structural HP Regeneration
      if (u.team === 0 && u.maxShield > 0) {
        u.shield = Math.min(u.maxShield, u.shield + 4.8 * dt);
      }
      if (u.regen > 0) {
        u.hp = Math.min(u.maxHp, u.hp + u.regen * dt);
      }

      // Find Closest Target
      let target: RTSUnit | null = null;
      let minTargetDist = Infinity;

      // Check if assigned unit target is still valid
      if (u.targetUnitId !== null) {
        const assigned = units.find((other) => other.id === u.targetUnitId && other.team !== u.team);
        if (assigned) {
          target = assigned;
          minTargetDist = Math.hypot(u.x - target.x, u.z - target.z);
        } else {
          u.targetUnitId = null;
        }
      }

      if (!target) {
        for (let j = 0; j < units.length; j++) {
          const other = units[j];
          if (other.team !== u.team) {
            const d = Math.hypot(u.x - other.x, u.z - other.z);
            if (d < u.range + 18 && d < minTargetDist) {
              minTargetDist = d;
              target = other;
            }
          }
        }
      }

      // Check Enemy Base Target
      const enemyBase = bases[u.team === 0 ? 1 : 0];
      const distToBase = Math.hypot(u.x - enemyBase.x, u.z - enemyBase.z);
      const isBaseInTargetRange = distToBase < u.range + enemyBase.radius + 8;

      // Combat or Advance
      if (target && minTargetDist <= u.range) {
        // Face enemy target
        u.rotY = Math.atan2(target.x - u.x, target.z - u.z);

        if (u.cooldown <= 0) {
          u.cooldown = u.fireRate;
          u.firingAnimationTimer = 0.2;

          if (u.isBeam) {
            // Instant continuous laser beam
            beamsRef.current.push({
              id: nextProjIdRef.current++,
              sx: u.x,
              sy: u.y + (u.isAir ? 0.5 : 2.5),
              sz: u.z,
              tx: target.x,
              ty: target.y + 1.2,
              tz: target.z,
              life: 0.25,
              maxLife: 0.25,
              color: u.team === 0 ? '#38bdf8' : '#4ade80',
              width: u.unitType === 'cruiser' ? 0.65 : 0.4,
            });
            gameAudio.playArcadeLaser();

            // Apply Beam Damage
            if (target.shield > 0) {
              target.shield -= u.damage;
              if (target.shield < 0) {
                target.hp += target.shield;
                target.shield = 0;
              }
            } else {
              target.hp -= u.damage;
            }
            triggerExplosion(target.x, target.y + 1, target.z, 0.6);
          } else if (u.splash > 0) {
            // Ballistic Artillery Mortar Arc
            projectilesRef.current.push({
              id: nextProjIdRef.current++,
              team: u.team,
              sx: u.x,
              sy: u.y + 1.8,
              sz: u.z,
              tx: target.x,
              ty: target.y,
              tz: target.z,
              cx: u.x,
              cy: u.y + 1.8,
              cz: u.z,
              progress: 0,
              speed: 28,
              damage: u.damage,
              splash: u.splash,
              color: u.team === 0 ? '#60a5fa' : '#ef4444',
              isArc: true,
            });
            gameAudio.playGunshotBlast();
          } else {
            // Direct Pulse Laser Bolt
            projectilesRef.current.push({
              id: nextProjIdRef.current++,
              team: u.team,
              sx: u.x,
              sy: u.y + (u.isAir ? 0 : 1.4),
              sz: u.z,
              tx: target.x,
              ty: target.y + 1.0,
              tz: target.z,
              cx: u.x,
              cy: u.y + (u.isAir ? 0 : 1.4),
              cz: u.z,
              progress: 0,
              speed: 55,
              damage: u.damage,
              splash: 0,
              color: u.team === 0 ? '#38bdf8' : '#4ade80',
              isArc: false,
            });
            gameAudio.playArcadeLaser();
          }
        }
      } else if (isBaseInTargetRange && !target) {
        // Attack Enemy Base
        u.rotY = Math.atan2(enemyBase.x - u.x, enemyBase.z - u.z);
        if (u.cooldown <= 0) {
          u.cooldown = u.fireRate;
          if (u.isBeam) {
            beamsRef.current.push({
              id: nextProjIdRef.current++,
              sx: u.x,
              sy: u.y + (u.isAir ? 0.5 : 2.5),
              sz: u.z,
              tx: enemyBase.x,
              ty: 3.5,
              tz: enemyBase.z,
              life: 0.25,
              maxLife: 0.25,
              color: u.team === 0 ? '#38bdf8' : '#4ade80',
              width: 0.5,
            });
            enemyBase.hp -= u.damage;
            triggerExplosion(enemyBase.x, 3.5, enemyBase.z, 0.8);
          } else {
            projectilesRef.current.push({
              id: nextProjIdRef.current++,
              team: u.team,
              sx: u.x,
              sy: u.y + 1.5,
              sz: u.z,
              tx: enemyBase.x,
              ty: 3.0,
              tz: enemyBase.z,
              cx: u.x,
              cy: u.y + 1.5,
              cz: u.z,
              progress: 0,
              speed: 40,
              damage: u.damage,
              splash: u.splash,
              color: u.team === 0 ? '#38bdf8' : '#ef4444',
              isArc: u.splash > 0,
            });
          }
        }
      } else {
        // Move towards target coordinates or auto-advance
        const dx = u.targetX - u.x;
        const dz = u.targetZ - u.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 1.5) {
          const moveSpeed = u.speed * dt;
          u.rotY = Math.atan2(dx, dz);
          u.x += (dx / dist) * moveSpeed;
          u.z += (dz / dist) * moveSpeed;
        } else if (gameState.autoAdvance) {
          // Auto route to enemy base if reached waypoint
          u.targetX = enemyBase.x;
          u.targetZ = enemyBase.z;
        }
      }

      // Soft Collision Avoidance (Flocking separation)
      for (let j = i + 1; j < units.length; j++) {
        const other = units[j];
        if (u.isAir === other.isAir) {
          const sx = u.x - other.x;
          const sz = u.z - other.z;
          const d = Math.hypot(sx, sz);
          const minSep = u.radius + other.radius;
          if (d > 0.001 && d < minSep) {
            const push = ((minSep - d) / minSep) * 12 * dt;
            u.x += (sx / d) * push;
            u.z += (sz / d) * push;
            other.x -= (sx / d) * push;
            other.z -= (sz / d) * push;
          }
        }
      }
    }

    // --- 4. BASE DEFENSIVE TURRETS ---
    bases.forEach((base) => {
      base.cooldown -= dt;
      if (base.cooldown <= 0) {
        const oppTeam = base.team === 0 ? 1 : 0;
        const enemyInRange = units.find(
          (u) => u.team === oppTeam && Math.hypot(u.x - base.x, u.z - base.z) < base.range,
        );
        if (enemyInRange) {
          base.cooldown = base.fireRate;
          projectilesRef.current.push({
            id: nextProjIdRef.current++,
            team: base.team,
            sx: base.x,
            sy: 6.5,
            sz: base.z,
            tx: enemyInRange.x,
            ty: enemyInRange.y + 1.2,
            tz: enemyInRange.z,
            cx: base.x,
            cy: 6.5,
            cz: base.z,
            progress: 0,
            speed: 48,
            damage: base.damage,
            splash: 4.5,
            color: base.team === 0 ? '#38bdf8' : '#ef4444',
            isArc: true,
          });
          gameAudio.playGunshotBlast();
        }
      }
    });

    // --- 5. PROJECTILES SIMULATION & IMPACTS ---
    const projs = projectilesRef.current;
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i];
      const totalDist = Math.hypot(p.tx - p.sx, p.tz - p.sz);
      p.progress += (p.speed * dt) / Math.max(1, totalDist);

      if (p.progress >= 1) {
        // Impact!
        triggerExplosion(p.tx, p.ty, p.tz, p.splash > 0 ? 1.4 : 0.7, p.color);

        // Apply direct / splash damage
        units.forEach((target) => {
          if (target.team !== p.team) {
            const d = Math.hypot(target.x - p.tx, target.z - p.tz);
            if (d < (p.splash > 0 ? p.splash : target.radius + 1.5)) {
              if (target.shield > 0) {
                target.shield -= p.damage;
                if (target.shield < 0) {
                  target.hp += target.shield;
                  target.shield = 0;
                }
              } else {
                target.hp -= p.damage;
              }
            }
          }
        });

        // Base damage on direct hit
        const oppBase = bases[p.team === 0 ? 1 : 0];
        if (Math.hypot(oppBase.x - p.tx, oppBase.z - p.tz) < oppBase.radius + 2) {
          oppBase.hp = Math.max(0, oppBase.hp - p.damage);
        }

        projs.splice(i, 1);
      } else {
        p.cx = p.sx + (p.tx - p.sx) * p.progress;
        p.cz = p.sz + (p.tz - p.sz) * p.progress;
        if (p.isArc) {
          p.cy = p.sy + (p.ty - p.sy) * p.progress + Math.sin(p.progress * Math.PI) * 12;
        } else {
          p.cy = p.sy + (p.ty - p.sy) * p.progress;
        }
      }
    }

    // --- 6. BEAMS & PARTICLES LIFECYCLE ---
    const beams = beamsRef.current;
    for (let i = beams.length - 1; i >= 0; i--) {
      beams[i].life -= dt;
      if (beams[i].life <= 0) beams.splice(i, 1);
    }

    const parts = particlesRef.current;
    for (let i = parts.length - 1; i >= 0; i--) {
      const pt = parts[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      if (pt.isSmoke) {
        pt.size += dt * 0.8;
      }
      if (pt.life <= 0) parts.splice(i, 1);
    }

    // Orbital Strike Satellite Timer
    if (orbitalStrikeRef.current.active) {
      orbitalStrikeRef.current.timer -= dt;
      if (orbitalStrikeRef.current.timer <= 0) {
        orbitalStrikeRef.current.active = false;
      }
    }

    // --- 7. CLEANUP DEAD UNITS ---
    let unitsKilledThisFrame = 0;
    let unitsLostThisFrame = 0;
    for (let i = units.length - 1; i >= 0; i--) {
      const u = units[i];
      if (u.hp <= 0) {
        triggerExplosion(u.x, u.y + 1, u.z, u.radius * 0.8);
        if (u.team === 1) unitsKilledThisFrame++;
        else unitsLostThisFrame++;
        units.splice(i, 1);
      }
    }

    // --- 8. TACTICAL AI DECISION TREE ---
    aiDecisionTimerRef.current -= dt;
    const aiInterval =
      gameState.difficulty === 'easy' ? 2.4 : gameState.difficulty === 'hard' ? 1.1 : 1.7;

    if (aiDecisionTimerRef.current <= 0) {
      aiDecisionTimerRef.current = aiInterval;

      // Tech upgrade check
      if (gameState.enemyTech === 1 && gameState.enemyAether >= 160 && Math.random() < 0.5) {
        setGameState((prev) => ({
          ...prev,
          enemyTech: 2,
          enemyAether: prev.enemyAether - 150,
        }));
      } else if (gameState.enemyTech === 2 && gameState.enemyAether >= 250 && Math.random() < 0.45) {
        setGameState((prev) => ({
          ...prev,
          enemyTech: 3,
          enemyAether: prev.enemyAether - 240,
        }));
      }

      // AI Production Priority
      const roll = Math.random();
      if (gameState.enemyTech >= 3 && gameState.enemyAether >= 250 && roll < 0.35) {
        spawnUnit(1, 'cruiser', 1.4);
        setGameState((prev) => ({...prev, enemyAether: prev.enemyAether - 250}));
      } else if (gameState.enemyTech >= 2 && gameState.enemyAether >= 165 && roll < 0.5) {
        spawnUnit(1, 'titan', 1.2);
        setGameState((prev) => ({...prev, enemyAether: prev.enemyAether - 165}));
      } else if (gameState.enemyAether >= 95 && roll < 0.7) {
        spawnUnit(1, 'fighter', 1.0);
        setGameState((prev) => ({...prev, enemyAether: prev.enemyAether - 95}));
      } else if (gameState.enemyAether >= 80 && roll < 0.85) {
        spawnUnit(1, 'artillery', 1.0);
        setGameState((prev) => ({...prev, enemyAether: prev.enemyAether - 80}));
      } else if (gameState.enemyAether >= 45) {
        spawnUnit(1, 'striker', 1.0);
        setGameState((prev) => ({...prev, enemyAether: prev.enemyAether - 45}));
      }

      // AI Tactical Maneuvers (Node capturing vs All-out push)
      const aiTroops = units.filter((u) => u.team === 1);
      const openNodes = nodes.filter((n) => n.owner !== 1);
      if (openNodes.length > 0 && aiTroops.length < 8) {
        aiTroops.forEach((u, idx) => {
          const targetNode = openNodes[idx % openNodes.length];
          u.targetX = targetNode.x + (Math.random() - 0.5) * 6;
          u.targetZ = targetNode.z + (Math.random() - 0.5) * 6;
        });
      } else {
        // Coordinated Assault on Player Base
        aiTroops.forEach((u) => {
          u.targetX = bases[0].x;
          u.targetZ = bases[0].z;
        });
      }
    }

    // --- 9. SYNCHRONIZE REACT TELEMETRY (Every frame update) ---
    const pPop = units.filter((u) => u.team === 0).length;
    const ePop = units.filter((u) => u.team === 1).length;

    setGameState((prev) => {
      const newPlayerAether = prev.aether + incomePlayer * dt;
      const newEnemyAether = prev.enemyAether + incomeEnemy * dt;
      const newOrbitalCharge = Math.min(
        100,
        prev.orbitalCharge + (getConfig('orbitalChargeRate') + playerNodesCount * 1.5) * dt,
      );

      // Check Victory / Defeat
      if (bases[1].hp <= 0 && prev.status === 'PLAYING') {
        gameAudio.playVictoryFanfare();
        return {
          ...prev,
          status: 'VICTORY',
          score: Math.floor(prev.score + 1500 + prev.unitsDestroyed * 50 - prev.matchTimer * 2),
        };
      }
      if (bases[0].hp <= 0 && prev.status === 'PLAYING') {
        gameAudio.playDefeatMotif();
        return {
          ...prev,
          status: 'GAME_OVER',
          score: Math.floor(prev.score + prev.unitsDestroyed * 30),
        };
      }

      return {
        ...prev,
        aether: newPlayerAether,
        enemyAether: newEnemyAether,
        playerSupply: pPop,
        enemySupply: ePop,
        orbitalCharge: newOrbitalCharge,
        playerBaseHp: bases[0].hp,
        enemyBaseHp: bases[1].hp,
        nodesCapturedByPlayer: playerNodesCount,
        matchTimer: prev.matchTimer + dt,
        unitsDestroyed: prev.unitsDestroyed + unitsKilledThisFrame,
        unitsLost: prev.unitsLost + unitsLostThisFrame,
      };
    });

    // --- 10. SMOOTH ISOMETRIC DIMETRIC CAMERA TRACKING ---
    const camDist = 120;
    const camHeight = 120;
    const targetCamX = cameraTarget[0] + Math.sin(cameraAngle) * camDist;
    const targetCamZ = cameraTarget[2] + Math.cos(cameraAngle) * camDist;

    const smoothFactor = 1 - Math.exp(-16 * dt);
    camera.position.x += (targetCamX - camera.position.x) * smoothFactor;
    camera.position.y += (cameraTarget[1] + camHeight - camera.position.y) * smoothFactor;
    camera.position.z += (targetCamZ - camera.position.z) * smoothFactor;

    camera.lookAt(cameraTarget[0], cameraTarget[1], cameraTarget[2]);
  });

  // Handle Raycasted Pointer Clicks on Ground Plane for Unit Orders or Orbital Strike
  const handleGroundPointerDown = (event: any) => {
    if (event.nativeEvent.button === 2) {
      // Right Click -> Move/Attack Order
      event.stopPropagation();
      const point = event.point;
      onIssueOrder(point.x, point.z, null);
      (window as any).__RTS_ORDER_UNITS?.(point.x, point.z, null);
    } else if (event.nativeEvent.button === 0) {
      // Left Click
      if (orbitalAiming) {
        event.stopPropagation();
        const point = event.point;
        onOrbitalFired(point.x, point.z);

        // Detonate Orbital Strike
        orbitalStrikeRef.current = {
          active: true,
          x: point.x,
          z: point.z,
          timer: 1.2,
          duration: 1.2,
          team: 0,
        };
        gameAudio.playLevelUpStinger();
        triggerExplosion(point.x, 0, point.z, 3.5, '#00f0ff');

        // AOE Damage
        unitsRef.current.forEach((u) => {
          if (u.team === 1 && Math.hypot(u.x - point.x, u.z - point.z) < 22) {
            u.hp -= 265;
          }
        });
        const oppBase = basesRef.current[1];
        if (Math.hypot(oppBase.x - point.x, oppBase.z - point.z) < oppBase.radius + 18) {
          oppBase.hp = Math.max(0, oppBase.hp - 320);
        }
      }
    }
  };

  const snowTexture = useMemo(() => createProceduralSnowTexture(), []);

  return (
    <group>
      {/* Terrain Mesh with Procedural Arctic Snow & Permafrost */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerDown={handleGroundPointerDown}>
        <planeGeometry args={[260, 150, 48, 48]} />
        <meshStandardMaterial
          map={snowTexture}
          roughness={0.85}
          metalness={0.1}
          color="#f1f5f9"
        />
      </mesh>

      {/* Scenery Environment Props (Rocks, Pine Trees, Coastal Bay) */}
      <SceneryProps />

      {/* Bases */}
      <BaseMesh base={basesRef.current[0]} faction={gameState.playerFaction} />
      <BaseMesh base={basesRef.current[1]} faction={gameState.enemyFaction} />

      {/* Strategic Aether Capture Nodes */}
      {nodesRef.current.map((n) => (
        <NodeMesh key={`node-${n.id}`} node={n} />
      ))}

      {/* Units */}
      {unitsRef.current.map((u) => (
        <UnitMesh
          key={`unit-${u.id}`}
          unit={u}
          isSelected={gameState.selectedUnitIds.includes(u.id)}
        />
      ))}

      {/* Projectiles */}
      {projectilesRef.current.map((p) => (
        <mesh key={`proj-${p.id}`} position={[p.cx, p.cy, p.cz]}>
          <sphereGeometry args={[p.splash > 0 ? 0.45 : 0.25, 8, 8]} />
          <meshBasicMaterial color={p.color} />
        </mesh>
      ))}

      {/* Continuous Laser Beams */}
      {beamsRef.current.map((b) => (
        <BeamRenderer key={`beam-${b.id}`} beam={b} />
      ))}

      {/* Pyrotechnics, Smokes & Scorch Decals */}
      <Pyrotechnics
        particles={particlesRef.current}
        craters={cratersRef.current}
        orbitalStrike={orbitalStrikeRef.current}
      />
    </group>
  );
}

// ============================================================================
// DYNAMIC 3-POINT LIGHTING COMPONENT
// ============================================================================
function TacticalLighting({mode}: {mode: string}) {
  let sunColor = '#fff7ed';
  let sunIntensity = 3.6;
  let skyColor = '#dbeafe';
  let groundColor = '#334155';

  if (mode === 'dusk') {
    sunColor = '#fb923c';
    sunIntensity = 2.8;
    skyColor = '#c084fc';
    groundColor = '#1e1b4b';
  } else if (mode === 'noon') {
    sunColor = '#ffffff';
    sunIntensity = 4.2;
    skyColor = '#93c5fd';
    groundColor = '#475569';
  }

  return (
    <>
      <ambientLight color="#94a3b8" intensity={1.6} />
      <directionalLight
        position={[-95, 110, -75]}
        intensity={sunIntensity}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={10}
        shadow-camera-far={320}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-bias={-0.0005}
      />
      {/* Rim Fill Light */}
      <directionalLight position={[100, 70, 90]} intensity={1.0} color="#38bdf8" />
      <hemisphereLight color={skyColor} groundColor={groundColor} intensity={1.2} />
    </>
  );
}

// ============================================================================
// GAME ROOT EXPORT
// ============================================================================
export interface GameProps {
  gameState: RTSGameState;
  setGameState: React.Dispatch<React.SetStateAction<RTSGameState>>;
  cameraAngle: number;
  cameraZoom: number;
  cameraTarget: [number, number, number];
  orbitalAiming: boolean;
  onOrbitalFired: (x: number, z: number) => void;
  selectionBox: {x1: number; y1: number; x2: number; y2: number} | null;
  onUnitSelect: (ids: number[]) => void;
  onIssueOrder: (x: number, z: number, targetUnitId: number | null) => void;
  onPanCamera?: (dx: number, dz: number) => void;
}

export function Game({
  gameState,
  setGameState,
  cameraAngle,
  cameraZoom,
  cameraTarget,
  orbitalAiming,
  onOrbitalFired,
  selectionBox,
  onUnitSelect,
  onIssueOrder,
}: GameProps) {
  return (
    <div
      className="w-full h-full relative select-none"
      onContextMenu={(e) => e.preventDefault()}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}>
        <OrthographicCamera
          makeDefault
          zoom={cameraZoom}
          near={-500}
          far={1500}
          position={[0, 120, 120]}
        />
        <Suspense fallback={null}>
          <TacticalLighting mode={gameState.lightingMode} />

          <Scene
            gameState={gameState}
            setGameState={setGameState}
            cameraAngle={cameraAngle}
            cameraTarget={cameraTarget}
            orbitalAiming={orbitalAiming}
            onOrbitalFired={onOrbitalFired}
            selectionBox={selectionBox}
            onUnitSelect={onUnitSelect}
            onIssueOrder={onIssueOrder}
          />

          <EffectComposer>
            <Bloom
              luminanceThreshold={1.2}
              luminanceSmoothing={0.8}
              intensity={0.45}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
export default Game;
