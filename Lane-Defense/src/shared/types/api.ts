export interface DailyResponse {
  type: "daily";
  date: string;
  seed: number;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  waves: number;
  hp: number;
  towers: number;
  path: number;
  dps: number;
  attempts: number;
}

export interface LeaderboardResponse {
  type: "leaderboard";
  date: string;
  weekStart?: string;
  weekEnd?: string;
  entries: LeaderboardEntry[];
  userRank: number | null;
  self?: LeaderboardEntry | null;
  selfRank?: number | null;
}

export interface SubmitScoreRequest {
  score: number;
  waves: number;
  hp: number;
  towers: number;
  path: number;
  dps: number;
  seed: number;
  guestId?: string;
}

export interface SubmitScoreResponse {
  type: "submit";
  status: "ok" | "error";
  rank: number | null;
  bestScore: number;
  message?: string;
}

export interface SubmitFeedbackRequest {
  text: string;
}

export interface SubmitFeedbackResponse {
  type: "feedback";
  status: "ok" | "error";
  authorName?: string;
  asUser?: boolean;
  message?: string;
}

export interface GridPoint {
  x: number;
  y: number;
}

export interface DailyChallengeStatusResponse {
  type: "daily-challenge-status";
  date: string;
  dayIndex: number;
  seed: number;
  spawn: GridPoint;
  exit: GridPoint;
  attemptUsed: boolean;
  testMode?: boolean;
}

export interface DailyChallengeClaimResponse {
  type: "daily-challenge-claim";
  status: "ok" | "used";
  date: string;
  dayIndex: number;
  seed: number;
  spawn: GridPoint;
  exit: GridPoint;
  attemptUsed: boolean;
  testMode?: boolean;
  message?: string;
}

export interface DailyChallengeLeaderboardResponse {
  type: "daily-challenge-leaderboard";
  date: string;
  dayIndex: number;
  entries: LeaderboardEntry[];
  userRank: number | null;
  self?: LeaderboardEntry | null;
  selfRank?: number | null;
}
