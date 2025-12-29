import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CreatePostResponse,
  FeedPost,
  FeedResponse,
  MediaType,
  PostMeta,
  PostStateResponse,
  ReasoningResponse,
  SessionResponse,
  VoteChoice,
  VoteCounts,
  VoteResponse,
} from "../shared/types/api";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 20;

const DEFAULT_COUNTS: VoteCounts = {
  real: 0,
  ai: 0,
  unsure: 0,
  total: 0,
  reasoning: 0,
};

const voteLabels: Record<VoteChoice, string> = {
  real: "Real",
  ai: "AI",
  unsure: "Unsure",
};

const sortLabels: Record<"recent" | "reviewed" | "discussed", string> = {
  recent: "Recent",
  reviewed: "Most Voted",
  discussed: "Most Commented",
};

const getStartPanel = (): "upload" | "review" => {
  try {
    const stored = sessionStorage.getItem("realorai-start");
    if (stored === "review") return "review";
  } catch {
    // Ignore storage failures.
  }
  return "upload";
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const apiGet = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
};

const apiPost = async <T,>(url: string, body: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
};

const countToPercent = (count: number, total: number) => {
  if (!total) return 0;
  return Math.round((count / total) * 100);
};

const buildPostUrl = (post: PostMeta) => {
  return `https://www.reddit.com/r/${post.subreddit}/comments/${post.id}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [postState, setPostState] = useState<PostStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<"upload" | "review">(getStartPanel);
  const [showModeChoice, setShowModeChoice] = useState(true);
  const [sortMode, setSortMode] = useState<"recent" | "reviewed" | "discussed">("recent");
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [feedStatus, setFeedStatus] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [activeFeedIndex, setActiveFeedIndex] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0.5, y: 0.5 });
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const zoomTimerRef = useRef<number | null>(null);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const [voteBusy, setVoteBusy] = useState<string | null>(null);
  const [reasoningText, setReasoningText] = useState("");
  const [reasoningStatus, setReasoningStatus] = useState<string | null>(null);
  const [reasoningError, setReasoningError] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem("realorai-start");
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    if (postState?.kind === "hub") {
      setShowModeChoice(true);
    }
  }, [postState?.kind]);

  useEffect(() => {
    const className = "review-view-body";
    if (isReviewView) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }
    return () => {
      document.body.classList.remove(className);
    };
  }, [isReviewView]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [sessionData, postData] = await Promise.all([
          apiGet<SessionResponse>("/api/session").catch(() => null),
          apiGet<PostStateResponse>("/api/post-state").catch(() => ({
            type: "post-state",
            kind: "unknown",
          })),
        ]);

        if (!active) return;
        setSession(sessionData);
        setPostState(postData);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const loadFeed = async () => {
    setFeedStatus("Refreshing...");
    setFeedError(null);
    try {
      const data = await apiGet<FeedResponse>(`/api/feed?sort=${sortMode}&limit=30`);
      setFeed(data);
      setFeedStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load feed.";
      setFeedError(message);
      setFeedStatus(null);
    }
  };

  useEffect(() => {
    if (postState?.kind !== "hub") return;
    void loadFeed();
  }, [postState?.kind, sortMode]);

  useEffect(() => {
    setActiveFeedIndex(0);
  }, [feed?.posts.length, sortMode]);

  useEffect(() => {
    setZoomActive(false);
    setZoomSrc(null);
  }, [activeFeedIndex, sortMode]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setCreatedUrl(null);
    setUploadStatus(null);
    setUploadError(null);
    setDuration(null);

    if (!nextFile) {
      setMediaType(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    const nextMediaType: MediaType | null = nextFile.type.startsWith("video/")
      ? "video"
      : nextFile.type.startsWith("image/")
      ? "image"
      : null;

    if (!nextMediaType) {
      setUploadError("Only images or videos are supported.");
      setMediaType(null);
      return;
    }

    const sizeLimit = nextMediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (nextFile.size > sizeLimit) {
      setUploadError(
        `${nextMediaType === "video" ? "Video" : "Image"} must be under ${Math.round(
          sizeLimit / (1024 * 1024)
        )}MB.`
      );
    }

    const nextPreview = URL.createObjectURL(nextFile);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextPreview;
    });
    setMediaType(nextMediaType);

    if (nextMediaType === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = nextPreview;
      video.onloadedmetadata = () => {
        setDuration(video.duration);
        if (video.duration > MAX_VIDEO_SECONDS) {
          setUploadError(`Video must be ${MAX_VIDEO_SECONDS} seconds or less.`);
        }
      };
      video.onerror = () => {
        setUploadError("Unable to read video metadata.");
      };
    }
  };

  const canSubmit = useMemo(() => {
    if (!session?.loggedIn) return false;
    if (!title.trim()) return false;
    if (!file || !mediaType) return false;
    if (uploadError) return false;
    if (mediaType === "video" && duration !== null && duration > MAX_VIDEO_SECONDS) return false;
    return true;
  }, [session?.loggedIn, title, file, mediaType, uploadError, duration]);

  const handleCreatePost = async () => {
    if (!file || !mediaType) return;
    if (!session?.loggedIn) {
      setUploadError("You must be logged in to submit evidence.");
      return;
    }

    if (!title.trim()) {
      setUploadError("A title is required.");
      return;
    }

    setUploadBusy(true);
    setUploadError(null);
    setUploadStatus("Uploading...");

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await apiPost<CreatePostResponse>("/api/create-post", {
        title,
        mediaType,
        dataUrl,
        duration: duration ?? undefined,
        sizeBytes: file.size,
      });

      if (response.status === "error") {
        setUploadError(response.message);
        setUploadStatus(null);
        return;
      }

      setUploadStatus("Posted.");
      setCreatedUrl(response.url);
      setTitle("");
      setFile(null);
      setMediaType(null);
      setDuration(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      await loadFeed();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post evidence.";
      setUploadError(message);
      setUploadStatus(null);
    } finally {
      setUploadBusy(false);
    }
  };

  const updateEvidenceCounts = (counts: VoteCounts, choice: VoteChoice) => {
    setPostState((prev) =>
      prev && prev.kind === "evidence"
        ? { ...prev, counts, userVote: choice }
        : prev
    );
  };

  const handleEvidenceVote = async (choice: VoteChoice) => {
    if (!postState || postState.kind !== "evidence" || !postState.post) return;
    if (!session?.loggedIn) return;

    setVoteBusy(choice);
    try {
      const response = await apiPost<VoteResponse>("/api/vote", {
        postId: postState.post.id,
        choice,
      });

      if (response.status === "success" || response.status === "already_voted") {
        updateEvidenceCounts(response.counts, response.choice);
      }
    } finally {
      setVoteBusy(null);
    }
  };

  const updateFeedPost = (postId: string, updater: (post: FeedPost) => FeedPost) => {
    setFeed((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        posts: prev.posts.map((post) => (post.id === postId ? updater(post) : post)),
      };
    });
  };

  const handleFeedVote = async (postId: string, choice: VoteChoice) => {
    if (!session?.loggedIn) return;
    setVoteBusy(postId);
    try {
      const response = await apiPost<VoteResponse>("/api/vote", { postId, choice });
      if (response.status === "success" || response.status === "already_voted") {
        updateFeedPost(postId, (post) => ({
          ...post,
          counts: response.counts,
          userVote: response.choice,
        }));
      }
    } finally {
      setVoteBusy(null);
    }
  };

  const handleReasoningSubmit = async () => {
    if (!postState || postState.kind !== "evidence" || !postState.post) return;
    if (!postState.userVote) {
      setReasoningError("Vote before posting your take.");
      return;
    }

    if (!reasoningText.trim()) {
      setReasoningError("Add your take first.");
      return;
    }

    setReasoningError(null);
    setReasoningStatus("Submitting comment...");

    try {
      const response = await apiPost<ReasoningResponse>("/api/reasoning", {
        postId: postState.post.id,
        text: reasoningText.trim(),
      });

      if (response.status === "error") {
        setReasoningError(response.message);
        setReasoningStatus(null);
        return;
      }

      setReasoningStatus(`Comment posted. View it at ${response.url}`);
      setReasoningText("");
      if (postState.counts) {
        updateEvidenceCounts(
          { ...postState.counts, reasoning: postState.counts.reasoning + 1 },
          postState.userVote
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post comment.";
      setReasoningError(message);
      setReasoningStatus(null);
    }
  };

  const evidenceCounts = postState?.counts ?? DEFAULT_COUNTS;
  const evidenceVoted = Boolean(postState?.userVote);
  const evidenceAuthor = postState?.post?.authorName ?? "PangaeaNative";
  const showHeaderTitle =
    postState?.kind === "hub"
      ? !showModeChoice && activePanel === "upload"
      : postState?.kind !== "evidence";
  const isReviewView = postState?.kind === "hub" && !showModeChoice && activePanel === "review";
  const showHeader = showHeaderTitle;

  const openPost = (url: string) => {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return;
    try {
      window.top?.location?.assign(url);
    } catch {
      window.location.assign(url);
    }
  };

  const clearZoomTimer = () => {
    if (zoomTimerRef.current !== null) {
      window.clearTimeout(zoomTimerRef.current);
      zoomTimerRef.current = null;
    }
  };

  const updateZoomPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    setZoomPosition({ x, y });
  };

  const handleZoomStart = (event: React.PointerEvent<HTMLDivElement>, src: string) => {
    if (event.pointerType !== "touch") return;
    clearZoomTimer();
    updateZoomPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    zoomTimerRef.current = window.setTimeout(() => {
      setZoomSrc(src);
      setZoomActive(true);
    }, 180);
  };

  const handleZoomMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    if (!zoomActive && zoomTimerRef.current === null) return;
    updateZoomPosition(event);
  };

  const handleZoomEnd = () => {
    clearZoomTimer();
    setZoomActive(false);
  };

  const renderResults = (counts: VoteCounts) => {
    const total = counts.total;
    return (
      <div className="results">
        {(Object.keys(voteLabels) as VoteChoice[]).map((choice) => {
          const count = counts[choice];
          const percent = countToPercent(count, total);
          return (
            <div className="result-row" key={choice}>
              <div className="result-label">
                <span>{voteLabels[choice]}</span>
                <span>
                  {count} ({percent}%)
                </span>
              </div>
              <div className="result-bar">
                <span className={choice} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="app-shell">
        <div className="panel">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell${isReviewView ? " review-view" : ""}`}>
      {showHeader ? (
        <header className="app-header">
          {postState?.kind === "hub" && !showModeChoice ? (
            <button className="back-button" type="button" onClick={() => setShowModeChoice(true)}>
              Back
            </button>
          ) : (
            <div className="back-spacer" aria-hidden="true" />
          )}
          {showHeaderTitle ? <div className="app-title">Real or AI</div> : <div aria-hidden="true" />}
          <div className="back-spacer" aria-hidden="true" />
        </header>
      ) : null}

      {postState?.kind === "evidence" && postState.post ? (
        <section className="panel">
          <div className="evidence-header">
            <div className="evidence-title">{postState.post.title}</div>
            <div className="evidence-meta">
              {formatDate(postState.post.createdAt)} - u/{evidenceAuthor}
            </div>
          </div>

          <div className="evidence-layout">
            <div className="media-preview">
              {postState.post.mediaType === "video" ? (
                <video controls playsInline src={postState.post.mediaUrl} />
              ) : (
                <img src={postState.post.mediaUrl} alt={postState.post.title} />
              )}
            </div>

            <div className="vote-panel">
              <h2>Vote</h2>
              {!evidenceVoted ? (
                <div className="vote-buttons">
                  {(Object.keys(voteLabels) as VoteChoice[]).map((choice) => (
                    <button
                      key={choice}
                      className={`vote-button ${choice}`}
                      onClick={() => handleEvidenceVote(choice)}
                      disabled={!session?.loggedIn || Boolean(voteBusy)}
                    >
                      {voteLabels[choice]}
                  </button>
                ))}
              </div>
            ) : (
                <div className="status">Voted: {voteLabels[postState.userVote as VoteChoice]}</div>
              )}

              {evidenceVoted ? (
                <>
                  {renderResults(evidenceCounts)}
                  <div className="note">{evidenceCounts.reasoning} takes</div>
                </>
              ) : (
                <div className="locked-results">Vote to see totals.</div>
              )}
            </div>
          </div>

          <div className="panel" style={{ marginTop: "24px" }}>
            <h2>Comment (optional)</h2>
            <div className="form-field">
              <label htmlFor="reasoning">Comment</label>
              <textarea
                id="reasoning"
                className="textarea"
                value={reasoningText}
                onChange={(event) => setReasoningText(event.target.value)}
                placeholder="Why?"
              />
            </div>
            {reasoningError && <div className="status error">{reasoningError}</div>}
            {reasoningStatus && <div className="status">{reasoningStatus}</div>}
            <div className="cta-row">
              <button
                className="button primary"
                onClick={handleReasoningSubmit}
                disabled={!session?.loggedIn || !postState.userVote}
              >
                Post
              </button>
            </div>
          </div>
        </section>
      ) : postState?.kind === "hub" ? (
        <div className="panel-grid">
          <section
            className={`panel ${activePanel === "review" && !showModeChoice ? "panel-review" : ""}`}
            style={{ animationDelay: "0.1s" }}
          >
            {showModeChoice ? (
              <div className="mode-choice">
                <div className="mode-choice-cards">
                  <button
                    type="button"
                    className={`mode-card ${activePanel === "upload" ? "active" : ""}`}
                    aria-pressed={activePanel === "upload"}
                    onClick={() => {
                      setActivePanel("upload");
                      setShowModeChoice(false);
                    }}
                  >
                    <span className="mode-card-title">Upload an Image</span>
                  </button>
                  <button
                    type="button"
                    className={`mode-card ${activePanel === "review" ? "active" : ""}`}
                    aria-pressed={activePanel === "review"}
                    onClick={() => {
                      setActivePanel("review");
                      setShowModeChoice(false);
                    }}
                  >
                    <span className="mode-card-title">Vote on Images</span>
                  </button>
                </div>
              </div>
            ) : activePanel === "upload" ? (
              <>
                <h2>New round</h2>
                <div className="form-field">
                  <label htmlFor="title">Title</label>
                  <input
                    id="title"
                    className="input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Give it a name"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="file">Media</label>
                  <input
                    id="file"
                    className="file-input"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                  />
                </div>
                {previewUrl && (
                  <div className="media-preview">
                    {mediaType === "video" ? (
                      <video controls playsInline src={previewUrl} />
                    ) : (
                      <img src={previewUrl} alt="Preview" />
                    )}
                  </div>
                )}
                <p className="note">
                  {MAX_VIDEO_SECONDS}s video. 20MB max video, 8MB max image.
                </p>
                {uploadError && <div className="status error">{uploadError}</div>}
                {uploadStatus && <div className="status">{uploadStatus}</div>}
                {createdUrl && (
                  <div className="status">
                    Round posted. <a href={createdUrl} target="_blank" rel="noreferrer">Open</a>
                  </div>
                )}
                <div className="cta-row">
                  <button
                    className="button primary"
                    onClick={handleCreatePost}
                    disabled={!canSubmit || uploadBusy}
                  >
                    Post
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setTitle("");
                      setFile(null);
                      setMediaType(null);
                      setDuration(null);
                      setUploadError(null);
                      setUploadStatus(null);
                      setCreatedUrl(null);
                      setPreviewUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return null;
                      });
                    }}
                  >
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <>
              <div className="sort-row">
                <button className="back-button inline" type="button" onClick={() => setShowModeChoice(true)}>
                  Back
                </button>
                <div className="tabs">
                  {(["recent", "reviewed", "discussed"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`tab-button ${sortMode === mode ? "active" : ""}`}
                      onClick={() => setSortMode(mode)}
                    >
                      {sortLabels[mode]}
                    </button>
                  ))}
                </div>
              </div>
                {feedError && <div className="status error">{feedError}</div>}
                {feed && feed.posts.length ? (
                  (() => {
                    const clampedIndex = Math.min(activeFeedIndex, feed.posts.length - 1);
                    const post = feed.posts[clampedIndex];
                    const authorLabel = post.authorName ? `u/${post.authorName}` : "u/PangaeaNative";
                    return (
                      <div className="feed-card" key={post.id}>
                        <div
                          className={`media-preview max ${post.mediaType === "image" ? "square" : ""}`}
                          onPointerDown={
                            post.mediaType === "image"
                              ? (event) => handleZoomStart(event, post.mediaUrl)
                              : undefined
                          }
                          onPointerMove={post.mediaType === "image" ? handleZoomMove : undefined}
                          onPointerUp={post.mediaType === "image" ? handleZoomEnd : undefined}
                          onPointerLeave={post.mediaType === "image" ? handleZoomEnd : undefined}
                          onPointerCancel={post.mediaType === "image" ? handleZoomEnd : undefined}
                        >
                          {post.mediaType === "video" ? (
                            <video controls playsInline src={post.mediaUrl} />
                          ) : (
                            <img src={post.mediaUrl} alt={post.title} />
                          )}
                          {post.mediaType === "image" && zoomActive && zoomSrc === post.mediaUrl ? (
                            <div
                              className="zoom-lens"
                              style={
                                {
                                  "--zoom-x": `${zoomPosition.x * 100}%`,
                                  "--zoom-y": `${zoomPosition.y * 100}%`,
                                  "--zoom-src": `url("${zoomSrc}")`,
                                } as React.CSSProperties
                              }
                            />
                          ) : null}
                        </div>
                        <div className="feed-title">{post.title}</div>
                        <div className="feed-meta">
                          <span>{formatDate(post.createdAt)}</span>
                          <span>{authorLabel}</span>
                        </div>
                        <div className="vote-panel" style={{ marginTop: "8px" }}>
                          {post.userVote ? null : (
                            <div className="vote-buttons">
                              {(Object.keys(voteLabels) as VoteChoice[]).map((choice) => (
                                <button
                                  key={choice}
                                  className={`vote-button ${choice}`}
                                  onClick={() => handleFeedVote(post.id, choice)}
                                  disabled={!session?.loggedIn || voteBusy === post.id}
                                >
                                  {voteLabels[choice]}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="cta-row nav-row">
                            <button
                              className="button secondary"
                              onClick={() => setActiveFeedIndex((index) => Math.max(0, index - 1))}
                              disabled={clampedIndex === 0}
                            >
                              Previous
                            </button>
                            <button
                              className="button secondary"
                              onClick={() =>
                                setActiveFeedIndex((index) =>
                                  Math.min(feed.posts.length - 1, index + 1)
                                )
                              }
                              disabled={clampedIndex >= feed.posts.length - 1}
                            >
                              Next
                            </button>
                            <button
                              className="button secondary"
                              onClick={() => openPost(buildPostUrl(post))}
                            >
                              Open post
                            </button>
                          </div>
                          {post.userVote ? (
                            <div className="status">Voted: {voteLabels[post.userVote]}</div>
                          ) : null}
                          {post.userVote ? renderResults(post.counts) : null}
                        </div>
                      </div>
                    );
                  })()
                ) : null}
                {feed && feed.posts.length === 0 ? (
                  <div className="status">No rounds yet.</div>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="panel">
          <h2>RealOrAI is not active here.</h2>
          <p>Head to the RealOrAI hub post to upload or vote on rounds.</p>
        </div>
      )}
    </div>
  );
}
