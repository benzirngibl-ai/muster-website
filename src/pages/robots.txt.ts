// robots.txt — config-gesteuert (Muster wie asbest-entfernen.de):
// Demo-Modus (indexable=false): alles gesperrt, fiktiver Betrieb gehört nicht in Suchergebnisse.
// Kunden-Modus (indexable=true): alles offen + KI-/LLM-Bots AUSDRÜCKLICH erlaubt (GEO —
// Voraussetzung, um in ChatGPT/Claude/Perplexity-Antworten zitiert zu werden) + Sitemap.
import type { APIRoute } from 'astro';
import { BUSINESS as B } from '../config';

export const GET: APIRoute = () => {
  const body = B.indexable
    ? `# ${B.domain.replace('https://', '')}
# KI-Crawler sind ausdrücklich willkommen (GEO/Zitierbarkeit).

User-agent: *
Allow: /

# KI-/LLM-Bots explizit erlaubt
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /

Sitemap: ${B.domain}/sitemap-index.xml
`
    : `# Muster-Website (fiktiver Betrieb) — bewusst nicht für Suchmaschinen bestimmt.
User-agent: *
Disallow: /
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
