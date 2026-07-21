// @ts-check
import { defineConfig } from 'astro/config';

// Demo-Site des Einstiegsprodukts („Meisterseite"). Läuft unter der k-AIzen-Wildcard —
// kein DNS-Eintrag nötig (*.k-aizen.de → Hetzner). Bewusst noindex (fiktiver Betrieb).
const SITE = 'https://muster.k-aizen.de';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  // Keine externen Fonts/CDNs — alles selbst gehostet (DSGVO ist Teil des Pitches).
});
