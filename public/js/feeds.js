// Fetches and parses every feed in the browser, each time the page is opened or refreshed.
import { TOPICS, MAX_AGE_HOURS, PROXY_URL } from "./config.js";

// Per-feed status, shown in the "Sources" panel so you can spot dead feeds.
export const feedStatus = new Map();

// Set by app.js when the page is served by the local server, which has its own relay.
let localRelay = false;
export function useLocalRelay(on) { localRelay = on; }

const PUBLIC_RELAYS = [
  { name: "public relay 1", url: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name: "public relay 2", url: (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}` },
];
// The address is sent encoded (base64), because some internet filters block
// requests that contain a plain "?url=https://…".
export const encodeForRelay = (u) =>
  btoa(unescape(encodeURIComponent(u))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const OWN_RELAY = PROXY_URL && { name: "your relay", url: (u) => `${PROXY_URL.replace(/\/$/, "")}/r/${encodeForRelay(u)}` };

// Set by checkOwnRelay(): if your relay is broken, skip it instead of waiting on it for every feed.
let ownRelayOk = true;

function relays() {
  if (localRelay) return [{ name: "local server", url: (u) => `proxy?url=${encodeURIComponent(u)}` }];
  // Your own relay first; the public ones are only a backup if it's slow or down.
  return OWN_RELAY && ownRelayOk ? [OWN_RELAY, ...PUBLIC_RELAYS] : PUBLIC_RELAYS;
}

async function fetchText(relay, url, signal) {
  const started = Date.now();
  try {
    const res = await fetch(relay.url(url), { signal });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}${body ? ` "${body.trim().slice(0, 40)}"` : ""}`);
    // Relays sometimes answer 200 with an error page; a real feed or JSON starts with < { or [.
    if (!/^\s*[<{[]/.test(body)) throw new Error(`answered "${body.trim().slice(0, 40)}"`);
    return body;
  } catch (err) {
    const why = signal.aborted ? `no answer in ${Math.round((Date.now() - started) / 1000)}s`
      : err instanceof TypeError ? "couldn't connect (blocked or offline)"
      : err.message;
    throw new Error(`${relay.name}: ${why}`);
  }
}

/**
 * Fetch through the relays. A backup relay is asked when the first one is
 * slow or fails, and the first good answer wins.
 */
export async function fetchViaRelay(url, { timeoutMs = 12000 } = {}) {
  const list = relays();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (list.length === 1) return await fetchText(list[0], url, controller.signal);
    // Asking every relay at once overloads the public ones and they start refusing.
    let startBackup;
    const backupGate = new Promise((r) => { startBackup = r; setTimeout(r, 4000); });
    const first = fetchText(list[0], url, controller.signal);
    first.catch(() => startBackup());
    const backups = list.slice(1).map((r) => backupGate.then(() => fetchText(r, url, controller.signal)));
    return await Promise.any([first, ...backups]);
  } catch (err) {
    // Show what every relay said, so problems are easy to diagnose.
    throw err instanceof AggregateError ? new Error(err.errors.map((e) => e.message).join(" · ")) : err;
  } finally {
    clearTimeout(timer);
    controller.abort(); // cancel the slower relay
  }
}

/** Quick check of your own relay before loading everything. Returns a problem description, or null. */
export async function checkOwnRelay() {
  ownRelayOk = true;
  if (!OWN_RELAY || localRelay) return null;
  // Try two different sites, so one slow news site doesn't make the relay look broken.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const sites = [TOPICS[0].feeds[0], TOPICS[1].feeds[0]];
  try {
    await Promise.any(sites.map((site) => fetchText(OWN_RELAY, site, controller.signal)));
    return null;
  } catch (err) {
    ownRelayOk = false;
    return err.errors ? err.errors[0].message : err.message;
  } finally {
    clearTimeout(timer);
    controller.abort();
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
    feedStatus.set(url, { ok: false, error: err?.message || "failed" });
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
const DEADLINE_MS = 20000;

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
  const parallel = localRelay || (OWN_RELAY && ownRelayOk) ? 10 : 4; // public relays throttle heavy use
  await Promise.all(Array.from({ length: parallel }, worker));
  return buildArticles(raw);
}
