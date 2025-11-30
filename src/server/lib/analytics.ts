import { redis } from "@devvit/web/server";

/**
 * Analytics Helper Functions for Redis-based tracking
 * Note: Simplified for Devvit Redis compatibility
 */

// ============================================
// USER RETENTION TRACKING
// ============================================

/**
 * Track a user session - increments their session count
 */
export async function trackUserSession(username: string): Promise<number> {
    const key = `analytics:users:${username}:sessions`;
    const current = parseInt(await redis.get(key) || '0');
    const newCount = current + 1;
    await redis.set(key, newCount.toString());

    // Track in DAU
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dauKey = `analytics:dau:${today}:${username}`;
    await redis.set(dauKey, '1');
    await redis.expire(dauKey, 7 * 24 * 60 * 60); // Expire after 7 days

    return newCount;
}

/**
 * Get user retention breakdown
 */
export async function getUserRetentionStats() {
    // Note: This is expensive - we'll scan by pattern
    // In production, you'd want to cache this or use a different approach

    const categories = {
        firstTime: 0,      // 1 session
        secondTime: 0,     // 2 sessions
        recurring: 0,      // 3-5 sessions
        regular: 0,        // 6-10 sessions
        power: 0,          // 11+ sessions
    };

    // Sample approach: track total unique users in a separate counter
    const totalUsers = parseInt(await redis.get('analytics:total_unique_users') || '0');

    // For now, return a simplified version
    // In a real implementation, you'd maintain count keys for each category
    return {
        categories,
        totalUniqueUsers: totalUsers,
        note: "User categorization requires scanning all user keys - showing total count only",
    };
}

/**
 * Get DAU count (approximate)
 */
export async function getActiveUserStats() {
    const dauCount = parseInt(await redis.get('analytics:dau_count') || '0');

    return {
        dau: dauCount,
        note: "DAU is approximate based on tracked sessions"
    };
}

// ============================================
// GAME METRICS TRACKING
// ============================================

/**
 * Track game start
 */
export async function trackGameStart(mode: 'classic' | 'f1exican'): Promise<void> {
    // Increment total games
    const totalKey = 'analytics:total_games';
    const total = parseInt(await redis.get(totalKey) || '0');
    await redis.set(totalKey, (total + 1).toString());

    // Increment mode-specific games
    const modeKey = `analytics:games:${mode}`;
    const modeTotal = parseInt(await redis.get(modeKey) || '0');
    await redis.set(modeKey, (modeTotal + 1).toString());
}

/**
 * Track game completion with stats
 */
export async function trackGameComplete(
    mode: 'classic' | 'f1exican',
    score: number,
    day: number
): Promise<void> {
    // Increment completed games
    const completedKey = `analytics:completed:${mode}`;
    const completed = parseInt(await redis.get(completedKey) || '0');
    await redis.set(completedKey, (completed + 1).toString());

    // Update running average for score
    await updateRunningAverage(`analytics:avg_score:${mode}`, score);

    // Update running average for day
    await updateRunningAverage(`analytics:avg_day:${mode}`, day);

    // Update high score if needed
    await updateHighScore(`analytics:high_score:${mode}`, score);
}

/**
 * Get game metrics
 */
export async function getGameMetrics() {
    const [
        totalGames,
        classicGames,
        f1exicanGames,
        classicCompleted,
        f1exicanCompleted,
        avgScoreClassic,
        avgScoreF1exican,
        avgDayClassic,
        avgDayF1exican,
        highScoreClassic,
        highScoreF1exican,
    ] = await Promise.all([
        redis.get('analytics:total_games'),
        redis.get('analytics:games:classic'),
        redis.get('analytics:games:f1exican'),
        redis.get('analytics:completed:classic'),
        redis.get('analytics:completed:f1exican'),
        redis.get('analytics:avg_score:classic'),
        redis.get('analytics:avg_score:f1exican'),
        redis.get('analytics:avg_day:classic'),
        redis.get('analytics:avg_day:f1exican'),
        redis.get('analytics:high_score:classic'),
        redis.get('analytics:high_score:f1exican'),
    ]);

    return {
        totalGames: parseInt(totalGames || '0'),
        byMode: {
            classic: parseInt(classicGames || '0'),
            f1exican: parseInt(f1exicanGames || '0'),
        },
        completed: {
            classic: parseInt(classicCompleted || '0'),
            f1exican: parseInt(f1exicanCompleted || '0'),
        },
        averageScore: {
            classic: parseFloat(avgScoreClassic || '0'),
            f1exican: parseFloat(avgScoreF1exican || '0'),
        },
        averageDay: {
            classic: parseFloat(avgDayClassic || '0'),
            f1exican: parseFloat(avgDayF1exican || '0'),
        },
        highScore: {
            classic: parseInt(highScoreClassic || '0'),
            f1exican: parseInt(highScoreF1exican || '0'),
        },
    };
}

// ============================================
// FEATURE USAGE TRACKING
//============================================

/**
 * Track feature usage
 */
export async function trackFeatureUsage(feature: string, value: number = 1): Promise<void> {
    const key = `analytics:feature:${feature}`;
    const current = parseInt(await redis.get(key) || '0');
    await redis.set(key, (current + value).toString());
}

/**
 * Get feature usage stats
 */
export async function getFeatureStats() {
    const [
        catUnlocks,
        freezeUsage,
        rageUsage,
        slamUsage,
        chefKnifeUsage,
        scissorsUsage,
        cleaverUsage,
        scytheUsage,
        katanaUsage,
    ] = await Promise.all([
        redis.get('analytics:feature:cat_unlock'),
        redis.get('analytics:feature:powerup_freeze'),
        redis.get('analytics:feature:powerup_rage'),
        redis.get('analytics:feature:powerup_slam'),
        redis.get('analytics:feature:knife_chef'),
        redis.get('analytics:feature:knife_scissors'),
        redis.get('analytics:feature:knife_cleaver'),
        redis.get('analytics:feature:knife_scythe'),
        redis.get('analytics:feature:knife_katana'),
    ]);

    return {
        catUnlocks: parseInt(catUnlocks || '0'),
        powerups: {
            freeze: parseInt(freezeUsage || '0'),
            rage: parseInt(rageUsage || '0'),
            slam: parseInt(slamUsage || '0'),
        },
        knives: {
            chef: parseInt(chefKnifeUsage || '0'),
            scissors: parseInt(scissorsUsage || '0'),
            cleaver: parseInt(cleaverUsage || '0'),
            scythe: parseInt(scytheUsage || '0'),
            katana: parseInt(katanaUsage || '0'),
        },
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Update running average in Redis
 */
async function updateRunningAverage(key: string, newValue: number): Promise<void> {
    const countKey = `${key}:count`;
    const sumKey = `${key}:sum`;

    const count = parseInt(await redis.get(countKey) || '0') + 1;
    const sum = parseInt(await redis.get(sumKey) || '0') + newValue;

    await Promise.all([
        redis.set(countKey, count.toString()),
        redis.set(sumKey, sum.toString()),
        redis.set(key, (sum / count).toString()),
    ]);
}

/**
 * Update high score if new score is higher
 */
async function updateHighScore(key: string, newScore: number): Promise<void> {
    const current = parseInt(await redis.get(key) || '0');
    if (newScore > current) {
        await redis.set(key, newScore.toString());
    }
}
