// PORT SABLE — tuning constants for every system, in one place so the city, the cars, the police
// and the HUD all agree. World units are roughly pixels at camera zoom 1; a sedan is 46 long.

/** The internal canvas the game is drawn at, then scaled to the window. */
export const VIEW = { width: 1280, height: 720 };

/** The fixed simulation step. Every system is written against this, so replays are exact. */
export const STEP = 1 / 60;

/** The whole island-city, in world units. The gulf is to the south. */
export const WORLD = { width: 3600, height: 2700 };

/** Road geometry: half-widths, the sidewalk ring around each block, lane offset for traffic. */
export const ROAD = {
  half: 32,
  arterialHalf: 45,
  sidewalk: 15,
  lane: 15,
  arterialLane: 22,
  dash: 26,
};

/** Riley Voss on foot. */
export const PLAYER = {
  radius: 9,
  walk: 132,
  run: 212,
  accel: 1400,
  health: 100,
  punchRange: 34,
  punchTime: 0.3,
  punchDamage: 26,
  hotwireTime: 1.45,
};

/** Camera: how hard it follows, how far it pulls out with speed, how much a hit shakes it. */
export const CAMERA = {
  footZoom: 1.44,
  driveZoom: 1.12,
  lerp: 7.5,
  zoomLerp: 2.6,
  lead: 0.26,
  shakeDecay: 4.2,
  maxShake: 16,
};

/** Golden hour. The sun sits low in the west, so every shadow is long and points inland. */
export const LIGHT = {
  sun: { x: -0.74, y: -0.67 },
  shadowLength: 0.78,
  shadowAlpha: 0.36,
  warm: 'rgba(255, 170, 86, 0.085)',
  sky: ['#f6c073', '#ef9158', '#d8604f'],
};

/** The five named districts. Order matters: districtAt walks it and takes the first match. */
export const DISTRICTS = [
  {
    id: 'docks',
    name: 'The Docks',
    blip: '#7fe3d2',
    ground: '#5d5a52',
    walls: ['#8c8578', '#9d8f74', '#6f7b7c', '#a9a08b', '#7e8c86', '#b1724f'],
    roofs: ['#5c5f5c', '#6e6354', '#4f5a5c', '#7a5a46'],
    height: [18, 48],
    density: 0.72,
    props: ['crate', 'lamp', 'container'],
  },
  {
    id: 'refinery',
    name: 'The Refinery',
    blip: '#f2a65a',
    ground: '#625a4f',
    walls: ['#8e8275', '#a1917c', '#7d7365', '#b4a287'],
    roofs: ['#5a544b', '#6b5f50'],
    height: [24, 68],
    density: 0.68,
    props: ['tank', 'pipe', 'crate'],
  },
  {
    id: 'oldfort',
    name: 'Old Fort',
    blip: '#e8d6a8',
    ground: '#6b6354',
    walls: ['#cbb492', '#d8c3a0', '#b9a183', '#e3d2b0', '#b58b6d'],
    roofs: ['#8d6a52', '#a3684a', '#7d5f4a', '#6b7a62'],
    height: [26, 74],
    density: 0.82,
    props: ['palm', 'bench', 'lamp'],
  },
  {
    id: 'palmreach',
    name: 'Palm Reach',
    blip: '#ff9fc4',
    ground: '#6f6659',
    walls: ['#f3cdb4', '#f6d9c0', '#ffc2cb', '#bfe0da', '#fbe3bd', '#e9b6d0', '#a7d2c9'],
    roofs: ['#c88a74', '#d2a080', '#86b0aa', '#b56f7e'],
    height: [34, 112],
    density: 0.8,
    props: ['palm', 'bench', 'lamp', 'billboard'],
  },
  {
    id: 'midtown',
    name: 'Calder Midtown',
    blip: '#ffd98a',
    ground: '#5f584e',
    walls: ['#d9b89a', '#8fb0ad', '#c4705c', '#e8d49f', '#9a8fa8', '#7fa3a8', '#cf8a6a', '#b9c3b0'],
    roofs: ['#6e5a4a', '#7f6a58', '#55635f', '#8a5c4c', '#4f5a66'],
    height: [52, 196],
    density: 0.92,
    props: ['lamp', 'billboard', 'bench'],
  },
];

/** Where the gulf starts, before the shoreline wobble city.js adds. */
export const SHORE_Y = 2412;

/** Pedestrian walking, fleeing and dying. */
export const PED = {
  radius: 8,
  walk: 46,
  flee: 142,
  health: 34,
  panicRadius: 230,
  count: 170,
  nearCount: 46,
};

/** Traffic: how many cars drive the road graph, and how they behave in a lane. */
export const TRAFFIC = {
  count: 44,
  cruise: 146,
  gap: 86,
  brakeGap: 54,
  turnSlow: 0.46,
};

/** Wanted level 0-5: the heat each crime adds, and how heat cools once nobody can see you. */
export const WANTED = {
  thresholds: [0, 36, 92, 170, 280, 420],
  cool: 34,
  coolDelay: 6,
  hideCool: 110,
  sightRange: 760,
  crimes: {
    hotwire: 34,
    trespass: 14,
    punchPed: 26,
    gunshot: 44,
    killPed: 92,
    hitPed: 48,
    ramPolice: 56,
    killCop: 150,
  },
  maxCruisers: [0, 1, 2, 3, 4, 5],
  shootStars: 2,
  blockStars: 3,
};

/** Guns Riley can pick up, plus the fists he always has. */
export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', damage: PLAYER.punchDamage, rate: 0.34, melee: true, ammo: 0 },
  pistol: { id: 'pistol', name: 'Sable .38', damage: 26, rate: 0.26, spread: 0.035, speed: 1150, range: 620, kick: 3.1 },
  smg: { id: 'smg', name: 'Harbour SMG', damage: 17, rate: 0.085, spread: 0.075, speed: 1280, range: 540, kick: 2.2 },
};

/** Police gunfire, so cops are deadly but survivable. */
export const COP = {
  health: 58,
  damage: 9,
  rate: 0.72,
  range: 330,
  spread: 0.1,
  speed: 940,
  chaseSpeed: 206,
  leaveCarRange: 150,
};

/** localStorage key for the single save slot. */
export const SAVE_KEY = 'portsable.save.v2';

/** The money Riley starts with, owing Mae Calder far more. */
export const START_MONEY = 40;
