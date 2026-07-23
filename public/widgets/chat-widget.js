/**
 * Meisterseite Chat-Widget — NEUTRAL & KONFIGURIERBAR (Kunden-Template)
 * ---------------------------------------------------------------------
 * Kein Branding, kein Bild-UI. Sauberer Bubble→Panel-Chat, der sich per
 * CSS-Variablen an die Farbe der jeweiligen Kundenseite anpasst.
 *
 * Backend: echtes Claude-RAG (k-aizen/website/chatbot/ Muster) → pro Kunde
 * eigene knowledge-base.txt. Fällt das Backend aus, versteckt sich das Widget
 * lautlos (kein totes Widget auf der Seite).
 *
 * KONFIG per window.MEISTER_CHAT vor dem Laden des Scripts:
 *   window.MEISTER_CHAT = {
 *     botUrl:   'https://chat.<kunde>.de/chat',   // Pflicht: Backend-Endpoint
 *     name:     'Dachdeckerei Brandner & Sohn',   // Betriebsname (Titel)
 *     assistant:'Assistent',                       // Anzeigename des Bots (neutral)
 *     accent:   '#c2410c',                         // optional; sonst --c-primary der Seite
 *     greeting: 'Hallo! Ich beantworte …',         // optional Begrüßung
 *     suggestions: ['Was kostet …', 'Kommt ihr …'],// optional Schnell-Fragen
 *     address:  'Sie'                              // 'Sie' (default) | 'Du'
 *   };
 * Ohne botUrl bindet sich das Widget nicht ein (keine Attrappe).
 */

(function () {
  const CFG = (typeof window !== 'undefined' && window.MEISTER_CHAT) || {};
  const BOT_URL = CFG.botUrl || '';
  if (!BOT_URL) return; // ohne echtes Backend KEIN Widget (nie faken)

  const NAME = CFG.name || 'Chat';
  const ASSISTANT = CFG.assistant || 'Assistent';
  const SIE = (CFG.address || 'Sie').toLowerCase() !== 'du';
  const anrede = SIE ? 'Ihnen' : 'dir';
  const GREETING =
    CFG.greeting ||
    `Hallo! Ich bin der Online-Assistent von ${NAME}. Ich beantworte ${anrede} Fragen zu Leistungen, Ablauf und Preisen — und nehme ${SIE ? 'Ihre' : 'deine'} Anfrage gleich auf.`;
  const SUGGESTIONS =
    Array.isArray(CFG.suggestions) && CFG.suggestions.length
      ? CFG.suggestions.slice(0, 4)
      : ['Was kostet das ungefähr?', 'Kommt ihr in meinen Ort?', 'Wie schnell habt ihr Zeit?'];

  /** @type {Array<{role:'user'|'assistant', content:string}>} */
  const history = [];
  let isOpen = false;
  let isSending = false;

  async function mount() {
    if (document.getElementById('mchat-root')) return;
    // Backend erreichbar? Sonst lautlos verstecken.
    const healthUrl = BOT_URL.replace(/\/chat$/, '/health');
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(healthUrl, { signal: ctrl.signal });
      clearTimeout(to);
      if (!r.ok) return;
    } catch {
      return;
    }
    injectStyles();
    renderWidget();
  }

  function injectStyles() {
    if (document.getElementById('mchat-styles')) return;
    const accent = CFG.accent || 'var(--c-primary, #2563eb)';
    const style = document.createElement('style');
    style.id = 'mchat-styles';
    style.textContent = `
      #mchat-root {
        position: fixed; bottom: 20px; right: 20px; z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
        --mc-accent: ${accent};
        --mc-ink: #1f2937;
        --mc-muted: #6b7280;
        --mc-surface: #ffffff;
        --mc-bg: #f9fafb;
        --mc-line: #e5e7eb;
      }
      /* Launcher-Bubble (closed) */
      #mchat-launcher {
        display: flex; align-items: center; gap: 10px;
        background: var(--mc-accent); color: #fff;
        border: none; cursor: pointer;
        padding: 13px 18px; border-radius: 999px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.18);
        font-size: 15px; font-weight: 600; font-family: inherit;
        transition: transform .18s ease, box-shadow .18s ease;
      }
      #mchat-launcher:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,0.24); }
      #mchat-launcher svg { width: 20px; height: 20px; flex: none; }
      #mchat-launcher .mc-dot {
        width: 8px; height: 8px; border-radius: 50%; background: #4ade80; flex: none;
        box-shadow: 0 0 0 0 rgba(74,222,128,.6); animation: mc-pulse 2.4s infinite;
      }
      @keyframes mc-pulse { 0%{box-shadow:0 0 0 0 rgba(74,222,128,.6)} 70%{box-shadow:0 0 0 7px rgba(74,222,128,0)} 100%{box-shadow:0 0 0 0 rgba(74,222,128,0)} }
      #mchat-root.open #mchat-launcher { display: none; }

      /* Panel (open) */
      #mchat-panel {
        display: none; flex-direction: column;
        width: 370px; max-width: calc(100vw - 40px);
        height: 560px; max-height: calc(100vh - 120px);
        background: var(--mc-surface);
        border: 1px solid var(--mc-line); border-radius: 16px;
        box-shadow: 0 16px 50px rgba(0,0,0,0.22); overflow: hidden;
      }
      #mchat-root.open #mchat-panel { display: flex; animation: mc-in .24s cubic-bezier(.22,1,.36,1); }
      @keyframes mc-in { from{opacity:0; transform:translateY(12px) scale(.98)} to{opacity:1; transform:none} }

      .mc-header {
        background: var(--mc-accent); color: #fff;
        padding: 14px 16px; display: flex; align-items: center; gap: 11px; flex: none;
      }
      .mc-avatar {
        width: 38px; height: 38px; border-radius: 50%; flex: none;
        background: rgba(255,255,255,.22);
        display: flex; align-items: center; justify-content: center;
      }
      .mc-avatar svg { width: 20px; height: 20px; }
      .mc-htext { flex: 1; min-width: 0; line-height: 1.25; }
      .mc-htext .mc-name { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .mc-htext .mc-status { font-size: 11.5px; opacity: .9; display: flex; align-items: center; gap: 5px; }
      .mc-htext .mc-status::before { content:""; width:6px; height:6px; border-radius:50%; background:#4ade80; display:inline-block; }
      .mc-close {
        background: rgba(255,255,255,.16); border: none; color: #fff; cursor: pointer;
        width: 30px; height: 30px; border-radius: 8px; font-size: 18px; line-height: 1;
        display: flex; align-items: center; justify-content: center; flex: none; transition: background .15s;
      }
      .mc-close:hover { background: rgba(255,255,255,.3); }

      .mc-messages {
        flex: 1; overflow-y: auto; padding: 16px; background: var(--mc-bg);
        display: flex; flex-direction: column; gap: 10px;
      }
      .mc-msg { max-width: 84%; padding: 10px 13px; font-size: 14px; line-height: 1.5; border-radius: 14px; white-space: pre-wrap; word-wrap: break-word; }
      .mc-msg.user { background: var(--mc-accent); color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
      .mc-msg.assistant { background: var(--mc-surface); color: var(--mc-ink); align-self: flex-start; border: 1px solid var(--mc-line); border-bottom-left-radius: 4px; }
      .mc-msg.assistant a { color: var(--mc-accent); text-decoration: underline; }
      .mc-msg.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; align-self: center; font-size: 12.5px; text-align: center; }

      .mc-suggestions { padding: 0 16px 8px; background: var(--mc-bg); display: flex; flex-wrap: wrap; gap: 6px; }
      .mc-suggestions button {
        background: var(--mc-surface); color: var(--mc-ink);
        border: 1px solid var(--mc-line); border-radius: 16px; padding: 6px 12px;
        font-size: 12.5px; cursor: pointer; font-family: inherit; transition: all .15s;
      }
      .mc-suggestions button:hover { border-color: var(--mc-accent); color: var(--mc-accent); }

      .mc-input { padding: 12px 14px; display: flex; gap: 8px; border-top: 1px solid var(--mc-line); background: var(--mc-surface); flex: none; }
      .mc-input input {
        flex: 1; padding: 10px 13px; border: 1px solid var(--mc-line); border-radius: 10px;
        font-size: 14px; font-family: inherit; color: var(--mc-ink); outline: none; transition: border-color .15s;
      }
      .mc-input input:focus { border-color: var(--mc-accent); }
      .mc-input button {
        background: var(--mc-accent); color: #fff; border: none; border-radius: 10px;
        width: 42px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity .15s;
      }
      .mc-input button svg { width: 18px; height: 18px; }
      .mc-input button:disabled { opacity: .4; cursor: not-allowed; }

      .mc-typing { align-self: flex-start; background: var(--mc-surface); border: 1px solid var(--mc-line); padding: 11px 14px; border-radius: 14px; display: flex; gap: 5px; }
      .mc-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--mc-muted); opacity: .4; animation: mc-typing 1.2s infinite; }
      .mc-typing span:nth-child(2){animation-delay:.2s} .mc-typing span:nth-child(3){animation-delay:.4s}
      @keyframes mc-typing { 0%,60%,100%{opacity:.3;transform:translateY(0)} 30%{opacity:1;transform:translateY(-3px)} }

      .mc-legal { padding: 7px 14px 9px; background: var(--mc-surface); font-size: 10.5px; color: var(--mc-muted); text-align: center; border-top: 1px solid var(--mc-line); }

      @media (max-width: 480px) {
        #mchat-root { bottom: 12px; right: 12px; left: 12px; }
        #mchat-panel { width: 100%; height: min(70vh, 560px); }
        #mchat-launcher { margin-left: auto; }
      }
      @media (prefers-reduced-motion: reduce) {
        #mchat-launcher, .mc-close, .mc-suggestions button, .mc-input button { transition: none; }
        #mchat-root.open #mchat-panel { animation: none; }
        .mc-dot, #mchat-launcher .mc-dot { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  const ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  function renderWidget() {
    const root = document.createElement('div');
    root.id = 'mchat-root';
    root.innerHTML = `
      <button id="mchat-launcher" aria-label="Chat öffnen" aria-expanded="false">
        <span class="mc-dot" aria-hidden="true"></span>
        ${ICON_CHAT}
        <span>Fragen? Schreiben Sie ${SIE ? 'uns' : 'uns'}</span>
      </button>
      <div id="mchat-panel" role="dialog" aria-modal="false" aria-label="Chat mit ${esc(NAME)}">
        <div class="mc-header">
          <div class="mc-avatar" aria-hidden="true">${ICON_CHAT}</div>
          <div class="mc-htext">
            <div class="mc-name">${esc(NAME)}</div>
            <div class="mc-status">${esc(ASSISTANT)} · antwortet sofort</div>
          </div>
          <button class="mc-close" id="mchat-close" aria-label="Chat schließen">×</button>
        </div>
        <div class="mc-messages" id="mchat-messages" role="log" aria-live="polite"></div>
        <div class="mc-suggestions" id="mchat-suggestions"></div>
        <div class="mc-input">
          <input type="text" id="mchat-input" aria-label="Ihre Nachricht" placeholder="Nachricht schreiben…" maxlength="2000" autocomplete="off">
          <button id="mchat-send" aria-label="Senden">${ICON_SEND}</button>
        </div>
        <div class="mc-legal">KI-Assistent · Angaben ohne Gewähr</div>
      </div>
    `;
    document.body.appendChild(root);

    document.getElementById('mchat-launcher').onclick = openPanel;
    document.getElementById('mchat-close').onclick = closePanel;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) closePanel(); });

    const input = document.getElementById('mchat-input');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
    document.getElementById('mchat-send').onclick = () => send(input.value);

    appendAssistant(GREETING);
    renderSuggestions(SUGGESTIONS);
  }

  function openPanel() {
    isOpen = true;
    document.getElementById('mchat-root').classList.add('open');
    document.getElementById('mchat-launcher').setAttribute('aria-expanded', 'true');
    setTimeout(() => document.getElementById('mchat-input')?.focus(), 250);
  }
  function closePanel() {
    isOpen = false;
    document.getElementById('mchat-root').classList.remove('open');
    const l = document.getElementById('mchat-launcher');
    l.setAttribute('aria-expanded', 'false');
    l.focus();
  }

  function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function appendUser(text) { addMsg('user', document.createTextNode(text)); }
  function appendAssistant(text) { const d = document.createElement('div'); d.innerHTML = format(text); addMsg('assistant', d.childNodes); }
  function appendError(text) { addMsg('error', document.createTextNode(text)); }
  function addMsg(cls, nodes) {
    const el = document.createElement('div');
    el.className = 'mc-msg ' + cls;
    if (nodes instanceof NodeList || Array.isArray(nodes)) [...nodes].forEach(n => el.appendChild(n));
    else el.appendChild(nodes);
    document.getElementById('mchat-messages').appendChild(el);
    scrollDown();
  }
  function showTyping() {
    const t = document.createElement('div'); t.id = 'mchat-typing'; t.className = 'mc-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    document.getElementById('mchat-messages').appendChild(t); scrollDown();
  }
  function hideTyping() { document.getElementById('mchat-typing')?.remove(); }
  function scrollDown() { const el = document.getElementById('mchat-messages'); if (el) el.scrollTop = el.scrollHeight; }

  // Markdown-lite mit URL-Whitelist (schützt vor XSS via Prompt-Injection)
  function format(text) {
    const e = esc(text);
    return e
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
        if (!/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) return label;
        const safe = url.replace(/"/g, '%22');
        const ext = /^https?:\/\//i.test(safe);
        return `<a href="${safe}"${ext ? ' rel="noopener noreferrer" target="_blank"' : ''}>${label}</a>`;
      })
      .replace(/\n/g, '<br>');
  }

  function renderSuggestions(items) {
    const el = document.getElementById('mchat-suggestions');
    if (!el) return; el.innerHTML = '';
    items.forEach((label) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => send(label); el.appendChild(b); });
  }
  function clearSuggestions() { const el = document.getElementById('mchat-suggestions'); if (el) el.innerHTML = ''; }

  async function send(raw) {
    const text = String(raw || '').trim();
    if (!text || isSending) return;
    isSending = true;
    const input = document.getElementById('mchat-input');
    const sendBtn = document.getElementById('mchat-send');
    if (input) input.value = '';
    if (sendBtn) sendBtn.disabled = true;

    appendUser(text); clearSuggestions(); showTyping();
    history.push({ role: 'user', content: text });

    try {
      const res = await fetch(BOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
      });
      hideTyping();
      if (!res.ok) { appendError('Verbindung wackelt — bitte gleich nochmal versuchen.'); return; }
      const data = await res.json();
      if (data?.reply) { appendAssistant(data.reply); history.push({ role: 'assistant', content: data.reply }); }
      else appendError('Keine Antwort empfangen — bitte nochmal versuchen.');
    } catch (err) {
      hideTyping();
      appendError('Verbindung fehlgeschlagen — bitte später erneut versuchen.');
      console.error('[mchat] fetch failed', err);
    } finally {
      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.focus();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
