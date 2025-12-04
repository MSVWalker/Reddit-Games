import { requestExpandedMode } from "@devvit/web/client";

const memesCountEl = document.getElementById("memes-count") as HTMLSpanElement | null;
// Splash screen logic
console.log("Splash loaded");

const startButton = document.getElementById(
  "start-button"
) as HTMLButtonElement;

startButton.addEventListener("click", (e) => {
  requestExpandedMode(e, "game");
});

// Lightly dynamic daily counter so it isn't a static placeholder
if (memesCountEl) {
  const now = new Date();
  // Keep it low for dev/testing to avoid implying prod traffic
  const base = 3;
  const swing = (now.getHours() * 7 + now.getMinutes() * 3 + Math.floor(now.getSeconds() / 20)) % 18;
  memesCountEl.textContent = (base + swing).toString();
}
