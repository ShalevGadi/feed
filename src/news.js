// The backend part: fetches every feed on the server (no browser rules apply
// here, so a plain fetch works), parses it, and returns one list of articles.
import Parser from "rss-parser";
import { TOPICS } from "../public/js/config.js";
import { buildArticles } from "../public/js/articles.js";

const parser = new Parser({
  customFields: {
    item: [["media:thumbnail", "mediaThumbnail"], ["media:content", "mediaContent"], ["News:Image", "newsImage"]],
  },
});

const FEED_TIMEOUT_MS = 8000;
const CACHE_MS = 2 * 60 * 1000; // quick refreshes reuse the last result for 2 minutes

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pickImage(item) {
  return (
    item.enclosure?.url ||
    item.mediaThumbnail?.$?.url ||
    item.mediaContent?.$?.url ||
    (typeof item.newsImage === "string" ? item.newsImage : null) ||
    (String(item.content || "").match(/<img[^>]+src=["']([^"']+)["']/) || [])[1] ||
    null
  );
}

// Bing News links point to bing.com and carry the real article address in ?url=.
function unwrapBingLink(link) {
  try {
    const u = new URL(link);
    if (u.hostname.endsWith("bing.com")) return u.searchParams.get("url") || link;
  } catch {}
  return link;
}

function onDomain(link, domain) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

async function fetchFeed(f) {
  const res = await fetch(f.url, {
    headers: { "User-Agent": "Mozilla/5.0 (PersonalNewsFeed/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  const items = [];
  for (const item of feed.items) {
    const link = f.bing ? unwrapBingLink(item.link) : item.link;
    // Bing searches can return other sites; only keep the publisher's own articles.
    if (f.bing && !onDomain(link, f.domain)) continue;
    items.push({
      title: stripHtml(item.title),
      link,
      date: item.isoDate || item.pubDate,
      summary: stripHtml(item.contentSnippet || item.summary || item.content).slice(0, 400),
      image: pickImage(item),
      source: f.source,
      feedUrl: f.feedUrl || f.url,
    });
  }
  return items;
}

// When a publisher's own feed refuses us (many sites block server traffic),
// fall back to a Bing News search limited to that publisher's site.
function bingFallback(f) {
  const mkt = /\.il$/.test(f.domain) ? "he-IL" : "en-US";
  return {
    ...f,
    bing: true,
    url: `https://www.bing.com/news/search?q=${encodeURIComponent(`site:${f.domain}`)}&format=rss&mkt=${mkt}`,
    feedUrl: f.url, // keep the original feed's topics
  };
}

async function fetchWithFallback(f) {
  try {
    return { items: await fetchFeed(f) };
  } catch (err) {
    if (f.bing) throw err;
    const why = err?.name === "TimeoutError" ? "no answer in 8s" : err?.message || "failed";
    try {
      return { items: await fetchFeed(bingFallback(f)), via: `Bing backup (own feed: ${why})` };
    } catch {
      throw err;
    }
  }
}

let cache = { at: 0, data: null };

/** { articles, sources: [{ source, url, ok, count, error }], updatedAt } */
export async function fetchNews() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const unique = [...new Map(TOPICS.flatMap((t) => t.feeds).map((f) => [f.url, f])).values()];
  const results = await Promise.allSettled(unique.map(fetchWithFallback));
  const raw = [];
  const sources = results.map((r, i) => {
    const f = unique[i];
    if (r.status === "fulfilled") {
      raw.push(...r.value.items);
      return { source: f.source, url: f.url, ok: true, count: r.value.items.length, via: r.value.via };
    }
    const why = r.reason?.name === "TimeoutError" ? "no answer in 8s" : r.reason?.message || "failed";
    return { source: f.source, url: f.url, ok: false, error: why };
  });

  const data = { articles: buildArticles(raw), sources, updatedAt: new Date().toISOString() };
  cache = { at: Date.now(), data };
  return data;
}
