// Interface language (English / Hebrew). Article text stays in its own language.

const STRINGS = {
  en: {
    appName: "My News",
    search: "Search headlines…",
    refresh: "Refresh now",
    settings: "Settings",
    theme: "Light / dark",
    changeCity: "Change weather city",
    alerts: "Alerts",
    nothingUrgent: "Nothing urgent. 🌿",
    checking: "Checking…",
    dismiss: "Dismiss",
    all: "All",
    saved: "Saved",
    stories: (n) => `${n} stories`,
    newCount: (n) => `${n} new`,
    new: "New",
    seeAll: (n) => `See all ${n} →`,
    back: "← All topics",
    loading: "Loading the news…",
    noStories: "No stories here.",
    noSaved: "Nothing saved yet. Tap ☆ on a story to keep it here.",
    moreSources: (n) => `+${n} more ${n === 1 ? "source" : "sources"}`,
    save: "Save for later",
    unsave: "Remove from saved",
    newsLoaded: (when) => `News loaded ${when}`,
    loadingLatest: "Loading the latest news…",
    loadFailed: (why) => `Couldn't load new stories (${why}). Showing the last ones.`,
    offline: "You're offline. Showing the last news you loaded.",
    sources: (ok, total) => `Sources: ${ok} of ${total} loaded`,
    allSourcesOk: "All sources loaded.",
    sourceEmpty: "loaded, but no matching stories right now",
    sourceVia: (via) => `loaded through ${via}`,
    cityPrompt: "Weather for which city?",
    updatingWeather: "Updating weather…",
    next: "next",
    major: "Major",
    important: "Important",
    langAll: "All",
    langHe: "עברית",
    langEn: "English",
    // Settings dialog
    settingsTitle: "Settings",
    uiLanguage: "Interface language",
    storiesIn: "Show stories in",
    themeLabel: "Theme",
    themeAuto: "Auto",
    themeLight: "Light",
    themeDark: "Dark",
    topicsLabel: "Topics (tick to show, arrows to reorder)",
    moveUp: "Move up",
    moveDown: "Move down",
    reset: "Reset topics",
    done: "Done",
    install: "Install app",
    // Times
    justNow: "just now",
    minAgo: (m) => `${m} min ago`,
    today: "Today",
    yesterday: "Yesterday",
    // Alerts
    whenToday: "Today",
    whenTomorrow: "Tomorrow",
    whenIn: (n) => `In ${n} days`,
    heat: (c) => `Heat: up to ${c}°C`,
    cold: (c) => `Cold: down to ${c}°C`,
    rain: (mm) => `Heavy rain: ${mm} mm`,
    wind: (k) => `Strong winds: gusts ${k} km/h`,
    storms: "Thunderstorms",
    snow: "Snow",
    singlesDay: "Singles Day (11.11) sales",
    blackFriday: "Black Friday",
    cyberMonday: "Cyber Monday",
    blackNovember: "Black November — sales season is on",
    blackNovemberDetail: "Watch for deals all month",
    fuelUpdate: "Fuel price update coming on the 1st",
    fuelUpdateDetail: "Fill up before or after, depending on the announcement",
    briefingWaiting: "Your briefing is being written by your local model. It appears here in a minute or two.",
    briefing: "✨ Your briefing",
    latest: "Latest",
    mostImportant: "Most important",
  },
  he: {
    appName: "החדשות שלי",
    search: "חיפוש כותרות…",
    refresh: "רענון",
    settings: "הגדרות",
    theme: "בהיר / כהה",
    changeCity: "שינוי עיר למזג האוויר",
    alerts: "התראות",
    nothingUrgent: "אין שום דבר דחוף. 🌿",
    checking: "בודק…",
    dismiss: "הסתר",
    all: "הכול",
    saved: "שמורים",
    stories: (n) => `${n} כתבות`,
    newCount: (n) => `${n} חדשות`,
    new: "חדש",
    seeAll: (n) => `לכל ה-${n} ←`,
    back: "→ כל הנושאים",
    loading: "טוען חדשות…",
    noStories: "אין כאן כתבות.",
    noSaved: "עוד לא שמרת כלום. לחצו ☆ על כתבה כדי לשמור אותה כאן.",
    moreSources: (n) => `+${n} ${n === 1 ? "מקור נוסף" : "מקורות נוספים"}`,
    save: "שמירה לאחר כך",
    unsave: "הסרה מהשמורים",
    newsLoaded: (when) => `החדשות נטענו ${when}`,
    loadingLatest: "טוען את החדשות האחרונות…",
    loadFailed: (why) => `לא הצלחתי לטעון כתבות חדשות (${why}). מוצגות האחרונות.`,
    offline: "אין חיבור לאינטרנט. מוצגות החדשות האחרונות שנטענו.",
    sources: (ok, total) => `מקורות: ${ok} מתוך ${total} נטענו`,
    allSourcesOk: "כל המקורות נטענו.",
    sourceEmpty: "נטען, אבל אין כרגע כתבות מתאימות",
    sourceVia: (via) => `נטען דרך ${via}`,
    cityPrompt: "מזג אוויר לאיזו עיר?",
    updatingWeather: "מעדכן מזג אוויר…",
    next: "בהמשך",
    major: "מרכזי",
    important: "חשוב",
    langAll: "הכול",
    langHe: "עברית",
    langEn: "English",
    settingsTitle: "הגדרות",
    uiLanguage: "שפת הממשק",
    storiesIn: "הצגת כתבות ב",
    themeLabel: "ערכת צבעים",
    themeAuto: "אוטומטי",
    themeLight: "בהיר",
    themeDark: "כהה",
    topicsLabel: "נושאים (סמנו להצגה, חצים לשינוי הסדר)",
    moveUp: "למעלה",
    moveDown: "למטה",
    reset: "איפוס נושאים",
    done: "סיום",
    install: "התקנת האפליקציה",
    justNow: "עכשיו",
    minAgo: (m) => `לפני ${m} דק׳`,
    today: "היום",
    yesterday: "אתמול",
    whenToday: "היום",
    whenTomorrow: "מחר",
    whenIn: (n) => `בעוד ${n} ימים`,
    heat: (c) => `חום: עד ${c}°C`,
    cold: (c) => `קור: עד ${c}°C`,
    rain: (mm) => `גשם כבד: ${mm} מ״מ`,
    wind: (k) => `רוחות חזקות: משבים עד ${k} קמ״ש`,
    storms: "סופות רעמים",
    snow: "שלג",
    singlesDay: "מבצעי יום הרווקים (11.11)",
    blackFriday: "בלאק פריידיי",
    cyberMonday: "סייבר מאנדיי",
    blackNovember: "בלאק נובמבר — עונת המבצעים כאן",
    blackNovemberDetail: "שווה לחפש מבצעים כל החודש",
    fuelUpdate: "עדכון מחיר הדלק ב-1 לחודש",
    fuelUpdateDetail: "כדאי לתדלק לפני או אחרי, לפי ההודעה",
    briefingWaiting: "הסיכום שלך נכתב על ידי המודל המקומי. הוא יופיע כאן בעוד דקה-שתיים.",
    briefing: "✨ הסיכום שלך",
    latest: "האחרונות",
    mostImportant: "החשובות",
  },
};

let lang = "en";
try { lang = localStorage.getItem("uiLang") || (navigator.language?.startsWith("he") ? "he" : "en"); } catch {}
if (!STRINGS[lang]) lang = "en";

export const getLang = () => lang;

export function setLang(next) {
  lang = STRINGS[next] ? next : "en";
  try { localStorage.setItem("uiLang", lang); } catch {}
  applyDocumentLang();
}

/** t("stories", 5) → "5 stories" */
export function t(key, ...args) {
  const v = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
}

/** A label object with English `label` and optional Hebrew `he`. */
export const label = (obj) => (lang === "he" && obj?.he) || obj?.label || "";

/** Sets <html lang/dir> and fills every [data-i18n] / [data-i18n-placeholder] / [data-i18n-title]. */
export function applyDocumentLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of document.querySelectorAll("[data-i18n-title]")) { el.title = t(el.dataset.i18nTitle); el.setAttribute("aria-label", el.title); }
}
