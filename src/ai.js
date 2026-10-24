// Optional AI layer, 100% free: runs a local open model through Ollama
// (https://ollama.com) on your own computer. No account, no API key, no cost.
// Without it the site works fine using keyword matching; with it, articles get
// smarter topic tags, an importance score, a one-line summary, and a briefing.
import { TOPICS, HEADLINE_ALERTS } from "../public/js/config.js";

const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
const MODEL = process.env.OLLAMA_MODEL || ""; // e.g. "gemma3:4b" — empty = AI off

const BATCH_SIZE = 10;
const DIGEST_TTL_MS = 3 * 3600 * 1000;

export let aiEnabled = false;

const topicIds = TOPICS.map((t) => t.id);
const alertIds = HEADLINE_ALERTS.map((a) => a.id);

// JSON schema Ollama constrains the output to.
const TAG_SCHEMA = {
  type: "object",
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          topics: { type: "array", items: { type: "string", enum: topicIds } },
          alert: { type: ["string", "null"], enum: [...alertIds, null] },
          importance: { type: "integer", minimum: 1, maximum: 5 },
          summary: { type: "string" },
        },
        required: ["id", "topics", "alert", "importance", "summary"],
      },
    },
  },
  required: ["articles"],
};

const TAG_SYSTEM = `You tag news articles for a personal news feed.
For each article return:
- topics: every topic that fits, from: ${TOPICS.map((t) => `${t.id} (${t.label})`).join(", ")}.
  "israel" = the story is about Israel. "war" = armed conflict, military, attacks, defense.
  "ai-usecases" = a concrete, real-world application of AI (a company, hospital, government, etc.
  deploying AI to do something), not model releases, funding rounds or AI policy.
- alert: set only when the story is directly about one of: ${HEADLINE_ALERTS.map((a) => `${a.id} (${a.label})`).join(", ")}; otherwise null.
  "fuel" means a change in gas/petrol prices. "weather" means a severe-weather warning.
- importance: 1 (trivia) to 5 (major breaking news a reader would not want to miss).
- summary: one plain English sentence, max 25 words, even if the article is in Hebrew.
Return one entry per input article, using its id.`;

async function chat(system, user, format) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format,
      options: { temperature: 0.2 },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(5 * 60 * 1000), // local models can be slow
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  return (await res.json()).message?.content || "";
}

/** Checks Ollama is running and the model is pulled. Called once at startup. */
export async function initAI() {
  if (!MODEL) return false;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const { models = [] } = await res.json();
    const names = models.map((m) => m.name);
    if (!names.some((n) => n === MODEL || n === `${MODEL}:latest`)) {
      console.error(`[ai] model "${MODEL}" not found. Run: ollama pull ${MODEL}`);
      return false;
    }
    aiEnabled = true;
  } catch {
    console.error(`[ai] Ollama not reachable at ${OLLAMA_URL}. Is it running? (AI features off)`);
  }
  return aiEnabled;
}

// id → { topics, alert, importance, summary }
const tagCache = new Map();

async function tagBatch(batch) {
  const input = batch
    .map((a) => `<article id="${a.id}">\n<source>${a.source}</source>\n<title>${a.title}</title>\n<snippet>${a.summary}</snippet>\n</article>`)
    .join("\n");
  const out = JSON.parse(await chat(TAG_SYSTEM, input, TAG_SCHEMA));
  const ids = new Set(batch.map((a) => a.id));
  for (const t of out.articles || []) {
    if (!ids.has(t.id)) continue;
    tagCache.set(t.id, {
      topics: (t.topics || []).filter((x) => topicIds.includes(x)),
      alert: alertIds.includes(t.alert) ? t.alert : null,
      importance: Math.min(5, Math.max(1, Number(t.importance) || 1)),
      summary: String(t.summary || ""),
    });
  }
}

const queue = new Map(); // id → article waiting to be tagged
let tagging = false;

/**
 * Returns the tags already known for these articles and queues the rest for
 * background tagging (the browser asks again a little later).
 */
export function tag(articles) {
  const known = {};
  for (const a of articles) {
    if (tagCache.has(a.id)) known[a.id] = tagCache.get(a.id);
    else if (aiEnabled) queue.set(a.id, a);
  }
  if (aiEnabled && !tagging && queue.size) processQueue();
  return known;
}

async function processQueue() {
  tagging = true;
  // One batch at a time: a local model handles one request at a time anyway.
  while (queue.size) {
    const batch = [...queue.values()].slice(0, BATCH_SIZE);
    batch.forEach((a) => queue.delete(a.id));
    try { await tagBatch(batch); }
    catch (err) { console.error("[ai] tagging:", err.message); }
  }
  tagging = false;
  console.log(`[ai] tagged ${tagCache.size} articles so far`);
}

let digestCache = { at: 0, text: null };
let digesting = null;

/** A short written briefing of the most important stories. Cached for a few hours. */
export async function digest(articles, alerts) {
  if (!aiEnabled) return null;
  if (digestCache.text && Date.now() - digestCache.at < DIGEST_TTL_MS) return digestCache;
  if (digesting) return digestCache.text ? digestCache : null;

  // `articles` arrive from the browser already sorted by importance.
  const top = articles
    .slice(0, 50)
    .map((a) => `- [${(a.topics || []).join(",")}] (${a.source}) ${a.title} — ${String(a.summary || "").slice(0, 160)}`)
    .join("\n");
  const alertLines = alerts.map((a) => `- ${a.title} (${a.detail || ""})`).join("\n");

  digesting = chat(
    "You write a personal morning briefing from a list of headlines. Group by theme " +
      "(Israel, war & Middle East, world, tech/AI/cyber, science & gaming). Lead with anything urgent " +
      "from the alerts. Use short markdown sections with 2-4 bullets each, plain and factual. " +
      "Only use facts present in the input.",
    `Alerts:\n${alertLines || "none"}\n\nHeadlines:\n${top}`,
  )
    .then((text) => { digestCache = { at: Date.now(), text }; })
    .catch((err) => console.error("[ai] digest:", err.message))
    .finally(() => { digesting = null; });

  // Don't make the page wait minutes for a slow local model; it shows up on the next poll.
  return digestCache.text ? digestCache : null;
}
