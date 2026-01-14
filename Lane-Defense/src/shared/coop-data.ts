export type SpellId = "lightning" | "acid" | "icy";

export interface SpellDefinition {
  id: SpellId;
  name: string;
  description: string;
  manaCost: number;
  radius: number;
  damage: number;
  duration?: number;
  slowMultiplier?: number;
}

export type ContractId =
  | "surge"
  | "gale"
  | "glass"
  | "thin-hull"
  | "escort"
  | "rapid"
  | "elite"
  | "storm"
  | "hollow"
  | "tight"
  | "brutal"
  | "overtime";

export interface ContractDefinition {
  id: ContractId;
  title: string;
  downside: {
    hpMult?: number;
    speedMult?: number;
    extraCreeps?: number;
  };
  success: {
    type: "no-leaks" | "fast-clear" | "no-sell" | "low-mana";
    value?: number;
  };
  reward: {
    mana: number;
  };
  description: string;
}

export const SPELLS: SpellDefinition[] = [
  {
    id: "lightning",
    name: "Lightning Strike",
    description: "Burst damage on a tight radius.",
    manaCost: 30,
    radius: 0.8,
    damage: 80,
  },
  {
    id: "acid",
    name: "Acid Rain",
    description: "Damage-over-time across a wider area.",
    manaCost: 45,
    radius: 1.6,
    damage: 12,
    duration: 3.5,
  },
  {
    id: "icy",
    name: "Icy Winds",
    description: "Short slow field with light damage.",
    manaCost: 35,
    radius: 1.4,
    damage: 6,
    duration: 2.5,
    slowMultiplier: 0.55,
  },
];

export const CONTRACTS: ContractDefinition[] = [
  {
    id: "surge",
    title: "Power Surge",
    downside: { hpMult: 1.15 },
    success: { type: "no-leaks" },
    reward: { mana: 20 },
    description: "+15% enemy HP. Reward if no leaks.",
  },
  {
    id: "gale",
    title: "Gale Winds",
    downside: { speedMult: 1.15 },
    success: { type: "fast-clear", value: 18 },
    reward: { mana: 25 },
    description: "+15% enemy speed. Clear within 18s.",
  },
  {
    id: "glass",
    title: "Glass Fleet",
    downside: { hpMult: 1.25 },
    success: { type: "no-sell" },
    reward: { mana: 30 },
    description: "+25% enemy HP. No towers sold.",
  },
  {
    id: "thin-hull",
    title: "Thin Hulls",
    downside: { speedMult: 1.1, hpMult: 1.1 },
    success: { type: "fast-clear", value: 16 },
    reward: { mana: 22 },
    description: "+10% HP & speed. Clear in 16s.",
  },
  {
    id: "escort",
    title: "Escort Line",
    downside: { extraCreeps: 3 },
    success: { type: "no-leaks" },
    reward: { mana: 18 },
    description: "+3 extra creeps. No leaks.",
  },
  {
    id: "rapid",
    title: "Rapid Current",
    downside: { speedMult: 1.2 },
    success: { type: "low-mana", value: 40 },
    reward: { mana: 30 },
    description: "+20% speed. End wave with 40+ mana.",
  },
  {
    id: "elite",
    title: "Elite Row",
    downside: { hpMult: 1.2, extraCreeps: 2 },
    success: { type: "no-leaks" },
    reward: { mana: 26 },
    description: "+20% HP and +2 creeps. No leaks.",
  },
  {
    id: "storm",
    title: "Storm Front",
    downside: { speedMult: 1.1, extraCreeps: 4 },
    success: { type: "no-sell" },
    reward: { mana: 28 },
    description: "+10% speed, +4 creeps. No sells.",
  },
  {
    id: "hollow",
    title: "Hollow Run",
    downside: { hpMult: 1.18 },
    success: { type: "low-mana", value: 30 },
    reward: { mana: 24 },
    description: "+18% HP. End with 30+ mana.",
  },
  {
    id: "tight",
    title: "Tight Window",
    downside: { speedMult: 1.12 },
    success: { type: "fast-clear", value: 20 },
    reward: { mana: 20 },
    description: "+12% speed. Clear in 20s.",
  },
  {
    id: "brutal",
    title: "Brutal Tide",
    downside: { hpMult: 1.3 },
    success: { type: "no-leaks" },
    reward: { mana: 35 },
    description: "+30% HP. No leaks.",
  },
  {
    id: "overtime",
    title: "Overtime",
    downside: { extraCreeps: 5 },
    success: { type: "fast-clear", value: 22 },
    reward: { mana: 32 },
    description: "+5 creeps. Clear in 22s.",
  },
];
