// Web-Push nach RFC 8030 / 8291 / 8292 — ohne Fremdpakete, nur node:crypto.
//
// Warum selbst gebaut: Die Lead-API ist bewusst dependency-frei. Und alles, was
// hier gebraucht wird, kann Node seit v15: ECDH auf P-256, HKDF, AES-128-GCM,
// ES256-Signaturen.
//
// Datenschutz-Entscheidung (Ben 28.07.): Der Push transportiert NIE Lead-Inhalte.
// Er sagt nur "neue Anfrage" plus die ID. Den Text holt die App danach über einen
// authentifizierten Aufruf vom eigenen Server. Damit sehen Apple und Google
// ausschließlich, DASS etwas ankam — nie WAS. Das ist der Unterschied zu Discord,
// wo der volle Anfragetext bei einem US-Dienst liegt.
//
// Schlüssel erzeugen:  node push.mjs --keys
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:… oder https://…)

import {
  createECDH, createHmac, createSign, createPrivateKey,
  hkdfSync, randomBytes, createCipheriv, generateKeyPairSync,
} from 'node:crypto';

// ── base64url ────────────────────────────────────────────────────────────────

export const b64u = {
  enc(buf) {
    return Buffer.from(buf).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(s + '='.repeat((4 - (s.length % 4)) % 4), 'base64');
  },
};

// ── VAPID: Absender-Identität (RFC 8292) ────────────────────────────────────

/** Erzeugt ein VAPID-Schlüsselpaar. Einmalig — der öffentliche Teil geht in die App. */
export function vapidSchluesselErzeugen() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    publicKey: b64u.enc(ecdh.getPublicKey()),        // 65 Byte, unkomprimiert
    privateKey: b64u.enc(ecdh.getPrivateKey()),      // 32 Byte
  };
}

/**
 * Baut aus den rohen Schlüsselbytes ein Key-Objekt, das node:crypto signieren kann.
 * Über JWK statt handgeschriebenem ASN.1 — kürzer und ohne Byte-Fallen.
 * Der öffentliche Punkt ist unkomprimiert: 0x04 || X(32) || Y(32).
 */
function privatKeyObjekt(privRaw, pubRaw) {
  if (pubRaw.length !== 65 || pubRaw[0] !== 0x04) throw new Error('Öffentlicher VAPID-Schlüssel muss 65 Byte unkomprimiert sein');
  return createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64u.enc(pubRaw.subarray(1, 33)),
      y: b64u.enc(pubRaw.subarray(33, 65)),
      d: b64u.enc(privRaw),
    },
  });
}

/**
 * Erzeugt den Authorization-Header für einen Push-Dienst.
 * JWS verlangt die Signatur im Rohformat (r||s, 64 Byte), nicht als ASN.1/DER.
 * `dsaEncoding: 'ieee-p1363'` liefert genau das — kein eigenes Umwandeln nötig.
 */
function vapidHeader(endpointOrigin, publicKey, privateKey, subject) {
  const kopf = b64u.enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const nutz = b64u.enc(JSON.stringify({
    aud: endpointOrigin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  }));
  const signiert = `${kopf}.${nutz}`;

  const sign = createSign('SHA256');
  sign.update(signiert);
  sign.end();
  const roh = sign.sign({
    key: privatKeyObjekt(b64u.dec(privateKey), b64u.dec(publicKey)),
    dsaEncoding: 'ieee-p1363',
  });

  return `vapid t=${signiert}.${b64u.enc(roh)}, k=${publicKey}`;
}

// ── Nutzlast verschlüsseln (RFC 8291, aes128gcm) ─────────────────────────────

function verschluesseln(klartext, empfaengerP256dh, empfaengerAuth) {
  const ua = b64u.dec(empfaengerP256dh);           // 65 Byte öffentlicher Schlüssel des Browsers
  const auth = b64u.dec(empfaengerAuth);           // 16 Byte gemeinsames Geheimnis

  // Kurzlebiges Schlüsselpaar für genau diese Nachricht
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const as = ecdh.getPublicKey();
  const gemeinsam = ecdh.computeSecret(ua);

  const salt = randomBytes(16);

  // Schritt 1: aus Geheimnis + auth den Pseudo-Random-Key ableiten
  const info1 = Buffer.concat([
    Buffer.from('WebPush: info\0'), ua, as,
  ]);
  const prk = Buffer.from(hkdfSync('sha256', gemeinsam, auth, info1, 32));

  // Schritt 2: daraus Schlüssel und Nonce
  const cek = Buffer.from(hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

  // Nutzlast + Trennbyte 0x02 (letzter Datensatz)
  const daten = Buffer.concat([Buffer.from(klartext, 'utf8'), Buffer.from([0x02])]);
  const chiffre = createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([chiffre.update(daten), chiffre.final(), chiffre.getAuthTag()]);

  // Kopfteil: salt | Datensatzgröße | Länge des Schlüssels | Schlüssel
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([as.length]), as, ciphertext]);
}

// ── Senden ───────────────────────────────────────────────────────────────────

/**
 * Schickt eine Push-Nachricht an ein Abonnement.
 * @param abo  {endpoint, keys:{p256dh, auth}} — genau das, was der Browser liefert
 * @param nutzlast  kurzer String. NIE personenbezogene Daten hineinschreiben.
 * @returns {ok, status, weg?} — weg:true heißt: Abo ist tot, aus dem Speicher nehmen
 */
export async function pushSenden(abo, nutzlast, opt = {}) {
  const publicKey = opt.publicKey || process.env.VAPID_PUBLIC_KEY;
  const privateKey = opt.privateKey || process.env.VAPID_PRIVATE_KEY;
  const subject = opt.subject || process.env.VAPID_SUBJECT || 'mailto:kontakt@k-aizen.de';
  if (!publicKey || !privateKey) return { ok: false, status: 0, fehler: 'VAPID-Schlüssel fehlen' };

  let url;
  try { url = new URL(abo.endpoint); } catch { return { ok: false, status: 0, fehler: 'Endpunkt ungültig' }; }

  const koerper = verschluesseln(nutzlast, abo.keys.p256dh, abo.keys.auth);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(abo.endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: vapidHeader(url.origin, publicKey, privateKey, subject),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(opt.ttl ?? 86400),
        Urgency: opt.urgency || 'high',
      },
      body: koerper,
    });
    // 404/410 = Abo existiert nicht mehr (App deinstalliert, Rechte entzogen)
    return { ok: res.ok, status: res.status, weg: res.status === 404 || res.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, fehler: e.name === 'AbortError' ? 'Zeitüberschreitung' : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

// ── Direktaufruf: Schlüssel erzeugen ─────────────────────────────────────────

if (process.argv[1]?.endsWith('push.mjs') && process.argv.includes('--keys')) {
  const k = vapidSchluesselErzeugen();
  console.log('VAPID-Schlüsselpaar erzeugt. In Coolify als Env eintragen:\n');
  console.log(`VAPID_PUBLIC_KEY=${k.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${k.privateKey}`);
  console.log(`VAPID_SUBJECT=mailto:kontakt@k-aizen.de`);
  console.log('\nDer öffentliche Schlüssel geht zusätzlich in die App (wird vom Server ausgeliefert).');
  console.log('⚠️ Den privaten Schlüssel nie in ein Repo committen.');
}
