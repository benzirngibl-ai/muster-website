// Anfragen-App / Kunden-Cockpit: Zugang über Link-Token, Push-Anmeldung,
// Anfragenliste, und je Kontakt Stand, Notizen und Verlauf.
//
// Der Kunde bekommt einen persönlichen Link (…/app/?t=TOKEN). Beim ersten
// Öffnen wandert der Token in den lokalen Speicher; danach genügt das Symbol
// auf dem Startbildschirm. Kein Passwort — bei einem Handwerksbetrieb, der
// keine Zugangsdaten verwalten will, ist das der einzige Weg, der benutzt wird.
//
// Zwei Ansichten, adressierbar über die Raute: `#/` ist die Übersicht,
// `#/k/<kontakt>` ein Kontakt. Damit funktioniert der Zurück-Knopf des Geräts.

const API = new URL('..', location.href).pathname.replace(/\/$/, '');
const SPEICHER = 'anfragen-token';
const FILTER_SPEICHER = 'anfragen-filter';

// Ersatz, falls der Server eine ältere Fassung ist oder die Antwort ausbleibt
const STUFEN_STANDARD = [
  { id: 'neu', label: 'Neu', kurz: 'Neu' },
  { id: 'kontaktiert', label: 'Angerufen', kurz: 'Angerufen' },
  { id: 'besichtigt', label: 'Besichtigt', kurz: 'Besichtigt' },
  { id: 'angebot', label: 'Angebot raus', kurz: 'Angebot' },
  { id: 'auftrag', label: 'Auftrag', kurz: 'Auftrag' },
];
const ENDE_STANDARD = [
  { id: 'abgesagt', label: 'Nichts draus geworden', kurz: 'Abgesagt' },
  { id: 'abgeschlossen', label: 'Abgeschlossen', kurz: 'Erledigt' },
];

const $ = (id) => document.getElementById(id);
const el = {
  titel: $('titel'), zurueck: $('zurueck'), aktualisieren: $('aktualisieren'), hinweis: $('hinweis'),
  ansichtListe: $('ansicht-liste'), ansichtKontakt: $('ansicht-kontakt'),
  filter: $('filter'), liste: $('liste'), leer: $('leer'), leerText: $('leer-text'),
  einrichten: $('einrichten'), erlauben: $('erlauben'), iosHilfe: $('ios-hilfe'),
  einrichtenText: $('einrichten-text'),
};

const zustand = {
  betrieb: '',
  anfragen: [],
  stufen: STUFEN_STANDARD,
  stufenEnde: ENDE_STANDARD,
  filter: localStorage.getItem(FILTER_SPEICHER) || 'offen',
  kontakt: null,
};

// ── Token ────────────────────────────────────────────────────────────────────

function token() {
  const ausUrl = new URLSearchParams(location.search).get('t');
  if (ausUrl) {
    localStorage.setItem(SPEICHER, ausUrl);
    history.replaceState({}, '', location.pathname + location.hash);   // Token aus der Adresszeile nehmen
    return ausUrl;
  }
  return localStorage.getItem(SPEICHER);
}

async function api(pfad, opt = {}) {
  const t = token();
  if (!t) throw new Error('kein-token');
  const res = await fetch(`${API}/api${pfad}`, {
    ...opt,
    headers: { ...(opt.headers || {}), 'X-Zugang': t, 'Content-Type': 'application/json' },
  });
  if (res.status === 401) throw new Error('token-ungueltig');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Darstellungs-Helfer ──────────────────────────────────────────────────────

function zeit(iso) {
  const d = new Date(iso), jetzt = new Date();
  const min = Math.round((jetzt - d) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  if (min < 1440) return `vor ${Math.floor(min / 60)} Std`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function datum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const sicher = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const telNummer = (s) => String(s ?? '').replace(/[^\d+]/g, '');

function stufeInfo(id) {
  return [...zustand.stufen, ...zustand.stufenEnde].find((s) => s.id === id)
    || { id, label: id, kurz: id };
}

function anzahl(n, eins, viele) { return `${n} ${n === 1 ? eins : viele}`; }

function melde(text, art = 'info') {
  el.hinweis.textContent = text;
  el.hinweis.className = `hinweis hinweis--${art}`;
  el.hinweis.hidden = false;
}

function meldungWeg() { el.hinweis.hidden = true; }

// ── Übersicht ────────────────────────────────────────────────────────────────

const FILTER = {
  offen: { trifft: (a) => a.offen, leer: 'Keine offenen Anfragen.' },
  auftrag: { trifft: (a) => a.stufe === 'auftrag', leer: 'Noch kein Auftrag eingetragen.' },
  alle: { trifft: () => true, leer: 'Noch keine Anfragen.' },
};

function karteAnfrage(a) {
  const st = stufeInfo(a.stufe);
  const merkmale = [
    `<span class="stufe-chip" data-stufe="${a.stufe}">${sicher(st.kurz)}</span>`,
    a.ort ? `<span class="ort">${sicher(a.ort)}</span>` : '',
    a.anfragenDesKontakts > 1 ? `<span class="wieder">${a.anfragenDesKontakts}. Anfrage</span>` : '',
    a.notizen ? `<span class="notiz-zahl">${anzahl(a.notizen, 'Notiz', 'Notizen')}</span>` : '',
  ].filter(Boolean).join('');

  return `
    <article class="karte anfrage" data-stufe="${a.stufe}" data-kontakt="${a.kontakt}">
      <div class="zeile1">
        <h2 class="name"><a href="#/k/${a.kontakt}">${sicher(a.name)}</a></h2>
        <span class="zeit">${zeit(a.ts)}</span>
      </div>
      <div class="merkmale">${merkmale}</div>
      <p class="text">${sicher(a.nachricht)}</p>
      ${a.rueckruf ? `<div class="rueckruf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg><span>Rückruf gewünscht: <strong>${sicher(a.rueckruf)}</strong></span></div>` : ''}
      <div class="aktionen">
        ${a.telefon ? `<a class="knopf knopf--stark" href="tel:${sicher(telNummer(a.telefon))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02l-2.21 2.2z"/></svg>Anrufen</a>` : ''}
        <a class="knopf" href="#/k/${a.kontakt}">Öffnen</a>
      </div>
    </article>`;
}

function zeichneListe() {
  const f = FILTER[zustand.filter] || FILTER.offen;
  const sichtbar = zustand.anfragen.filter(f.trifft);

  el.liste.innerHTML = sichtbar.map(karteAnfrage).join('');
  el.leer.hidden = sichtbar.length > 0;
  el.leerText.textContent = zustand.anfragen.length ? f.leer : 'Noch keine Anfragen.';

  for (const chip of el.filter.querySelectorAll('.chip')) {
    chip.setAttribute('aria-pressed', String(chip.dataset.filter === zustand.filter));
  }
}

// ── Kontakt ──────────────────────────────────────────────────────────────────

function stufenwahl(a) {
  const erreichtBis = zustand.stufen.findIndex((s) => s.id === a.stufe);
  const haken = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
  const knoepfe = zustand.stufen.map((s, i) => `
    <button class="stufe${erreichtBis >= 0 && i <= erreichtBis ? ' stufe--erreicht' : ''}" data-lead="${a.id}" data-stufe="${s.id}" aria-pressed="${s.id === a.stufe}">
      <span class="stufe-punkt">${haken}</span>
      <span class="stufe-wort">${sicher(s.label)}</span>
    </button>`).join('');

  const abgesagt = a.stufe === 'abgesagt';
  const alt = a.stufe === 'abgeschlossen';

  return `
    <div class="stufen${abgesagt ? ' stufen--aus' : ''}" role="group" aria-label="Stand dieser Anfrage">${knoepfe}</div>
    <button class="absage" data-lead="${a.id}" data-stufe="abgesagt" aria-pressed="${abgesagt}">
      <span class="stufe-punkt"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></span>
      <span class="stufe-wort">${abgesagt ? 'Nichts draus geworden' : 'Nichts draus geworden?'}</span>
    </button>
    ${alt ? '<p class="alt-hinweis">Diese Anfrage war noch mit dem alten Erledigt-Haken abgehakt. Tippen Sie den Stand an, der wirklich zutrifft.</p>' : ''}`;
}

function karteAnfrageDetail(a) {
  return `
    <article class="karte anfrage-detail" data-stufe="${a.stufe}">
      <div class="zeile1">
        <h3>Anfrage vom ${datum(a.ts)}</h3>
        <span class="zeit">${zeit(a.ts)}</span>
      </div>
      <p class="text">${sicher(a.nachricht)}</p>
      ${a.rueckruf ? `<div class="rueckruf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg><span>Rückruf gewünscht: <strong>${sicher(a.rueckruf)}</strong></span></div>` : ''}
      ${stufenwahl(a)}
    </article>`;
}

function zeileVerlauf(e) {
  if (e.typ === 'anfrage') {
    return `<li class="v-anfrage"><span class="v-zeit">${datum(e.ts)}</span>
      <span class="v-text">Anfrage über die Website</span></li>`;
  }
  if (e.typ === 'stufe') {
    return `<li class="v-stufe"><span class="v-zeit">${datum(e.ts)}</span>
      <span class="v-text">${sicher(stufeInfo(e.von).label)} → <strong>${sicher(stufeInfo(e.nach).label)}</strong></span></li>`;
  }
  // Nur das Ereignis, nicht der Text: der steht vollständig unter „Notizen",
  // und dort gehört auch das Löschen hin. Zweimal dasselbe mit zwei
  // Löschen-Knöpfen liest sich wie zwei verschiedene Notizen.
  return `<li class="v-notiz"><span class="v-zeit">${datum(e.ts)}</span>
    <span class="v-text">Notiz geschrieben</span></li>`;
}

function zeichneKontakt(k) {
  el.titel.textContent = k.name || 'Kontakt';
  document.title = `${k.name} — Anfragen`;

  const notizen = k.verlauf.filter((e) => e.typ === 'notiz');
  const kopfzeile = [
    k.ort ? sicher(k.ort) : '',
    k.anfragen.length > 1 ? `${anzahl(k.anfragen.length, 'Anfrage', 'Anfragen')} seit ${datum(k.seit)}` : '',
  ].filter(Boolean).join(' · ');

  el.ansichtKontakt.innerHTML = `
    <section class="kontakt-kopf">
      ${kopfzeile ? `<p class="kopfzeile">${kopfzeile}</p>` : ''}
      ${k.telefon ? `<p class="tel">${sicher(k.telefon)}</p>` : ''}
      ${k.email ? `<p class="mail">${sicher(k.email)}</p>` : ''}
      <div class="aktionen">
        ${k.telefon ? `<a class="knopf knopf--stark" href="tel:${sicher(telNummer(k.telefon))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.24 1.02l-2.21 2.2z"/></svg>Anrufen</a>` : ''}
        ${k.email ? `<a class="knopf" href="mailto:${sicher(k.email)}">E-Mail</a>` : ''}
      </div>
    </section>

    <section class="block anfragen">
      <h2>${k.anfragen.length > 1 ? 'Anfragen' : 'Die Anfrage'}</h2>
      ${k.anfragen.map(karteAnfrageDetail).join('')}
    </section>

    <section class="block notizen">
      <h2>Notizen</h2>
      <form id="notiz-form" class="karte notiz-form">
        <label class="visuell-versteckt" for="notiz-text">Neue Notiz</label>
        <textarea id="notiz-text" rows="3" maxlength="2000"
          placeholder="Was besprochen wurde: Preis, Termin, Besonderheiten…"></textarea>
        <button class="knopf knopf--stark" type="submit">Notiz sichern</button>
      </form>
      ${notizen.length ? `<ul class="notiz-liste">${notizen.map((n) => `
        <li class="karte notiz">
          <p class="text">${sicher(n.text)}</p>
          <div class="notiz-fuss">
            <span class="zeit">${datum(n.ts)}</span>
            <button class="notiz-weg" data-notiz="${n.id}">Löschen</button>
          </div>
        </li>`).join('')}</ul>`
      : '<p class="leer klein">Noch keine Notiz. Was hier steht, sehen Sie beim nächsten Anruf sofort wieder.</p>'}
    </section>

    <section class="block verlauf">
      <h2>Verlauf</h2>
      <ol class="verlauf-liste">${k.verlauf.map(zeileVerlauf).join('')}</ol>
    </section>`;
}

// ── Wegweiser zwischen den Ansichten ─────────────────────────────────────────

function kontaktAusAdresse() {
  const m = location.hash.match(/^#\/k\/([a-f0-9]{16})$/);
  return m ? m[1] : null;
}

async function zeigen() {
  const id = kontaktAusAdresse();

  if (!id) {
    zustand.kontakt = null;
    el.ansichtKontakt.hidden = true;
    el.ansichtListe.hidden = false;
    el.zurueck.hidden = true;
    el.titel.textContent = zustand.betrieb || 'Anfragen';
    document.title = zustand.betrieb ? `Anfragen — ${zustand.betrieb}` : 'Anfragen';
    zeichneListe();
    return;
  }

  el.ansichtListe.hidden = true;
  el.ansichtKontakt.hidden = false;
  el.zurueck.hidden = false;
  await kontaktLaden(id);
}

async function kontaktLaden(id) {
  try {
    const k = await api(`/kontakt/${id}`);
    zustand.kontakt = k;
    zeichneKontakt(k);
    meldungWeg();
  } catch (e) {
    if (e.message === 'HTTP 404') {
      melde('Dieser Kontakt ist nicht (mehr) da.', 'warn');
      location.hash = '';
    } else {
      fehlerMelden(e);
    }
  }
}

function fehlerMelden(e) {
  if (e.message === 'kein-token') {
    melde('Dieser Zugang ist nicht eingerichtet. Bitte den persönlichen Link öffnen, den Sie bekommen haben.', 'warn');
  } else if (e.message === 'token-ungueltig') {
    localStorage.removeItem(SPEICHER);
    melde('Der Zugang ist abgelaufen. Bitte melden Sie sich bei uns.', 'warn');
  } else {
    melde('Keine Verbindung. Die Liste zeigt den letzten bekannten Stand.', 'warn');
  }
}

// ── Laden ────────────────────────────────────────────────────────────────────

async function laden({ still = false } = {}) {
  try {
    const d = await api('/anfragen');
    zustand.betrieb = d.betrieb || '';
    zustand.anfragen = d.anfragen || [];
    if (d.stufen?.length) zustand.stufen = d.stufen;
    if (d.stufenEnde?.length) zustand.stufenEnde = d.stufenEnde;
    if (!kontaktAusAdresse()) {
      el.titel.textContent = zustand.betrieb || 'Anfragen';
      document.title = zustand.betrieb ? `Anfragen — ${zustand.betrieb}` : 'Anfragen';
      zeichneListe();
    }
    meldungWeg();
  } catch (e) {
    if (!still) fehlerMelden(e);
  }
}

/** Nach einer Änderung: Liste im Hintergrund nachziehen, offene Kontaktansicht neu holen. */
async function nachziehen() {
  const id = kontaktAusAdresse();
  await laden({ still: true });
  if (id) await kontaktLaden(id);
}

// ── Aktionen ─────────────────────────────────────────────────────────────────

async function stufeSetzen(leadId, stufe) {
  const anfrage = zustand.kontakt?.anfragen.find((a) => a.id === leadId);
  const vorher = anfrage?.stufe;
  if (vorher === stufe) return;

  // Sofort umschalten, damit der Daumen nicht auf den Server wartet
  if (anfrage) { anfrage.stufe = stufe; zeichneKontakt(zustand.kontakt); }

  try {
    await api(`/anfragen/${leadId}/status`, { method: 'POST', body: JSON.stringify({ stufe }) });
    await nachziehen();
  } catch (e) {
    if (anfrage && vorher) { anfrage.stufe = vorher; zeichneKontakt(zustand.kontakt); }
    melde('Der Stand konnte nicht gespeichert werden.', 'warn');
  }
}

async function notizSichern(form) {
  const feld = form.querySelector('#notiz-text');
  const text = feld.value.trim();
  const knopf = form.querySelector('button');
  if (!text || !zustand.kontakt) return;

  knopf.disabled = true;
  try {
    await api(`/kontakt/${zustand.kontakt.id}/notiz`, { method: 'POST', body: JSON.stringify({ text }) });
    feld.value = '';
    await nachziehen();
  } catch (e) {
    melde('Die Notiz konnte nicht gespeichert werden.', 'warn');
  } finally {
    knopf.disabled = false;
  }
}

async function notizLoeschen(id) {
  if (!zustand.kontakt || !confirm('Diese Notiz löschen?')) return;
  try {
    await api(`/kontakt/${zustand.kontakt.id}/notiz/${id}`, { method: 'DELETE' });
    await nachziehen();
  } catch (e) {
    melde('Die Notiz konnte nicht gelöscht werden.', 'warn');
  }
}

// ── Push ─────────────────────────────────────────────────────────────────────

const istIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const alsAppGeoeffnet = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function b64uZuBytes(s) {
  const roh = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(roh, (c) => c.charCodeAt(0));
}

async function pushZustandPruefen() {
  // iPhone: Push geht ausschließlich, wenn die App auf dem Startbildschirm liegt
  if (istIOS && !alsAppGeoeffnet) {
    el.einrichten.hidden = false;
    el.einrichtenText.textContent = 'Auf dem iPhone müssen Sie die App zuerst zum Startbildschirm hinzufügen — sonst kann Ihnen niemand eine Benachrichtigung schicken.';
    el.erlauben.hidden = true;
    el.iosHilfe.hidden = false;
    el.iosHilfe.open = true;
    return;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    el.einrichten.hidden = false;
    el.einrichtenText.textContent = 'Dieses Gerät unterstützt keine Benachrichtigungen. Die Anfragen sehen Sie hier trotzdem — zusätzlich schicken wir sie per E-Mail.';
    el.erlauben.hidden = true;
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const abo = await reg.pushManager.getSubscription();
  el.einrichten.hidden = !!abo && Notification.permission === 'granted';
}

async function pushEinschalten() {
  el.erlauben.disabled = true;
  el.erlauben.textContent = 'einen Moment…';
  try {
    const rechte = await Notification.requestPermission();
    if (rechte !== 'granted') {
      melde('Benachrichtigungen wurden abgelehnt. Sie können das in den Einstellungen des Geräts ändern.', 'warn');
      return;
    }
    const { publicKey } = await api('/vapid');
    const reg = await navigator.serviceWorker.ready;
    const abo = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64uZuBytes(publicKey),
    });
    await api('/abo', {
      method: 'POST',
      body: JSON.stringify({ abo: abo.toJSON(), geraet: navigator.userAgent.slice(0, 120) }),
    });
    el.einrichten.hidden = true;
    melde('Fertig. Neue Anfragen melden sich ab jetzt auf diesem Gerät.', 'gut');
    setTimeout(meldungWeg, 4000);
  } catch (e) {
    // Die Fehlertexte der Browser sind englischer Technikjargon („The provided
    // applicationServerKey is not valid") — die gehören ins Protokoll, nicht vor den Kunden.
    console.error('Push-Anmeldung', e);
    melde('Benachrichtigungen ließen sich auf diesem Gerät nicht einschalten. Die Anfragen sehen Sie hier trotzdem, und wir schicken sie zusätzlich per E-Mail. Wenn es dabei bleibt, melden Sie sich bitte bei uns.', 'warn');
  } finally {
    el.erlauben.disabled = false;
    el.erlauben.textContent = 'Benachrichtigungen erlauben';
  }
}

// ── Ereignisse ───────────────────────────────────────────────────────────────

el.erlauben?.addEventListener('click', pushEinschalten);
el.aktualisieren.addEventListener('click', () => (kontaktAusAdresse() ? nachziehen() : laden()));
el.zurueck.addEventListener('click', () => { location.hash = ''; });

el.filter.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  zustand.filter = chip.dataset.filter;
  localStorage.setItem(FILTER_SPEICHER, zustand.filter);
  zeichneListe();
});

// Die ganze Karte ist antippbar — außer dort, wo schon ein Knopf sitzt
el.liste.addEventListener('click', (e) => {
  if (e.target.closest('a, button')) return;
  const karte = e.target.closest('.anfrage');
  if (karte) location.hash = `#/k/${karte.dataset.kontakt}`;
});

el.ansichtKontakt.addEventListener('click', (e) => {
  const stufe = e.target.closest('.stufe, .absage');
  if (stufe) return stufeSetzen(stufe.dataset.lead, stufe.dataset.stufe);
  const weg = e.target.closest('.notiz-weg');
  if (weg) return notizLoeschen(weg.dataset.notiz);
});

el.ansichtKontakt.addEventListener('submit', (e) => {
  if (e.target.id !== 'notiz-form') return;
  e.preventDefault();
  notizSichern(e.target);
});

window.addEventListener('hashchange', zeigen);

navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.typ === 'neu-laden') { location.hash = ''; laden(); }
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) nachziehen(); });

// ── Start ────────────────────────────────────────────────────────────────────

(async function start() {
  // Wer aus einer Benachrichtigung direkt in einen Kontakt springt, soll nicht
  // erst die Übersicht aufblitzen sehen — Ansicht vor dem Laden richtig stellen
  if (kontaktAusAdresse()) {
    el.ansichtListe.hidden = true;
    el.ansichtKontakt.hidden = false;
    el.zurueck.hidden = false;
  }
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { console.warn('SW', e); }
  }
  await laden();
  await zeigen();
  await pushZustandPruefen();
})();
