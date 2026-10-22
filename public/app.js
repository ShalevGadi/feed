const $ = (sel) => document.querySelector(sel);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const state = {
  topic: store.get("topic", "all"),
  sort: store.get("sort", "latest"),
  q: "",
  data: null,
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

// Works the same on GitHub Pages (static data.json, rebuilt every 30 min)
// and on the local server (live data.json).
async function fetchData() {
  const res = await fetch(`data.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.statusText);
  state.data = await res.json();
}

function renderTopics() {
  const { topics, articles } = state.data;
  const counts = {};
  for (const a of articles) for (const t of a.topics) counts[t] = (counts[t] || 0) + 1;
  $("#topics").innerHTML =
    `<button class="chip ${state.topic === "all" ? "on" : ""}" data-topic="all">🗞️ All<small>${articles.length}</small></button>` +
    topics
      .map((t) => `<button class="chip ${state.topic === t.id ? "on" : ""}" data-topic="${t.id}">${t.icon} ${esc(t.label)}<small>${counts[t.id] || 0}</small></button>`)
      .join("");
}

function renderAlerts() {
  const { alerts, weather } = state.data;
  if (weather?.current) {
    const c = weather.current;
    const days = weather.daily.slice(1, 3).map((d) => `${WX[d.code] || ""} ${Math.round(d.max)}°`).join(" ");
    $("#weather").textContent = `${WX[c.code] || "🌡️"} ${Math.round(c.tempC)}°C ${c.location} · next: ${days}`;
  }
  $("#alerts").innerHTML = alerts.length
    ? alerts
        .map((a) => {
          const inner = `<div class="t" dir="auto">${a.icon} ${esc(a.title)}</div><div class="d" dir="auto">${esc(a.detail || "")}</div>`;
          return a.link
            ? `<a class="alert ${a.severity}" href="${esc(a.link)}" target="_blank" rel="noopener">${inner}</a>`
            : `<div class="alert ${a.severity}">${inner}</div>`;
        })
        .join("")
    : `<div class="muted">Nothing urgent. 🌿</div>`;
}

function renderFeed() {
  const { topics, articles } = state.data;
  let items = articles;
  if (state.topic !== "all") items = items.filter((a) => a.topics.includes(state.topic));
  if (state.q) {
    const needle = state.q.toLowerCase();
    items = items.filter((a) => `${a.title} ${a.summary} ${a.source}`.toLowerCase().includes(needle));
  }
  if (state.sort === "important" && state.data.aiEnabled) {
    items = [...items].sort((a, b) => (b.ai?.importance || 0) - (a.ai?.importance || 0));
  }
  const label = Object.fromEntries(topics.map((t) => [t.id, `${t.icon} ${t.label}`]));
  $("#count").textContent = `${items.length} stories`;
  $("#feed").innerHTML = items.length
    ? items
        .slice(0, 150)
        .map((a) => `
      <a class="card" href="${esc(a.link)}" target="_blank" rel="noopener">
        ${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
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
    : `<div class="muted">No stories here yet.</div>`;
}

function renderDigest() {
  const { aiEnabled, digest } = state.data;
  $("#sort").hidden = !aiEnabled;
  $("#digest").hidden = !aiEnabled;
  if (!aiEnabled) return;
  if (digest?.text) {
    $("#digest-body").classList.remove("muted");
    $("#digest-body").innerHTML = md(digest.text);
    $("#digest-at").textContent = digest.at ? `· ${ago(new Date(digest.at).toISOString())}` : "";
  } else {
    $("#digest-body").textContent = "Your briefing is being written by your local model. Check back in a minute.";
  }
}

function render() {
  renderTopics();
  renderAlerts();
  renderFeed();
  renderDigest();
  const u = state.data.updatedAt;
  $("#updated").textContent = u ? `News updated ${ago(u)}` : "Fetching feeds for the first time…";
}

async function loadAll() {
  try {
    await fetchData();
    render();
  } catch (e) {
    $("#feed").innerHTML = `<div class="muted">Couldn't load the news (${esc(e.message)}).</div>`;
  }
}

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

$("#refresh").addEventListener("click", async () => {
  $("#refresh").disabled = true;
  try {
    // Local server re-fetches feeds now; on GitHub Pages this fails and we just reload the latest build.
    await fetch("api/refresh", { method: "POST" }).catch(() => {});
    await loadAll();
  } finally {
    $("#refresh").disabled = false;
  }
});

loadAll();
// Local server: the first load can be empty while feeds are fetched, so retry a few times.
let tries = 0;
const early = setInterval(() => {
  if (++tries > 6 || state.data?.articles.length) clearInterval(early);
  else loadAll();
}, 5000);
setInterval(loadAll, 5 * 60 * 1000);
