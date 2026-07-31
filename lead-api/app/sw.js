// Service Worker der Anfragen-App.
//
// Zwei Aufgaben:
//   1. Push entgegennehmen und eine Benachrichtigung zeigen
//   2. Die App-Hülle offline verfügbar halten
//
// Der Push enthält bewusst KEINE personenbezogenen Daten — nur "es gibt eine
// neue Anfrage". Name und Anliegen holt die App erst beim Öffnen vom Server.
// Damit sehen Apple und Google nie, worum es geht.

const CACHE = 'anfragen-v2';
const HUELLE = ['./', './app.css', './app.js', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  // Bewusst mit `reload`: sonst legt der neue Service Worker die alte, noch im
  // Browser-Zwischenspeicher liegende Fassung ab — und die App bleibt stehen.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(HUELLE.map((u) =>
        fetch(u, { cache: 'reload' }).then((r) => (r.ok ? c.put(u, r) : null)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Hülle aus dem Zwischenspeicher, Daten immer frisch vom Server
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then((treffer) => treffer || fetch(e.request))
  );
});

self.addEventListener('push', (e) => {
  // Safari verlangt, dass JEDER Push eine Benachrichtigung zeigt. Deshalb steht
  // hier ein Standardtext bereit, falls die Nutzlast fehlt oder unlesbar ist —
  // ohne Anzeige kann iOS die Berechtigung wieder entziehen.
  let daten = {};
  try { daten = e.data ? e.data.json() : {}; } catch { daten = {}; }

  const titel = daten.titel || 'Neue Anfrage';
  const text = daten.text || 'Jemand hat sich über Ihre Website gemeldet.';

  e.waitUntil(
    self.registration.showNotification(titel, {
      body: text,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: daten.id || 'anfrage',
      renotify: true,
      requireInteraction: false,
      data: { id: daten.id || null },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      for (const f of fenster) {
        if ('focus' in f) { f.postMessage({ typ: 'neu-laden' }); return f.focus(); }
      }
      return self.clients.openWindow('./');
    })
  );
});
