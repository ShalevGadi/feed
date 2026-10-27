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
const feed = (source, domain, url, options = {}) => ({ source, domain, url, ...options });

// Some feeds cover much more than one topic; `match` keeps only posts about these words.
const AI_WORDS = ["ai", "llm", "genai", "generative ai", "machine learning", "prompt injection", "jailbreak", "model", "agent", "agentic", "copilot", "chatgpt", "gemini", "claude"];
const bing = (source, domain, query, mkt = "en-US") => ({
  source, domain, bing: true,
  url: `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=${mkt}`,
});

/**
 * Topics, in display order. Each topic has:
 *  - feeds:    feed() / bing() entries whose articles belong to the topic outright
 *  - maxAgeDays: (optional) keep stories this long; default is MAX_AGE_HOURS
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
      feed("Scientific American", "scientificamerican.com", "https://www.scientificamerican.com/feed/"),
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

  // ---- More topics (from your example) ----
  {
    id: "alerts",
    maxAgeDays: 7,
    label: "Alerts & Notices",
    icon: "🚨",
    feeds: [
      feed("Ynet", "ynet.co.il", "https://www.ynet.co.il/Integration/StoryRss6.xml"),
      bing("Ynet", "ynet.co.il", "site:ynet.co.il מחיר הדלק", "he-IL"),
      bing("Globes", "globes.co.il", "site:globes.co.il (מחיר הדלק OR מחירי הדלק OR בנזין)", "he-IL"),
      bing("Globes", "globes.co.il", "site:globes.co.il בנק ישראל (ריבית OR אינפלציה)", "he-IL"),
      bing("Ynet", "ynet.co.il", "site:ynet.co.il פיקוד העורף הנחיות", "he-IL"),
      bing("Ynet", "ynet.co.il", "site:ynet.co.il (ריקול OR סגירת כבישים OR שביתה בתחבורה הציבורית OR תעריף החשמל OR תעריף המים)", "he-IL"),
      bing("Times of Israel", "timesofisrael.com", "site:timesofisrael.com (Home Front Command OR Bank of Israel interest rate OR fuel prices)"),
    ],
    keywords: ["פיקוד העורף", "home front command", "ריקול", "product recall"],
  },
  {
    id: "economy",
    label: "Money & Economy",
    icon: "💰",
    feeds: [
      bing("Reuters", "reuters.com", "site:reuters.com (economy OR inflation OR interest rates OR jobs OR central bank)"),
      bing("AP News", "apnews.com", "site:apnews.com/article (economy OR inflation OR interest rates OR jobs)"),
      bing("CNBC", "cnbc.com", "site:cnbc.com (economy OR inflation OR interest rates OR jobs report)"),
      bing("Financial Times", "ft.com", "site:ft.com (economy OR inflation OR interest rates OR central bank)"),
    ],
    keywords: ["inflation", "interest rate", "central bank", "recession", "ריבית", "אינפלציה", "בנק ישראל"],
  },
  {
    id: "markets",
    label: "Stocks & Markets",
    icon: "📈",
    feeds: [
      bing("Reuters", "reuters.com", "site:reuters.com/markets (stocks OR earnings OR shares OR index)"),
      bing("CNBC", "cnbc.com", "site:cnbc.com/markets (stocks OR earnings OR shares OR index)"),
      bing("MarketWatch", "marketwatch.com", "site:marketwatch.com (stocks OR earnings OR market index)"),
      bing("Yahoo Finance", "finance.yahoo.com", "site:finance.yahoo.com (stocks OR earnings OR shares OR market index)"),
    ],
    keywords: ["nasdaq", "s&p 500", "dow jones", "stock market", "wall street", "earnings", "בורסה", "מניות"],
  },
  {
    id: "crypto",
    label: "Crypto",
    icon: "🪙",
    feeds: [
      feed("CoinDesk", "coindesk.com", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
      feed("Decrypt", "decrypt.co", "https://decrypt.co/feed"),
      bing("Reuters", "reuters.com", "site:reuters.com (Bitcoin OR Ethereum OR cryptocurrency OR crypto exchange)"),
      bing("CNBC", "cnbc.com", "site:cnbc.com (Bitcoin OR Ethereum OR cryptocurrency OR crypto regulation)"),
    ],
    keywords: ["bitcoin", "ethereum", "crypto", "cryptocurrency", "stablecoin", "ביטקוין", "קריפטו"],
  },
  {
    id: "ai-security",
    maxAgeDays: 30,
    label: "AI Security & Red Teaming",
    icon: "🧨",
    feeds: [
      feed("OWASP GenAI", "owasp.org", "https://genai.owasp.org/feed/"),
      feed("Microsoft Security", "microsoft.com", "https://www.microsoft.com/en-us/security/blog/feed/", { match: AI_WORDS }),
      feed("Google Security Blog", "googleblog.com", "https://security.googleblog.com/feeds/posts/default", { match: AI_WORDS }),
      bing("OpenAI", "openai.com", "site:openai.com (AI security OR red teaming OR prompt injection OR jailbreak OR safeguard bypass)"),
      bing("Anthropic", "anthropic.com", "site:anthropic.com/research (AI security OR red teaming OR prompt injection OR jailbreak OR safeguard bypass)"),
      bing("PortSwigger Research", "portswigger.net", "site:portswigger.net/research (AI OR LLM) (prompt injection OR jailbreak OR security OR pentesting)"),
      feed("Unit 42", "paloaltonetworks.com", "https://unit42.paloaltonetworks.com/feed/", { match: AI_WORDS }),
    ],
    keywords: ["prompt injection", "jailbreak", "red teaming", "red team", "ai security", "llm security", "model poisoning"],
  },
  {
    id: "cyber-learning",
    maxAgeDays: 30,
    label: "Cyber Learning",
    icon: "🎓",
    feeds: [
      feed("PortSwigger Research", "portswigger.net", "https://portswigger.net/research/rss"),
      feed("SANS ISC", "sans.edu", "https://isc.sans.edu/rssfeed.xml"),
      feed("Hack The Box", "hackthebox.com", "https://www.hackthebox.com/blog/rss.xml"),
      feed("OffSec", "offsec.com", "https://www.offsec.com/feed/"),
    ],
    keywords: ["ctf", "capture the flag", "pentest", "penetration testing", "bug bounty", "writeup"],
  },
  {
    id: "coding",
    label: "Computers & Coding",
    icon: "🖥️",
    feeds: [
      feed("Phoronix", "phoronix.com", "https://www.phoronix.com/rss.php"),
      feed("InfoQ", "infoq.com", "https://feed.infoq.com/"),
      feed("Stack Overflow Blog", "stackoverflow.blog", "https://stackoverflow.blog/feed/"),
      feed("Cloudflare Blog", "cloudflare.com", "https://blog.cloudflare.com/rss/"),
      feed("Windows Blog", "windows.com", "https://blogs.windows.com/feed/"),
    ],
    keywords: ["linux", "windows 11", "programming", "developers", "open source", "javascript", "python"],
  },
  {
    id: "gadgets",
    label: "Gadgets",
    icon: "📱",
    feeds: [
      feed("Engadget", "engadget.com", "https://www.engadget.com/rss.xml"),
      feed("Android Authority", "androidauthority.com", "https://www.androidauthority.com/feed/"),
      feed("The Verge", "theverge.com", "https://www.theverge.com/rss/index.xml"),
    ],
    keywords: ["iphone", "samsung galaxy", "pixel", "smartphone", "laptop", "smartwatch", "earbuds"],
  },
  {
    id: "game-deals",
    label: "Game Deals",
    icon: "🏷️",
    feeds: [
      bing("PC Gamer", "pcgamer.com", "site:pcgamer.com (game deal OR gaming sale OR free game)"),
      bing("IGN", "ign.com", "site:ign.com (game deal OR gaming sale OR free game)"),
      bing("Eurogamer", "eurogamer.net", "site:eurogamer.net (game deal OR gaming sale OR free game)"),
    ],
    keywords: ["free game", "steam sale", "epic games store free", "game deal"],
  },
  {
    id: "deals",
    label: "Deals & Sales Events",
    icon: "🛒",
    feeds: [
      bing("The Verge", "theverge.com", "site:theverge.com (Black Friday OR Cyber Monday OR Prime Day OR deal event)"),
      bing("Engadget", "engadget.com", "site:engadget.com/deals (Black Friday OR Cyber Monday OR Prime Day OR sale)"),
      bing("Tom's Guide", "tomsguide.com", "site:tomsguide.com (Black Friday OR Cyber Monday OR Prime Day OR deal event)"),
      bing("TechRadar", "techradar.com", "site:techradar.com/deals (Black Friday OR Cyber Monday OR Prime Day OR sale)"),
    ],
    keywords: ["black friday", "cyber monday", "prime day", "singles day", "בלאק פריידיי"],
  },
  {
    id: "lifehacks",
    maxAgeDays: 14,
    label: "Life Hacks & Tips",
    icon: "💡",
    feeds: [
      feed("How-To Geek", "howtogeek.com", "https://www.howtogeek.com/feed/"),
      feed("Popular Science", "popsci.com", "https://www.popsci.com/feed/"),
      bing("Lifehacker", "lifehacker.com", "site:lifehacker.com (life hack OR practical tips OR productivity OR home tips)"),
      bing("Wirecutter", "nytimes.com", "site:nytimes.com/wirecutter (tips OR guide OR best way)"),
    ],
    keywords: [],
  },
  {
    id: "intelligence",
    maxAgeDays: 14,
    label: "Intelligence",
    icon: "🕵️",
    feeds: [
      feed("Bellingcat", "bellingcat.com", "https://www.bellingcat.com/feed/"),
      bing("Lawfare", "lawfaremedia.org", "site:lawfaremedia.org"),
      feed("The Record", "therecord.media", "https://therecord.media/feed"),
    ],
    keywords: ["espionage", "intelligence agency", "mossad", "cia", "osint", "spy"],
  },
  {
    id: "space",
    label: "Space & Astronomy",
    icon: "🔭",
    feeds: [
      feed("ESA", "esa.int", "https://www.esa.int/rssfeed/Our_Activities/Space_Science"),
      feed("Space.com", "space.com", "https://www.space.com/feeds/all"),
      feed("Universe Today", "universetoday.com", "https://www.universetoday.com/feed/"),
      feed("NASA", "nasa.gov", "https://www.nasa.gov/news-release/feed/"),
    ],
    keywords: ["spacex", "astronaut", "telescope", "asteroid", "nasa", "orbit", "galaxy cluster", "exoplanet"],
  },
  {
    id: "robotics",
    label: "Robotics",
    icon: "🦾",
    feeds: [
      feed("IEEE Spectrum", "ieee.org", "https://spectrum.ieee.org/feeds/topic/robotics.rss"),
      feed("The Robot Report", "therobotreport.com", "https://www.therobotreport.com/feed/"),
      bing("TechCrunch", "techcrunch.com", "site:techcrunch.com (robotics OR humanoid robot OR industrial robot)"),
    ],
    keywords: ["robot", "robotics", "humanoid"],
  },
  {
    id: "energy",
    label: "Energy & Sustainability",
    icon: "🔋",
    feeds: [
      feed("Canary Media", "canarymedia.com", "https://www.canarymedia.com/rss"),
      feed("CleanTechnica", "cleantechnica.com", "https://cleantechnica.com/feed/"),
      bing("Reuters", "reuters.com", "site:reuters.com (renewable energy OR solar OR wind OR battery storage OR nuclear fusion)"),
      bing("Ars Technica", "arstechnica.com", "site:arstechnica.com (renewable energy OR solar OR wind OR battery storage OR nuclear fusion)"),
    ],
    keywords: ["renewable energy", "solar power", "wind farm", "battery storage", "nuclear fusion", "electric vehicle", "אנרגיה סולארית"],
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
    id: "notice",
    label: "Official notice",
    icon: "📢",
    keywords: ["פיקוד העורף", "home front command", "ריקול", "product recall"],
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
