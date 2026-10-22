# My News: a personal news feed

A self-hosted news dashboard with an **alerts bar** at the top and **topic feeds** below.

![screenshot](docs/screenshot.png)

## What's in it

**Alerts** (top bar, sorted by urgency)
| Alert | Source |
|---|---|
| ⛈️ Weather: heat, cold, heavy rain, strong winds, storms for the next 3 days | [Open-Meteo](https://open-meteo.com) forecast (free, no key) + severe-weather headlines |
| 🕎 Jewish & Israeli holidays in the next 14 days | [Hebcal](https://www.hebcal.com) API (free, no key, Israel schedule) |
| 🗳️ Elections | Dates in `SPECIAL_DAYS` (Knesset election 27 Oct 2026, US midterms 3 Nov 2026) + election headlines |
| 🛍️ Sales: Black November, Singles Day 11.11, Black Friday, Cyber Monday | Computed automatically every year + sale headlines |
| ⛽ Gas prices | Fuel-price headlines (Hebrew & English) + a reminder before the monthly price update on the 1st |

**Topics**: World · Israel (Israeli sources only: Times of Israel, JPost, Israel Hayom, Ynet, Maariv, Globes, Arutz 7) · War & Defense · Middle East · Tech · Cyber & Hacking · Science · Gaming · AI · XR/VR/AR · AI Use Cases.

An article can appear in several topics. Each topic has its own feeds, and keywords pull in matching stories from any feed. For example, a BBC story about a missile strike also shows up under War.

Hebrew headlines render right-to-left automatically. The UI has dark mode and works on mobile.

## Run it

```bash
npm install
cp .env.example .env     # optional: set your location, enable free local AI
npm start                # → http://localhost:3000
```

Requires Node 22+. Feeds refresh every 15 minutes.

## 100% free

No accounts, no API keys, no payments. RSS feeds, Open-Meteo and Hebcal are all free.

## Optional AI (free, runs on your computer)

Without AI, the site sorts articles into topics by keyword, and that works fine. If you want smarter tagging, you can run a free open model locally with [Ollama](https://ollama.com). It adds:
- more accurate topics, especially **AI Use Cases**, which keywords can't separate from AI funding or AI policy stories
- an importance score and a "Most important" sort
- one-line English summaries, including for Hebrew stories
- a "✨ Your briefing" digest every few hours

```bash
# install Ollama from https://ollama.com, then:
ollama pull gemma3:4b
# in .env:
OLLAMA_MODEL=gemma3:4b
```

Which model:
| Your computer | Model | Notes |
|---|---|---|
| 8 GB RAM, no GPU | `gemma3:1b` or `qwen3:1.7b` | Fast. Tags are OK, summaries are basic. |
| 16 GB RAM / any recent GPU / Apple M-series | **`gemma3:4b`** (recommended) | Good balance. Decent Hebrew. |
| 32 GB RAM or a 12 GB+ GPU | `gemma3:12b` or `qwen3:14b` | Best quality, slower. |

Tagging runs in the background, so the page never waits for the model. New articles get tags within a few minutes.

## Customize

Everything lives in `src/config.js`:
- `TOPICS`: add or remove feeds and keywords per topic
- `HEADLINE_ALERTS`: keywords that promote a headline into the alerts bar
- `SPECIAL_DAYS`: your own dates (birthdays, elections, launches…)
- `WEATHER_THRESHOLDS`, `LOCATION`

**Dead feed?** Open `health.json` (`http://localhost:3000/health.json` locally) to see which feeds fail, then replace the URL.

## API

`GET /data.json` (everything the page shows) · `GET /health.json` (feed status) · `POST /api/refresh` (local server only)

## Where to run it

### Option A: read it anywhere (free, GitHub Pages)

GitHub fetches the news every 30 minutes, rebuilds the site and publishes it at
`https://<your-username>.github.io/<repo-name>/`. It works on your phone from anywhere, even when your computer is off.

One-time setup:
1. Push this folder to a **public** GitHub repository. Pages and Actions are free for public repos.
2. In the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Optional: under **Settings → Secrets and variables → Actions → Variables**, add `LOCATION_NAME`, `LOCATION_LAT` and `LOCATION_LON` for your weather.
4. Go to **Actions → Update news site → Run workflow** for the first build.

Good to know:
- The code and the site are public. They contain only news headlines and your weather city.
- The local AI (Ollama) can't run on GitHub, so this version uses keyword sorting.
- GitHub can start scheduled runs a few minutes late.
- GitHub pauses scheduled runs after **60 days with no commits** and emails you first. Click "Enable workflow" in the Actions tab to resume.
- Feed problems show at `https://<your-username>.github.io/<repo-name>/health.json`.

### Option B: your own computer (adds the free local AI)

`npm start` and open `http://localhost:3000`. From your phone on the same Wi-Fi, use `http://<your-computer-ip>:3000`.

Build the static site locally: `npm run build` writes it to `dist/`.
