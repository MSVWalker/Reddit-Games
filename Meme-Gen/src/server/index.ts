import express from "express";
import {
  InitResponse,
  DailyCountResponse,
  SessionResponse,
  PostMemeResponse,
} from "../shared/types/api";
import { createServer, context, getServerPort, reddit, redis } from "@devvit/web/server";
import { createPost } from "./core/post";
import { MemeRecipe } from "../shared/types/meme";

const app = express();

// Middleware limits aligned with Devvit webview request caps
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.text({ limit: "2mb" }));

const router = express.Router();
const MAX_RECIPE_BYTES = 2_500_000; // ~2.5MB guardrail for recipe payloads

type MemePostRequestBody = {
  title?: string;
  subredditName?: string;
  meme?: MemeRecipe;
};

type MemeRecipeResponse =
  | { status: "ok"; postId: string; meme: MemeRecipe }
  | { status: "error"; message: string };

const validateMemeRecipe = (meme: MemeRecipe | undefined | null): meme is MemeRecipe => {
  if (!meme) return false;
  if (!meme.templateId || typeof meme.templateId !== "string") return false;
  if (!Array.isArray(meme.elements) || !Array.isArray(meme.drawingStrokes)) return false;
  return true;
};

const postMemeRecipe = async ({
  meme,
  cleanSubreddit,
  trimmedTitle,
  username,
}: {
  meme: MemeRecipe;
  cleanSubreddit: string;
  trimmedTitle: string;
  username?: string | null;
}) => {
  const sizeEstimate = Buffer.byteLength(JSON.stringify(meme), "utf8");
  if (sizeEstimate > MAX_RECIPE_BYTES) {
    throw new Error("Meme recipe is too large. Simplify layers or reduce custom image size.");
  }

  const post = await reddit.submitCustomPost({
    subredditName: cleanSubreddit,
    title: trimmedTitle,
    entry: "default",
    postData: { mode: "meme-view" },
    userGeneratedContent: {
      text: `Shared meme by ${username ?? "a user"} using Meme Gen`,
    },
  });

  await redis.set(`meme:${post.id}`, JSON.stringify({ ...meme, createdAt: new Date().toISOString() }));

  const permalink =
    (post as { permalink?: string })?.permalink || `/r/${cleanSubreddit}/comments/${post.id}`;

  return {
    type: "post-meme",
    postId: post.id,
    url: permalink.startsWith("http") ? permalink : `https://reddit.com${permalink}`,
    subreddit: cleanSubreddit,
    username: username ?? null,
  } satisfies PostMemeResponse;
};

// Fetch a stored recipe for rendering in the post view
router.get<{ postId: string }, MemeRecipeResponse>(
  "/api/meme/:postId",
  async (req, res): Promise<void> => {
    try {
      const key = `meme:${req.params.postId}`;
      const raw = await redis.get(key);
      if (!raw) {
        res.status(404).json({ status: "error", message: "Meme not found" });
        return;
      }
      let parsed: MemeRecipe;
      try {
        parsed = JSON.parse(raw) as MemeRecipe;
      } catch {
        res.status(500).json({ status: "error", message: "Stored meme is corrupted" });
        return;
      }
      res.json({ status: "ok", postId: req.params.postId, meme: parsed });
    } catch (error) {
      console.error("Error fetching meme recipe", error);
      res.status(500).json({ status: "error", message: "Failed to fetch meme" });
    }
  }
);

const handlePostMeme = async (
  req: express.Request<{}, PostMemeResponse | { status: string; message: string }, MemePostRequestBody>,
  res: express.Response
) => {
  const { meme, title, subredditName: targetSubredditName } = req.body ?? {};
  const { userId, subredditName, username } = context;

  if (!userId) {
    res.status(401).json({
      status: "error",
      message: "You must be logged in to post to a subreddit.",
    });
    return;
  }

  const cleanSubreddit = (targetSubredditName || subredditName || "").replace(/^r\//i, "");
  if (!cleanSubreddit) {
    res.status(400).json({
      status: "error",
      message: "A subreddit is required to create a post.",
    });
    return;
  }

  const trimmedTitle = (title ?? "").trim().slice(0, 300) || "Shared with Meme Gen";

  try {
    if (validateMemeRecipe(meme)) {
      const response = await postMemeRecipe({ meme, cleanSubreddit, trimmedTitle, username: username ?? null });
      res.json(response);
    } else {
      res.status(400).json({
        status: "error",
        message: "A meme recipe is required.",
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    console.error("Error creating meme post", message);
    res.status(500).type("text/plain").send(`Failed to post meme. ${message}` as any);
  }
};

router.post("/api/post-meme", handlePostMeme);
router.post("/api/post-meme-custom", handlePostMeme);

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

router.post("/internal/on-app-install", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: "success",
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to create post",
    });
  }
});

router.post("/internal/menu/post-create", async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: "error",
      message: "Failed to create post",
    });
  }
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
      // Keep keys from piling up indefinitely
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
