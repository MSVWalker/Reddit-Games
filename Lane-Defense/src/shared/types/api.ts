export interface DailyResponse {
  type: "daily";
  date: string;
  seed: number;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  waves: number;
}

export interface LeaderboardResponse {
  type: "leaderboard";
  date: string;
  entries: LeaderboardEntry[];
  userRank: number | null;
}

export interface SubmitScoreRequest {
  score: number;
  waves: number;
  seed: number;
}

export interface SubmitScoreResponse {
  type: "submit";
  status: "ok" | "error";
  rank: number | null;
  bestScore: number;
  message?: string;
}
