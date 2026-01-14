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

export type MapTileCode = 0 | 1 | 2;

export interface MapData {
  id: string;
  title: string;
  description: string;
  width: number;
  height: number;
  tiles: MapTileCode[];
  spawn: GridPoint;
  exit: GridPoint;
  hpMult: number;
  speedMult: number;
  creatorId: string;
  creatorName: string;
  createdAt: number;
  version: number;
  published: boolean;
  totalPlays: number;
  plays7d: number;
  postId?: string;
}

export interface MapSummary {
  id: string;
  title: string;
  creatorName: string;
  createdAt: number;
  totalPlays: number;
  plays7d: number;
}

export interface MapSaveRequest {
  title: string;
  description?: string;
  map: {
    width: number;
    height: number;
    tiles: MapTileCode[];
    spawn: GridPoint;
    exit: GridPoint;
    hpMult: number;
    speedMult: number;
  };
  guestId?: string;
}

export interface MapSaveResponse {
  type: "map-save";
  status: "ok" | "error";
  mapId?: string;
  postId?: string;
  message?: string;
}

export interface MapListResponse {
  type: "map-list";
  entries: MapSummary[];
}

export interface MapDetailResponse {
  type: "map";
  map: MapData;
}

export interface MapPlayRequest {
  mapId: string;
}

export interface MapPlayResponse {
  type: "map-play";
  status: "ok" | "error";
  message?: string;
}

export interface MapRunRequest {
  mapId: string;
  status: "victory" | "defeat";
  waves: number;
  score: number;
  hp: number;
}

export interface MapRunResponse {
  type: "map-run";
  status: "ok" | "error";
  message?: string;
}

export interface CoopJoinRequest {
  mode: "invite" | "queue";
  runId?: string;
  guestId?: string;
}

export interface CoopJoinResponse {
  type: "coop-join";
  status: "ok" | "error";
  runId?: string;
  role?: "builder" | "wizard";
  seed?: number;
  mapId?: string;
  message?: string;
}

export interface CoopRunResponse {
  type: "coop-run";
  status: "ok" | "error";
  runId?: string;
  role?: "builder" | "wizard";
  seed?: number;
  mapId?: string;
  events?: CoopEvent[];
  nextSeq?: number;
  message?: string;
}

export interface CoopEvent {
  seq: number;
  type: "build" | "upgrade" | "sell" | "target" | "start-wave" | "spell" | "contract";
  tick?: number;
  payload: Record<string, unknown>;
}

export interface CoopEventRequest {
  runId: string;
  role: "builder" | "wizard";
  guestId?: string;
  type: CoopEvent["type"];
  tick?: number;
  payload: Record<string, unknown>;
}

export interface CoopEventResponse {
  type: "coop-event";
  status: "ok" | "error";
  nextSeq?: number;
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
