import { HEADLINE_ALERTS, SPECIAL_DAYS, LOOKAHEAD_DAYS, WEATHER_THRESHOLDS } from "./config.js";
import { matchesAny } from "./articles.js";
import { getLocation } from "./location.js";
import { t, label, getLang } from "./i18n.js";

const DAY = 24 * 3600 * 1000;

/** YYYY-MM-DD in the configured timezone. */
function ymd(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: getLocation().timezone }).format(date);
}

function daysUntil(dateStr) {
  const today = new Date(ymd(new Date()) + "T00:00:00Z");
  return Math.round((new Date(dateStr + "T00:00:00Z") - today) / DAY);
}

function whenLabel(n) {
  if (n === 0) return t("whenToday");
  if (n === 1) return t("whenTomorrow");
  return t("whenIn", n);
}

// Open-Meteo and Hebcal allow web pages to call them directly.
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------- Weather (Open-Meteo, free, no key) ----------
const WMO_STORM = new Set([95, 96, 99]);
const WMO_SNOW = new Set([71, 73, 75, 77, 85, 86]);

export async function weather() {
  const LOCATION = getLocation();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max,weather_code` +
    `&timezone=${encodeURIComponent(LOCATION.timezone)}&forecast_days=3`;
  const data = await getJson(url);
  const d = data.daily;
  const th = WEATHER_THRESHOLDS;
  const alerts = [];

  d.time.forEach((date, i) => {
    const when = whenLabel(daysUntil(date));
    // `kind` keeps the alert id the same in both languages (so dismissing sticks).
    const push = (icon, kind, title, severity) =>
      alerts.push({ id: `wx-${date}-${kind}`, kind: "weather", icon, title: `${title} — ${when}`, detail: LOCATION.name, date, severity });
    if (d.temperature_2m_max[i] >= th.heatC) push("🔥", "heat", t("heat", Math.round(d.temperature_2m_max[i])), "danger");
    if (d.temperature_2m_min[i] <= th.coldC) push("🥶", "cold", t("cold", Math.round(d.temperature_2m_min[i])), "warn");
    if (d.precipitation_sum[i] >= th.rainMm) push("🌧️", "rain", t("rain", Math.round(d.precipitation_sum[i])), "warn");
    if (d.wind_gusts_10m_max[i] >= th.gustKmh) push("💨", "wind", t("wind", Math.round(d.wind_gusts_10m_max[i])), "warn");
    if (WMO_STORM.has(d.weather_code[i])) push("⛈️", "storm", t("storms"), "warn");
    if (WMO_SNOW.has(d.weather_code[i])) push("❄️", "snow", t("snow"), "warn");
  });

  return {
    current: {
      location: LOCATION.name,
      tempC: data.current?.temperature_2m,
      code: data.current?.weather_code,
      windKmh: data.current?.wind_speed_10m,
    },
    daily: d.time.map((date, i) => ({
      date, max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], code: d.weather_code[i],
    })),
    alerts,
  };
}

// ---------- Jewish & Israeli holidays (Hebcal, free, no key) ----------
export async function holidays() {
  const start = ymd(new Date());
  const end = ymd(new Date(Date.now() + LOOKAHEAD_DAYS * DAY));
  const url =
    `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=off&mf=off&ss=off&i=on` +
    `&start=${start}&end=${end}`;
  const data = await getJson(url);
  return (data.items || [])
    .filter((it) => it.category === "holiday")
    .map((it) => {
      const date = it.date.slice(0, 10);
      const n = daysUntil(date);
      return {
        id: `hol-${date}-${it.title}`,
        kind: "holiday",
        icon: "🕎",
        title: getLang() === "he" && it.hebrew ? it.hebrew : `${it.title}${it.hebrew ? ` · ${it.hebrew}` : ""}`,
        detail: whenLabel(n),
        date,
        link: it.link,
        severity: n <= 1 ? "warn" : "info",
      };
    });
}

// ---------- Shopping days & other special days ----------
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

function shoppingDays(year) {
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4); // 4th Thursday of November
  const iso = (d) => d.toISOString().slice(0, 10);
  return [
    { date: `${year}-11-11`, key: "singlesDay", title: t("singlesDay"), icon: "🛍️" },
    { date: iso(new Date(thanksgiving.getTime() + DAY)), key: "blackFriday", title: t("blackFriday"), icon: "🖤" },
    { date: iso(new Date(thanksgiving.getTime() + 4 * DAY)), key: "cyberMonday", title: t("cyberMonday"), icon: "💻" },
  ].map((s) => ({ ...s, kind: "sales" }));
}

export function specialDays() {
  const now = new Date();
  const year = Number(ymd(now).slice(0, 4));
  const all = [...SPECIAL_DAYS, ...shoppingDays(year), ...shoppingDays(year + 1)];
  const alerts = all
    .filter((s) => !s.disabled)
    .map((s) => ({ ...s, n: daysUntil(s.date) }))
    .filter((s) => s.n >= 0 && s.n <= LOOKAHEAD_DAYS)
    .map((s) => ({
      id: `day-${s.date}-${s.key || s.title}`,
      kind: s.kind,
      icon: s.icon,
      title: (getLang() === "he" && s.he) || s.title,
      detail: whenLabel(s.n),
      date: s.date,
      severity: s.n <= 1 ? "warn" : "info",
    }));

  const [, month, day] = ymd(now).split("-").map(Number);
  if (month === 11) {
    alerts.push({
      id: `black-november-${year}`, kind: "sales", icon: "🛒",
      title: t("blackNovember"), detail: t("blackNovemberDetail"), severity: "info",
    });
  }
  // Israel's regulated fuel price is updated at the start of each month.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day >= lastDay - 2) {
    alerts.push({
      id: `fuel-update-${year}-${month}`, kind: "fuel", icon: "⛽",
      title: t("fuelUpdate"),
      detail: t("fuelUpdateDetail"), severity: "info",
    });
  }
  return alerts;
}

// ---------- Breaking alerts pulled out of headlines ----------
export function headlineAlerts(articles) {
  const since = Date.now() - DAY;
  const out = [];
  for (const det of HEADLINE_ALERTS) {
    const hits = articles
      .filter((a) => new Date(a.published).getTime() >= since)
      .filter((a) => (a.ai?.alert ? a.ai.alert === det.id : matchesAny(a.text, det.keywords)))
      .slice(0, 3);
    for (const a of hits) {
      out.push({
        id: `hl-${a.id}`, kind: det.id, icon: det.icon, title: a.title,
        detail: `${label(det)} · ${a.source}`, link: a.link, date: a.published,
        severity: det.id === "weather" ? "warn" : "info",
      });
    }
  }
  return out;
}
