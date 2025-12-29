export type VoteChoice = "real" | "ai" | "unsure";
export type MediaType = "image" | "video";
export type PostKind = "hub" | "evidence" | "unknown";

export type SessionResponse = {
  type: "session";
  subreddit: string;
  loggedIn: boolean;
  username: string | null;
  snoovatarUrl: string | null;
};

export type PostMeta = {
  id: string;
  title: string;
  mediaUrl: string;
  mediaType: MediaType;
  createdAt: string;
  authorName: string | null;
  subreddit: string;
};

export type VoteCounts = {
  real: number;
  ai: number;
  unsure: number;
  total: number;
  reasoning: number;
};

export type PostStateResponse = {
  type: "post-state";
  kind: PostKind;
  post?: PostMeta;
  counts?: VoteCounts;
  userVote?: VoteChoice | null;
};

export type FeedPost = PostMeta & {
  counts: VoteCounts;
  userVote: VoteChoice | null;
};

export type FeedResponse = {
  type: "feed";
  sort: "recent" | "reviewed" | "discussed";
  posts: FeedPost[];
};

export type CreatePostRequest = {
  title: string;
  mediaType: MediaType;
  dataUrl: string;
  duration?: number;
  sizeBytes?: number;
};

export type CreatePostResponse =
  | { status: "success"; postId: string; url: string }
  | { status: "error"; message: string };

export type VoteRequest = {
  postId?: string;
  choice: VoteChoice;
};

export type VoteResponse =
  | { status: "success"; counts: VoteCounts; choice: VoteChoice }
  | { status: "already_voted"; counts: VoteCounts; choice: VoteChoice }
  | { status: "error"; message: string };

export type ReasoningRequest = {
  postId?: string;
  text: string;
};

export type ReasoningResponse =
  | { status: "success"; commentId: string; url: string }
  | { status: "error"; message: string };
