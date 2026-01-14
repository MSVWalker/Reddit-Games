import express from "express";
import {
  createServer,
  context,
  media,
  getServerPort,
  reddit,
  redis,
} from "@devvit/web/server";
import { RunAs } from "@devvit/public-api";
import { seedFromString } from "../shared/rng";
import { MAX_WAVES } from "../shared/game-data";
import type {
  DailyResponse,
  DailyChallengeClaimResponse,
  DailyChallengeLeaderboardResponse,
  DailyChallengeStatusResponse,
  LeaderboardResponse,
  MapData,
  MapDetailResponse,
  MapListResponse,
  MapPlayRequest,
  MapPlayResponse,
  MapRunRequest,
  MapRunResponse,
  MapSaveRequest,
  MapSaveResponse,
  MapSummary,
  CoopEvent,
  CoopEventRequest,
  CoopEventResponse,
  CoopJoinRequest,
  CoopJoinResponse,
  CoopRunResponse,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
  SubmitScoreRequest,
  SubmitScoreResponse,
} from "../shared/types/api";
import { createPost } from "./core/post";

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const router = express.Router();

const getDailySeed = () => {
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const date = utcDate.toISOString().slice(0, 10);
  const seed = seedFromString(`${date}:lane-defense`);
  return { date, seed };
};

const FEEDBACK_POST_ID = "t3_1q9i8qd";
const MAX_FEEDBACK_LENGTH = 500;
const PST_TIMEZONE = "America/Los_Angeles";
const WEEKLY_TTL_SECONDS = 60 * 60 * 24 * 8;
const WEEKLY_VERSION = "v3";
const DAILY_CHALLENGE_TTL_SECONDS = 60 * 60 * 24 * 2;
const DAILY_CHALLENGE_VERSION = "v1";
const MAP_VERSION = "v1";
const MAP_WIDTH = 31;
const MAP_HEIGHT = 31;
const MAP_PATH_MIN_TILES = 10;
const MAP_PATH_MAX_TILES = 1000;
const MAP_PATH_MIN_LENGTH = 2;
const MAP_HP_MIN = 0.5;
const MAP_HP_MAX = 3;
const MAP_HP_STEP = 0.25;
const MAP_SPEED_MIN = 0.5;
const MAP_SPEED_MAX = 3;
const MAP_SPEED_STEP = 0.25;
const MAP_TITLE_MIN_LENGTH = 1;
const MAP_DESCRIPTION_MIN_LENGTH = 0;
const MAP_PLAY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DAILY_TEST_DAY_MAP: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};
const PST_WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const getPstDateParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let weekday = "Mon";
  for (const part of parts) {
    if (part.type === "year") year = Number(part.value);
    if (part.type === "month") month = Number(part.value);
    if (part.type === "day") day = Number(part.value);
    if (part.type === "weekday") weekday = part.value;
  }
  return {
    year,
    month,
    day,
    weekdayIndex: PST_WEEKDAY_MAP[weekday] ?? 1,
  };
};

const getPstDateKey = () => {
  const { year, month, day } = getPstDateParts();
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
};

const getWeeklyWindow = () => {
  const { year, month, day, weekdayIndex } = getPstDateParts();
  const today = new Date(Date.UTC(year, month - 1, day));
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - (weekdayIndex - 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const weekStartKey = weekStart.toISOString().slice(0, 10);
  const weekEndKey = weekEnd.toISOString().slice(0, 10);
  return { weekKey: weekStartKey, weekStart: weekStartKey, weekEnd: weekEndKey };
};

const DAILY_CHALLENGE_LOCATIONS = [
  { spawn: { x: 0, y: 12 }, exit: { x: 8, y: 12 } },
  { spawn: { x: 0, y: 6 }, exit: { x: 0, y: 12 } },
  { spawn: { x: 2, y: 0 }, exit: { x: 4, y: 0 } },
  { spawn: { x: 0, y: 0 }, exit: { x: 8, y: 12 } },
  { spawn: { x: 8, y: 0 }, exit: { x: 4, y: 0 } },
  { spawn: { x: 8, y: 12 }, exit: { x: 6, y: 12 } },
  { spawn: { x: 0, y: 12 }, exit: { x: 8, y: 0 } },
];

const resolveDailyChallengeDayIndex = (testDay?: string) => {
  if (testDay) {
    const key = testDay.toLowerCase().slice(0, 3);
    if (key in DAILY_TEST_DAY_MAP) {
      return DAILY_TEST_DAY_MAP[key];
    }
  }
  const { weekdayIndex } = getPstDateParts();
  return Math.max(0, Math.min(6, weekdayIndex - 1));
};

const getDailyChallengeConfig = (dayIndex: number, dateKey: string) => {
  const index = Math.max(0, Math.min(6, dayIndex));
  const location = DAILY_CHALLENGE_LOCATIONS[index];
  const seed = seedFromString(`${dateKey}:lane-defense-daily:${index}`);
  return {
    dayIndex: index,
    dateKey,
    seed,
    spawn: location.spawn,
    exit: location.exit,
  };
};

const getDailyChallengeKeys = (dateKey: string, memberId?: string) => {
  const prefix = `daily-challenge:${dateKey}:${DAILY_CHALLENGE_VERSION}`;
  return {
    leaderboardKey: `${prefix}:leaderboard`,
    statsKey: memberId ? `${prefix}:stats:${memberId}` : "",
    attemptsKey: memberId ? `${prefix}:attempts:${memberId}` : "",
  };
};

const resolveMemberId = (userId: string | undefined, guestIdRaw?: string) => {
  if (userId) return userId;
  const guestId = (guestIdRaw ?? "").toLowerCase();
  if (/^[a-z0-9]{8,32}$/.test(guestId)) {
    return `guest:${guestId}`;
  }
  return "";
};

const getWeeklyKeys = (weekKey: string, memberId?: string) => {
  const prefix = `weekly:${weekKey}:${WEEKLY_VERSION}`;
  return {
    leaderboardKey: `${prefix}:leaderboard`,
    statsKey: memberId ? `${prefix}:stats:${memberId}` : "",
    attemptsKey: memberId ? `${prefix}:attempts:${memberId}` : "",
  };
};

const getMapKeys = (mapId: string) => {
  return {
    mapKey: `map:${mapId}:${MAP_VERSION}`,
    postKey: `map-post:${mapId}:${MAP_VERSION}`,
    playsKey: `map:${mapId}:${MAP_VERSION}:plays`,
    statsKey: `map:${mapId}:${MAP_VERSION}:stats`,
  };
};

const getPostMapKey = (postId: string) => `post-map:${MAP_VERSION}:${postId}`;

const getMapIndexKeys = () => ({
  createdKey: `maps:${MAP_VERSION}:created`,
  playsKey: `maps:${MAP_VERSION}:plays`,
  plays7dKey: `maps:${MAP_VERSION}:plays7d`,
});

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isStepValue = (value: number, min: number, max: number, step: number) => {
  if (!Number.isFinite(value)) return false;
  const clamped = clampNumber(value, min, max);
  if (Math.abs(clamped - value) > 1e-6) return false;
  const steps = Math.round((value - min) / step);
  return Math.abs(min + steps * step - value) < 1e-6;
};

const computePathLength = (
  width: number,
  height: number,
  tiles: number[],
  spawn: { x: number; y: number },
  exit: { x: number; y: number }
) => {
  const index = (x: number, y: number) => y * width + x;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
  const isPath = (x: number, y: number) => tiles[index(x, y)] === 2;

  if (!inBounds(spawn.x, spawn.y) || !inBounds(exit.x, exit.y)) return Infinity;
  if (!isPath(spawn.x, spawn.y) || !isPath(exit.x, exit.y)) return Infinity;

  const dist = Array.from({ length: width * height }, () => Number.POSITIVE_INFINITY);
  const queue: { x: number; y: number }[] = [];
  const startIdx = index(spawn.x, spawn.y);
  dist[startIdx] = 0;
  queue.push(spawn);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const currentIdx = index(current.x, current.y);
    const nextDist = dist[currentIdx] + 1;
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    for (const neighbor of neighbors) {
      if (!inBounds(neighbor.x, neighbor.y)) continue;
      if (!isPath(neighbor.x, neighbor.y)) continue;
      const nIdx = index(neighbor.x, neighbor.y);
      if (nextDist < dist[nIdx]) {
        dist[nIdx] = nextDist;
        queue.push(neighbor);
      }
    }
  }

  const endIdx = index(exit.x, exit.y);
  if (!Number.isFinite(dist[endIdx])) return Infinity;
  return dist[endIdx] + 1;
};

const validateMapDefinition = (payload: MapSaveRequest["map"]) => {
  const errors: string[] = [];
  if (!payload) {
    errors.push("Missing map data.");
    return { valid: false, errors };
  }
  if (payload.width !== MAP_WIDTH || payload.height !== MAP_HEIGHT) {
    errors.push(`Map size must be ${MAP_WIDTH}x${MAP_HEIGHT}.`);
  }
  if (!Array.isArray(payload.tiles) || payload.tiles.length !== MAP_WIDTH * MAP_HEIGHT) {
    errors.push("Tile data is incomplete.");
  }
  const spawn = payload.spawn;
  const exit = payload.exit;
  if (!spawn || !exit) {
    errors.push("Spawn and exit must be set.");
  }
  if (!isStepValue(payload.hpMult, MAP_HP_MIN, MAP_HP_MAX, MAP_HP_STEP)) {
    errors.push("HP multiplier out of bounds.");
  }
  if (!isStepValue(payload.speedMult, MAP_SPEED_MIN, MAP_SPEED_MAX, MAP_SPEED_STEP)) {
    errors.push("Speed multiplier out of bounds.");
  }

  const tiles = payload.tiles;
  let pathCount = 0;
  for (const tile of tiles) {
    if (tile !== 0 && tile !== 1 && tile !== 2) {
      errors.push("Tiles contain invalid values.");
      break;
    }
    if (tile === 2 || tile === 1) pathCount += 1;
  }
  if (pathCount < MAP_PATH_MIN_TILES) {
    errors.push(`Board tiles must be at least ${MAP_PATH_MIN_TILES}.`);
  }
  if (pathCount > MAP_PATH_MAX_TILES) {
    errors.push(`Board tiles cannot exceed ${MAP_PATH_MAX_TILES}.`);
  }

  if (spawn && exit && Array.isArray(tiles) && tiles.length === MAP_WIDTH * MAP_HEIGHT) {
    const normalizedTiles = tiles.map((tile) => (tile === 1 ? 2 : tile));
    const pathLength = computePathLength(MAP_WIDTH, MAP_HEIGHT, normalizedTiles, spawn, exit);
    if (!Number.isFinite(pathLength)) {
      errors.push("No valid path from spawn to exit.");
    } else if (pathLength < MAP_PATH_MIN_LENGTH) {
      errors.push(`Path length must be at least ${MAP_PATH_MIN_LENGTH}.`);
    }
  }

  return { valid: errors.length === 0, errors };
};

const generateMapId = () => {
  const rand = Math.random().toString(36).slice(2, 8);
  return `map_${Date.now().toString(36)}_${rand}`;
};

const buildMapPreview = (map: MapSaveRequest["map"]) => {
  const width = map.width;
  const height = map.height;
  const index = (x: number, y: number) => y * width + x;
  const lines: string[] = [];
  for (let y = 0; y < height; y += 1) {
    let row = "";
    for (let x = 0; x < width; x += 1) {
      if (x === map.spawn.x && y === map.spawn.y) {
        row += "S";
        continue;
      }
      if (x === map.exit.x && y === map.exit.y) {
        row += "E";
        continue;
      }
      const tile = map.tiles[index(x, y)];
      row += tile === 2 || tile === 1 ? "~" : "#";
    }
    lines.push(row);
  }
  return lines.join("\n");
};

const buildMapPreviewSvg = (map: MapSaveRequest["map"]) => {
  const width = map.width;
  const height = map.height;
  const tileSize = 8;
  const svgWidth = width * tileSize;
  const svgHeight = height * tileSize;
  const index = (x: number, y: number) => y * width + x;
  let tiles = "";
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = map.tiles[index(x, y)];
      if (tile === 2 || tile === 1) {
        tiles += `<rect x="${x * tileSize}" y="${y * tileSize}" width="${tileSize}" height="${tileSize}" fill="#2d7bd4" />`;
      }
    }
  }
  const spawn = map.spawn;
  const exit = map.exit;
  const spawnCx = (spawn.x + 0.5) * tileSize;
  const spawnCy = (spawn.y + 0.5) * tileSize;
  const exitCx = (exit.x + 0.5) * tileSize;
  const exitCy = (exit.y + 0.5) * tileSize;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect width="100%" height="100%" fill="#050b12"/>
  ${tiles}
  <circle cx="${spawnCx}" cy="${spawnCy}" r="${tileSize * 0.35}" fill="#4fd68c" />
  <circle cx="${exitCx}" cy="${exitCy}" r="${tileSize * 0.35}" fill="#f05f5a" />
</svg>`;
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
};

const normalizeMapTitle = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveCreator = async (userId?: string, guestId?: string) => {
  if (userId) {
    const username = (await reddit.getUserById(userId as `t2_${string}`))?.username ?? "Anonymous";
    return { creatorId: userId, creatorName: username };
  }
  if (guestId) {
    return { creatorId: `guest:${guestId}`, creatorName: "Anonymous" };
  }
  return { creatorId: "anonymous", creatorName: "Anonymous" };
};

const getInstallSubredditName = async () => {
  if (context.subredditName) return context.subredditName;
  try {
    return await reddit.getCurrentSubredditName();
  } catch {
    return "";
  }
};

const formatRedisError = (error: unknown) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError", message: String(error) };
};

const parseStats = (statsRaw: string | null) => {
  if (!statsRaw) {
    return { waves: 0, hp: 0, towers: 0, path: 0, dps: 0 };
  }
  try {
    const stats = JSON.parse(statsRaw) as {
      waves?: number;
      hp?: number;
      towers?: number;
      path?: number;
      dps?: number;
    };
    return {
      waves: stats.waves ?? 0,
      hp: Math.max(0, stats.hp ?? 0),
      towers: stats.towers ?? 0,
      path: stats.path ?? 0,
      dps: stats.dps ?? 0,
    };
  } catch {
    return { waves: 0, hp: 0, towers: 0, path: 0, dps: 0 };
  }
};

const resolveUsername = async (memberId: string) => {
  if (memberId.startsWith("t2_")) {
    try {
      return (await reddit.getUserById(memberId as `t2_${string}`))?.username || "Anonymous";
    } catch {
      return "Anonymous";
    }
  }
  return "Anonymous";
};

router.get<{}, DailyResponse>("/api/daily", async (_req, res): Promise<void> => {
  const { date, seed } = getDailySeed();
  res.json({ type: "daily", date, seed });
});

router.get<{}, DailyChallengeStatusResponse | { status: string; message: string }>(
  "/api/daily-challenge",
  async (req, res): Promise<void> => {
    const { userId } = context;
    const guestRaw = req.query?.guestId;
    const guestId = typeof guestRaw === "string" ? guestRaw : "";
    const testRaw = req.query?.testDay;
    const testDay = typeof testRaw === "string" ? testRaw : "";

    const dateKey = getPstDateKey();
    const dayIndex = resolveDailyChallengeDayIndex(testDay || undefined);
    const config = getDailyChallengeConfig(dayIndex, dateKey);
    const memberId = resolveMemberId(userId, guestId);
    let attemptUsed = false;

    if (memberId && !testDay) {
      try {
        const { attemptsKey } = getDailyChallengeKeys(dateKey, memberId);
        attemptUsed = (await redis.exists(attemptsKey)) > 0;
      } catch (error) {
        console.error("Daily challenge status error", error);
        res.status(500).json({ status: "error", message: "Failed to fetch daily challenge status" });
        return;
      }
    }

    res.json({
      type: "daily-challenge-status",
      date: dateKey,
      dayIndex,
      seed: config.seed,
      spawn: config.spawn,
      exit: config.exit,
      attemptUsed,
      testMode: Boolean(testDay),
    });
  }
);

router.post<{}, DailyChallengeClaimResponse | { status: string; message: string }, { guestId?: string; testDay?: string }>(
  "/api/daily-challenge/claim",
  async (req, res): Promise<void> => {
    const { userId } = context;
    const guestId = req.body?.guestId ?? "";
    const testDay = req.body?.testDay ?? "";

    const dateKey = getPstDateKey();
    const dayIndex = resolveDailyChallengeDayIndex(testDay || undefined);
    const config = getDailyChallengeConfig(dayIndex, dateKey);

    if (testDay) {
      res.json({
        type: "daily-challenge-claim",
        status: "ok",
        date: dateKey,
        dayIndex,
        seed: config.seed,
        spawn: config.spawn,
        exit: config.exit,
        attemptUsed: false,
        testMode: true,
      });
      return;
    }

    const memberId = resolveMemberId(userId, guestId);
    if (!memberId) {
      res.status(403).json({ status: "error", message: "Login required" });
      return;
    }

    try {
      const { attemptsKey } = getDailyChallengeKeys(dateKey, memberId);
      const attemptUsed = (await redis.exists(attemptsKey)) > 0;
      if (attemptUsed) {
        res.json({
          type: "daily-challenge-claim",
          status: "used",
          date: dateKey,
          dayIndex,
          seed: config.seed,
          spawn: config.spawn,
          exit: config.exit,
          attemptUsed: true,
          message: "Daily attempt already used",
        });
        return;
      }
      await redis.set(attemptsKey, "1", {
        expiration: new Date(Date.now() + DAILY_CHALLENGE_TTL_SECONDS * 1000),
      });
      res.json({
        type: "daily-challenge-claim",
        status: "ok",
        date: dateKey,
        dayIndex,
        seed: config.seed,
        spawn: config.spawn,
        exit: config.exit,
        attemptUsed: false,
      });
    } catch (error) {
      console.error("Daily challenge claim error", error);
      res.status(500).json({ status: "error", message: "Failed to claim daily challenge" });
    }
  }
);

router.get<{}, LeaderboardResponse | { status: string; message: string }>(
  "/api/leaderboard",
  async (_req, res): Promise<void> => {
    const { userId } = context;
    const { weekKey, weekStart, weekEnd } = getWeeklyWindow();
    const { leaderboardKey } = getWeeklyKeys(weekKey);
    const guestRaw = _req.query?.guestId;
    const guestId =
      typeof guestRaw === "string" && /^[a-z0-9]{8,32}$/.test(guestRaw) ? guestRaw.toLowerCase() : "";
    const selfMemberId = userId || (guestId ? `guest:${guestId}` : "");

    try {
      const topPlayers = await redis.zRange(leaderboardKey, 0, 499, { reverse: true, by: "rank" });
      const entries = await Promise.all(
        topPlayers.map(async (player) => {
          const memberId = String(player.member);
          const username = await resolveUsername(memberId);
          const { statsKey, attemptsKey } = getWeeklyKeys(weekKey, memberId);
          const [statsRaw, attemptsRaw] = await Promise.all([redis.get(statsKey), redis.get(attemptsKey)]);
          const stats = parseStats(statsRaw);
          const attempts = attemptsRaw ? parseInt(attemptsRaw) : 0;
          return {
            username,
            score: Number(player.score) || 0,
            waves: stats.waves,
            hp: stats.hp,
            towers: stats.towers,
            path: stats.path,
            dps: stats.dps,
            attempts,
          };
        })
      );

      let userRank: number | null = null;
      let selfRank: number | null = null;
      let self: LeaderboardResponse["self"] = null;
      const rankTarget = selfMemberId || userId || "";

      if (rankTarget) {
        const rank = await redis.zRank(leaderboardKey, rankTarget);
        if (rank !== undefined) {
          const totalCount = await redis.zCard(leaderboardKey);
          userRank = totalCount - rank;
          selfRank = userRank;
        }
      }

      if (selfMemberId) {
        const { statsKey, attemptsKey } = getWeeklyKeys(weekKey, selfMemberId);
        const [bestScoreRaw, statsRaw, attemptsRaw] = await Promise.all([
          redis.zScore(leaderboardKey, selfMemberId),
          redis.get(statsKey),
          redis.get(attemptsKey),
        ]);
        const bestScore = Number.isFinite(bestScoreRaw as number) ? (bestScoreRaw as number) : Number.NaN;
        const attempts = attemptsRaw ? parseInt(attemptsRaw) : 0;
        if (Number.isFinite(bestScore)) {
          const stats = parseStats(statsRaw);
          self = {
            username: "You",
            score: bestScore,
            waves: stats.waves,
            hp: stats.hp,
            towers: stats.towers,
            path: stats.path,
            dps: stats.dps,
            attempts,
          };
        }
      }

      res.json({
        type: "leaderboard",
        date: weekKey,
        weekStart,
        weekEnd,
        entries,
        userRank,
        self,
        selfRank,
      });
    } catch (error) {
      console.error("Leaderboard error", error);
      res.status(500).json({ status: "error", message: "Failed to fetch leaderboard" });
    }
  }
);

router.get<{}, DailyChallengeLeaderboardResponse | { status: string; message: string }>(
  "/api/daily-challenge-leaderboard",
  async (req, res): Promise<void> => {
    const { userId } = context;
    const guestRaw = req.query?.guestId;
    const guestId = typeof guestRaw === "string" ? guestRaw : "";
    const testRaw = req.query?.testDay;
    const testDay = typeof testRaw === "string" ? testRaw : "";
    const dateKey = getPstDateKey();
    const dayIndex = resolveDailyChallengeDayIndex(testDay || undefined);
    const { leaderboardKey } = getDailyChallengeKeys(dateKey);
    const memberId = resolveMemberId(userId, guestId);
    const selfMemberId = memberId;

    try {
      const topPlayers = await redis.zRange(leaderboardKey, 0, 499, { reverse: true, by: "rank" });
      const entries = await Promise.all(
        topPlayers.map(async (player) => {
          const entryMemberId = String(player.member);
          const username = await resolveUsername(entryMemberId);
          const { statsKey, attemptsKey } = getDailyChallengeKeys(dateKey, entryMemberId);
          const [statsRaw, attemptsRaw] = await Promise.all([redis.get(statsKey), redis.get(attemptsKey)]);
          const stats = parseStats(statsRaw);
          const attempts = attemptsRaw ? parseInt(attemptsRaw) : 0;
          return {
            username,
            score: Number(player.score) || 0,
            waves: stats.waves,
            hp: stats.hp,
            towers: stats.towers,
            path: stats.path,
            dps: stats.dps,
            attempts,
          };
        })
      );

      let userRank: number | null = null;
      let selfRank: number | null = null;
      let self: DailyChallengeLeaderboardResponse["self"] = null;

      if (selfMemberId) {
        const rank = await redis.zRank(leaderboardKey, selfMemberId);
        if (rank !== undefined) {
          const totalCount = await redis.zCard(leaderboardKey);
          userRank = totalCount - rank;
          selfRank = userRank;
        }
        const { statsKey, attemptsKey } = getDailyChallengeKeys(dateKey, selfMemberId);
        const [bestScoreRaw, statsRaw, attemptsRaw] = await Promise.all([
          redis.zScore(leaderboardKey, selfMemberId),
          redis.get(statsKey),
          redis.get(attemptsKey),
        ]);
        const bestScore = Number.isFinite(bestScoreRaw as number) ? (bestScoreRaw as number) : Number.NaN;
        const attempts = attemptsRaw ? parseInt(attemptsRaw) : 0;
        if (Number.isFinite(bestScore)) {
          const stats = parseStats(statsRaw);
          self = {
            username: "You",
            score: bestScore,
            waves: stats.waves,
            hp: stats.hp,
            towers: stats.towers,
            path: stats.path,
            dps: stats.dps,
            attempts,
          };
        }
      }

      res.json({
        type: "daily-challenge-leaderboard",
        date: dateKey,
        dayIndex,
        entries,
        userRank,
        self,
        selfRank,
      });
    } catch (error) {
      console.error("Daily challenge leaderboard error", error);
      res.status(500).json({ status: "error", message: "Failed to fetch daily leaderboard" });
    }
  }
);

router.post<{}, MapSaveResponse | { status: string; message: string }, MapSaveRequest>(
  "/api/maps/save",
  async (req, res): Promise<void> => {
    const { userId } = context;
    const payload = req.body as MapSaveRequest;
    const guestId = payload.guestId ?? "";
    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    const { valid, errors } = validateMapDefinition(payload.map);
    if (!valid) {
      res.status(400).json({ type: "map-save", status: "error", message: errors.join(" ") });
      return;
    }
    if (title.length < MAP_TITLE_MIN_LENGTH) {
      res.status(400).json({ type: "map-save", status: "error", message: "Title required." });
      return;
    }
    if (description.length < MAP_DESCRIPTION_MIN_LENGTH) {
      res.status(400).json({
        type: "map-save",
        status: "error",
        message: "Description required.",
      });
      return;
    }
    const titleKey = normalizeMapTitle(title);
    if (!titleKey) {
      res.status(400).json({ type: "map-save", status: "error", message: "Title required." });
      return;
    }
    const titleIndexKey = `maps:${MAP_VERSION}:title:${titleKey}`;
    const existingTitle = await redis.get(titleIndexKey);
    if (existingTitle) {
      res.status(400).json({
        type: "map-save",
        status: "error",
        message: "Title already used. Choose a unique title.",
      });
      return;
    }

    const { creatorId, creatorName } = await resolveCreator(userId, guestId);
    const mapId = generateMapId();
    const createdAt = Date.now();
    const map: MapData = {
      id: mapId,
      title,
      description,
      width: payload.map.width,
      height: payload.map.height,
      tiles: payload.map.tiles,
      spawn: payload.map.spawn,
      exit: payload.map.exit,
      hpMult: payload.map.hpMult,
      speedMult: payload.map.speedMult,
      creatorId,
      creatorName,
      createdAt,
      version: 1,
      published: false,
      totalPlays: 0,
      plays7d: 0,
    };

    const { mapKey } = getMapKeys(mapId);
    try {
      await redis.set(mapKey, JSON.stringify(map));
      await redis.set(titleIndexKey, mapId);
      res.json({ type: "map-save", status: "ok", mapId });
    } catch (error) {
      console.error("Map save error", error);
      res.status(500).json({ type: "map-save", status: "error", message: "Failed to save map" });
    }
  }
);

router.post<{}, MapSaveResponse | { status: string; message: string }, MapSaveRequest>(
  "/api/maps/publish",
  async (req, res): Promise<void> => {
    const { userId } = context;
    const payload = req.body as MapSaveRequest;
    const guestId = payload.guestId ?? "";
    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    const { valid, errors } = validateMapDefinition(payload.map);
    if (!valid) {
      res.status(400).json({ type: "map-save", status: "error", message: errors.join(" ") });
      return;
    }
    if (title.length < MAP_TITLE_MIN_LENGTH) {
      res.status(400).json({ type: "map-save", status: "error", message: "Title required." });
      return;
    }
    if (description.length < MAP_DESCRIPTION_MIN_LENGTH) {
      res.status(400).json({
        type: "map-save",
        status: "error",
        message: "Description required.",
      });
      return;
    }
    const titleKey = normalizeMapTitle(title);
    if (!titleKey) {
      res.status(400).json({ type: "map-save", status: "error", message: "Title required." });
      return;
    }
    const titleIndexKey = `maps:${MAP_VERSION}:title:${titleKey}`;
    const existingTitle = await redis.get(titleIndexKey);
    if (existingTitle) {
      res.status(400).json({
        type: "map-save",
        status: "error",
        message: "Title already used. Choose a unique title.",
      });
      return;
    }
    if (!userId) {
      res.status(403).json({ type: "map-save", status: "error", message: "Login required to publish." });
      return;
    }
    const expectedUsername = (await reddit.getUserById(userId as `t2_${string}`))?.username ?? "";
    if (!expectedUsername) {
      res.status(403).json({ type: "map-save", status: "error", message: "Authorize posting to publish maps." });
      return;
    }

    const subredditName = await getInstallSubredditName();
    if (!subredditName) {
      res.status(400).json({ type: "map-save", status: "error", message: "Subreddit unavailable" });
      return;
    }

    const { creatorId, creatorName } = await resolveCreator(userId, guestId);
    const mapId = generateMapId();
    const createdAt = Date.now();
    const map: MapData = {
      id: mapId,
      title,
      description,
      width: payload.map.width,
      height: payload.map.height,
      tiles: payload.map.tiles,
      spawn: payload.map.spawn,
      exit: payload.map.exit,
      hpMult: payload.map.hpMult,
      speedMult: payload.map.speedMult,
      creatorId,
      creatorName,
      createdAt,
      version: 1,
      published: true,
      totalPlays: 0,
      plays7d: 0,
    };

    const preview = buildMapPreview(payload.map);
    let previewImageUrl: string | null = null;
    try {
      const svgData = buildMapPreviewSvg(payload.map);
      const uploaded = await media.upload({ type: "image", url: svgData });
      previewImageUrl = uploaded?.mediaUrl ?? null;
    } catch (error) {
      console.warn("Map preview upload failed", error);
      previewImageUrl = null;
    }
    let postId = "";
    try {
      const post = await reddit.submitCustomPost({
        subredditName,
        title: `Map: ${map.title}`,
        runAs: "USER" as const,
        userGeneratedContent: {
          text: `${map.description}\n\nMap ID: ${mapId}\n\nPreview:\n\n\`\`\`\n${preview}\n\`\`\``,
          imageUrls: previewImageUrl ? [previewImageUrl] : [],
        },
        entry: "game",
        textFallback: {
          text: `${map.description}\n\nMap ID: ${mapId}\n\nPreview:\n\n${preview}`,
        },
      });
      const authorName = post?.author ?? "";
      if (
        authorName &&
        expectedUsername &&
        authorName.toLowerCase() !== expectedUsername.toLowerCase()
      ) {
        res.status(403).json({
          type: "map-save",
          status: "error",
          message: "Authorize posting to publish maps as your username.",
        });
        return;
      }
      postId = post.id;
      const normalizedPostId = postId.startsWith("t3_") ? postId : `t3_${postId}`;
      map.postId = normalizedPostId;
    } catch (error) {
      console.error("Map publish post error", error);
      res.status(403).json({
        type: "map-save",
        status: "error",
        message: "Authorize posting to publish maps as your username.",
      });
      return;
    }

    const { mapKey, postKey } = getMapKeys(mapId);
    const normalizedPostId = postId ? (postId.startsWith("t3_") ? postId : `t3_${postId}`) : "";
    const postMapKey = postId ? getPostMapKey(postId) : "";
    const postMapKeyNormalized = normalizedPostId ? getPostMapKey(normalizedPostId) : "";
    const { createdKey, playsKey, plays7dKey } = getMapIndexKeys();
    try {
      await redis.set(mapKey, JSON.stringify(map));
      await redis.zAdd(createdKey, { member: mapId, score: createdAt });
      await redis.zAdd(playsKey, { member: mapId, score: 0 });
      await redis.zAdd(plays7dKey, { member: mapId, score: 0 });
      await redis.set(titleIndexKey, mapId);
      if (postId) {
        await redis.set(postKey, postId);
        if (postMapKey) {
          await redis.set(postMapKey, mapId);
        }
        if (postMapKeyNormalized && postMapKeyNormalized !== postMapKey) {
          await redis.set(postMapKeyNormalized, mapId);
        }
      }
      res.json({ type: "map-save", status: "ok", mapId, postId });
    } catch (error) {
      console.error("Map publish error", error);
      res.status(500).json({ type: "map-save", status: "error", message: "Failed to publish map" });
    }
  }
);

router.get<{}, MapListResponse | { status: string; message: string }>(
  "/api/maps/list",
  async (req, res): Promise<void> => {
    const sort = typeof req.query?.sort === "string" ? req.query.sort : "trending";
    const { createdKey, playsKey, plays7dKey } = getMapIndexKeys();
    const key =
      sort === "new" ? createdKey : sort === "most" ? playsKey : plays7dKey;
    try {
      const ids = await redis.zRange(key, 0, 199, { reverse: true, by: "rank" });
      const entries: MapSummary[] = [];
      for (const id of ids) {
        const mapId =
          typeof id === "string"
            ? id
            : typeof (id as { member?: string }).member === "string"
            ? (id as { member: string }).member
            : "";
        if (!mapId) continue;
        const { mapKey } = getMapKeys(mapId);
        const raw = await redis.get(mapKey);
        if (!raw) continue;
        const map = JSON.parse(raw) as MapData;
        if (!map.published) continue;
        entries.push({
          id: map.id,
          title: map.title,
          creatorName: map.creatorName,
          createdAt: map.createdAt,
          totalPlays: map.totalPlays,
          plays7d: map.plays7d,
        });
        if (entries.length >= 50) break;
      }
      res.json({ type: "map-list", entries });
    } catch (error) {
      console.error("Map list error", error);
      res.status(500).json({ status: "error", message: "Failed to load maps" });
    }
  }
);

router.get<{}, MapDetailResponse | { status: string; message: string }>(
  "/api/maps/:id",
  async (req, res): Promise<void> => {
    const mapId = req.params.id;
    const { mapKey } = getMapKeys(mapId);
    try {
      const raw = await redis.get(mapKey);
      if (!raw) {
        res.status(404).json({ status: "error", message: "Map not found" });
        return;
      }
      const map = JSON.parse(raw) as MapData;
      res.json({ type: "map", map });
    } catch (error) {
      console.error("Map fetch error", error);
      res.status(500).json({ status: "error", message: "Failed to load map" });
    }
  }
);

router.get<{}, MapDetailResponse | { status: string; message: string }>(
  "/api/maps/from-post",
  async (_req, res): Promise<void> => {
    const postId = context.postId;
    if (!postId) {
      res.status(400).json({ status: "error", message: "Post context unavailable" });
      return;
    }
    const normalizedPostId = postId.startsWith("t3_") ? postId : `t3_${postId}`;
    const postMapKey = getPostMapKey(postId);
    const postMapKeyNormalized = getPostMapKey(normalizedPostId);
    try {
      const mapId = (await redis.get(postMapKey)) ?? (await redis.get(postMapKeyNormalized));
      if (!mapId) {
        res.status(404).json({
          status: "error",
          message: "Map not found",
          debug: { postId, normalizedPostId, postMapKey, postMapKeyNormalized },
        });
        return;
      }
      const { mapKey } = getMapKeys(mapId);
      const raw = await redis.get(mapKey);
      if (!raw) {
        res.status(404).json({
          status: "error",
          message: "Map not found",
          debug: { postId, normalizedPostId, postMapKey, postMapKeyNormalized, mapId },
        });
        return;
      }
      const map = JSON.parse(raw) as MapData;
      res.json({ type: "map", map });
    } catch (error) {
      console.error("Map post lookup error", error);
      res.status(500).json({ status: "error", message: "Failed to load map" });
    }
  }
);

router.post<{}, MapPlayResponse | { status: string; message: string }, MapPlayRequest>(
  "/api/maps/play",
  async (req, res): Promise<void> => {
    const mapId = req.body?.mapId;
    if (!mapId) {
      res.status(400).json({ type: "map-play", status: "error", message: "Missing map id" });
      return;
    }
    const { mapKey, playsKey } = getMapKeys(mapId);
    const { playsKey: playsIndexKey, plays7dKey } = getMapIndexKeys();
    try {
      const raw = await redis.get(mapKey);
      if (!raw) {
        res.status(404).json({ type: "map-play", status: "error", message: "Map not found" });
        return;
      }
      const map = JSON.parse(raw) as MapData;
      const now = Date.now();
      const playMember = `${now}:${Math.random().toString(36).slice(2, 8)}`;
      await redis.zAdd(playsKey, { member: playMember, score: now });
      await redis.zRemRangeByScore(playsKey, 0, now - MAP_PLAY_WINDOW_MS);
      const plays7d = await redis.zCard(playsKey);
      map.totalPlays = (map.totalPlays ?? 0) + 1;
      map.plays7d = plays7d;
      await redis.set(mapKey, JSON.stringify(map));
      await redis.zIncrBy(playsIndexKey, mapId, 1);
      await redis.zAdd(plays7dKey, { member: mapId, score: plays7d });
      res.json({ type: "map-play", status: "ok" });
    } catch (error) {
      console.error("Map play error", error);
      res.status(500).json({ type: "map-play", status: "error", message: "Failed to record play" });
    }
  }
);

router.post<{}, MapRunResponse | { status: string; message: string }, MapRunRequest>(
  "/api/maps/run",
  async (req, res): Promise<void> => {
    const payload = req.body as MapRunRequest;
    if (!payload?.mapId) {
      res.status(400).json({ type: "map-run", status: "error", message: "Missing map id" });
      return;
    }
    const { statsKey } = getMapKeys(payload.mapId);
    try {
      const victoriesKey = `${statsKey}:victories`;
      const defeatsKey = `${statsKey}:defeats`;
      if (payload.status === "victory") {
        await redis.incrBy(victoriesKey, 1);
      } else {
        await redis.incrBy(defeatsKey, 1);
      }
      res.json({ type: "map-run", status: "ok" });
    } catch (error) {
      console.error("Map run error", error);
      res.status(500).json({ type: "map-run", status: "error", message: "Failed to record run" });
    }
  }
);

router.post<{}, CoopJoinResponse | { status: string; message: string }, CoopJoinRequest>(
  "/api/coop/join",
  async (req, res): Promise<void> => {
    const { userId } = context;
    const payload = req.body as CoopJoinRequest;
    const guestId = payload.guestId ?? "";
    const memberId = resolveMemberId(userId, guestId);
    if (!memberId) {
      res.status(403).json({ type: "coop-join", status: "error", message: "Login required" });
      return;
    }
    const queueKey = `coop:${MAP_VERSION}:queue`;
    const runId = payload.runId ?? generateMapId();
    const runKey = `coop:${MAP_VERSION}:run:${runId}`;
    const seed = seedFromString(`${runId}:${Date.now()}`);

    try {
      if (payload.mode === "queue") {
        const waiting = await redis.get(queueKey);
        if (waiting) {
          const existingRaw = await redis.get(`coop:${MAP_VERSION}:run:${waiting}`);
          if (existingRaw) {
            const existing = JSON.parse(existingRaw) as {
              runId: string;
              seed: number;
              mapId: string;
              builderId: string;
              wizardId?: string;
            };
            if (!existing.wizardId) {
              existing.wizardId = memberId;
              await redis.set(`coop:${MAP_VERSION}:run:${waiting}`, JSON.stringify(existing));
              await redis.del(queueKey);
              res.json({
                type: "coop-join",
                status: "ok",
                runId: existing.runId,
                role: "wizard",
                seed: existing.seed,
                mapId: existing.mapId,
              });
              return;
            }
          }
        }
        const newRun = { runId, seed, mapId: "", builderId: memberId, wizardId: "" };
        await redis.set(runKey, JSON.stringify(newRun));
        await redis.set(queueKey, runId);
        res.json({ type: "coop-join", status: "ok", runId, role: "builder", seed, mapId: "" });
        return;
      }

      if (!payload.runId) {
        const newRun = { runId, seed, mapId: "", builderId: memberId, wizardId: "" };
        await redis.set(runKey, JSON.stringify(newRun));
        res.json({ type: "coop-join", status: "ok", runId, role: "builder", seed, mapId: "" });
        return;
      }

      const existingRaw = await redis.get(runKey);
      if (!existingRaw) {
        res.status(404).json({ type: "coop-join", status: "error", message: "Run not found" });
        return;
      }
      const existing = JSON.parse(existingRaw) as {
        runId: string;
        seed: number;
        mapId: string;
        builderId: string;
        wizardId?: string;
      };
      if (!existing.wizardId) {
        existing.wizardId = memberId;
        await redis.set(runKey, JSON.stringify(existing));
        res.json({
          type: "coop-join",
          status: "ok",
          runId,
          role: "wizard",
          seed: existing.seed,
          mapId: existing.mapId,
        });
        return;
      }
      res.status(400).json({ type: "coop-join", status: "error", message: "Run already full" });
    } catch (error) {
      console.error("Co-op join error", error);
      res.status(500).json({ type: "coop-join", status: "error", message: "Failed to join co-op" });
    }
  }
);

router.get<{}, CoopRunResponse | { status: string; message: string }>(
  "/api/coop/run",
  async (req, res): Promise<void> => {
    const runId = typeof req.query?.runId === "string" ? req.query.runId : "";
    const sinceRaw = typeof req.query?.since === "string" ? req.query.since : "0";
    const since = parseInt(sinceRaw) || 0;
    if (!runId) {
      res.status(400).json({ type: "coop-run", status: "error", message: "Missing run id" });
      return;
    }
    const runKey = `coop:${MAP_VERSION}:run:${runId}`;
    const eventsKey = `coop:${MAP_VERSION}:events:${runId}`;
    try {
      const raw = await redis.get(runKey);
      if (!raw) {
        res.status(404).json({ type: "coop-run", status: "error", message: "Run not found" });
        return;
      }
      const run = JSON.parse(raw) as { runId: string; seed: number; mapId: string };
      const members = await redis.zRange(eventsKey, `${since + 1}`, "+inf", { by: "score" });
      const events: CoopEvent[] = [];
      let nextSeq = since;
      for (const member of members) {
        try {
          const parsed = JSON.parse(String(member)) as CoopEvent;
          events.push(parsed);
          nextSeq = Math.max(nextSeq, parsed.seq);
        } catch {
          // Ignore bad event.
        }
      }
      res.json({
        type: "coop-run",
        status: "ok",
        runId,
        seed: run.seed,
        mapId: run.mapId,
        events,
        nextSeq,
      });
    } catch (error) {
      console.error("Co-op run error", error);
      res.status(500).json({ type: "coop-run", status: "error", message: "Failed to fetch run" });
    }
  }
);

router.post<{}, CoopEventResponse | { status: string; message: string }, CoopEventRequest>(
  "/api/coop/event",
  async (req, res): Promise<void> => {
    const { userId } = context;
    const payload = req.body as CoopEventRequest;
    const memberId = resolveMemberId(userId, payload.guestId);
    if (!memberId) {
      res.status(403).json({ type: "coop-event", status: "error", message: "Login required" });
      return;
    }
    const runId = payload.runId;
    const runKey = `coop:${MAP_VERSION}:run:${runId}`;
    const eventsKey = `coop:${MAP_VERSION}:events:${runId}`;
    const seqKey = `coop:${MAP_VERSION}:seq:${runId}`;

    try {
      const raw = await redis.get(runKey);
      if (!raw) {
        res.status(404).json({ type: "coop-event", status: "error", message: "Run not found" });
        return;
      }
      const run = JSON.parse(raw) as { builderId: string; wizardId?: string };
      const allowedBuilder = new Set(["build", "upgrade", "sell", "target", "start-wave"]);
      const allowedWizard = new Set(["spell", "contract"]);
      const isBuilder = run.builderId === memberId && payload.role === "builder";
      const isWizard = run.wizardId === memberId && payload.role === "wizard";
      const allowed = isBuilder ? allowedBuilder : isWizard ? allowedWizard : null;
      if (!allowed || !allowed.has(payload.type)) {
        res.status(403).json({ type: "coop-event", status: "error", message: "Event not allowed" });
        return;
      }
      const seq = await redis.incrBy(seqKey, 1);
      const event: CoopEvent = {
        seq,
        type: payload.type,
        tick: payload.tick,
        payload: payload.payload ?? {},
      };
      await redis.zAdd(eventsKey, { member: JSON.stringify(event), score: seq });
      res.json({ type: "coop-event", status: "ok", nextSeq: seq });
    } catch (error) {
      console.error("Co-op event error", error);
      res.status(500).json({ type: "coop-event", status: "error", message: "Failed to record event" });
    }
  }
);

router.post<{}, SubmitScoreResponse | { status: string; message: string }, SubmitScoreRequest>(
  "/api/submit-score",
  async (req, res): Promise<void> => {
    const { userId } = context;

    const payload = req.body as SubmitScoreRequest;
    const { weekKey } = getWeeklyWindow();

    if (
      !payload ||
      !Number.isFinite(payload.score) ||
      !Number.isFinite(payload.waves) ||
      !Number.isFinite(payload.hp) ||
      !Number.isFinite(payload.towers) ||
      !Number.isFinite(payload.path) ||
      !Number.isFinite(payload.dps) ||
      payload.score < 0 ||
      payload.waves < 0 ||
      payload.waves > MAX_WAVES ||
      payload.towers < 0 ||
      payload.path < 0 ||
      payload.dps < 0
    ) {
      res.status(400).json({ status: "error", message: "Invalid score payload" });
      return;
    }

    const sanitizedHp = Math.max(0, payload.hp);

    let memberId = userId ?? "";
    if (!memberId) {
      const guestId = (payload.guestId ?? "").toLowerCase();
      if (!/^[a-z0-9]{8,32}$/.test(guestId)) {
        res.status(403).json({ status: "error", message: "Login required" });
        return;
      }
      memberId = `guest:${guestId}`;
    }

    const { leaderboardKey, statsKey, attemptsKey } = getWeeklyKeys(weekKey, memberId);
    const fail = (step: string, error: unknown) => {
      const debug = { step, ...formatRedisError(error) };
      console.error("Submit score error", debug, { memberId, weekKey });
      res.status(500).json({ status: "error", message: "Failed to submit score", debug });
    };

    try {
      let currentBestRaw: number | undefined;
      try {
        currentBestRaw = await redis.zScore(leaderboardKey, memberId);
      } catch (error) {
        fail("redis.zScore", error);
        return;
      }
      const currentBest = Number.isFinite(currentBestRaw as number) ? (currentBestRaw as number) : Number.NEGATIVE_INFINITY;
      let bestScore = currentBest;
      const shouldUpdateBest = payload.score > currentBest;
      const shouldUpdateStats = payload.score >= currentBest;

      try {
        await redis.incrBy(attemptsKey, 1);
        await redis.expire(attemptsKey, WEEKLY_TTL_SECONDS);
      } catch (error) {
        fail("redis.incrBy/expire", error);
        return;
      }

      if (shouldUpdateStats) {
        try {
          await redis.set(
            statsKey,
            JSON.stringify({
              waves: payload.waves,
              hp: sanitizedHp,
              towers: payload.towers,
              path: payload.path,
              dps: payload.dps,
            })
          );
          await redis.expire(statsKey, WEEKLY_TTL_SECONDS);
        } catch (error) {
          fail("redis.set/expire stats", error);
          return;
        }
      }

      if (shouldUpdateBest) {
        bestScore = payload.score;
        try {
          await redis.zAdd(leaderboardKey, { member: memberId, score: payload.score });
          await redis.expire(leaderboardKey, WEEKLY_TTL_SECONDS);
        } catch (error) {
          fail("redis.zAdd/expire leaderboard", error);
          return;
        }
      }

      let rank: number | null = null;
      let userRank: number | undefined;
      try {
        userRank = await redis.zRank(leaderboardKey, memberId);
      } catch (error) {
        fail("redis.zRank", error);
        return;
      }
      if (userRank !== undefined) {
        let totalCount = 0;
        try {
          totalCount = await redis.zCard(leaderboardKey);
        } catch (error) {
          fail("redis.zCard", error);
          return;
        }
        rank = totalCount - userRank;
      }

      res.json({ type: "submit", status: "ok", rank, bestScore });
    } catch (error) {
      const debug = formatRedisError(error);
      console.error("Submit score error", debug, { memberId, weekKey });
      res.status(500).json({ status: "error", message: "Failed to submit score", debug });
    }
  }
);

router.post<{}, SubmitScoreResponse | { status: string; message: string }, SubmitScoreRequest>(
  "/api/submit-daily-score",
  async (req, res): Promise<void> => {
    const { userId } = context;

    const payload = req.body as SubmitScoreRequest;
    const dateKey = getPstDateKey();

    if (
      !payload ||
      !Number.isFinite(payload.score) ||
      !Number.isFinite(payload.waves) ||
      !Number.isFinite(payload.hp) ||
      !Number.isFinite(payload.towers) ||
      !Number.isFinite(payload.path) ||
      !Number.isFinite(payload.dps) ||
      payload.score < 0 ||
      payload.waves < 0 ||
      payload.waves > MAX_WAVES ||
      payload.towers < 0 ||
      payload.path < 0 ||
      payload.dps < 0
    ) {
      res.status(400).json({ status: "error", message: "Invalid score payload" });
      return;
    }

    const sanitizedHp = Math.max(0, payload.hp);
    const memberId = resolveMemberId(userId, payload.guestId);
    if (!memberId) {
      res.status(403).json({ status: "error", message: "Login required" });
      return;
    }

    const { leaderboardKey, statsKey, attemptsKey } = getDailyChallengeKeys(dateKey, memberId);
    const fail = (step: string, error: unknown) => {
      const debug = { step, ...formatRedisError(error) };
      console.error("Daily submit score error", debug, { memberId, dateKey });
      res.status(500).json({ status: "error", message: "Failed to submit score", debug });
    };

    try {
      const attemptUsed = (await redis.exists(attemptsKey)) > 0;
      if (!attemptUsed) {
        res.status(403).json({ status: "error", message: "Daily attempt not claimed" });
        return;
      }

      let currentBestRaw: number | undefined;
      try {
        currentBestRaw = await redis.zScore(leaderboardKey, memberId);
      } catch (error) {
        fail("redis.zScore", error);
        return;
      }
      const currentBest = Number.isFinite(currentBestRaw as number) ? (currentBestRaw as number) : Number.NEGATIVE_INFINITY;
      let bestScore = currentBest;
      const shouldUpdateBest = payload.score > currentBest;
      const shouldUpdateStats = payload.score >= currentBest;

      if (shouldUpdateStats) {
        try {
          await redis.set(
            statsKey,
            JSON.stringify({
              waves: payload.waves,
              hp: sanitizedHp,
              towers: payload.towers,
              path: payload.path,
              dps: payload.dps,
            })
          );
          await redis.expire(statsKey, DAILY_CHALLENGE_TTL_SECONDS);
        } catch (error) {
          fail("redis.set/expire stats", error);
          return;
        }
      }

      if (shouldUpdateBest) {
        bestScore = payload.score;
        try {
          await redis.zAdd(leaderboardKey, { member: memberId, score: payload.score });
          await redis.expire(leaderboardKey, DAILY_CHALLENGE_TTL_SECONDS);
        } catch (error) {
          fail("redis.zAdd/expire leaderboard", error);
          return;
        }
      }

      let rank: number | null = null;
      let userRank: number | undefined;
      try {
        userRank = await redis.zRank(leaderboardKey, memberId);
      } catch (error) {
        fail("redis.zRank", error);
        return;
      }
      if (userRank !== undefined) {
        let totalCount = 0;
        try {
          totalCount = await redis.zCard(leaderboardKey);
        } catch (error) {
          fail("redis.zCard", error);
          return;
        }
        rank = totalCount - userRank;
      }

      res.json({ type: "submit", status: "ok", rank, bestScore });
    } catch (error) {
      const debug = formatRedisError(error);
      console.error("Daily submit score error", debug, { memberId, dateKey });
      res.status(500).json({ status: "error", message: "Failed to submit score", debug });
    }
  }
);

router.post<{}, SubmitFeedbackResponse | { status: string; message: string }, SubmitFeedbackRequest>(
  "/api/submit-feedback",
  async (req, res): Promise<void> => {
    const { userId } = context;
    const text = (req.body?.text ?? "").trim();

    if (!text) {
      res.status(400).json({ status: "error", message: "Comment cannot be empty" });
      return;
    }
    if (text.length > MAX_FEEDBACK_LENGTH) {
      res.status(400).json({ status: "error", message: "Comment too long" });
      return;
    }
    if (!userId) {
      res.status(403).json({ status: "error", message: "Login required to comment" });
      return;
    }

    try {
      const comment = await reddit.submitComment({
        id: FEEDBACK_POST_ID,
        text,
        runAs: "USER" as const,
      });
      let expectedUsername = "";
      try {
        expectedUsername = (await reddit.getUserById(userId as `t2_${string}`))?.username ?? "";
      } catch {
        expectedUsername = "";
      }
      const authorName = comment?.authorName ?? "";
      const asUser =
        Boolean(authorName) &&
        Boolean(expectedUsername) &&
        authorName.toLowerCase() === expectedUsername.toLowerCase();
      if (expectedUsername && !asUser) {
        res.status(403).json({
          type: "feedback",
          status: "error",
          message: "Authorize posting to comment as your username.",
          authorName: authorName || undefined,
          asUser: false,
        });
        return;
      }
      res.json({
        type: "feedback",
        status: "ok",
        authorName: authorName || undefined,
        asUser: expectedUsername ? asUser : undefined,
      });
    } catch (error) {
      console.error("Submit feedback error", error);
      res.status(500).json({ status: "error", message: "Failed to submit comment" });
    }
  }
);

router.post("/api/debug/as-user-comment", async (_req, res): Promise<void> => {
  const { userId } = context;
  if (!userId) {
    res.status(403).json({ status: "error", message: "Login required" });
    return;
  }
  let expectedUsername = "";
  try {
    expectedUsername = (await reddit.getUserById(userId as `t2_${string}`))?.username ?? "";
  } catch {
    expectedUsername = "";
  }
  try {
    const comment = await reddit.submitComment({
      id: FEEDBACK_POST_ID,
      text: `DEBUG permission check ${new Date().toISOString()}`,
      runAs: "USER" as const,
    });
    res.json({
      type: "debug-as-user-comment",
      status: "ok",
      expectedUsername: expectedUsername || null,
      authorName: comment?.authorName ?? null,
    });
  } catch (error) {
    console.error("Debug as-user comment error", error);
    res.status(500).json({ status: "error", message: "Failed to submit debug comment" });
  }
});

router.get("/api/viewer-snoovatar", async (_req, res): Promise<void> => {
  const log = (...args: unknown[]) => console.warn("[viewer-snoovatar]", ...args);

  let username = context.username?.trim() || "";
  if (!username && context.userId) {
    try {
      username = (await reddit.getCurrentUsername()) ?? "";
    } catch {
      username = "";
    }
  }

  if (!username) {
    log("no username available on request");
    res.status(404).end();
    return;
  }

  const cacheKey = `snoovatarUrl:${username.toLowerCase()}`;
  let snoovatarUrl: string | null = context.snoovatar ?? null;

  if (!snoovatarUrl) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        snoovatarUrl = cached === "none" ? null : cached;
        log("cache hit", { username, cached: cached === "none" ? "none" : "url" });
      } else {
        const fetched = await reddit.getSnoovatarUrl(username);
        snoovatarUrl = fetched ?? null;
        await redis.set(cacheKey, snoovatarUrl ?? "none");
        await redis.expire(cacheKey, 60 * 60 * 24);
        log("cache miss", { username, fetched: Boolean(fetched) });
      }
    } catch {
      log("error reading cache or fetching snoovatar", { username });
      snoovatarUrl = null;
    }
  }

  if (!snoovatarUrl) {
    log("no snoovatar url", { username });
    res.status(404).end();
    return;
  }

  let url: URL;
  try {
    url = new URL(snoovatarUrl);
  } catch {
    res.status(404).end();
    return;
  }

  if (url.protocol !== "https:") {
    res.status(404).end();
    return;
  }

  const host = url.hostname.toLowerCase();
  const allowed = ["redd.it", "redditmedia.com", "redditstatic.com"].some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
  if (!allowed) {
    res.status(404).end();
    return;
  }

  try {
    const response = await fetch(snoovatarUrl);
    if (!response.ok) {
      log("upstream fetch failed", { status: response.status, username });
      res.status(502).end();
      return;
    }

    const contentType = response.headers.get("content-type") ?? "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");

    const bytes = Buffer.from(await response.arrayBuffer());
    res.status(200).send(bytes);
  } catch (error) {
    log("error fetching snoovatar upstream", { username, message: (error as Error)?.message });
    res.status(502).end();
  }
});

router.get("/api/whoami", async (_req, res): Promise<void> => {
  const userId = context.userId ?? "";
  let username = context.username?.trim() ?? "";
  if (!username && userId) {
    try {
      username = (await reddit.getUserById(userId as `t2_${string}`))?.username ?? "";
    } catch {
      username = "";
    }
  }
  res.json({
    type: "whoami",
    userId: userId || null,
    username: username || null,
    subreddit: context.subredditName || null,
  });
});

router.get("/api/debug/post-map", async (_req, res): Promise<void> => {
  const postId = context.postId ?? "";
  const normalizedPostId = postId ? (postId.startsWith("t3_") ? postId : `t3_${postId}`) : "";
  const postMapKey = postId ? getPostMapKey(postId) : "";
  const postMapKeyNormalized = normalizedPostId ? getPostMapKey(normalizedPostId) : "";
  const [mapIdRaw, mapIdNormalized] = await Promise.all([
    postMapKey ? redis.get(postMapKey) : Promise.resolve(null),
    postMapKeyNormalized ? redis.get(postMapKeyNormalized) : Promise.resolve(null),
  ]);
  const mapId = mapIdRaw ?? mapIdNormalized ?? "";
  let mapExists = false;
  if (mapId) {
    const { mapKey } = getMapKeys(mapId);
    mapExists = Boolean(await redis.get(mapKey));
  }
  res.json({
    type: "debug-post-map",
    postId: postId || null,
    normalizedPostId: normalizedPostId || null,
    postMapKey: postMapKey || null,
    postMapKeyNormalized: postMapKeyNormalized || null,
    mapId: mapId || null,
    mapExists,
    subreddit: context.subredditName || null,
  });
});

router.post("/internal/on-app-install", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();
    res.json({
      status: "success",
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({ status: "error", message: "Failed to create post" });
  }
});

router.post("/internal/menu/post-create", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();
    res.json({ navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}` });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({ status: "error", message: "Failed to create post" });
  }
});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
