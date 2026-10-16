import {MusicTrack} from './utils/helper';

/** Game configuration schema. */
export const CONFIG = {
  // --- Game ---
  title: {
    value: 'Aether Protocol: Shattered Sun',
    type: 'string',
    label: 'Game Title',
    group: 'Game',
  },
  baseCanvasWidth: {
    value: 1920,
    type: 'number',
    label: 'Base Width',
    group: 'Game',
  },
  baseCanvasHeight: {
    value: 1080,
    type: 'number',
    label: 'Base Height',
    group: 'Game',
  },

  // --- Camera ---
  fov: {
    value: 50,
    type: 'number',
    label: 'Field of View',
    group: 'Camera',
    min: 30,
    max: 90,
    step: 5,
  },
  cameraX: {
    value: 0,
    type: 'number',
    label: 'Camera X',
    group: 'Camera',
  },
  cameraY: {
    value: 85,
    type: 'number',
    label: 'Camera Y',
    group: 'Camera',
  },
  cameraZ: {
    value: 105,
    type: 'number',
    label: 'Camera Z',
    group: 'Camera',
  },

  // --- Visuals & Theme ---
  backgroundColor: {
    value: '#08101a',
    type: 'color',
    label: 'Background Color',
    group: 'Visuals',
  },
  ambientColor: {
    value: '#94a3b8',
    type: 'color',
    label: 'Ambient Light Color',
    group: 'Visuals',
  },
  ambientIntensity: {
    value: 1.6,
    type: 'number',
    label: 'Ambient Intensity',
    group: 'Visuals',
    min: 0,
    max: 5,
    step: 0.1,
  },
  sunColor: {
    value: '#fff7ed',
    type: 'color',
    label: 'Sun Color',
    group: 'Visuals',
  },
  sunIntensity: {
    value: 3.6,
    type: 'number',
    label: 'Sun Intensity',
    group: 'Visuals',
    min: 0,
    max: 10,
    step: 0.1,
  },
  hemiSkyColor: {
    value: '#dbeafe',
    type: 'color',
    label: 'Hemisphere Sky Color',
    group: 'Visuals',
  },
  hemiGroundColor: {
    value: '#334155',
    type: 'color',
    label: 'Hemisphere Ground Color',
    group: 'Visuals',
  },
  hemiIntensity: {
    value: 1.2,
    type: 'number',
    label: 'Hemisphere Intensity',
    group: 'Visuals',
    min: 0,
    max: 3,
    step: 0.1,
  },
  primaryColor: {
    value: '#00f0ff',
    type: 'color',
    label: 'Primary UI Color',
    group: 'Visuals',
  },
  fontFamily: {
    value: 'Orbitron, Share Tech Mono, monospace',
    type: 'string',
    label: 'Font Family',
    group: 'Visuals',
  },

  // --- Economy & Rules ---
  startingAether: {
    value: 280,
    type: 'number',
    label: 'Starting Aether',
    group: 'Rules',
    min: 100,
    max: 1000,
    step: 20,
  },
  baseIncomeRate: {
    value: 16,
    type: 'number',
    label: 'Base Income Rate (/s)',
    group: 'Rules',
    min: 5,
    max: 50,
    step: 1,
  },
  nodeIncomeBonus: {
    value: 9,
    type: 'number',
    label: 'Node Income Bonus (/s)',
    group: 'Rules',
    min: 2,
    max: 30,
    step: 1,
  },
  maxSupply: {
    value: 90,
    type: 'number',
    label: 'Max Population Supply',
    group: 'Rules',
    min: 30,
    max: 150,
    step: 10,
  },
  baseMaxHp: {
    value: 3200,
    type: 'number',
    label: 'Base Max HP',
    group: 'Rules',
    min: 1000,
    max: 6000,
    step: 100,
  },
  orbitalChargeRate: {
    value: 2.0,
    type: 'number',
    label: 'Orbital Charge Rate (%/s)',
    group: 'Rules',
    min: 0.5,
    max: 10.0,
    step: 0.5,
  },
  autoAdvanceDefault: {
    value: true,
    type: 'boolean',
    label: 'Auto Advance Default',
    group: 'Rules',
  },

  // --- Physics & World ---
  gravity: {
    value: -9.81,
    type: 'number',
    label: 'Gravity',
    group: 'Physics',
    min: -30,
    max: 0,
    step: 0.5,
  },
  worldWidth: {
    value: 240,
    type: 'number',
    label: 'World Width',
    group: 'World',
  },
  worldHeight: {
    value: 140,
    type: 'number',
    label: 'World Height',
    group: 'World',
  },

  // --- System ---
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'System',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'System',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'System',
  },

  // --- Audio ---
  defaultMusicVolume: {
    value: 0.45,
    type: 'number',
    label: 'Default Music Volume',
    group: 'Audio',
    min: 0,
    max: 1,
    step: 0.05,
  },
  defaultSfxVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'Audio',
    min: 0,
    max: 1,
    step: 0.05,
  },
  backgroundMusicUrl: {
    value: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/titan_clash.mp3',
    type: 'string',
    label: 'Background Music URL',
    group: 'Audio',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/** Type helper for reading values in game code. */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export const AVAILABLE_MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    name: 'titan_clash',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/titan_clash.mp3',
    description: 'Epic, relentless orchestral battle music with war drums and brass.',
  },
  {
    name: 'grid_runner',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/grid_runner.mp3',
    description: 'A cyberpunk-style track with a fast-paced, high-energy beat.',
  },
  {
    name: 'stellar_drift',
    url: 'https://storage.googleapis.com/assets-gen-playground/musiclibrary/stellar_drift.mp3',
    description: 'Spacious ambient synths and slow arpeggios for tactical strategy.',
  },
];
