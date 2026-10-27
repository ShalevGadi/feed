// Groups stories about the same event from different sources into one card.
// Two headlines count as the same story when they share most of their
// meaningful words and were published within a day and a half of each other.

const STOP = new Set(("the a an and or of to in on for with at by from as is are was were be been it its this that " +
  "after over into about says said new more than how why what who will has have had not but up out can").split(" "));

function words(title) {
  return [...new Set(
    title.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w)),
  )];
}

const WINDOW_MS = 36 * 3600 * 1000;

/**
 * Returns the articles with duplicates folded in: each kept article gets
 * `also: [{ source, link }]` listing the other sources for the same story.
 */
export function groupSimilar(articles) {
  const toks = articles.map((a) => words(a.title));
  const index = new Map(); // word → article indexes
  toks.forEach((ws, i) => ws.forEach((w) => {
    if (!index.has(w)) index.set(w, []);
    index.get(w).push(i);
  }));

  const parent = articles.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));

  for (let i = 0; i < articles.length; i++) {
    if (toks[i].length < 3) continue;
    const shared = new Map();
    for (const w of toks[i]) {
      const list = index.get(w);
      if (list.length > 40) continue; // too common to mean anything
      for (const j of list) if (j > i) shared.set(j, (shared.get(j) || 0) + 1);
    }
    for (const [j, n] of shared) {
      if (articles[i].source === articles[j].source) continue;
      if (n < 3 || n / Math.min(toks[i].length, toks[j].length) < 0.6) continue;
      if (Math.abs(new Date(articles[i].published) - new Date(articles[j].published)) > WINDOW_MS) continue;
      parent[find(j)] = find(i);
    }
  }

  const groups = new Map();
  articles.forEach((a, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(a);
  });

  const out = [];
  for (const members of groups.values()) {
    // Lead with the newest version that has a picture.
    const lead = members.find((a) => a.image) || members[0];
    const others = members.filter((a) => a !== lead);
    out.push(others.length
      ? { ...lead, topics: [...new Set(members.flatMap((a) => a.topics))], also: others.map(({ source, link, domain }) => ({ source, link, domain })) }
      : lead);
  }
  return out.sort((a, b) => b.published.localeCompare(a.published));
}
