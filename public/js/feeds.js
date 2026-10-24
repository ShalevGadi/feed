// Fetches and parses every feed in the browser, each time the page is opened or refreshed.
import { TOPICS, MAX_AGE_HOURS, PROXY_URL } from "./config.js";

// Per-feed status, shown in the "Sources" panel so you can spot dead feeds.
export const feedStatus = new Map();

// Set by app.js when the page is served by the local server, which has its own relay.
let localRelay = false;
export function useLocalRelay(on) { localRelay = on; }

const PUBLIC_RELAYS = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
];

function relayUrls(url) {
  if (localRelay) return [`proxy?url=${encodeURIComponent(url)}`];
  if (PROXY_URL) return [`${PROXY_URL.replace(/\/$/, "")}/?url=${encodeURIComponent(url)}`];
  return PUBLIC_RELAYS.map((f) => f(url));
}

async function fetchText(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  // Relays sometimes answer 200 with an error page; a real feed or JSON starts with < { or [.
  if (!/^\s*[<{[]/.test(body)) throw new Error("relay returned an error");
  return body;
}

/**
 * Fetch through the relay. With public relays, all are asked at once and the
 * first good answer wins — much faster than trying them one by one.
 */
export async function fetchViaRelay(url, { timeoutMs = 10000 } = {}) {
  const urls = relayUrls(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), timeoutMs);
  try {
    if (urls.length === 1) return await fetchText(urls[0], controller.signal);
    return await Promise.any(urls.map((u) => fetchText(u, controller.signal)));
  } catch (err) {
    throw err instanceof AggregateError ? err.errors.find((e) => e.name !== "AbortError") || err.errors[0] : err;
  } finally {
    clearTimeout(timer);
    controller.abort(); // cancel the slower relay
  }
}

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

// Parsing HTML with DOMParser never runs scripts or loads images, so it's safe for feed content.
const html = new DOMParser();
function stripHtml(s) {
  if (!s) return "";
  return (html.parseFromString(s, "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
}

const text = (el, ...tags) => {
  for (const t of tags) {
    const v = el.getElementsByTagName(t)[0]?.textContent?.trim();
    if (v) return v;
  }
  return "";
};
const attr = (el, tag, name) => el.getElementsByTagName(tag)[0]?.getAttribute(name) || null;

/** RSS 2.0 / RSS 1.0 / Atom → { title, items: [{ title, link, date, summary, image }] } */
export function parseFeed(xml) {
  const doc = new DOMParser().parseFromString(xml.trim(), "text/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("not a valid feed");
  const root = doc.documentElement;
  const isAtom = root.localName === "feed";
  const entries = [...root.getElementsByTagName(isAtom ? "entry" : "item")];
  if (!entries.length && !["rss", "feed", "RDF"].includes(root.localName)) throw new Error("not a feed");

  const items = entries.map((el) => {
    const rawContent = text(el, "content:encoded", "content", "description", "summary");
    let link = "";
    if (isAtom) {
      const links = [...el.getElementsByTagName("link")];
      link = (links.find((l) => (l.getAttribute("rel") || "alternate") === "alternate") || links[0])?.getAttribute("href") || "";
    } else {
      link = text(el, "link") || attr(el, "guid", "isPermaLink") !== "false" && text(el, "guid") || "";
    }
    return {
      title: stripHtml(text(el, "title")),
      link,
      date: text(el, "pubDate", "published", "updated", "dc:date"),
      summary: stripHtml(text(el, "description", "summary", "content")).slice(0, 400),
      image:
        attr(el, "enclosure", "url") ||
        attr(el, "media:thumbnail", "url") ||
        attr(el, "media:content", "url") ||
        (rawContent.match(/<img[^>]+src=["']([^"']+)["']/) || [])[1] ||
        null,
    };
  });
  const title = text(root.getElementsByTagName(isAtom ? "feed" : "channel")[0] || root, "title");
  return { title, items };
}

async function fetchFeed(url) {
  try {
    const feed = parseFeed(await fetchViaRelay(url));
    const source = feed.title.replace(/\s+[-–|]\s+.*$/, "").trim() || new URL(url).hostname.replace(/^www\./, "");
    feedStatus.set(url, { ok: true, count: feed.items.length });
    return feed.items.map((item) => ({ ...item, source, feed: url }));
  } catch (err) {
    feedStatus.set(url, { ok: false, error: err?.name === "TimeoutError" || err?.name === "AbortError" ? "timed out" : err?.message || "failed" });
    return [];
  }
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Normalize, tag with topics and de-duplicate raw feed items. */
export function buildArticles(rawItems) {
  const feedToTopics = new Map();
  for (const t of TOPICS) for (const f of t.feeds) {
    if (!feedToTopics.has(f)) feedToTopics.set(f, new Set());
    feedToTopics.get(f).add(t.id);
  }
  const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
  const byKey = new Map();

  for (const item of rawItems) {
    if (!item.title) continue;
    let published = new Date(item.date || Date.now());
    if (isNaN(published)) published = new Date();
    if (published.getTime() < cutoff) continue;
    if (published.getTime() > Date.now()) published = new Date();

    // Same story syndicated in several feeds → keep one, merge topics.
    const key = item.link.replace(/[?#].*$/, "") || item.title.toLowerCase();
    const searchText = normalizeText(`${item.title} ${item.summary}`);
    const topics = new Set(feedToTopics.get(item.feed));
    for (const t of TOPICS) if (t.keywords.length && matchesAny(searchText, t.keywords)) topics.add(t.id);

    const existing = byKey.get(key);
    if (existing) {
      topics.forEach((t) => existing.topics.add(t));
      continue;
    }
    byKey.set(key, {
      id: hash(key),
      title: item.title,
      summary: item.summary,
      link: item.link,
      source: item.source,
      image: item.image,
      published: published.toISOString(),
      topics,
      text: searchText,
    });
  }

  return [...byKey.values()]
    .map((a) => ({ ...a, topics: [...a.topics] }))
    .sort((a, b) => b.published.localeCompare(a.published));
}

// Stop starting new feeds after this long; anything still pending is skipped.
const DEADLINE_MS = 15000;

/**
 * Fetch all feeds, several at a time. `onProgress(articles, done, total)` is
 * called as feeds arrive so the page fills in progressively.
 */
export async function fetchAllArticles(onProgress) {
  const urls = [...new Set(TOPICS.flatMap((t) => t.feeds))];
  const raw = [];
  const deadline = Date.now() + DEADLINE_MS;
  let done = 0, next = 0;
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++];
      if (Date.now() > deadline) feedStatus.set(url, { ok: false, error: "skipped (page was taking too long)" });
      else raw.push(...(await fetchFeed(url)));
      onProgress?.(raw, ++done, urls.length);
    }
  }
  await Promise.all(Array.from({ length: 10 }, worker));
  return buildArticles(raw);
}
