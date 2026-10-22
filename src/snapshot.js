// One JSON snapshot of everything the page needs. The local server serves it
// live at /data.json; the GitHub build writes it to a static file.
import { TOPICS, LOCATION } from "./config.js";
import { fetchAllArticles, feedStatus } from "./feeds.js";
import { buildAlerts } from "./alerts.js";

export const MAX_ARTICLES = 800;

/** Fetch feeds + alerts. `enrich` lets the server add local-AI tags. */
export async function collect(enrich = (a) => a) {
  const articles = enrich(await fetchAllArticles());
  const { alerts, weather, errors } = await buildAlerts(articles);
  return { articles, alerts, weather, errors };
}

export function toSnapshot({ articles, alerts, weather, updatedAt, aiEnabled = false, digest = null }) {
  return {
    updatedAt,
    location: LOCATION.name,
    aiEnabled,
    topics: TOPICS.map(({ id, label, icon }) => ({ id, label, icon })),
    articles: articles.slice(0, MAX_ARTICLES).map(({ text, ...a }) => a),
    alerts,
    weather,
    digest,
  };
}

export function healthReport() {
  return Object.fromEntries(feedStatus);
}
