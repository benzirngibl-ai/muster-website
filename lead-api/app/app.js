// Anfragen-App: Zugang über Link-Token, Push-Anmeldung, Anfragenliste.
//
// Der Kunde bekommt einen persönlichen Link (…/app/?t=TOKEN). Beim ersten
// Öffnen wandert der Token in den lokalen Speicher; danach genügt das Symbol
// auf dem Startbildschirm. Kein Passwort — bei einem Handwerksbetrieb, der
// keine Zugangsdaten verwalten will, ist das der einzige Weg, der benutzt wird.

const API = new URL('..', location.href).pathname.replace(/\/$/, '');
const SPEICHER = 'anfragen-token';

const $ = (id) => document.getElementById(id);
const el = { betrieb: $('betrieb'), liste: $('liste'), leer: $('leer'), hinweis: $('hinweis'),
             einrichten: $('einrichten'), erlauben: $('erlauben'), iosHilfe: $('ios-hilfe'),
             einrichtenText: $('einrichten-text'), aktualisieren: $('aktualisieren') };

// ── Token ────────────────────────────────────────────────────────────────────

function token() {
  const ausUrl = new URLSearchParams(location.search).get('t');
  if (ausUrl) {
    localStorage.setItem(SPEICHER, ausUrl);
    history.replaceState({}, '', location.pathname);   // Token aus der Adresszeile nehmen
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

// ── Anzeige ──────────────────────────────────────────────────────────────────

function zeit(iso) {
  const d = new Date(iso), jetzt = new Date();
  const min = Math.round((jetzt - d) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  if (min < 1440) return `vor ${Math.floor(min / 60)} Std`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const sicher = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

function zeichne(anfragen) {
  el.leer.hidden = anfragen.length > 0;
  el.liste.innerHTML = anfragen.map((a) => `
    <article class="karte anfrage${a.erledigt ? ' erledigt' : ''}" data-id="${a.id}">
      <div class="zeile1">
        <strong class="name">${sicher(a.name)}</strong>
        <span class="zeit">${zeit(a.ts)}</span>
      </div>
      ${a.ort ? `<div class="ort">${sicher(a.ort)}</div>` : ''}
      <p class="text">${sicher(a.nachricht)}</p>
      ${a.rueckruf ? `<div class="rueckruf">Rückruf gewünscht: ${sicher(a.rueckruf)}</div>` : ''}
      <div class="aktionen">
        ${a.telefon ? `<a class="knopf knopf--stark" href="tel:${sicher(a.telefon).replace(/[^\d+]/g, '')}">Anrufen</a>` : ''}
        ${a.email ? `<a class="knopf" href="mailto:${sicher(a.email)}">E-Mail</a>` : ''}
        <button class="knopf knopf--leise umschalten">${a.erledigt ? 'Wieder offen' : 'Erledigt'}</button>
      </div>
      ${a.telefon ? `<div class="tel">${sicher(a.telefon)}</div>` : ''}
    </article>`).join('');
}

function melde(text, art = 'info') {
  el.hinweis.textContent = text;
  el.hinweis.className = `hinweis hinweis--${art}`;
  el.hinweis.hidden = false;
}

// ── Laden ────────────────────────────────────────────────────────────────────

async function laden() {
  try {
    const d = await api('/anfragen');
    el.betrieb.textContent = d.betrieb || 'Anfragen';
    document.title = d.betrieb ? `Anfragen — ${d.betrieb}` : 'Anfragen';
    zeichne(d.anfragen || []);
    el.hinweis.hidden = true;
  } catch (e) {
    if (e.message === 'kein-token') {
      melde('Dieser Zugang ist nicht eingerichtet. Bitte den persönlichen Link öffnen, den Sie bekommen haben.', 'warn');
    } else if (e.message === 'token-ungueltig') {
      localStorage.removeItem(SPEICHER);
      melde('Der Zugang ist abgelaufen. Bitte melden Sie sich bei uns.', 'warn');
    } else {
      melde('Keine Verbindung. Die Liste zeigt den letzten bekannten Stand.', 'warn');
    }
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
    setTimeout(() => { el.hinweis.hidden = true; }, 4000);
  } catch (e) {
    melde('Das hat nicht geklappt: ' + e.message, 'warn');
  } finally {
    el.erlauben.disabled = false;
    el.erlauben.textContent = 'Benachrichtigungen erlauben';
  }
}

// ── Ereignisse ───────────────────────────────────────────────────────────────

el.erlauben?.addEventListener('click', pushEinschalten);
el.aktualisieren?.addEventListener('click', laden);

el.liste.addEventListener('click', async (e) => {
  const knopf = e.target.closest('.umschalten');
  if (!knopf) return;
  const karte = knopf.closest('.anfrage');
  const erledigt = !karte.classList.contains('erledigt');
  karte.classList.toggle('erledigt', erledigt);
  knopf.textContent = erledigt ? 'Wieder offen' : 'Erledigt';
  try {
    await api(`/anfragen/${karte.dataset.id}/status`, {
      method: 'POST', body: JSON.stringify({ erledigt }),
    });
  } catch {
    karte.classList.toggle('erledigt', !erledigt);   // zurückdrehen, wenn der Server nicht mitspielt
    melde('Konnte nicht gespeichert werden.', 'warn');
  }
});

navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.typ === 'neu-laden') laden();
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) laden(); });

// ── Start ────────────────────────────────────────────────────────────────────

(async function start() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('./sw.js'); } catch (e) { console.warn('SW', e); }
  }
  await laden();
  await pushZustandPruefen();
})();
