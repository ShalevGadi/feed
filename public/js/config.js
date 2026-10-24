// Everything you'd want to tweak lives here: location, feeds, keywords, special dates.

// Default weather location. Click the weather in the page header to change it
// (saved in your browser).
export const DEFAULT_LOCATION = {
  name: "Tel Aviv",
  lat: 32.0853,
  lon: 34.7818,
  timezone: "Asia/Jerusalem",
};

// Drop articles older than this.
export const MAX_AGE_HOURS = 72;

/**
 * Browsers can't read most news feeds directly (the sites don't allow it), so
 * feeds are fetched through a relay ("CORS proxy"):
 *  - On your own computer (npm start) the local server relays — nothing to set up.
 *  - Online, set PROXY_URL to your own free Cloudflare Worker (see README) for
 *    reliable loading. If empty, free public relays are used; they work but can
 *    be slow or rate-limited.
 */
export const PROXY_URL = "https://news-relay.shalevgadi.workers.dev";

/**
 * Topics, in display order. Each topic has:
 *  - feeds:    RSS/Atom URLs that belong to the topic outright
 *  - keywords: extra matching — articles from ANY feed whose title/summary hits
 *              one of these also show up here (e.g. a BBC story about a drone strike → War)
 */
export const TOPICS = [
  {
    id: "world",
    label: "World",
    icon: "🌍",
    feeds: [
      "https://feeds.bbci.co.uk/news/world/rss.xml",
      "https://www.theguardian.com/world/rss",
      "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
      "https://www.aljazeera.com/xml/rss/all.xml",
      "https://feeds.npr.org/1004/rss.xml",
    ],
    keywords: [],
  },
  {
    id: "israel",
    label: "Israel",
    icon: "🇮🇱",
    // Israeli sources only (English + Hebrew)
    feeds: [
      "https://www.timesofisrael.com/feed/",
      "https://www.jpost.com/rss/rssfeedsheadlines.aspx",
      "https://www.israelhayom.com/feed/",
      "https://www.ynetnews.com/Integration/StoryRss3082.xml",
      "https://www.ynet.co.il/Integration/StoryRss2.xml",
      "https://www.maariv.co.il/Rss/RssChadashot",
      "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=1725",
      "https://www.inn.co.il/Rss.aspx",
    ],
    keywords: [],
  },
  {
    id: "war",
    label: "War & Defense",
    icon: "🛡️",
    feeds: [
      "https://breakingdefense.com/feed/",
      "https://www.defensenews.com/arc/outboundfeeds/rss/",
      "https://kyivindependent.com/news-archive/rss/",
    ],
    keywords: [
      "war", "missile", "rocket", "drone strike", "airstrike", "idf", "hamas", "hezbollah",
      "houthi", "ceasefire", "troops", "military", "invasion", "frontline", "interception",
      "מלחמה", "צה\"ל", "טיל", "רקטות", "יירוט", "חמאס", "חיזבאללה", "חות'ים", "הפסקת אש", "פיגוע",
    ],
  },
  {
    id: "mideast",
    label: "Middle East",
    icon: "🕌",
    feeds: [
      "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml",
      "https://www.theguardian.com/world/middleeast/rss",
      "https://www.al-monitor.com/rss",
      "https://www.aljazeera.com/xml/rss/all.xml",
    ],
    keywords: [
      "iran", "syria", "lebanon", "gaza", "west bank", "saudi", "yemen", "iraq", "jordan",
      "egypt", "qatar", "uae", "turkey", "middle east",
      "איראן", "סוריה", "לבנון", "עזה", "סעודיה", "תימן", "עיראק", "ירדן", "מצרים",
    ],
  },
  {
    id: "tech",
    label: "Tech",
    icon: "💻",
    feeds: [
      "https://www.theverge.com/rss/index.xml",
      "https://feeds.arstechnica.com/arstechnica/index",
      "https://techcrunch.com/feed/",
      "https://www.geektime.co.il/feed/",
    ],
    keywords: [],
  },
  {
    id: "cyber",
    label: "Cyber & Hacking",
    icon: "🔐",
    feeds: [
      "https://feeds.feedburner.com/TheHackersNews",
      "https://www.bleepingcomputer.com/feed/",
      "https://krebsonsecurity.com/feed/",
      "https://therecord.media/feed",
      "https://www.darkreading.com/rss.xml",
    ],
    keywords: [
      "ransomware", "zero-day", "0-day", "vulnerability", "cve", "malware", "phishing",
      "data breach", "hacker", "hacked", "exploit", "botnet", "סייבר", "האקרים", "פריצה",
    ],
  },
  {
    id: "science",
    label: "Science",
    icon: "🔬",
    feeds: [
      "https://www.sciencedaily.com/rss/top/science.xml",
      "https://www.quantamagazine.org/feed/",
      "https://www.newscientist.com/feed/home/",
      "https://www.nasa.gov/news-release/feed/",
    ],
    keywords: [],
  },
  {
    id: "gaming",
    label: "Gaming",
    icon: "🎮",
    feeds: [
      "https://www.pcgamer.com/rss/",
      "https://www.eurogamer.net/feed",
      "https://www.polygon.com/rss/index.xml",
      "https://www.rockpapershotgun.com/feed",
    ],
    keywords: [],
  },
  {
    id: "ai",
    label: "AI",
    icon: "🤖",
    feeds: [
      "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
      "https://arstechnica.com/ai/feed/",
      "https://www.technologyreview.com/topic/artificial-intelligence/feed",
      "https://venturebeat.com/category/ai/feed/",
      "https://huggingface.co/blog/feed.xml",
    ],
    keywords: [
      "artificial intelligence", "ai", "llm", "chatgpt", "claude", "gemini", "openai",
      "anthropic", "machine learning", "neural network", "בינה מלאכותית",
    ],
  },
  {
    id: "xr",
    label: "XR / VR / AR",
    icon: "🥽",
    feeds: [
      "https://www.uploadvr.com/rss/",
      "https://www.roadtovr.com/feed/",
      "https://mixed-news.com/en/feed/",
    ],
    keywords: [
      "virtual reality", "augmented reality", "mixed reality", "vision pro", "meta quest",
      "smart glasses", "headset", "xr", "vr", "ar glasses",
    ],
  },
  {
    id: "ai-usecases",
    label: "AI Use Cases",
    icon: "🛠️",
    feeds: [
      "https://aws.amazon.com/blogs/machine-learning/feed/",
      "https://aibusiness.com/rss.xml",
    ],
    // Without AI, use cases are found by keyword. With local AI on (Ollama),
    // the model tags them much more accurately (see ai.js).
    keywords: [
      "case study", "how we used", "uses ai to", "using ai to", "deploys ai", "ai-powered",
      "ai helps", "in production", "customers use", "automate", "copilot for",
    ],
  },
];

/**
 * Alert detectors that scan ALL headlines. When a headline matches, it's
 * promoted into the Alerts bar.
 */
export const HEADLINE_ALERTS = [
  {
    id: "fuel",
    label: "Gas prices",
    icon: "⛽",
    keywords: [
      "gas price", "fuel price", "petrol price", "price of gasoline", "price of fuel",
      "מחיר הדלק", "מחירי הדלק", "מחיר הבנזין", "התייקרות הדלק", "הוזלת הדלק", "ליטר בנזין",
    ],
  },
  {
    id: "election",
    label: "Elections",
    icon: "🗳️",
    keywords: ["election", "polls show", "ballot", "בחירות", "סקר מנדטים", "ועדת הבחירות", "קלפי"],
  },
  {
    id: "weather",
    label: "Weather warning",
    icon: "⛈️",
    keywords: [
      "heat wave", "heatwave", "storm warning", "flood warning", "flash flood", "sandstorm",
      "שרב", "גל חום", "סערה", "שיטפון", "שטפונות", "אזהרת מזג אוויר", "סופת חול",
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: "🛍️",
    keywords: ["black friday", "black november", "cyber monday", "prime day", "singles day", "בלאק פריידיי", "בלאק נובמבר", "סייבר מאנדיי"],
  },
];

/**
 * Fixed special days (beyond Jewish/Israeli holidays, which come from Hebcal).
 * Dates are YYYY-MM-DD. Add anything you care about.
 */
export const SPECIAL_DAYS = [
  { date: "2026-10-27", title: "Knesset elections (26th Knesset)", icon: "🗳️", kind: "election" },
  { date: "2026-11-03", title: "US midterm elections", icon: "🇺🇸", kind: "election" },
];

// How many days ahead to look for holidays / special days.
export const LOOKAHEAD_DAYS = 14;

// Weather thresholds that trigger an alert from the forecast.
export const WEATHER_THRESHOLDS = {
  heatC: 35,       // max temp
  coldC: 3,        // min temp
  rainMm: 20,      // daily precipitation
  gustKmh: 60,     // wind gusts
};
