// ─────────────────────────────────────────────────────────────────────────────
// ZENTRALE BETRIEBS-KONFIG — die eine Datei, die pro Kunde getauscht wird.
// Der komplette SEO/GEO-Stack (robots.txt, llms.txt, Schema.org, Canonical,
// Sitemap-Referenz) speist sich hieraus. Muster wie bei asbest-entfernen.de.
//
// KUNDEN-ROLLOUT: `indexable: true` setzen + alle Felder mit echten Daten
// füllen + in tools/indexnow.mjs HOST/KEY tauschen (siehe README).
// ─────────────────────────────────────────────────────────────────────────────

export const BUSINESS = {
  /** false = Demo/Staging: noindex + robots-Disallow. true = Kunden-Modus:
   *  index/follow, KI-Bots erlaubt, Sitemap in robots.txt referenziert. */
  indexable: false,

  domain: 'https://muster.k-aizen.de', // ohne Slash am Ende, = astro.config site

  /** Kennung des Betriebs in der Anfragen-App. Bestimmt, auf wessen Handy die
   *  Anfrage gepusht wird. Beim Aufsetzen mit `node kunden.mjs --neu <kennung> "<Name>"`
   *  erzeugen und hier eintragen — sonst landen die Anfragen in der Demo. */
  kunde: 'muster',

  name: 'Dachdeckerei Brandner & Sohn',
  branche: 'Dachdeckerei · Meisterbetrieb',
  /** Schema.org-Typ des Betriebs — pro Gewerk wählen:
   *  RoofingContractor, Plumber, Electrician, HousePainter, GeneralContractor,
   *  MovingCompany, Locksmith … (alle Subtypen von HomeAndConstructionBusiness). */
  schemaType: 'RoofingContractor',
  gruendung: '1987',
  beschreibung:
    'Dachdeckerei Brandner & Sohn — Meisterbetrieb in Nürnberg seit 1987. Dachreparatur, Neueindeckung, Flachdach, Dachfenster, Dachrinnen und Dämmung. Festpreis-Angebot innerhalb von 24 Stunden.',

  telefonDisplay: '0911 00 00 000',
  telefonHref: 'tel:+49911000000',
  email: 'info@dachdeckerei-brandner.de',
  strasse: 'Musterstraße 12',
  plz: '90402',
  ort: 'Nürnberg',

  /** Einsatzgebiet — wird areaServed im Schema + llms.txt. */
  einsatzgebiet: ['Nürnberg', 'Fürth', 'Erlangen', 'Schwabach'],

  /** Chat-Assistent: voller Endpunkt oder leer.
   *  Leer = das Widget lädt nicht. Das ist die sichere Voreinstellung — eine
   *  Chat-Blase ohne Backend dahinter ist schlimmer als gar keine.
   *
   *  Welchen Betrieb der Dienst bedient, entscheidet er am Origin der Anfrage,
   *  nicht an dieser URL. Beim Aufsetzen eines echten Kunden gehört seine
   *  Domain deshalb in die Mandanten-Registry des Chatbots
   *  (`k-aizen/website/chatbot/src/mandanten.ts`) — sonst antwortet der Dienst
   *  mit 403, und das zu Recht. */
  chatBotUrl: 'https://chat.k-aizen.de/chat',

  /** Öffnungszeiten im Schema.org-Format. */
  openingHours: ['Mo-Th 07:00-16:30', 'Fr 07:00-14:00'],

  /** Leistungen — speisen llms.txt + Service-Schema. */
  leistungen: [
    'Dachreparatur & Sturmschäden',
    'Neueindeckung Steildach',
    'Flachdach & Abdichtung',
    'Dachfenster',
    'Dachrinnen & Spenglerarbeiten',
    'Dämmung & Energie',
  ],

  /** ⚠️ NUR setzen, wenn der Kunde ECHTE, auf der Seite sichtbare Bewertungen
   *  hat (Google-Richtlinie: aggregateRating muss reale, on-page belegte
   *  Bewertungen abbilden). Demo: fiktive Werte auf noindex-Seite = inert. */
  rating: { value: '4.9', count: '87' } as { value: string; count: string } | null,
};
