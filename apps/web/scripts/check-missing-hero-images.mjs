import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const heroesFile = path.join(appRoot, "src", "data", "heroes.ts");
const portraitsDir = path.join(appRoot, "public", "heroes");

const heroesSource = readFileSync(heroesFile, "utf8");
const ids = [...heroesSource.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
const uniqueIds = [...new Set(ids)];

function portraitBasename(id) {
  if (id.startsWith("deadpool-")) return "deadpool";
  return id;
}

if (uniqueIds.length === 0) {
  console.error("No hero IDs found in src/data/heroes.ts");
  process.exit(1);
}

const missing = uniqueIds.filter(
  (id) => !existsSync(path.join(portraitsDir, `${portraitBasename(id)}.webp`)),
);

const existing = existsSync(portraitsDir)
  ? readdirSync(portraitsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
      .map((entry) => entry.name.replace(/\.webp$/, ""))
  : [];

const extras = existing.filter((id) => !uniqueIds.includes(id));

console.log(`Heroes in catalog: ${uniqueIds.length}`);
console.log(`Missing portraits: ${missing.length}`);

if (missing.length > 0) {
  console.log("\nMissing .webp files:");
  for (const id of missing) {
    const base = portraitBasename(id);
    if (base !== id) {
      console.log(`- ${id}.webp (resolved as ${base}.webp)`);
    } else {
      console.log(`- ${id}.webp`);
    }
  }
}

if (extras.length > 0) {
  console.log("\nExtra .webp files (no matching hero id):");
  for (const id of extras) console.log(`- ${id}.webp`);
}

if (missing.length === 0) {
  console.log("\nAll hero portraits are present.");
}
