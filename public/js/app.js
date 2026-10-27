// The page asks its own backend (/api/feed) for the news when it opens, and
// again every 5 minutes while you're looking at it. Weather and holidays come
// straight from Open-Meteo and Hebcal. Your preferences (topics, saved and read
// stories, language, theme) are kept in this browser.
import { TOPICS } from "./config.js";
import { normalizeText } from "./articles.js";
import { weather, holidays, specialDays, headlineAlerts } from "./alerts.js";
import { getLocation, setLocationByName } from "./location.js";
import { t, label, getLang, setLang, applyDocumentLang } from "./i18n.js";
import { groupSimilar } from "./group.js";

const $ = (sel) => document.querySelector(sel);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const state = {
  topic: "all", // "all" | "saved" | a topic id
  sort: store.get("sort", "latest"),
  langFilter: store.get("langFilter", "all"), // "all" | "he" | "en"
  q: "",
  ai: false, // true only when served by the local server with Ollama running
  loading: false,
  offline: false,
  sources: [],
  data: { articles: [], alerts: [], weather: null, digest: null, updatedAt: null },
  wx: null,
  holidays: [],
  prefs: store.get("topicPrefs", { order: [], hidden: [] }),
  read: new Set(store.get("read", [])),
  saved: store.get("saved", []),
  dismissed: store.get("dismissed", {}),
  prevVisit: store.get("lastVisit", 0), // stories newer than this are "New"
};

const WX = { 0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 71: "🌨️", 73: "🌨️", 75: "❄️", 80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️" };

const CARDS_PER_SECTION = 8; // keep in step with SHOWN_PER_SECTION in src/news.js
const topicById = Object.fromEntries(TOPICS.map((tp) => [tp.id, tp]));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Only http(s) links from feeds become clickable.
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");

// ---------- Times: "12 min ago", "Today 14:30", "Yesterday 09:10", "Mon 14:30", "3 Nov" ----------

function dayKey(d, tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

function formatTime(iso) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minAgo", mins);
  const tz = getLocation().timezone;
  const locale = getLang() === "he" ? "he-IL" : "en-GB";
  const time = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d);
  const today = dayKey(new Date(), tz);
  const yesterday = dayKey(new Date(Date.now() - 864e5), tz);
  const day = dayKey(d, tz);
  if (day === today) return `${t("today")} ${time}`;
  if (day === yesterday) return `${t("yesterday")} ${time}`;
  if (Date.now() - d < 6 * 864e5) {
    return `${new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: "short" }).format(d)} ${time}`;
  }
  return new Intl.DateTimeFormat(locale, { timeZone: tz, day: "numeric", month: "short" }).format(d);
}

// Tiny markdown → HTML for the local-AI digest (headings, bullets, bold).
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

// ---------- Preferences ----------

/** Topics in your order, without the ones you've hidden. */
function orderedTopics({ includeHidden = false } = {}) {
  const pos = new Map(state.prefs.order.map((id, i) => [id, i]));
  const list = [...TOPICS].sort((a, b) => (pos.get(a.id) ?? 1e3 + TOPICS.indexOf(a)) - (pos.get(b.id) ?? 1e3 + TOPICS.indexOf(b)));
  return includeHidden ? list : list.filter((tp) => !state.prefs.hidden.includes(tp.id));
}

function savePrefs() { store.set("topicPrefs", state.prefs); }

/** The section a story shows in: its main topic, or the next visible topic it belongs to. */
function sectionOf(a, visibleIds) {
  if (visibleIds.has(a.primary)) return a.primary;
  return orderedTopics().find((tp) => a.topics.includes(tp.id))?.id || null;
}

const isHebrew = (a) => /[֐-׿]/.test(a.title);
const langOk = (a) => state.langFilter === "all" || (state.langFilter === "he") === isHebrew(a);
const isNew = (a) => state.prevVisit && new Date(a.published) > state.prevVisit && !state.read.has(a.id);
const isSaved = (id) => state.saved.some((s) => s.id === id);

function markRead(id) {
  if (state.read.has(id)) return;
  state.read.add(id);
  store.set("read", [...state.read].slice(-3000));
  document.querySelectorAll(`.card[data-id="${CSS.escape(id)}"]`).forEach((el) => {
    el.classList.add("read");
    el.querySelector(".badge-new")?.remove();
  });
}

function toggleSaved(id) {
  if (isSaved(id)) {
    state.saved = state.saved.filter((s) => s.id !== id);
  } else {
    const a = state.data.articles.find((x) => x.id === id);
    if (!a) return;
    const { text, ...keep } = a;
    state.saved = [{ ...keep, savedAt: Date.now() }, ...state.saved].slice(0, 300);
  }
  store.set("saved", state.saved);
  renderTopics();
  renderFeed();
}

// ---------- Rendering: header, alerts, topic chips ----------

function renderWeather() {
  const w = state.data.weather;
  if (!w?.current) {
    $("#weather").textContent = `📍 ${getLocation().name}`;
    return;
  }
  const c = w.current;
  const days = w.daily.slice(1, 3).map((d) => `${WX[d.code] || ""} ${Math.round(d.max)}°`).join(" ");
  $("#weather").textContent = `${WX[c.code] || "🌡️"} ${Math.round(c.tempC)}°C ${c.location} · ${t("next")}: ${days}`;
}

function renderAlerts() {
  const alerts = state.data.alerts.filter((a) => !state.dismissed[a.id]);
  $("#alerts").innerHTML = alerts.length
    ? alerts
        .map((a) => {
          const inner =
            `<span class="alert-icon">${a.icon}</span>` +
            `<span class="alert-text"><span class="t" dir="auto">${esc(a.title)}</span><span class="d" dir="auto">${esc(a.detail || "")}</span></span>` +
            `<button class="dismiss" data-dismiss="${esc(a.id)}" title="${t("dismiss")}" aria-label="${t("dismiss")}">✕</button>`;
          return a.link
            ? `<a class="alert ${a.severity}" href="${esc(safeUrl(a.link))}" target="_blank" rel="noopener">${inner}</a>`
            : `<div class="alert ${a.severity}">${inner}</div>`;
        })
        .join("")
    : `<div class="muted">${state.loading ? t("checking") : t("nothingUrgent")}</div>`;
}

function visibleArticles() {
  return state.data.articles.filter(langOk);
}

function renderTopics() {
  const articles = visibleArticles();
  const counts = {};
  for (const a of articles) for (const id of a.topics) counts[id] = (counts[id] || 0) + 1;
  const chip = (id, text, n) =>
    `<button class="chip ${state.topic === id || (state.topic === "all" && activeSection === id) ? "on" : ""}" data-topic="${id}">${text}${n != null ? `<small>${n}</small>` : ""}</button>`;
  $("#topics").innerHTML =
    chip("all", `🗞️ ${t("all")}`, articles.length) +
    (state.saved.length ? chip("saved", `⭐ ${t("saved")}`, state.saved.length) : "") +
    orderedTopics().map((tp) => chip(tp.id, `${tp.icon} ${esc(label(tp))}`, counts[tp.id] || 0)).join("");
}

// ---------- Rendering: cards ----------

// A soft colour per topic, for cards without a picture.
function topicHue(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function placeholder(a) {
  const tp = topicById[a.primary] || {};
  return `<div class="ph" style="--h:${topicHue(a.primary)}"><span class="ph-icon">${tp.icon || "📰"}</span><span class="ph-src">${esc(a.source)}</span></div>`;
}

const favicon = (domain) =>
  domain ? `<img class="fav" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32" alt="" width="16" height="16" loading="lazy" onerror="this.remove()">` : "";

function card(a, { lead = false, tags = false } = {}) {
  const tagLabel = (id) => (topicById[id] ? `${topicById[id].icon} ${label(topicById[id])}` : id);
  // If the picture fails to load, swap in the placeholder.
  const img = a.image
    ? `<img src="${esc(safeUrl(a.image))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML=this.nextElementSibling.innerHTML">` +
      `<template>${placeholder(a)}</template>`
    : placeholder(a);
  const saved = isSaved(a.id);
  const also = a.also?.length
    ? `<details class="also"><summary>${t("moreSources", a.also.length)}</summary><ul>${a.also
        .map((o) => `<li><a href="${esc(safeUrl(o.link))}" target="_blank" rel="noopener">${favicon(o.domain)}${esc(o.source)}</a></li>`)
        .join("")}</ul></details>`
    : "";
  return `
      <article class="card${lead ? " lead" : ""}${state.read.has(a.id) ? " read" : ""}" data-id="${esc(a.id)}">
        <div class="pic">${img}</div>
        <div class="body">
          <div class="meta">
            ${favicon(a.domain)}<span class="src">${esc(a.source)}</span><span class="dot">·</span><time>${formatTime(a.published)}</time>
            ${isNew(a) ? `<span class="badge-new">${t("new")}</span>` : ""}
            ${a.ai?.importance >= 4 ? `<span class="imp">● ${a.ai.importance >= 5 ? t("major") : t("important")}</span>` : ""}
          </div>
          <h3 dir="auto"><a class="title" href="${esc(safeUrl(a.link))}" target="_blank" rel="noopener">${esc(a.title)}</a></h3>
          <p dir="auto">${esc(a.ai?.summary || a.summary)}</p>
          ${also}
          ${tags ? `<div class="tags">${a.topics.map((id) => `<span class="tag">${esc(tagLabel(id))}</span>`).join("")}</div>` : ""}
        </div>
        <button class="save${saved ? " on" : ""}" data-save="${esc(a.id)}" title="${saved ? t("unsave") : t("save")}" aria-label="${saved ? t("unsave") : t("save")}">${saved ? "★" : "☆"}</button>
      </article>`;
}

function skeleton() {
  const row = `<div class="card sk"><div class="pic sk-block"></div><div class="body"><div class="sk-line w40"></div><div class="sk-line w90"></div><div class="sk-line w70"></div></div></div>`;
  const lead = row.replace('class="card sk"', 'class="card sk lead"');
  const section = `<section class="topic-section"><div class="sk-line sk-title"></div><div class="feed">${lead}${row}${row}</div></section>`;
  return section + section;
}

function sortItems(items) {
  return state.sort === "important" && state.ai
    ? [...items].sort((a, b) => (b.ai?.importance || 0) - (a.ai?.importance || 0))
    : items;
}

function list(items) {
  return `<div class="feed">${items.map((a, i) => card(a, { lead: i === 0, tags: true })).join("")}</div>`;
}

let activeSection = null;

function renderFeed() {
  const empty = (msg) => `<div class="muted empty">${msg}</div>`;
  const back = `<button class="back" data-topic="all">${t("back")}</button>`;

  if (!state.data.articles.length && state.loading) {
    $("#count").textContent = "";
    $("#feed").innerHTML = skeleton();
    return;
  }

  // Saved stories.
  if (state.topic === "saved") {
    $("#count").textContent = t("stories", state.saved.length);
    $("#feed").innerHTML = `<section class="topic-section">${back}<h2 class="topic-title">⭐ ${t("saved")}</h2>` +
      (state.saved.length ? list(state.saved) : empty(t("noSaved"))) + `</section>`;
    return;
  }

  const all = visibleArticles();

  // Searching or one topic picked: one list with every matching story.
  if (state.q || state.topic !== "all") {
    let items = all;
    if (state.topic !== "all") items = items.filter((a) => a.topics.includes(state.topic));
    if (state.q) {
      const needle = state.q.toLowerCase();
      items = items.filter((a) => `${a.title} ${a.summary} ${a.source}`.toLowerCase().includes(needle));
    }
    items = sortItems(items);
    const tp = topicById[state.topic];
    $("#count").textContent = t("stories", items.length);
    $("#feed").innerHTML = `<section class="topic-section">${state.topic !== "all" ? back : ""}` +
      (tp ? `<h2 class="topic-title">${tp.icon} ${esc(label(tp))}</h2>` : "") +
      (items.length ? list(items.slice(0, 150)) : empty(t("noStories"))) + `</section>`;
    return;
  }

  // Everything: one section per topic, in your order. Newest story is the big one.
  const visibleIds = new Set(orderedTopics().map((tp) => tp.id));
  const bySection = new Map();
  for (const a of all) {
    const s = sectionOf(a, visibleIds);
    if (!s) continue;
    if (!bySection.has(s)) bySection.set(s, []);
    bySection.get(s).push(a);
  }
  const newCount = all.filter(isNew).length;
  $("#count").textContent = t("stories", all.length) + (newCount ? ` · ${t("newCount", newCount)}` : "");

  const savedStrip = state.saved.length
    ? `<section class="topic-section saved-strip" id="topic-saved">
        <div class="topic-head"><h2 class="topic-title">⭐ ${t("saved")}</h2>${state.saved.length > 3 ? `<button class="see-all" data-topic="saved">${t("seeAll", state.saved.length)}</button>` : ""}</div>
        <div class="feed">${state.saved.slice(0, 3).map((a) => card(a)).join("")}</div>
      </section>`
    : "";

  const sections = orderedTopics().map((tp) => {
    const items = sortItems(bySection.get(tp.id) || []);
    if (!items.length) return "";
    const more = items.length > CARDS_PER_SECTION ? `<button class="see-all" data-topic="${tp.id}">${t("seeAll", items.length)}</button>` : "";
    return `
    <section class="topic-section" id="topic-${tp.id}" data-section="${tp.id}">
      <div class="topic-head">
        <h2 class="topic-title">${tp.icon} ${esc(label(tp))}</h2>
        ${more}
      </div>
      <div class="feed">${items.slice(0, CARDS_PER_SECTION).map((a, i) => card(a, { lead: i === 0 })).join("")}</div>
    </section>`;
  }).join("");

  $("#feed").innerHTML = savedStrip + sections || empty(t("noStories"));
  watchSections();
}

// Highlight the chip of the section you're reading.
let observer;
function watchSections() {
  observer?.disconnect();
  if (!("IntersectionObserver" in window)) return;
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible || state.topic !== "all") return;
    const id = visible.target.dataset.section;
    if (id === activeSection) return;
    activeSection = id;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.topic === id));
    const chipEl = document.querySelector(`.chip[data-topic="${id}"]`);
    const bar = $("#topics");
    if (chipEl) bar.scrollTo({ left: chipEl.offsetLeft - bar.clientWidth / 2 + chipEl.clientWidth / 2, behavior: "smooth" });
  }, { rootMargin: "-30% 0px -60% 0px" });
  document.querySelectorAll("[data-section]").forEach((el) => observer.observe(el));
}

function renderDigest() {
  $("#sort").hidden = !state.ai;
  $("#digest").hidden = !state.ai;
  if (!state.ai) return;
  const d = state.data.digest;
  if (d?.text) {
    $("#digest-body").classList.remove("muted");
    $("#digest-body").innerHTML = md(d.text);
    $("#digest-at").textContent = d.at ? `· ${formatTime(new Date(d.at).toISOString())}` : "";
  } else {
    $("#digest-body").textContent = t("briefingWaiting");
  }
}

function renderSources() {
  const all = state.sources;
  if (!all.length) return;
  const bad = all.filter((s) => !s.ok);
  const emptyOnes = all.filter((s) => s.ok && !s.count);
  const backup = all.filter((s) => s.ok && s.count && s.via);
  $("#sources").hidden = false;
  $("#sources-summary").textContent = t("sources", all.length - bad.length, all.length);
  $("#sources-list").innerHTML = bad.length || emptyOnes.length || backup.length
    ? [...bad.map((s) => `<li><b>${esc(s.source)}</b> — ${esc(s.error)}<br><code>${esc(s.url)}</code></li>`),
       ...emptyOnes.map((s) => `<li><b>${esc(s.source)}</b> — ${t("sourceEmpty")}<br><code>${esc(s.url)}</code></li>`),
       ...backup.map((s) => `<li><b>${esc(s.source)}</b> — ${t("sourceVia", s.via)}</li>`)].join("")
    : `<li>${t("allSourcesOk")}</li>`;
}

function renderStatus(msg) {
  $("#status").textContent = msg || "";
  $("#status").hidden = !msg;
}

function renderSegs() {
  document.querySelectorAll("#langfilter button").forEach((b) => b.classList.toggle("on", b.dataset.lang === state.langFilter));
  document.querySelectorAll("#sort button").forEach((b) => b.classList.toggle("on", b.dataset.sort === state.sort));
}

function render() {
  applyDocumentLang();
  renderSegs();
  renderTopics();
  renderWeather();
  renderAlerts();
  renderFeed();
  renderDigest();
  renderSources();
  const u = state.data.updatedAt;
  $("#updated").textContent = u ? t("newsLoaded", formatTime(u)) : "";
  measureSticky();
}

// The topic bar sticks under the header; sections scroll to just below both.
function measureSticky() {
  const h = $("#top").offsetHeight;
  document.documentElement.style.setProperty("--top-h", `${h}px`);
  document.documentElement.style.setProperty("--chips-h", `${$("#topics").offsetHeight}px`);
}

// ---------- Settings ----------

function renderSettings() {
  document.querySelectorAll("#set-ui-lang button").forEach((b) => b.classList.toggle("on", b.dataset.value === getLang()));
  const theme = store.get("theme", "auto");
  document.querySelectorAll("#set-theme button").forEach((b) => b.classList.toggle("on", b.dataset.value === theme));
  const topics = orderedTopics({ includeHidden: true });
  $("#set-topics").innerHTML = topics.map((tp, i) => `
    <li>
      <label><input type="checkbox" data-show="${tp.id}" ${state.prefs.hidden.includes(tp.id) ? "" : "checked"}> ${tp.icon} ${esc(label(tp))}</label>
      <span class="moves">
        <button type="button" data-move="${tp.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} title="${t("moveUp")}" aria-label="${t("moveUp")}">↑</button>
        <button type="button" data-move="${tp.id}" data-dir="1" ${i === topics.length - 1 ? "disabled" : ""} title="${t("moveDown")}" aria-label="${t("moveDown")}">↓</button>
      </span>
    </li>`).join("");
  $("#install").hidden = !installPrompt;
}

function setTheme(theme) {
  store.set("theme", theme);
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

const effectiveDark = () =>
  document.documentElement.dataset.theme === "dark" ||
  (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);

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

const withText = (a) => ({ ...a, text: normalizeText(`${a.title} ${a.summary}`) });

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
  renderStatus(t("loadingLatest"));
  if (!state.data.articles.length) renderFeed();
  const extras = loadWeatherAndHolidays();
  try {
    const res = await fetch("api/feed", { cache: "no-store" });
    if (!res.ok) throw new Error(`server answered ${res.status}`);
    const data = await res.json();
    state.data.articles = groupSimilar(keepTags(data.articles.map(withText)));
    state.data.updatedAt = data.updatedAt;
    state.sources = data.sources;
    renderStatus("");
  } catch (err) {
    renderStatus(navigator.onLine === false ? t("offline") : t("loadFailed", err.message));
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
    const tg = tags.get(a.id);
    return tg ? { ...a, ai: tg, topics: [...new Set([...a.topics, ...tg.topics])] } : a;
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
      for (const [id, tg] of Object.entries(got)) tags.set(id, tg);
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

function selectTopic(id) {
  state.topic = id;
  activeSection = null;
  renderTopics();
  renderFeed();
  window.scrollTo({ top: $("#topics").offsetTop - $("#top").offsetHeight, behavior: "smooth" });
}

$("#topics").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-topic]");
  if (!btn) return;
  const id = btn.dataset.topic;
  // On the main page, a topic chip jumps to its section; otherwise it opens the topic.
  const section = document.getElementById(`topic-${id}`);
  if (state.topic === "all" && !state.q && id !== "all" && section) {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    selectTopic(id);
  }
});

$("#feed").addEventListener("click", (e) => {
  const save = e.target.closest("[data-save]");
  if (save) {
    e.preventDefault();
    toggleSaved(save.dataset.save);
    return;
  }
  const nav = e.target.closest(".see-all, .back");
  if (nav) {
    selectTopic(nav.dataset.topic);
    return;
  }
  const cardEl = e.target.closest(".card[data-id]");
  if (cardEl && e.target.closest("a")) markRead(cardEl.dataset.id);
});
// Middle-click opens in a new tab without a "click" event.
$("#feed").addEventListener("auxclick", (e) => {
  const cardEl = e.target.closest(".card[data-id]");
  if (cardEl && e.target.closest("a")) markRead(cardEl.dataset.id);
});

$("#alerts").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-dismiss]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  state.dismissed[btn.dataset.dismiss] = Date.now();
  // Forget dismissals after a month.
  for (const [id, at] of Object.entries(state.dismissed)) if (Date.now() - at > 30 * 864e5) delete state.dismissed[id];
  store.set("dismissed", state.dismissed);
  renderAlerts();
});

$("#sort").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sort]");
  if (!btn) return;
  state.sort = btn.dataset.sort;
  store.set("sort", state.sort);
  renderSegs();
  renderFeed();
});

$("#langfilter").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-lang]");
  if (!btn) return;
  state.langFilter = btn.dataset.lang;
  store.set("langFilter", state.langFilter);
  renderSegs();
  renderTopics();
  renderFeed();
});

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = e.target.value.trim(); renderFeed(); }, 200);
});

$("#refresh").addEventListener("click", update);

$("#theme").addEventListener("click", () => setTheme(effectiveDark() ? "light" : "dark"));

$("#weather").addEventListener("click", async () => {
  const name = prompt(t("cityPrompt"), getLocation().name);
  if (!name?.trim()) return;
  try {
    await setLocationByName(name.trim());
    $("#weather").textContent = t("updatingWeather");
    await loadWeatherAndHolidays();
  } catch (err) {
    alert(err.message);
  }
});

// Settings dialog
$("#open-settings").addEventListener("click", () => {
  renderSettings();
  $("#settings").showModal();
});
$("#settings").addEventListener("close", () => render());
$("#set-ui-lang").addEventListener("click", (e) => {
  const b = e.target.closest("[data-value]");
  if (!b) return;
  setLang(b.dataset.value);
  renderSettings();
  render();
  loadWeatherAndHolidays(); // alert texts are built in the chosen language
});
$("#set-theme").addEventListener("click", (e) => {
  const b = e.target.closest("[data-value]");
  if (!b) return;
  setTheme(b.dataset.value);
  renderSettings();
});
$("#set-topics").addEventListener("change", (e) => {
  const id = e.target.dataset.show;
  if (!id) return;
  state.prefs.hidden = e.target.checked ? state.prefs.hidden.filter((x) => x !== id) : [...state.prefs.hidden, id];
  savePrefs();
});
$("#set-topics").addEventListener("click", (e) => {
  const b = e.target.closest("[data-move]");
  if (!b) return;
  const ids = orderedTopics({ includeHidden: true }).map((tp) => tp.id);
  const i = ids.indexOf(b.dataset.move);
  const j = i + Number(b.dataset.dir);
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  state.prefs.order = ids;
  savePrefs();
  renderSettings();
});
$("#reset-topics").addEventListener("click", () => {
  state.prefs = { order: [], hidden: [] };
  savePrefs();
  renderSettings();
});

// Install as an app (Chrome/Edge/Android show this; iPhone uses Share → Add to Home Screen).
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
$("#install").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  $("#install").hidden = true;
});

// Remember when you were last here, for the "New" marks next time.
const rememberVisit = () => store.set("lastVisit", Date.now());
document.addEventListener("visibilitychange", () => { if (document.hidden) rememberVisit(); });
window.addEventListener("pagehide", rememberVisit);
window.addEventListener("resize", measureSticky);

// ---------- Start ----------

const FIVE_MIN = 5 * 60 * 1000;

async function start() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  // Served by the local server (npm start)? Then local AI may be available.
  const info = await fetch("api/info", { signal: AbortSignal.timeout(3000) })
    .then((r) => (r.ok && r.headers.get("content-type")?.includes("json") ? r.json() : null))
    .catch(() => null);
  state.ai = Boolean(info?.ai);

  const saved = store.get("snapshot", null);
  if (saved?.articles?.length) state.data = { ...state.data, ...saved, articles: saved.articles.map(withText) };
  render();
  await update();

  // Check again every 5 minutes while the page is visible, and when you come back to it.
  setInterval(() => { if (!document.hidden) update(); }, FIVE_MIN);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastUpdate > FIVE_MIN) update();
  });
}

start();
