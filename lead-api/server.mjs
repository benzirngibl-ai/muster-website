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
import { appendFileSync, mkdirSync } from 'node:fs';

const PORT = Number(process.env.PORT || 8080);
const LEAD_TO = process.env.LEAD_TO || 'ben.zirngibl@gmail.com';
const RESEND_FROM = process.env.RESEND_FROM || 'Meisterseite Demo <kontakt@k-aizen.de>';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || '';
const MENTION_ID = process.env.DISCORD_MENTION_USER_ID || '99982972236607488';
const SITE = 'https://muster.k-aizen.de';
const DATA_DIR = '/data';
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, discord: !!DISCORD_WEBHOOK, resend: !!process.env.RESEND_API_KEY }));
  }

  if (req.method === 'POST' && url.pathname === '/anfrage') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '?';
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 10_000) req.destroy(); });
    req.on('end', async () => {
      const p = new URLSearchParams(raw);
      const lead = {
        ts: new Date().toISOString(),
        name: (p.get('name') || '').slice(0, 120),
        telefon: (p.get('telefon') || '').slice(0, 40),
        ort: (p.get('ort') || '').slice(0, 80),
        nachricht: (p.get('nachricht') || '').slice(0, 1000),
        email: (p.get('email') || '').slice(0, 200),
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

      // 1) Lead loggen (Quelle der Wahrheit)
      try { appendFileSync(LOG, JSON.stringify(lead) + '\n'); } catch (e) { console.error('LOG-FEHLER', e); }

      // 2) ⭐ Discord-Ping aufs Handy (der Demo-Moment)
      const ping = await pingDiscord(lead);
      if (!ping.ok) console.error('DISCORD-FEHLER', JSON.stringify(ping));

      // 3) Mail als Backup (Fehler verliert keinen Lead)
      const mail = await sendMail(lead);
      if (!mail.ok) console.error('MAIL-FEHLER', JSON.stringify(mail));

      console.log(`LEAD ${lead.ts} ${lead.ort} ${lead.name} discord=${ping.ok} mail=${mail.ok}`);

      res.writeHead(303, { Location: `${SITE}/anfrage-erhalten/` });
      return res.end();
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, () => console.log(`lead-api auf :${PORT}, Leads → ${LOG}, Ping → Discord${DISCORD_WEBHOOK ? '' : ' (FEHLT!)'}, Mail → ${LEAD_TO}`));
