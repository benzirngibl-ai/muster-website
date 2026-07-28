// Datenhaltung für Kunden, Push-Abos und Anfragen.
//
// Bewusst dateibasiert wie der Rest der Lead-API: JSON und JSONL auf dem
// Coolify-Volume. Bei einer Handvoll Kunden mit ein paar Anfragen am Tag ist
// eine Datenbank Ballast. Wenn es eng wird, ist der Umstieg ein Tausch dieser
// Datei — der Rest kennt nur die Funktionen hier.
//
// Ablage unter /data:
//   kunden.json   { [id]: {name, token, aktiv, angelegt} }
//   abos.jsonl    ein Datensatz je Anmeldung eines Geräts
//   leads.jsonl   Anfragen (bestehend, jetzt mit Feld `kunde`)
//   status.json   { [leadId]: {erledigt, ts} }

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const DATA = process.env.DATA_DIR || '/data';
const F_KUNDEN = `${DATA}/kunden.json`;
const F_ABOS = `${DATA}/abos.jsonl`;
const F_LEADS = `${DATA}/leads.jsonl`;
const F_STATUS = `${DATA}/status.json`;

try { mkdirSync(DATA, { recursive: true }); } catch {}

// ── kleine Helfer ────────────────────────────────────────────────────────────

function jsonLesen(pfad, standard) {
  try { return existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : standard; }
  catch (e) { console.error(`LESEFEHLER ${pfad}`, e.message); return standard; }
}
function jsonSchreiben(pfad, wert) {
  try { writeFileSync(pfad, JSON.stringify(wert, null, 2)); return true; }
  catch (e) { console.error(`SCHREIBFEHLER ${pfad}`, e.message); return false; }
}
function jsonlLesen(pfad) {
  if (!existsSync(pfad)) return [];
  try {
    return readFileSync(pfad, 'utf8').split('\n').filter(Boolean)
      .map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
  } catch (e) { console.error(`LESEFEHLER ${pfad}`, e.message); return []; }
}

// ── Kunden ───────────────────────────────────────────────────────────────────

export function kundenAlle() { return jsonLesen(F_KUNDEN, {}); }

export function kundeAnlegen(id, name) {
  const alle = kundenAlle();
  if (alle[id]) throw new Error(`Kunde "${id}" existiert bereits`);
  alle[id] = {
    name,
    token: randomBytes(24).toString('base64url'),
    aktiv: true,
    angelegt: new Date().toISOString(),
  };
  jsonSchreiben(F_KUNDEN, alle);
  return { id, ...alle[id] };
}

/**
 * Prüft einen Zugangstoken und liefert die Kunden-ID.
 * Vergleich in konstanter Zeit, damit sich der Token nicht Zeichen für Zeichen erraten lässt.
 */
export function kundeAusToken(token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const alle = kundenAlle();
  const geboten = Buffer.from(token);
  for (const [id, k] of Object.entries(alle)) {
    if (!k.aktiv) continue;
    const erwartet = Buffer.from(k.token);
    if (erwartet.length === geboten.length && timingSafeEqual(erwartet, geboten)) return id;
  }
  return null;
}

// ── Push-Abos ────────────────────────────────────────────────────────────────

/** Meldet ein Gerät an. Mehrfachanmeldung desselben Endpunkts ist gutartig — der letzte gewinnt. */
export function aboSpeichern(kunde, abo, geraet = '') {
  appendFileSync(F_ABOS, JSON.stringify({
    kunde, endpoint: abo.endpoint, keys: abo.keys,
    geraet: String(geraet).slice(0, 120), ts: new Date().toISOString(),
  }) + '\n');
}

/** Alle aktiven Abos eines Kunden — je Endpunkt nur der neueste Datensatz, entfernte gefiltert. */
export function abosVonKunde(kunde) {
  const entfernt = new Set(jsonlLesen(F_ABOS).filter((a) => a.entfernt).map((a) => a.endpoint));
  const neueste = new Map();
  for (const a of jsonlLesen(F_ABOS)) {
    if (a.kunde !== kunde || a.entfernt || entfernt.has(a.endpoint)) continue;
    neueste.set(a.endpoint, a);
  }
  return [...neueste.values()];
}

export function aboEntfernen(endpoint) {
  appendFileSync(F_ABOS, JSON.stringify({ endpoint, entfernt: true, ts: new Date().toISOString() }) + '\n');
}

// ── Anfragen ─────────────────────────────────────────────────────────────────

export function leadSpeichern(lead) {
  const mitId = { id: randomBytes(8).toString('hex'), ...lead };
  appendFileSync(F_LEADS, JSON.stringify(mitId) + '\n');
  return mitId;
}

/** Anfragen eines Kunden, neueste zuerst, mit Erledigt-Status angereichert. */
export function leadsVonKunde(kunde, grenze = 100) {
  const status = jsonLesen(F_STATUS, {});
  return jsonlLesen(F_LEADS)
    .filter((l) => (l.kunde || 'muster') === kunde)
    .reverse()
    .slice(0, grenze)
    .map((l) => ({
      id: l.id, ts: l.ts, name: l.name, telefon: l.telefon, ort: l.ort,
      nachricht: l.nachricht, email: l.email,
      rueckruf: l.rueckruf || '',
      erledigt: !!status[l.id]?.erledigt,
    }));
}

export function leadStatusSetzen(id, erledigt) {
  const status = jsonLesen(F_STATUS, {});
  status[id] = { erledigt: !!erledigt, ts: new Date().toISOString() };
  return jsonSchreiben(F_STATUS, status);
}

// ── Verwaltung über die Kommandozeile ────────────────────────────────────────
// node kunden.mjs --neu <id> "<Name>"     legt einen Kunden an und zeigt seinen Zugangslink
// node kunden.mjs --liste                 zeigt alle Kunden mit Gerätezahl

if (process.argv[1]?.endsWith('kunden.mjs')) {
  const [, , befehl, ...rest] = process.argv;
  const basis = process.env.APP_URL || 'https://muster-api.k-aizen.de/app';

  if (befehl === '--neu') {
    const [id, ...name] = rest;
    if (!id) { console.error('Aufruf: node kunden.mjs --neu <id> "<Name>"'); process.exit(2); }
    try {
      const k = kundeAnlegen(id, name.join(' ') || id);
      console.log(`Kunde "${k.name}" angelegt.\n`);
      console.log(`Zugangslink — diesen Link bekommt der Kunde aufs Handy:\n  ${basis}/?t=${k.token}\n`);
      console.log('Anleitung für den Kunden: Link in Safari bzw. Chrome öffnen,');
      console.log('zum Startbildschirm hinzufügen, App antippen, Benachrichtigungen erlauben.');
    } catch (e) { console.error(e.message); process.exit(1); }

  } else if (befehl === '--liste') {
    const alle = kundenAlle();
    const ids = Object.keys(alle);
    if (!ids.length) {
      console.log('Noch keine Kunden angelegt.');
    } else {
      for (const id of ids) {
        const k = alle[id];
        console.log(`${id.padEnd(18)} ${k.name.padEnd(28)} ${abosVonKunde(id).length} Gerät(e)  ${k.aktiv ? '' : '(inaktiv)'}`);
      }
    }
  } else {
    console.log('Befehle: --neu <id> "<Name>" · --liste');
  }
}
