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
 * A feed entry, like the example: which publisher, which website (domain), and
 * the feed address. bing() is for publishers without a good feed of their own:
 * it uses a Bing News RSS search limited to that site, and only keeps articles
 * whose link really is on that site.
 */
const feed = (source, domain, url) => ({ source, domain, url });
const bing = (source, domain, query, mkt = "en-US") => ({
  source, domain, bing: true,
  url: `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=${mkt}`,
});

/**
 * Topics, in display order. Each topic has:
 *  - feeds:    feed() / bing() entries whose articles belong to the topic outright
 *  - keywords: extra matching — articles from ANY feed whose title/summary hits
 *              one of these also show up here (e.g. a BBC story about a drone strike → War)
 */
export const TOPICS = [
  {
    id: "world",
    label: "World",
    icon: "🌍",
    feeds: [
      bing("Reuters", "reuters.com", "site:reuters.com/world world"),
      bing("AP News", "apnews.com", "site:apnews.com/article (international OR politics OR conflict)"),
      feed("BBC News", "bbc.co.uk", "https://feeds.bbci.co.uk/news/world/rss.xml"),
      feed("The Guardian", "theguardian.com", "https://www.theguardian.com/world/rss"),
      feed("New York Times", "nytimes.com", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
      feed("Al Jazeera", "aljazeera.com", "https://www.aljazeera.com/xml/rss/all.xml"),
      feed("NPR", "npr.org", "https://feeds.npr.org/1004/rss.xml"),
    ],
    keywords: [],
  },
  {
    id: "israel",
    label: "Israel",
    icon: "🇮🇱",
    // Israeli sources only (English + Hebrew)
    feeds: [
      bing("Haaretz", "haaretz.co.il", "site:haaretz.co.il", "he-IL"),
      bing("Kan News", "kan.org.il", "site:kan.org.il חדשות", "he-IL"),
      feed("Times of Israel", "timesofisrael.com", "https://www.timesofisrael.com/feed/"),
      feed("Jerusalem Post", "jpost.com", "https://www.jpost.com/rss/rssfeedsheadlines.aspx"),
      feed("Israel Hayom", "israelhayom.com", "https://www.israelhayom.com/feed/"),
      feed("Ynet News", "ynetnews.com", "https://www.ynetnews.com/Integration/StoryRss3082.xml"),
      feed("Ynet", "ynet.co.il", "https://www.ynet.co.il/Integration/StoryRss2.xml"),
      feed("Maariv", "maariv.co.il", "https://www.maariv.co.il/Rss/RssChadashot"),
      feed("Globes", "globes.co.il", "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=1725"),
      feed("Arutz 7", "inn.co.il", "https://www.inn.co.il/Rss.aspx"),
    ],
    keywords: [],
  },
  {
    id: "war",
    label: "War & Defense",
    icon: "🛡️",
    feeds: [
      bing("Reuters", "reuters.com", "site:reuters.com (war OR military OR missile OR ceasefire)"),
      feed("Breaking Defense", "breakingdefense.com", "https://breakingdefense.com/feed/"),
      feed("Defense News", "defensenews.com", "https://www.defensenews.com/arc/outboundfeeds/rss/"),
      feed("Kyiv Independent", "kyivindependent.com", "https://kyivindependent.com/news-archive/rss/"),
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
      bing("Reuters", "reuters.com", "site:reuters.com/world/middle-east"),
      feed("BBC News", "bbc.co.uk", "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"),
      feed("The Guardian", "theguardian.com", "https://www.theguardian.com/world/middleeast/rss"),
      feed("Al-Monitor", "al-monitor.com", "https://www.al-monitor.com/rss"),
      feed("Al Jazeera", "aljazeera.com", "https://www.aljazeera.com/xml/rss/all.xml"),
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
      feed("The Verge", "theverge.com", "https://www.theverge.com/rss/index.xml"),
      feed("Ars Technica", "arstechnica.com", "https://feeds.arstechnica.com/arstechnica/index"),
      feed("TechCrunch", "techcrunch.com", "https://techcrunch.com/feed/"),
      feed("Geektime", "geektime.co.il", "https://www.geektime.co.il/feed/"),
    ],
    keywords: [],
  },
  {
    id: "cyber",
    label: "Cyber & Hacking",
    icon: "🔐",
    feeds: [
      feed("The Hacker News", "thehackernews.com", "https://feeds.feedburner.com/TheHackersNews"),
      feed("BleepingComputer", "bleepingcomputer.com", "https://www.bleepingcomputer.com/feed/"),
      feed("KrebsOnSecurity", "krebsonsecurity.com", "https://krebsonsecurity.com/feed/"),
      feed("The Record", "therecord.media", "https://therecord.media/feed"),
      feed("Dark Reading", "darkreading.com", "https://www.darkreading.com/rss.xml"),
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
      feed("ScienceDaily", "sciencedaily.com", "https://www.sciencedaily.com/rss/top/science.xml"),
      feed("Quanta Magazine", "quantamagazine.org", "https://www.quantamagazine.org/feed/"),
      feed("New Scientist", "newscientist.com", "https://www.newscientist.com/feed/home/"),
      feed("NASA", "nasa.gov", "https://www.nasa.gov/news-release/feed/"),
    ],
    keywords: [],
  },
  {
    id: "gaming",
    label: "Gaming",
    icon: "🎮",
    feeds: [
      feed("PC Gamer", "pcgamer.com", "https://www.pcgamer.com/rss/"),
      feed("Eurogamer", "eurogamer.net", "https://www.eurogamer.net/feed"),
      feed("Polygon", "polygon.com", "https://www.polygon.com/rss/index.xml"),
      feed("Rock Paper Shotgun", "rockpapershotgun.com", "https://www.rockpapershotgun.com/feed"),
    ],
    keywords: [],
  },
  {
    id: "ai",
    label: "AI",
    icon: "🤖",
    feeds: [
      feed("OpenAI", "openai.com", "https://openai.com/news/rss.xml"),
      bing("Anthropic", "anthropic.com", "site:anthropic.com/news"),
      feed("The Verge", "theverge.com", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
      feed("Ars Technica", "arstechnica.com", "https://arstechnica.com/ai/feed/"),
      feed("MIT Technology Review", "technologyreview.com", "https://www.technologyreview.com/topic/artificial-intelligence/feed"),
      feed("VentureBeat", "venturebeat.com", "https://venturebeat.com/category/ai/feed/"),
      feed("Hugging Face", "huggingface.co", "https://huggingface.co/blog/feed.xml"),
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
      bing("Meta Newsroom", "about.fb.com", "site:about.fb.com/news (Quest OR VR OR AR OR smart glasses)"),
      bing("Apple Newsroom", "apple.com", "site:apple.com/newsroom (Vision Pro OR visionOS)"),
      feed("UploadVR", "uploadvr.com", "https://www.uploadvr.com/rss/"),
      feed("Road to VR", "roadtovr.com", "https://www.roadtovr.com/feed/"),
      feed("Mixed-News", "mixed-news.com", "https://mixed-news.com/en/feed/"),
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
      feed("AWS Machine Learning Blog", "amazon.com", "https://aws.amazon.com/blogs/machine-learning/feed/"),
      feed("AI Business", "aibusiness.com", "https://aibusiness.com/rss.xml"),
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
