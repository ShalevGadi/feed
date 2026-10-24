// Weather location: the default from config.js, or a city you pick (saved in this browser).
import { DEFAULT_LOCATION } from "./config.js";

const KEY = "location";

export function getLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.lat != null) return saved;
  } catch {}
  return DEFAULT_LOCATION;
}

/** Look up a city with Open-Meteo's free geocoding and save it. */
export async function setLocationByName(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const place = (await res.json()).results?.[0];
  if (!place) throw new Error(`Couldn't find "${name}"`);
  const loc = { name: place.name, lat: place.latitude, lon: place.longitude, timezone: place.timezone || DEFAULT_LOCATION.timezone };
  try { localStorage.setItem(KEY, JSON.stringify(loc)); } catch {}
  return loc;
}
