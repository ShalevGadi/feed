import {
  LOCATION, HEADLINE_ALERTS, SPECIAL_DAYS, LOOKAHEAD_DAYS, WEATHER_THRESHOLDS,
} from "./config.js";
import { matchesAny } from "./feeds.js";

const DAY = 24 * 3600 * 1000;

/** YYYY-MM-DD in the configured timezone. */
function ymd(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LOCATION.timezone }).format(date);
}

function daysUntil(dateStr) {
  const today = new Date(ymd(new Date()) + "T00:00:00Z");
  return Math.round((new Date(dateStr + "T00:00:00Z") - today) / DAY);
}

function whenLabel(n) {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ---------- Weather (Open-Meteo, free, no key) ----------
const WMO_STORM = new Set([95, 96, 99]);
const WMO_SNOW = new Set([71, 73, 75, 77, 85, 86]);

export async function weather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LOCATION.lat}&longitude=${LOCATION.lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max,weather_code` +
    `&timezone=${encodeURIComponent(LOCATION.timezone)}&forecast_days=3`;
  const data = await getJson(url);
  const d = data.daily;
  const t = WEATHER_THRESHOLDS;
  const alerts = [];

  d.time.forEach((date, i) => {
    const when = whenLabel(daysUntil(date));
    const push = (icon, title, severity) =>
      alerts.push({ id: `wx-${date}-${title}`, kind: "weather", icon, title: `${title} — ${when}`, detail: LOCATION.name, date, severity });
    if (d.temperature_2m_max[i] >= t.heatC) push("🔥", `Heat: up to ${Math.round(d.temperature_2m_max[i])}°C`, "danger");
    if (d.temperature_2m_min[i] <= t.coldC) push("🥶", `Cold: down to ${Math.round(d.temperature_2m_min[i])}°C`, "warn");
    if (d.precipitation_sum[i] >= t.rainMm) push("🌧️", `Heavy rain: ${Math.round(d.precipitation_sum[i])} mm`, "warn");
    if (d.wind_gusts_10m_max[i] >= t.gustKmh) push("💨", `Strong winds: gusts ${Math.round(d.wind_gusts_10m_max[i])} km/h`, "warn");
    if (WMO_STORM.has(d.weather_code[i])) push("⛈️", "Thunderstorms", "warn");
    if (WMO_SNOW.has(d.weather_code[i])) push("❄️", "Snow", "warn");
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
        title: `${it.title}${it.hebrew ? ` · ${it.hebrew}` : ""}`,
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
    { date: `${year}-11-11`, title: "Singles Day (11.11) sales", icon: "🛍️" },
    { date: iso(new Date(thanksgiving.getTime() + DAY)), title: "Black Friday", icon: "🖤" },
    { date: iso(new Date(thanksgiving.getTime() + 4 * DAY)), title: "Cyber Monday", icon: "💻" },
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
      id: `day-${s.date}-${s.title}`,
      kind: s.kind,
      icon: s.icon,
      title: s.title,
      detail: whenLabel(s.n),
      date: s.date,
      severity: s.n <= 1 ? "warn" : "info",
    }));

  const [, month, day] = ymd(now).split("-").map(Number);
  if (month === 11) {
    alerts.push({
      id: `black-november-${year}`, kind: "sales", icon: "🛒",
      title: "Black November — sales season is on", detail: "Watch for deals all month", severity: "info",
    });
  }
  // Israel's regulated fuel price is updated at the start of each month.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day >= lastDay - 2) {
    alerts.push({
      id: `fuel-update-${year}-${month}`, kind: "fuel", icon: "⛽",
      title: "Fuel price update coming on the 1st",
      detail: "Fill up before or after, depending on the announcement", severity: "info",
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
        detail: `${det.label} · ${a.source}`, link: a.link, date: a.published,
        severity: det.id === "weather" ? "warn" : "info",
      });
    }
  }
  return out;
}

/** Everything for the Alerts bar. Each source fails independently. */
export async function buildAlerts(articles) {
  const [wx, hol] = await Promise.allSettled([weather(), holidays()]);
  const alerts = [
    ...(wx.status === "fulfilled" ? wx.value.alerts : []),
    ...(hol.status === "fulfilled" ? hol.value : []),
    ...specialDays(),
    ...headlineAlerts(articles),
  ];
  const rank = { danger: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return {
    alerts,
    weather: wx.status === "fulfilled" ? { current: wx.value.current, daily: wx.value.daily } : null,
    errors: [wx, hol].filter((r) => r.status === "rejected").map((r) => r.reason.message),
  };
}
