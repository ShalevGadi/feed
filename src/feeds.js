import Parser from "rss-parser";
import crypto from "node:crypto";
import { TOPICS, MAX_AGE_HOURS } from "./config.js";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (PersonalNewsFeed/1.0)" },
  customFields: { item: [["media:thumbnail", "mediaThumbnail"], ["media:content", "mediaContent"]] },
});

// Per-feed status, exposed at /api/health so you can spot dead feeds.
export const feedStatus = new Map();

export function normalizeText(s) {
  return (" " + String(s || "").toLowerCase().replace(/[.,:;!?()[\]“”‘’«»|/\\]/g, " ") + " ")
    .replace(/\s+/g, " ");
}

// English keywords match whole words (plus plural/verb endings) so "war" doesn't
// hit "ransomware". Hebrew attaches prefixes (ב, ה, ו…) so it matches as a substring.
const kwCache = new Map();
function keywordRegex(k) {
  if (!kwCache.has(k)) {
    const escaped = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    kwCache.set(k, /[a-z]/i.test(k)
      ? new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?:s|es|ed|ing)?(?![\\p{L}\\p{N}])`, "u")
      : new RegExp(escaped, "u"));
  }
  return kwCache.get(k);
}

export function matchesAny(text, keywords) {
  return keywords.some((k) => keywordRegex(k).test(text));
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pickImage(item) {
  return (
    item.enclosure?.url ||
    item.mediaThumbnail?.$?.url ||
    item.mediaContent?.$?.url ||
    (String(item.content || "").match(/<img[^>]+src="([^"]+)"/) || [])[1] ||
    null
  );
}

async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    const source = feed.title?.replace(/\s+[-–|]\s+.*$/, "").trim() || new URL(url).hostname;
    feedStatus.set(url, { ok: true, count: feed.items.length, at: new Date().toISOString() });
    return feed.items.map((item) => ({ ...item, _source: source, _feed: url }));
  } catch (err) {
    feedStatus.set(url, { ok: false, error: err.message, at: new Date().toISOString() });
    return [];
  }
}

/** Fetch every feed, normalize, tag with topics, de-duplicate. */
export async function fetchAllArticles() {
  const feedToTopics = new Map();
  for (const t of TOPICS) {
    for (const f of t.feeds) {
      if (!feedToTopics.has(f)) feedToTopics.set(f, new Set());
      feedToTopics.get(f).add(t.id);
    }
  }

  const results = await Promise.all([...feedToTopics.keys()].map(fetchFeed));
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
  const byKey = new Map();

  for (const item of results.flat()) {
    const title = stripHtml(item.title);
    if (!title) continue;
    const published = new Date(item.isoDate || item.pubDate || Date.now());
    if (published.getTime() < cutoff) continue;

    const summary = stripHtml(item.contentSnippet || item.summary || item.content).slice(0, 400);
    const link = item.link || "";
    // Same story syndicated in several feeds → keep one, merge topics.
    const key = link.replace(/[?#].*$/, "") || title.toLowerCase();
    const text = normalizeText(`${title} ${summary}`);

    const topics = new Set(feedToTopics.get(item._feed));
    for (const t of TOPICS) if (t.keywords.length && matchesAny(text, t.keywords)) topics.add(t.id);

    const existing = byKey.get(key);
    if (existing) {
      topics.forEach((t) => existing.topics.add(t));
      continue;
    }
    byKey.set(key, {
      id: crypto.createHash("sha1").update(key).digest("hex").slice(0, 12),
      title,
      summary,
      link,
      source: item._source,
      image: pickImage(item),
      published: published.toISOString(),
      topics,
      text,
    });
  }

  return [...byKey.values()]
    .map((a) => ({ ...a, topics: [...a.topics] }))
    .sort((a, b) => b.published.localeCompare(a.published));
}
