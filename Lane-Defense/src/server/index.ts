import express from "express";
import {
  createServer,
  context,
  getServerPort,
  reddit,
  redis,
} from "@devvit/web/server";
import { seedFromString } from "../shared/rng";
import { MAX_WAVES } from "../shared/game-data";
import type {
  DailyResponse,
  LeaderboardResponse,
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

router.get<{}, DailyResponse>("/api/daily", async (_req, res): Promise<void> => {
  const { date, seed } = getDailySeed();
  res.json({ type: "daily", date, seed });
});

router.get<{}, LeaderboardResponse | { status: string; message: string }>(
  "/api/leaderboard",
  async (_req, res): Promise<void> => {
    const { userId } = context;
    const { date } = getDailySeed();
    const key = `leaderboard:daily:${date}:v1`;

    try {
      const topPlayers = await redis.zRange(key, 0, 49, { reverse: true, by: "rank" });
      const entries = await Promise.all(
        topPlayers.map(async (player) => {
          const memberId = player.member as `t2_${string}`;
          let username = "Anonymous";
          try {
            username = (await reddit.getUserById(memberId))?.username || "Anonymous";
          } catch {
            username = "Anonymous";
          }

          const wavesKey = `user:${memberId}:daily:${date}:waves:v1`;
          const wavesRaw = await redis.get(wavesKey);
          const waves = wavesRaw ? parseInt(wavesRaw) : 0;

          return {
            username,
            score: player.score,
            waves,
          };
        })
      );

      let userRank: number | null = null;
      if (userId) {
        const rank = await redis.zRank(key, userId);
        if (rank !== undefined) {
          const totalCount = await redis.zCard(key);
          userRank = totalCount - rank;
        }
      }

      res.json({ type: "leaderboard", date, entries, userRank });
    } catch (error) {
      console.error("Leaderboard error", error);
      res.status(500).json({ status: "error", message: "Failed to fetch leaderboard" });
    }
  }
);

router.post<{}, SubmitScoreResponse | { status: string; message: string }, SubmitScoreRequest>(
  "/api/submit-score",
  async (req, res): Promise<void> => {
    const { userId } = context;
    if (!userId) {
      res.status(403).json({ status: "error", message: "Login required" });
      return;
    }

    const payload = req.body as SubmitScoreRequest;
    const { date } = getDailySeed();

    if (!payload || payload.score < 0 || payload.waves < 0 || payload.waves > MAX_WAVES) {
      res.status(400).json({ status: "error", message: "Invalid score payload" });
      return;
    }

    const leaderboardKey = `leaderboard:daily:${date}:v1`;
    const bestKey = `user:${userId}:daily:${date}:best:v1`;
    const wavesKey = `user:${userId}:daily:${date}:waves:v1`;

    try {
      const currentBestRaw = await redis.get(bestKey);
      const currentBest = currentBestRaw ? parseInt(currentBestRaw) : 0;
      let bestScore = currentBest;

      if (payload.score > currentBest) {
        bestScore = payload.score;
        await redis.set(bestKey, payload.score.toString());
        await redis.set(wavesKey, payload.waves.toString());
        await redis.zAdd(leaderboardKey, { member: userId, score: payload.score });
        await redis.expire(leaderboardKey, 60 * 60 * 48);
        await redis.expire(bestKey, 60 * 60 * 48);
        await redis.expire(wavesKey, 60 * 60 * 48);
      }

      let rank: number | null = null;
      const userRank = await redis.zRank(leaderboardKey, userId);
      if (userRank !== undefined) {
        const totalCount = await redis.zCard(leaderboardKey);
        rank = totalCount - userRank;
      }

      res.json({ type: "submit", status: "ok", rank, bestScore });
    } catch (error) {
      console.error("Submit score error", error);
      res.status(500).json({ status: "error", message: "Failed to submit score" });
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
