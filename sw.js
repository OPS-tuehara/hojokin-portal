const CACHE = "ops-gss-v3";
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(["./", "./index.html", "./icon-192.png", "./icon-512.png", "./manifest.json"])
  ));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// ネットワーク優先（毎月の更新を確実に反映）、オフライン時はキャッシュ
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request))
  );
});

// ===== プッシュ通知(閉じていても通知+アイコンバッヂ) =====
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil((async () => {
    try { if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(d.count || 1); } catch (_) {}
    await self.registration.showNotification(d.title || "OPS GSS 新着情報", {
      body: d.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: { url: d.url || "./" }
    });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow((e.notification.data && e.notification.data.url) || "./"));
});
