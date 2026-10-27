// The page asks its own backend (/api/feed) for the news when it opens, and
// again every 5 minutes while you're looking at it. Weather and holidays come
// straight from Open-Meteo and Hebcal.
import { TOPICS } from "./config.js";
import { normalizeText } from "./articles.js";
import { weather, holidays, specialDays, headlineAlerts } from "./alerts.js";
import { getLocation, setLocationByName } from "./location.js";

const $ = (sel) => document.querySelector(sel);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const state = {
  topic: store.get("topic", "all"),
  sort: store.get("sort", "latest"),
  q: "",
  ai: false, // true only when served by the local server with Ollama running
  loading: false,
  sources: [],
  data: { articles: [], alerts: [], weather: null, digest: null, updatedAt: null },
  wx: null,
  holidays: [],
};

const WX = { 0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 71: "🌨️", 73: "🌨️", 75: "❄️", 80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

// Only http(s) links from feeds become clickable.
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");

// Tiny markdown → HTML for the digest (headings, bullets, bold).
function md(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  let html = "", inList = false;
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*[-*]\s+(.*)/);
    if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li dir="auto">${inline(bullet[1])}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    const h = line.match(/^#+\s+(.*)/);
    if (h) html += `<h3>${inline(h[1])}</h3>`;
    else if (line.trim()) html += `<p dir="auto">${inline(line)}</p>`;
  }
  return html + (inList ? "</ul>" : "");
}

// ---------- Rendering ----------

function renderTopics() {
  const { articles } = state.data;
  const counts = {};
  for (const a of articles) for (const t of a.topics) counts[t] = (counts[t] || 0) + 1;
  $("#topics").innerHTML =
    `<button class="chip ${state.topic === "all" ? "on" : ""}" data-topic="all">🗞️ All<small>${articles.length}</small></button>` +
    TOPICS
      .map((t) => `<button class="chip ${state.topic === t.id ? "on" : ""}" data-topic="${t.id}">${t.icon} ${esc(t.label)}<small>${counts[t.id] || 0}</small></button>`)
      .join("");
}

function renderWeather() {
  const w = state.data.weather;
  if (!w?.current) {
    $("#weather").textContent = `📍 ${getLocation().name}`;
    return;
  }
  const c = w.current;
  const days = w.daily.slice(1, 3).map((d) => `${WX[d.code] || ""} ${Math.round(d.max)}°`).join(" ");
  $("#weather").textContent = `${WX[c.code] || "🌡️"} ${Math.round(c.tempC)}°C ${c.location} · next: ${days}`;
}

function renderAlerts() {
  const { alerts } = state.data;
  $("#alerts").innerHTML = alerts.length
    ? alerts
        .map((a) => {
          const inner = `<div class="t" dir="auto">${a.icon} ${esc(a.title)}</div><div class="d" dir="auto">${esc(a.detail || "")}</div>`;
          return a.link
            ? `<a class="alert ${a.severity}" href="${esc(safeUrl(a.link))}" target="_blank" rel="noopener">${inner}</a>`
            : `<div class="alert ${a.severity}">${inner}</div>`;
        })
        .join("")
    : `<div class="muted">${state.loading ? "Checking…" : "Nothing urgent. 🌿"}</div>`;
}

function renderFeed() {
  let items = state.data.articles;
  if (state.topic !== "all") items = items.filter((a) => a.topics.includes(state.topic));
  if (state.q) {
    const needle = state.q.toLowerCase();
    items = items.filter((a) => `${a.title} ${a.summary} ${a.source}`.toLowerCase().includes(needle));
  }
  if (state.sort === "important" && state.ai) {
    items = [...items].sort((a, b) => (b.ai?.importance || 0) - (a.ai?.importance || 0));
  }
  const label = Object.fromEntries(TOPICS.map((t) => [t.id, `${t.icon} ${t.label}`]));
  $("#count").textContent = `${items.length} stories`;
  $("#feed").innerHTML = items.length
    ? items
        .slice(0, 150)
        .map((a) => `
      <a class="card" href="${esc(safeUrl(a.link))}" target="_blank" rel="noopener">
        ${a.image ? `<img src="${esc(safeUrl(a.image))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        <div class="body">
          <div class="meta">
            <span>${esc(a.source)}</span>·<span>${ago(a.published)}</span>
            ${a.ai?.importance >= 4 ? `<span class="imp">● ${a.ai.importance >= 5 ? "Major" : "Important"}</span>` : ""}
          </div>
          <h3 dir="auto">${esc(a.title)}</h3>
          <p dir="auto">${esc(a.ai?.summary || a.summary)}</p>
          <div class="tags">${a.topics.map((t) => `<span class="tag">${esc(label[t] || t)}</span>`).join("")}</div>
        </div>
      </a>`)
        .join("")
    : `<div class="muted">${state.loading ? "Loading the news…" : "No stories here."}</div>`;
}

function renderDigest() {
  $("#sort").hidden = !state.ai;
  $("#digest").hidden = !state.ai;
  if (!state.ai) return;
  const d = state.data.digest;
  if (d?.text) {
    $("#digest-body").classList.remove("muted");
    $("#digest-body").innerHTML = md(d.text);
    $("#digest-at").textContent = d.at ? `· ${ago(d.at)}` : "";
  } else {
    $("#digest-body").textContent = "Your briefing is being written by your local model. It appears here in a minute or two.";
  }
}

function renderSources() {
  const all = state.sources;
  if (!all.length) return;
  const bad = all.filter((s) => !s.ok);
  const empty = all.filter((s) => s.ok && !s.count);
  const backup = all.filter((s) => s.ok && s.count && s.via);
  $("#sources").hidden = false;
  $("#sources-summary").textContent = `Sources: ${all.length - bad.length} of ${all.length} loaded`;
  $("#sources-list").innerHTML = bad.length || empty.length || backup.length
    ? [...bad.map((s) => `<li><b>${esc(s.source)}</b> — ${esc(s.error)}<br><code>${esc(s.url)}</code></li>`),
       ...empty.map((s) => `<li><b>${esc(s.source)}</b> — loaded, but no matching stories right now</li>`),
       ...backup.map((s) => `<li><b>${esc(s.source)}</b> — loaded through ${esc(s.via)}</li>`)].join("")
    : "<li>All sources loaded.</li>";
}

function renderStatus(msg) {
  $("#status").textContent = msg || "";
  $("#status").hidden = !msg;
}

function render() {
  renderTopics();
  renderWeather();
  renderAlerts();
  renderFeed();
  renderDigest();
  renderSources();
  const u = state.data.updatedAt;
  $("#updated").textContent = u ? `News loaded ${ago(u)}` : "";
}

// ---------- Loading ----------

function buildAlertList() {
  const rank = { danger: 0, warn: 1, info: 2 };
  return [
    ...(state.wx?.alerts || []),
    ...state.holidays,
    ...specialDays(),
    ...headlineAlerts(state.data.articles),
  ].sort((a, b) => rank[a.severity] - rank[b.severity]);
}

function loadWeatherAndHolidays() {
  const wx = weather()
    .then((w) => { state.wx = w; state.data.weather = { current: w.current, daily: w.daily }; })
    .catch(() => {});
  const hol = holidays().then((h) => { state.holidays = h; }).catch(() => {});
  return Promise.all([wx, hol]).then(() => {
    state.data.alerts = buildAlertList();
    renderWeather();
    renderAlerts();
  });
}

function saveSnapshot() {
  // Shown instantly on the next visit while fresh news loads.
  const articles = state.data.articles.slice(0, 400).map(({ text, ...a }) => a);
  store.set("snapshot", { ...state.data, articles });
}

let lastUpdate = 0;

async function update() {
  if (state.loading) return;
  state.loading = true;
  lastUpdate = Date.now();
  $("#refresh").disabled = true;
  renderStatus("Loading the latest news…");
  const extras = loadWeatherAndHolidays();
  try {
    const res = await fetch("api/feed", { cache: "no-store" });
    if (!res.ok) throw new Error(`server answered ${res.status}`);
    const data = await res.json();
    // `text` is only used for searching and alert keywords, so it's rebuilt here.
    state.data.articles = keepTags(data.articles.map((a) => ({ ...a, text: normalizeText(`${a.title} ${a.summary}`) })));
    state.data.updatedAt = data.updatedAt;
    state.sources = data.sources;
    renderStatus("");
  } catch (err) {
    renderStatus(`Couldn't load new stories (${err.message}). Showing the last ones.`);
  }
  await extras;
  state.data.alerts = buildAlertList();
  state.loading = false;
  $("#refresh").disabled = false;
  render();
  saveSnapshot();
  if (state.ai) runAI();
}

// ---------- Optional local AI (only when served by `npm start` with Ollama) ----------

const tags = new Map();
function keepTags(articles) {
  return articles.map((a) => {
    const t = tags.get(a.id);
    return t ? { ...a, ai: t, topics: [...new Set([...a.topics, ...t.topics])] } : a;
  });
}

async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let aiRunning = false;

async function runAI() {
  if (aiRunning) return;
  aiRunning = true;
  try {
    // The local model works in the background; ask again until everything is tagged.
    for (let round = 0; round < 30; round++) {
      const untagged = state.data.articles.filter((a) => !tags.has(a.id)).slice(0, 200);
      if (!untagged.length) break;
      const { tags: got } = await post("api/tag", {
        articles: untagged.map(({ id, title, summary, source }) => ({ id, title, summary, source })),
      });
      for (const [id, t] of Object.entries(got)) tags.set(id, t);
      state.data.articles = keepTags(state.data.articles);
      renderTopics();
      renderFeed();
      if (Object.keys(got).length === untagged.length) break;
      await sleep(15000);
    }
    state.data.alerts = buildAlertList();
    renderAlerts();

    for (let round = 0; round < 20; round++) {
      const top = [...state.data.articles]
        .sort((a, b) => (b.ai?.importance || 0) - (a.ai?.importance || 0))
        .slice(0, 50)
        .map(({ title, source, topics, summary, ai }) => ({ title, source, topics, summary: ai?.summary || summary }));
      const d = await post("api/digest", { articles: top, alerts: state.data.alerts.map(({ title, detail }) => ({ title, detail })) });
      if (d.text) {
        state.data.digest = d;
        renderDigest();
        saveSnapshot();
        break;
      }
      await sleep(15000);
    }
  } catch (err) {
    console.warn("Local AI unavailable:", err.message);
  } finally {
    aiRunning = false;
  }
}

// ---------- Events ----------

$("#topics").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-topic]");
  if (!btn) return;
  state.topic = btn.dataset.topic;
  store.set("topic", state.topic);
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === btn));
  renderFeed();
});

$("#sort").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sort]");
  if (!btn) return;
  state.sort = btn.dataset.sort;
  store.set("sort", state.sort);
  document.querySelectorAll("#sort button").forEach((b) => b.classList.toggle("on", b === btn));
  renderFeed();
});
document.querySelectorAll("#sort button").forEach((b) => b.classList.toggle("on", b.dataset.sort === state.sort));

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = e.target.value.trim(); renderFeed(); }, 200);
});

$("#refresh").addEventListener("click", update);

$("#weather").addEventListener("click", async () => {
  const name = prompt("Weather for which city?", getLocation().name);
  if (!name?.trim()) return;
  try {
    await setLocationByName(name.trim());
    $("#weather").textContent = "Updating weather…";
    await loadWeatherAndHolidays();
  } catch (err) {
    alert(err.message);
  }
});

// ---------- Start ----------

const FIVE_MIN = 5 * 60 * 1000;

async function start() {
  // Served by the local server (npm start)? Then local AI may be available.
  const info = await fetch("api/info", { signal: AbortSignal.timeout(3000) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  state.ai = Boolean(info?.ai);

  const saved = store.get("snapshot", null);
  if (saved?.articles?.length) state.data = { ...state.data, ...saved };
  render();
  await update();

  // Check again every 5 minutes while the page is visible, and when you come back to it.
  setInterval(() => { if (!document.hidden) update(); }, FIVE_MIN);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastUpdate > FIVE_MIN) update();
  });
}

start();
