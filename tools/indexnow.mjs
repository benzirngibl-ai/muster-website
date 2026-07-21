#!/usr/bin/env node
// IndexNow-Submit (Muster wie asbest-entfernen.de): meldet alle Site-URLs an
// Bing/Yandex/Seznam — und damit an den ChatGPT-Suchindex (GEO-Kanal).
// Google unterstützt IndexNow nicht — dort läuft die Entdeckung über Sitemap + GSC
// (Ben-Klicks: rank-rent/BLUEPRINT-ben-klicks-neue-nische.md).
//
// KUNDEN-ROLLOUT: HOST tauschen + neuen KEY erzeugen (`openssl rand -hex 16`),
// Key-Datei public/<KEY>.txt anlegen (Inhalt = der Key; öffentlich, kein Secret).
// Nutzung: npm run build && node tools/indexnow.mjs — NUR im Kunden-Modus
// (config indexable=true) sinnvoll; die Demo ist bewusst noindex.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KEY = '1f1ae4a3ae2a3162cdc78fea679eee41';
const HOST = 'muster.k-aizen.de';
const SITEMAP = fileURLToPath(new URL('../dist/sitemap-0.xml', import.meta.url));

const xml = readFileSync(SITEMAP, 'utf8');
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) {
  console.error('Keine URLs in der Sitemap — build gelaufen?');
  process.exit(1);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: ${urls.length} URLs gemeldet → HTTP ${res.status} ${res.status === 200 || res.status === 202 ? '✅' : '❌ ' + (await res.text()).slice(0, 200)}`);
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
