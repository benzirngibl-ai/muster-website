// Prüfung des Kunden-Cockpits — Datenschicht und Schnittstelle, gegen ein
// frisches Verzeichnis unter /tmp. Läuft ohne Fremdpakete und ohne Server-Zugriff:
//
//   node pruefung-cockpit.mjs
//
// Diese Datei wird bewusst NICHT ins Container-Abbild kopiert (siehe Dockerfile).

import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATA = mkdtempSync(join(tmpdir(), 'cockpit-'));
process.env.DATA_DIR = DATA;

const {
  kundeAnlegen, kundeAusToken, leadSpeichern, leadsVonKunde,
  stufeSetzen, kontaktId, kontaktDetail, notizAnlegen, notizLoeschen,
} = await import('./kunden.mjs');

let gruen = 0;
const rot = [];

function pruefe(name, bedingung, details = '') {
  if (bedingung) { gruen++; console.log(`  ✓ ${name}`); }
  else { rot.push(name); console.log(`  ✗ ${name}${details ? ` — ${details}` : ''}`); }
}

function anfrage(kunde, felder) {
  return leadSpeichern({
    ts: new Date(Date.now() - (felder.vorMin || 0) * 60000).toISOString(),
    kunde, name: 'Ohne Namen', telefon: '', ort: '', nachricht: '', email: '', rueckruf: '',
    einwilligung: true, ...felder,
  });
}

// ── Datenschicht ─────────────────────────────────────────────────────────────

console.log('\nDatenschicht');

const dach = kundeAnlegen('dachdecker', 'Dachdeckerei Brandner');
const elek = kundeAnlegen('elektro', 'Elektro Meier');

pruefe('Token führt zum eigenen Kunden', kundeAusToken(dach.token) === 'dachdecker');
pruefe('fremder Token führt nicht zum Kunden', kundeAusToken('abc') === null);

const a1 = anfrage('dachdecker', { name: 'Anna Weber', telefon: '0170 1234567', ort: 'Fürth', nachricht: 'Ziegel lose', vorMin: 300 });
const a2 = anfrage('dachdecker', { name: 'Anna Weber', telefon: '+49 170 1234567', ort: 'Fürth', nachricht: 'Und die Rinne', vorMin: 100 });
const a3 = anfrage('dachdecker', { name: 'Bernd Kunz', telefon: '0911 998877', ort: 'Nürnberg', nachricht: 'Dachfenster', vorMin: 50 });
const a4 = anfrage('elektro', { name: 'Clara Roth', telefon: '0170 5556666', ort: 'Erlangen', nachricht: 'Sicherung fliegt' });

pruefe('drei Schreibweisen derselben Nummer = ein Kontakt',
  kontaktId({ telefon: '0170 1234567' }) === kontaktId({ telefon: '+49 170 1234567' })
  && kontaktId({ telefon: '0049170 1234567' }) === kontaktId({ telefon: '0170/123 45 67' }));
pruefe('andere Nummer = anderer Kontakt', kontaktId({ telefon: '0170 1234567' }) !== kontaktId({ telefon: '0911 998877' }));
pruefe('ohne Telefon greift die E-Mail',
  kontaktId({ email: 'A@Weber.de' }) === kontaktId({ email: 'a@weber.de ' }));
pruefe('ohne Telefon und Mail greifen Name und Ort',
  kontaktId({ name: 'Anna Weber', ort: 'Fürth' }) === kontaktId({ name: 'anna weber', ort: 'fürth' }));

let liste = leadsVonKunde('dachdecker');
pruefe('nur eigene Anfragen in der Liste', liste.length === 3 && !liste.some((l) => l.name === 'Clara Roth'));
pruefe('neueste Anfrage steht oben', liste[0].id === a3.id);

// Nachgetragene Anfrage: steht am Dateiende, ist aber die älteste
const alt = anfrage('dachdecker', { name: 'Nachtrag', telefon: '0170 7778899', nachricht: 'zuletzt gespeichert, zuerst passiert', vorMin: 5000 });
pruefe('sortiert wird nach Zeitstempel, nicht nach Dateireihenfolge',
  leadsVonKunde('dachdecker')[0].id === a3.id
  && leadsVonKunde('dachdecker').at(-1).id === alt.id);
liste = leadsVonKunde('dachdecker');
pruefe('Anfragen starten auf „neu" und gelten als offen', liste.every((l) => l.stufe === 'neu' && l.offen));
pruefe('Wiederkehrer wird gezählt',
  liste.find((l) => l.id === a2.id).anfragenDesKontakts === 2
  && liste.find((l) => l.id === a3.id).anfragenDesKontakts === 1);

pruefe('Stufe setzen wirkt', stufeSetzen('dachdecker', a1.id, 'besichtigt').ok);
pruefe('unbekannte Stufe wird abgelehnt', !stufeSetzen('dachdecker', a1.id, 'irgendwas').ok);
pruefe('fremde Anfrage bleibt unerreichbar', !stufeSetzen('elektro', a1.id, 'auftrag').ok);
pruefe('gesetzte Stufe kommt zurück', leadsVonKunde('dachdecker').find((l) => l.id === a1.id).stufe === 'besichtigt');

stufeSetzen('dachdecker', a3.id, 'auftrag');
pruefe('Auftrag gilt nicht mehr als offen', leadsVonKunde('dachdecker').find((l) => l.id === a3.id).offen === false);

// Altbestand: der erste App-Stand kannte nur einen Erledigt-Haken
const statusDatei = join(DATA, 'status.json');
writeFileSync(statusDatei, JSON.stringify({
  ...(existsSync(statusDatei) ? JSON.parse(readFileSync(statusDatei, 'utf8')) : {}),
  [a2.id]: { erledigt: true, ts: new Date().toISOString() },
}, null, 2));
pruefe('Altbestand wird als „abgeschlossen" gelesen, nicht umgedeutet',
  leadsVonKunde('dachdecker').find((l) => l.id === a2.id).stufe === 'abgeschlossen');

const kAnna = kontaktId({ telefon: '0170 1234567' });
const kClara = kontaktId({ telefon: '0170 5556666' });

const n1 = notizAnlegen('dachdecker', kAnna, '  Preis 2.400 € genannt, meldet sich nächste Woche.  ');
pruefe('Notiz wird beschnitten gespeichert', n1?.text === 'Preis 2.400 € genannt, meldet sich nächste Woche.');
pruefe('leere Notiz wird nicht gespeichert', notizAnlegen('dachdecker', kAnna, '   ') === null);
pruefe('Notizzahl steht an der Anfrage',
  leadsVonKunde('dachdecker').find((l) => l.id === a1.id).notizen === 1);

const detail = kontaktDetail('dachdecker', kAnna);
pruefe('Kontakt bündelt beide Anfragen', detail.anfragen.length === 2);
pruefe('Stammdaten kommen aus der neuesten Anfrage', detail.name === 'Anna Weber' && detail.telefon === '+49 170 1234567');
pruefe('Verlauf enthält Anfragen, Stufenwechsel und Notiz',
  detail.verlauf.filter((e) => e.typ === 'anfrage').length === 2
  && detail.verlauf.some((e) => e.typ === 'stufe' && e.nach === 'besichtigt')
  && detail.verlauf.some((e) => e.typ === 'notiz'));
pruefe('Verlauf ist absteigend sortiert',
  detail.verlauf.every((e, i) => i === 0 || detail.verlauf[i - 1].ts >= e.ts));
pruefe('fremder Kontakt bleibt unsichtbar', kontaktDetail('dachdecker', kClara) === null);

pruefe('fremde Notiz lässt sich nicht löschen', notizLoeschen('elektro', n1.id) === false);
pruefe('Notiz ist danach noch da', kontaktDetail('dachdecker', kAnna).verlauf.some((e) => e.typ === 'notiz'));
pruefe('eigene Notiz lässt sich löschen', notizLoeschen('dachdecker', n1.id) === true);
pruefe('gelöschte Notiz verschwindet aus dem Verlauf',
  !kontaktDetail('dachdecker', kAnna).verlauf.some((e) => e.typ === 'notiz'));

// ── Schnittstelle ────────────────────────────────────────────────────────────

console.log('\nSchnittstelle');

const PORT = 8391;
const BASIS = `http://127.0.0.1:${PORT}`;
const kind = spawn(process.execPath, [join(HIER, 'server.mjs')], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, DISCORD_WEBHOOK_URL: '', RESEND_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
kind.stderr.on('data', (d) => { const s = String(d); if (!/FEHLER/.test(s)) process.stderr.write(s); });

await new Promise((auf, ab) => {
  const zeit = setTimeout(() => ab(new Error('Server startet nicht')), 8000);
  kind.stdout.on('data', (d) => { if (String(d).includes('lead-api auf')) { clearTimeout(zeit); auf(); } });
});

const ruf = (pfad, opt = {}) => fetch(BASIS + pfad, opt);
const mitZugang = (token, opt = {}) => ({
  ...opt, headers: { 'X-Zugang': token, 'Content-Type': 'application/json', ...(opt.headers || {}) },
});

try {
  let r = await ruf('/health');
  pruefe('Gesundheitsprüfung antwortet', r.status === 200 && (await r.json()).kunden === 2);

  r = await ruf('/api/anfragen');
  pruefe('ohne Zugang keine Anfragen', r.status === 401);

  r = await ruf('/api/anfragen', mitZugang(dach.token));
  const daten = await r.json();
  pruefe('mit Zugang kommen die eigenen Anfragen', r.status === 200 && daten.anfragen.length === 4);
  pruefe('Stufen kommen mit', daten.stufen?.length === 5 && daten.stufen[0].id === 'neu');
  pruefe('Betriebsname kommt mit', daten.betrieb === 'Dachdeckerei Brandner');

  r = await ruf(`/api/anfragen/${a1.id}/status`, mitZugang(dach.token, {
    method: 'POST', body: JSON.stringify({ stufe: 'angebot' }),
  }));
  pruefe('Stufe über die Schnittstelle setzen', r.status === 200);

  r = await ruf(`/api/anfragen/${a1.id}/status`, mitZugang(elek.token, {
    method: 'POST', body: JSON.stringify({ stufe: 'auftrag' }),
  }));
  pruefe('fremde Anfrage lässt sich nicht umstellen', r.status === 404);
  pruefe('sie steht danach unverändert da',
    leadsVonKunde('dachdecker').find((l) => l.id === a1.id).stufe === 'angebot');

  r = await ruf(`/api/anfragen/${a1.id}/status`, mitZugang(dach.token, {
    method: 'POST', body: JSON.stringify({ stufe: 'abgeschlossen' }),
  }));
  pruefe('„abgeschlossen" ist von außen nicht setzbar', r.status === 400);

  r = await ruf(`/api/anfragen/${a1.id}/status`, mitZugang(dach.token, {
    method: 'POST', body: JSON.stringify({ erledigt: true }),
  }));
  pruefe('alte App-Fassung (erledigt) wird noch angenommen', r.status === 200
    && leadsVonKunde('dachdecker').find((l) => l.id === a1.id).stufe === 'abgeschlossen');
  await ruf(`/api/anfragen/${a1.id}/status`, mitZugang(dach.token, {
    method: 'POST', body: JSON.stringify({ stufe: 'angebot' }),
  }));

  r = await ruf(`/api/kontakt/${kAnna}`, mitZugang(dach.token));
  const kd = await r.json();
  pruefe('Kontakt-Ansicht liefert Anfragen und Verlauf',
    r.status === 200 && kd.anfragen.length === 2 && Array.isArray(kd.verlauf));

  r = await ruf(`/api/kontakt/${kClara}`, mitZugang(dach.token));
  pruefe('fremder Kontakt gibt 404', r.status === 404);

  r = await ruf(`/api/kontakt/${kClara}/notiz`, mitZugang(dach.token, {
    method: 'POST', body: JSON.stringify({ text: 'darf nicht landen' }),
  }));
  pruefe('Notiz an fremdem Kontakt wird abgewiesen', r.status === 404);
  pruefe('sie taucht dort auch nicht auf',
    !kontaktDetail('elektro', kClara).verlauf.some((e) => e.typ === 'notiz'));

  r = await ruf(`/api/kontakt/${kAnna}/notiz`, mitZugang(dach.token, {
    method: 'POST', body: JSON.stringify({ text: 'Termin Donnerstag 9 Uhr' }),
  }));
  const angelegt = (await r.json()).notiz;
  pruefe('Notiz am eigenen Kontakt wird angelegt', r.status === 200 && !!angelegt?.id);

  r = await ruf(`/api/kontakt/${kAnna}/notiz`, mitZugang(dach.token, {
    method: 'POST', body: JSON.stringify({ text: '   ' }),
  }));
  pruefe('leere Notiz gibt 400', r.status === 400);

  r = await ruf(`/api/kontakt/${kClara}/notiz/${angelegt.id}`, mitZugang(elek.token, { method: 'DELETE' }));
  pruefe('fremde Notiz lässt sich nicht über die Schnittstelle löschen', r.status === 404);

  r = await ruf(`/api/kontakt/${kAnna}/notiz/${angelegt.id}`, mitZugang(dach.token, { method: 'DELETE' }));
  pruefe('eigene Notiz lässt sich löschen', r.status === 200);

  r = await ruf('/app/');
  pruefe('App-Hülle wird ausgeliefert', r.status === 200 && (await r.text()).includes('ansicht-kontakt'));
  pruefe('Einstiegsseite kommt ohne Zwischenspeicher', r.headers.get('cache-control') === 'no-cache');

  r = await ruf('/app/../server.mjs');
  pruefe('Ausbruch aus dem App-Verzeichnis geht nicht', r.status === 404 || !(await r.text()).includes('createServer'));

  const formular = new URLSearchParams({
    kunde: 'dachdecker', name: 'Dieter Ernst', telefon: '0176 4443322', ort: 'Zirndorf',
    nachricht: 'Sturmschaden am First', einwilligung: 'on',
  });
  r = await ruf('/anfrage', { method: 'POST', redirect: 'manual', body: formular });
  pruefe('Formular-Weg funktioniert weiter', r.status === 303);
  pruefe('neue Anfrage landet beim richtigen Kunden',
    leadsVonKunde('dachdecker')[0].name === 'Dieter Ernst' && leadsVonKunde('elektro').length === 1);
  pruefe('neue Anfrage steht auf „neu"', leadsVonKunde('dachdecker')[0].stufe === 'neu');
} finally {
  kind.kill();
}

// ── Ergebnis ─────────────────────────────────────────────────────────────────

rmSync(DATA, { recursive: true, force: true });
console.log(`\n${gruen} grün, ${rot.length} rot`);
if (rot.length) { console.log('Rot: ' + rot.join(' · ')); process.exit(1); }
