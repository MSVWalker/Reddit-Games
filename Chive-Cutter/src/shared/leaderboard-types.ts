// Shared types for Chive Cutter leaderboard system

export interface LeaderboardEntry {
    username: string;
    score: number;
    day: number;
    rank: number;
    streak?: number; // Optional for streak leaderboard
}

export interface PersonalBestData {
    score: number;
    day: number;
    rank: number | null;
    streak: number;
    practiceDays: number;
}

// Client to Server messages
export interface SubmitScoreMessage {
    type: 'submitScore';
    score: number;
    day: number;
}

export interface GetPersonalBestMessage {
    type: 'getPersonalBest';
}

export interface GetLeaderboardMessage {
    type: 'getLeaderboard';
    limit?: number;
    sortBy?: 'score' | 'streak'; // Support sorting
}

export type ClientMessage =
    | SubmitScoreMessage
    | GetPersonalBestMessage
    | GetLeaderboardMessage;

// Server to Client responses
export interface SubmitScoreResponse {
    type: 'submitScoreResponse';
    success: boolean;
    isNewBest: boolean;
    personalBest: PersonalBestData;
    rank: number;
    streak: number;
}

export interface PersonalBestResponse {
    type: 'personalBestResponse';
    personalBest: PersonalBestData | null;
}

export interface LeaderboardResponse {
    type: 'leaderboardResponse';
    entries: LeaderboardEntry[];
    userRank: number | null;
}

export type ServerMessage =
    | SubmitScoreResponse
    | PersonalBestResponse
    | LeaderboardResponse;
