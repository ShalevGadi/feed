// Builds a static copy of the site into dist/ (used by GitHub Pages).
// Run: npm run build
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect, toSnapshot, healthReport } from "../src/snapshot.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const data = await collect();
const snapshot = toSnapshot({ ...data, updatedAt: new Date().toISOString() });

await fs.rm(dist, { recursive: true, force: true });
await fs.cp(path.join(root, "public"), dist, { recursive: true });
await fs.writeFile(path.join(dist, "data.json"), JSON.stringify(snapshot));
await fs.writeFile(path.join(dist, "health.json"), JSON.stringify(healthReport(), null, 2));

const health = Object.values(healthReport());
const ok = health.filter((h) => h.ok).length;
console.log(`Built dist/: ${snapshot.articles.length} articles, ${snapshot.alerts.length} alerts, feeds ${ok}/${health.length} ok`);
for (const [url, h] of Object.entries(healthReport())) if (!h.ok) console.log(`  ✗ ${url} — ${h.error}`);
if (data.errors.length) console.log("Alert sources failing:", data.errors.join("; "));
if (ok === 0) {
  console.error("No feed could be fetched — not publishing an empty site.");
  process.exit(1);
}
