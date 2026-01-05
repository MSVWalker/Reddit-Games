export type TargetMode = "first" | "last" | "strong" | "weak";
export type TargetPriority = "ground" | "air" | "any";
export type DamageType = "physical" | "arcane" | "siege";

export interface GameConfig {
  startGold: number;
  startLives: number;
  baseHpMult: number;
  baseSpeedMult: number;
  waveHpScale: number;
  waveSpeedScale: number;
  sellRefund: number;
}

export interface TowerTier {
  cost: number;
  damage: number;
  range: number;
  rate: number;
  splashRadius?: number;
  slow?: {
    multiplier: number;
    duration: number;
  };
}

export interface TowerDefinition {
  id: string;
  name: string;
  description: string;
  color: string;
  canHitGround: boolean;
  canHitAir: boolean;
  targetPriority: TargetPriority;
  damageType: DamageType;
  tiers: TowerTier[];
}

export interface BankDefinition {
  id: "bank";
  name: string;
  cost: number;
  income: number;
  color: string;
}

export interface CreepDefinition {
  id: string;
  name: string;
  baseHp: number;
  baseSpeed: number;
  armor: number;
  resist: Partial<Record<DamageType, number>>;
  bounty: number;
  leakDamage: number;
  isFlying: boolean;
  isBoss?: boolean;
  slowImmune?: boolean;
}

export interface WaveGroup {
  creepId: string;
  count: number;
}

export interface WaveDefinition {
  wave: number;
  groups: WaveGroup[];
  spawnInterval: number;
  isBossWave?: boolean;
}

export const GRID_WIDTH = 8;
export const GRID_HEIGHT = 15;
export const PATH_THICKNESS = 1;
export const MAX_WAVES = 10;

export const TARGET_MODES: TargetMode[] = ["first", "last", "strong", "weak"];

export const GAME_CONFIG: GameConfig = {
  startGold: 640,
  startLives: 20,
  baseHpMult: 1.0,
  baseSpeedMult: 1.0,
  waveHpScale: 0.22,
  waveSpeedScale: 0.05,
  sellRefund: 0.65,
};

export const BANK_DEFINITION: BankDefinition = {
  id: "bank",
  name: "Bank",
  cost: 100,
  income: 50,
  color: "#d6b869",
};

export const TOWER_DEFS: TowerDefinition[] = [
  {
    id: "basic",
    name: "Arrow Turret",
    description: "Reliable bolts with steady reach.",
    color: "#c9a86a",
    canHitGround: true,
    canHitAir: false,
    targetPriority: "ground",
    damageType: "physical",
    tiers: [
      { cost: 70, damage: 12, range: 3.2, rate: 1.0 },
      { cost: 110, damage: 18, range: 3.4, rate: 1.1 },
      { cost: 170, damage: 26, range: 3.6, rate: 1.2 },
      { cost: 250, damage: 38, range: 3.8, rate: 1.3 },
      { cost: 360, damage: 55, range: 4.0, rate: 1.4 },
    ],
  },
  {
    id: "splash",
    name: "Flame Thrower",
    description: "Scorches decks with sweeping fire.",
    color: "#d56a3c",
    canHitGround: true,
    canHitAir: false,
    targetPriority: "ground",
    damageType: "siege",
    tiers: [
      { cost: 120, damage: 18, range: 3.0, rate: 0.75, splashRadius: 1.2 },
      { cost: 180, damage: 26, range: 3.1, rate: 0.8, splashRadius: 1.3 },
      { cost: 260, damage: 38, range: 3.2, rate: 0.85, splashRadius: 1.4 },
      { cost: 360, damage: 55, range: 3.3, rate: 0.9, splashRadius: 1.5 },
      { cost: 500, damage: 78, range: 3.5, rate: 0.95, splashRadius: 1.6 },
    ],
  },
  {
    id: "slow",
    name: "Frost Spire",
    description: "Ice bolts slow enemy ships.",
    color: "#6fb4f2",
    canHitGround: true,
    canHitAir: false,
    targetPriority: "ground",
    damageType: "arcane",
    tiers: [
      { cost: 90, damage: 6, range: 3.0, rate: 1.2, slow: { multiplier: 0.75, duration: 1.6 } },
      { cost: 140, damage: 9, range: 3.1, rate: 1.25, slow: { multiplier: 0.7, duration: 1.7 } },
      { cost: 210, damage: 13, range: 3.2, rate: 1.3, slow: { multiplier: 0.65, duration: 1.8 } },
      { cost: 300, damage: 18, range: 3.3, rate: 1.35, slow: { multiplier: 0.6, duration: 2.0 } },
      { cost: 420, damage: 26, range: 3.5, rate: 1.45, slow: { multiplier: 0.55, duration: 2.2 } },
    ],
  },
  {
    id: "long",
    name: "Ballista",
    description: "Long-range bolts pierce hulls.",
    color: "#b9c7a6",
    canHitGround: true,
    canHitAir: true,
    targetPriority: "air",
    damageType: "physical",
    tiers: [
      { cost: 140, damage: 24, range: 5.2, rate: 0.6 },
      { cost: 210, damage: 34, range: 5.5, rate: 0.65 },
      { cost: 300, damage: 48, range: 5.8, rate: 0.7 },
      { cost: 420, damage: 68, range: 6.1, rate: 0.75 },
      { cost: 590, damage: 95, range: 6.4, rate: 0.8 },
    ],
  },
  {
    id: "rapid",
    name: "Triple Arrows",
    description: "Rapid triple-arrow volleys.",
    color: "#d1b07e",
    canHitGround: true,
    canHitAir: true,
    targetPriority: "ground",
    damageType: "physical",
    tiers: [
      { cost: 75, damage: 5, range: 2.8, rate: 3.0 },
      { cost: 120, damage: 7, range: 2.9, rate: 3.3 },
      { cost: 180, damage: 10, range: 3.0, rate: 3.6 },
      { cost: 260, damage: 14, range: 3.1, rate: 3.9 },
      { cost: 370, damage: 20, range: 3.2, rate: 4.2 },
    ],
  },
];

export const CREEP_DEFS: Record<string, CreepDefinition> = {
  grunt: {
    id: "grunt",
    name: "Sloop",
    baseHp: 90,
    baseSpeed: 1.0,
    armor: 0.05,
    resist: { arcane: 0.95 },
    bounty: 12,
    leakDamage: 1,
    isFlying: false,
  },
  sprinter: {
    id: "sprinter",
    name: "Skiff",
    baseHp: 60,
    baseSpeed: 1.35,
    armor: 0,
    resist: { siege: 0.9 },
    bounty: 10,
    leakDamage: 1,
    isFlying: false,
  },
  tank: {
    id: "tank",
    name: "Galleon",
    baseHp: 190,
    baseSpeed: 0.75,
    armor: 0.2,
    resist: { physical: 0.9 },
    bounty: 20,
    leakDamage: 2,
    isFlying: false,
  },
  mystic: {
    id: "mystic",
    name: "Mist Frigate",
    baseHp: 110,
    baseSpeed: 0.95,
    armor: 0.05,
    resist: { arcane: 0.7 },
    bounty: 16,
    leakDamage: 1,
    isFlying: false,
  },
  boss: {
    id: "boss",
    name: "Dreadnought",
    baseHp: 680,
    baseSpeed: 0.55,
    armor: 0.25,
    resist: { physical: 0.85, arcane: 0.85, siege: 0.9 },
    bounty: 140,
    leakDamage: 6,
    isFlying: false,
    isBoss: true,
    slowImmune: true,
  },
};

export const WAVES: WaveDefinition[] = [
  { wave: 1, groups: [{ creepId: "grunt", count: 12 }], spawnInterval: 0.8 },
  { wave: 2, groups: [
      { creepId: "grunt", count: 10 },
      { creepId: "sprinter", count: 6 },
    ],
    spawnInterval: 0.75,
  },
  { wave: 3, groups: [
      { creepId: "grunt", count: 10 },
      { creepId: "mystic", count: 6 },
    ],
    spawnInterval: 0.7,
  },
  { wave: 4, groups: [
      { creepId: "tank", count: 6 },
      { creepId: "grunt", count: 8 },
    ],
    spawnInterval: 0.75,
  },
  { wave: 5, groups: [
      { creepId: "boss", count: 1 },
      { creepId: "grunt", count: 6 },
    ],
    spawnInterval: 1.0,
    isBossWave: true,
  },
  { wave: 6, groups: [
      { creepId: "sprinter", count: 12 },
      { creepId: "mystic", count: 4 },
    ],
    spawnInterval: 0.6,
  },
  { wave: 7, groups: [
      { creepId: "tank", count: 6 },
      { creepId: "mystic", count: 8 },
    ],
    spawnInterval: 0.65,
  },
  { wave: 8, groups: [
      { creepId: "grunt", count: 12 },
      { creepId: "tank", count: 4 },
    ],
    spawnInterval: 0.6,
  },
  { wave: 9, groups: [
      { creepId: "sprinter", count: 10 },
      { creepId: "tank", count: 6 },
    ],
    spawnInterval: 0.55,
  },
  { wave: 10, groups: [
      { creepId: "boss", count: 1 },
      { creepId: "tank", count: 6 },
      { creepId: "mystic", count: 6 },
    ],
    spawnInterval: 0.7,
    isBossWave: true,
  },
];
