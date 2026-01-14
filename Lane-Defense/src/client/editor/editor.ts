const GRID_WIDTH = 31;
const GRID_HEIGHT = 31;
const TILE_SIZE = 10;
const PATH_MIN_TILES = 10;
const PATH_MAX_TILES = 1000;
const PATH_MIN_LENGTH = 2;
const MAP_TILE_BLOCKED = 0;
const MAP_TILE_PATH = 2;
const GUEST_ID_KEY = "lane-defense:guest-id";

type Tool = "path" | "erase" | "spawn" | "exit";

interface Point {
  x: number;
  y: number;
}

interface HistoryEntry {
  x: number;
  y: number;
  prevTile: number;
  prevSpawn: Point | null;
  prevExit: Point | null;
}

const canvas = document.getElementById("editor-canvas") as HTMLCanvasElement | null;
const backButton = document.getElementById("back-training") as HTMLButtonElement | null;
const hpSelect = document.getElementById("hp-mult") as HTMLSelectElement | null;
const speedSelect = document.getElementById("speed-mult") as HTMLSelectElement | null;
const titleInput = document.getElementById("map-title") as HTMLInputElement | null;
const saveButton = document.getElementById("save-draft") as HTMLButtonElement | null;
const publishButton = document.getElementById("publish-map") as HTMLButtonElement | null;
const statusEl = document.getElementById("editor-status");
const pathCountEl = document.getElementById("path-count");
const spawnPosEl = document.getElementById("spawn-pos");
const exitPosEl = document.getElementById("exit-pos");
const validateBadge = document.getElementById("editor-validate");

const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".tool-button[data-tool]"));
const undoButton = document.getElementById("undo-button") as HTMLButtonElement | null;
const validateButton = document.getElementById("validate-button") as HTMLButtonElement | null;

let currentTool: Tool = "path";
let tiles = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => MAP_TILE_BLOCKED);
let spawn: Point | null = null;
let exit: Point | null = null;
const history: HistoryEntry[] = [];

const getIndex = (x: number, y: number) => y * GRID_WIDTH + x;

const generateGuestId = () => {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getGuestId = () => {
  try {
    const stored = localStorage.getItem(GUEST_ID_KEY);
    if (stored && /^[a-z0-9]{8,32}$/.test(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors.
  }
  const fresh = generateGuestId();
  try {
    localStorage.setItem(GUEST_ID_KEY, fresh);
  } catch {
    // Ignore storage errors.
  }
  return fresh;
};

const buildMultiplierOptions = (select: HTMLSelectElement | null) => {
  if (!select) return;
  for (let value = 0.5; value <= 3 + 0.001; value += 0.25) {
    const option = document.createElement("option");
    option.value = value.toFixed(2);
    option.textContent = `${value.toFixed(2)}x`;
    select.appendChild(option);
  }
  select.value = "1.00";
};

const setStatus = (message: string, isError = false) => {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb7b7" : "rgba(247, 242, 234, 0.75)";
};

const showValidationBadge = (message: string, isError: boolean) => {
  if (!validateBadge) return;
  validateBadge.textContent = message;
  validateBadge.classList.remove("success", "error");
  validateBadge.classList.add(isError ? "error" : "success");
  validateBadge.classList.add("show");
  validateBadge.setAttribute("aria-hidden", "false");
  window.setTimeout(() => {
    validateBadge.classList.remove("show");
    validateBadge.setAttribute("aria-hidden", "true");
  }, 1800);
};

const updateStats = () => {
  const pathCount = tiles.filter((tile) => tile === MAP_TILE_PATH).length;
  if (pathCountEl) pathCountEl.textContent = `${pathCount}`;
  if (spawnPosEl) spawnPosEl.textContent = spawn ? `${spawn.x},${spawn.y}` : "--";
  if (exitPosEl) exitPosEl.textContent = exit ? `${exit.x},${exit.y}` : "--";
};

const drawGrid = () => {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const tile = tiles[getIndex(x, y)];
      if (tile === MAP_TILE_PATH) {
        ctx.fillStyle = "#4fa3e2";
      } else {
        ctx.fillStyle = "#06080d";
      }
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  if (spawn) {
    ctx.fillStyle = "#4fd68c";
    ctx.fillRect(spawn.x * TILE_SIZE, spawn.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }
  if (exit) {
    ctx.fillStyle = "#f05f5a";
    ctx.fillRect(exit.x * TILE_SIZE, exit.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= GRID_WIDTH; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * TILE_SIZE, 0);
    ctx.lineTo(x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= GRID_HEIGHT; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE_SIZE);
    ctx.lineTo(GRID_WIDTH * TILE_SIZE, y * TILE_SIZE);
    ctx.stroke();
  }
};

const applyTool = (x: number, y: number) => {
  if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) return;
  const index = getIndex(x, y);
  const prevTile = tiles[index];
  const prevSpawn = spawn ? { ...spawn } : null;
  const prevExit = exit ? { ...exit } : null;
  if (currentTool === "path") {
    if (spawn && spawn.x === x && spawn.y === y) return;
    if (exit && exit.x === x && exit.y === y) return;
    tiles[index] = MAP_TILE_PATH;
  } else if (currentTool === "erase") {
    if (spawn && spawn.x === x && spawn.y === y) return;
    if (exit && exit.x === x && exit.y === y) return;
    tiles[index] = MAP_TILE_BLOCKED;
  } else if (currentTool === "spawn") {
    spawn = { x, y };
    tiles[index] = MAP_TILE_PATH;
  } else if (currentTool === "exit") {
    exit = { x, y };
    tiles[index] = MAP_TILE_PATH;
  }
  if (prevTile !== tiles[index] || prevSpawn?.x !== spawn?.x || prevExit?.x !== exit?.x) {
    history.push({ x, y, prevTile, prevSpawn, prevExit });
  }
  updateStats();
  drawGrid();
};

const undo = () => {
  const last = history.pop();
  if (!last) return;
  tiles[getIndex(last.x, last.y)] = last.prevTile;
  spawn = last.prevSpawn;
  exit = last.prevExit;
  updateStats();
  drawGrid();
};

const validateMap = () => {
  const errors: string[] = [];
  const pathCount = tiles.filter((tile) => tile === MAP_TILE_PATH).length;
  if (!spawn || !exit) {
    errors.push("Spawn and exit must be set.");
  }
  if (pathCount < PATH_MIN_TILES) {
    errors.push(`Board tiles must be at least ${PATH_MIN_TILES}.`);
  }
  if (pathCount > PATH_MAX_TILES) {
    errors.push(`Board tiles cannot exceed ${PATH_MAX_TILES}.`);
  }
  if (spawn && exit) {
    const pathLength = computePathLength(spawn, exit);
    if (!Number.isFinite(pathLength)) {
      errors.push("No valid path from spawn to exit.");
    } else if (pathLength < PATH_MIN_LENGTH) {
      errors.push(`Path length must be at least ${PATH_MIN_LENGTH}.`);
    }
  }
  if (errors.length) {
    setStatus(errors.join(" "), true);
    showValidationBadge("Invalid ✕", true);
    return false;
  }
  setStatus("Map validated.");
  showValidationBadge("Valid ✓", false);
  return true;
};

const computePathLength = (start: Point, end: Point) => {
  const dist = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => Number.POSITIVE_INFINITY);
  const queue: Point[] = [];
  const startIndex = getIndex(start.x, start.y);
  const endIndex = getIndex(end.x, end.y);
  if (tiles[startIndex] !== MAP_TILE_PATH || tiles[endIndex] !== MAP_TILE_PATH) {
    return Infinity;
  }
  dist[startIndex] = 0;
  queue.push(start);
  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const currentIndex = getIndex(current.x, current.y);
    const nextDist = dist[currentIndex] + 1;
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= GRID_WIDTH || neighbor.y >= GRID_HEIGHT) continue;
      const idx = getIndex(neighbor.x, neighbor.y);
      if (tiles[idx] !== MAP_TILE_PATH) continue;
      if (nextDist < dist[idx]) {
        dist[idx] = nextDist;
        queue.push(neighbor);
      }
    }
  }
  if (!Number.isFinite(dist[endIndex])) return Infinity;
  return dist[endIndex] + 1;
};

const saveMap = async (publish: boolean) => {
  if (!validateMap()) return;
  const title = titleInput?.value.trim() || "";
  const description = "";
  if (title.length < 1) {
    setStatus("Title is required.", true);
    showValidationBadge("Title required", true);
    return;
  }
  const payload = {
    title,
    description,
    map: {
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      tiles,
      spawn: spawn ?? { x: 0, y: 0 },
      exit: exit ?? { x: 0, y: 0 },
      hpMult: parseFloat(hpSelect?.value ?? "1"),
      speedMult: parseFloat(speedSelect?.value ?? "1"),
    },
    guestId: getGuestId(),
  };

  try {
    setStatus(publish ? "Publishing..." : "Saving...");
    const endpoint = publish ? "/api/maps/publish" : "/api/maps/save";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as { status?: string; mapId?: string; message?: string } | null;
    if (!response.ok || !data || data.status !== "ok") {
      setStatus(data?.message || "Save failed.", true);
      return;
    }
    setStatus(publish ? "Map published." : "Draft saved.");
  } catch {
    setStatus("Save failed.", true);
  }
};

if (canvas) {
  canvas.width = GRID_WIDTH * TILE_SIZE;
  canvas.height = GRID_HEIGHT * TILE_SIZE;
  drawGrid();
}

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    toolButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    currentTool = button.dataset.tool as Tool;
  });
});

canvas?.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
  const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);
  applyTool(x, y);
});

canvas?.addEventListener("pointermove", (event) => {
  if (event.buttons !== 1) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / TILE_SIZE);
  const y = Math.floor((event.clientY - rect.top) / TILE_SIZE);
  applyTool(x, y);
});

undoButton?.addEventListener("click", () => undo());
validateButton?.addEventListener("click", () => validateMap());
saveButton?.addEventListener("click", () => saveMap(false));
publishButton?.addEventListener("click", () => saveMap(true));
backButton?.addEventListener("click", () => window.location.assign("training.html"));

buildMultiplierOptions(hpSelect);
buildMultiplierOptions(speedSelect);
updateStats();
