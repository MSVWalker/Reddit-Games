import './game.css';
import './powerups.css';
import './scrape.css';
import './knife-selection.css';
import './airplane.css';

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

// Map banners for easy access
const BANNER_IMAGES = [
  { ltr: banner1Ltr, rtl: banner1Rtl }, // Jet Fuel Can't Melt Chives
  { ltr: banner2Ltr, rtl: banner2Rtl }, // Forgive But Never Forget
  { ltr: banner3Ltr, rtl: banner3Rtl }, // Chive On!
  { ltr: banner4Ltr, rtl: banner4Rtl }, // Stay Sharp!
  { ltr: banner6Ltr, rtl: banner6Rtl }, // OUI CHEF!
  { ltr: banner8Ltr, rtl: banner8Rtl }, // F1exican4President
  { ltr: banner9Ltr, rtl: banner9Rtl }, // WeHeartF1exican
  { ltr: banner10Ltr, rtl: banner10Rtl } // SeeYouTomorrowChef
];


type Lane = 0 | 1 | 2;

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

enum PowerupType {
  Ice = 'ice',
  Rage = 'rage',
  Slam = 'slam'
}

const KEYS: Record<string, Lane> = {
  'a': 0,
  's': 1,
  'd': 2
};

const LANES = [
  document.getElementById('lane-0')!,
  document.getElementById('lane-1')!,
  document.getElementById('lane-2')!
];

// Airplane Banner Rotation
const bannerImages = [
  'url("./airplane_banner_1.png")', // F1exican Did Chive-11
  'url("./airplane_banner_2.png")', // Forgive But Never Forget
  'url("./airplane_banner_3.png")', // Chive On!
  'url("./airplane_banner_4.png")'  // Stay Sharp!
];

// Start at 5s, then every 10s (5, 15, 25...)
// We can use a simple modulo check or interval
// Since this loop runs every frame, we should check the time

// Current banner index based on time
// Time: 0-5s -> Banner 0 (Initial)
// Time: 5-15s -> Banner 1
// Time: 15-25s -> Banner 2
// ...

// Let's just switch it based on intervals
// Initial state (0-5s): Banner 1 (Index 0)
// 5s: Switch to Banner 2 (Index 1)
// 15s: Switch to Banner 3 (Index 2)
// ...

// Calculate index:
// If time < 5: Index 0
// Else: ((time - 5) / 10) % length


const scoreEl = document.getElementById('score')!;
const comboEl = document.getElementById('combo')!;
const dayEl = document.getElementById('day')!;
const knifeEl = document.getElementById('knife')!;
const startBtn = document.getElementById('start-button')!;
const overlay = document.getElementById('controls-overlay')!;
const eggZone = document.getElementById('easter-egg-zone')!;
const particlesEl = document.getElementById('particles-container')!;
const gameContainer = document.querySelector('.game-container')!;
const stackEl = document.getElementById('chive-stack')!;
const projectileContainer = document.getElementById('projectile-container')!;

let chives: Chive[] = [];
let projectiles: Projectile[] = [];
let scrapeKnife: { element: HTMLElement, x: number, direction: 'left' | 'right' } | null = null;
let nextId = 0;

// --- DIFFICULTY CONFIGURATION ---
const DIFFICULTY = {
  INITIAL_SPEED: 189,       // Pixels per second
  INITIAL_SPAWN_RATE: 1210, // Milliseconds between spawns
  HIT_WINDOW: 88,           // Pixels (allowance for hit)
  MISS_LIMIT: 10,           // Max misses before game over
  POWERUP_CHANCE: 0.135,    // 13.5% total chance (was 15%)
  POWERUP_DURATION: 3000,   // 3 seconds (was 5s)
  SCRAPE_INTERVAL: 30000,   // 30 seconds
  DAY_LENGTH: 12000         // 12 seconds per "day"
};

const HIT_WINDOW = DIFFICULTY.HIT_WINDOW;

// --- PRELOAD ASSETS ---
function preloadImages() {
  const images = [
    powerupFreeze, powerupRage, powerupSlam,
    knifeScythe, knifeKatana,
    banner1Ltr, banner1Rtl, banner2Ltr, banner2Rtl,
    banner3Ltr, banner3Rtl, banner4Ltr, banner4Rtl,
    banner6Ltr, banner6Rtl, banner8Ltr, banner8Rtl,
    banner9Ltr, banner9Rtl, banner10Ltr, banner10Rtl
  ];

  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
  console.log('[Game] Preloading images...');
}

// Start preloading immediately
preloadImages();

interface State {
  score: number;
  highScore: number;
  streak: number;
  bestStreak: number;
  missed: number;
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
  scrapeTimer: number;
  scrapeDirection: 'left' | 'right';
  selectedKnife: string;
  unlockedKnives: string[];
  highestDay: number;
  startTime: number;
  combo: number;
  practiceDays: number;
  totalPrecisionPoints: number;
  scrapeSpawnTimer: number; // Timer for delayed scrape spawn
}
const initialState: State = {
  score: 0,
  highScore: 0,
  streak: 0,
  bestStreak: 0,
  missed: 0,
  isPlaying: false,
  isPaused: false,
  speed: DIFFICULTY.INITIAL_SPEED, // Reduced by 10% from 210
  spawnRate: DIFFICULTY.INITIAL_SPAWN_RATE, // Slower spawn (was 1100)
  spawnTimer: 0,
  lastTime: 0,
  day: 1,
  dayTimer: 0,
  totalCuts: 0,
  totalPrecision: 0,
  activePowerup: null,
  powerupTimer: 0,
  timeScale: 1.0,
  rageMode: false,
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

// Knife configuration
const KNIVES = {
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
    unlockDay: 2,
    speed: 800,
    hitbox: 60,
    cssClass: 'knife-scissors'
  },
  cleaver: {
    emoji: '🪓',
    name: 'Cleaver',
    unlockDay: 3,
    speed: 600,
    hitbox: 70,
    cssClass: 'knife-cleaver'
  },
  scythe: {
    emoji: '⚔️', // Fallback
    image: knifeScythe,
    name: 'Scythe',
    unlockDay: 4,
    speed: 2000,
    hitbox: 50,
    cssClass: 'knife-scythe'
  },
  katana: {
    emoji: '🗡️', // Fallback
    image: knifeKatana,
    name: 'Katana',
    unlockDay: 5,
    speed: 1500,
    hitbox: 50,
    cssClass: 'knife-katana'
  }
};

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
  void (gameContainer as HTMLElement).offsetWidth; // Trigger reflow
  gameContainer.classList.add('shake');
}

function addToStack() {
  const piece = document.createElement('div');
  piece.className = 'stack-piece';

  // Random scatter positioning across the entire cutting board
  const x = Math.random() * 100; // 0-100%
  const y = Math.random() * 100; // 0-100%
  const rotation = Math.random() * 360; // Full rotation
  const scale = 0.8 + Math.random() * 0.4; // 0.8 to 1.2

  piece.style.position = 'absolute';
  piece.style.left = `${x}%`;
  piece.style.top = `${y}%`;
  piece.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
  piece.style.opacity = '0.8';

  stackEl.appendChild(piece);

  // Keep enough pieces to be visible but not too many
  if (stackEl.children.length > 100) {
    stackEl.removeChild(stackEl.firstElementChild!);
  }
}

// Advanced Patterns
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

function spawnPowerup(type: PowerupType) {
  console.log('Spawning Powerup:', type);
  const lane = Math.floor(Math.random() * 3) as Lane;
  const laneEl = LANES[lane];
  if (!laneEl) return;

  const el = document.createElement('div');
  el.className = `chive powerup-${type}`;

  // Icons are now set via CSS ::after pseudo-elements in powerups.css

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

function activatePowerup(type: PowerupType) {
  state.activePowerup = type;
  state.powerupTimer = DIFFICULTY.POWERUP_DURATION;

  if (type === PowerupType.Ice) {
    state.timeScale = 0.3;
    // Text removed per user request
  } else if (type === PowerupType.Rage) {
    state.rageMode = true;
    // Text removed per user request
  } else if (type === PowerupType.Slam) {
    // Instant effect, no timer needed really, but let's keep the overlay for a sec
    state.powerupTimer = 1000;
    triggerSlam();
  }
}

function deactivatePowerup() {
  state.activePowerup = null;
  state.timeScale = 1.0;
  state.rageMode = false;
}

function triggerSlam() {
  gameContainer.classList.add('slam-effect');
  setTimeout(() => gameContainer.classList.remove('slam-effect'), 500);

  // Destroy all chives
  chives.forEach(c => {
    if (!c.cut) {
      c.cut = true;
      c.element.classList.add('cut');

      // Visuals
      const rect = c.element.getBoundingClientRect();
      spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, '#f1c40f');

      setTimeout(() => {
        c.element.remove();
      }, 100);
    }
  });

  // Clear array after animation
  setTimeout(() => {
    chives = [];
  }, 100);

  // Add score for cleared chives (maybe bonus?)
  state.score += 10;
  scoreEl.textContent = state.score.toString();
}

function spawnEasterEgg() {
  // Easter eggs disabled per user request
  return;
  /*
  const egg = document.createElement('div');
  egg.className = 'bonus-item'; // Changed from 'airplane' to avoid CSS conflict

  // Random selection of plane/vehicle emojis
  const vehicles = ['✈️', '🛩️', '⛴️']; // Reduced to 3 emojis
  const randomVehicle = vehicles[Math.floor(Math.random() * vehicles.length)];

  // Spawn much less frequently - ~20 seconds
  if (Math.random() > 0.15) return; // 15% chance per spawn attempt
  egg.textContent = randomVehicle || '✈️';

  eggZone.appendChild(egg);

  setTimeout(() => egg.remove(), 4000);
  */
}

function buildKnifeSelectionUI(): string {
  // Update highestDay and unlock knives
  if (state.day > state.highestDay) {
    state.highestDay = state.day;
    // Unlock knives based on day
    Object.entries(KNIVES).forEach(([id, knife]) => {
      if (knife.unlockDay <= state.highestDay && !state.unlockedKnives.includes(id)) {
        state.unlockedKnives.push(id);
      }
    });
  }

  let html = '<div class="knife-selection"><h2>Choose Your Weapon</h2><div class="knife-rack">';

  Object.entries(KNIVES).forEach(([id, knife]) => {
    const isUnlocked = state.unlockedKnives.includes(id);
    const isSelected = state.selectedKnife === id;
    const unlockText = knife.unlockDay === 0 ? 'Default' : `Day ${knife.unlockDay}`;

    html += `
      <div class="knife-option ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''}" data-knife="${id}">
        <div class="knife-icon" style="${(knife as any).image ? `background-image: url(${(knife as any).image}); background-size: contain; background-repeat: no-repeat; background-position: center; color: transparent;` : ''}">${knife.emoji}</div>
        <div class="knife-label">
          <span class="knife-name">${knife.name}</span>
          <span class="knife-unlock">${isUnlocked ? unlockText : `🔒 ${unlockText}`}</span>
        </div>
      </div>
    `;
  });

  html += '</div></div>';
  return html;
}

function setupKnifeSelection() {
  const knives = document.querySelectorAll('.knife-option');
  knives.forEach(knife => {
    knife.addEventListener('click', () => {
      if (!knife.classList.contains('locked')) {
        const knifeId = (knife as HTMLElement).dataset.knife!;
        state.selectedKnife = knifeId;

        // Update UI
        knives.forEach(k => k.classList.remove('selected'));
        knife.classList.add('selected');

        // Update in-game knife
        updateKnifeVisual();

        // Save to localStorage
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
  const knife = KNIVES[state.selectedKnife as keyof typeof KNIVES];
  if (knife) {
    if ((knife as any).image) {
      knifeEl.textContent = '';
      knifeEl.style.backgroundImage = `url(${(knife as any).image})`;
      knifeEl.style.backgroundSize = 'contain';
      knifeEl.style.backgroundRepeat = 'no-repeat';
      knifeEl.style.backgroundPosition = 'center';
      knifeEl.style.width = '85px'; // Resized to 85px
      knifeEl.style.height = '85px';
    } else {
      knifeEl.style.backgroundImage = 'none';
      knifeEl.textContent = knife.emoji;
      knifeEl.style.fontSize = '5rem'; // Match CSS default
      knifeEl.style.width = ''; // Reset width
      knifeEl.style.height = ''; // Reset height
    }
  }
}

function loadKnifePreferences() {
  try {
    const savedKnife = localStorage.getItem('selectedKnife');
    const savedUnlocked = localStorage.getItem('unlockedKnives');
    const savedHighestDay = localStorage.getItem('highestDay');

    if (savedKnife && KNIVES[savedKnife as keyof typeof KNIVES]) {
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

async function gameOver() {
  state.isPlaying = false;

  // Submit score and fetch data
  let scoreData: any = null;
  try {
    const res = await fetch('/api/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: state.score, day: state.day }),
    });
    if (res.ok) {
      scoreData = await res.json();
    }
  } catch (error) {
    console.error('Score submission failed:', error);
  }

  // Use the EXISTING overlay element from HTML
  overlay.classList.remove('hidden');
  overlay.scrollTop = 0;

  // Safe fallback values
  const bestScore = scoreData?.personalBest?.score ?? state.score;
  const userRank = scoreData?.rank || '?';
  const dailyStreak = scoreData?.streak ?? 0;

  // Random chef flavor text
  const flavorTexts = [
    "See you tomorrow, chef.",
    "Chive shift's over. Same time tomorrow, chef?",
    "Clock out, chef. Chives resume tomorrow.",
    "Prep's done for the day. Back on the board tomorrow, chef."
  ];
  const randomText = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];

  // Build clean HTML
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
            🔥 Daily Streak: <span style="color: #f39c12;">${dailyStreak} Day${dailyStreak === 1 ? '' : 's'}</span> 🔥
          </div>
        </div>
        
        <button id="restart-button" class="main-cta-btn">TRY AGAIN</button>
      </div>
    </div>
    
    ${buildKnifeSelectionUI()}
    
    <div class="leaderboard-section">
      <div class="leaderboard-banner">LEADERBOARDS</div>
      
      <div class="leaderboard-controls" style="display: flex; gap: 5px; justify-content: center; flex-wrap: wrap; margin-bottom: 10px;">
        <button id="toggle-daily-btn" class="lb-toggle-btn">DAILY HIGH</button>
        <button id="toggle-score-btn" class="lb-toggle-btn">ALL TIME</button>
        <button id="toggle-streak-btn" class="lb-toggle-btn">STREAK</button>
      </div>
      
      <div id="lb-explanation" class="hidden" style="color: #666; font-size: 0.75rem; margin-bottom: 10px; font-style: italic; text-align: center;">
        Loading...
      </div>
      
      <div id="leaderboard-container" class="hidden" style="max-height: 400px; overflow-y: auto;">
        <div class="leaderboard"><table></table></div>
      </div>
    </div>
  `;

  // Setup listeners
  setupKnifeSelection();
  document.getElementById('restart-button')?.addEventListener('click', startGame);

  // Leaderboard toggle state
  let activeMode: 'daily' | 'score' | 'streak' | null = null;

  // Simplified leaderboard loader
  async function loadLeaderboard(mode: 'daily' | 'score' | 'streak') {
    const container = document.getElementById('leaderboard-container');
    const explanation = document.getElementById('lb-explanation');
    const dailyBtn = document.getElementById('toggle-daily-btn');
    const scoreBtn = document.getElementById('toggle-score-btn');
    const streakBtn = document.getElementById('toggle-streak-btn');

    if (!container || !explanation || !dailyBtn || !scoreBtn || !streakBtn) return;

    // Toggle off if clicking same button
    if (activeMode === mode) {
      container.classList.add('hidden');
      explanation.classList.add('hidden');
      dailyBtn.classList.remove('active');
      scoreBtn.classList.remove('active');
      streakBtn.classList.remove('active');
      activeMode = null;
      return;
    }

    // Set active mode
    activeMode = mode;
    container.classList.remove('hidden');
    explanation.classList.remove('hidden');

    // Update button states
    dailyBtn.classList.toggle('active', mode === 'daily');
    scoreBtn.classList.toggle('active', mode === 'score');
    streakBtn.classList.toggle('active', mode === 'streak');

    // Update explanation
    const explanations = {
      daily: "Today's Best Runs",
      score: 'All Time High Scores',
      streak: 'Longest Daily Play Streaks'
    };
    explanation.textContent = explanations[mode];

    // Show loading
    container.innerHTML = '<div style="color: #aaa; padding: 20px; text-align: center;">Loading...</div>';

    // Fetch leaderboard
    try {
      const res = await fetch(`/api/leaderboard?sortBy=${mode}`);
      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();

      if (!data.entries || data.entries.length === 0) {
        container.innerHTML = '<div style="color: #666; padding: 20px; text-align: center;">No entries yet</div>';
        return;
      }

      // Build table
      let html = '<div class="leaderboard"><table>';

      // Headers
      if (mode === 'streak') {
        html += '<tr><th>#</th><th>Chef</th><th>Streak</th><th>Best Score</th></tr>';
      } else {
        html += '<tr><th>#</th><th>Chef</th><th>Score</th><th>Day</th></tr>';
      }

      // Rows
      data.entries.forEach((entry: any) => {
        const isUser = entry.rank === userRank;
        const rowClass = isUser ? ' class="current-user"' : '';

        if (mode === 'streak') {
          html += `<tr${rowClass}>
            <td>#${entry.rank}</td>
            <td>${entry.username}</td>
            <td>${entry.streak} 🔥</td>
            <td>${entry.score}</td>
          </tr>`;
        } else {
          html += `<tr${rowClass}>
            <td>#${entry.rank}</td>
            <td>${entry.username}</td>
            <td>${entry.score}</td>
            <td>Day ${entry.day}</td>
          </tr>`;
        }
      });

      html += '</table></div>';
      container.innerHTML = html;
    } catch (error) {
      console.error('Leaderboard fetch failed:', error);
      container.innerHTML = '<div style="color: #e74c3c; padding: 20px; text-align: center;">Failed to load</div>';
    }
  }

  // Attach button listeners
  document.getElementById('toggle-daily-btn')?.addEventListener('click', () => loadLeaderboard('daily'));
  document.getElementById('toggle-score-btn')?.addEventListener('click', () => loadLeaderboard('score'));
  document.getElementById('toggle-streak-btn')?.addEventListener('click', () => loadLeaderboard('streak'));
}


// Updated Update Loop
function update(time: number) {
  if (!state.isPlaying) return;

  const dt = time - state.lastTime;
  state.lastTime = time;

  // --- Airplane Banner Rotation & Flight Schedule ---
  const airplane = document.getElementById('airplane');
  if (airplane) {
    const elapsed = (Date.now() - state.startTime) / 1000;

    // Unified 25s Cycle:
    // 0-5s:   Wait (5s)
    // 5-12s:  Fly LTR (7s)
    // 12-14s: Wait (2s)
    // 14-18s: Fly RTL (4s)
    // 18-25s: Wait (7s)

    const cycleDuration = 25;
    const timeInCycle = elapsed % cycleDuration;
    const cycleCount = Math.floor(elapsed / cycleDuration);
    const bannerIndex = cycleCount % BANNER_IMAGES.length; // Rotate banners every full cycle

    // Reset classes first
    airplane.classList.remove('fly-ltr', 'fly-rtl');
    airplane.style.display = 'none'; // Default hidden

    let direction: 'ltr' | 'rtl' | null = null;

    if (timeInCycle >= 5 && timeInCycle < 12) {
      // 5-12s: Fly Left-to-Right
      direction = 'ltr';
      airplane.classList.add('fly-ltr');
      airplane.style.display = 'block';

      // Randomize vertical position (Higher up: 5% to 25%)
      // Only set this ONCE per flight (at start)
      if (Math.floor(timeInCycle * 10) === 50) { // roughly at 5.0s
        const randomTop = 5 + Math.random() * 20; // 5% to 25%
        airplane.style.top = `${randomTop}%`;
      }

    } else if (timeInCycle >= 14 && timeInCycle < 18) {
      // 14-18s: Fly Right-to-Left
      direction = 'rtl';
      airplane.classList.add('fly-rtl');
      airplane.style.display = 'block';

      // Randomize vertical position (Higher up: 5% to 25%)
      if (Math.floor(timeInCycle * 10) === 140) { // roughly at 14.0s
        const randomTop = 5 + Math.random() * 20; // 5% to 25%
        airplane.style.top = `${randomTop}%`;
      }
    }

    // Apply Banner Image if flying
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
  // -------------------------------

  // Day Progression (Time-based: 15s)
  state.dayTimer += dt * state.timeScale;
  if (state.dayTimer >= DIFFICULTY.DAY_LENGTH) { // 12 seconds
    nextDay();
    state.dayTimer = 0;
  }

  // Powerup Timer
  if (state.activePowerup) {
    state.powerupTimer -= dt;
    if (state.powerupTimer <= 0) {
      deactivatePowerup();
    }
  }

  // Spawning
  // FIX: Scale spawn timer by timeScale so spawns slow down with the game
  state.spawnTimer += dt * state.timeScale;

  if (state.spawnTimer > state.spawnRate) {
    const rand = Math.random();
    if (rand < DIFFICULTY.POWERUP_CHANCE && state.day > 1) {
      // 9% chance for powerup (3% each) - DISABLED ON DAY 1
      const pRand = Math.random();
      if (pRand < 0.33) spawnPowerup(PowerupType.Ice);
      else if (pRand < 0.66) spawnPowerup(PowerupType.Rage);
      else spawnPowerup(PowerupType.Slam);
    }
    else if (rand < 0.15) spawnStairs();
    else if (rand < 0.2) spawnDoubles(); // 5% chance
    else if (rand < 0.3) spawnJackhammer();
    else if (rand < 0.5) spawnRapidFire();
    else spawnChive();

    state.spawnTimer = 0;
    if (Math.random() < 0.15) spawnEasterEgg();
  }

  // Update Scrape Mechanic
  // Update Scrape Mechanic
  updateScrape(dt);

  // Handle Delayed Scrape Spawn
  if (state.scrapeSpawnTimer > 0) {
    state.scrapeSpawnTimer -= dt;
    if (state.scrapeSpawnTimer <= 0) {
      spawnScrapeKnife();
      state.scrapeSpawnTimer = 0;
    }
  }

  // Move chives
  const firstLane = LANES[0];
  if (!firstLane) return;
  const boardHeight = firstLane.clientHeight;

  chives.forEach((chive, index) => {
    if (chive.cut) return;

    chive.y += (state.speed * dt * state.timeScale) / 1000;
    chive.element.style.top = `${chive.y}px`;

    // Missed
    if (chive.y > boardHeight) {
      chive.element.remove();
      chives.splice(index, 1);

      // In Rage Mode, misses don't count? Or maybe they do. Let's say they do for now.
      if (!state.rageMode) {
        resetCombo();
        triggerShake(); // Shake on miss
        state.missed++;

        if (state.missed >= DIFFICULTY.MISS_LIMIT) { // 10 misses allowed
          gameOver();
        }
      }
    }
  });

  // Move Projectiles (Rage Mode)
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    if (!proj) continue;
    proj.y -= (proj.speed * dt) / 1000; // Use knife-specific speed
    proj.element.style.top = `${proj.y}px`;

    let hit = false;
    // Collision Check
    for (const chive of chives) {
      if (chive.lane === proj.lane && !chive.cut) {
        // Use knife-specific hitbox
        if (Math.abs(chive.y - proj.y) < proj.hitboxSize) {
          // Hit!
          chive.cut = true;
          chive.element.classList.add('cut');
          state.totalCuts++;

          // Visuals
          const rect = chive.element.getBoundingClientRect();
          spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, '#e74c3c');

          // Cleaver special effect: screen shake
          if (proj.knifeType === 'cleaver') {
            triggerShake();
          }

          setTimeout(() => {
            chive.element.remove();
            chives = chives.filter(c => c.id !== chive.id);
          }, 100);

          addToStack();
          addScore();

          hit = true;
          break; // Single hit only
        }
      }
    }

    if (hit) {
      proj.element.remove();
      projectiles.splice(i, 1);
      continue;
    }

    // Remove if off screen
    if (proj.y < -100) {
      proj.element.remove();
      projectiles.splice(i, 1);
    }
  }

  requestAnimationFrame(update);
}

function updateScrape(dt: number) {
  if (!scrapeKnife) return;

  try {
    const speed = 0.625; // Doubled speed (was 0.3125)

    // Move Knife (Always Left -> Right)
    scrapeKnife.x += speed * dt;
    scrapeKnife.element.style.transform = `translateX(${scrapeKnife.x}px)`;

    // Use cached board dimensions
    const boardWidth = scrapeKnife.boardWidth;

    // Animate Debris Push Container (Slide Right with knife)
    if (scrapeKnife.debrisContainer) {
      // Only apply if knife is ON the board
      if (scrapeKnife.x > 0 && scrapeKnife.x < boardWidth) {
        // Push debris container to the right
        scrapeKnife.debrisContainer.style.transform = `translateX(${scrapeKnife.x}px)`;
      }
    }

    // 1. Clear Active Chives (Collision Window)
    const knifeWidth = 50;
    const knifeX = scrapeKnife.x;

    for (let i = chives.length - 1; i >= 0; i--) {
      const chive = chives[i];
      if (!chive) continue;

      const laneWidth = boardWidth / 3;
      const chiveX = (chive.lane * laneWidth) + (laneWidth / 2);

      // Check collision (Left -> Right)
      // Hit if knife passed chive but is close
      if (knifeX > chiveX && knifeX < chiveX + knifeWidth) {
        chive.element.remove();
        chives.splice(i, 1);

        // Add particle effect for satisfaction
        const rect = chive.element.getBoundingClientRect();
        spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, '#2ecc71');
      }
    }

    // 2. Clear Debris & Reset
    if (scrapeKnife.x > boardWidth + 100) {
      console.log('[Scrape] Knife finished.');

      // Remove temporary debris container
      if (scrapeKnife.debrisContainer) {
        scrapeKnife.debrisContainer.remove();
      }

      scrapeKnife.element.remove();
      scrapeKnife = null;

      // No direction toggle needed (Always Left->Right)
    }

  } catch (e) {
    console.error("Scrape error:", e);
    if (scrapeKnife && scrapeKnife.element) scrapeKnife.element.remove();
    if (scrapeKnife && scrapeKnife.debrisContainer) scrapeKnife.debrisContainer.remove();
    scrapeKnife = null;
  }
}

function showScrapeWarning() {
  console.log('[Scrape] Warning shown');
  const warning = document.createElement('div');
  warning.id = 'scrape-warning';
  warning.className = 'scrape-warning';
  warning.textContent = '▶ SCRAPE!'; // Always Left -> Right
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
  // Pure CSS visual now - no background image needed

  // Pure CSS visual now - no background image needed

  // Append DIRECTLY TO BODY
  document.body.appendChild(el);

  const cuttingBoard = document.getElementById('cutting-board-container');
  let boardWidth = 500; // Default fallback

  if (cuttingBoard) {
    const rect = cuttingBoard.getBoundingClientRect();
    boardWidth = rect.width;

    // Position exactly over the board
    el.style.position = 'fixed';
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.height = `${rect.height}px`;
    el.style.zIndex = '99999';
  } else {
    // Fallback positioning
    el.style.position = 'fixed';
    el.style.top = '100px';
    el.style.left = '0px';
    el.style.height = '500px';
    el.style.zIndex = '99999';
  }

  // Determine Start X (Always 0 for Left->Right)
  const startX = 0;

  console.log(`[Scrape] Spawning Left->Right at X:${startX}`);

  // Create temporary debris container for animation
  let debrisContainer: HTMLElement | null = null;
  if (stackEl && stackEl.children.length > 0) {
    debrisContainer = document.createElement('div');
    debrisContainer.className = 'debris-push-container';
    // Match stackEl styling/position
    debrisContainer.style.position = 'absolute';
    debrisContainer.style.top = '0';
    debrisContainer.style.left = '0';
    debrisContainer.style.width = '100%';
    debrisContainer.style.height = '100%';
    debrisContainer.style.pointerEvents = 'none';

    // Move all current debris to this container
    while (stackEl.firstChild) {
      debrisContainer.appendChild(stackEl.firstChild);
    }

    stackEl.appendChild(debrisContainer);
  }

  scrapeKnife = {
    element: el,
    x: startX,
    direction: 'left',
    boardWidth: boardWidth, // Cache this!
    debrisContainer: debrisContainer
  };

  // Apply initial position
  el.style.transform = `translateX(${startX}px)`;

  console.log(`[Scrape] Element in DOM:`, document.body.contains(el));
  console.log(`[Scrape] Element position:`, el.getBoundingClientRect());
}

function spawnRapidFire() {
  // Spawn 3 chives in quick succession
  let count = 0;
  const interval = setInterval(() => {
    spawnChive();
    count++;
    if (count >= 3) clearInterval(interval);
  }, 150); // 150ms gap
}

function cut(lane: Lane) {
  if (!state.isPlaying) return;

  // Visual feedback
  knifeEl.style.transform = `translateX(${(lane - 1) * 100}px) rotate(-45deg)`;
  setTimeout(() => {
    knifeEl.style.transform = `translateX(${(lane - 1) * 100}px) rotate(0deg)`;
  }, 50);

  // RAGE MODE: Throwing Knives
  if (state.rageMode) {
    const firstLane = LANES[0];
    if (!firstLane) return;
    const boardHeight = firstLane.clientHeight;
    const startY = boardHeight - 50;

    const laneEl = LANES[lane];
    if (!laneEl) return;

    // Get selected knife properties
    const knife = KNIVES[state.selectedKnife as keyof typeof KNIVES];
    if (!knife) return;

    const el = document.createElement('div');
    el.className = `projectile-knife ${knife.cssClass}`;

    if ((knife as any).image) {
      el.style.backgroundImage = `url(${(knife as any).image})`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
    } else {
      el.textContent = knife.emoji;
    }
    el.style.top = `${startY}px`;

    // Position based on lane (0, 1, 2) -> 16.66%, 50%, 83.33%
    const leftPercent = (lane * 33.33) + 16.66;
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

  // Normal Mode
  const firstLane = LANES[0];
  if (!firstLane) return;
  const boardHeight = firstLane.clientHeight;
  const cutY = boardHeight - 80;

  const target = chives.find(c => c.lane === lane && !c.cut && Math.abs(c.y - cutY) < HIT_WINDOW);

  if (target) {
    // Hit
    target.cut = true;
    target.element.classList.add('cut');

    // Activate Powerup
    if (target.type === 'powerup' && target.powerupType) {
      activatePowerup(target.powerupType);
    }

    // Precision Calculation (Visual only)
    const distance = Math.abs(target.y - cutY);
    let text = "Okay";
    let color = "#fff";

    if (distance < 15) {
      text = "Perfect!";
      color = "#f1c40f"; // Gold
    } else if (distance < 35) {
      text = "Good";
      color = "#2ecc71"; // Green
    }

    // All cuts are worth 1 point
    state.totalCuts++;

    // Visual Feedback
    const feedback = document.createElement('div');
    feedback.textContent = text;
    feedback.style.position = 'absolute';
    feedback.style.left = `${(lane * 100) + 50}px`; // Center in lane
    feedback.style.top = `${cutY - 50}px`;
    feedback.style.color = color;
    feedback.style.fontWeight = 'bold';
    feedback.style.fontSize = '1.5rem';
    feedback.style.textShadow = '0 0 5px rgba(0,0,0,0.5)';
    feedback.style.pointerEvents = 'none';
    feedback.style.animation = 'floatUp 0.8s ease-out forwards';
    gameContainer.appendChild(feedback);

    setTimeout(() => feedback.remove(), 800);

    // Particles
    const rect = target.element.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, color);

    setTimeout(() => {
      target.element.remove();
      chives = chives.filter(c => c.id !== target.id);
    }, 100);

    addToStack();
    addScore();
  } else {
    // Miss click penalty?
  }
}

function addScore() {
  state.score++;
  state.combo++;
  // Display count score
  scoreEl.textContent = state.score.toString();
  comboEl.textContent = state.combo.toString();

  // Progression is now time-based (see update loop)
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

  // Seamless Transition (No Pause)
  const transitionOverlay = document.getElementById('day-transition-overlay')!;
  const transitionText = document.getElementById('transition-day-text')!;

  transitionText.textContent = `DAY ${state.day}`;
  transitionOverlay.classList.remove('hidden');

  // Hide after animation (2.5s) to reset for next time
  setTimeout(() => {
    transitionOverlay.classList.add('hidden');
  }, 2500);

  // Increase difficulty with diminishing returns
  // Days 1-10: Full progression (speed +27, spawn -45)
  // Days 11-16: Slower progression (speed +15, spawn -25)
  // Days 17+: Minimal progression (speed +8, spawn -12)

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

  // F1Exigen Mode check
  if (state.day === 45) {
    // Non-blocking alert for flow
    console.log("DAY 45: F1EXIGEN MODE ACTIVATED! GOOD LUCK CHEF!");
    state.speed = 750; // Reduced from 810
    state.spawnRate = 100; // Increased from 90
  }

  // Add 1s pause (no chives) after each day
  state.spawnTimer = -1000;

  // Trigger Scrape every 5 days (Day 5, 10, 15...)
  if (state.day % 5 === 0) {
    // Delay scrape slightly so it happens during the transition
    // Use State-Based Timer instead of setTimeout
    showScrapeWarning();
    state.scrapeSpawnTimer = 2000; // 2 seconds
  }
}

async function startGame() {
  // Load personal best and practice days
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

  state.score = 0;
  state.combo = 0;
  state.day = 1;
  state.missed = 0;
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

  // Clear existing
  chives.forEach(c => c.element.remove());
  chives = [];
  projectiles = []; // Clear projectiles
  stackEl.innerHTML = '';
  projectileContainer.innerHTML = '';

  // Set CSS variables for powerups (Fix for invisible powerups)
  gameContainer.style.setProperty('--img-freeze', `url(${powerupFreeze})`);
  gameContainer.style.setProperty('--img-rage', `url(${powerupRage})`);
  gameContainer.style.setProperty('--img-slam', `url(${powerupSlam})`);

  overlay.classList.add('hidden');

  // Load saved knife preferences
  loadKnifePreferences();

  // Reset overlay content just in case
  overlay.innerHTML = `
    <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%;">
      <h1 style="text-align: center;">Chive Cutter</h1>
      <p style="text-align: center; color: #2ecc71; margin-bottom: 5px; font-weight: bold;">Hit the correct key when the chive lands on the cut line</p>
      
      <p style="text-align: center; font-size: 0.9rem; margin-top: 10px; color: #ddd;">
        Press <span class="keycap">A</span> <span class="keycap">S</span> <span class="keycap">D</span> or tap lanes
      </p>
      
      <button id="start-button">START DAY ${state.practiceDays}</button>
      
      ${state.streak > 1 ? `<div style="color: #e74c3c; font-weight: bold; margin-top: 10px; font-size: 1rem; animation: pulse 2s infinite;">🔥 ${state.streak} Day Streak!</div>` : ''}
    </div>
    
    <p id="practice-day-text" style="text-align: center; font-size: 1.2rem; line-height: 1.4; color: #ccc; margin: 0 auto 15px auto; font-style: italic; max-width: 90%;">Cutting a couple of chives every day until r/KitchenConfidential says they're perfect.</p>
    
    <div class="splash-footer">
      An unofficial mini-game for r/KitchenConfidential<br>
      <span style="opacity: 0.5; font-size: 0.8em;">v0.0.5</span>
    </div>
  `;
  // Re-attach listener if needed, but better to just hide overlay
  requestAnimationFrame(update);
}

// Input Listeners
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (KEYS[key] !== undefined) {
    cut(KEYS[key]);
  }
});

startBtn.addEventListener('click', startGame);

// Mobile Controls
document.querySelectorAll('.mobile-btn').forEach(btn => {
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const key = (e.target as HTMLElement).dataset.key;
    if (key && KEYS[key] !== undefined) {
      cut(KEYS[key]);
    }
  });
});
// Helper for collision detection
function isColliding(rect1: DOMRect, rect2: DOMRect) {
  return !(rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom);
}
