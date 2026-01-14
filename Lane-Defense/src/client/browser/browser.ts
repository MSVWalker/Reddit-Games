interface MapSummary {
  id: string;
  title: string;
  creatorName: string;
  createdAt: number;
  totalPlays: number;
  plays7d: number;
}

const listEl = document.getElementById("map-list");
const statusEl = document.getElementById("browser-status");
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-button"));
const backButton = document.getElementById("back-training") as HTMLButtonElement | null;
let activeSort = "trending";

const formatDate = (value: number) => {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
};

const setStatus = (message: string) => {
  if (!statusEl) return;
  statusEl.textContent = message;
};

const renderList = (entries: MapSummary[]) => {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!entries.length) {
    setStatus("No maps yet.");
    return;
  }
  setStatus("");
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "map-row";
    row.innerHTML = `
      <strong>${entry.title}</strong>
      <span>${entry.creatorName}</span>
      <span>${entry.totalPlays} plays</span>
      <span>${entry.plays7d} / 7d</span>
      <span>${formatDate(entry.createdAt)}</span>
    `;
    const playButton = document.createElement("button");
    playButton.className = "map-play";
    playButton.textContent = "Play";
    playButton.addEventListener("click", () => {
      window.location.assign(`game.html?mode=ugc&mapId=${encodeURIComponent(entry.id)}`);
    });
    row.appendChild(playButton);
    listEl.appendChild(row);
  });
};

const loadMaps = async () => {
  setStatus("Loading...");
  try {
    const response = await fetch(`/api/maps/list?sort=${encodeURIComponent(activeSort)}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("fetch failed");
    const data = (await response.json()) as { type?: string; entries?: MapSummary[] };
    if (data.type !== "map-list" || !Array.isArray(data.entries)) {
      throw new Error("invalid response");
    }
    renderList(data.entries);
  } catch {
    setStatus("Failed to load maps.");
  }
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((btn) => btn.classList.remove("active"));
    tab.classList.add("active");
    activeSort = tab.dataset.sort ?? "trending";
    void loadMaps();
  });
});

backButton?.addEventListener("click", () => window.location.assign("training.html"));

void loadMaps();
