import express from "express";
import {
  createServer,
  context,
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
  { spawn: { x: 0, y: 14 }, exit: { x: 8, y: 14 } },
  { spawn: { x: 0, y: 7 }, exit: { x: 0, y: 14 } },
  { spawn: { x: 2, y: 0 }, exit: { x: 4, y: 0 } },
  { spawn: { x: 0, y: 0 }, exit: { x: 8, y: 14 } },
  { spawn: { x: 8, y: 0 }, exit: { x: 4, y: 0 } },
  { spawn: { x: 8, y: 14 }, exit: { x: 6, y: 14 } },
  { spawn: { x: 0, y: 14 }, exit: { x: 8, y: 0 } },
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
        runAs: RunAs.USER,
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
      const response: SubmitFeedbackResponse = {
        type: "feedback",
        status: "ok",
        authorName: authorName || undefined,
        asUser: expectedUsername ? asUser : undefined,
      };
      if (expectedUsername && !asUser) {
        response.message = `Posted as ${authorName || "the app"}. Reinstall/reauthorize to post as you.`;
      }
      res.json(response);
    } catch (error) {
      console.error("Submit feedback error", error);
      res.status(500).json({ status: "error", message: "Failed to submit comment" });
    }
  }
);

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
