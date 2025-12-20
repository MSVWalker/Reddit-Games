import express from "express";
import {
  InitResponse,
  DailyCountResponse,
  SessionResponse,
  PostMemeRequest,
  PostMemeResponse,
} from "../shared/types/api";
import { createServer, context, getServerPort, reddit, redis, media } from "@devvit/web/server";

const app = express();

// Lightweight limits appropriate for Devvit webview requests
app.use(express.json({ limit: "8mb" }));
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
    const { subredditName, userId, username: contextUsername, snoovatar } = context;

    let resolvedUsername: string | null = contextUsername?.trim() || null;
    if (!resolvedUsername && userId) {
      try {
        resolvedUsername = (await reddit.getCurrentUsername()) ?? null;
      } catch {
        resolvedUsername = null;
      }
    }

    let snoovatarUrl: string | null = snoovatar ?? null;
    if (!snoovatarUrl && resolvedUsername) {
      const cacheKey = `snoovatarUrl:${resolvedUsername.toLowerCase()}`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          snoovatarUrl = cached === "none" ? null : cached;
        } else {
          const fetched = await reddit.getSnoovatarUrl(resolvedUsername);
          snoovatarUrl = fetched ?? null;
          await redis.set(cacheKey, snoovatarUrl ?? "none");
          await redis.expire(cacheKey, 60 * 60 * 24); // 24h
        }
      } catch {
        // Ignore failures and fall back to null.
      }
    }

    res.json({
      type: "session",
      subreddit: subredditName || "",
      loggedIn: Boolean(userId),
      username: resolvedUsername,
      snoovatarUrl,
    });
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

router.post<{}, PostMemeResponse, PostMemeRequest>("/api/post-meme", async (req, res): Promise<void> => {
  const { base64Image, title, targetSubreddit, postMode } = req.body ?? {};
  if (!context.userId) {
    res.status(401).json({ status: "error", message: "You must be logged in to post." });
    return;
  }

  const trimmedTitle = typeof title === "string" ? title.trim().slice(0, 300) : "";
  if (!trimmedTitle) {
    res.status(400).json({ status: "error", message: "A title is required." });
    return;
  }

  const imageData = typeof base64Image === "string" ? base64Image.trim() : "";
  if (!imageData.startsWith("data:image/")) {
    res.status(400).json({ status: "error", message: "Invalid image payload." });
    return;
  }

  const requestedSubreddit =
    typeof targetSubreddit === "string" ? targetSubreddit.replace(/^r\//i, "").trim() : "";
  const defaultSubreddit = context.subredditName?.trim();
  const subredditName = (requestedSubreddit || defaultSubreddit || "").trim();

  if (!subredditName) {
    res.status(400).json({
      status: "error",
      message: "No subreddit provided and unable to detect the current community.",
    });
    return;
  }

  const mode: "link" | "custom" = postMode === "custom" ? "custom" : "link";

  try {
    const uploadedAsset = await media.upload({ type: "image", url: imageData });
    if (!uploadedAsset?.mediaUrl) {
      throw new Error("Image upload failed.");
    }

    const sharedPostOptions = {
      title: trimmedTitle,
      subredditName,
      runAs: "USER" as const,
    };

    const post =
      mode === "custom"
        ? await reddit.submitCustomPost({
            ...sharedPostOptions,
            userGeneratedContent: {
              text: trimmedTitle,
              imageUrls: [uploadedAsset.mediaUrl],
            },
            entry: "game",
            textFallback: {
              text: `${trimmedTitle} (Meme created in Meme Gen)`,
            },
          })
        : await reddit.submitPost({
            ...sharedPostOptions,
            url: uploadedAsset.mediaUrl,
          });

    const permalink =
      typeof post?.permalink === "string" && post.permalink.length > 0
        ? `https://www.reddit.com${post.permalink}`
        : `https://www.reddit.com/r/${subredditName}/comments/${post?.id ?? ""}`;

    res.json({
      status: "success",
      postId: post?.id ?? "",
      url: permalink,
      subreddit: subredditName,
      mode,
    });
  } catch (error) {
    console.error("Failed to post meme", error);
    const message = error instanceof Error ? error.message : "Failed to share meme.";

    res.status(500).json({
      status: "error",
      message,
    });
  }
});

const TEMPLATE_LAYOUTS_KEY = "template-layouts:v1";

const getTemplateLayouts = async (): Promise<Record<string, any>> => {
  const raw = await redis.get(TEMPLATE_LAYOUTS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const saveTemplateLayouts = async (layouts: Record<string, any>) => {
  await redis.set(TEMPLATE_LAYOUTS_KEY, JSON.stringify(layouts));
};

router.get("/api/template-layouts", async (_req, res): Promise<void> => {
  try {
    res.json(await getTemplateLayouts());
  } catch (err) {
    console.warn("Failed to read template layouts", err);
    res.json({});
  }
});

router.post("/api/template-layouts", async (req, res): Promise<void> => {
  try {
    const { templateId, boxes } = req.body ?? {};
    if (typeof templateId !== "string" || !templateId.trim() || !Array.isArray(boxes)) {
      res.status(400).json({ status: "error", message: "Invalid payload" });
      return;
    }

    const existing = await getTemplateLayouts();
    const next = {
      ...existing,
      [templateId]: { boxes },
    };

    await saveTemplateLayouts(next);
    res.json({ status: "success" });
  } catch (err) {
    console.error("Failed to save template layout", err);
    res.status(500).json({ status: "error", message: "Failed to save template layout" });
  }
});

const createMemeGenPost = async () => {
  return await reddit.submitCustomPost({
    title: "Meme Gen",
  });
};

router.post("/internal/on-app-install", async (_req, res): Promise<void> => {
  try {
    const post = await createMemeGenPost();

    res.json({
      status: "success",
      message: `Created a Meme Gen post in r/${context.subredditName} (id: ${post.id})`,
    });
  } catch (error) {
    console.error("Error creating Meme Gen post on install", error);
    res.status(400).json({
      status: "error",
      message: "Failed to create Meme Gen post",
    });
  }
});

router.post("/internal/menu/post-create", async (_req, res): Promise<void> => {
  try {
    const post = await createMemeGenPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error("Error creating Meme Gen post from menu", error);
    res.status(400).json({
      status: "error",
      message: "Failed to create Meme Gen post",
    });
  }
});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
