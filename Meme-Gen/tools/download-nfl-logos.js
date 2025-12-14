import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "src/client/public/stickers/nfl");

const USER_AGENT = "Meme-Gen (https://github.com/MSVWalker/Reddit-Games; contact: michaelwalker)";

const NFL_TEAMS = [
  { name: "Arizona Cardinals", title: "Arizona Cardinals", slug: "arizona-cardinals" },
  { name: "Atlanta Falcons", title: "Atlanta Falcons", slug: "atlanta-falcons" },
  { name: "Baltimore Ravens", title: "Baltimore Ravens", slug: "baltimore-ravens" },
  { name: "Buffalo Bills", title: "Buffalo Bills", slug: "buffalo-bills" },
  { name: "Carolina Panthers", title: "Carolina Panthers", slug: "carolina-panthers" },
  { name: "Chicago Bears", title: "Chicago Bears", slug: "chicago-bears" },
  { name: "Cincinnati Bengals", title: "Cincinnati Bengals", slug: "cincinnati-bengals" },
  { name: "Cleveland Browns", title: "Cleveland Browns", slug: "cleveland-browns" },
  { name: "Dallas Cowboys", title: "Dallas Cowboys", slug: "dallas-cowboys" },
  { name: "Denver Broncos", title: "Denver Broncos", slug: "denver-broncos" },
  { name: "Detroit Lions", title: "Detroit Lions", slug: "detroit-lions" },
  { name: "Green Bay Packers", title: "Green Bay Packers", slug: "green-bay-packers" },
  { name: "Houston Texans", title: "Houston Texans", slug: "houston-texans" },
  { name: "Indianapolis Colts", title: "Indianapolis Colts", slug: "indianapolis-colts" },
  { name: "Jacksonville Jaguars", title: "Jacksonville Jaguars", slug: "jacksonville-jaguars" },
  { name: "Kansas City Chiefs", title: "Kansas City Chiefs", slug: "kansas-city-chiefs" },
  { name: "Las Vegas Raiders", title: "Las Vegas Raiders", slug: "las-vegas-raiders" },
  { name: "Los Angeles Chargers", title: "Los Angeles Chargers", slug: "los-angeles-chargers" },
  { name: "Los Angeles Rams", title: "Los Angeles Rams", slug: "los-angeles-rams" },
  { name: "Miami Dolphins", title: "Miami Dolphins", slug: "miami-dolphins" },
  { name: "Minnesota Vikings", title: "Minnesota Vikings", slug: "minnesota-vikings" },
  { name: "New England Patriots", title: "New England Patriots", slug: "new-england-patriots" },
  { name: "New Orleans Saints", title: "New Orleans Saints", slug: "new-orleans-saints" },
  { name: "New York Giants", title: "New York Giants", slug: "new-york-giants" },
  { name: "New York Jets", title: "New York Jets", slug: "new-york-jets" },
  { name: "Philadelphia Eagles", title: "Philadelphia Eagles", slug: "philadelphia-eagles" },
  { name: "Pittsburgh Steelers", title: "Pittsburgh Steelers", slug: "pittsburgh-steelers" },
  { name: "San Francisco 49ers", title: "San Francisco 49ers", slug: "san-francisco-49ers" },
  { name: "Seattle Seahawks", title: "Seattle Seahawks", slug: "seattle-seahawks" },
  { name: "Tampa Bay Buccaneers", title: "Tampa Bay Buccaneers", slug: "tampa-bay-buccaneers" },
  { name: "Tennessee Titans", title: "Tennessee Titans", slug: "tennessee-titans" },
  { name: "Washington Commanders", title: "Washington Commanders", slug: "washington-commanders" },
];

const wikiApiUrl = (base, params) => {
  const url = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    url.searchParams.set(k, String(v));
  });
  return url.toString();
};

const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
};

const fetchBuffer = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
};

const extractLogoFromWikitext = (wikitext) => {
  const match = wikitext.match(/^\s*\|\s*logo\s*=\s*(.+)$/im);
  if (!match) return null;
  let raw = match[1]?.trim() ?? "";
  raw = raw.replace(/<!--.*?-->/g, "").trim();
  if (!raw) return null;

  const bracketFile = raw.match(/\[\[\s*(?:File|Image)\s*:\s*([^|\]]+)/i);
  const file = bracketFile?.[1]?.trim() ?? raw.split("|")[0]?.trim();
  if (!file) return null;
  return file.replace(/^File:/i, "").trim();
};

const getWikitext = async (title) => {
  const url = wikiApiUrl("https://en.wikipedia.org/w/api.php", {
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    format: "json",
    formatversion: 2,
    titles: title,
  });
  const data = await fetchJson(url);
  const page = data?.query?.pages?.[0];
  const content = page?.revisions?.[0]?.slots?.main?.content;
  if (!content) return null;
  return content;
};

const getWikidataQid = async (title) => {
  const url = wikiApiUrl("https://en.wikipedia.org/w/api.php", {
    action: "query",
    prop: "pageprops",
    format: "json",
    formatversion: 2,
    titles: title,
  });
  const data = await fetchJson(url);
  const page = data?.query?.pages?.[0];
  return page?.pageprops?.wikibase_item ?? null;
};

const getLogoFromWikidata = async (qid) => {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`;
  const data = await fetchJson(url);
  const entity = data?.entities?.[qid];
  const claims = entity?.claims?.P154;
  const first = Array.isArray(claims) ? claims[0] : undefined;
  const fileName = first?.mainsnak?.datavalue?.value;
  return typeof fileName === "string" ? fileName : null;
};

const getLogoFileName = async (title) => {
  const wikitext = await getWikitext(title);
  if (wikitext) {
    const logo = extractLogoFromWikitext(wikitext);
    if (logo) return logo;
  }

  const qid = await getWikidataQid(title);
  if (!qid) return null;
  return getLogoFromWikidata(qid);
};

const getThumbUrl = async (fileName, width = 512) => {
  const url = wikiApiUrl("https://en.wikipedia.org/w/api.php", {
    action: "query",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: width,
    format: "json",
    formatversion: 2,
    titles: `File:${fileName}`,
  });
  const data = await fetchJson(url);
  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
};

const fileExistsNonEmpty = async (filePath) => {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
};

const main = async () => {
  const force = process.argv.includes("--force");
  await mkdir(outputDir, { recursive: true });

  const failures = [];

  for (const team of NFL_TEAMS) {
    const outPath = path.join(outputDir, `${team.slug}.png`);
    if (!force && (await fileExistsNonEmpty(outPath))) {
      console.log(`✓ ${team.name} (cached)`);
      continue;
    }

    try {
      const fileName = await getLogoFileName(team.title);
      if (!fileName) throw new Error("Could not determine logo filename");

      const thumbUrl = await getThumbUrl(fileName, 512);
      if (!thumbUrl) throw new Error("Could not get thumbnail URL");

      const buf = await fetchBuffer(thumbUrl);
      await writeFile(outPath, buf);
      console.log(`✓ ${team.name}`);
    } catch (err) {
      failures.push({ team: team.name, error: err instanceof Error ? err.message : String(err) });
      console.error(`✗ ${team.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const missing = [];
  for (const team of NFL_TEAMS) {
    const outPath = path.join(outputDir, `${team.slug}.png`);
    if (!(await fileExistsNonEmpty(outPath))) missing.push(team.name);
  }

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifest = {
    generatedAt: new Date().toISOString(),
    count: NFL_TEAMS.length,
    teams: NFL_TEAMS.map((t) => ({ name: t.name, slug: t.slug, file: `${t.slug}.png` })),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  if (failures.length || missing.length) {
    console.error("\nSome downloads failed.");
    if (missing.length) console.error(`Missing (${missing.length}): ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`\nDone. Downloaded ${NFL_TEAMS.length} logos to ${outputDir}`);
};

main().catch(async (err) => {
  console.error(err);
  try {
    const logPath = path.join(outputDir, "download-error.log");
    await writeFile(logPath, String(err) + "\n", "utf8");
    console.error(`Wrote error log to ${logPath}`);
    const last = await readFile(logPath, "utf8").catch(() => "");
    if (last) void last;
  } catch {
    // ignore
  }
  process.exit(1);
});

