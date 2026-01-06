import "./game.css";
import * as THREE from "three";
import {
  CREEP_DEFS,
  BANK_DEFINITION,
  GAME_CONFIG,
  GRID_HEIGHT,
  GRID_WIDTH,
  MAX_WAVES,
  TARGET_MODES,
  TOWER_DEFS,
  WAVES,
  type TargetMode,
  type TowerDefinition,
  type DamageType,
} from "../../shared/game-data";
import { nextRng, type RngState } from "../../shared/rng";
import type { DailyResponse, SubmitScoreRequest, SubmitScoreResponse } from "../../shared/types/api";

type Phase = "prep" | "wave" | "victory" | "defeat";

type BuildSelection =
  | { kind: "tower"; towerId: string }
  | { kind: "bank" }
  | { kind: "none" };

interface Point {
  x: number;
  y: number;
}

interface Cell {
  terrain: "cliff" | "ground";
  buildable: boolean;
}

interface BaseMap {
  width: number;
  height: number;
  spawn: Point;
  exit: Point;
  cells: Cell[];
}

interface TowerInstance {
  id: number;
  kind: "tower";
  towerId: string;
  tier: number;
  cooldown: number;
  recoil: number;
  targetMode: TargetMode;
  x: number;
  y: number;
  spent: number;
  roundDamage: number;
  lastRoundDamage: number;
}

interface BankInstance {
  id: number;
  kind: "bank";
  x: number;
  y: number;
  spent: number;
}

type Structure = TowerInstance | BankInstance;

interface CreepInstance {
  id: number;
  typeId: string;
  hp: number;
  maxHp: number;
  speed: number;
  x: number;
  y: number;
  isFlying: boolean;
  slowMultiplier: number;
  slowTimer: number;
  airDistance: number;
  variant: number;
}

interface Shot {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ttl: number;
  ttlMax: number;
  color: string;
  towerId: string;
}

interface TexturePack {
  ground: THREE.CanvasTexture;
  lane: THREE.CanvasTexture;
  foam: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  stoneDark: THREE.CanvasTexture;
  metal: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  cloth: THREE.CanvasTexture;
}

interface MaterialPack {
  ground: THREE.MeshStandardMaterial;
  lane: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  cloth: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
}

interface VisualPack {
  textures: TexturePack;
  materials: MaterialPack;
}

interface GameState {
  seed: number;
  rng: RngState;
  phase: Phase;
  phaseTimer: number;
  tick: number;
  gold: number;
  lives: number;
  wave: number;
  spawnQueue: string[];
  spawnIndex: number;
  spawnCooldown: number;
  creeps: CreepInstance[];
  structures: Structure[];
  shots: Shot[];
  nextId: number;
  scoreSubmitted: boolean;
  scoreSubmitting: boolean;
}

interface View3D {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  width: number;
  height: number;
  cameraTarget: THREE.Vector3;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  baseDistance: number;
  mapGroup: THREE.Group;
  structureGroup: THREE.Group;
  creepGroup: THREE.Group;
  shotGroup: THREE.Group;
  selectionRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshStandardMaterial>;
  selectionOutline: THREE.LineSegments;
  rangeRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  structureMeshes: Map<number, THREE.Object3D>;
  creepMeshes: Map<number, THREE.Object3D>;
  shotMeshes: THREE.Object3D[];
  groundPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  spawnMarker: THREE.Object3D;
  exitMarker: THREE.Object3D;
  visuals: VisualPack;
}

interface Runtime {
  baseMap: BaseMap;
  distance: number[];
  pathLength: number;
  structureByCell: Map<number, Structure>;
  airPath: {
    points: Point[];
    lengths: number[];
    total: number;
  };
  view: View3D;
}

const TICK_RATE = 0.1;
const MAX_SHOT_TTL = 0.32;
const PREP_DURATION = 20;

const buildTowerById = Object.fromEntries(TOWER_DEFS.map((tower) => [tower.id, tower]));
let visualPack: VisualPack | null = null;

const getTower = (id: string): TowerDefinition => {
  return buildTowerById[id];
};

const DAMAGE_MULTIPLIERS = [1, 1.4, 2.1, 2.5, 3.0];

const getScaledDamage = (towerDef: TowerDefinition, tierIndex: number) => {
  const base = towerDef.tiers[0].damage;
  const multiplier = DAMAGE_MULTIPLIERS[Math.min(tierIndex, DAMAGE_MULTIPLIERS.length - 1)];
  return Math.round(base * multiplier);
};

const getScaledRange = (towerDef: TowerDefinition, tierIndex: number) => {
  const base = towerDef.tiers[0].range;
  return Number((base * Math.pow(1.1, tierIndex)).toFixed(2));
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const tileIndex = (x: number, y: number, width: number) => y * width + x;

const getShotTtl = (towerId: string) => {
  switch (towerId) {
    case "splash":
      return 0.28;
    case "rapid":
      return 0.22;
    case "cannon":
      return 0.4;
    case "long":
      return 0.42;
    case "slow":
      return 0.3;
    case "basic":
    default:
      return MAX_SHOT_TTL;
  }
};

const createBaseMap = (): BaseMap => {
  const cells: Cell[] = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => ({
    terrain: "ground",
    buildable: true,
  }));

  const laneX = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor((GRID_WIDTH - 1) / 2)));
  const spawn = { x: laneX, y: 0 };
  const exit = { x: laneX, y: GRID_HEIGHT - 1 };

  const spawnIndex = tileIndex(spawn.x, spawn.y, GRID_WIDTH);
  const exitIndex = tileIndex(exit.x, exit.y, GRID_WIDTH);
  cells[spawnIndex].buildable = false;
  cells[exitIndex].buildable = false;

  return {
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
    spawn,
    exit,
    cells,
  };
};

const computeDistances = (baseMap: BaseMap, structures: Map<number, Structure>): number[] => {
  const { width, height, cells, exit } = baseMap;
  const dist = Array.from({ length: width * height }, () => Number.POSITIVE_INFINITY);

  const isBlocked = (index: number) => {
    if (structures.has(index)) return true;
    return cells[index].terrain === "cliff";
  };

  const exitIndex = tileIndex(exit.x, exit.y, width);
  if (isBlocked(exitIndex)) {
    return dist;
  }

  const queue: number[] = [exitIndex];
  dist[exitIndex] = 0;
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const cx = current % width;
    const cy = Math.floor(current / width);
    const next = dist[current] + 1;

    const neighbors = [
      { x: cx + 1, y: cy },
      { x: cx - 1, y: cy },
      { x: cx, y: cy + 1 },
      { x: cx, y: cy - 1 },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= width || neighbor.y >= height) {
        continue;
      }
      const index = tileIndex(neighbor.x, neighbor.y, width);
      if (isBlocked(index)) continue;
      if (next < dist[index]) {
        dist[index] = next;
        queue.push(index);
      }
    }
  }

  return dist;
};

const buildAirPath = (baseMap: BaseMap) => {
  const spawn = { x: baseMap.spawn.x + 0.5, y: baseMap.spawn.y + 0.5 };
  const exit = { x: baseMap.exit.x + 0.5, y: baseMap.exit.y + 0.5 };
  const mid = {
    x: (spawn.x + exit.x) / 2,
    y: Math.max(0.5, (spawn.y + exit.y) / 2 - 3),
  };

  const points = [spawn, mid, exit];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const length = Math.hypot(dx, dy);
    lengths.push(length);
    total += length;
  }

  return { points, lengths, total };
};

const getPointAlongPath = (path: Runtime["airPath"], distance: number): Point => {
  let remaining = distance;
  for (let i = 0; i < path.lengths.length; i += 1) {
    const segmentLength = path.lengths[i];
    if (remaining <= segmentLength) {
      const start = path.points[i];
      const end = path.points[i + 1];
      const t = segmentLength === 0 ? 0 : remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
    }
    remaining -= segmentLength;
  }
  return path.points[path.points.length - 1];
};

const makeInitialState = (seed: number): GameState => {
  return {
    seed,
    rng: { seed },
    phase: "prep",
    phaseTimer: PREP_DURATION,
    tick: 0,
    gold: GAME_CONFIG.startGold,
    lives: GAME_CONFIG.startLives,
    wave: 1,
    spawnQueue: [],
    spawnIndex: 0,
    spawnCooldown: 0,
    creeps: [],
    structures: [],
    shots: [],
    nextId: 1,
    scoreSubmitted: false,
    scoreSubmitting: false,
  };
};

const buildSpawnQueue = (state: GameState) => {
  const waveDef = WAVES[state.wave - 1];
  const queue: string[] = [];
  for (const group of waveDef.groups) {
    for (let i = 0; i < group.count; i += 1) {
      queue.push(group.creepId);
    }
  }

  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRng(state.rng) * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  state.spawnQueue = queue;
  state.spawnIndex = 0;
  state.spawnCooldown = 0;
};

const createRuntime = (canvas: HTMLCanvasElement): Runtime => {
  const baseMap = createBaseMap();
  const structureByCell = new Map<number, Structure>();
  const distance = computeDistances(baseMap, structureByCell);
  const spawnIndex = tileIndex(baseMap.spawn.x, baseMap.spawn.y, baseMap.width);
  const pathLength = distance[spawnIndex];

  const visuals = getVisualPack();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.useLegacyLights = false;

  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.Fog(0x3b6f9b, 24, 90);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
  const cameraTarget = new THREE.Vector3(baseMap.width / 2, 0, baseMap.height / 2);
  camera.position.set(baseMap.width / 2, 12, baseMap.height * 1.2);
  camera.lookAt(cameraTarget);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const mapGroup = new THREE.Group();
  const structureGroup = new THREE.Group();
  const creepGroup = new THREE.Group();
  const shotGroup = new THREE.Group();

  scene.add(mapGroup, structureGroup, creepGroup, shotGroup);

  const ambient = new THREE.AmbientLight(0x5a8fc0, 0.92);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xe5f6ff, 0x23445f, 1.1);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff1d4, 1.45);
  sun.position.set(10, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 40;
  const shadowSize = Math.max(baseMap.width, baseMap.height);
  sun.shadow.camera.left = -shadowSize;
  sun.shadow.camera.right = shadowSize;
  sun.shadow.camera.top = shadowSize;
  sun.shadow.camera.bottom = -shadowSize;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xb7d8f5, 0.85);
  fill.position.set(-6, 8, -10);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xbde0ff, 0.7);
  rim.position.set(0, 6, 16);
  scene.add(rim);

  const groundPlane = createTerrainMesh(baseMap, visuals);
  mapGroup.add(groundPlane);

  const foamMesh = createFoamMesh(baseMap, visuals);
  mapGroup.add(foamMesh);

  const gridLines = createGridLines(baseMap.width, baseMap.height);
  mapGroup.add(gridLines);

  const spawnMarker = createSpawnMarker(visuals);
  spawnMarker.position.set(baseMap.spawn.x + 0.5, 0.2, baseMap.spawn.y + 0.5);
  mapGroup.add(spawnMarker);

  const exitMarker = createExitMarker(visuals);
  exitMarker.position.set(baseMap.exit.x + 0.5, 0.2, baseMap.exit.y + 0.5);
  mapGroup.add(exitMarker);

  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.48, 48),
    new THREE.MeshStandardMaterial({
      color: 0xf6d39c,
      emissive: new THREE.Color(0xd9a65a),
      emissiveIntensity: 0.8,
      roughness: 0.35,
      metalness: 0.25,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    })
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.visible = false;
  mapGroup.add(selectionRing);

  const outlineGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.02, 1.02));
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
  });
  outlineMaterial.depthTest = false;
  outlineMaterial.depthWrite = false;
  const selectionOutline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
  selectionOutline.rotation.x = -Math.PI / 2;
  selectionOutline.position.y = 0.06;
  selectionOutline.visible = false;
  selectionOutline.renderOrder = 4;
  mapGroup.add(selectionOutline);

  const rangeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.98, 1.02, 64),
    new THREE.MeshBasicMaterial({
      color: 0x9fd0ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  rangeRing.rotation.x = -Math.PI / 2;
  rangeRing.visible = false;
  mapGroup.add(rangeRing);

  return {
    baseMap,
    distance,
    pathLength,
    structureByCell,
    airPath: buildAirPath(baseMap),
    view: {
      canvas,
      renderer,
      scene,
      camera,
      raycaster,
      pointer,
      width: 0,
      height: 0,
      cameraTarget,
      zoom: 1,
      minZoom: 0.7,
      maxZoom: 3.2,
      baseDistance: 1,
      mapGroup,
      structureGroup,
      creepGroup,
      shotGroup,
      selectionRing,
      selectionOutline,
      rangeRing,
      structureMeshes: new Map(),
      creepMeshes: new Map(),
      shotMeshes: [],
      groundPlane,
      spawnMarker,
      exitMarker,
      visuals,
    },
  };
};

const rebuildPath = (runtime: Runtime) => {
  runtime.distance = computeDistances(runtime.baseMap, runtime.structureByCell);
  const spawnIndex = tileIndex(runtime.baseMap.spawn.x, runtime.baseMap.spawn.y, runtime.baseMap.width);
  runtime.pathLength = runtime.distance[spawnIndex];
};

const createCreep = (state: GameState, typeId: string, runtime: Runtime): CreepInstance => {
  const def = CREEP_DEFS[typeId];
  const waveScale = 1 + (state.wave - 1) * GAME_CONFIG.waveHpScale;
  const speedScale = 1 + (state.wave - 1) * GAME_CONFIG.waveSpeedScale;

  return {
    id: state.nextId++,
    typeId,
    hp: def.baseHp * GAME_CONFIG.baseHpMult * waveScale,
    maxHp: def.baseHp * GAME_CONFIG.baseHpMult * waveScale,
    speed: def.baseSpeed * GAME_CONFIG.baseSpeedMult * speedScale,
    x: runtime.baseMap.spawn.x + 0.5,
    y: runtime.baseMap.spawn.y + 0.5,
    isFlying: def.isFlying,
    slowMultiplier: 1,
    slowTimer: 0,
    airDistance: 0,
    variant: state.wave,
  };
};

const applyDamage = (creep: CreepInstance, damage: number, damageType: DamageType) => {
  const def = CREEP_DEFS[creep.typeId];
  const resist = def.resist[damageType] ?? 1;
  const mitigated = damage * resist * (1 - def.armor);
  const applied = Math.max(1, mitigated);
  const actual = Math.min(creep.hp, applied);
  creep.hp -= applied;
  return actual;
};

const applySlow = (creep: CreepInstance, multiplier: number, duration: number) => {
  const def = CREEP_DEFS[creep.typeId];
  if (def.slowImmune) return;

  if (creep.slowTimer <= 0) {
    creep.slowMultiplier = multiplier;
    creep.slowTimer = duration;
    return;
  }

  creep.slowMultiplier = Math.min(creep.slowMultiplier, multiplier);
  creep.slowTimer = Math.max(creep.slowTimer, duration);
};

const getDistanceRemaining = (creep: CreepInstance, runtime: Runtime): number => {
  if (creep.isFlying) {
    return Math.max(0, runtime.airPath.total - creep.airDistance);
  }
  const cellX = clamp(Math.floor(creep.x), 0, runtime.baseMap.width - 1);
  const cellY = clamp(Math.floor(creep.y), 0, runtime.baseMap.height - 1);
  const index = tileIndex(cellX, cellY, runtime.baseMap.width);
  return runtime.distance[index];
};

const getTowerTargets = (tower: TowerInstance, state: GameState, runtime: Runtime): CreepInstance[] => {
  const def = getTower(tower.towerId);
  const range = getScaledRange(def, tower.tier);
  const rangeSq = range * range;

  const groundTargets: CreepInstance[] = [];
  const airTargets: CreepInstance[] = [];

  for (const creep of state.creeps) {
    if (creep.isFlying && !def.canHitAir) continue;
    if (!creep.isFlying && !def.canHitGround) continue;

    const dx = creep.x - (tower.x + 0.5);
    const dy = creep.y - (tower.y + 0.5);
    if (dx * dx + dy * dy <= rangeSq) {
      if (creep.isFlying) {
        airTargets.push(creep);
      } else {
        groundTargets.push(creep);
      }
    }
  }

  if (def.targetPriority == "air" && airTargets.length) return airTargets;
  if (def.targetPriority == "ground" && groundTargets.length) return groundTargets;
  if (def.targetPriority == "air" && groundTargets.length) return groundTargets;
  if (def.targetPriority == "ground" && airTargets.length) return airTargets;

  return [...groundTargets, ...airTargets];
};

const pickTarget = (tower: TowerInstance, candidates: CreepInstance[], state: GameState, runtime: Runtime) => {
  if (!candidates.length) return null;

  const metric = (creep: CreepInstance) => {
    switch (tower.targetMode) {
      case "strong":
        return creep.hp;
      case "weak":
        return -creep.hp;
      case "last":
        return getDistanceRemaining(creep, runtime);
      case "first":
      default:
        return -getDistanceRemaining(creep, runtime);
    }
  };

  let best = candidates[0];
  let bestValue = metric(best);

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const value = metric(candidate);
    if (value > bestValue) {
      bestValue = value;
      best = candidate;
    } else if (value == bestValue) {
      if (nextRng(state.rng) > 0.5) {
        best = candidate;
      }
    }
  }

  return best;
};

const fireTower = (tower: TowerInstance, state: GameState, runtime: Runtime) => {
  const def = getTower(tower.towerId);
  const tier = def.tiers[tower.tier];
  const scaledDamage = getScaledDamage(def, tower.tier);
  const candidates = getTowerTargets(tower, state, runtime);
  const target = pickTarget(tower, candidates, state, runtime);
  if (!target) return;
  let totalDamage = 0;

  if (tier.splashRadius) {
    const splashSq = tier.splashRadius * tier.splashRadius;
    for (const creep of candidates) {
      const dx = creep.x - target.x;
      const dy = creep.y - target.y;
      if (dx * dx + dy * dy <= splashSq) {
        totalDamage += applyDamage(creep, scaledDamage, def.damageType);
      }
    }
  } else {
    totalDamage += applyDamage(target, scaledDamage, def.damageType);
  }

  if (tier.slow) {
    if (tier.slowSplashRadius) {
      const slowSq = tier.slowSplashRadius * tier.slowSplashRadius;
      for (const creep of candidates) {
        const dx = creep.x - target.x;
        const dy = creep.y - target.y;
        if (dx * dx + dy * dy <= slowSq) {
          applySlow(creep, tier.slow.multiplier, tier.slow.duration);
        }
      }
    } else {
      applySlow(target, tier.slow.multiplier, tier.slow.duration);
    }
  }

  const ttlMax = getShotTtl(def.id);
  state.shots.push({
    x1: tower.x + 0.5,
    y1: tower.y + 0.5,
    x2: target.x,
    y2: target.y,
    ttl: ttlMax,
    ttlMax,
    color: def.color,
    towerId: def.id,
  });

  tower.roundDamage += totalDamage;
  tower.recoil = 1;
  tower.cooldown = 1 / tier.rate;
};

const updateTowers = (state: GameState, runtime: Runtime, dt: number) => {
  for (const structure of state.structures) {
    if (structure.kind != "tower") continue;
    const def = getTower(structure.towerId);
    if (!def.canHitGround && !def.canHitAir) continue;
    structure.recoil = Math.max(0, structure.recoil - dt * 6);
    structure.cooldown = Math.max(0, structure.cooldown - dt);
    if (structure.cooldown <= 0) {
      fireTower(structure, state, runtime);
    }
  }
};

const updateCreeps = (state: GameState, runtime: Runtime, dt: number) => {
  const { baseMap } = runtime;
  const exit = baseMap.exit;
  const alive: CreepInstance[] = [];

  for (const creep of state.creeps) {
    if (creep.slowTimer > 0) {
      creep.slowTimer = Math.max(0, creep.slowTimer - dt);
      if (creep.slowTimer == 0) {
        creep.slowMultiplier = 1;
      }
    }

    const moveSpeed = creep.speed * creep.slowMultiplier;

    if (creep.isFlying) {
      creep.airDistance += moveSpeed * dt;
      const position = getPointAlongPath(runtime.airPath, creep.airDistance);
      creep.x = position.x;
      creep.y = position.y;
      if (creep.airDistance >= runtime.airPath.total) {
        state.lives -= CREEP_DEFS[creep.typeId].leakDamage;
        continue;
      }
      alive.push(creep);
      continue;
    }

    const cellX = clamp(Math.floor(creep.x), 0, baseMap.width - 1);
    const cellY = clamp(Math.floor(creep.y), 0, baseMap.height - 1);
    const currentIndex = tileIndex(cellX, cellY, baseMap.width);

    if (cellX == exit.x && cellY == exit.y) {
      state.lives -= CREEP_DEFS[creep.typeId].leakDamage;
      continue;
    }

    const neighbors = [
      { x: cellX + 1, y: cellY },
      { x: cellX - 1, y: cellY },
      { x: cellX, y: cellY + 1 },
      { x: cellX, y: cellY - 1 },
    ].filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < baseMap.width && cell.y < baseMap.height);

    let best = { x: cellX, y: cellY, dist: runtime.distance[currentIndex] };
    for (const neighbor of neighbors) {
      const index = tileIndex(neighbor.x, neighbor.y, baseMap.width);
      const dist = runtime.distance[index];
      if (dist < best.dist) {
        best = { x: neighbor.x, y: neighbor.y, dist };
      }
    }

    if (!Number.isFinite(best.dist)) {
      alive.push(creep);
      continue;
    }

    const targetX = best.x + 0.5;
    const targetY = best.y + 0.5;
    const dx = targetX - creep.x;
    const dy = targetY - creep.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.01) {
      creep.x = targetX;
      creep.y = targetY;
    } else {
      const step = Math.min(distance, moveSpeed * dt);
      creep.x += (dx / distance) * step;
      creep.y += (dy / distance) * step;
    }

    alive.push(creep);
  }

  state.creeps = alive;
};

const cleanupCreeps = (state: GameState) => {
  const survivors: CreepInstance[] = [];
  for (const creep of state.creeps) {
    if (creep.hp <= 0) {
      state.gold += Math.round(CREEP_DEFS[creep.typeId].bounty);
      continue;
    }
    survivors.push(creep);
  }
  state.creeps = survivors;
};

const updateShots = (state: GameState, dt: number) => {
  const nextShots: Shot[] = [];
  for (const shot of state.shots) {
    shot.ttl -= dt;
    if (shot.ttl > 0) {
      nextShots.push(shot);
    }
  }
  state.shots = nextShots;
};

const canPlaceStructure = (runtime: Runtime, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= runtime.baseMap.width || y >= runtime.baseMap.height) return false;
  const index = tileIndex(x, y, runtime.baseMap.width);
  if (runtime.structureByCell.has(index)) return false;
  const cell = runtime.baseMap.cells[index];
  if (!cell.buildable) return false;

  runtime.structureByCell.set(index, {
    id: -1,
    kind: "tower",
    x,
    y,
    spent: 0,
  });
  const dist = computeDistances(runtime.baseMap, runtime.structureByCell);
  runtime.structureByCell.delete(index);
  const spawnIndex = tileIndex(runtime.baseMap.spawn.x, runtime.baseMap.spawn.y, runtime.baseMap.width);
  return Number.isFinite(dist[spawnIndex]);
};

const addStructure = (state: GameState, runtime: Runtime, structure: Structure) => {
  const index = tileIndex(structure.x, structure.y, runtime.baseMap.width);
  state.structures.push(structure);
  runtime.structureByCell.set(index, structure);
  rebuildPath(runtime);
};

const removeStructure = (state: GameState, runtime: Runtime, structure: Structure) => {
  const index = tileIndex(structure.x, structure.y, runtime.baseMap.width);
  runtime.structureByCell.delete(index);
  state.structures = state.structures.filter((item) => item.id != structure.id);
  rebuildPath(runtime);
};

const getStructureAt = (runtime: Runtime, x: number, y: number): Structure | null => {
  const index = tileIndex(x, y, runtime.baseMap.width);
  return runtime.structureByCell.get(index) ?? null;
};

const getSellValue = (state: GameState, structure: Structure) => {
  const refund = GAME_CONFIG.sellRefund;
  return Math.max(1, Math.floor(structure.spent * refund));
};

const applyBankIncome = (state: GameState) => {
  let total = 0;
  for (const structure of state.structures) {
    if (structure.kind != "bank") continue;
    total += BANK_DEFINITION.income;
  }
  if (total > 0) {
    state.gold += total;
  }
};

const applyEndOfWaveInterest = (state: GameState) => {
  state.gold = Math.floor(state.gold * 1.2);
};

const finalizeRoundDamage = (state: GameState) => {
  for (const structure of state.structures) {
    if (structure.kind != "tower") continue;
    structure.lastRoundDamage = Math.round(structure.roundDamage);
    structure.roundDamage = 0;
  }
};

const updateWaveState = (state: GameState, runtime: Runtime, dt: number) => {
  if (state.spawnIndex < state.spawnQueue.length) {
    state.spawnCooldown -= dt;
    if (state.spawnCooldown <= 0) {
      const creepId = state.spawnQueue[state.spawnIndex];
      state.spawnIndex += 1;
      state.spawnCooldown = WAVES[state.wave - 1].spawnInterval;
      state.creeps.push(createCreep(state, creepId, runtime));
    }
  }

  updateCreeps(state, runtime, dt);
  updateTowers(state, runtime, dt);
  cleanupCreeps(state);
  updateShots(state, dt);

  if (state.lives <= 0) {
    state.phase = "defeat";
    return;
  }

  const doneSpawning = state.spawnIndex >= state.spawnQueue.length;
  if (doneSpawning && state.creeps.length == 0) {
    finalizeRoundDamage(state);
    if (state.wave >= MAX_WAVES) {
      state.phase = "victory";
      state.shots = [];
      return;
    }
    applyBankIncome(state);
    applyEndOfWaveInterest(state);
    state.wave += 1;
    state.phase = "prep";
    state.phaseTimer = PREP_DURATION;
    state.shots = [];
  }
};

const calcScore = (state: GameState) => {
  const wavesCleared = state.phase == "victory" ? MAX_WAVES : state.wave - 1;
  return Math.max(0, wavesCleared) * 1000 + Math.max(0, state.lives) * 50 + state.gold;
};

const formatPathLength = (runtime: Runtime) => {
  if (!Number.isFinite(runtime.pathLength)) return "Blocked";
  return `${runtime.pathLength}`;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const shadeRgb = (rgb: [number, number, number], factor: number): [number, number, number] => {
  return [
    clamp(Math.round(rgb[0] * factor), 0, 255),
    clamp(Math.round(rgb[1] * factor), 0, 255),
    clamp(Math.round(rgb[2] * factor), 0, 255),
  ];
};

const rgba = (rgb: [number, number, number], alpha: number) => {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
};

const createNoiseTexture = (options: {
  size: number;
  baseColor: string;
  accentColor: string;
  seed: number;
  density?: number;
  stainCount?: number;
  crackCount?: number;
  stripes?: boolean;
}) => {
  const { size, baseColor, accentColor, seed, density = 0.08, stainCount = 24, crackCount = 18, stripes } =
    options;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  const rand = mulberry32(seed);
  const accent = hexToRgb(accentColor);
  const darkAccent = shadeRgb(accent, 0.55);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  const dotCount = Math.floor(size * size * density);
  for (let i = 0; i < dotCount; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const radius = 0.4 + rand() * 2.4;
    ctx.fillStyle = rgba(accent, 0.08 + rand() * 0.22);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < stainCount; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const radius = 6 + rand() * 22;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(accent, 0.12));
    gradient.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 1;
  for (let i = 0; i < crackCount; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const length = 18 + rand() * 60;
    const angle = rand() * Math.PI * 2;
    ctx.strokeStyle = rgba(darkAccent, 0.1 + rand() * 0.15);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  if (stripes) {
    ctx.lineWidth = 1;
    for (let y = 0; y < size; y += 6) {
      ctx.strokeStyle = rgba(darkAccent, 0.08);
      ctx.beginPath();
      ctx.moveTo(0, y + rand() * 2);
      ctx.lineTo(size, y + rand() * 2);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const createFoamTexture = (options: { size: number; seed: number }) => {
  const { size, seed } = options;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  ctx.clearRect(0, 0, size, size);
  const rand = mulberry32(seed);
  ctx.lineWidth = 1.2;

  for (let i = 0; i < 70; i += 1) {
    const y = rand() * size;
    const amplitude = 4 + rand() * 10;
    const frequency = 0.018 + rand() * 0.05;
    const phase = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(210, 240, 255, ${0.04 + rand() * 0.08})`;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 6) {
      const wave = Math.sin(x * frequency + phase) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, y + wave);
      } else {
        ctx.lineTo(x, y + wave);
      }
    }
    ctx.stroke();
  }

  for (let i = 0; i < 18; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const radius = 8 + rand() * 22;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};


const createVisualPack = (): VisualPack => {
  const textures: TexturePack = {
    ground: createNoiseTexture({
      size: 256,
      baseColor: "#276fa8",
      accentColor: "#6bc0e7",
      seed: 120,
      density: 0.06,
      stainCount: 12,
      crackCount: 0,
      stripes: true,
    }),
    lane: createNoiseTexture({
      size: 256,
      baseColor: "#2f7eb2",
      accentColor: "#7cc4e6",
      seed: 230,
      density: 0.06,
      stainCount: 10,
      crackCount: 0,
      stripes: true,
    }),
    foam: createFoamTexture({ size: 512, seed: 812 }),
    stone: createNoiseTexture({
      size: 256,
      baseColor: "#65707a",
      accentColor: "#87919a",
      seed: 340,
      density: 0.07,
      stainCount: 16,
      crackCount: 18,
    }),
    stoneDark: createNoiseTexture({
      size: 256,
      baseColor: "#46515c",
      accentColor: "#66717c",
      seed: 450,
      density: 0.06,
      stainCount: 14,
      crackCount: 14,
    }),
    metal: createNoiseTexture({
      size: 256,
      baseColor: "#707b86",
      accentColor: "#b2bbc2",
      seed: 560,
      density: 0.05,
      stainCount: 12,
      crackCount: 8,
      stripes: true,
    }),
    wood: createNoiseTexture({
      size: 256,
      baseColor: "#6b4a2a",
      accentColor: "#9b6a3a",
      seed: 670,
      density: 0.06,
      stainCount: 12,
      crackCount: 10,
      stripes: true,
    }),
    cloth: createNoiseTexture({
      size: 256,
      baseColor: "#3e4f72",
      accentColor: "#6780a8",
      seed: 780,
      density: 0.05,
      stainCount: 8,
      crackCount: 0,
    }),
  };

  textures.ground.repeat.set(4, 6);
  textures.lane.repeat.set(3, 5);
  textures.foam.repeat.set(4, 7);
  textures.stone.repeat.set(2, 2);
  textures.stoneDark.repeat.set(2, 2);
  textures.metal.repeat.set(3, 3);
  textures.wood.repeat.set(3, 3);
  textures.cloth.repeat.set(2, 2);

  const materials: MaterialPack = {
    ground: new THREE.MeshStandardMaterial({
      map: textures.ground,
      color: 0x2a74a9,
      roughness: 0.6,
      metalness: 0.12,
      emissive: new THREE.Color(0x1c4a73),
      emissiveIntensity: 0.32,
    }),
    lane: new THREE.MeshStandardMaterial({
      map: textures.lane,
      color: 0x2b6ea1,
      roughness: 0.63,
      metalness: 0.1,
      emissive: new THREE.Color(0x1c4570),
      emissiveIntensity: 0.35,
    }),
    stone: new THREE.MeshStandardMaterial({
      map: textures.stone,
      color: 0x7a8794,
      roughness: 0.8,
      metalness: 0.08,
    }),
    stoneDark: new THREE.MeshStandardMaterial({
      map: textures.stoneDark,
      color: 0x56616c,
      roughness: 0.85,
      metalness: 0.05,
    }),
    bronze: new THREE.MeshStandardMaterial({
      map: textures.metal,
      color: 0xcaa05a,
      roughness: 0.42,
      metalness: 0.75,
    }),
    iron: new THREE.MeshStandardMaterial({
      map: textures.metal,
      color: 0x98a4ae,
      roughness: 0.5,
      metalness: 0.6,
    }),
    wood: new THREE.MeshStandardMaterial({
      map: textures.wood,
      color: 0x6f4c2c,
      roughness: 0.88,
      metalness: 0.05,
    }),
    cloth: new THREE.MeshStandardMaterial({
      map: textures.cloth,
      color: 0x4a5d86,
      roughness: 0.72,
      metalness: 0.02,
    }),
    gold: new THREE.MeshStandardMaterial({
      map: textures.metal,
      color: 0xf2cf86,
      roughness: 0.3,
      metalness: 0.85,
      emissive: new THREE.Color(0x6b4c1f),
      emissiveIntensity: 0.32,
    }),
  };

  return { textures, materials };
};

const getVisualPack = (): VisualPack => {
  if (!visualPack) {
    visualPack = createVisualPack();
  }
  return visualPack;
};

const createTerrainMesh = (baseMap: BaseMap, visuals: VisualPack) => {
  const segmentsX = Math.max(24, baseMap.width * 6);
  const segmentsY = Math.max(36, baseMap.height * 6);
  const geometry = new THREE.PlaneGeometry(baseMap.width, baseMap.height, segmentsX, segmentsY);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i) + baseMap.width / 2;
    const y = position.getY(i) + baseMap.height / 2;
    const nx = x / baseMap.width;
    const ny = y / baseMap.height;
    const wave1 = Math.sin(nx * Math.PI * 2 * 2.1 + ny * 1.7) * 0.04;
    const wave2 = Math.cos(ny * Math.PI * 2 * 2.6 + nx * 1.3) * 0.03;
    const ripple = Math.sin(nx * 12 + ny * 9) * 0.008;
    const height = wave1 + wave2 + ripple;
    position.setZ(i, height);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, visuals.materials.ground);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(baseMap.width / 2, 0, baseMap.height / 2);
  mesh.receiveShadow = true;
  return mesh;
};

const createFoamMesh = (baseMap: BaseMap, visuals: VisualPack) => {
  const geometry = new THREE.PlaneGeometry(baseMap.width, baseMap.height, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: visuals.textures.foam,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(baseMap.width / 2, 0.06, baseMap.height / 2);
  mesh.renderOrder = 2;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
};

const updateEnvironment = (runtime: Runtime, timeSec: number) => {
  const { textures } = runtime.view.visuals;
  const driftX = (timeSec * 0.01) % 1;
  const driftY = (timeSec * 0.016) % 1;
  textures.ground.offset.set(driftX, driftY);
  textures.lane.offset.set((driftX + 0.2) % 1, (driftY + 0.1) % 1);
  textures.foam.offset.set((driftX * 1.4) % 1, (driftY * 1.6) % 1);

  const groundMaterial = runtime.view.groundPlane.material;
  if (groundMaterial instanceof THREE.MeshStandardMaterial) {
    groundMaterial.emissiveIntensity = 0.28 + Math.sin(timeSec * 0.8) * 0.05;
  }
};

const createGridLines = (width: number, height: number) => {
  const vertices: number[] = [];
  for (let x = 0; x <= width; x += 1) {
    vertices.push(x, 0.12, 0, x, 0.12, height);
  }
  for (let y = 0; y <= height; y += 1) {
    vertices.push(0, 0.12, y, width, 0.12, y);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0xd0f2ff,
    transparent: true,
    opacity: 0.38,
  });
  material.depthTest = true;
  material.depthWrite = false;

  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 1;
  lines.frustumCulled = false;
  return lines;
};

const createSpawnMarker = (visuals: VisualPack) => {
  const group = new THREE.Group();
  const buoyMat = new THREE.MeshStandardMaterial({
    color: 0x4fd68c,
    emissive: new THREE.Color(0x1f6a3b),
    emissiveIntensity: 0.6,
    roughness: 0.4,
    metalness: 0.2,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.28, 18), buoyMat);
  base.position.y = 0.12;
  group.add(base);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), buoyMat);
  cap.position.y = 0.28;
  group.add(cap);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 12, 24), visuals.materials.iron);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;
  group.add(ring);
  applyShadows(group);
  return group;
};

const createExitMarker = (visuals: VisualPack) => {
  const group = new THREE.Group();
  const buoyMat = new THREE.MeshStandardMaterial({
    color: 0xf05f5a,
    emissive: new THREE.Color(0x8a2a2a),
    emissiveIntensity: 0.6,
    roughness: 0.4,
    metalness: 0.2,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.28, 18), buoyMat);
  base.position.y = 0.12;
  group.add(base);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), buoyMat);
  cap.position.y = 0.28;
  group.add(cap);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 12, 24), visuals.materials.iron);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;
  group.add(ring);
  applyShadows(group);
  return group;
};

const getTowerAccent = (towerId: string) => {
  switch (towerId) {
    case "splash":
      return new THREE.Color(0xd34b3a);
    case "cannon":
      return new THREE.Color(0xa7a6a2);
    case "slow":
      return new THREE.Color(0x4e8dd6);
    case "long":
      return new THREE.Color(0x7a7f87);
    case "wall":
      return new THREE.Color(0x8a8f98);
    case "basic":
    default:
      return new THREE.Color(0x7a4d2b);
  }
};

const applyShadows = (root: THREE.Object3D) => {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

const createMuzzleFlash = (accent: THREE.Color, offsets: Array<{ x: number; y: number; z: number }>) => {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (const offset of offsets) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat);
    flash.position.set(offset.x, offset.y, offset.z);
    flash.castShadow = false;
    flash.receiveShadow = false;
    group.add(flash);

    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 8), mat);
    cone.position.set(offset.x, offset.y, offset.z + 0.08);
    cone.rotation.x = Math.PI / 2;
    cone.castShadow = false;
    cone.receiveShadow = false;
    group.add(cone);
  }

  group.visible = false;
  return group;
};

const setMuzzleIntensity = (muzzle: THREE.Object3D | undefined, intensity: number) => {
  if (!muzzle) return;
  muzzle.visible = intensity > 0.05;
  muzzle.scale.setScalar(0.75 + intensity * 0.7);
  muzzle.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
      child.material.opacity = 0.25 + intensity * 0.75;
    }
  });
};

const buildTowerMesh = (tower: TowerInstance) => {
  const { materials } = getVisualPack();
  const group = new THREE.Group();
  const accent = getTowerAccent(tower.towerId);
  const accentMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.5,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: accent.clone().lerp(new THREE.Color(0xffffff), 0.15),
    emissive: accent,
    emissiveIntensity: 0.2,
    roughness: 0.35,
    metalness: 0.6,
  });
  if (tower.towerId == "splash") {
    accentMat.emissiveIntensity = 0.9;
    accentMat.roughness = 0.18;
    accentMat.metalness = 0.65;
    trimMat.emissiveIntensity = 0.5;
  }
  if (tower.towerId == "slow") {
    accentMat.emissiveIntensity = 0.75;
    accentMat.roughness = 0.16;
    accentMat.metalness = 0.25;
    trimMat.emissiveIntensity = 0.35;
  }

  const raft = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.1, 0.92), materials.wood);
  raft.position.y = 0.05;
  group.add(raft);

  const floatRing = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.1, 18), materials.wood);
  floatRing.position.y = 0.12;
  group.add(floatRing);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), materials.stoneDark);
  deck.position.y = 0.17;
  group.add(deck);

  const trimRingMaterial = tower.towerId == "splash" ? accentMat : materials.bronze;
  const trimRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 12, 26), trimRingMaterial);
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.y = 0.19;
  group.add(trimRing);

  if (tower.towerId == "wall") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.28, 14), materials.stoneDark);
    base.position.y = 0.2;
    group.add(base);

    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), materials.stone);
    rock.position.y = 0.42;
    rock.rotation.set(0.2, 0.6, 0.1);
    group.add(rock);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.58), materials.stoneDark);
    slab.position.y = 0.58;
    slab.rotation.y = 0.25;
    group.add(slab);

    group.userData = { kind: "tower", towerId: tower.towerId, tier: tower.tier };
    applyShadows(group);
    return group;
  }

  const turret = new THREE.Group();
  turret.position.y = 0.46;
  const recoilGroup = new THREE.Group();
  turret.add(recoilGroup);
  group.add(turret);
  let muzzleOffsets: Array<{ x: number; y: number; z: number }> = [];
  let flameCore: THREE.Mesh | null = null;
  let flameShell: THREE.Mesh | null = null;
  let frostCore: THREE.Mesh | null = null;
  let frostHalo: THREE.Mesh | null = null;

  if (tower.towerId == "splash") {
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 14), accentMat);
    basePlate.position.y = 0.22;
    recoilGroup.add(basePlate);

    const tankLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.28, 12), trimMat);
    tankLeft.position.set(-0.18, 0.26, -0.04);
    recoilGroup.add(tankLeft);

    const tankRight = tankLeft.clone();
    tankRight.position.x = 0.18;
    recoilGroup.add(tankRight);

    const nozzleBase = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.2), accentMat);
    nozzleBase.position.set(0, 0.26, 0.12);
    recoilGroup.add(nozzleBase);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.38, 12), accentMat);
    nozzle.rotation.x = Math.PI / 2.4;
    nozzle.position.set(0, 0.28, 0.36);
    recoilGroup.add(nozzle);

    const nozzleTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 10), accentMat);
    nozzleTip.rotation.x = Math.PI / 2.2;
    nozzleTip.position.set(0, 0.28, 0.54);
    recoilGroup.add(nozzleTip);

    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), trimMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(0, 0.22, 0.05);
    recoilGroup.add(pipe);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff3b2f,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    flameCore = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), flameMat);
    flameCore.position.set(0, 0.42, 0.58);
    recoilGroup.add(flameCore);

    flameShell = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 12), flameMat);
    flameShell.position.set(0, 0.46, 0.64);
    flameShell.rotation.x = Math.PI;
    recoilGroup.add(flameShell);

    muzzleOffsets = [{ x: 0, y: 0.3, z: 0.64 }];
  } else if (tower.towerId == "cannon") {
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.4), materials.wood);
    carriage.position.set(0, 0.2, 0.02);
    recoilGroup.add(carriage);

    const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12);
    const wheelLeft = new THREE.Mesh(wheelGeo, materials.iron);
    wheelLeft.rotation.z = Math.PI / 2;
    wheelLeft.position.set(-0.16, 0.16, 0.12);
    recoilGroup.add(wheelLeft);
    const wheelRight = wheelLeft.clone();
    wheelRight.position.x = 0.16;
    recoilGroup.add(wheelRight);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.72, 14), materials.iron);
    barrel.rotation.x = Math.PI / 2.6;
    barrel.position.set(0, 0.3, 0.25);
    recoilGroup.add(barrel);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 10, 20), materials.bronze);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.36, 0.22);
    recoilGroup.add(ring);

    muzzleOffsets = [{ x: 0, y: 0.34, z: 0.68 }];
  } else if (tower.towerId == "slow") {
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.18, 14), materials.stone);
    basePlate.position.y = 0.24;
    recoilGroup.add(basePlate);

    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf2f7ff,
      emissive: new THREE.Color(0x9ed7ff),
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.05,
    });
    const snowCap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 12), snowMat);
    snowCap.position.y = 0.34;
    recoilGroup.add(snowCap);

    const snowPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.04, 12), snowMat);
    snowPlate.position.y = 0.22;
    recoilGroup.add(snowPlate);

    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 12), accentMat);
    nozzle.rotation.x = Math.PI / 2.3;
    nozzle.position.set(0, 0.36, 0.22);
    recoilGroup.add(nozzle);

    const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), accentMat);
    crystal.position.y = 0.62;
    recoilGroup.add(crystal);

    const spikeLeft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 8), accentMat);
    spikeLeft.position.set(-0.16, 0.44, 0.1);
    spikeLeft.rotation.x = Math.PI / 2.1;
    recoilGroup.add(spikeLeft);

    const spikeRight = spikeLeft.clone();
    spikeRight.position.x = 0.16;
    recoilGroup.add(spikeRight);

    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 12, 24), trimMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.5;
    recoilGroup.add(halo);

    const shardPositions = [
      { x: -0.18, y: 0.26, z: -0.12 },
      { x: 0.18, y: 0.26, z: -0.12 },
      { x: 0, y: 0.26, z: 0.18 },
    ];
    for (const pos of shardPositions) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 8), accentMat);
      shard.position.set(pos.x, pos.y, pos.z);
      shard.rotation.x = Math.PI / 2.2;
      recoilGroup.add(shard);
    }

    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x9fd7ff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    frostHalo = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 24), auraMat);
    frostHalo.rotation.x = -Math.PI / 2;
    frostHalo.position.y = 0.26;
    recoilGroup.add(frostHalo);

    frostCore = crystal;

    muzzleOffsets = [{ x: 0, y: 0.38, z: 0.48 }];
  } else if (tower.towerId == "long") {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.4), materials.stoneDark);
    frame.position.set(0, 0.22, -0.02);
    recoilGroup.add(frame);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.1), materials.iron);
    arm.position.set(0, 0.34, 0.14);
    recoilGroup.add(arm);

    const stringMat = new THREE.MeshBasicMaterial({
      color: 0xe6edf7,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6), stringMat);
    string.rotation.z = Math.PI / 2;
    string.position.set(0, 0.34, 0.14);
    recoilGroup.add(string);

    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.05, 8), materials.iron);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(0, 0.3, 0.2);
    recoilGroup.add(bolt);

    const boltTip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 10), materials.iron);
    boltTip.rotation.x = Math.PI / 2;
    boltTip.position.set(0, 0.3, 0.72);
    recoilGroup.add(boltTip);

    muzzleOffsets = [{ x: 0, y: 0.32, z: 0.8 }];
  } else if (tower.towerId == "rapid") {
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.14, 14), materials.bronze);
    basePlate.position.y = 0.22;
    recoilGroup.add(basePlate);

    const offsets = [-0.14, 0, 0.14];
    for (const offset of offsets) {
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.06), materials.iron);
      bow.position.set(offset, 0.3, 0.28);
      recoilGroup.add(bow);

      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), materials.iron);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(offset, 0.3, 0.1);
      recoilGroup.add(bolt);

      const boltTip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 8), materials.iron);
      boltTip.rotation.x = Math.PI / 2;
      boltTip.position.set(offset, 0.3, 0.32);
      recoilGroup.add(boltTip);
    }

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.18), materials.wood);
    guard.position.set(0, 0.22, 0);
    recoilGroup.add(guard);

    muzzleOffsets = [
      { x: -0.14, y: 0.3, z: 0.46 },
      { x: 0, y: 0.3, z: 0.46 },
      { x: 0.14, y: 0.3, z: 0.46 },
    ];
  } else {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.18, 16), materials.bronze);
    housing.position.y = 0.22;
    recoilGroup.add(housing);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.34), materials.wood);
    stock.position.set(0, 0.28, 0.06);
    recoilGroup.add(stock);

    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.1), materials.iron);
    bow.position.set(0, 0.28, 0.26);
    recoilGroup.add(bow);

    const stringMat = new THREE.MeshBasicMaterial({
      color: 0xe6edf7,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 6), stringMat);
    string.rotation.z = Math.PI / 2;
    string.position.set(0, 0.28, 0.26);
    recoilGroup.add(string);

    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), materials.iron);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(0, 0.32, 0.06);
    recoilGroup.add(bolt);

    const boltTip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 8), materials.iron);
    boltTip.rotation.x = Math.PI / 2;
    boltTip.position.set(0, 0.32, 0.32);
    recoilGroup.add(boltTip);

    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), accentMat);
    crest.position.set(0, 0.36, -0.16);
    crest.rotation.x = Math.PI / 2;
    recoilGroup.add(crest);

    muzzleOffsets = [{ x: 0, y: 0.32, z: 0.5 }];
  }

  const muzzle = createMuzzleFlash(accent, muzzleOffsets);
  recoilGroup.add(muzzle);

  const ringMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.3,
    roughness: 0.4,
    metalness: 0.45,
  });
  for (let i = 0; i < tower.tier + 1; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28 + i * 0.05, 0.028, 10, 28), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1 + i * 0.09;
    group.add(ring);
  }

  if (tower.tier >= 2) {
    const bannerMat = materials.cloth.clone();
    bannerMat.side = THREE.DoubleSide;
    bannerMat.transparent = true;
    bannerMat.opacity = 0.9;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), bannerMat);
    banner.position.set(0.32, 0.52, 0);
    banner.rotation.y = Math.PI / 2;
    group.add(banner);
  }

  const scale = 1 + tower.tier * 0.08;
  group.scale.setScalar(scale);

  group.userData = {
    kind: "tower",
    towerId: tower.towerId,
    tier: tower.tier,
    turret,
    recoilGroup,
    muzzle,
    flameCore,
    flameShell,
    frostCore,
    frostHalo,
  };
  applyShadows(group);
  muzzle.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  return group;
};

const buildBankMesh = () => {
  const { materials } = getVisualPack();
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.26, 0.6), materials.stoneDark);
  base.position.y = 0.13;
  group.add(base);

  const vault = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.32, 0.42), materials.wood);
  vault.position.y = 0.33;
  group.add(vault);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.46), materials.bronze);
  frame.position.y = 0.33;
  group.add(frame);

  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14), materials.gold);
  door.position.set(0, 0.33, 0.25);
  door.rotation.x = Math.PI / 2;
  group.add(door);

  const coinStack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), materials.gold);
  coinStack.position.set(-0.18, 0.2, -0.12);
  group.add(coinStack);
  const coinStack2 = coinStack.clone();
  coinStack2.position.set(0.2, 0.2, -0.16);
  group.add(coinStack2);

  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 10, 20), materials.gold);
  crest.position.set(0, 0.48, 0);
  crest.rotation.x = Math.PI / 2;
  group.add(crest);

  group.userData = { kind: "bank" };
  applyShadows(group);
  return group;
};

const getShipPalette = (typeId: string, variant: number) => {
  const sails = [0xf2e9d2, 0xcfe4ff, 0xf6d7b4, 0xd6e6f2, 0xf2f5f8, 0xcfe3d6];
  const trims = [0xd2aa68, 0xa4b9d8, 0xd4a06b, 0x8fb4d9, 0xc7b38c, 0x91c2b1];
  const index = variant % sails.length;

  switch (typeId) {
    case "sprinter":
      return { hull: 0x4a2f1c, trim: trims[index], sail: sails[index] };
    case "tank":
      return { hull: 0x3b2a1d, trim: 0xb08a4d, sail: 0xe9d0a2 };
    case "mystic":
      return { hull: 0x2f4158, trim: 0x8fb4d9, sail: 0xcfe4ff };
    case "boss":
      return { hull: 0x2b1d18, trim: 0xd18b4b, sail: 0xd6d6d6 };
    case "grunt":
    default:
      return { hull: 0x5b3d26, trim: trims[index], sail: sails[index] };
  }
};

const buildCreepMesh = (creep: CreepInstance) => {
  const def = CREEP_DEFS[creep.typeId];
  const { materials } = getVisualPack();
  const palette = getShipPalette(creep.typeId, creep.variant);

  const group = new THREE.Group();
  const hullMat = materials.wood.clone();
  hullMat.color = new THREE.Color(palette.hull);
  hullMat.roughness = 0.75;

  const trimMat = materials.bronze.clone();
  trimMat.color = new THREE.Color(palette.trim);
  trimMat.roughness = 0.4;

  const sailMat = materials.cloth.clone();
  sailMat.color = new THREE.Color(palette.sail);
  sailMat.side = THREE.DoubleSide;
  sailMat.transparent = true;
  sailMat.opacity = 0.88;

  const flagMat = materials.cloth.clone();
  flagMat.color = new THREE.Color(palette.trim).lerp(new THREE.Color(0xffffff), 0.2);
  flagMat.side = THREE.DoubleSide;
  flagMat.transparent = true;
  flagMat.opacity = 0.85;

  const wakeMat = new THREE.MeshBasicMaterial({
    color: 0x9ad7ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  const sizes = {
    sprinter: { length: 0.6, width: 0.22, mast: 0.34, sail: 0.28, masts: 1 },
    grunt: { length: 0.72, width: 0.26, mast: 0.42, sail: 0.32, masts: 1 },
    tank: { length: 0.95, width: 0.34, mast: 0.55, sail: 0.4, masts: 2 },
    mystic: { length: 0.78, width: 0.28, mast: 0.46, sail: 0.34, masts: 1 },
    boss: { length: 1.12, width: 0.4, mast: 0.62, sail: 0.45, masts: 2 },
  };
  const size = sizes[creep.typeId as keyof typeof sizes] ?? sizes.grunt;

  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(size.width, 0.12, size.length * 0.7),
    hullMat
  );
  hull.position.y = 0.06;
  group.add(hull);

  const prow = new THREE.Mesh(new THREE.ConeGeometry(size.width * 0.5, size.length * 0.35, 12), hullMat);
  prow.rotation.x = Math.PI / 2;
  prow.position.set(0, 0.06, size.length * 0.45);
  group.add(prow);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.75, 0.05, size.length * 0.5), trimMat);
  deck.position.y = 0.12;
  group.add(deck);

  const rails = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.85, 0.04, size.length * 0.6), trimMat);
  rails.position.y = 0.16;
  group.add(rails);

  const keel = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.28, 0.04, size.length * 0.6), hullMat);
  keel.position.set(0, 0.02, -size.length * 0.05);
  group.add(keel);

  const portholeMat = materials.iron.clone();
  portholeMat.color = new THREE.Color(palette.trim).lerp(new THREE.Color(0x1c3447), 0.7);
  portholeMat.emissive = new THREE.Color(0x0b2033);
  portholeMat.emissiveIntensity = 0.2;
  const portholeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8);
  const portholeCount = Math.max(2, Math.round(size.length * 6));
  const start = -size.length * 0.22;
  const step = (size.length * 0.44) / Math.max(1, portholeCount - 1);
  for (let i = 0; i < portholeCount; i += 1) {
    const z = start + step * i;
    const portholeLeft = new THREE.Mesh(portholeGeo, portholeMat);
    portholeLeft.rotation.z = Math.PI / 2;
    portholeLeft.position.set(-size.width * 0.52, 0.08, z);
    group.add(portholeLeft);

    const portholeRight = portholeLeft.clone();
    portholeRight.position.x = size.width * 0.52;
    group.add(portholeRight);
  }

  const sails: THREE.Mesh[] = [];
  const flags: THREE.Mesh[] = [];
  for (let i = 0; i < size.masts; i += 1) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, size.mast, 8), materials.wood);
    mast.position.set(0, 0.2 + size.mast * 0.5, size.length * (i === 0 ? -0.1 : 0.18));
    group.add(mast);

    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, size.width * 0.7, 6), materials.wood);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 0.2 + size.mast * 0.65, mast.position.z);
    group.add(yard);

    const sail = new THREE.Mesh(new THREE.PlaneGeometry(size.width * 0.6, size.sail), sailMat);
    sail.position.set(0, 0.2 + size.mast * 0.55, mast.position.z + 0.02);
    group.add(sail);
    sails.push(sail);

    const flag = new THREE.Mesh(new THREE.PlaneGeometry(size.width * 0.22, size.sail * 0.2), flagMat);
    flag.position.set(size.width * 0.2, 0.2 + size.mast * 0.82, mast.position.z);
    flag.rotation.y = Math.PI / 2;
    group.add(flag);
    flags.push(flag);
  }

  if (creep.typeId === "tank" || creep.typeId === "boss") {
    const cannonDeck = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.6, 0.1, size.length * 0.25), trimMat);
    cannonDeck.position.set(0, 0.22, -size.length * 0.2);
    group.add(cannonDeck);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.52, 0.22, size.length * 0.22), trimMat);
    cabin.position.set(0, 0.34, -size.length * 0.28);
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(size.width * 0.28, 0.16, 6), hullMat);
    roof.position.set(0, 0.46, -size.length * 0.28);
    group.add(roof);
  }

  if (creep.typeId === "mystic") {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      new THREE.MeshStandardMaterial({
        color: 0x7ed0ff,
        emissive: new THREE.Color(0x3b8dd6),
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.1,
      })
    );
    glow.position.set(0, 0.38, 0);
    group.add(glow);
  }

  if (def.isBoss) {
    const armor = new THREE.Mesh(new THREE.BoxGeometry(size.width * 0.9, 0.12, size.length * 0.5), materials.iron);
    armor.position.y = 0.18;
    group.add(armor);

    const figurehead = new THREE.Mesh(new THREE.ConeGeometry(size.width * 0.12, size.length * 0.18, 10), trimMat);
    figurehead.rotation.x = Math.PI / 2;
    figurehead.position.set(0, 0.1, size.length * 0.62);
    group.add(figurehead);
  }

  const wake = new THREE.Mesh(new THREE.PlaneGeometry(size.width * 1.4, size.length * 0.9), wakeMat);
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.02, -size.length * 0.35);
  group.add(wake);

  const wakeTrail = new THREE.Mesh(new THREE.PlaneGeometry(size.width * 2.0, size.length * 1.3), wakeMat);
  wakeTrail.rotation.x = -Math.PI / 2;
  wakeTrail.position.set(0, 0.01, -size.length * 0.48);
  group.add(wakeTrail);

  const bowFoam = new THREE.Mesh(new THREE.PlaneGeometry(size.width * 1.0, size.length * 0.3), wakeMat);
  bowFoam.rotation.x = -Math.PI / 2;
  bowFoam.position.set(0, 0.02, size.length * 0.5);
  group.add(bowFoam);

  const healthGroup = new THREE.Group();
  const barWidth = 0.5;
  const barHeight = 0.07;
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x0a1e33, transparent: true, opacity: 0.92 });
  bgMat.depthTest = false;
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x6bff7b, transparent: true, opacity: 0.98 });
  fillMat.depthTest = false;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, barHeight), bgMat);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, barHeight), fillMat);
  const borderMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  borderMat.depthTest = false;
  const border = new THREE.Mesh(new THREE.PlaneGeometry(barWidth + 0.02, barHeight + 0.02), borderMat);
  border.position.z = -0.002;
  bg.castShadow = false;
  bg.receiveShadow = false;
  fill.castShadow = false;
  fill.receiveShadow = false;
  fill.position.x = -barWidth * 0.25;
  healthGroup.add(border, bg, fill);
  healthGroup.position.set(0, 0.6, 0);
  healthGroup.renderOrder = 5;
  group.add(healthGroup);

  const slowAuraMat = new THREE.MeshBasicMaterial({
    color: 0x7bdcff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  slowAuraMat.depthTest = false;
  const auraRadius = Math.max(size.width, size.length) * 0.6;
  const slowAura = new THREE.Mesh(new THREE.RingGeometry(auraRadius * 0.6, auraRadius * 0.9, 32), slowAuraMat);
  slowAura.rotation.x = -Math.PI / 2;
  slowAura.position.y = 0.03;
  slowAura.visible = false;
  slowAura.renderOrder = 6;
  group.add(slowAura);

  const scale = def.isBoss ? 1.35 : creep.typeId === "sprinter" ? 0.9 : 1;
  group.scale.setScalar(scale);
  group.userData = {
    kind: "creep",
    typeId: creep.typeId,
    baseScale: scale,
    sails,
    flags,
    wakes: [wake, wakeTrail, bowFoam],
    healthGroup,
    healthFill: fill,
    healthBarWidth: barWidth,
    slowAura,
    lastPos: new THREE.Vector3(creep.x, 0, creep.y),
  };
  applyShadows(group);
  for (const foam of [wake, wakeTrail, bowFoam]) {
    foam.castShadow = false;
    foam.receiveShadow = false;
  }
  healthGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  return group;
};

const buildShotMesh = (towerId: string, color: string) => {
  const { materials } = getVisualPack();
  const group = new THREE.Group();
  const accent = new THREE.Color(color);

  const glowMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  if (towerId === "splash") {
    const flameCore = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), glowMat);
    flameCore.position.y = 0.1;
    group.add(flameCore);

    const flameShell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), glowMat);
    flameShell.position.y = 0.1;
    group.add(flameShell);

    const ember = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), glowMat);
    ember.position.y = -0.14;
    ember.rotation.x = Math.PI;
    group.add(ember);

    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 0.3, 10), glowMat);
    trail.position.y = -0.26;
    group.add(trail);

    group.userData = { flameCore, flameShell, trail };
    return group;
  }

  if (towerId === "slow") {
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xaee3ff,
      emissive: new THREE.Color(0x4aa0ff),
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), iceMat);
    shard.position.y = 0.1;
    group.add(shard);

    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.2, 8), glowMat);
    trail.position.y = -0.14;
    group.add(trail);
    group.userData = { shard, trail };
    return group;
  }

  if (towerId === "cannon") {
    const ballMat = materials.iron.clone();
    ballMat.color = new THREE.Color(0x656d78);
    ballMat.roughness = 0.45;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), ballMat);
    ball.position.y = 0.1;
    group.add(ball);

    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), glowMat);
    smoke.position.y = -0.1;
    group.add(smoke);
    group.userData = { smoke, ball };
    return group;
  }

  const arrowMat = materials.iron.clone();
  arrowMat.color = new THREE.Color(0x7a6f64).lerp(accent, 0.2);
  arrowMat.roughness = 0.5;

  const fletchMat = materials.cloth.clone();
  fletchMat.color = accent.clone().lerp(new THREE.Color(0xffffff), 0.2);
  fletchMat.roughness = 0.6;

  const makeArrow = (offsetX: number, length: number) => {
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, length, 6), arrowMat);
    shaft.position.y = length * 0.1;
    arrow.add(shaft);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 8), arrowMat);
    tip.position.y = length * 0.55;
    arrow.add(tip);

    const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.12), fletchMat);
    fletch.position.y = -length * 0.2;
    arrow.add(fletch);

    arrow.position.x = offsetX;
    group.add(arrow);
    return arrow;
  };

  const arrowLength = towerId === "long" ? 0.8 : towerId === "rapid" ? 0.5 : 0.55;

  if (towerId === "rapid") {
    makeArrow(-0.04, arrowLength);
    makeArrow(0, arrowLength);
    makeArrow(0.04, arrowLength);
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, arrowLength * 0.6, 6), glowMat);
    trail.position.y = -arrowLength * 0.1;
    group.add(trail);
    group.userData = { arrowType: "rapid", trail };
    return group;
  }

  makeArrow(0, arrowLength);
  if (towerId === "long") {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.18), arrowMat);
    brace.position.y = -0.25;
    group.add(brace);
  }

  const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, arrowLength * 0.6, 6), glowMat);
  trail.position.y = -arrowLength * 0.1;
  group.add(trail);

  group.userData = { arrowType: towerId, trail };
  return group;
};

const clampCameraTarget = (runtime: Runtime) => {
  const margin = 0.5;
  const maxX = Math.max(margin, runtime.baseMap.width - margin);
  const maxZ = Math.max(margin, runtime.baseMap.height - margin);
  runtime.view.cameraTarget.x = clamp(runtime.view.cameraTarget.x, margin, maxX);
  runtime.view.cameraTarget.z = clamp(runtime.view.cameraTarget.z, margin, maxZ);
};

const applyCameraZoom = (runtime: Runtime) => {
  const { camera, width, height, zoom, baseDistance, cameraTarget } = runtime.view;
  if (!width || !height) return;
  clampCameraTarget(runtime);
  const distance = baseDistance / zoom;
  const elevation = distance * 0.9;
  const offset = distance * 0.75;
  camera.aspect = width / height;
  camera.position.set(cameraTarget.x, elevation, cameraTarget.z + offset);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();
};

const fitCameraToGrid = (runtime: Runtime) => {
  const { camera } = runtime.view;
  const gridW = runtime.baseMap.width;
  const gridH = runtime.baseMap.height;
  const maxSize = Math.max(gridW, gridH);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = maxSize / (2 * Math.tan(fov / 2));
  runtime.view.baseDistance = distance * 1.05;
  runtime.view.cameraTarget.set(gridW / 2, 0, gridH / 2);
  applyCameraZoom(runtime);
};

const resizeCanvas = (runtime: Runtime) => {
  const { canvas, renderer } = runtime.view;
  const container = canvas.parentElement;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  runtime.view.width = rect.width;
  runtime.view.height = rect.height;
  renderer.setSize(rect.width, rect.height, false);
  fitCameraToGrid(runtime);
};

const updateMapMarkers = (runtime: Runtime) => {
  const { baseMap, view } = runtime;
  view.spawnMarker.position.set(baseMap.spawn.x + 0.5, 0.2, baseMap.spawn.y + 0.5);
  view.exitMarker.position.set(baseMap.exit.x + 0.5, 0.2, baseMap.exit.y + 0.5);
};

const getVisualTarget = (tower: TowerInstance, state: GameState, runtime: Runtime) => {
  const candidates = getTowerTargets(tower, state, runtime);
  if (!candidates.length) return null;

  let best = candidates[0];
  let bestDist = Number.POSITIVE_INFINITY;
  const ox = tower.x + 0.5;
  const oy = tower.y + 0.5;

  for (const creep of candidates) {
    const dx = creep.x - ox;
    const dy = creep.y - oy;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = creep;
    }
  }

  return best;
};

const syncStructures = (runtime: Runtime, state: GameState, timeSec: number) => {
  const { structureGroup, structureMeshes } = runtime.view;
  const seen = new Set<number>();

  for (const structure of state.structures) {
    seen.add(structure.id);
    let mesh = structureMeshes.get(structure.id);
    if (!mesh) {
      mesh = structure.kind == "bank" ? buildBankMesh() : buildTowerMesh(structure);
      structureGroup.add(mesh);
      structureMeshes.set(structure.id, mesh);
    }

    if (structure.kind == "tower") {
      const currentTier = (mesh.userData?.tier as number | undefined) ?? -1;
      const currentId = (mesh.userData?.towerId as string | undefined) ?? "";
      if (currentTier != structure.tier || currentId != structure.towerId) {
        structureGroup.remove(mesh);
        structureMeshes.delete(structure.id);
        mesh = buildTowerMesh(structure);
        structureGroup.add(mesh);
        structureMeshes.set(structure.id, mesh);
      }
    }

    mesh.position.set(structure.x + 0.5, 0, structure.y + 0.5);

    if (structure.kind == "tower") {
      const turret = (mesh.userData?.turret as THREE.Group | undefined) ?? null;
      const recoilGroup = mesh.userData?.recoilGroup as THREE.Group | undefined;
      const muzzle = mesh.userData?.muzzle as THREE.Object3D | undefined;
      if (turret) {
        const target = getVisualTarget(structure, state, runtime);
        if (target) {
          const dx = target.x - (structure.x + 0.5);
          const dz = target.y - (structure.y + 0.5);
          const angle = Math.atan2(dx, dz);
          turret.rotation.y = angle;
        } else {
          turret.rotation.y = Math.sin(timeSec + structure.id) * 0.5;
        }
      }
      if (recoilGroup) {
        recoilGroup.position.z = -0.08 * structure.recoil;
      }
      setMuzzleIntensity(muzzle, structure.recoil);

      const flameCore = mesh.userData?.flameCore as THREE.Mesh | null | undefined;
      const flameShell = mesh.userData?.flameShell as THREE.Mesh | null | undefined;
      if (flameCore && flameShell) {
        const flicker = 0.9 + Math.sin(timeSec * 6 + structure.id) * 0.18;
        flameCore.scale.setScalar(flicker);
        flameShell.scale.setScalar(0.95 + Math.cos(timeSec * 7 + structure.id) * 0.2);
        flameShell.rotation.z = Math.sin(timeSec * 5 + structure.id) * 0.25;
        if (flameCore.material instanceof THREE.MeshBasicMaterial) {
          flameCore.material.opacity = 0.65 + Math.sin(timeSec * 8 + structure.id) * 0.15;
        }
      }

      const frostCore = mesh.userData?.frostCore as THREE.Mesh | null | undefined;
      const frostHalo = mesh.userData?.frostHalo as THREE.Mesh | null | undefined;
      if (frostCore && frostHalo) {
        const pulse = 0.95 + Math.sin(timeSec * 4 + structure.id) * 0.1;
        frostCore.scale.setScalar(pulse);
        frostHalo.scale.setScalar(0.9 + Math.sin(timeSec * 3 + structure.id) * 0.12);
        if (frostHalo.material instanceof THREE.MeshBasicMaterial) {
          frostHalo.material.opacity = 0.25 + Math.sin(timeSec * 5 + structure.id) * 0.1;
        }
      }
    }
  }

  for (const [id, mesh] of structureMeshes) {
    if (!seen.has(id)) {
      structureGroup.remove(mesh);
      structureMeshes.delete(id);
    }
  }
};

const syncCreeps = (runtime: Runtime, state: GameState, timeSec: number) => {
  const { creepGroup, creepMeshes } = runtime.view;
  const seen = new Set<number>();

  for (const creep of state.creeps) {
    seen.add(creep.id);
    let mesh = creepMeshes.get(creep.id);
    if (!mesh) {
      mesh = buildCreepMesh(creep);
      creepGroup.add(mesh);
      creepMeshes.set(creep.id, mesh);
    }

    const bob = Math.sin(timeSec * 4 + creep.id) * 0.02;
    const baseScale = (mesh.userData?.baseScale as number | undefined) ?? 1;
    const lastPos = mesh.userData?.lastPos as THREE.Vector3 | undefined;
    if (lastPos) {
      const dx = creep.x - lastPos.x;
      const dz = creep.y - lastPos.z;
      if (Math.hypot(dx, dz) > 0.001) {
        mesh.rotation.y = Math.atan2(dx, dz);
      }
      lastPos.set(creep.x, 0, creep.y);
    }

    const roll = Math.sin(timeSec * 2 + creep.id) * 0.04;
    mesh.position.set(creep.x, 0.04 + bob, creep.y);
    mesh.rotation.z = roll;
    mesh.scale.set(baseScale, baseScale, baseScale);

    const sails = mesh.userData?.sails as THREE.Mesh[] | undefined;
    if (sails) {
      for (let i = 0; i < sails.length; i += 1) {
        const sail = sails[i];
        sail.rotation.y = Math.sin(timeSec * 2.5 + creep.id + i) * 0.08;
        sail.scale.x = 0.92 + Math.sin(timeSec * 3 + creep.id + i) * 0.06;
      }
    }

    const flags = mesh.userData?.flags as THREE.Mesh[] | undefined;
    if (flags) {
      for (let i = 0; i < flags.length; i += 1) {
        const flag = flags[i];
        flag.rotation.z = Math.sin(timeSec * 3.2 + creep.id + i) * 0.22;
        flag.scale.x = 0.9 + Math.sin(timeSec * 3.6 + creep.id + i) * 0.08;
      }
    }

    const wakes = mesh.userData?.wakes as THREE.Mesh[] | undefined;
    if (wakes) {
      for (let i = 0; i < wakes.length; i += 1) {
        const wake = wakes[i];
        if (wake.material instanceof THREE.MeshBasicMaterial) {
          wake.material.opacity = 0.18 + Math.sin(timeSec * 4.2 + creep.id + i) * 0.06;
        }
        wake.scale.z = 0.9 + Math.sin(timeSec * 3 + creep.id + i) * 0.1;
      }
    }

    const slowAura = mesh.userData?.slowAura as THREE.Mesh | undefined;
    if (slowAura && slowAura.material instanceof THREE.MeshBasicMaterial) {
      if (creep.slowTimer > 0) {
        slowAura.visible = true;
        const pulse = 0.92 + Math.sin(timeSec * 5.5 + creep.id) * 0.08;
        slowAura.scale.set(pulse, pulse, pulse);
        slowAura.material.opacity = 0.18 + Math.sin(timeSec * 7.2 + creep.id) * 0.08;
      } else {
        slowAura.visible = false;
      }
    }

    const healthGroup = mesh.userData?.healthGroup as THREE.Group | undefined;
    const healthFill = mesh.userData?.healthFill as THREE.Mesh | undefined;
    const barWidth = (mesh.userData?.healthBarWidth as number | undefined) ?? 0.42;
    const hpRatio = clamp(creep.hp / creep.maxHp, 0, 1);
    if (healthGroup && healthFill) {
      healthGroup.position.y = 0.6 + bob;
      healthGroup.quaternion.copy(runtime.view.camera.quaternion);
      healthFill.scale.x = hpRatio;
      healthFill.position.x = -((1 - hpRatio) * barWidth) / 2;
      if (healthFill.material instanceof THREE.MeshBasicMaterial) {
        const color = new THREE.Color(0xe25555).lerp(new THREE.Color(0x61d66b), hpRatio);
        healthFill.material.color.copy(color);
      }
    }
  }

  for (const [id, mesh] of creepMeshes) {
    if (!seen.has(id)) {
      creepGroup.remove(mesh);
      creepMeshes.delete(id);
    }
  }
};

const syncShots = (runtime: Runtime, state: GameState, timeSec: number) => {
  const { shotGroup, shotMeshes } = runtime.view;
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < state.shots.length; i += 1) {
    const shot = state.shots[i];
    let mesh = shotMeshes[i];
    if (!mesh) {
      mesh = buildShotMesh(shot.towerId, shot.color);
      shotGroup.add(mesh);
      shotMeshes[i] = mesh;
    }

    const flameCore = mesh.userData?.flameCore as THREE.Mesh | undefined;
    const flameShell = mesh.userData?.flameShell as THREE.Mesh | undefined;
    const shard = mesh.userData?.shard as THREE.Mesh | undefined;
    const trail = mesh.userData?.trail as THREE.Mesh | undefined;
    const smoke = mesh.userData?.smoke as THREE.Mesh | undefined;
    const alpha = clamp(shot.ttl / shot.ttlMax, 0, 1);
    const t = 1 - alpha;
    const baseStart = new THREE.Vector3(shot.x1, 0.35, shot.y1);
    const end = new THREE.Vector3(shot.x2, 0.35, shot.y2);
    const flat = new THREE.Vector3(end.x - baseStart.x, 0, end.z - baseStart.z);
    const distance = flat.length();
    if (distance < 0.001) {
      flat.set(0, 0, 1);
    } else {
      flat.normalize();
    }

    const arcScale =
      shot.towerId === "cannon"
        ? 0.55
        : shot.towerId === "long"
          ? 0.4
          : shot.towerId === "splash"
            ? 0.18
            : 0.28;
    const arcHeight = Math.min(0.6, 0.15 + distance * arcScale);
    const start = baseStart.clone().addScaledVector(flat, 0.18);
    const height = Math.sin(Math.PI * t) * arcHeight + 0.12;
    const position = start.clone().lerp(end, t);
    position.y += height;

    const heightDerivative = Math.cos(Math.PI * t) * Math.PI * arcHeight;
    const motion = new THREE.Vector3(flat.x, heightDerivative, flat.z).normalize();

    mesh.position.copy(position);
    mesh.quaternion.setFromUnitVectors(up, motion);
    const scale = shot.towerId === "splash" ? 1.2 + alpha * 0.6 : 0.9 + alpha * 0.25;
    mesh.scale.set(scale, scale, scale);
    mesh.visible = true;

    if (flameCore && flameCore.material instanceof THREE.MeshBasicMaterial) {
      flameCore.material.opacity = 0.45 + 0.5 * alpha;
      const pulse = 0.9 + Math.sin(timeSec * 18 + i) * 0.18;
      flameCore.scale.setScalar(pulse);
    }
    if (flameShell && flameShell.material instanceof THREE.MeshBasicMaterial) {
      flameShell.material.opacity = 0.25 + 0.4 * alpha;
      const shellPulse = 1 + Math.cos(timeSec * 12 + i) * 0.2;
      flameShell.scale.setScalar(shellPulse);
    }
    if (trail && trail.material instanceof THREE.MeshBasicMaterial) {
      trail.material.opacity = 0.25 + 0.45 * alpha;
      trail.scale.set(1, 0.7 + alpha * 0.9, 1);
    }
    if (shard && shard.material instanceof THREE.MeshStandardMaterial) {
      shard.rotation.y += 0.1;
    }
    if (smoke && smoke.material instanceof THREE.MeshBasicMaterial) {
      smoke.material.opacity = 0.2 + 0.35 * alpha;
      smoke.scale.set(1, 1 + alpha * 0.6, 1);
      smoke.position.y = -0.12 + (1 - alpha) * 0.12;
    }
  }

  for (let i = state.shots.length; i < shotMeshes.length; i += 1) {
    const mesh = shotMeshes[i];
    if (mesh) mesh.visible = false;
  }
};

const syncSelection = (runtime: Runtime, selection: Structure | null, timeSec: number) => {
  const ring = runtime.view.selectionRing;
  const outline = runtime.view.selectionOutline;
  const rangeRing = runtime.view.rangeRing;
  if (!selection) {
    ring.visible = false;
    outline.visible = false;
    rangeRing.visible = false;
    return;
  }
  ring.visible = true;
  outline.visible = true;
  ring.position.set(selection.x + 0.5, 0.05, selection.y + 0.5);
  outline.position.set(selection.x + 0.5, 0.06, selection.y + 0.5);
  const pulse = 0.92 + Math.sin(timeSec * 3 + selection.id) * 0.08;
  ring.scale.set(pulse, pulse, pulse);
  ring.rotation.z = timeSec * 0.6;
  outline.scale.set(1.08, 1.08, 1.08);

  const material = ring.material;
  if (selection.kind == "tower") {
    const accent = getTowerAccent(selection.towerId);
    material.color = accent;
    material.emissive = accent.clone();
    material.emissiveIntensity = 0.75;
    if (outline.material instanceof THREE.LineBasicMaterial) {
      outline.material.color.copy(accent.clone().lerp(new THREE.Color(0xffffff), 0.4));
      outline.material.opacity = 0.85;
    }

    const range = getScaledRange(getTower(selection.towerId), selection.tier);
    rangeRing.visible = true;
    rangeRing.position.set(selection.x + 0.5, 0.04, selection.y + 0.5);
    rangeRing.scale.set(range, range, range);
    rangeRing.material.color.copy(accent.clone().lerp(new THREE.Color(0xffffff), 0.35));
  } else {
    material.color = new THREE.Color(0xd6b869);
    material.emissive = new THREE.Color(0x8b6a2e);
    material.emissiveIntensity = 0.65;
    if (outline.material instanceof THREE.LineBasicMaterial) {
      outline.material.color = new THREE.Color(0xf2cf86);
      outline.material.opacity = 0.75;
    }
    rangeRing.visible = false;
  }
};

const render = (runtime: Runtime, state: GameState, selection: Structure | null, timeSec: number) => {
  updateEnvironment(runtime, timeSec);
  syncStructures(runtime, state, timeSec);
  syncCreeps(runtime, state, timeSec);
  syncShots(runtime, state, timeSec);
  syncSelection(runtime, selection, timeSec);
  runtime.view.renderer.render(runtime.view.scene, runtime.view.camera);
};

const updateNextRoundButton = (state: GameState) => {
  if (!nextRoundButton) return;
  const visible = hasRendered && showNextRound && state.phase == "prep";
  nextRoundButton.classList.toggle("hidden", !visible);
  nextRoundButton.disabled = !visible;
};

const updateHud = (state: GameState, runtime: Runtime) => {
  const goldEl = document.getElementById("gold-value");
  const livesEl = document.getElementById("lives-value");
  const waveEl = document.getElementById("wave-value");
  const timerEl = document.getElementById("timer-value");
  const pathEl = document.getElementById("path-length");
  const towersEl = document.getElementById("tower-count");
  const dpsEl = document.getElementById("dps-sum");
  const bankEl = document.getElementById("bank-income");

  if (goldEl) goldEl.textContent = `${state.gold}`;
  if (livesEl) livesEl.textContent = `${state.lives}`;
  if (waveEl) waveEl.textContent = `${state.wave}/${MAX_WAVES}`;
  if (timerEl) {
    timerEl.textContent = state.phase == "prep" ? `${Math.ceil(state.phaseTimer)}s` : "--";
  }

  if (pathEl) pathEl.textContent = formatPathLength(runtime);
  if (towersEl) {
    const towerCount = state.structures.filter((structure) => structure.kind == "tower").length;
    towersEl.textContent = `${towerCount}`;
  }
  if (dpsEl) {
    const totalDps = state.structures.reduce((sum, structure) => {
      if (structure.kind != "tower") return sum;
      const def = getTower(structure.towerId);
      const tier = def.tiers[structure.tier];
      const scaledDamage = getScaledDamage(def, structure.tier);
      return sum + scaledDamage * tier.rate;
    }, 0);
    const text = Number.isInteger(totalDps) ? `${totalDps}` : totalDps.toFixed(1);
    dpsEl.textContent = text;
  }
  if (bankEl) {
    const bankCount = state.structures.filter((structure) => structure.kind == "bank").length;
    bankEl.textContent = `${bankCount * BANK_DEFINITION.income}`;
  }

  updateNextRoundButton(state);
};

const updateBuildBar = (state: GameState, buildSelection: BuildSelection) => {
  const bar = document.getElementById("build-bar");
  if (!bar) return;

  bar.innerHTML = "";
  const options = [
    ...["wall", "basic"].map((towerId) => {
      const tower = getTower(towerId);
      return {
        id: tower.id,
        label: tower.name,
        cost: tower.tiers[0].cost,
        color: tower.color,
        kind: "tower" as const,
      };
    }),
    {
      id: BANK_DEFINITION.id,
      label: BANK_DEFINITION.name,
      cost: BANK_DEFINITION.cost,
      color: BANK_DEFINITION.color,
      kind: "bank" as const,
    },
    ...["long", "splash", "slow"].map((towerId) => {
      const tower = getTower(towerId);
      return {
        id: tower.id,
        label: tower.name,
        cost: tower.tiers[0].cost,
        color: tower.color,
        kind: "tower" as const,
      };
    }),
  ];

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "build-item";
    button.style.setProperty("--accent-color", option.color);
    button.setAttribute("data-build", option.id);
    const isSelected =
      buildSelection.kind == option.kind &&
      (buildSelection.kind != "tower" || buildSelection.towerId == option.id);
    if (isSelected) button.classList.add("active");

    button.innerHTML = `
      <div class="build-icon"></div>
      <div>
        <div class="build-name">${option.label}</div>
        <div class="build-cost">${option.cost}g</div>
      </div>
    `;
    button.addEventListener("click", () => {
      if (isSelected) {
        activeBuildSelection = { kind: "none" };
      } else {
        activeBuildSelection =
          option.kind == "tower"
            ? { kind: "tower", towerId: option.id }
            : { kind: "bank" };
      }
      activeSelection = null;
      renderActionTray(state, null, activeBuildSelection);
      updateBuildBar(state, activeBuildSelection);
    });
    bar.appendChild(button);
  }
};

const renderActionTray = (state: GameState, selected: Structure | null, buildSelection: BuildSelection) => {
  const tray = document.getElementById("action-tray");
  const controls = document.getElementById("action-controls");
  if (!tray || !controls) return;

  const canInteract = state.phase != "victory" && state.phase != "defeat";
  const hasBuildSelection = buildSelection.kind != "none";
  const hasSelection = !!selected;
  if ((!hasSelection && !hasBuildSelection) || !canInteract) {
    tray.classList.remove("show");
    tray.setAttribute("aria-hidden", "true");
    tray.innerHTML = "";
    controls.classList.remove("show");
    controls.setAttribute("aria-hidden", "true");
    controls.innerHTML = "";
    actionTrayKey = "";
    return;
  }

  const selectionKey = selected
    ? `${selected.kind}:${selected.id}:${
        selected.kind == "tower" ? `${selected.tier}:${selected.targetMode}:${selected.lastRoundDamage}` : ""
      }`
    : "none";
  const buildKey =
    buildSelection.kind == "tower" ? `tower:${buildSelection.towerId}` : `${buildSelection.kind}`;
  const nextKey = `${selectionKey}|${buildKey}`;

  const updateUpgradeDisabled = () => {
    const upgradeButton = controls.querySelector<HTMLButtonElement>("[data-upgrade]");
    if (!upgradeButton) return;
    const cost = Number(upgradeButton.dataset.cost ?? "0");
    upgradeButton.disabled = state.gold < cost;
  };

  if (actionTrayKey == nextKey) {
    updateUpgradeDisabled();
    return;
  }

  actionTrayKey = nextKey;
  tray.classList.add("show");
  tray.setAttribute("aria-hidden", "false");
  tray.innerHTML = "";
  controls.classList.remove("show");
  controls.setAttribute("aria-hidden", "true");
  controls.innerHTML = "";

  const name = document.createElement("div");
  name.className = "action-name";
  const buildStats = document.createElement("div");
  buildStats.className = "action-stats";

  const formatDps = (damage: number, rate: number) => {
    const value = damage * rate;
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  };

  const formatDamage = (value: number) => {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  };

  const towerSpecial = (towerId: string, tierIndex = 0) => {
    if (towerId === "splash") return "Splash";
    if (towerId === "slow") return tierIndex > 0 ? "Slow Splash" : "Slow";
    if (towerId === "long") return "Far Range";
    if (towerId === "wall") return "Blocker";
    return "None";
  };

  const addStat = (label: string, value: string) => {
    const stat = document.createElement("div");
    stat.className = "action-stat";
    stat.innerHTML = `<span class="action-label">${label}:</span><span class="action-value">${value}</span>`;
    buildStats.appendChild(stat);
  };

  if (hasSelection && selected) {
    if (selected.kind == "bank") {
      name.textContent = "";
      addStat("DPS", "—");
      addStat("Special", `+${BANK_DEFINITION.income}g / wave`);
    } else {
      const towerDef = getTower(selected.towerId);
      const tier = towerDef.tiers[selected.tier];
      const scaledDamage = getScaledDamage(towerDef, selected.tier);
      name.textContent = "";
      addStat("DPS", formatDps(scaledDamage, tier.rate));
      addStat("Special", towerSpecial(towerDef.id, selected.tier));
      addStat("Last Round DMG", formatDamage(selected.lastRoundDamage));
    }
  } else if (buildSelection.kind == "tower") {
    const towerDef = getTower(buildSelection.towerId);
    const tier = towerDef.tiers[0];
    const scaledDamage = getScaledDamage(towerDef, 0);
    name.textContent = "";
    addStat("DPS", formatDps(scaledDamage, tier.rate));
    addStat("Special", towerSpecial(towerDef.id, 0));
  } else if (buildSelection.kind == "bank") {
    name.textContent = "";
    addStat("DPS", "—");
    addStat("Special", `+${BANK_DEFINITION.income}g / wave`);
  }

  if (name.textContent) {
    tray.appendChild(name);
  }
  tray.appendChild(buildStats);

  const buttons = document.createElement("div");
  buttons.className = "action-buttons";

  if (hasSelection && selected) {
    if (selected.kind == "tower") {
      const towerDef = getTower(selected.towerId);
      const targetButton = document.createElement("button");
      targetButton.className = "action-btn";
      targetButton.textContent = `Target ${selected.targetMode}`;
      targetButton.addEventListener("click", () => {
        const index = TARGET_MODES.indexOf(selected.targetMode);
        selected.targetMode = TARGET_MODES[(index + 1) % TARGET_MODES.length];
        renderActionTray(state, selected, buildSelection);
      });
      buttons.appendChild(targetButton);

      if (selected.tier < towerDef.tiers.length - 1) {
        const nextTier = towerDef.tiers[selected.tier + 1];
        const upgradeButton = document.createElement("button");
        upgradeButton.className = "action-btn primary";
        upgradeButton.textContent = `Up ${nextTier.cost}g`;
        upgradeButton.dataset.upgrade = "1";
        upgradeButton.dataset.cost = `${nextTier.cost}`;
        upgradeButton.disabled = state.gold < nextTier.cost;
        upgradeButton.addEventListener("click", () => {
          if (state.gold < nextTier.cost) return;
          state.gold -= nextTier.cost;
          selected.tier += 1;
          selected.spent += nextTier.cost;
          renderActionTray(state, selected, buildSelection);
          updateHud(state, runtime);
        });
        buttons.appendChild(upgradeButton);
      }
    }

    const sellButton = document.createElement("button");
    sellButton.className = "action-btn";
    sellButton.textContent = `Sell ${getSellValue(state, selected)}g`;
    sellButton.addEventListener("click", () => {
      state.gold += getSellValue(state, selected);
      removeStructure(state, runtime, selected);
      activeSelection = null;
      renderActionTray(state, null, buildSelection);
      updateHud(state, runtime);
    });
    buttons.appendChild(sellButton);
  }

  if (buttons.childElementCount) {
    controls.classList.add("show");
    controls.setAttribute("aria-hidden", "false");
    controls.appendChild(buttons);
  }
};

const showToast = (message: string) => {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1600);
};

const showEndModal = (state: GameState) => {
  const modal = document.getElementById("end-modal");
  const title = document.getElementById("end-title");
  const summary = document.getElementById("end-summary");
  if (!modal || !title || !summary) return;

  const score = calcScore(state);
  const wavesCleared = state.phase == "victory" ? MAX_WAVES : state.wave - 1;

  title.textContent = state.phase == "victory" ? "Victory" : "Defeat";
  summary.textContent = `Waves cleared: ${wavesCleared}. Score: ${score}.`;
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("show");
};

const hideEndModal = () => {
  const modal = document.getElementById("end-modal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("show");
};

const submitScore = async (state: GameState) => {
  if (state.scoreSubmitted || state.scoreSubmitting) return;
  state.scoreSubmitting = true;
  const score = calcScore(state);
  const wavesCleared = state.phase == "victory" ? MAX_WAVES : state.wave - 1;

  const payload: SubmitScoreRequest = {
    score,
    waves: wavesCleared,
    seed: state.seed,
  };

  try {
    const response = await fetch("/api/submit-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = (await response.json()) as SubmitScoreResponse;
      if (data.status == "ok") {
        state.scoreSubmitted = true;
      }
    }
  } catch {
    // Ignore score submission failures.
  }
  state.scoreSubmitting = false;
  if (!state.scoreSubmitted) {
    state.scoreSubmitted = true;
  }
};

let runtime: Runtime;
let state: GameState;
let activeSelection: Structure | null = null;
let activeBuildSelection: BuildSelection = { kind: "none" };
let actionTrayKey = "";
let showPathPanel = true;
let nextRoundButton: HTMLButtonElement | null = null;
let showNextRound = true;
let hasRendered = false;

const setupInteraction = () => {
  const canvas = runtime.view.canvas;
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    runtime.view.pointer.set(x, y);
    runtime.view.raycaster.setFromCamera(runtime.view.pointer, runtime.view.camera);
    const hits = runtime.view.raycaster.intersectObject(runtime.view.groundPlane, false);
    if (!hits.length) return;

    const point = hits[0].point;
    const gridX = Math.floor(point.x);
    const gridY = Math.floor(point.z);

    if (gridX < 0 || gridY < 0 || gridX >= runtime.baseMap.width || gridY >= runtime.baseMap.height) {
      return;
    }

    const existing = getStructureAt(runtime, gridX, gridY);
    if (existing) {
      activeBuildSelection = { kind: "none" };
      updateBuildBar(state, activeBuildSelection);
      activeSelection = existing;
      renderActionTray(state, existing, activeBuildSelection);
      return;
    }

    activeSelection = null;
    renderActionTray(state, null, activeBuildSelection);

    if (activeBuildSelection.kind == "none") {
      return;
    }

    if (state.phase == "victory" || state.phase == "defeat") {
      return;
    }

    if (!canPlaceStructure(runtime, gridX, gridY)) {
      showToast("Placement would block the path.");
      return;
    }

    if (activeBuildSelection.kind == "tower") {
      const towerDef = getTower(activeBuildSelection.towerId);
      const tier = towerDef.tiers[0];
      if (state.gold < tier.cost) {
        showToast("Not enough gold.");
        return;
      }
      const tower: TowerInstance = {
        id: state.nextId++,
        kind: "tower",
        towerId: towerDef.id,
        tier: 0,
        cooldown: 0,
        recoil: 0,
        targetMode: "first",
        x: gridX,
        y: gridY,
        spent: tier.cost,
        roundDamage: 0,
        lastRoundDamage: 0,
      };
      state.gold -= tier.cost;
      addStructure(state, runtime, tower);
      updateHud(state, runtime);
      return;
    }

    if (activeBuildSelection.kind == "bank") {
      if (state.gold < BANK_DEFINITION.cost) {
        showToast("Not enough gold.");
        return;
      }
      const bank: BankInstance = {
        id: state.nextId++,
        kind: "bank",
        x: gridX,
        y: gridY,
        spent: BANK_DEFINITION.cost,
      };
      state.gold -= BANK_DEFINITION.cost;
      addStructure(state, runtime, bank);
      updateHud(state, runtime);
      return;
    }
  });

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const getTouchMidpoint = (touches: TouchList) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const screenToGround = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    runtime.view.pointer.set(x, y);
    runtime.view.raycaster.setFromCamera(runtime.view.pointer, runtime.view.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (runtime.view.raycaster.ray.intersectPlane(plane, point)) {
      return point;
    }
    return null;
  };

  let pinchStartDist = 0;
  let pinchStartZoom = runtime.view.zoom;
  let pinchStartTarget = runtime.view.cameraTarget.clone();
  let pinchStartWorld: THREE.Vector3 | null = null;

  canvas.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 2) {
        pinchStartDist = getTouchDistance(event.touches);
        pinchStartZoom = runtime.view.zoom;
        pinchStartTarget = runtime.view.cameraTarget.clone();
        const midpoint = getTouchMidpoint(event.touches);
        pinchStartWorld = screenToGround(midpoint.x, midpoint.y);
      }
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const distance = getTouchDistance(event.touches);
        if (!pinchStartDist) return;
        const scale = distance / pinchStartDist;
        runtime.view.zoom = clamp(pinchStartZoom * scale, runtime.view.minZoom, runtime.view.maxZoom);
        applyCameraZoom(runtime);
        const midpoint = getTouchMidpoint(event.touches);
        const currentWorld = screenToGround(midpoint.x, midpoint.y);
        if (currentWorld && pinchStartWorld) {
          const delta = pinchStartWorld.clone().sub(currentWorld);
          runtime.view.cameraTarget.copy(pinchStartTarget.clone().add(delta));
          applyCameraZoom(runtime);
        }
      }
    },
    { passive: false }
  );

  canvas.addEventListener("touchend", (event) => {
    if (event.touches.length < 2) {
      pinchStartDist = 0;
      pinchStartWorld = null;
    }
  });

  const playAgainButton = document.getElementById("play-again") as HTMLButtonElement | null;
  const menuSelect = document.getElementById("menu-select") as HTMLSelectElement | null;
  const pathPanel = document.getElementById("path-panel");
  nextRoundButton = document.getElementById("next-round") as HTMLButtonElement | null;

  const updatePathPanelVisibility = () => {
    if (!pathPanel) return;
    pathPanel.style.display = showPathPanel ? "grid" : "none";
  };

  const startNextRound = () => {
    if (state.phase != "prep") return;
    buildSpawnQueue(state);
    state.phase = "wave";
    state.phaseTimer = 0;
  };

  playAgainButton?.addEventListener("click", () => {
    hideEndModal();
    initGame(state.seed);
  });

  nextRoundButton?.addEventListener("click", () => {
    startNextRound();
    updateNextRoundButton(state);
  });

  menuSelect?.addEventListener("change", () => {
    if (menuSelect.value == "restart") {
      initGame(state.seed);
      menuSelect.value = "";
    }
    if (menuSelect.value == "toggle-path") {
      showPathPanel = !showPathPanel;
      updatePathPanelVisibility();
      menuSelect.value = "";
    }
    if (menuSelect.value == "toggle-next") {
      showNextRound = !showNextRound;
      updateNextRoundButton(state);
      menuSelect.value = "";
    }
  });

  updatePathPanelVisibility();
  updateNextRoundButton(state);

};

const tick = () => {
  if (state.phase == "prep") {
    state.phaseTimer = Math.max(0, state.phaseTimer - TICK_RATE);
    if (state.phaseTimer <= 0) {
      buildSpawnQueue(state);
      state.phase = "wave";
      state.phaseTimer = 0;
    }
  }

  if (state.phase == "wave") {
    updateWaveState(state, runtime, TICK_RATE);
  }

  updateHud(state, runtime);
  renderActionTray(state, activeSelection, activeBuildSelection);

  if ((state.phase == "victory" || state.phase == "defeat") && !state.scoreSubmitted) {
    showEndModal(state);
    void submitScore(state);
  }
};

let lastTime = 0;
const animate = (timestamp: number) => {
  if (!lastTime) lastTime = timestamp;
  const elapsed = (timestamp - lastTime) / 1000;
  if (elapsed >= TICK_RATE) {
    tick();
    lastTime = timestamp;
  }
  render(runtime, state, activeSelection, timestamp / 1000);
  if (!hasRendered) {
    hasRendered = true;
    updateNextRoundButton(state);
  }
  window.requestAnimationFrame(animate);
};

const initGame = (seed: number) => {
  state = makeInitialState(seed);
  activeSelection = null;
  activeBuildSelection = { kind: "none" };
  runtime.structureByCell.clear();
  runtime.baseMap = createBaseMap();
  runtime.airPath = buildAirPath(runtime.baseMap);
  rebuildPath(runtime);
  updateMapMarkers(runtime);
  runtime.view.cameraTarget.set(runtime.baseMap.width / 2, 0, runtime.baseMap.height / 2);
  applyCameraZoom(runtime);
  updateBuildBar(state, activeBuildSelection);
  renderActionTray(state, null, activeBuildSelection);
  updateHud(state, runtime);
};

const loadDaily = async (): Promise<DailyResponse> => {
  const response = await fetch("/api/daily");
  if (!response.ok) {
    return { type: "daily", date: "unknown", seed: 1337 };
  }
  return (await response.json()) as DailyResponse;
};

const boot = async () => {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;

  runtime = createRuntime(canvas);
  resizeCanvas(runtime);
  window.addEventListener("resize", () => resizeCanvas(runtime));

  const daily = await loadDaily();
  initGame(daily.seed);

  setupInteraction();
  window.requestAnimationFrame(animate);
};

void boot();
