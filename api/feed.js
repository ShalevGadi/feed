// GET /api/feed — the page calls this when it opens. Runs on Vercel's servers.
import { fetchNews } from "../src/news.js";

export default async function handler(_req, res) {
  try {
    const data = await fetchNews();
    // Let Vercel's CDN reuse a result for 2 minutes, so refreshing is instant.
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
