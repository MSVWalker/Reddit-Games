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
