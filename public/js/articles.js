// Shared by the server (which builds the article list) and the page (search, alerts).
// No browser- or Node-only code in here.
import { TOPICS, MAX_AGE_HOURS } from "./config.js";

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

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * Normalize, tag with topics and de-duplicate raw feed items.
 * Each raw item: { title, link, date, summary, image, source, feedUrl }.
 */
export function buildArticles(rawItems) {
  const feedToTopics = new Map();
  const maxAgeMs = new Map(); // feed → how long its stories stay (longest of its topics)
  for (const t of TOPICS) for (const f of t.feeds) {
    if (!feedToTopics.has(f.url)) feedToTopics.set(f.url, new Set());
    feedToTopics.get(f.url).add(t.id);
    const ms = (t.maxAgeDays ? t.maxAgeDays * 24 : MAX_AGE_HOURS) * 3600 * 1000;
    maxAgeMs.set(f.url, Math.max(maxAgeMs.get(f.url) || 0, ms));
  }
  const defaultMaxAgeMs = MAX_AGE_HOURS * 3600 * 1000;
  const byKey = new Map();

  for (const item of rawItems) {
    if (!item.title) continue;
    let published = new Date(item.date || Date.now());
    if (isNaN(published)) published = new Date();
    if (published.getTime() < Date.now() - (maxAgeMs.get(item.feedUrl) || defaultMaxAgeMs)) continue;
    if (published.getTime() > Date.now()) published = new Date();

    // Same story in several feeds → keep one, merge topics.
    const key = (item.link || "").replace(/[?#].*$/, "") || item.title.toLowerCase();
    const text = normalizeText(`${item.title} ${item.summary}`);
    const feedTopics = feedToTopics.get(item.feedUrl) || new Set();
    const topics = new Set(feedTopics);
    for (const t of TOPICS) if (t.keywords.length && matchesAny(text, t.keywords)) topics.add(t.id);
    // The section a story is shown under: its source's first topic (so it isn't repeated).
    const primary = TOPICS.find((t) => feedTopics.has(t.id))?.id || TOPICS.find((t) => topics.has(t.id))?.id;

    const existing = byKey.get(key);
    if (existing) {
      topics.forEach((t) => existing.topics.add(t));
      if (!existing.image && item.image) existing.image = item.image;
      continue;
    }
    byKey.set(key, {
      id: hash(key),
      title: item.title,
      summary: item.summary,
      link: item.link,
      source: item.source,
      domain: item.domain,
      image: item.image,
      published: published.toISOString(),
      topics,
      primary,
    });
  }

  return [...byKey.values()]
    .map((a) => ({ ...a, topics: [...a.topics] }))
    .sort((a, b) => b.published.localeCompare(a.published));
}
