# Vedic Astrology

A small, self-contained site for storing generated Vedic astrology content and
viewing it in the browser. No build step, no framework, no dependencies — open
`index.html` and it works. Supports **multiple charts** with a picker and
**link-based sharing** so you can send someone a link that only reveals the
charts you chose.

## What's here

```
.
├── index.html                 # The web viewer (open this in a browser)
├── share.html                 # Share-link generator (pick charts → get a link)
├── methods.html               # Searchable catalog of VedAstro Calculate methods
├── data/
│   ├── chart-data.js           # Source of truth — all chart data + interpretations
│   ├── access.js               # Link-based access control (which charts a link shows)
│   └── calculate-methods.js    # Catalog of 1,190 VedAstro calculation methods
└── README.md
```

The viewer reads its content from `data/chart-data.js`, which assigns a plain
object to `window.VEDIC_DATA`. Keeping the data in a `.js` file (instead of a
`.json` loaded via `fetch`) is deliberate: browsers block `fetch()` from
`file://` pages, so this lets you just **double-click `index.html`** and see
everything, offline.

## Open it

- Double-click `index.html`, or
- From a terminal: `open index.html` (macOS).

Optional: to serve over http, run `python3 -m http.server` in this folder and
visit `http://localhost:8000`.

## What the viewer shows

- **Overview** — a plain-language *Personality* (rising-sign) reading, the Rasi
  (D-1) chart drawn South-Indian style, signature themes, and the birth-star
  (nakshatra) summary.
- **Planets** — pick any planet for a warm, plain-language deep dive: how the
  placement shows up in real life, plus sign, degree, house, dignity, strength
  (Shadbala), nakshatra + lord, navamsa (D-9), houses ruled, and aspects.
- **Houses** — all twelve houses with signs, life areas, occupants, and meaning.
- **Panchanga** — the five "limbs" of the birth day (tithi, vara, nakshatra,
  yoga, karana) plus sunrise/sunset and hora lord.
- **Ashtakavarga** — the Sarvashtakavarga bindu grid (strength/support by house),
  colour-coded, with a per-house reading.

## Multiple charts & the person picker

`data/chart-data.js` holds a `charts` object keyed by id (`kara`, etc.). When
more than one chart is present, a **"Viewing" dropdown** appears in the header so
you can switch between people. No code changes needed — the picker is built
automatically from whatever charts exist (and whatever a share link allows).

## Add another person's chart

1. Open `data/chart-data.js`.
2. Add a new entry under `charts`, using the existing `kara` entry as a template.
   Keep the same shape and be sure to set a unique **`id`** (e.g. `"mom"`) that
   matches the object key:

   ```js
   charts: {
     kara: { /* ... */ },
     mom: {
       id: "mom",
       name: "Mom",
       birth: { /* ... */ },
       // ascendant, planets[], houses[], highlights[], nakshatra,
       // panchanga, ashtakavarga — same fields as kara
     }
   }
   ```

3. That's it — reload the viewer and the new person appears in the picker.

> Want figures calculated for you? Provide **name, date, exact time, and
> birthplace**; the data is pulled from VedAstro's `Calculate` API (Raman
> ayanamsa, whole-sign houses) and cross-checked by nakshatra. Note VedAstro's
> geocoder can be picky — verify the resolved coordinates (we caught it
> resolving "Scranton, PA, USA" to Bradford; plain "Scranton" was correct).

## Sharing with permissions

This site uses **soft, link-based permissions**:

- A share link controls **which charts the viewer will display**.
- The raw data still lives in `data/chart-data.js`, so this is **not**
  cryptographic privacy — a technical visitor could open that file directly.
  It's ideal for trust-based sharing with friends & family, not for secrets.

**Make a link:** open `share.html`, tick the charts to include, set the site
address (your public URL), and copy the generated link.

How links encode access (handled by `data/access.js`):

| Link | Result |
|------|--------|
| `index.html` (no params) | **Owner view** — shows all charts |
| `index.html?s=<token>` | Shows only the charts in the token |
| `index.html?charts=kara,mom` | Human-readable equivalent of the token |
| `index.html?c=<id>` | Opens on a specific chart first |

The `s` token is `base64url(JSON array of chart ids)`.

## Hosting on GitHub Pages + embedding in Webflow

Because it's plain static files, the simplest setup is:

1. **Host on GitHub Pages.** Push this folder to a repo, then enable
   *Settings → Pages* (deploy from the `main` branch, root). Your site becomes
   `https://<you>.github.io/<repo>/index.html`.
2. **Generate links against that URL.** In `share.html`, set the *Site address*
   field to your GitHub Pages `index.html` URL so every generated link points at
   the public site.
3. **Embed in Webflow** (two options):
   - *Link out* — add a normal button/link in Webflow pointing to a share link.
     Simplest, and share links work exactly as designed.
   - *Embed inline* — add an **Embed** element on a Webflow page containing an
     iframe:

     ```html
     <iframe src="https://<you>.github.io/<repo>/index.html?s=<token>"
             style="width:100%;height:1200px;border:0"></iframe>
     ```

     Give each shared person a Webflow page (or a share link) whose iframe `src`
     carries their token.

> Prefer not to host on GitHub Pages? Any static host works (Netlify, Vercel,
> or Webflow's own hosting if you upload the files). Just point `share.html`'s
> *Site address* field at wherever `index.html` lives.

## Method catalog (`methods.html`)

A searchable, filterable index of **1,190 calculation methods** from VedAstro's
open-source `Library/Logic/Calculate`. Each can be called via VedAstro's API:

```
https://api.vedastro.org/api/Calculate/<MethodName>/.../Ayanamsa/RAMAN
```

## Data source & method

All figures are calculated by [VedAstro](https://vedastro.org) (Swiss Ephemeris)
using the **Raman ayanamsa** (sidereal) and **whole-sign houses**, verified
against the raw `Calculate` API and cross-checked by nakshatra.

## Roadmap ideas

- Dasa (Vimshottari planetary periods) timeline
- Current transits (Gochara) view
- Compatibility / match reports between two charts
