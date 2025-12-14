import express from "express";
import { InitResponse, DailyCountResponse, SessionResponse } from "../shared/types/api";
import { createServer, context, getServerPort, reddit, redis } from "@devvit/web/server";

const app = express();

// Lightweight limits appropriate for Devvit webview requests
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.text({ limit: "2mb" }));

const router = express.Router();

router.get<{}, InitResponse | { status: string; message: string }>(
  "/api/init",
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      res.status(400).json({
        status: "error",
        message: "postId is required but missing from context",
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([redis.get("count"), reddit.getCurrentUsername()]);

      res.json({
        type: "init",
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? "anonymous",
      });
    } catch (error) {
      res.status(400).json({ status: "error", message: "Init failed" });
    }
  }
);

router.get<{}, SessionResponse | { status: string; message: string }>(
  "/api/session",
  async (_req, res): Promise<void> => {
    const { subredditName, userId, username } = context;
    res.json({
      type: "session",
      subreddit: subredditName || "",
      loggedIn: Boolean(userId),
      username: username ?? null,
    });
  }
);

router.post("/api/increment", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).send("No Post ID");
    return;
  }
  res.json({ count: await redis.incrBy("count", 1), postId, type: "increment" });
});

router.post("/api/decrement", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).send("No Post ID");
    return;
  }
  res.json({ count: await redis.incrBy("count", -1), postId, type: "decrement" });
});

const dailyKey = () => {
  const now = new Date();
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const iso = utcDate.toISOString().slice(0, 10); // YYYY-MM-DD
  return { key: `daily-count:${iso}`, date: iso };
};

router.get<{}, DailyCountResponse | { status: string; message: string }>(
  "/api/daily-count",
  async (_req, res): Promise<void> => {
    try {
      const { key, date } = dailyKey();
      const count = await redis.get(key);
      res.json({
        type: "daily-count",
        count: count ? parseInt(count) : 0,
        date,
      });
    } catch (error) {
      console.error("Error fetching daily count", error);
      res.status(500).json({ status: "error", message: "Failed to fetch daily count" });
    }
  }
);

router.post<{}, DailyCountResponse | { status: string; message: string }>(
  "/api/daily-visit",
  async (_req, res): Promise<void> => {
    try {
      const { key, date } = dailyKey();
      const count = await redis.incrBy(key, 1);
      await redis.expire(key, 60 * 60 * 48); // expire in 48h
      res.json({
        type: "daily-count",
        count,
        date,
      });
    } catch (error) {
      console.error("Error incrementing daily count", error);
      res.status(500).json({ status: "error", message: "Failed to increment daily count" });
    }
  }
);

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
