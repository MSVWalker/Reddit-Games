import express from "express";
import type {
  CreatePostRequest,
  CreatePostResponse,
  FeedPost,
  FeedResponse,
  MediaType,
  PostMeta,
  PostStateResponse,
  ReasoningRequest,
  ReasoningResponse,
  SessionResponse,
  VoteChoice,
  VoteCounts,
  VoteRequest,
  VoteResponse,
} from "../shared/types/api";
import { createServer, context, getServerPort, media, reddit, redis } from "@devvit/web/server";

const app = express();

app.use(express.json({ limit: "32mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.text({ limit: "2mb" }));

const router = express.Router();

const POST_KEY_PREFIX = "realorai:post:";
const POST_INDEX_KEY = "realorai:posts";
const COUNTS_KEY_PREFIX = "realorai:counts:";
const VOTES_KEY_PREFIX = "realorai:votes:";
const HUB_KEY = "realorai:hub";
const SEEDED_HASH_PREFIX = "realorai:seeded:";

const MAX_TITLE_LENGTH = 200;
const MAX_VIDEO_SECONDS = 20;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const SEED_AUTHOR = "PangaeaNative";

type HubRecord = {
  kind: "hub";
  id: string;
  title: string;
  createdAt: string;
  subreddit: string;
};

type EvidenceRecord = PostMeta & {
  kind: "evidence";
};

type StoredPost = HubRecord | EvidenceRecord;

const postKey = (postId: string) => `${POST_KEY_PREFIX}${postId}`;
const countsKey = (postId: string) => `${COUNTS_KEY_PREFIX}${postId}`;
const votesKey = (postId: string) => `${VOTES_KEY_PREFIX}${postId}`;
const seededHashKey = (subredditName: string) => `${SEEDED_HASH_PREFIX}${subredditName.toLowerCase()}`;

type SeedPost = {
  title: string;
  url: string;
};

const DEFAULT_SEED_POSTS: SeedPost[] = [
  {
    title: "Sunset pier, low tide",
    url: "https://picsum.photos/id/1015/1200/900",
  },
  {
    title: "Mountain ridge after rain",
    url: "https://picsum.photos/id/1024/1200/900",
  },
  {
    title: "City crosswalk at noon",
    url: "https://picsum.photos/id/1035/1200/900",
  },
  {
    title: "Forest road in winter",
    url: "https://picsum.photos/id/1039/1200/900",
  },
  {
    title: "Calm lake before dawn",
    url: "https://picsum.photos/id/1043/1200/900",
  },
  {
    title: "Crystal canyon skyline",
    url: "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/txt2img/000002025.png",
  },
  {
    title: "Neon orchard in bloom",
    url: "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/txt2img/000002035.png",
  },
  {
    title: "Floating rail station",
    url: "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/txt2img/merged-0005.png",
  },
  {
    title: "Glass harbor at night",
    url: "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/txt2img/merged-0006.png",
  },
  {
    title: "Skybridge market",
    url: "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/txt2img/merged-0007.png",
  },
];

const parseVoteChoice = (value: unknown): VoteChoice | null => {
  if (value === "real" || value === "ai" || value === "unsure") return value;
  return null;
};

const normalizeCounts = (raw: Record<string, string>): VoteCounts => {
  const real = Number.parseInt(raw.real ?? "0", 10) || 0;
  const ai = Number.parseInt(raw.ai ?? "0", 10) || 0;
  const unsure = Number.parseInt(raw.unsure ?? "0", 10) || 0;
  const total = Number.parseInt(raw.total ?? "0", 10) || real + ai + unsure;
  const reasoning = Number.parseInt(raw.reasoning ?? "0", 10) || 0;
  return { real, ai, unsure, total, reasoning };
};

const DEFAULT_COUNTS: VoteCounts = {
  real: 0,
  ai: 0,
  unsure: 0,
  total: 0,
  reasoning: 0,
};

const getCounts = async (postId: string): Promise<VoteCounts> => {
  try {
    const raw = await redis.hGetAll(countsKey(postId));
    return normalizeCounts(raw);
  } catch {
    return { ...DEFAULT_COUNTS };
  }
};

const getUserVote = async (postId: string, userId: string | undefined): Promise<VoteChoice | null> => {
  if (!userId) return null;
  try {
    const stored = await redis.hGet(votesKey(postId), userId);
    return parseVoteChoice(stored ?? null);
  } catch {
    return null;
  }
};

const parseStoredPost = (raw: string | null): StoredPost | null => {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as StoredPost;
    if (data?.kind === "hub") return data;
    if (data?.kind === "evidence") return data;
    return null;
  } catch {
    return null;
  }
};

const toThingId = (postId: string) => (postId.startsWith("t3_") ? postId : `t3_${postId}`);

const trimTitle = (title: string) => title.trim().slice(0, MAX_TITLE_LENGTH);

const estimateBase64Bytes = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.ceil((base64.length * 3) / 4) - padding);
};

const seedDefaultEvidence = async (): Promise<void> => {
  const subredditName = context.subredditName?.trim();
  if (!subredditName) return;

  let seededMap: Record<string, string> = {};
  try {
    seededMap = await redis.hGetAll(seededHashKey(subredditName));
  } catch {
    seededMap = {};
  }

  const seededPostIds = Object.values(seededMap).filter((id) => typeof id === "string" && id.length > 0);
  if (seededPostIds.length > 0) {
    const rawSeededPosts = await redis.mGet(seededPostIds.map((id) => postKey(id)));
    await Promise.all(
      rawSeededPosts.map(async (raw) => {
        const record = parseStoredPost(raw ?? null);
        if (!record || record.kind !== "evidence") return;
        if (record.authorName) return;
        const updated: EvidenceRecord = { ...record, authorName: SEED_AUTHOR };
        await redis.set(postKey(record.id), JSON.stringify(updated));
      })
    );
  }

  const seededUrls = new Set(Object.keys(seededMap));
  const missingSeeds = DEFAULT_SEED_POSTS.filter((seed) => !seededUrls.has(seed.url));
  if (missingSeeds.length === 0) return;

  const baseTimestamp = Date.now() - missingSeeds.length * 60_000;

  for (let i = 0; i < missingSeeds.length; i += 1) {
    const seed = missingSeeds[i];
    if (!seed) continue;

    try {
      const uploaded = await media.upload({ type: "image", url: seed.url });
      if (!uploaded?.mediaUrl) continue;

      const post = await reddit.submitCustomPost({
        title: seed.title,
        subredditName,
        entry: "game",
        userGeneratedContent: {
          text: seed.title,
          imageUrls: [uploaded.mediaUrl],
        },
        textFallback: {
          text: `RealOrAI evidence: ${seed.title}`,
        },
      });

      const postId = post?.id ?? "";
      if (!postId) continue;

      const score = baseTimestamp + i * 60_000;
      const createdAt = new Date(score).toISOString();
      const record: EvidenceRecord = {
        kind: "evidence",
        id: postId,
        title: seed.title,
        mediaUrl: uploaded.mediaUrl,
        mediaType: "image",
        createdAt,
        authorName: SEED_AUTHOR,
        subreddit: subredditName,
      };

      await redis.set(postKey(postId), JSON.stringify(record));
      await redis.zAdd(POST_INDEX_KEY, { member: postId, score });
      await redis.hSet(countsKey(postId), {
        real: "0",
        ai: "0",
        unsure: "0",
        total: "0",
        reasoning: "0",
      });
      await redis.hSet(seededHashKey(subredditName), { [seed.url]: postId });
    } catch (error) {
      console.warn("Seed evidence creation failed", error);
    }
  }
};

router.get<{}, SessionResponse>("/api/session", async (_req, res): Promise<void> => {
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
        await redis.expire(cacheKey, 60 * 60 * 24);
      }
    } catch {
      snoovatarUrl = null;
    }
  }

  res.json({
    type: "session",
    subreddit: subredditName || "",
    loggedIn: Boolean(userId),
    username: resolvedUsername,
    snoovatarUrl,
  });
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

router.get<{}, PostStateResponse>("/api/post-state", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.json({ type: "post-state", kind: "unknown" });
    return;
  }

  const record = parseStoredPost(await redis.get(postKey(postId)));
  if (!record) {
    res.json({ type: "post-state", kind: "unknown" });
    return;
  }

  if (record.kind === "hub") {
    res.json({ type: "post-state", kind: "hub" });
    return;
  }

  const counts = await getCounts(postId);
  const userVote = await getUserVote(postId, context.userId);
  const { kind: _kind, ...post } = record;

  res.json({
    type: "post-state",
    kind: "evidence",
    post,
    counts,
    userVote,
  });
});

router.get<{}, FeedResponse>("/api/feed", async (req, res): Promise<void> => {
  await seedDefaultEvidence();

  const sort =
    req.query.sort === "reviewed" || req.query.sort === "discussed" ? req.query.sort : "recent";
  const requestedLimit = Number.parseInt(String(req.query.limit ?? "30"), 10) || 30;
  const limit = Math.min(Math.max(requestedLimit, 5), 50);
  const sampleSize = Math.min(Math.max(limit * 4, 50), 200);

  let entries = await redis.zRange(POST_INDEX_KEY, 0, sampleSize - 1, { reverse: true });
  let postIds = entries.map((entry) => entry.member);

  if (postIds.length === 0) {
    await seedDefaultEvidence();
    entries = await redis.zRange(POST_INDEX_KEY, 0, sampleSize - 1, { reverse: true });
    postIds = entries.map((entry) => entry.member);
  }

  if (postIds.length === 0) {
    res.json({ type: "feed", sort, posts: [] });
    return;
  }

  const rawPosts = await redis.mGet(postIds.map((id) => postKey(id)));

  const posts = (
    await Promise.all(
      rawPosts.map(async (raw) => {
        const record = parseStoredPost(raw ?? null);
        if (!record || record.kind !== "evidence") return null;
        const [counts, userVote] = await Promise.all([
          getCounts(record.id),
          getUserVote(record.id, context.userId),
        ]);
        const { kind: _kind, ...post } = record;
        return { ...post, counts, userVote } satisfies FeedPost;
      })
    )
  ).filter((post): post is FeedPost => Boolean(post));

  let sorted = [...posts];
  if (sort === "reviewed") {
    sorted = sorted.sort((a, b) => b.counts.total - a.counts.total);
  } else if (sort === "discussed") {
    sorted = sorted.sort((a, b) => b.counts.reasoning - a.counts.reasoning);
  } else {
    const order = new Map(postIds.map((id, index) => [id, index]));
    sorted = sorted.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  res.json({ type: "feed", sort, posts: sorted.slice(0, limit) });
});

router.post<{}, CreatePostResponse, CreatePostRequest>("/api/create-post", async (req, res): Promise<void> => {
  if (!context.userId) {
    res.status(401).json({ status: "error", message: "You must be logged in to submit evidence." });
    return;
  }

  const { title, mediaType, dataUrl, duration, sizeBytes } = req.body ?? {};

  if (typeof title !== "string" || !trimTitle(title)) {
    res.status(400).json({ status: "error", message: "A title is required." });
    return;
  }

  const resolvedMediaType: MediaType | null =
    mediaType === "image" || mediaType === "video" ? mediaType : null;
  if (!resolvedMediaType) {
    res.status(400).json({ status: "error", message: "Invalid media type." });
    return;
  }

  if (typeof dataUrl !== "string" || !dataUrl.startsWith(`data:${resolvedMediaType}/`)) {
    res.status(400).json({ status: "error", message: "Invalid media payload." });
    return;
  }

  if (resolvedMediaType === "video" && typeof duration === "number" && duration > MAX_VIDEO_SECONDS) {
    res.status(400).json({ status: "error", message: `Video must be ${MAX_VIDEO_SECONDS}s or less.` });
    return;
  }

  const maxBytes = resolvedMediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const measuredBytes =
    typeof sizeBytes === "number" && sizeBytes > 0 ? sizeBytes : estimateBase64Bytes(dataUrl);
  if (measuredBytes > maxBytes) {
    res.status(400).json({
      status: "error",
      message: `${resolvedMediaType === "video" ? "Video" : "Image"} exceeds the size limit.`,
    });
    return;
  }

  const subredditName = context.subredditName?.trim();
  if (!subredditName) {
    res.status(400).json({ status: "error", message: "Missing subreddit context." });
    return;
  }

  const cleanedTitle = trimTitle(title);

  let authorName: string | null = context.username?.trim() || null;
  if (!authorName) {
    try {
      authorName = (await reddit.getCurrentUsername()) ?? null;
    } catch {
      authorName = null;
    }
  }

  try {
    const uploaded = await media.upload({ type: resolvedMediaType, url: dataUrl });
    if (!uploaded?.mediaUrl) {
      throw new Error("Media upload failed.");
    }

    const userGeneratedContent: { text: string; imageUrls?: string[] } = {
      text: cleanedTitle,
    };

    if (resolvedMediaType === "image") {
      userGeneratedContent.imageUrls = [uploaded.mediaUrl];
    }

    const post = await reddit.submitCustomPost({
      title: cleanedTitle,
      subredditName,
      runAs: "USER",
      entry: "game",
      userGeneratedContent,
      textFallback: {
        text: `RealOrAI evidence: ${cleanedTitle}`,
      },
    });

    const postId = post?.id ?? "";
    if (!postId) {
      throw new Error("Post creation failed.");
    }

    const record: EvidenceRecord = {
      kind: "evidence",
      id: postId,
      title: cleanedTitle,
      mediaUrl: uploaded.mediaUrl,
      mediaType: resolvedMediaType,
      createdAt: new Date().toISOString(),
      authorName,
      subreddit: subredditName,
    };

    await redis.set(postKey(postId), JSON.stringify(record));
    await redis.zAdd(POST_INDEX_KEY, { member: postId, score: Date.now() });
    await redis.hSet(countsKey(postId), {
      real: "0",
      ai: "0",
      unsure: "0",
      total: "0",
      reasoning: "0",
    });

    const permalink =
      typeof post?.permalink === "string" && post.permalink.length > 0
        ? `https://www.reddit.com${post.permalink}`
        : `https://www.reddit.com/r/${subredditName}/comments/${postId}`;

    res.json({ status: "success", postId, url: permalink });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit evidence.";
    res.status(500).json({ status: "error", message });
  }
});

router.post<{}, VoteResponse, VoteRequest>("/api/vote", async (req, res): Promise<void> => {
  if (!context.userId) {
    res.status(401).json({ status: "error", message: "You must be logged in to vote." });
    return;
  }

  const postId = typeof req.body?.postId === "string" ? req.body.postId : context.postId;
  if (!postId) {
    res.status(400).json({ status: "error", message: "Post ID is required." });
    return;
  }

  const choice = parseVoteChoice(req.body?.choice);
  if (!choice) {
    res.status(400).json({ status: "error", message: "Invalid vote choice." });
    return;
  }

  const record = parseStoredPost(await redis.get(postKey(postId)));
  if (!record || record.kind !== "evidence") {
    res.status(404).json({ status: "error", message: "Evidence not found." });
    return;
  }

  const existing = await redis.hGet(votesKey(postId), context.userId);
  if (existing) {
    const counts = await getCounts(postId);
    res.json({ status: "already_voted", counts, choice: parseVoteChoice(existing) ?? choice });
    return;
  }

  await redis.hSet(votesKey(postId), { [context.userId]: choice });
  await redis.hIncrBy(countsKey(postId), choice, 1);
  await redis.hIncrBy(countsKey(postId), "total", 1);

  const counts = await getCounts(postId);
  res.json({ status: "success", counts, choice });
});

router.post<{}, ReasoningResponse, ReasoningRequest>("/api/reasoning", async (req, res): Promise<void> => {
  if (!context.userId) {
    res.status(401).json({ status: "error", message: "You must be logged in to comment." });
    return;
  }

  const postId = typeof req.body?.postId === "string" ? req.body.postId : context.postId;
  if (!postId) {
    res.status(400).json({ status: "error", message: "Post ID is required." });
    return;
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ status: "error", message: "Reasoning text is required." });
    return;
  }

  const existingVote = await redis.hGet(votesKey(postId), context.userId);
  if (!existingVote) {
    res.status(403).json({ status: "error", message: "Vote before posting reasoning." });
    return;
  }

  const record = parseStoredPost(await redis.get(postKey(postId)));
  if (!record || record.kind !== "evidence") {
    res.status(404).json({ status: "error", message: "Evidence not found." });
    return;
  }

  try {
    const comment = await reddit.submitComment({
      id: toThingId(postId),
      text,
      runAs: "USER",
    });

    await redis.hIncrBy(countsKey(postId), "reasoning", 1);

    const permalink =
      typeof comment?.permalink === "string" && comment.permalink.length > 0
        ? `https://www.reddit.com${comment.permalink}`
        : `https://www.reddit.com/r/${record.subreddit}/comments/${postId}`;

    res.json({ status: "success", commentId: comment?.id ?? "", url: permalink });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit comment.";
    res.status(500).json({ status: "error", message });
  }
});

const createHubPost = async () => {
  const subredditName = context.subredditName?.trim();
  if (!subredditName) {
    throw new Error("Missing subreddit context.");
  }

  const post = await reddit.submitCustomPost({
    title: "RealOrAI Hub",
    subredditName,
  });

  const postId = post?.id ?? "";
  if (!postId) {
    throw new Error("Hub post creation failed.");
  }

  const record: HubRecord = {
    kind: "hub",
    id: postId,
    title: "RealOrAI Hub",
    createdAt: new Date().toISOString(),
    subreddit: subredditName,
  };

  await redis.set(postKey(postId), JSON.stringify(record));
  await redis.set(HUB_KEY, postId);
  await seedDefaultEvidence();

  return post;
};

router.post("/internal/on-app-install", async (_req, res): Promise<void> => {
  try {
    const post = await createHubPost();
    res.json({
      status: "success",
      message: `Created a RealOrAI hub post in r/${context.subredditName} (id: ${post.id})`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create hub post.";
    res.status(400).json({ status: "error", message });
  }
});

router.post("/internal/menu/hub-create", async (_req, res): Promise<void> => {
  try {
    const post = await createHubPost();
    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create hub post.";
    res.status(400).json({ status: "error", message });
  }
});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
