// Makes the site installable and usable offline: the page and the last news
// you loaded are kept, and shown when there's no connection.
const CACHE = "my-news-v1";
const SHELL = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "js/app.js", "js/config.js", "js/articles.js", "js/alerts.js", "js/location.js", "js/i18n.js", "js/group.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Our own files and the news API: try the network first (always fresh),
// fall back to the saved copy when offline. Other sites are left alone.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html"))),
  );
});
