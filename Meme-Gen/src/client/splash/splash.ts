import { requestExpandedMode } from "@devvit/web/client";
import type { SessionResponse } from "../../shared/types/api";

const collageEl = document.querySelector(".collage");
const previewGridEl = document.querySelector(".preview-grid");
const snooAvatarEl = document.getElementById("snoo-avatar") as HTMLImageElement | null;
// Splash screen logic
console.log("Splash loaded");

const startButton = document.getElementById(
  "start-button"
) as HTMLButtonElement;

startButton.addEventListener("click", (e) => {
  requestExpandedMode(e, "game");
});

const runIdle = (fn: () => void) => {
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(fn);
  } else {
    setTimeout(fn, 120);
  }
};

const TEMPLATE_PREFETCH_SOURCES = [
  "/memes/distracted-boyfriend.jpg",
  "/memes/drake-hotline-bling.jpg",
  "/memes/expanding-brain.jpg",
  "/memes/gru-plan.jpg",
  "/memes/this-is-fine.jpg",
  "/memes/waiting-skeleton.jpg",
  "/memes/change-my-mind.jpg",
  "/memes/two-buttons.jpg",
  "/memes/is-this-a-pigeon.jpg",
  "/memes/roll-safe-think-about-it.jpg",
  "/memes/monkey-puppet.jpg",
  "/memes/left-exit-off-ramp2.jpg",
  "/memes/yall-got-any-more-of-that.jpg",
  "/memes/woman-yelling-cat.jpg",
  "/memes/one-does-not-simply.jpg",
  "/memes/surprised-pikachu.jpg",
  "/memes/uno-draw-25.jpg",
  "/memes/hide-the-pain-harold.jpg",
  "/memes/bernie-i-am-once-again.jpg",
  "/memes/hard-to-swallow-pills.jpg",
];

const warmedTemplates: HTMLImageElement[] = [];

const warmTemplateCache = () => {
  const uniqueSources = Array.from(new Set(TEMPLATE_PREFETCH_SOURCES)).slice(0, 20);
  uniqueSources.forEach((src) => {
    const img = new Image();
    img.decoding = "async";
    (img as any).fetchPriority = "low";
    img.src = src;
    warmedTemplates.push(img);
  });
};

// Critical path: Snoovatar + hero
const loadSnoovatar = () => {
  if (!snooAvatarEl) return;
  const fallbackSrc = snooAvatarEl.dataset.fallback || "snoo.png";

  // Hide until resolved to avoid swap flash.
  snooAvatarEl.style.visibility = "hidden";
  snooAvatarEl.classList.add("loading");
  snooAvatarEl.fetchPriority = "high";
  snooAvatarEl.removeAttribute("src");

  const reveal = () => {
    snooAvatarEl.style.visibility = "visible";
    snooAvatarEl.classList.remove("loading");
  };

  snooAvatarEl.addEventListener("load", () => {
    reveal();
  });

  snooAvatarEl.addEventListener("error", () => {
    console.warn("Snoovatar failed to load, falling back to default", { attemptedSrc: snooAvatarEl.src });
    snooAvatarEl.src = fallbackSrc;
    snooAvatarEl.classList.remove("is-snoovatar");
    reveal();
  });

  fetch("/api/session", { credentials: "include" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: SessionResponse | null) => {
      const url =
        data?.loggedIn && typeof data.snoovatarUrl === "string" && data.snoovatarUrl.trim().length > 0
          ? data.snoovatarUrl.trim()
          : null;
      if (url) {
        snooAvatarEl.src = url;
        snooAvatarEl.classList.add("is-snoovatar");
      } else {
        snooAvatarEl.src = fallbackSrc;
        snooAvatarEl.classList.remove("is-snoovatar");
      }
    })
    .catch((err) => {
      console.warn("Failed to load session for snoovatar; using fallback", err);
      snooAvatarEl.src = fallbackSrc;
    });
};

// Decorative: background collage
const buildCollage = () => {
  if (!(collageEl instanceof HTMLElement)) return;
  const templates = [
    { src: "/memes/distracted-boyfriend.jpg", alt: "Distracted boyfriend" },
    { src: "/memes/drake-hotline-bling.jpg", alt: "Drake hotline bling" },
    { src: "/memes/expanding-brain.jpg", alt: "Expanding brain" },
    { src: "/memes/gru-plan.jpg", alt: "Gru plan" },
    { src: "/memes/this-is-fine.jpg", alt: "This is fine" },
    { src: "/memes/waiting-skeleton.jpg", alt: "Waiting skeleton" },
    { src: "/memes/change-my-mind.jpg", alt: "Change my mind" },
    { src: "/memes/two-buttons.jpg", alt: "Two buttons" },
    { src: "/memes/is-this-a-pigeon.jpg", alt: "Is this a pigeon" },
    { src: "/memes/roll-safe-think-about-it.jpg", alt: "Roll safe" },
    { src: "/memes/monkey-puppet.jpg", alt: "Monkey puppet" },
    { src: "/memes/left-exit-off-ramp2.jpg", alt: "Left exit" },
    { src: "/memes/yall-got-any-more-of-that.jpg", alt: "Yall got any more" },
    { src: "/memes/woman-yelling-cat.jpg", alt: "Woman yelling cat" },
    { src: "/memes/one-does-not-simply.jpg", alt: "One does not simply" },
    { src: "/memes/surprised-pikachu.jpg", alt: "Surprised Pikachu" },
  ];

  const approxCols = Math.max(6, Math.ceil(window.innerWidth / 110));
  const approxRows = Math.max(6, Math.ceil(window.innerHeight / 110));
  const totalTiles = Math.min(180, approxCols * approxRows);

  for (let i = 0; i < totalTiles; i++) {
    const t = templates[i % templates.length]!;
    const tile = document.createElement("div");
    tile.className = "strip-card";
    tile.setAttribute("aria-hidden", "true");

    const img = document.createElement("img");
    img.src = t.src;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    (img as any).fetchPriority = "low";

    tile.appendChild(img);
    collageEl.appendChild(tile);
  }
};

// Decorative: small preview grid
const buildPreview = () => {
  if (!(previewGridEl instanceof HTMLElement)) return;
  const previewTemplates = [
    { src: "/memes/distracted-boyfriend.jpg", alt: "Distracted boyfriend" },
    { src: "/memes/drake-hotline-bling.jpg", alt: "Drake hotline bling" },
    { src: "/memes/uno-draw-25.jpg", alt: "Uno draw 25" },
    { src: "/memes/two-buttons.jpg", alt: "Two buttons" },
    { src: "/memes/is-this-a-pigeon.jpg", alt: "Is this a pigeon" },
    { src: "/memes/expanding-brain.jpg", alt: "Expanding brain" },
    { src: "/memes/change-my-mind.jpg", alt: "Change my mind" },
    { src: "/memes/woman-yelling-cat.jpg", alt: "Woman yelling cat" },
    { src: "/memes/surprised-pikachu.jpg", alt: "Surprised pikachu" },
    { src: "/memes/this-is-fine.jpg", alt: "This is fine" },
  ];

  previewTemplates.forEach((t) => {
    const tile = document.createElement("div");
    tile.className = "preview-tile";
    tile.setAttribute("aria-hidden", "true");

    const img = document.createElement("img");
    img.src = t.src;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    (img as any).fetchPriority = "low";

    tile.appendChild(img);
    previewGridEl.appendChild(tile);
  });
};

// Run critical first, then defer the rest
loadSnoovatar();
runIdle(buildCollage);
runIdle(buildPreview);
runIdle(warmTemplateCache);
