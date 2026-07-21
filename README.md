# Muster-Website — Dachdeckerei Brandner & Sohn (fiktiv)

Demonstrations-Website für einen Handwerksbetrieb: statische Astro-Site mit
Anfrage-Formular, Sofort-Benachrichtigung und Online-Terminanfrage.
Der dargestellte Betrieb ist fiktiv (siehe Footer/Impressum der Seite).

- **Live:** https://muster.k-aizen.de (noindex — bewusst nicht für Suchmaschinen)
- **Lead-API:** https://muster-api.k-aizen.de (`lead-api/`, eigener Container)

## Stack

- Astro 5, statisch, `build.format: directory` — Deploy als Dockerfile-Build (node → nginx)
- Fonts selbst gehostet (@fontsource: Lexend + Source Sans 3), kein CDN, kein Tracking
- `lead-api/server.mjs`: dependency-freier Node-Dienst — Formular-POST →
  JSONL-Log (`/data/leads.jsonl`) + Discord-Webhook-Ping (mit @Mention) + Resend-Mail

## Lokal

```bash
npm install
npm run dev          # Site auf :4321
node lead-api/server.mjs   # API auf :8080 (Envs siehe server.mjs-Kopf)
# Build gegen lokale API: PUBLIC_LEAD_API=http://localhost:8080 npm run build
```

## Deploy

Coolify auf dem Hetzner (zwei Apps aus diesem Repo): Site (Dockerfile, Port 80,
muster.k-aizen.de) + Lead-API (`lead-api/` als base_directory, Port 8080,
muster-api.k-aizen.de, Volume auf `/data`). Kein Auto-Deploy-Webhook —
nach Push manuell per Coolify-API triggern.
