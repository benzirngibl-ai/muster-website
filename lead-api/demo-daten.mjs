// Legt einen Datenbestand für die lokale Vorschau an — echte Anfragetexte, alle
// Stufen, ein Wiederkehrer, Notizen. Damit lässt sich die App gestalten und
// vorführen, ohne den Server anzufassen.
//
//   DATA_DIR=/tmp/cockpit-demo node demo-daten.mjs
//   DATA_DIR=/tmp/cockpit-demo PORT=8390 node server.mjs
//
// Wird bewusst NICHT ins Container-Abbild kopiert (siehe Dockerfile).

import { rmSync } from 'node:fs';

const DATA = process.env.DATA_DIR;
if (!DATA) { console.error('DATA_DIR fehlt — niemals gegen /data laufen lassen.'); process.exit(2); }
if (DATA === '/data') { console.error('DATA_DIR ist /data — das sind die echten Daten. Abbruch.'); process.exit(2); }

rmSync(DATA, { recursive: true, force: true });

const { kundeAnlegen, leadSpeichern, stufeSetzen, notizAnlegen, kontaktId } = await import('./kunden.mjs');

const kunde = 'dachdecker';
const k = kundeAnlegen(kunde, 'Dachdeckerei Brandner & Sohn');

const vor = (min) => new Date(Date.now() - min * 60000).toISOString();

const anfragen = [
  { vorMin: 8, name: 'Katrin Vogel', telefon: '0170 4451288', ort: 'Fürth',
    nachricht: 'Nach dem Sturm gestern fehlen zwei Ziegel über der Garage. Es tropft noch nicht, aber ich hätte gern schnell jemanden drauf.',
    email: 'k.vogel@web.de', rueckruf: 'heute nachmittag' },
  { vorMin: 95, name: 'Markus Hübner', telefon: '0911 5527740', ort: 'Nürnberg-Eibach',
    nachricht: 'Wir planen eine neue Dacheindeckung für ein Reihenhaus, Baujahr 1968, ca. 90 m². Bitte um ein Angebot mit Dämmung.',
    email: '', rueckruf: '' },
  { vorMin: 240, name: 'Sabine Rothaug', telefon: '0176 21449083', ort: 'Zirndorf',
    nachricht: 'Dachrinne hängt durch und läuft an der Ecke über. Können Sie sich das mal ansehen?',
    email: 'sabine.rothaug@gmx.de', rueckruf: 'Dienstag vormittag' },
  { vorMin: 1500, name: 'Hausverwaltung Kern', telefon: '0911 3390120', ort: 'Nürnberg',
    nachricht: 'Für zwei Objekte in der Südstadt brauchen wir eine Dachwartung im Turnus. Angebot bitte an die Verwaltung.',
    email: 'technik@hv-kern.de', rueckruf: '' },
  { vorMin: 4300, name: 'Katrin Vogel', telefon: '+49 170 4451288', ort: 'Fürth',
    nachricht: 'Damals ging es um das Carport-Dach — Sie hatten die Bitumenbahn geflickt. Vielen Dank nochmal.',
    email: 'k.vogel@web.de', rueckruf: '' },
  { vorMin: 8600, name: 'Thomas Belz', telefon: '0175 8830412', ort: 'Oberasbach',
    nachricht: 'Dachfenster beschlägt von innen, vermutlich undicht. Bitte um Rückruf.',
    email: '', rueckruf: 'ab 17 Uhr' },
];

const ids = anfragen.map((a) => leadSpeichern({
  ts: vor(a.vorMin), kunde, name: a.name, telefon: a.telefon, ort: a.ort,
  nachricht: a.nachricht, email: a.email, rueckruf: a.rueckruf,
  quelle: 'muster-website', einwilligung: true, ip: '127.0.0.1',
}));

// [0] bleibt neu — der frische Fall oben in der Liste
stufeSetzen(kunde, ids[1].id, 'kontaktiert');
stufeSetzen(kunde, ids[2].id, 'besichtigt');
stufeSetzen(kunde, ids[3].id, 'angebot');
stufeSetzen(kunde, ids[4].id, 'auftrag');
stufeSetzen(kunde, ids[5].id, 'abgesagt');

notizAnlegen(kunde, kontaktId(anfragen[1]), 'Aufmaß am Freitag genommen. 92 m², Ziegel Braas Rubin, Dämmung 18 cm Aufsparren. Angebot rechnet Jonas.');
notizAnlegen(kunde, kontaktId(anfragen[3]), 'Verwaltung will Rahmenvertrag über 2 Jahre. Preis pro Objekt und Jahr, nicht pro Einsatz.');
notizAnlegen(kunde, kontaktId(anfragen[4]), 'Carport 2024 gemacht, hat sofort bezahlt. Angenehme Kundin, empfiehlt uns weiter.');
notizAnlegen(kunde, kontaktId(anfragen[4]), 'Ruft immer vormittags an, nachmittags arbeitet sie.');

console.log(`Demodaten in ${DATA}`);
console.log(`Zugangslink:  http://127.0.0.1:${process.env.PORT || 8390}/app/?t=${k.token}`);
