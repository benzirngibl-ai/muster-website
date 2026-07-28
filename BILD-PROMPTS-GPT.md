# Bild-Prompts für die Muster-Website (GPT / DALL·E)

Erstellt 2026-07-28 für `muster.k-aizen.de` (fiktive Dachdeckerei Brandner & Sohn, Nürnberg).

**Jeder Block unten ist vollständig und in sich geschlossen** — markieren, kopieren, in eine
frische GPT-Sitzung werfen. Kein Zusammensetzen nötig, keine Vorrede ergänzen.

Dateien danach in `public/images/` legen. Claude wandelt sie in WebP, setzt `width`/`height`
und die Alt-Texte.

---

## ⚠️ Zwei Dinge vorab

**Gesichter sind das Risiko.** Alle Prompts zeigen Handwerker von hinten, im Profil oder in
Bewegung — bei Nahaufnahmen Hände statt Gesichter. KI-Gesichter fallen auf, und auf einer Seite,
die Vertrauen verkauft, ist ein erkennbar falsches Gesicht schlimmer als gar kein Foto.

**Das hier ist die DEMO.** Beim echten Kunden gilt das Gegenteil: echte Fotos seines Betriebs
(README, Schritt 3a). Generierte Handwerker auf der Seite eines echten Betriebs sind eine Fassade.

---

## 1 · HERO → `hero-dach.jpg`

```
Create a photorealistic image in landscape format, aspect ratio 3:2, high resolution.

SUBJECT: A German roofer wearing dark professional work trousers and a high-visibility vest,
seen from behind and slightly below, kneeling on a steep pitched roof while laying terracotta
clay roof tiles. He is mid-motion, placing a tile with both hands.

SETTING: A traditional Central European residential house. Warm reddish-brown clay tiles laid
in neat overlapping rows. A dormer window visible to one side. Rooftops and church spires of a
small Bavarian town softly blurred in the far background.

LIGHT AND MOOD: Late afternoon golden light, long soft shadows, clear sky with a few gentle
clouds. Calm, competent, unhurried — a craftsman at work, not a hero shot.

STYLE: Documentary photography. Natural muted colours, realistic textures, shot on a 35mm lens
with shallow depth of field. Slightly imperfect, like a real working site — NOT a glossy
commercial or stock photo.

IMPORTANT — the image must NOT contain:
- any visible face (strictly seen from behind)
- flat American asphalt shingles (use European terracotta clay tiles only)
- any text, lettering, signage, logos or watermarks
- exaggerated saturation, HDR look, or lens flare

Leave the left third of the frame visually calm — website headline text will be placed there.
```

---

## 2 · REFERENZ 1 → `projekt-1.jpg`

```
Create a photorealistic image in landscape format, aspect ratio 3:2, high resolution.

SUBJECT: A freshly re-tiled steep pitched roof on a detached German family house. The whole roof
is visible, terracotta clay tiles in perfectly even rows, a clean straight ridge line, copper
flashing around the chimney.

VIEWPOINT: Taken from the neighbouring garden, looking slightly upward, so the roof fills most
of the frame against the sky.

LIGHT AND MOOD: Warm morning light, soft blue sky. Quiet, orderly, freshly finished.

STYLE: Documentary architectural photography. Natural colours, realistic materials, sharp detail.
NOT a glossy real-estate advertisement.

IMPORTANT — the image must NOT contain:
- any people
- flat American asphalt shingles (European terracotta clay tiles only)
- any text, lettering, signage, logos or watermarks
- oversaturated colours or an artificial HDR look
```

---

## 3 · REFERENZ 2 → `projekt-2.jpg`

```
Create a photorealistic image in landscape format, aspect ratio 3:2, high resolution.
Use the same lighting mood and photographic style as a documentary roofing series.

SUBJECT: A newly sealed flat roof on a modern German garage extension. Dark grey bituminous
membrane laid perfectly flat and smooth, clean edge trim in light metal, a round roof drain
visible near the centre.

VIEWPOINT: From a slightly elevated angle, showing the surface stretching away and the clean
edge detail where the membrane meets the trim.

LIGHT AND MOOD: Overcast soft daylight, no harsh shadows. Precise, technical, well finished.

STYLE: Documentary architectural photography. Natural muted colours, realistic surface texture.

IMPORTANT — the image must NOT contain:
- any people
- any text, lettering, signage, logos or watermarks
- oversaturated colours or an artificial HDR look
```

---

## 4 · REFERENZ 3 → `projekt-3.jpg`

```
Create a photorealistic image in landscape format, aspect ratio 3:2, high resolution.
Use the same lighting mood and photographic style as a documentary roofing series.

SUBJECT: Two modern skylight windows freshly installed in a terracotta clay tiled pitched roof,
seen from outside at a slight angle. Clean metal flashing where the tiles meet the window frames,
wood-framed glass reflecting the sky.

LIGHT AND MOOD: Warm afternoon light, gentle reflections in the glass.

STYLE: Documentary architectural photography. Natural colours, sharp detail on the flashing and
tile edges.

IMPORTANT — the image must NOT contain:
- any people
- flat American asphalt shingles (European terracotta clay tiles only)
- any text, lettering, signage, logos or watermarks
- oversaturated colours or an artificial HDR look
```

---

## 5 · REFERENZ 4 → `projekt-4.jpg`

```
Create a photorealistic image in landscape format, aspect ratio 3:2, high resolution.
Use the same lighting mood and photographic style as a documentary roofing series.

SUBJECT: Close-up of a newly installed titanium-zinc rain gutter and downpipe at the eaves of a
German house. Precise soldered seams, clean brackets, terracotta roof tiles above, a rendered
facade behind.

VIEWPOINT: Close and slightly angled, so the gutter line leads diagonally through the frame.

LIGHT AND MOOD: Soft even daylight. Precise craftsmanship, quiet pride in the detail.

STYLE: Documentary craft photography. Natural colours, sharp material detail, visible metal
texture.

IMPORTANT — the image must NOT contain:
- any people
- any text, lettering, signage, logos or watermarks
- oversaturated colours or an artificial HDR look
```

---

## 6 · HANDWERK-DETAIL → `detail-handwerk.jpg`

```
Create a photorealistic image in landscape format, aspect ratio 3:2, high resolution.

SUBJECT: Extreme close-up of a roofer's weathered hands in worn leather work gloves, placing a
terracotta clay roof tile into position on wooden battens. The hands and the tile fill most of
the frame.

BACKGROUND: The roof surface falls away blurred behind, other tiles softly out of focus.

LIGHT AND MOOD: Warm natural daylight. Visible texture of clay, worn leather and raw wood.
Skilled, tactile, human.

STYLE: Documentary craft photography. Natural colours, shallow depth of field, sharp focus on
the hands and the tile edge.

IMPORTANT — the image must NOT contain:
- any face or head
- malformed hands — hands must have exactly five fingers and natural proportions
- any text, lettering, signage, logos or watermarks
- oversaturated colours or an artificial HDR look
```

---

## 7 · TEAM → `team.jpg`

```
Create a photorealistic image in landscape format, aspect ratio 3:2, high resolution.

SUBJECT: Three German roofers in dark work trousers and high-visibility vests standing on
scaffolding beside a half-finished tiled roof. All three have their backs to the camera, looking
out over the rooftops of a Bavarian town. Tools and a neat stack of clay tiles beside them.

LIGHT AND MOOD: Warm late-afternoon light, long shadows, end of a working day. Companionable,
grounded, no posing.

STYLE: Documentary photography. Natural colours, realistic work clothing with visible wear.

IMPORTANT — the image must NOT contain:
- any visible faces (strictly all seen from behind)
- any text, lettering, signage, logos or watermarks on clothing or equipment
- oversaturated colours or an artificial HDR look
```

---

## 8 · FIRMENWAGEN (optional) → `wagen.jpg`

```
Create a photorealistic image in landscape format, aspect ratio 3:2, high resolution.

SUBJECT: A clean white German panel van parked in front of a residential house. Aluminium
ladders on the roof rack, the side door open showing neatly organised tools and a stack of clay
roof tiles inside.

SETTING: A cobblestone street with typical Bavarian residential architecture behind.

LIGHT AND MOOD: Soft morning light. Tidy, professional, ready for work.

STYLE: Documentary photography. Natural colours, realistic materials.

CRITICAL: The van must be COMPLETELY BLANK white on all visible sides — absolutely no lettering,
no company name, no logo, no phone number, no decals of any kind. Plain unmarked paintwork only.

IMPORTANT — the image must NOT contain:
- any people
- any text, lettering, signage, logos or watermarks anywhere in the image
- oversaturated colours or an artificial HDR look
```

**Warum der Wagen blank sein muss:** Erfundene Beschriftung auf einem Fahrzeug sieht aus wie das
Angebot eines echten Betriebs. Das ist die Grenze, die eine Demo nicht überschreiten sollte.
Falls später Beschriftung gewünscht ist, kommt sie als HTML-Overlay darüber — dann ist sie
austauschbar, sobald ein echter Kunde das Template bekommt.

---

## Wenn ein Bild nicht sitzt

Hänge den passenden Satz unten an den Prompt an und erzeuge neu:

| Problem | Zusatz |
|---|---|
| Flache US-Schindeln statt Ziegel | `The roof must use traditional European terracotta clay tiles, never asphalt shingles.` |
| Zu glatt, wie ein Werbeprospekt | `Make it look like a real working site: slightly imperfect, everyday, documentary — not a commercial.` |
| Gesicht trotzdem sichtbar | `The person must be seen strictly from behind. No face, no profile, no reflection of a face.` |
| Schrift oder Logo im Bild | `There must be absolutely no text, letters, numbers, signage or logos anywhere in the image.` |
| Zu dunkel, kontraktarm | `Use bright even daylight with clear separation between the roof and the sky.` |
| Hände mit falschen Fingern | Neu erzeugen — das lässt sich nicht wegprompten. |
