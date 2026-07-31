// Datenhaltung für Kunden, Push-Abos, Anfragen und das Kunden-Cockpit.
//
// Bewusst dateibasiert wie der Rest der Lead-API: JSON und JSONL auf dem
// Coolify-Volume. Bei einer Handvoll Kunden mit ein paar Anfragen am Tag ist
// eine Datenbank Ballast. Wenn es eng wird, ist der Umstieg ein Tausch dieser
// Datei — der Rest kennt nur die Funktionen hier.
//
// Ablage unter /data:
//   kunden.json   { [id]: {name, token, aktiv, angelegt} }
//   abos.jsonl    ein Datensatz je Anmeldung eines Geräts
//   leads.jsonl   Anfragen (bestehend, mit Feld `kunde`)
//   status.json   { [leadId]: {stufe, ts} } — Altbestand steht als {erledigt:true} drin
//   verlauf.jsonl Stufenwechsel und Notizen, nur angehängt — das ist die Kundenhistorie

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const DATA = process.env.DATA_DIR || '/data';
const F_KUNDEN = `${DATA}/kunden.json`;
const F_ABOS = `${DATA}/abos.jsonl`;
const F_LEADS = `${DATA}/leads.jsonl`;
const F_STATUS = `${DATA}/status.json`;
const F_VERLAUF = `${DATA}/verlauf.jsonl`;

try { mkdirSync(DATA, { recursive: true }); } catch {}

// ── kleine Helfer ────────────────────────────────────────────────────────────

function jsonLesen(pfad, standard) {
  try { return existsSync(pfad) ? JSON.parse(readFileSync(pfad, 'utf8')) : standard; }
  catch (e) { console.error(`LESEFEHLER ${pfad}`, e.message); return standard; }
}
// Erst daneben schreiben, dann umbenennen: Umbenennen ist atomar, ein Absturz
// mittendrin lässt die alte Datei stehen statt eine halbe zu hinterlassen.
// In status.json steht seit dem Cockpit der Arbeitsstand des Kunden — der ist
// nicht wiederherstellbar, wenn die Datei zerreißt.
function jsonSchreiben(pfad, wert) {
  const temp = `${pfad}.neu`;
  try {
    writeFileSync(temp, JSON.stringify(wert, null, 2));
    renameSync(temp, pfad);
    return true;
  } catch (e) { console.error(`SCHREIBFEHLER ${pfad}`, e.message); return false; }
}
function jsonlLesen(pfad) {
  if (!existsSync(pfad)) return [];
  try {
    return readFileSync(pfad, 'utf8').split('\n').filter(Boolean)
      .map((z) => { try { return JSON.parse(z); } catch { return null; } }).filter(Boolean);
  } catch (e) { console.error(`LESEFEHLER ${pfad}`, e.message); return []; }
}
function jsonlAnhaengen(pfad, satz) {
  try { appendFileSync(pfad, JSON.stringify(satz) + '\n'); return true; }
  catch (e) { console.error(`SCHREIBFEHLER ${pfad}`, e.message); return false; }
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
  jsonlAnhaengen(F_ABOS, {
    kunde, endpoint: abo.endpoint, keys: abo.keys,
    geraet: String(geraet).slice(0, 120), ts: new Date().toISOString(),
  });
}

/** Alle aktiven Abos eines Kunden — je Endpunkt nur der neueste Datensatz, entfernte gefiltert. */
export function abosVonKunde(kunde) {
  const alle = jsonlLesen(F_ABOS);
  const entfernt = new Set(alle.filter((a) => a.entfernt).map((a) => a.endpoint));
  const neueste = new Map();
  for (const a of alle) {
    if (a.kunde !== kunde || a.entfernt || entfernt.has(a.endpoint)) continue;
    neueste.set(a.endpoint, a);
  }
  return [...neueste.values()];
}

export function aboEntfernen(endpoint) {
  jsonlAnhaengen(F_ABOS, { endpoint, entfernt: true, ts: new Date().toISOString() });
}

// ── Stufen: der Weg von der Anfrage zum Auftrag ──────────────────────────────
//
// Die Kette bildet ab, was im Betrieb wirklich passiert. `abgesagt` steht
// bewusst NEBEN der Kette, nicht dahinter — es kann an jeder Stelle eintreten.
// `abgeschlossen` ist Altbestand aus der Zeit, als es nur einen Erledigt-Haken
// gab; es wird nie neu vergeben, aber auch nie stillschweigend umgedeutet.

export const STUFEN = [
  { id: 'neu', label: 'Neu', kurz: 'Neu' },
  { id: 'kontaktiert', label: 'Angerufen', kurz: 'Angerufen' },
  { id: 'besichtigt', label: 'Besichtigt', kurz: 'Besichtigt' },
  { id: 'angebot', label: 'Angebot raus', kurz: 'Angebot' },
  { id: 'auftrag', label: 'Auftrag', kurz: 'Auftrag' },
];

export const STUFEN_ENDE = [
  { id: 'abgesagt', label: 'Nichts draus geworden', kurz: 'Abgesagt' },
  { id: 'abgeschlossen', label: 'Abgeschlossen', kurz: 'Erledigt' },
];

const STUFEN_ALLE = [...STUFEN, ...STUFEN_ENDE];
const GUELTIG = new Set(STUFEN_ALLE.map((s) => s.id));
const ENDSTUFEN = new Set(['auftrag', 'abgesagt', 'abgeschlossen']);

export function stufeGueltig(s) { return GUELTIG.has(s); }
export function istEndstufe(s) { return ENDSTUFEN.has(s); }

function stufeVon(eintrag) {
  if (!eintrag) return 'neu';
  if (eintrag.stufe && GUELTIG.has(eintrag.stufe)) return eintrag.stufe;
  return eintrag.erledigt ? 'abgeschlossen' : 'neu';
}

// ── Kontakte: die Person hinter den Anfragen ─────────────────────────────────
//
// Zwei Anfragen derselben Person gehören zusammen, sonst steht die Notiz vom
// letzten Auftrag an der falschen Stelle. Zusammengeführt wird über die
// Telefonnummer — das Feld, das im Handwerk immer ausgefüllt ist.

function schluessel(lead) {
  // 0170…, 0049170… und +49170… sind dieselbe Nummer
  const tel = String(lead.telefon || '').replace(/\D/g, '').replace(/^(?:0049|49)/, '').replace(/^0/, '');
  if (tel.length >= 6) return `tel:${tel}`;
  const mail = String(lead.email || '').trim().toLowerCase();
  if (mail) return `mail:${mail}`;
  return `person:${String(lead.name || '').trim().toLowerCase()}|${String(lead.ort || '').trim().toLowerCase()}`;
}

/** Stabile Kennung des Kontakts. Gehasht, weil sie in Adressen steht — dort hat kein Klarname etwas verloren. */
export function kontaktId(lead) {
  return createHash('sha256').update(schluessel(lead)).digest('hex').slice(0, 16);
}

// ── Verlauf: Stufenwechsel + Notizen ─────────────────────────────────────────

function verlaufAnhaengen(satz) {
  return jsonlAnhaengen(F_VERLAUF, { ...satz, ts: new Date().toISOString() });
}

/** Notizen eines Kunden (gelöschte gefiltert), wahlweise auf einen Kontakt eingegrenzt. */
function notizenVonKunde(kunde, kontakt = null) {
  const weg = new Set();
  const notizen = [];
  for (const e of jsonlLesen(F_VERLAUF)) {
    if (e.typ === 'notiz-weg') { weg.add(e.id); continue; }
    if (e.typ !== 'notiz' || e.kunde !== kunde) continue;
    if (kontakt && e.kontakt !== kontakt) continue;
    notizen.push(e);
  }
  return notizen.filter((n) => !weg.has(n.id));
}

export function notizAnlegen(kunde, kontakt, text) {
  const sauber = String(text ?? '').trim().slice(0, 2000);
  if (!sauber) return null;
  const notiz = {
    typ: 'notiz', id: randomBytes(8).toString('hex'),
    kunde, kontakt, text: sauber, ts: new Date().toISOString(),
  };
  return jsonlAnhaengen(F_VERLAUF, notiz) ? notiz : null;
}

/** Löscht eine Notiz — aber nur die eigene. Fremde bleiben unberührt, auch bei geratener ID. */
export function notizLoeschen(kunde, id) {
  const treffer = jsonlLesen(F_VERLAUF).find((e) => e.typ === 'notiz' && e.id === id);
  if (!treffer || treffer.kunde !== kunde) return false;
  return verlaufAnhaengen({ typ: 'notiz-weg', id, kunde });
}

// ── Anfragen ─────────────────────────────────────────────────────────────────

export function leadSpeichern(lead) {
  const mitId = { id: randomBytes(8).toString('hex'), ...lead };
  jsonlAnhaengen(F_LEADS, mitId);
  return mitId;
}

/**
 * Anfragen aus der Zeit vor den IDs (Juli 2026) haben kein `id`-Feld. Ohne eine
 * bekämen sie `undefined` in die Adresse — der Stand ließe sich an ihnen nicht
 * setzen, und zwar still: die App zeigt sie normal an, nur das Antippen scheitert.
 * Die Ersatzkennung wird aus dem Inhalt abgeleitet, ist also stabil, ohne dass
 * das Journal umgeschrieben werden muss.
 */
function leadKennung(lead) {
  if (lead.id) return lead.id;
  return createHash('sha256')
    .update(`alt|${lead.ts}|${lead.name}|${lead.telefon}`)
    .digest('hex').slice(0, 16);
}

/** Anfragen eines Kunden, neueste zuerst — mit Stufe, Kontaktbezug und Notizzahl. */
export function leadsVonKunde(kunde, grenze = 200) {
  const status = jsonLesen(F_STATUS, {});
  const eigene = jsonlLesen(F_LEADS).filter((l) => (l.kunde || 'muster') === kunde);

  const proKontakt = new Map();
  for (const l of eigene) {
    const k = kontaktId(l);
    proKontakt.set(k, (proKontakt.get(k) || 0) + 1);
  }
  const notizzahl = new Map();
  for (const n of notizenVonKunde(kunde)) notizzahl.set(n.kontakt, (notizzahl.get(n.kontakt) || 0) + 1);

  // Nach Zeitstempel sortieren, nicht nach Dateireihenfolge: nachgetragene oder
  // eingespielte Anfragen stehen sonst an der falschen Stelle. Bei gleicher
  // Sekunde gewinnt der jüngere Eintrag, weil `reverse` stabil vorsortiert.
  return eigene.reverse()
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
    .slice(0, grenze).map((l) => {
    const id = leadKennung(l);
    const kontakt = kontaktId(l);
    const stufe = stufeVon(status[id]);
    return {
      id, ts: l.ts, name: l.name, telefon: l.telefon, ort: l.ort,
      nachricht: l.nachricht, email: l.email, rueckruf: l.rueckruf || '',
      kontakt, stufe,
      offen: !istEndstufe(stufe),
      erledigt: istEndstufe(stufe),          // ältere App-Fassungen lesen noch dieses Feld
      anfragenDesKontakts: proKontakt.get(kontakt) || 1,
      notizen: notizzahl.get(kontakt) || 0,
    };
  });
}

/** Setzt die Stufe einer Anfrage. Fremde Anfragen sind unerreichbar, auch mit geratener ID. */
export function stufeSetzen(kunde, leadId, stufe) {
  if (!stufeGueltig(stufe)) return { ok: false, fehler: 'unbekannte Stufe' };
  const lead = jsonlLesen(F_LEADS).find((l) => leadKennung(l) === leadId);
  if (!lead || (lead.kunde || 'muster') !== kunde) return { ok: false, fehler: 'unbekannte Anfrage' };

  const alle = jsonLesen(F_STATUS, {});
  const vorher = stufeVon(alle[leadId]);
  if (vorher === stufe) return { ok: true, stufe };

  alle[leadId] = { stufe, ts: new Date().toISOString() };
  if (!jsonSchreiben(F_STATUS, alle)) return { ok: false, fehler: 'konnte nicht gespeichert werden' };
  verlaufAnhaengen({ typ: 'stufe', kunde, kontakt: kontaktId(lead), lead: leadId, von: vorher, nach: stufe });
  return { ok: true, stufe };
}

/**
 * Alles zu einem Kontakt: Stammdaten aus der neuesten Anfrage, seine Anfragen,
 * und der zusammengeführte Verlauf aus Anfragen, Stufenwechseln und Notizen.
 * Liefert null, wenn der Kontakt diesem Kunden nicht gehört — damit ist die
 * Mandantentrennung dieselbe Prüfung wie „gibt es den überhaupt".
 */
export function kontaktDetail(kunde, id) {
  const anfragen = leadsVonKunde(kunde, 1000).filter((a) => a.kontakt === id);
  if (!anfragen.length) return null;

  const neueste = anfragen[0];
  const aelteste = anfragen[anfragen.length - 1];
  const wechsel = jsonlLesen(F_VERLAUF)
    .filter((e) => e.typ === 'stufe' && e.kunde === kunde && e.kontakt === id);

  const verlauf = [
    ...anfragen.map((a) => ({ typ: 'anfrage', ts: a.ts, lead: a.id, text: a.nachricht })),
    ...wechsel.map((e) => ({ typ: 'stufe', ts: e.ts, von: e.von, nach: e.nach })),
    ...notizenVonKunde(kunde, id).map((n) => ({ typ: 'notiz', ts: n.ts, id: n.id, text: n.text })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1));

  return {
    id,
    name: neueste.name, telefon: neueste.telefon, ort: neueste.ort, email: neueste.email,
    seit: aelteste.ts,
    anfragen,
    verlauf,
  };
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
        const anfragen = leadsVonKunde(id, 1000);
        const offen = anfragen.filter((a) => a.offen).length;
        console.log(`${id.padEnd(18)} ${k.name.padEnd(28)} ${String(abosVonKunde(id).length).padStart(2)} Gerät(e)  ` +
          `${String(anfragen.length).padStart(3)} Anfragen (${offen} offen)  ${k.aktiv ? '' : '(inaktiv)'}`);
      }
    }
  } else {
    console.log('Befehle: --neu <id> "<Name>" · --liste');
  }
}
