import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const pkgPath = path.join(rootDir, "package.json");
const lockPath = path.join(rootDir, "package-lock.json");
const versionFile = path.join(rootDir, "src/client/public/version.json");
const counterFile = path.join(rootDir, "tools/dev-version.json");

const bumpPatch = (version) => {
  const [major = 0, minor = 0, patch = 0] = `${version}`.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

const readJson = async (file, fallback = {}) => {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = async (file, data) => {
  const body = JSON.stringify(data, null, 2) + "\n";
  await writeFile(file, body, "utf8");
};

const main = async () => {
  const counter = await readJson(counterFile, { version: "0.0.0" });
  const nextVersion = bumpPatch(counter.version);

  const pkg = await readJson(pkgPath);
  const lock = await readJson(lockPath);

  // Update internal counter
  await writeJson(counterFile, { version: nextVersion });

  // Update public version file used by the splash screen
  await writeJson(versionFile, {
    version: nextVersion,
    generatedAt: new Date().toISOString(),
  });

  // Keep package.json / lock in sync for clarity (optional but helpful)
  if (pkg.version !== undefined) {
    pkg.version = nextVersion;
    await writeJson(pkgPath, pkg);
  }

  if (Object.keys(lock).length > 0) {
    lock.version = nextVersion;
    if (lock.packages?.[""]) {
      lock.packages[""].version = nextVersion;
    }
    await writeJson(lockPath, lock);
  }

  console.log(`Bumped dev version to v${nextVersion}`);
};

main().catch((err) => {
  console.error("Failed to bump version:", err);
  process.exit(1);
});
