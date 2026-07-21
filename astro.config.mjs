// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Demo-Site des Einstiegsprodukts „Meisterseite". Läuft unter der k-AIzen-Wildcard —
// kein DNS-Eintrag nötig (*.k-aizen.de → Hetzner). Demo bewusst noindex (fiktiver
// Betrieb) — der Schalter dafür liegt in src/config.ts (indexable).
// KUNDEN-ROLLOUT: SITE auf die Kundendomain + config.ts umstellen.
const SITE = 'https://muster.k-aizen.de';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    // Sitemap wird immer gebaut; robots.txt referenziert sie nur im Kunden-Modus.
    sitemap(),
  ],
  // Keine externen Fonts/CDNs — alles selbst gehostet (DSGVO ist Teil des Pitches).
});
