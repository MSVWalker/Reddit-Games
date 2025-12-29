import { requestExpandedMode } from "@devvit/web/client";
import type { SessionResponse } from "../../shared/types/api";

const startButton = document.getElementById("start-button") as HTMLButtonElement | null;
const snooAvatar = document.getElementById("snoo-avatar") as HTMLImageElement | null;
const snooMirror = document.getElementById("snoo-mirror") as HTMLImageElement | null;

const setStartMode = (mode: "upload" | "review") => {
  try {
    sessionStorage.setItem("realorai-start", mode);
  } catch {
    // Ignore storage failures.
  }
};

if (startButton) {
  startButton.addEventListener("click", (event) => {
    setStartMode("review");
    requestExpandedMode(event, "game");
  });
}

const setSnooSource = (url: string) => {
  if (snooAvatar) {
    snooAvatar.src = url;
  }
  if (snooMirror) {
    snooMirror.src = url;
  }
};

const applyFallback = () => {
  const fallbackSrc = snooAvatar?.dataset.fallback || "/snoo-fallback.svg";
  setSnooSource(fallbackSrc);
};

if (snooAvatar) {
  snooAvatar.addEventListener("error", applyFallback, { once: true });
}
if (snooMirror) {
  snooMirror.addEventListener("error", applyFallback, { once: true });
}

fetch("/api/session", { credentials: "include" })
  .then((res) => (res.ok ? res.json() : null))
  .then((data: SessionResponse | null) => {
    const url =
      data?.loggedIn && typeof data.snoovatarUrl === "string" && data.snoovatarUrl.trim().length > 0
        ? data.snoovatarUrl.trim()
        : "/api/viewer-snoovatar";

    setSnooSource(url);
  })
  .catch(() => applyFallback());
