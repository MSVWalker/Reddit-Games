export interface RngState {
  seed: number;
}

export const seedFromString = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const nextRng = (state: RngState): number => {
  let t = (state.seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  state.seed = state.seed >>> 0;
  return result;
};

export const nextInt = (state: RngState, min: number, max: number): number => {
  const value = nextRng(state);
  return Math.floor(min + value * (max - min + 1));
};
