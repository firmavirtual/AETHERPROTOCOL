// tslint:disable
/* eslint-disable */
import {GamePhase} from './utils/helper';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Position3D = [number, number, number];

export interface Entity3D {
  id: string | number;
  type?: string;
  position: Vec3 | Position3D;
  rotation?: Vec3 | Position3D;
  scale?: Vec3 | Position3D;
  velocity?: Vec3;
  active?: boolean;
  [key: string]: any;
}

export interface Particle {
  id: string | number;
  position: Vec3 | Position3D;
  velocity?: Vec3 | Position3D;
  life: number;
  maxLife: number;
  color?: string;
  size?: number;
  [key: string]: any;
}

export type FactionId = 'terran' | 'xeno';
export type AiDifficulty = 'easy' | 'normal' | 'hard';
export type LightingMode = 'arctic' | 'dusk' | 'noon';

export type UnitTypeKey = 'striker' | 'artillery' | 'fighter' | 'titan' | 'cruiser';

export interface UnitDef {
  key: UnitTypeKey;
  name: string;
  cost: number;
  pop: number;
  spawnCount: number;
  reqTech: number;
  hp: number;
  shield: number;
  regen: number;
  damage: number;
  range: number;
  speed: number;
  fireRate: number;
  splash: number;
  isAir: boolean;
  isBeam: boolean;
  radius: number;
  description: string;
}

export interface RTSUnit {
  id: number;
  team: 0 | 1; // 0: Player, 1: AI
  unitType: UnitTypeKey;
  name: string;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetZ: number;
  rotY: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  regen: number;
  damage: number;
  range: number;
  speed: number;
  fireRate: number;
  cooldown: number;
  splash: number;
  isAir: boolean;
  isBeam: boolean;
  radius: number;
  targetUnitId: number | null;
  targetBase: boolean;
  selected?: boolean;
  walkCycle: number;
  firingAnimationTimer: number;
}

export interface CaptureNode {
  id: number;
  name: string;
  x: number;
  z: number;
  radius: number;
  owner: -1 | 0 | 1; // -1: Neutral, 0: Player, 1: AI
  captureProgress: number; // 0 to 100
  capturingTeam: -1 | 0 | 1;
}

export interface BaseFortress {
  team: 0 | 1;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  radius: number;
  range: number;
  damage: number;
  cooldown: number;
  fireRate: number;
}

export interface Projectile {
  id: number;
  team: 0 | 1;
  sx: number;
  sy: number;
  sz: number;
  tx: number;
  ty: number;
  tz: number;
  cx: number;
  cy: number;
  cz: number;
  progress: number;
  speed: number;
  damage: number;
  splash: number;
  color: string;
  isArc: boolean;
}

export interface BeamEffect {
  id: number;
  sx: number;
  sy: number;
  sz: number;
  tx: number;
  ty: number;
  tz: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export interface ExplosionParticle {
  id: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  isSmoke: boolean;
  vx: number;
  vy: number;
  vz: number;
}

export type VisualExplosion = ExplosionParticle;

export interface ScorchCrater {
  id: number;
  x: number;
  z: number;
  radius: number;
  opacity: number;
}

export interface OrbitalStrike {
  active: boolean;
  x: number;
  z: number;
  timer: number;
  duration: number;
  team: 0 | 1;
}

export interface RTSGameState {
  status: GamePhase;
  score: number;
  level: number;
  playerFaction: FactionId;
  enemyFaction: FactionId;
  difficulty: AiDifficulty;
  lightingMode: LightingMode;
  aether: number;
  enemyAether: number;
  playerSupply: number;
  enemySupply: number;
  playerTech: number;
  enemyTech: number;
  orbitalCharge: number;
  enemyOrbitalCharge: number;
  autoAdvance: boolean;
  selectedUnitIds: number[];
  playerBaseHp: number;
  enemyBaseHp: number;
  nodesCapturedByPlayer: number;
  matchTimer: number;
  unitsDestroyed: number;
  unitsLost: number;
  epicWaveTriggered: boolean;
}
