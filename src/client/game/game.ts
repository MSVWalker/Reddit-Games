import './game.css';
import './powerups.css';
import './scrape.css';
import './knife-selection.css';
import './airplane.css';
import './cat.css';

// Import airplane banner images explicitly so Vite bundles them
import banner1Ltr from './airplane_banner_1_ltr.png';
import banner1Rtl from './airplane_banner_1_rtl.png';
import banner2Ltr from './airplane_banner_2_ltr.png';
import banner2Rtl from './airplane_banner_2_rtl.png';
import banner3Ltr from './airplane_banner_3_ltr.png';
import banner3Rtl from './airplane_banner_3_rtl.png';
import banner4Ltr from './airplane_banner_4_ltr.png';
import banner4Rtl from './airplane_banner_4_rtl.png';
import banner6Ltr from './airplane_banner_6_ltr.png';
import banner6Rtl from './airplane_banner_6_rtl.png';
import banner8Ltr from './airplane_banner_8_ltr.png';
import banner8Rtl from './airplane_banner_8_rtl.png';
import banner9Ltr from './airplane_banner_9_ltr.png';
import banner9Rtl from './airplane_banner_9_rtl.png';
import banner10Ltr from './airplane_banner_10_ltr.png';
import banner10Rtl from './airplane_banner_10_rtl.png';

// Powerup Images
import powerupFreeze from './powerup_freeze.png';
import powerupRage from './powerup_rage.png';
import powerupSlam from './powerup_slam.png';

// Weapon Images
import knifeScythe from './knife_scythe.png';
import knifeKatana from './knife_katana.png';

// --------------------------------------
// Types
// --------------------------------------

type Lane = 0 | 1 | 2;

enum PowerupType {
  Ice = 'ice',
  Rage = 'rage',
  Slam = 'slam'
}

type GameMode = 'classic' | 'f1exican';

interface Chive {
  id: number;
  lane: Lane;
  y: number;
  element: HTMLElement;
  cut: boolean;
  type: 'normal' | 'powerup';
  powerupType?: PowerupType;
}

interface Projectile {
  id: number;
  lane: Lane;
  y: number;
  element: HTMLElement;
  knifeType: string;
  speed: number;
  hitboxSize: number;
}

interface GameModeConfig {
  maxMisses: number;    // -1 = unlimited
  maxMisclicks: number; // -1 = unlimited
}

interface KnifeConfig {
  emoji: string;
  name: string;
  unlockDay: number;
  speed: number;
  hitbox: number;
  cssClass: string;
  image?: string;
}

interface ScrapeKnifeState {
  element: HTMLElement;
  x: number;
  direction: 'left' | 'right';
  boardWidth: number;
  debrisContainer: HTMLElement | null;
}

interface State {
  score: number;
  highScore: number;
  streak: number;
  bestStreak: number;
  missed: number;
  misclickCount: number;
  activeMode: GameMode;
  isPlaying: boolean;
  isPaused: boolean;
  speed: number;
  spawnRate: number;
  spawnTimer: number;
  lastTime: number;
  day: number;
  dayTimer: number;
  totalCuts: number;
  totalPrecision: number;
  activePowerup: PowerupType | null;
  powerupTimer: number;
  timeScale: number;
  rageMode: boolean;
  gracePeriodTimer: number;
  scrapeTimer: number;
  scrapeDirection: 'left' | 'right';
  selectedKnife: string;
  unlockedKnives: string[];
  highestDay: number;
  startTime: number;
  combo: number;
  practiceDays: number;
  totalPrecisionPoints: number;
  scrapeSpawnTimer: number;
  nextScrapeDay: number;
}

// --------------------------------------
// Banner mapping
// --------------------------------------

const BANNER_IMAGES = [
  { ltr: banner1Ltr, rtl: banner1Rtl },   // Jet Fuel Can't Melt Chives
  { ltr: banner2Ltr, rtl: banner2Rtl },   // Forgive But Never Forget
  { ltr: banner9Ltr, rtl: banner9Rtl },   // WeHeartF1exican
  { ltr: banner10Ltr, rtl: banner10Rtl }, // SeeYouTomorrowChef
  { ltr: banner8Ltr, rtl: banner8Rtl },   // F1exican4President
  { ltr: banner6Ltr, rtl: banner6Rtl },   // OUI CHEF!
  { ltr: banner4Ltr, rtl: banner4Rtl },   // Stay Sharp!
  { ltr: banner3Ltr, rtl: banner3Rtl }    // Chive On!
];

// --------------------------------------
// DOM references
// --------------------------------------

const KEYS: Record<string, Lane> = {
  a: 0,
  s: 1,
  d: 2
};

const LANES = [
  document.getElementById('lane-0')!,
  document.getElementById('lane-1')!,
  document.getElementById('lane-2')!
];

const scoreEl = document.getElementById('score')!;
const comboEl = document.getElementById('combo')!;
const dayEl = document.getElementById('day')!;
const knifeEl = document.getElementById('knife')!;
const startBtn = document.getElementById('start-button')!;
const overlay = document.getElementById('controls-overlay')!;
const eggZone = document.getElementById('easter-egg-zone')!;
const particlesEl = document.getElementById('particles-container')!;
const gameContainer = document.querySelector('.game-container') as HTMLElement;
const stackEl = document.getElementById('chive-stack')!;
const projectileContainer = document.getElementById('projectile-container')!;

// --------------------------------------
// Difficulty / timing configuration
// --------------------------------------

const DIFFICULTY = {
  INITIAL_SPEED: 189,
  INITIAL_SPAWN_RATE: 1210,
  HIT_WINDOW: 88,
  MISS_LIMIT: 10,
  POWERUP_CHANCE: 0.135,
  POWERUP_DURATION: 3000,
  SCRAPE_INTERVAL: 30000,
  DAY_LENGTH: 12000
};

const HIT_WINDOW = DIFFICULTY.HIT_WINDOW;
const PERFECT_WINDOW = 15;
const GOOD_WINDOW = 35;

const GAME_MODES: Record<GameMode, GameModeConfig> = {
  classic: {
    maxMisses: 10,
    maxMisclicks: -1
  },
  f1exican: {
    maxMisses: 0,
    maxMisclicks: 0
  }
};

const KNIVES: Record<string, KnifeConfig> = {
  chef: {
    emoji: '🔪',
    name: "Chef's Knife",
    unlockDay: 0,
    speed: 1000,
    hitbox: 50,
    cssClass: 'knife-chef'
  },
  scissors: {
    emoji: '✂️',
    name: 'Scissors',
    unlockDay: 5,
    speed: 800,
    hitbox: 60,
    cssClass: 'knife-scissors'
  },
  cleaver: {
    emoji: '🪓',
    name: 'Cleaver',
    unlockDay: 10,
    speed: 600,
    hitbox: 70,
    cssClass: 'knife-cleaver'
  },
  scythe: {
    emoji: '⚔️',
    image: knifeScythe,
    name: 'Scythe',
    unlockDay: 15,
    speed: 2000,
    hitbox: 50,
    cssClass: 'knife-scythe'
  },
  katana: {
    emoji: '🗡️',
    image: knifeKatana,
    name: 'Katana',
    unlockDay: 20,
    speed: 1500,
    hitbox: 50,
    cssClass: 'knife-katana'
  }
};

// --------------------------------------
// Game state
// --------------------------------------

let chives: Chive[] = [];
let projectiles: Projectile[] = [];
let scrapeKnife: ScrapeKnifeState | null = null;
let nextId = 0;

const initialState: State = {
  score: 0,
  highScore: 0,
  streak: 0,
  bestStreak: 0,
  missed: 0,
  misclickCount: 0,
  activeMode: 'classic',
  isPlaying: false,
  isPaused: false,
  speed: DIFFICULTY.INITIAL_SPEED,
  spawnRate: DIFFICULTY.INITIAL_SPAWN_RATE,
  spawnTimer: 0,
  lastTime: 0,
  day: 1,
  dayTimer: 0,
  nextScrapeDay: 4,
  totalCuts: 0,
  totalPrecision: 0,
  activePowerup: null,
  powerupTimer: 0,
  timeScale: 1.0,
  rageMode: false,
  gracePeriodTimer: 0,
  scrapeTimer: 0,
  scrapeDirection: 'left',
  selectedKnife: 'chef',
  unlockedKnives: ['chef'],
  highestDay: 1,
  startTime: Date.now(),
  combo: 0,
  practiceDays: 1,
  totalPrecisionPoints: 0,
  scrapeSpawnTimer: 0
};

let state: State = { ...initialState };

// --------------------------------------
// Asset preloading
// --------------------------------------

function preloadImages() {
  const images = [
    powerupFreeze,
    powerupRage,
    powerupSlam,
    knifeScythe,
    knifeKatana,
    banner1Ltr,
    banner1Rtl,
    banner2Ltr,
    banner2Rtl,
    banner3Ltr,
    banner3Rtl,
    banner4Ltr,
    banner4Rtl,
    banner6Ltr,
    banner6Rtl,
    banner8Ltr,
    banner8Rtl,
    banner9Ltr,
    banner9Rtl,
    banner10Ltr,
    banner10Rtl
  ];

  images.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
  console.log('[Game] Preloading images...');
}

preloadImages();

// --------------------------------------
// FX Helpers
// --------------------------------------

function spawnParticles(x: number, y: number, color: string = '#fff') {
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = color;

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 100 + 50;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);

    particlesEl.appendChild(p);
    setTimeout(() => p.remove(), 500);
  }
}

function triggerShake() {
  gameContainer.classList.remove('shake');
  void (gameContainer as HTMLElement).offsetWidth; // reflow
  gameContainer.classList.add('shake');
}

function addToStack() {
  const piece = document.createElement('div');
  piece.className = 'stack-piece';

  const x = Math.random() * 100;
  const y = Math.random() * 100;
  const rotation = Math.random() * 360;
  const scale = 0.8 + Math.random() * 0.4;

  piece.style.position = 'absolute';
  piece.style.left = `${x}%`;
  piece.style.top = `${y}%`;
  piece.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
  piece.style.opacity = '0.8';

  stackEl.appendChild(piece);

  if (stackEl.children.length > 100) {
    stackEl.removeChild(stackEl.firstElementChild!);
  }
}

// --------------------------------------
// Spawn patterns
// --------------------------------------

function spawnChiveAt(lane: Lane) {
  const laneEl = LANES[lane];
  if (!laneEl) return;

  const el = document.createElement('div');
  el.className = 'chive';
  laneEl.appendChild(el);

  chives.push({
    id: nextId++,
    lane,
    y: -50,
    element: el,
    cut: false,
    type: 'normal'
  });
}

function spawnChive() {
  const lane = Math.floor(Math.random() * 3) as Lane;
  spawnChiveAt(lane);
}

function spawnStairs() {
  let delay = 0;
  [0, 1, 2].forEach((laneIndex) => {
    setTimeout(() => spawnChiveAt(laneIndex as Lane), delay);
    delay += 250;
  });
}

function spawnDoubles() {
  spawnChiveAt(0);
  spawnChiveAt(1);
  setTimeout(() => {
    spawnChiveAt(1);
    spawnChiveAt(2);
  }, 200);
}

function spawnJackhammer() {
  let count = 0;
  const lane = Math.floor(Math.random() * 3) as Lane;
  const interval = setInterval(() => {
    spawnChiveAt(lane);
    count++;
    if (count >= 3) clearInterval(interval);
  }, 120);
}

function spawnRapidFire() {
  let count = 0;
  const interval = setInterval(() => {
    spawnChive();
    count++;
    if (count >= 3) clearInterval(interval);
  }, 150);
}

function spawnPowerup(type: PowerupType) {
  console.log('Spawning Powerup:', type);
  const lane = Math.floor(Math.random() * 3) as Lane;
  const laneEl = LANES[lane];
  if (!laneEl) return;

  const el = document.createElement('div');
  el.className = `chive powerup-${type}`;
  laneEl.appendChild(el);

  chives.push({
    id: nextId++,
    lane,
    y: -50,
    element: el,
    cut: false,
    type: 'powerup',
    powerupType: type
  });
}

function spawnEasterEgg() {
  // Disabled
  return;
}

// --------------------------------------
// Powerups
// --------------------------------------

function activatePowerup(type: PowerupType) {
  state.activePowerup = type;
  state.powerupTimer = DIFFICULTY.POWERUP_DURATION;

  if (type === PowerupType.Ice) {
    state.timeScale = 0.3;
  } else if (type === PowerupType.Rage) {
    state.rageMode = true;
  } else if (type === PowerupType.Slam) {
    state.powerupTimer = 1000;
    triggerSlam();
  }
}

function deactivatePowerup() {
  const wasRageMode = state.rageMode;

  state.activePowerup = null;
  state.timeScale = 1.0;
  state.rageMode = false;

  if (wasRageMode && state.activeMode === 'f1exican') {
    state.gracePeriodTimer = 3000;
    console.log('[F1exican] Grace period started: 3s');
  }
}

function triggerSlam() {
  gameContainer.classList.add('slam-effect');
  setTimeout(() => gameContainer.classList.remove('slam-effect'), 500);

  for (let i = chives.length - 1; i >= 0; i--) {
    const c = chives[i];
    if (!c || c.cut) continue;

    c.cut = true;
    c.element.classList.add('cut');

    const rect = c.element.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, '#f1c40f');

    setTimeout(() => {
      if (c.element.parentNode) {
        c.element.remove();
      }
    }, 100);
  }

  chives = [];

  state.score += 10;
  scoreEl.textContent = state.score.toString();
}

// --------------------------------------
// Knives / selection
// --------------------------------------

function buildKnifeSelectionUI(): string {
  if (state.day > state.highestDay) {
    state.highestDay = state.day;
    Object.entries(KNIVES).forEach(([id, knife]) => {
      if (knife.unlockDay <= state.highestDay && !state.unlockedKnives.includes(id)) {
        state.unlockedKnives.push(id);
      }
    });
  }

  let html =
    '<div class="knife-selection"><h2>Choose Your Weapon</h2><div class="knife-rack">';

  Object.entries(KNIVES).forEach(([id, knife]) => {
    const isUnlocked = state.unlockedKnives.includes(id);
    const isSelected = state.selectedKnife === id;
    const unlockText = knife.unlockDay === 0 ? 'Default' : `Day ${knife.unlockDay}`;

    html += `
      <div class="knife-option ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''
      }" data-knife="${id}">
        <div class="knife-icon" style="${knife.image
        ? `background-image: url(${knife.image}); background-size: contain; background-repeat: no-repeat; background-position: center; color: transparent;`
        : ''
      }">${knife.emoji}</div>
        <div class="knife-label">
          <span class="knife-name">${knife.name}</span>
          <span class="knife-unlock">${isUnlocked ? unlockText : `🔒 ${unlockText}`
      }</span>
        </div>
      </div>
    `;
  });

  html += '</div></div>';
  return html;
}

function setupKnifeSelection() {
  const knives = document.querySelectorAll('.knife-option');
  knives.forEach((knife) => {
    knife.addEventListener('click', () => {
      if (!knife.classList.contains('locked')) {
        const knifeId = (knife as HTMLElement).dataset.knife!;
        state.selectedKnife = knifeId;

        knives.forEach((k) => k.classList.remove('selected'));
        knife.classList.add('selected');

        updateKnifeVisual();

        try {
          localStorage.setItem('selectedKnife', knifeId);
          localStorage.setItem('unlockedKnives', JSON.stringify(state.unlockedKnives));
          localStorage.setItem('highestDay', state.highestDay.toString());
        } catch (e) {
          console.error('Failed to save knife selection:', e);
        }
      }
    });
  });
}

function updateKnifeVisual() {
  const knife = KNIVES[state.selectedKnife];
  if (!knife) return;

  if (knife.image) {
    knifeEl.textContent = '';
    knifeEl.style.backgroundImage = `url(${knife.image})`;
    knifeEl.style.backgroundSize = 'contain';
    knifeEl.style.backgroundRepeat = 'no-repeat';
    knifeEl.style.backgroundPosition = 'center';
    knifeEl.style.width = '85px';
    knifeEl.style.height = '85px';
  } else {
    knifeEl.style.backgroundImage = 'none';
    knifeEl.textContent = knife.emoji;
    knifeEl.style.fontSize = '5rem';
    knifeEl.style.width = '';
    knifeEl.style.height = '';
  }
}

function loadKnifePreferences() {
  try {
    const savedKnife = localStorage.getItem('selectedKnife');
    const savedUnlocked = localStorage.getItem('unlockedKnives');
    const savedHighestDay = localStorage.getItem('highestDay');

    if (savedKnife && KNIVES[savedKnife]) {
      state.selectedKnife = savedKnife;
    }
    if (savedUnlocked) {
      state.unlockedKnives = JSON.parse(savedUnlocked);
    }
    if (savedHighestDay) {
      state.highestDay = parseInt(savedHighestDay);
    }

    updateKnifeVisual();
  } catch (e) {
    console.error('Failed to load knife preferences:', e);
  }
}

// --------------------------------------
// Scrape mechanic
// --------------------------------------

function showScrapeWarning() {
  console.log('[Scrape] Warning shown');
  const warning = document.createElement('div');
  warning.id = 'scrape-warning';
  warning.className = 'scrape-warning';
  warning.textContent = '▶ SCRAPE!';
  warning.style.left = '10%';
  warning.style.right = 'auto';
  gameContainer.appendChild(warning);

  setTimeout(() => warning.remove(), 2000);
}

function spawnScrapeKnife() {
  console.log('[Scrape] Spawning knife!');
  if (scrapeKnife) scrapeKnife.element.remove();

  const el = document.createElement('div');
  el.className = 'scrape-knife';
  document.body.appendChild(el);

  const cuttingBoard = document.getElementById('cutting-board-container');
  let boardWidth = 500;

  if (cuttingBoard) {
    const rect = cuttingBoard.getBoundingClientRect();
    boardWidth = rect.width;

    el.style.position = 'fixed';
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.height = `${rect.height}px`;
    el.style.zIndex = '99999';
  } else {
    el.style.position = 'fixed';
    el.style.top = '100px';
    el.style.left = '0px';
    el.style.height = '500px';
    el.style.zIndex = '99999';
  }

  const startX = 0;

  let debrisContainer: HTMLElement | null = null;
  if (stackEl && stackEl.children.length > 0) {
    debrisContainer = document.createElement('div');
    debrisContainer.className = 'debris-push-container';
    debrisContainer.style.position = 'absolute';
    debrisContainer.style.top = '0';
    debrisContainer.style.left = '0';
    debrisContainer.style.width = '100%';
    debrisContainer.style.height = '100%';
    debrisContainer.style.pointerEvents = 'none';

    while (stackEl.firstChild) {
      debrisContainer.appendChild(stackEl.firstChild);
    }

    stackEl.appendChild(debrisContainer);
  }

  scrapeKnife = {
    element: el,
    x: startX,
    direction: 'left',
    boardWidth,
    debrisContainer
  };

  el.style.transform = `translateX(${startX}px)`;

  console.log('[Scrape] Element in DOM:', document.body.contains(el));
  console.log('[Scrape] Element position:', el.getBoundingClientRect());
}

function updateScrape(dt: number) {
  if (!scrapeKnife) return;

  try {
    const speed = 0.6875;

    scrapeKnife.x += speed * dt;
    scrapeKnife.element.style.transform = `translateX(${scrapeKnife.x}px)`;

    const boardWidth = scrapeKnife.boardWidth;

    if (scrapeKnife.debrisContainer) {
      if (scrapeKnife.x > 0 && scrapeKnife.x < boardWidth) {
        scrapeKnife.debrisContainer.style.transform = `translateX(${scrapeKnife.x}px)`;
      }
    }

    const knifeWidth = 50;
    const knifeX = scrapeKnife.x;

    for (let i = chives.length - 1; i >= 0; i--) {
      const chive = chives[i];
      if (!chive) continue;

      const laneWidth = boardWidth / 3;
      const chiveX = chive.lane * laneWidth + laneWidth / 2;

      if (knifeX > chiveX && knifeX < chiveX + knifeWidth) {
        chive.element.remove();
        chives.splice(i, 1);

        const rect = chive.element.getBoundingClientRect();
        spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, '#2ecc71');
      }
    }

    if (scrapeKnife.x > boardWidth + 100) {
      console.log('[Scrape] Knife finished.');

      if (scrapeKnife.debrisContainer) {
        scrapeKnife.debrisContainer.remove();
      }

      scrapeKnife.element.remove();
      scrapeKnife = null;
    }
  } catch (e) {
    console.error('Scrape error:', e);
    if (scrapeKnife?.element) scrapeKnife.element.remove();
    if (scrapeKnife?.debrisContainer) scrapeKnife.debrisContainer.remove();
    scrapeKnife = null;
  }
}

// --------------------------------------
// Game logic / scoring
// --------------------------------------

function checkGameOverConditions(): boolean {
  const config = GAME_MODES[state.activeMode];

  if (state.gracePeriodTimer > 0) {
    return false;
  }

  if (config.maxMisses >= 0 && state.missed >= config.maxMisses) {
    console.log(`[Mode] Game over: missed ${state.missed} (limit: ${config.maxMisses})`);
    return true;
  }

  if (config.maxMisclicks >= 0 && state.misclickCount >= config.maxMisclicks) {
    console.log(
      `[Mode] Game over: misclicked ${state.misclickCount} (limit: ${config.maxMisclicks})`
    );
    return true;
  }

  return false;
}

function addScore() {
  state.score++;
  state.combo++;
  scoreEl.textContent = state.score.toString();
  comboEl.textContent = state.combo.toString();
}

function resetCombo() {
  state.combo = 0;
  comboEl.textContent = '0';
  document.body.style.backgroundColor = '#500';
  setTimeout(() => {
    document.body.style.backgroundColor = '#000';
  }, 100);
}

function nextDay() {
  state.day++;
  dayEl.textContent = `DAY ${state.day}`;
  console.log(`[DEBUG] nextDay() called: newDay=${state.day}`);

  const transitionOverlay = document.getElementById('day-transition-overlay')!;
  const transitionText = document.getElementById('transition-day-text')!;

  transitionText.textContent = `DAY ${state.day}`;
  transitionOverlay.classList.remove('hidden');

  setTimeout(() => {
    transitionOverlay.classList.add('hidden');

    const pixelCat = document.getElementById('pixel-cat');
    if (pixelCat && state.day >= 5) {
      pixelCat.style.display = 'block';
    }
  }, 2500);

  let speedIncrease = 27;
  let spawnDecrease = 45;

  if (state.day > 16) {
    speedIncrease = 8;
    spawnDecrease = 12;
  } else if (state.day > 10) {
    speedIncrease = 15;
    spawnDecrease = 25;
  }

  state.speed += speedIncrease;
  state.spawnRate = Math.max(200, state.spawnRate - spawnDecrease);

  if (state.day === 45) {
    console.log('DAY 45: F1EXIGEN MODE ACTIVATED! GOOD LUCK CHEF!');
    state.speed = 750;
    state.spawnRate = 100;
  }

  state.spawnTimer = -1000;

  const shouldScrape = state.day >= 4 && (state.day - 4) % 3 === 0;
  if (shouldScrape) {
    console.log(`[DEBUG] TRIGGERING SCRAPE at day ${state.day}`);
    showScrapeWarning();
    state.scrapeSpawnTimer = 2000;
  }
}

function cut(lane: Lane) {
  if (!state.isPlaying) return;

  knifeEl.style.transform = `translateX(${(lane - 1) * 100}px) rotate(-45deg)`;
  setTimeout(() => {
    knifeEl.style.transform = `translateX(${(lane - 1) * 100}px) rotate(0deg)`;
  }, 50);

  // Rage mode: projectile knives
  if (state.rageMode) {
    const firstLane = LANES[0];
    if (!firstLane) return;
    const boardHeight = firstLane.clientHeight;
    const startY = boardHeight - 50;

    const laneEl = LANES[lane];
    if (!laneEl) return;

    const knife = KNIVES[state.selectedKnife];
    if (!knife) return;

    const el = document.createElement('div');
    el.className = `projectile-knife ${knife.cssClass}`;

    if (knife.image) {
      el.style.backgroundImage = `url(${knife.image})`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
    } else {
      el.textContent = knife.emoji;
    }

    el.style.top = `${startY}px`;
    const leftPercent = lane * 33.33 + 16.66;
    el.style.left = `${leftPercent}%`;

    projectileContainer.appendChild(el);

    projectiles.push({
      id: nextId++,
      lane,
      y: startY,
      element: el,
      knifeType: state.selectedKnife,
      speed: knife.speed,
      hitboxSize: knife.hitbox
    });
    return;
  }

  // Normal mode
  const firstLane = LANES[0];
  if (!firstLane) return;
  const boardHeight = firstLane.clientHeight;
  const cutY = boardHeight - 80;

  const target = chives.find(
    (c) => c.lane === lane && !c.cut && Math.abs(c.y - cutY) < HIT_WINDOW
  );

  if (target) {
    target.cut = true;
    target.element.classList.add('cut');

    if (target.type === 'powerup' && target.powerupType) {
      activatePowerup(target.powerupType);
    }

    const distance = Math.abs(target.y - cutY);
    let precision = 0;
    let feedback = '';
    let color = '#fff';

    if (distance < PERFECT_WINDOW) {
      precision = 100;
      feedback = 'PERFECT';
      color = '#f1c40f';
    } else if (distance < GOOD_WINDOW) {
      precision = 75;
      feedback = 'GOOD';
      color = '#2ecc71';
    } else {
      precision = 50;
      feedback = 'OK';
      color = '#95a5a6';
    }

    state.totalPrecisionPoints += precision;
    state.totalCuts++;

    const feedbackEl = document.createElement('div');
    feedbackEl.textContent = feedback;
    feedbackEl.className = 'cut-feedback';
    feedbackEl.style.position = 'absolute';
    feedbackEl.style.left = `${lane * 33.33 + 16.66}%`;
    feedbackEl.style.top = `${cutY - 50}px`;
    feedbackEl.style.color = color;
    feedbackEl.style.fontWeight = 'bold';
    feedbackEl.style.fontSize = '1.5rem';
    feedbackEl.style.textShadow = '0 0 5px rgba(0,0,0,0.5)';
    feedbackEl.style.pointerEvents = 'none';
    feedbackEl.style.animation = 'floatUp 0.8s ease-out forwards';
    gameContainer.appendChild(feedbackEl);

    setTimeout(() => feedbackEl.remove(), 800);

    const rect = target.element.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, color);

    setTimeout(() => {
      target.element.remove();
      chives = chives.filter((c) => c.id !== target.id);
    }, 100);

    addToStack();
    addScore();
  } else {
    state.misclickCount++;
    console.log(`[Mode] Misclick #${state.misclickCount}`);

    if (checkGameOverConditions()) {
      gameOver();
    }
  }
}

// --------------------------------------
// Game loop
// --------------------------------------

function update(time: number) {
  if (!state.isPlaying) return;

  const dt = time - state.lastTime;
  state.lastTime = time;

  // Airplane banner
  const airplane = document.getElementById('airplane');
  if (airplane) {
    const elapsed = (Date.now() - state.startTime) / 1000;

    const cycleDuration = 25;
    const timeInCycle = elapsed % cycleDuration;
    const cycleCount = Math.floor(elapsed / cycleDuration);
    const bannerIndex = cycleCount % BANNER_IMAGES.length;

    airplane.classList.remove('fly-ltr', 'fly-rtl');
    airplane.style.display = 'none';

    let direction: 'ltr' | 'rtl' | null = null;

    if (timeInCycle >= 5 && timeInCycle < 12) {
      direction = 'ltr';
      airplane.classList.add('fly-ltr');
      airplane.style.display = 'block';

      if (Math.floor(timeInCycle * 10) === 50) {
        const randomTop = 5 + Math.random() * 20;
        airplane.style.top = `${randomTop}%`;
      }
    } else if (timeInCycle >= 14 && timeInCycle < 18) {
      direction = 'rtl';
      airplane.classList.add('fly-rtl');
      airplane.style.display = 'block';

      if (Math.floor(timeInCycle * 10) === 140) {
        const randomTop = 5 + Math.random() * 20;
        airplane.style.top = `${randomTop}%`;
      }
    }

    if (direction) {
      const bannerSet = BANNER_IMAGES[bannerIndex];
      if (bannerSet) {
        const bannerUrl = bannerSet[direction];
        airplane.style.backgroundImage = `url("${bannerUrl}")`;
      }
    }
  } else {
    console.error('[Airplane] Element not found!');
  }

  // Day progression
  state.dayTimer += dt * state.timeScale;
  if (state.dayTimer >= DIFFICULTY.DAY_LENGTH) {
    nextDay();
    state.dayTimer = 0;
  }

  // Powerup timers
  if (state.activePowerup) {
    state.powerupTimer -= dt;
    if (state.powerupTimer <= 0) {
      deactivatePowerup();
    }
  }

  if (state.gracePeriodTimer > 0) {
    state.gracePeriodTimer -= dt;
    if (state.gracePeriodTimer <= 0) {
      state.gracePeriodTimer = 0;
      console.log('[F1exican] Grace period ended');
    }
  }

  // Spawn logic
  state.spawnTimer += dt * state.timeScale;

  if (state.spawnTimer > state.spawnRate) {
    const rand = Math.random();
    if (rand < DIFFICULTY.POWERUP_CHANCE && state.day > 1) {
      const pRand = Math.random();
      if (pRand < 0.33) spawnPowerup(PowerupType.Ice);
      else if (pRand < 0.66) spawnPowerup(PowerupType.Rage);
      else spawnPowerup(PowerupType.Slam);
    } else if (rand < 0.15) {
      spawnStairs();
    } else if (rand < 0.2) {
      spawnDoubles();
    } else if (rand < 0.3) {
      spawnJackhammer();
    } else if (rand < 0.5) {
      spawnRapidFire();
    } else {
      spawnChive();
    }

    state.spawnTimer = 0;
    if (Math.random() < 0.15) spawnEasterEgg();
  }

  updateScrape(dt);

  if (state.scrapeSpawnTimer > 0) {
    state.scrapeSpawnTimer -= dt;
    if (state.scrapeSpawnTimer <= 0) {
      spawnScrapeKnife();
      state.scrapeSpawnTimer = 0;
    }
  }

  const firstLane = LANES[0];
  if (!firstLane) return;
  const boardHeight = firstLane.clientHeight;

  // Move chives
  for (let i = chives.length - 1; i >= 0; i--) {
    const chive = chives[i];
    if (!chive) continue;

    if (chive.cut) {
      if (chive.element.parentNode) {
        chive.element.remove();
      }
      chives.splice(i, 1);
      continue;
    }

    chive.y += (state.speed * dt * state.timeScale) / 1000;
    chive.element.style.top = `${chive.y}px`;

    if (chive.y > boardHeight) {
      chive.element.remove();
      chives.splice(i, 1);

      if (!state.rageMode) {
        resetCombo();
        triggerShake();
        state.missed++;

        if (checkGameOverConditions()) {
          gameOver();
        }
      }
    }
  }

  // Move projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (!proj) continue;

    proj.y -= (proj.speed * dt) / 1000;
    proj.element.style.top = `${proj.y}px`;

    let hit = false;
    for (const chive of chives) {
      if (chive.lane === proj.lane && !chive.cut) {
        if (Math.abs(chive.y - proj.y) < proj.hitboxSize) {
          chive.cut = true;
          chive.element.classList.add('cut');
          state.totalCuts++;

          const rect = chive.element.getBoundingClientRect();
          spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, '#e74c3c');

          if (proj.knifeType === 'cleaver') {
            triggerShake();
          }

          setTimeout(() => {
            chive.element.remove();
            chives = chives.filter((c) => c.id !== chive.id);
          }, 100);

          addToStack();
          addScore();

          hit = true;
          break;
        }
      }
    }

    if (hit) {
      proj.element.remove();
      projectiles.splice(i, 1);
      continue;
    }

    if (proj.y < -100) {
      proj.element.remove();
      projectiles.splice(i, 1);
    }
  }

  requestAnimationFrame(update);
}

// --------------------------------------
// Game over / overlay
// --------------------------------------

async function gameOver() {
  state.isPlaying = false;

  let scoreData: any = null;
  try {
    const res = await fetch('/api/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: state.score, day: state.day, mode: state.activeMode })
    });
    if (res.ok) {
      scoreData = await res.json();
    }
  } catch (error) {
    console.error('Score submission failed:', error);
  }

  overlay.classList.remove('hidden');
  overlay.scrollTop = 0;

  const bestScore = scoreData?.personalBest?.score ?? state.score;
  const userRank = scoreData?.rank || '?';
  const dailyStreak = scoreData?.streak ?? 0;

  const flavorTexts = [
    'See you tomorrow, chef.',
    "Chive shift's over. Same time tomorrow, chef?",
    'Clock out, chef. Chives resume tomorrow.',
    'Prep\'s done for the day. Back on the board tomorrow, chef.'
  ];
  const randomText = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];

  overlay.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0 20px; box-sizing: border-box;">
      <div style="width: 100%; max-width: 500px; display: flex; flex-direction: column; align-items: center;">
        <h1 style="text-align: center; margin-bottom: 10px; width: 100%;">GAME OVER</h1>
        
        <div style="display: flex; justify-content: center; margin: 10px 0; width: 100%;">
          <div class="game-over-chef">
            <div class="hat"></div>
            <div class="head"></div>
            <div class="body"></div>
            <div class="legs"></div>
          </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 20px; width: 100%;">
          <div style="color: #2ecc71; font-size: 1.1rem; font-style: italic; margin-bottom: 15px;">
            ${randomText}
          </div>
          
          <div style="color: #aaa; font-size: 0.95rem; line-height: 1.6; display: inline-block; text-align: center;">
            <div><strong style="color: #fff;">Day Reached:</strong> ${state.day}</div>
            <div><strong style="color: #fff;">Chives Cut:</strong> ${state.score}</div>
            <div><strong style="color: #fff;">Best Score:</strong> ${bestScore} <span style="font-size: 0.8rem;">(Rank ${userRank})</span></div>
          </div>
          
          <div style="color: #e74c3c; font-size: 0.9rem; margin-top: 12px; font-weight: bold; white-space: nowrap; text-align: center;">
            🔥 Daily Streak: <span style="color: #f39c12;">${dailyStreak} Day${dailyStreak === 1 ? '' : 's'
    }</span> 🔥
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; width: 100%; max-width: 320px; margin: 10px auto 30px auto; box-sizing: border-box; padding: 0;">
          
          <!-- Classic Button -->
          <button class="mode-toggle-btn ${state.activeMode === 'classic' ? 'active' : ''}" data-mode="classic" style="grid-column: 1; width: 100% !important; font-size: 0.75rem !important; padding: 0 !important; height: 28px !important; display: flex; align-items: center; justify-content: center; border-width: 1px !important; margin: 0 !important; box-sizing: border-box; min-width: 0;">
            Classic
          </button>

          <!-- F1exican Button -->
          <button class="mode-toggle-btn ${state.activeMode === 'f1exican' ? 'active' : ''}" data-mode="f1exican" style="grid-column: 2; width: 100% !important; font-size: 0.75rem !important; padding: 0 !important; height: 28px !important; display: flex; align-items: center; justify-content: center; border-width: 1px !important; margin: 0 !important; box-sizing: border-box; min-width: 0;">
            F1exican
          </button>

          <!-- Try Again Button (Spans full width) -->
          <button id="restart-button" class="main-cta-btn" style="grid-column: 1 / -1; width: 100% !important; max-width: none !important; margin: 0 !important; box-sizing: border-box;">TRY AGAIN</button>
        </div>
      </div>
    </div>
    
    ${buildKnifeSelectionUI()}
    
    <div class="leaderboard-section">
      <div class="leaderboard-banner">LEADERBOARDS</div>
      
      <div class="lb-table-grid">
        <div class="lb-table-headers">
          <div class="lb-table-header">DAILY HIGH</div>
          <div class="lb-table-header">ALL TIME</div>
          <div class="lb-table-header">DAILY STREAK</div>
        </div>

        <div class="lb-table-row">
          <button class="lb-table-btn active" data-cat="daily" data-mode="classic">Classic</button>
          <button class="lb-table-btn" data-cat="score" data-mode="classic">Classic</button>
          <button class="lb-table-btn" data-cat="streak" data-mode="classic">Classic</button>
        </div>

        <div class="lb-table-row">
          <button class="lb-table-btn" data-cat="daily" data-mode="f1exican">F1exican</button>
          <button class="lb-table-btn" data-cat="score" data-mode="f1exican">F1exican</button>
          <button class="lb-table-btn" data-cat="streak" data-mode="f1exican">F1exican</button>
        </div>
      </div>
      
      <div id="lb-explanation" style="color: #666; font-size: 0.75rem; margin-bottom: 10px; font-style: italic; text-align: center;">
        Today's Best Runs
      </div>
      
      <div id="leaderboard-container" style="max-height: 400px; overflow-y: auto; min-height: 100px;">
        <div style="color: #aaa; padding: 20px; text-align: center;">Loading...</div>
      </div>
    </div>
  `;

  setupKnifeSelection();
  setupModeToggle();
  document.getElementById('restart-button')?.addEventListener('click', startGame);

  let activeCategory: 'daily' | 'score' | 'streak' = 'daily';
  let activeMode: GameMode = 'classic';

  const updateLeaderboardView = async () => {
    const container = document.getElementById('leaderboard-container');
    const explanation = document.getElementById('lb-explanation');
    if (!container || !explanation) return;

    document.querySelectorAll('.lb-table-btn').forEach((btn) => {
      const btnCat = btn.getAttribute('data-cat');
      const btnMode = btn.getAttribute('data-mode');
      const isActive = btnCat === activeCategory && btnMode === activeMode;
      btn.classList.toggle('active', isActive);
    });

    const explanations: Record<typeof activeCategory, string> = {
      daily: "Today's Best Runs",
      score: 'All Time High Scores',
      streak: 'Longest Daily Play Streaks (Global)'
    };
    explanation.textContent = explanations[activeCategory];

    container.innerHTML =
      '<div style="color: #aaa; padding: 20px; text-align: center;">Loading...</div>';

    try {
      const res = await fetch(
        `/api/leaderboard?sortBy=${activeCategory}&mode=${activeMode}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      if (!data.entries || data.entries.length === 0) {
        container.innerHTML =
          '<div style="color: #666; padding: 20px; text-align: center; font-style: italic;">No entries yet</div>';
        return;
      }

      let html = '<div class="leaderboard"><table class="lb-table">';
      if (activeCategory === 'streak') {
        html += '<tr><th>#</th><th>Chef</th><th>Streak</th><th>Best Score</th></tr>';
      } else {
        html += '<tr><th>#</th><th>Chef</th><th>Score</th><th>Day</th></tr>';
      }

      data.entries.forEach((entry: any) => {
        html += `<tr>
          <td>#${entry.rank}</td>
          <td><a href="https://www.reddit.com/user/${entry.username}" target="_blank" style="color: inherit; text-decoration: none;">${entry.username}</a></td>
          ${activeCategory === 'streak'
            ? `<td>${entry.streak} 🔥</td><td>${entry.score}</td>`
            : `<td>${entry.score}</td><td>Day ${entry.day}</td>`
          }
        </tr>`;
      });
      html += '</table></div>';
      container.innerHTML = html;
    } catch (error) {
      console.error('Leaderboard fetch failed:', error);
      container.innerHTML =
        '<div style="color: #e74c3c; padding: 20px; text-align: center;">Failed to load leaderboard</div>';
    }
  };

  document.querySelectorAll('.lb-table-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const cat = target.getAttribute('data-cat');
      const mode = target.getAttribute('data-mode') as GameMode | null;

      if (cat && mode) {
        activeCategory = cat as any;
        activeMode = mode;
        updateLeaderboardView();
      }
    });
  });

  updateLeaderboardView();
}

// --------------------------------------
// Start game / splash
// --------------------------------------

async function startGame() {
  try {
    const response = await fetch('/api/personal-best');
    const data = await response.json();
    if (data.personalBest) {
      state.practiceDays = data.personalBest.practiceDays;
      state.streak = data.personalBest.streak;
    }
  } catch (error) {
    console.error('Failed to load personal best:', error);
  }

  const savedMode = (localStorage.getItem('gameMode') as GameMode) || 'classic';
  state.activeMode = savedMode;
  console.log(`[Mode] Starting game in ${savedMode} mode`);

  state.score = 0;
  state.combo = 0;
  state.day = 1;
  state.missed = 0;
  state.misclickCount = 0;
  state.speed = 235;
  state.spawnRate = 950;
  state.isPlaying = true;
  state.lastTime = performance.now();
  state.spawnTimer = 0;
  state.dayTimer = 0;
  state.totalPrecisionPoints = 0;
  state.totalCuts = 0;
  state.scrapeTimer = 0;
  state.scrapeDirection = 'left';
  state.activePowerup = null;
  state.powerupTimer = 0;
  state.timeScale = 1.0;
  state.rageMode = false;
  state.startTime = Date.now();

  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  dayEl.textContent = '1';

  chives.forEach((c) => c.element.remove());
  chives = [];
  projectiles = [];
  stackEl.innerHTML = '';
  projectileContainer.innerHTML = '';

  let pixelCat = document.getElementById('pixel-cat');
  if (!pixelCat) {
    pixelCat = document.createElement('div');
    pixelCat.id = 'pixel-cat';
    pixelCat.className = 'pixel-cat';
    pixelCat.innerHTML = `
      <div class="cat-ears"></div>
      <div class="cat-head"></div>
      <div class="cat-eyes"></div>
      <div class="cat-nose"></div>
      <div class="cat-body"></div>
      <div class="cat-legs"></div>
    `;
    gameContainer.appendChild(pixelCat);
  }
  pixelCat.style.display = state.day >= 5 ? 'block' : 'none';

  gameContainer.style.setProperty('--img-freeze', `url(${powerupFreeze})`);
  gameContainer.style.setProperty('--img-rage', `url(${powerupRage})`);
  gameContainer.style.setProperty('--img-slam', `url(${powerupSlam})`);

  overlay.classList.add('hidden');

  loadKnifePreferences();

  overlay.innerHTML = `
    <div class="splash-container">
      <h1 class="splash-title">Chive Cutter</h1>
      <p class="splash-subtitle">Hit the correct key when the chive lands on the cut line</p>
      
      <p style="text-align: center; font-size: 0.9rem; margin-top: 10px; color: #ddd; font-family: 'Segoe UI', sans-serif;">
        Press <span class="keycap">A</span> <span class="keycap">S</span> <span class="keycap">D</span> or tap lanes
      </p>
      
      <div class="splash-grid">
        <button class="mode-toggle-btn splash-mode-btn ${state.activeMode === 'classic' ? 'active' : ''}" data-mode="classic" style="width: 100% !important; margin: 0 !important; box-sizing: border-box;">Classic</button>
        <button class="mode-toggle-btn splash-mode-btn ${state.activeMode === 'f1exican' ? 'active' : ''}" data-mode="f1exican" style="width: 100% !important; margin: 0 !important; box-sizing: border-box;">F1exican</button>
        <button id="start-button" class="main-cta-btn splash-start-btn" style="grid-column: 1 / -1; width: 100% !important; max-width: none !important; margin: 0 !important; box-sizing: border-box;">START DAY ${state.practiceDays}</button>
      </div>
      
      ${state.streak > 1
      ? `<div class="splash-streak">🔥 ${state.streak} Day Streak! 🔥</div>`
      : ''
    }
    </div>
    
    <p class="splash-flavor-text">Cutting a couple of chives every day until r/KitchenConfidential says they're perfect.</p>
    
    <div class="splash-footer">
      An unofficial mini-game for r/KitchenConfidential
    </div>
  `;

  setupModeToggle();
  document.getElementById('start-button')?.addEventListener('click', startGame);

  requestAnimationFrame(update);
}

// --------------------------------------
// Splash streak
// --------------------------------------

async function fetchSplashStreak() {
  try {
    const response = await fetch('/api/personal-best');
    const data = await response.json();
    const streak = data.personalBest?.streak ?? 0;
    const streakText = document.getElementById('splash-streak-text');
    if (streakText) {
      if (streak > 0) {
        streakText.textContent = `${streak} Day Streak!`;
      } else {
        streakText.textContent = '';
        streakText.parentElement?.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Failed to fetch streak:', error);
    const streakText = document.getElementById('splash-streak-text');
    if (streakText) {
      streakText.textContent = '';
    }
  }
}

// --------------------------------------
// Mode toggle setup
// --------------------------------------

function setupModeToggle() {
  const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-toggle-btn');

  const savedMode = (localStorage.getItem('gameMode') as GameMode) || 'classic';

  modeButtons.forEach((btn) => {
    const btnMode = btn.dataset.mode as GameMode | undefined;
    if (btnMode === savedMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.mode as GameMode | undefined;
      if (mode) {
        localStorage.setItem('gameMode', mode);
        console.log(`[Mode] Selected: ${mode}`);
      }
    });
  });
}

// --------------------------------------
// Input listeners
// --------------------------------------

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (KEYS[key] !== undefined) {
    cut(KEYS[key]);
  }
});

// Admin stats viewer (Cmd+Shift+A on Mac, Ctrl+Shift+A on PC)
document.addEventListener('keydown', async (e) => {
  const isModifierPressed = e.metaKey || e.ctrlKey;

  if (isModifierPressed && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    console.log('[Admin] Fetching stats...');

    try {
      const response = await fetch('/api/admin-stats');
      const data = await response.json();

      if (response.ok) {
        console.log('='.repeat(50));
        console.log('📊 ADMIN STATS');
        console.log('='.repeat(50));
        console.log(JSON.stringify(data, null, 2));
        console.log('='.repeat(50));
        alert('✅ Admin stats loaded!\n\nCheck the browser console (F12) to view the data.');
      } else {
        console.error('[Admin] Error:', data);
        const errorMsg = `❌ Error: ${data.message}\n\n${data.debug || ''}`;
        alert(errorMsg);
      }
    } catch (error) {
      console.error('Admin fetch failed:', error);
      alert('❌ Failed to fetch admin stats.\nCheck console for details.');
    }
  }
});

// Mobile controls
document.querySelectorAll('.mobile-btn').forEach((btn) => {
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const key = (e.target as HTMLElement).dataset.key;
    if (key && KEYS[key] !== undefined) {
      cut(KEYS[key]);
    }
  });
});

// Generic collision helper (not used in current loop but kept for future)
function isColliding(rect1: DOMRect, rect2: DOMRect) {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  );
}

// --------------------------------------
// Init
// --------------------------------------

fetchSplashStreak();
setupModeToggle();
startBtn.addEventListener('click', startGame);