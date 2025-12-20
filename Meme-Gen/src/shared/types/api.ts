export type InitResponse = {
  type: "init";
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: "increment";
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: "decrement";
  postId: string;
  count: number;
};

export type DailyCountResponse = {
  type: "daily-count";
  count: number;
  date: string; // YYYY-MM-DD (UTC)
};

export type SessionResponse = {
  type: "session";
  subreddit: string;
  loggedIn: boolean;
  username: string | null;
  snoovatarUrl: string | null;
};

export type PostMemeRequest = {
  base64Image: string;
  title: string;
  targetSubreddit?: string;
  postMode?: "link" | "custom";
};

export type PostMemeSuccessResponse = {
  status: "success";
  postId: string;
  url: string;
  subreddit: string;
  mode: "link" | "custom";
};

export type PostMemeErrorResponse = {
  status: "error";
  message: string;
};

export type PostMemeResponse = PostMemeSuccessResponse | PostMemeErrorResponse;
