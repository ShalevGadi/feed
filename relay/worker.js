// Your own free feed relay on Cloudflare Workers.
// Free plan: 100,000 requests/day, no credit card. Setup steps are in the README.
//
// It only fetches the news/weather/holiday sites listed below, so nobody can
// use it for anything else. Other websites can't use it either (Origin check).
const ALLOWED_ORIGINS = ["https://shalevgadi.github.io", "http://localhost:3000"];

const ALLOWED_HOSTS = [
  "feeds.bbci.co.uk", "www.theguardian.com", "rss.nytimes.com", "www.aljazeera.com", "feeds.npr.org",
  "www.timesofisrael.com", "www.jpost.com", "www.israelhayom.com", "www.ynetnews.com", "www.ynet.co.il",
  "www.maariv.co.il", "www.globes.co.il", "www.inn.co.il",
  "breakingdefense.com", "www.defensenews.com", "kyivindependent.com", "www.al-monitor.com",
  "www.theverge.com", "feeds.arstechnica.com", "arstechnica.com", "techcrunch.com", "www.geektime.co.il",
  "feeds.feedburner.com", "www.bleepingcomputer.com", "krebsonsecurity.com", "therecord.media", "www.darkreading.com",
  "www.sciencedaily.com", "www.quantamagazine.org", "www.newscientist.com", "www.nasa.gov",
  "www.pcgamer.com", "www.eurogamer.net", "www.polygon.com", "www.rockpapershotgun.com",
  "www.technologyreview.com", "venturebeat.com", "huggingface.co",
  "www.uploadvr.com", "www.roadtovr.com", "mixed-news.com", "aws.amazon.com", "aibusiness.com",
  "www.hebcal.com", "api.open-meteo.com", "geocoding-api.open-meteo.com",
];

export default {
  async fetch(request) {
    const started = Date.now();
    const origin = request.headers.get("Origin");
    // No Origin = you opened the link directly in your browser (handy for testing).
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response("forbidden", { status: 403 });
    const headers = { "Access-Control-Allow-Origin": origin || "*", Vary: "Origin" };
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "GET") return new Response("forbidden", { status: 403, headers });

    // The site address comes encoded in the path (/r/<base64>), because some
    // internet filters block requests that contain a plain "?url=https://…".
    const reqUrl = new URL(request.url);
    const encoded = reqUrl.pathname.match(/^\/r\/([A-Za-z0-9_-]+)/)?.[1];
    let raw = reqUrl.searchParams.get("url");
    if (encoded) {
      try { raw = decodeURIComponent(escape(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")))); }
      catch { return new Response("bad address", { status: 400, headers }); }
    }
    if (!raw) return new Response("relay is running", { headers });
    let target;
    try { target = new URL(raw); } catch { return new Response("bad url", { status: 400, headers }); }
    if (!/^https?:$/.test(target.protocol) || !ALLOWED_HOSTS.includes(target.hostname)) {
      return new Response(`site not allowed: ${target.hostname}`, { status: 403, headers });
    }

    try {
      const upstream = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0 (PersonalNewsFeed/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
        cf: { cacheTtl: 120 }, // reuse a fetch for 2 minutes, so quick refreshes are fast
        signal: AbortSignal.timeout(10000),
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { ...headers, "Content-Type": upstream.headers.get("Content-Type") || "text/xml", "X-Relay-Time": `${Date.now() - started}ms` },
      });
    } catch (err) {
      return new Response(`relay could not reach ${target.hostname}: ${err.name === "TimeoutError" ? "no answer in 10s" : err.message}`, { status: 502, headers });
    }
  },
};
