// Lead-API für muster.k-aizen.de (Einstiegsprodukt-Demo „Meisterseite").
// Nimmt Formular-POSTs an und liefert den ⭐-Demo-Moment: Sofort-Ping aufs Handy
// via Discord-Webhook MIT @Mention (Server-Default ist „nur @mentions" — ohne
// Mention bleibt das Handy stumm!). Dazu JSONL-Log (Quelle der Wahrheit) und
// Resend-Mail als Backup. Bewusst dependency-frei (Node 22 http).
//
// Env: DISCORD_WEBHOOK_URL (der ⭐-Ping), DISCORD_MENTION_USER_ID,
//      RESEND_API_KEY, LEAD_TO, RESEND_FROM, PORT (default 8080)
// Persistenz: /data/leads.jsonl (Coolify-Volume).

import http from 'node:http';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pushSenden } from './push.mjs';
import {
  kundeAusToken, aboSpeichern, abosVonKunde, aboEntfernen,
  leadSpeichern, leadsVonKunde, stufeSetzen, kundenAlle,
  kontaktDetail, notizAnlegen, notizLoeschen, STUFEN, STUFEN_ENDE,
} from './kunden.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(HIER, 'app');

const PORT = Number(process.env.PORT || 8080);
const LEAD_TO = process.env.LEAD_TO || 'ben.zirngibl@gmail.com';
const RESEND_FROM = process.env.RESEND_FROM || 'Meisterseite Demo <kontakt@k-aizen.de>';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';
const MENTION_ID = process.env.DISCORD_MENTION_USER_ID || '99982972236607488';
const SITE = 'https://muster.k-aizen.de';
const DATA_DIR = process.env.DATA_DIR || '/data';
const LOG = `${DATA_DIR}/leads.jsonl`;

try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

// naive Rate-Limit: max 10 Anfragen/Stunde/IP (reicht gegen Formular-Spam-Wellen)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 10;
}

function esc(s) {
  return String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

// ⭐ Der Demo-Shot: Push-Benachrichtigung aufs Handy. Discord zeigt in der
// Push-Vorschau den content-Text — der muss allein schon „verkaufen":
// Name, Nummer, Anliegen auf einen Blick.
async function pingDiscord(lead) {
  if (!DISCORD_WEBHOOK) return { ok: false, error: 'DISCORD_WEBHOOK_URL fehlt' };
  const kurz = lead.nachricht.length > 120 ? lead.nachricht.slice(0, 117) + '…' : lead.nachricht;
  const body = {
    username: 'Meisterseite',
    content: `<@${MENTION_ID}> 🔔 **Neue Anfrage über Ihre Website**\n**${lead.name}** · ${lead.telefon} · ${lead.ort}\n„${kurz}"`,
    allowed_mentions: { users: [MENTION_ID] },
    embeds: [
      {
        color: 0xc2410c,
        fields: [
          { name: 'Name', value: lead.name || '—', inline: true },
          { name: 'Telefon', value: lead.telefon || '—', inline: true },
          { name: 'Ort', value: lead.ort || '—', inline: true },
          { name: 'Anliegen', value: lead.nachricht || '—' },
          { name: 'E-Mail', value: lead.email || '—', inline: true },
          { name: 'Quelle', value: lead.quelle || 'muster-website', inline: true },
        ],
        footer: { text: 'muster.k-aizen.de — Formular → Handy in Sekunden' },
        timestamp: lead.ts,
      },
    ],
  };
  try {
    const r = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'meisterseite-lead-api' },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, body: r.ok ? undefined : await r.text() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendMail(lead) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY fehlt' };
  const body = {
    from: RESEND_FROM,
    to: [LEAD_TO],
    subject: `🟠 Muster-Website-Anfrage: ${lead.name} — ${lead.ort}`,
    html: `<h2>Neue Anfrage über muster.k-aizen.de</h2>
<table cellpadding="6" style="border-collapse:collapse">
<tr><td><b>Name</b></td><td>${esc(lead.name)}</td></tr>
<tr><td><b>Telefon</b></td><td>${esc(lead.telefon)}</td></tr>
<tr><td><b>Ort</b></td><td>${esc(lead.ort)}</td></tr>
<tr><td><b>Anliegen</b></td><td>${esc(lead.nachricht)}</td></tr>
<tr><td><b>E-Mail</b></td><td>${esc(lead.email || '—')}</td></tr>
<tr><td><b>Quelle</b></td><td>${esc(lead.quelle || 'muster-website')}</td></tr>
<tr><td><b>Zeit</b></td><td>${lead.ts}</td></tr>
</table>
<p style="color:#666">Geloggt in leads.jsonl. Einwilligung: ${lead.einwilligung ? 'JA' : 'NEIN'}.</p>`,
  };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, body: r.ok ? undefined : await r.text() };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Anfragen-App: Push aufs Kundenhandy ──────────────────────────────────────
// Der Push transportiert bewusst KEINE Inhalte — nur das Signal. Details holt
// die App danach über einen authentifizierten Aufruf. Damit sehen Apple und
// Google nie, worum es in der Anfrage geht.

async function pingApp(kunde, leadId) {
  const abos = abosVonKunde(kunde);
  if (!abos.length) return { ok: false, geraete: 0, grund: 'kein Gerät angemeldet' };

  const nutzlast = JSON.stringify({
    titel: 'Neue Anfrage',
    text: 'Jemand hat sich über Ihre Website gemeldet.',
    id: leadId,
  });

  let zugestellt = 0;
  for (const abo of abos) {
    const r = await pushSenden({ endpoint: abo.endpoint, keys: abo.keys }, nutzlast);
    if (r.ok) zugestellt++;
    else if (r.weg) { aboEntfernen(abo.endpoint); console.log(`ABO ENTFERNT ${abo.endpoint.slice(0, 60)}…`); }
    else console.error('PUSH-FEHLER', r.status, r.fehler || '');
  }
  return { ok: zugestellt > 0, geraete: abos.length, zugestellt };
}

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };

function appDateiAusliefern(pfad, res, nurKopf = false) {
  // Verzeichniswechsel unterbinden — nur Dateien unterhalb von app/
  const datei = join(APP_DIR, pfad.replace(/^\/app\/?/, '') || 'index.html');
  if (!datei.startsWith(APP_DIR) || !existsSync(datei)) return false;
  const typ = TYPEN[extname(datei)] || 'application/octet-stream';
  // Service Worker und Einstiegsseite nie aus dem Zwischenspeicher, sonst hängen Kunden auf
  // alten Fassungen. Die übrigen Dateien holt der Service Worker beim Einbau selbst frisch.
  const cache = /sw\.js$|\.html$/.test(datei) ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': typ, 'Cache-Control': cache, 'Service-Worker-Allowed': '/app/' });
  res.end(nurKopf ? undefined : readFileSync(datei));
  return true;
}

function zugang(req) {
  return kundeAusToken(req.headers['x-zugang'] || '');
}
function jsonAntwort(res, code, wert) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(wert));
}
function koerperLesen(req) {
  return new Promise((auf) => {
    let roh = '';
    req.on('data', (c) => { roh += c; if (roh.length > 20_000) req.destroy(); });
    req.on('end', () => { try { auf(JSON.parse(roh || '{}')); } catch { auf({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Prüfwerkzeuge und Zwischenspeicher fragen mit HEAD an — das ist ein GET ohne Rumpf,
  // kein unbekanntes Verfahren. Vorher lief es in den 404 und sah aus wie ein Ausfall.
  const nurKopf = req.method === 'HEAD';
  const holt = req.method === 'GET' || nurKopf;

  if (holt && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(nurKopf ? undefined : JSON.stringify({
      ok: true,
      discord: !!DISCORD_WEBHOOK,
      resend: !!process.env.RESEND_API_KEY,
      push: !!process.env.VAPID_PUBLIC_KEY,
      kunden: Object.keys(kundenAlle()).length,
    }));
  }

  // ── App-Dateien ──
  if (holt && (url.pathname === '/app' || url.pathname.startsWith('/app/'))) {
    if (url.pathname === '/app') { res.writeHead(302, { Location: '/app/' }); return res.end(); }
    if (appDateiAusliefern(url.pathname, res, nurKopf)) return;
    res.writeHead(404); return res.end('nicht gefunden');
  }

  // ── App-Schnittstelle ──
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/vapid' && req.method === 'GET') {
      return jsonAntwort(res, 200, { publicKey: process.env.VAPID_PUBLIC_KEY || '' });
    }

    const kunde = zugang(req);
    if (!kunde) return jsonAntwort(res, 401, { fehler: 'kein gültiger Zugang' });

    if (url.pathname === '/api/anfragen' && req.method === 'GET') {
      return jsonAntwort(res, 200, {
        betrieb: kundenAlle()[kunde]?.name || '',
        stufen: STUFEN,
        stufenEnde: STUFEN_ENDE,
        anfragen: leadsVonKunde(kunde),
      });
    }

    if (url.pathname === '/api/abo' && req.method === 'POST') {
      const b = await koerperLesen(req);
      if (!b.abo?.endpoint || !b.abo?.keys?.p256dh || !b.abo?.keys?.auth) {
        return jsonAntwort(res, 400, { fehler: 'Abo unvollständig' });
      }
      aboSpeichern(kunde, b.abo, b.geraet);
      console.log(`ABO NEU kunde=${kunde} geräte=${abosVonKunde(kunde).length}`);
      return jsonAntwort(res, 200, { ok: true });
    }

    // Stufe einer Anfrage setzen. `erledigt` ist der Weg der ersten App-Fassung —
    // sie kann noch im Zwischenspeicher eines Geräts liegen und wird nicht umgedeutet.
    const status = url.pathname.match(/^\/api\/anfragen\/([a-f0-9]{16})\/status$/);
    if (status && req.method === 'POST') {
      const b = await koerperLesen(req);
      const stufe = typeof b.stufe === 'string' ? b.stufe
        : (b.erledigt === true ? 'abgeschlossen' : b.erledigt === false ? 'neu' : null);
      // „abgeschlossen" ist Altbestand — über das Feld `stufe` darf es niemand neu vergeben
      if (!stufe || b.stufe === 'abgeschlossen') return jsonAntwort(res, 400, { fehler: 'Stufe fehlt' });
      const r = stufeSetzen(kunde, status[1], stufe);
      return jsonAntwort(res, r.ok ? 200 : 404, r);
    }

    const kontakt = url.pathname.match(/^\/api\/kontakt\/([a-f0-9]{16})$/);
    if (kontakt && req.method === 'GET') {
      const d = kontaktDetail(kunde, kontakt[1]);
      return d ? jsonAntwort(res, 200, d) : jsonAntwort(res, 404, { fehler: 'unbekannter Kontakt' });
    }

    const notizNeu = url.pathname.match(/^\/api\/kontakt\/([a-f0-9]{16})\/notiz$/);
    if (notizNeu && req.method === 'POST') {
      // Erst die Zugehörigkeit prüfen: wer den Kontakt nicht sehen darf, kann ihn auch nicht beschriften
      if (!kontaktDetail(kunde, notizNeu[1])) return jsonAntwort(res, 404, { fehler: 'unbekannter Kontakt' });
      const b = await koerperLesen(req);
      const notiz = notizAnlegen(kunde, notizNeu[1], b.text);
      return notiz ? jsonAntwort(res, 200, { ok: true, notiz }) : jsonAntwort(res, 400, { fehler: 'leere Notiz' });
    }

    const notizWeg = url.pathname.match(/^\/api\/kontakt\/[a-f0-9]{16}\/notiz\/([a-f0-9]{16})$/);
    if (notizWeg && req.method === 'DELETE') {
      const ok = notizLoeschen(kunde, notizWeg[1]);
      return jsonAntwort(res, ok ? 200 : 404, ok ? { ok: true } : { fehler: 'unbekannte Notiz' });
    }

    return jsonAntwort(res, 404, { fehler: 'unbekannt' });
  }

  if (req.method === 'POST' && url.pathname === '/anfrage') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '?';
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 10_000) req.destroy(); });
    req.on('end', async () => {
      const p = new URLSearchParams(raw);
      const lead = {
        ts: new Date().toISOString(),
        // `kunde` steuert, in welcher App die Anfrage landet. Fehlt es, ist es die Demo.
        kunde: (p.get('kunde') || 'muster').slice(0, 40).replace(/[^a-z0-9_-]/gi, ''),
        name: (p.get('name') || '').slice(0, 120),
        telefon: (p.get('telefon') || '').slice(0, 40),
        ort: (p.get('ort') || '').slice(0, 80),
        nachricht: (p.get('nachricht') || '').slice(0, 1000),
        email: (p.get('email') || '').slice(0, 200),
        // Terminwunsch statt Kalender — z.B. „Dienstag vormittag"
        rueckruf: (p.get('rueckruf') || '').slice(0, 80),
        quelle: (p.get('quelle') || '').slice(0, 120),
        einwilligung: p.get('einwilligung') === 'on',
        ip,
      };
      const honeypot = (p.get('website') || '').trim(); // Bots füllen das versteckte Feld

      // Bot / Rate-Limit / Pflichtfelder → freundlich behandeln, nichts verraten
      const invalid = !lead.name || !lead.telefon || !lead.ort || !lead.nachricht || !lead.einwilligung;
      if (honeypot || limited(ip)) {
        res.writeHead(303, { Location: `${SITE}/anfrage-erhalten/` });
        return res.end();
      }
      if (invalid) {
        res.writeHead(303, { Location: `${SITE}/?fehler=felder#anfrage` });
        return res.end();
      }

      // 1) Lead speichern (Quelle der Wahrheit) — vergibt die ID
      let gespeichert;
      try { gespeichert = leadSpeichern(lead); }
      catch (e) { console.error('SPEICHER-FEHLER', e); gespeichert = { ...lead, id: null }; }

      // 2) ⭐ Push in die Anfragen-App des Kunden — der eigentliche Zustellweg
      const app = await pingApp(lead.kunde, gespeichert.id);

      // 3) Discord-Ping (Demo-Moment im Verkauf; bei echten Kunden nur wenn eingerichtet)
      const ping = await pingDiscord(lead);
      if (!ping.ok) console.error('DISCORD-FEHLER', JSON.stringify(ping));

      // 4) Mail als Rückfallebene — greift auch, wenn der Kunde die App nie installiert
      const mail = await sendMail(lead);
      if (!mail.ok) console.error('MAIL-FEHLER', JSON.stringify(mail));

      console.log(`LEAD ${lead.ts} kunde=${lead.kunde} ${lead.ort} ${lead.name} ` +
        `app=${app.zugestellt ?? 0}/${app.geraete} discord=${ping.ok} mail=${mail.ok}`);

      res.writeHead(303, { Location: `${SITE}/anfrage-erhalten/` });
      return res.end();
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, () => console.log(`lead-api auf :${PORT}, Leads → ${LOG}, Ping → Discord${DISCORD_WEBHOOK ? '' : ' (FEHLT!)'}, Mail → ${LEAD_TO}`));
