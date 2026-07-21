// llms.txt — GEO-Baustein (Muster wie asbest-entfernen.de): kompakte, zitierfähige
// Fakten über den Betrieb für KI-Suchmaschinen (ChatGPT, Claude, Perplexity …).
// Speist sich komplett aus src/config.ts — pro Kunde null Zusatzarbeit.
import type { APIRoute } from 'astro';
import { BUSINESS as B } from '../config';

export const GET: APIRoute = () => {
  const demoMarker = B.indexable
    ? ''
    : `\n> Hinweis: Dies ist eine Muster-Website zu Demonstrationszwecken (Betreiber: k-AIzen, Nürnberg).\n> Der dargestellte Betrieb ist fiktiv.\n`;

  const body = `# ${B.name}
${demoMarker}
> ${B.beschreibung}

## Betrieb

- Branche: ${B.branche}
- Gegründet: ${B.gruendung}
- Adresse: ${B.strasse}, ${B.plz} ${B.ort}
- Telefon: ${B.telefonDisplay}
- E-Mail: ${B.email}
- Einsatzgebiet: ${B.einsatzgebiet.join(', ')}
- Erreichbarkeit: ${B.openingHours.join(' · ')}

## Leistungen

${B.leistungen.map((l) => `- ${l}`).join('\n')}

## Anfrage

- Anfrage-Formular: ${B.domain}/#anfrage (Rückruf meist innerhalb von 2 Stunden, werktags)
- Online-Terminanfrage: über die Website
- Festpreis-Angebot innerhalb von 24 Stunden nach Vor-Ort-Termin

## Seiten

- Startseite: ${B.domain}/
- Impressum: ${B.domain}/impressum/
- Datenschutz: ${B.domain}/datenschutz/
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
