// Local mode (npm start): the same site as on Vercel — page + /api/feed — plus
// optional free local AI through Ollama.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import feedHandler from "../api/feed.js";
import * as ai from "./ai.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/info", (_req, res) => res.json({ ai: ai.aiEnabled }));
app.get("/api/feed", feedHandler);

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
