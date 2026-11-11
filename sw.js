// 案源隨身：離線快取。外殼（index.html 等）先用快取再背景更新；資料（data.enc、meta.json）先試網路，5 秒內沒回應或離線就用快取。
const CACHE = "dpm-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function networkFirst(req){
  return caches.open(CACHE).then(cache => {
    const net = fetch(req, {cache: "no-store"}).then(r => { if (r.ok) cache.put(req.url.split("?")[0], r.clone()); return r; });
    const timeout = new Promise(res => setTimeout(res, 5000));
    return Promise.race([net, timeout.then(() => cache.match(req.url.split("?")[0]))])
      .then(r => r || net)
      .catch(() => cache.match(req.url.split("?")[0]));
  });
}
function staleWhileRevalidate(req){
  return caches.open(CACHE).then(cache => cache.match(req, {ignoreSearch: true}).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
}

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (/\/(data\.enc|meta\.json)$/.test(u.pathname)) e.respondWith(networkFirst(e.request));
  else e.respondWith(staleWhileRevalidate(e.request));
});
