# Muster-Website — Dachdeckerei Brandner & Sohn (fiktiv)

Demonstrations-Website für einen Handwerksbetrieb: statische Astro-Site mit
Anfrage-Formular, Sofort-Benachrichtigung und Online-Terminanfrage.
Der dargestellte Betrieb ist fiktiv (siehe Footer/Impressum der Seite).

**Zugleich das Kunden-Template fürs Einstiegsprodukt „Meisterseite":** der komplette
SEO/GEO-Stack der Rank-&-Rent-Sites (asbest-entfernen.de) ist ab Werk eingebaut und
hängt an einem Schalter (`src/config.ts` → `indexable`).

- **Live:** https://muster.k-aizen.de (noindex — bewusst nicht für Suchmaschinen)
- **Lead-API:** https://muster-api.k-aizen.de (`lead-api/`, eigener Container)

## Stack

- Astro 5, statisch, `build.format: directory` — Deploy als Dockerfile-Build (node → nginx)
- Fonts selbst gehostet (@fontsource: Lexend + Source Sans 3), kein CDN, kein Tracking
- `lead-api/server.mjs`: dependency-freier Node-Dienst — Formular-POST →
  JSONL-Log (`/data/leads.jsonl`) + Push in die Anfragen-App + Discord-Webhook-Ping
  (mit @Mention) + Resend-Mail

## Anfragen-App / Kunden-Cockpit (`lead-api/app/`)

Installierbare Web-App unter `/app/`, eine je Kunde. Zugang über einen persönlichen
Link mit Token — kein Passwort, kein Fremdkonto. Sie ist der Empfänger für das
Versprechen „jede Anfrage landet in Sekunden auf Ihrem Handy" und zugleich das
CRM des 297-€-Produkts (das k-AIzen OS ist per Architekturentscheidung
Single-Tenant und dafür nicht gedacht).

- **Push ohne Inhalte:** die Benachrichtigung transportiert nur „neue Anfrage" + ID.
  Name und Anliegen holt die App danach über einen authentifizierten Aufruf. Apple
  und Google sehen nie, worum es geht.
- **Stufen** je Anfrage: Neu → Angerufen → Besichtigt → Angebot raus → Auftrag,
  daneben „Nichts draus geworden". `abgeschlossen` ist Altbestand aus der Zeit des
  bloßen Erledigt-Hakens und wird nicht umgedeutet.
- **Notizen** hängen am *Kontakt*, nicht an der einzelnen Anfrage — zusammengeführt
  über die Telefonnummer (0170…, +49170… und 0049170… sind derselbe Kontakt).
  Deshalb steht beim zweiten Auftrag noch da, was beim ersten besprochen wurde.
- **Verlauf** je Kontakt aus Anfragen, Stufenwechseln und Notizen (`/data/verlauf.jsonl`,
  nur angehängt).
- **Mandantentrennung** ist überall dieselbe Prüfung: fremde Anfragen und Kontakte
  sind nicht sichtbar und nicht änderbar, auch mit geratener ID.

Kunden anlegen (auf dem Server, weil die Daten dort liegen):

```bash
node kunden.mjs --neu <kennung> "<Name>"   # gibt den Zugangslink aus
node kunden.mjs --liste                    # Geräte + Anfragen je Kunde
```

⚠️ **iPhone:** Push geht nur, wenn die App vorher über Safari zum Startbildschirm
hinzugefügt wurde. Die App erkennt das und zeigt die Anleitung — beim Onboarding
gemeinsam am Telefon durchgehen, dann sind es zwei Minuten.

## SEO/GEO-Stack (ab Werk, gesteuert über `src/config.ts`)

- **Schema.org-@graph** auf jeder Seite (`SchemaLocal.astro`): LocalBusiness-Subtyp
  (pro Gewerk wählbar, z. B. `RoofingContractor`) mit Adresse, areaServed,
  Öffnungszeiten, Leistungen als Offer/Service + WebSite/WebPage, @id-verknüpft
- **Canonical + og:url** auf jeder Seite, `robots`-Meta aus dem `indexable`-Schalter
- **robots.txt** (dynamisch): Demo = Disallow all · Kunde = Allow + KI-Bots
  (GPTBot, ClaudeBot, PerplexityBot, …) ausdrücklich erlaubt + Sitemap-Referenz
- **llms.txt** (dynamisch aus config): zitierfähige Betriebs-Fakten für KI-Suche
- **Sitemap** (@astrojs/sitemap) — wird immer gebaut
- **IndexNow** (`tools/indexnow.mjs`): nach Deploy ausführen → Bing/ChatGPT-Kanal
  (Google läuft über Sitemap + GSC, siehe `rank-rent/BLUEPRINT-ben-klicks-neue-nische.md`)

## Kunden-Rollout (Checkliste)

1. Repo kopieren → `src/config.ts` komplett mit echten Betriebsdaten füllen,
   **`indexable: true`** setzen (⚠️ `rating` nur bei echten, on-page belegten Bewertungen)
2. `astro.config.mjs`: `SITE` auf die Kundendomain
3. Texte/Sektionen in `src/pages/index.astro` + Unterseiten aufs Gewerk anpassen
   (Impressum/Datenschutz: Demo-Hinweis raus, echte Betriebsdaten rein!)
3a. ⚠️ **BILDER: echte Fotos des Kundenbetriebs — Pflicht, keine Ausnahme.**
   Die Demo nutzt generierte Bilder (`BILD-PROMPTS-GPT.md`), weil es den Betrieb nicht gibt.
   Beim echten Kunden ist das genau falsch herum: Wer generierte Handwerker-Fotos auf die Seite
   eines echten Betriebs stellt, verkauft eine Fassade — und der erste Kunde, der die Baustelle
   sieht, merkt es. Vom Kunden anfordern: Hero (ein Motiv seiner Arbeit), 4 abgeschlossene
   Projekte mit Ort/Jahr, ein Detailbild, optional Team. Handy-Fotos genügen völlig, wenn sie
   scharf und bei Tageslicht aufgenommen sind. Bildplätze im Template:
   `hero-*.jpg` · `projekt-1…4.jpg` · `detail-*.jpg` · `team.jpg` in `public/images/`.
   Danach in WebP wandeln und `width`/`height` prüfen (Layout-Sprünge).
4. `tools/indexnow.mjs`: HOST tauschen, neuen KEY erzeugen (`openssl rand -hex 16`),
   Key-Datei `public/<KEY>.txt` anlegen, alte löschen
5. `lead-api`: Discord-Webhook des Kunden-Servers (oder SMS) + LEAD_TO des Kunden
6. Deploy (Coolify, 2 Apps) → `node tools/indexnow.mjs` → GSC + Sitemap (Ben-Klicks)

## Lokal

```bash
npm install
npm run dev          # Site auf :4321
node lead-api/server.mjs   # API auf :8080 (Envs siehe server.mjs-Kopf)
# Build gegen lokale API: PUBLIC_LEAD_API=http://localhost:8080 npm run build
```

Anfragen-App prüfen und ansehen (beides ohne Server-Zugriff, gegen ein Verzeichnis
unter `/tmp` — nie gegen `/data`):

```bash
cd lead-api
node pruefung-cockpit.mjs                                   # Datenschicht + Schnittstelle
DATA_DIR=/tmp/cockpit-demo PORT=8390 node demo-daten.mjs    # Demodaten, gibt den Link aus
DATA_DIR=/tmp/cockpit-demo PORT=8390 node server.mjs        # Vorschau auf :8390/app/
```

## Deploy

Coolify auf dem Hetzner (zwei Apps aus diesem Repo): Site (Dockerfile, Port 80,
muster.k-aizen.de) + Lead-API (`lead-api/` als base_directory, Port 8080,
muster-api.k-aizen.de, Volume auf `/data`). Kein Auto-Deploy-Webhook —
nach Push manuell per Coolify-API triggern.
