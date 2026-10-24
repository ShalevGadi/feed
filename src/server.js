// Local mode (npm start): serves the same page as GitHub Pages, plus
//  - a feed relay, so no public relay is needed, and
//  - optional free local AI through Ollama.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TOPICS } from "../public/js/config.js";
import * as ai from "./ai.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

// The relay only fetches the sites this app uses, so it can't be abused as an open proxy.
const ALLOWED_HOSTS = new Set([
  ...TOPICS.flatMap((t) => t.feeds).map((u) => new URL(u).hostname),
  "api.open-meteo.com",
  "geocoding-api.open-meteo.com",
  "www.hebcal.com",
]);

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/info", (_req, res) => res.json({ relay: true, ai: ai.aiEnabled }));

app.get("/proxy", async (req, res) => {
  let target;
  try {
    target = new URL(String(req.query.url));
  } catch {
    return res.status(400).send("bad url");
  }
  if (!/^https?:$/.test(target.protocol) || !ALLOWED_HOSTS.has(target.hostname)) {
    return res.status(403).send("host not allowed");
  }
  try {
    const upstream = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (PersonalNewsFeed/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(15000),
    });
    res.status(upstream.status).type(upstream.headers.get("content-type") || "text/xml").send(await upstream.text());
  } catch (err) {
    res.status(502).send(err.message);
  }
});

app.post("/api/tag", (req, res) => {
  res.json({ tags: ai.tag(Array.isArray(req.body?.articles) ? req.body.articles : []) });
});

app.post("/api/digest", async (req, res) => {
  const d = await ai.digest(req.body?.articles || [], req.body?.alerts || []);
  res.json({ text: d?.text || null, at: d?.at || null });
});

app.use(express.static(path.join(here, "..", "public")));

app.listen(PORT, async () => {
  await ai.initAI();
  console.log(`News feed on http://localhost:${PORT}  (local AI ${ai.aiEnabled ? `on: ${process.env.OLLAMA_MODEL}` : "off — optional, see README"})`);
});
