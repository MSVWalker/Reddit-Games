const GUEST_ID_KEY = "lane-defense:guest-id";
const startButton = document.getElementById("start-training") as HTMLButtonElement | null;
const dailyButton = document.getElementById("start-daily") as HTMLButtonElement | null;
const leaderboardButton = document.getElementById("see-leaderboard") as HTMLButtonElement | null;
const testButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-test-day]")
);

const generateGuestId = () => {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getGuestId = () => {
  try {
    const stored = localStorage.getItem(GUEST_ID_KEY);
    if (stored && /^[a-z0-9]{8,32}$/.test(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors.
  }
  const fresh = generateGuestId();
  try {
    localStorage.setItem(GUEST_ID_KEY, fresh);
  } catch {
    // Ignore storage errors.
  }
  return fresh;
};

const setDailyButtonState = (attemptUsed: boolean) => {
  if (!dailyButton) return;
  if (attemptUsed) {
    dailyButton.textContent = "Attempt Used";
    dailyButton.disabled = true;
  } else {
    dailyButton.textContent = "Daily Challenge";
    dailyButton.disabled = false;
  }
};

const loadDailyStatus = async () => {
  if (!dailyButton) return;
  try {
    const guestId = getGuestId();
    const response = await fetch(`/api/daily-challenge?ts=${Date.now()}&guestId=${guestId}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { type?: string; attemptUsed?: boolean };
    if (data.type === "daily-challenge-status") {
      setDailyButtonState(Boolean(data.attemptUsed));
    }
  } catch {
    // Ignore daily status errors.
  }
};

startButton?.addEventListener("click", (event) => {
  event.preventDefault();
  window.location.assign("game.html");
});

dailyButton?.addEventListener("click", (event) => {
  event.preventDefault();
  if (dailyButton.disabled) return;
  window.location.assign("game.html?mode=daily");
});

testButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const day = button.dataset.testDay ?? "";
    if (!day) return;
    window.location.assign(`game.html?mode=daily&testDay=${encodeURIComponent(day)}`);
  });
});

leaderboardButton?.addEventListener("click", (event) => {
  event.preventDefault();
  window.location.assign("game.html?mode=leaderboard");
});

void loadDailyStatus();
