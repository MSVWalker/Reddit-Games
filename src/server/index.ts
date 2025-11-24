import express from "express";
import {
  InitResponse,
  IncrementResponse,
  DecrementResponse,
} from "../shared/types/api";
import {
  createServer,
  context,
  getServerPort,
  reddit,
  redis,
} from "@devvit/web/server";
import { createPost } from "./core/post";

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<
  { postId: string },
  InitResponse | { status: string; message: string }
>("/api/init", async (_req, res): Promise<void> => {
  const { postId } = context;

  if (!postId) {
    console.error("API Init Error: postId not found in devvit context");
    res.status(400).json({
      status: "error",
      message: "postId is required but missing from context",
    });
    return;
  }

  try {
    const [count, username] = await Promise.all([
      redis.get("count"),
      reddit.getCurrentUsername(),
    ]);

    res.json({
      type: "init",
      postId: postId,
      count: count ? parseInt(count) : 0,
      username: username ?? "anonymous",
    });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    let errorMessage = "Unknown error during initialization";
    if (error instanceof Error) {
      errorMessage = `Initialization failed: ${error.message}`;
    }
    res.status(400).json({ status: "error", message: errorMessage });
  }
});

router.post<
  { postId: string },
  IncrementResponse | { status: string; message: string },
  unknown
>("/api/increment", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({
      status: "error",
      message: "postId is required",
    });
    return;
  }

  res.json({
    count: await redis.incrBy("count", 1),
    postId,
    type: "increment",
  });
});

router.post<
  { postId: string },
  DecrementResponse | { status: string; message: string },
  unknown
>("/api/decrement", async (_req, res): Promise<void> => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({
      status: "error",
      message: "postId is required",
    });
    return;
  }

  res.json({
    count: await redis.incrBy("count", -1),
    postId,
    type: "decrement",
  });
});

// Leaderboard endpoints
router.post("/api/submit-score", async (req, res): Promise<void> => {
  const { postId, userId } = context;
  if (!postId || !userId) {
    res.status(400).json({ status: "error", message: "Missing context" });
    return;
  }

  try {
    const { score, day } = req.body as { score: number; day: number };

    // Validate score (basic anti-cheat)
    if (!score || score < 0 || score > day * 1000) {
      res.status(400).json({ status: "error", message: "Invalid score" });
      return;
    }

    // Get current personal best
    const currentBestStr = await redis.get(`user:${userId}:best:v3`);
    const currentBest = currentBestStr ? parseInt(currentBestStr) : 0;
    const isNewBest = score > currentBest;

    // Update personal best if needed
    if (isNewBest) {
      await redis.set(`user:${userId}:best:v3`, score.toString());
      await redis.set(`user:${userId}:day:v3`, day.toString());

      // Update leaderboard (sorted set by score)
      await redis.zAdd("leaderboard:global:v3", {
        member: userId,
        score: score,
      });
    }

    // --- DAILY LEADERBOARD LOGIC (runs every game) ---
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyKey = `leaderboard:daily:${today}:v3`;

    // Check if this is a new best for today
    const dailyBestKey = `user:${userId}:daily:${today}:best:v3`;
    const currentDailyBestStr = await redis.get(dailyBestKey);
    const currentDailyBest = currentDailyBestStr ? parseInt(currentDailyBestStr) : 0;

    if (score > currentDailyBest) {
      await redis.set(dailyBestKey, score.toString());
      await redis.zAdd(dailyKey, {
        member: userId,
        score: score,
      });
      // Set expiry for daily keys (e.g., 48 hours to be safe)
      await redis.expire(dailyKey, 172800);
      await redis.expire(dailyBestKey, 172800);
    }
    // --- END DAILY LOGIC ---

    // Increment practice days
    const practiceDays = await redis.incrBy(`user:${userId}:practiceDays:v3`, 1);

    // Get user's rank
    const rank = await redis.zRank("leaderboard:global:v3", userId);
    const userRank = rank !== undefined ? rank + 1 : null;

    // --- STREAK LOGIC ---
    const lastPlayedKey = `user:${userId}:lastPlayed:v3`;
    const streakKey = `user:${userId}:streak:v3`;
    const streakLeaderboardKey = `leaderboard:streaks:v3`;

    const lastPlayed = await redis.get(lastPlayedKey);
    let currentStreak = await redis.get(streakKey).then(s => parseInt(s || '0'));

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const todayDate = new Date().setHours(0, 0, 0, 0);
    const lastPlayedDate = lastPlayed ? new Date(parseInt(lastPlayed)).setHours(0, 0, 0, 0) : 0;

    if (lastPlayedDate === todayDate) {
      // Already played today, keep streak
    } else if (lastPlayedDate === todayDate - oneDay) {
      // Played yesterday, increment streak
      currentStreak++;
    } else {
      // Missed a day (or first time), reset to 1
      currentStreak = 1;
    }

    await redis.set(lastPlayedKey, now.toString());
    await redis.set(streakKey, currentStreak.toString());
    await redis.zAdd(streakLeaderboardKey, { member: userId, score: currentStreak });
    // --- END STREAK LOGIC ---

    res.json({
      type: "submitScoreResponse",
      success: true,
      isNewBest,
      personalBest: {
        score: isNewBest ? score : currentBest,
        day: isNewBest ? day : (await redis.get(`user:${userId}:day:v3`)) ? parseInt(await redis.get(`user:${userId}:day:v3`) || "0") : 0,
        rank: userRank,
        streak: currentStreak, // Add streak to response
      },
      rank: userRank || 0,
      practiceDays,
      streak: currentStreak, // Add streak to top-level response
    });
  } catch (error) {
    console.error("Submit score error:", error);
    res.status(500).json({ status: "error", message: "Failed to submit score" });
  }
});

router.get("/api/personal-best", async (_req, res): Promise<void> => {
  const { userId } = context;
  if (!userId) {
    res.status(400).json({ status: "error", message: "Missing userId" });
    return;
  }

  try {
    const [bestStr, dayStr, practiceDaysStr, streakStr] = await Promise.all([ // Added streakStr
      redis.get(`user:${userId}:best:v3`),
      redis.get(`user:${userId}:day:v3`),
      redis.get(`user:${userId}:practiceDays:v3`),
      redis.get(`user:${userId}:streak:v3`), // Get streak
    ]);

    const practiceDays = practiceDaysStr ? parseInt(practiceDaysStr) : 1;
    const streak = streakStr ? parseInt(streakStr) : 0; // Parse streak

    if (!bestStr) {
      res.json({
        type: "personalBestResponse",
        personalBest: null,
        practiceDays,
        streak, // Add streak to response
      });
      return;
    }

    const rank = await redis.zRank("leaderboard:global:v3", userId);

    res.json({
      type: "personalBestResponse",
      personalBest: {
        score: parseInt(bestStr),
        day: dayStr ? parseInt(dayStr) : 0,
        rank: rank !== undefined ? rank + 1 : null,
        streak, // Add streak to personalBest object
      },
      practiceDays,
      streak, // Add streak to top-level response
    });
  } catch (error) {
    console.error("Get personal best error:", error);
    res.status(500).json({ status: "error", message: "Failed to get personal best" });
  }
});

router.get("/api/leaderboard", async (_req, res): Promise<void> => {
  const { userId } = context;
  const sortBy = _req.query.sortBy as string || 'score'; // Added sortBy parameter

  let key = 'leaderboard:global:v3';
  if (sortBy === 'streak') {
    key = 'leaderboard:streaks:v3';
  } else if (sortBy === 'daily') {
    const today = new Date().toISOString().split('T')[0];
    key = `leaderboard:daily:${today}:v3`;
  }

  try {
    // Get top 500 players (reversed for highest first)
    const topPlayers = await redis.zRange(key, 0, 499, {
      reverse: true,
      by: "rank",
    });

    // Get usernames and days for each player
    const entries = await Promise.all(
      topPlayers.map(async (player, index) => {
        const memberId = player.member as `t2_${string}`;
        let username: string;
        try {
          username = (await reddit.getUserById(memberId))?.username || "Anonymous";
        } catch (e) {
          console.warn(`Could not fetch username for ${memberId}:`, e);
          username = "Anonymous";
        }

        let score = player.score;
        let day = 0;
        let streak = 0;

        if (sortBy === 'streak') {
          streak = score; // If sorting by streak, player.score is the streak
          const bestScoreStr = await redis.get(`user:${memberId}:best:v3`);
          score = bestScoreStr ? parseInt(bestScoreStr) : 0; // Fetch actual best score for display
          const dayStr = await redis.get(`user:${memberId}:day:v3`);
          day = dayStr ? parseInt(dayStr) : 0;
        } else if (sortBy === 'daily') {
          // For daily, score is the daily score
          const dayStr = await redis.get(`user:${memberId}:day:v3`); // Still show their best day ever? Or maybe we should track daily day too? For now, best day ever is fine.
          day = dayStr ? parseInt(dayStr) : 0;
          const streakStr = await redis.get(`user:${memberId}:streak:v3`);
          streak = streakStr ? parseInt(streakStr) : 0;
        } else { // sortBy === 'score'
          const dayStr = await redis.get(`user:${memberId}:day:v3`);
          day = dayStr ? parseInt(dayStr) : 0;
          const streakStr = await redis.get(`user:${memberId}:streak:v3`);
          streak = streakStr ? parseInt(streakStr) : 0;
        }

        return {
          username,
          score,
          day,
          rank: index + 1,
          streak, // Include streak in leaderboard entry
        };
      })
    );

    // Get current user's rank if they have a score
    let userRank = null;
    if (userId) {
      const rank = await redis.zRank(key, userId); // Use the correct key for user's rank
      userRank = rank !== undefined ? rank + 1 : null;
    }

    res.json({
      type: "leaderboardResponse",
      entries,
      userRank,
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ status: "error", message: "Failed to get leaderboard" });
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

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
