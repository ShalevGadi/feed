// Local mode: a live server on your own computer, with optional free local AI.
// (The GitHub Pages version uses scripts/build.js instead — same page, same data.)
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REFRESH_MINUTES } from "./config.js";
import { collect, toSnapshot, healthReport } from "./snapshot.js";
import * as ai from "./ai.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const state = { articles: [], alerts: [], weather: null, updatedAt: null, refreshing: null };

async function refresh() {
  if (state.refreshing) return state.refreshing;
  state.refreshing = (async () => {
    const started = Date.now();
    try {
      const { articles, alerts, weather } = await collect(ai.enrich);
      Object.assign(state, { articles, alerts, weather, updatedAt: new Date().toISOString() });
      const health = Object.values(healthReport());
      console.log(`[refresh] ${articles.length} articles, ${alerts.length} alerts, feeds ${health.filter((h) => h.ok).length}/${health.length} ok, ${Date.now() - started} ms`);
    } catch (err) {
      console.error("[refresh] failed:", err);
    } finally {
      state.refreshing = null;
    }
  })();
  return state.refreshing;
}

const app = express();

app.get("/data.json", async (_req, res) => {
  // AI tags arrive in the background, so apply the latest ones on every request.
  const articles = ai.applyTags(state.articles);
  const digest = ai.aiEnabled ? await ai.digest(articles, state.alerts) : null;
  res.json(toSnapshot({ ...state, articles, aiEnabled: ai.aiEnabled, digest }));
});

app.get("/health.json", (_req, res) => res.json(healthReport()));

app.post("/api/refresh", async (_req, res) => {
  await refresh();
  res.json({ ok: true, updatedAt: state.updatedAt });
});

app.use(express.static(path.join(here, "..", "public")));

app.listen(PORT, async () => {
  await ai.initAI();
  console.log(`News feed on http://localhost:${PORT}  (AI ${ai.aiEnabled ? `on: ${process.env.OLLAMA_MODEL}` : "off — optional, see README"})`);
  refresh();
  setInterval(refresh, REFRESH_MINUTES * 60 * 1000);
});
