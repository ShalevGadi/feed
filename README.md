# My News: a personal news feed

A free, personal news dashboard with an **alerts bar** at the top and **topic feeds** below.
It loads fresh news **every time you open or refresh the page**. Nothing runs in the background.

**Live site:** https://shalevgadi.github.io/feed/

![screenshot](docs/screenshot.png)

## What's in it

**Alerts** (top bar, sorted by urgency)
| Alert | Source |
|---|---|
| ⛈️ Weather: heat, cold, heavy rain, strong winds, storms for the next 3 days | [Open-Meteo](https://open-meteo.com) forecast + severe-weather headlines |
| 🕎 Jewish & Israeli holidays in the next 14 days | [Hebcal](https://www.hebcal.com) (Israel schedule) |
| 🗳️ Elections | Dates in `SPECIAL_DAYS` + election headlines |
| 🛍️ Sales: Black November, Singles Day 11.11, Black Friday, Cyber Monday | Computed automatically every year + sale headlines |
| ⛽ Gas prices | Fuel-price headlines (Hebrew & English) + a reminder before the monthly price update on the 1st |

**Topics**: World · Israel (Israeli sources only) · War & Defense · Middle East · Tech · Cyber & Hacking · Science · Gaming · AI · XR/VR/AR · AI Use Cases.

An article can appear in several topics. Each topic has its own feeds, and keywords pull in matching stories from any feed.

Click the weather in the header to change your city. The choice is saved in your browser.

## 100% free

No payments, ever. RSS feeds, Open-Meteo, Hebcal and GitHub Pages are all free. Nothing needs an API key.

## How it works

The whole app runs in your browser (`public/`):
1. On open or refresh, it shows the news from your last visit instantly, then fetches every feed fresh.
2. The page fills in as feeds arrive, usually within 5–20 seconds.
3. Weather and holidays come straight from Open-Meteo and Hebcal.

**Why a relay?** Most news sites don't let other websites read their feeds directly from a browser (a rule called CORS). So the feeds pass through a relay:
- **On GitHub Pages:** free public relays by default, with nothing to set up. They can be slow or occasionally fail. For reliable loading, set up your own free relay (below).
- **On your own computer (`npm start`):** the local server is the relay.

The **Sources** line at the bottom of the page shows how many feeds loaded. Open it to see which ones failed.

## Optional: your own free relay (more reliable)

Cloudflare Workers is free (100,000 requests a day, no credit card).
1. Sign up at https://dash.cloudflare.com/sign-up (free).
2. Go to **Workers & Pages → Create → Create Worker**, name it (e.g. `news-relay`) and click **Deploy**.
3. Click **Edit code**, replace everything with the contents of `relay/worker.js`, then click **Deploy**.
4. Copy the worker's address (like `https://news-relay.<you>.workers.dev`) into `PROXY_URL` in `public/js/config.js`, and push the change.

## Customize

Everything lives in `public/js/config.js`:
- `TOPICS`: add or remove feeds and keywords per topic
- `HEADLINE_ALERTS`: keywords that promote a headline into the alerts bar
- `SPECIAL_DAYS`: your own dates (birthdays, elections, launches…)
- `WEATHER_THRESHOLDS`, `DEFAULT_LOCATION`, `PROXY_URL`

Push a change to `main` and GitHub republishes the site within about a minute.

## Run it on your own computer (optional, adds free local AI)

```bash
npm install
cp .env.example .env     # optional: enable free local AI
npm start                # → http://localhost:3000
```

Requires Node 22+. From your phone on the same Wi-Fi, use `http://<your-computer-ip>:3000`.

### Free local AI (Ollama)

Without AI, articles are sorted into topics by keyword. You can also run a free open model on your computer with [Ollama](https://ollama.com). It adds:
- more accurate topics, especially **AI Use Cases**
- an importance score and a "Most important" sort
- one-line English summaries, including for Hebrew stories
- a "✨ Your briefing" digest

```bash
# install Ollama from https://ollama.com, then:
ollama pull gemma3:4b
# in .env:
OLLAMA_MODEL=gemma3:4b
```

| Your computer | Model |
|---|---|
| 8 GB RAM | `gemma3:1b` |
| 16 GB RAM or an Apple M-series Mac | **`gemma3:4b`** (recommended) |
| 32 GB RAM or a 12 GB+ GPU | `gemma3:12b` |

The AI only works with the local version. GitHub Pages can't run a model.
