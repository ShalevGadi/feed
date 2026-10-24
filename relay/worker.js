// Optional: your own free, reliable feed relay on Cloudflare Workers.
// Free plan: 100,000 requests/day, no credit card. Setup steps are in the README.
//
// Only pages on the sites below may use it, so others can't borrow your relay.
const ALLOWED_ORIGINS = ["https://shalevgadi.github.io", "http://localhost:3000"];

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = { "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0], Vary: "Origin" };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET" || !allowed) return new Response("forbidden", { status: 403, headers: cors });

    const target = new URL(request.url).searchParams.get("url");
    if (!target || !/^https?:\/\//i.test(target)) return new Response("missing url", { status: 400, headers: cors });

    try {
      const upstream = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0 (PersonalNewsFeed/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
        cf: { cacheTtl: 120 }, // reuse a fetch for 2 minutes, so quick refreshes are fast
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, "Content-Type": upstream.headers.get("Content-Type") || "text/xml" },
      });
    } catch (err) {
      return new Response(String(err), { status: 502, headers: cors });
    }
  },
};
