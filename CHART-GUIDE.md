# How to add a new person's birth chart

This guide tells you everything you need to create a fully-styled chart entry
for the `data/chart-data.js` file from scratch — calculation, data structure,
and writing style.

---

## 1. What you need from the person

| Field | Example |
|-------|---------|
| Full name | Kara Black |
| Date of birth | 1 September 1987 |
| **Exact** time of birth | 19:22 (7:22 PM) — time zone or city |
| City of birth | Scranton, PA, USA |

The time must be exact (not "around 7 pm"). Without it the Ascendant, house
cusps, and Moon position can be wrong.

---

## 2. Pull the raw numbers from VedAstro

Use the **VedAstro Calculate API** at `https://api.vedastro.org`. The ayanamsa
must be **LAHIRI** and the house system is **whole-sign**.

> ⚠️ VedAstro's geocoder can misfire. Always confirm the latitude/longitude it
> resolved. "Scranton, PA, USA" was once resolved to Bradford (UK) — using
> plain "Scranton" fixed it.

### Useful API endpoints (replace `{...}` with actual values)

```
# Planet positions (all 9 Vedic planets + Rahu/Ketu)
https://api.vedastro.org/api/Calculate/AllPlanetData/Location/{City}/Time/{HH:MM}/{DD}/{MMM}/{YYYY}/{+HH:MM}/Ayanamsa/LAHIRI

# Ascendant
https://api.vedastro.org/api/Calculate/LagnaSign/...

# Shadbala (planetary strength in Rupas)
https://api.vedastro.org/api/Calculate/PlanetShadbalaPinda/...

# Ashtakavarga (bindu grid)
https://api.vedastro.org/api/Calculate/AshtakavargaTable/...

# Panchanga limbs
https://api.vedastro.org/api/Calculate/Tithi/...  (and Vara, NithyaYoga, Karana, etc.)
```

The `methods.html` file in this repo is a searchable index of all 1,190
available `Calculate` methods if you need something else.

### Source of truth: always use the JSON file

Once a chart has been fetched with `scripts/fetch-chart.js`, the raw data is
saved to `data/raw/<id>.json`. **That JSON file is the authoritative source of
truth for every numerical value.** Never build a chart entry from a
`charts/*.md` summary file — those are narrative documents derived from the
JSON and may omit, round, or paraphrase values. Always read the JSON directly
when building or updating a `data/chart-data.js` entry.

If a JSON file does not yet exist for the person, run `fetch-chart.js` first
(see the script's `--help` for usage). Do not proceed from a `.md` file alone.

### What to record from the API

For each of the 9 planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn,
Rahu, Ketu):

- Sign (rashi)
- Degree (e.g. 15° 18')
- House (1–12, whole-sign)
- Retrograde (yes / no — Rahu and Ketu are always retrograde by convention)
- Nakshatra and pada (1–4)
- Nakshatra lord
- Sign lord (which planet rules that sign)
- Dignity (own / exalted / friendly / neutral / enemy / debilitated / combust)
- Houses owned (lordship — which house numbers this planet rules for this
  ascendant)
- Houses aspected (Vedic aspects from this house position)
- Navamsa sign (D-9)
- Shadbala (in Rupas)
- Ishta phala and Kashta phala (ease and challenge scores — not available for
  Rahu/Ketu)
- Benefic or malefic classification for this ascendant

For the ascendant:
- Sign, degree, nakshatra

For the 12 houses:
- Sign on each house cusp (whole-sign: the house sign = its number in the wheel
  relative to the ascendant)
- Which planets (if any) occupy each house

For the panchanga:
- Sunrise and sunset times
- Tithi (lunar day) and paksha (waxing/waning)
- Vara (weekday / weekday ruler)
- Nakshatra + pada
- Nithya yoga name
- Karana name
- Hora lord (planetary hour at birth time)
- Lunar month name
- Ayanamsa value (e.g. 23° 41' 04″)

For ashtakavarga:
- Sarvashtakavarga total (sum across 12 signs)
- Per-sign (= per-house) bindu count (0–56 range in sarva)

---

## 3. The data structure (`data/chart-data.js`)

Every chart is an object added to the `charts` map in `data/chart-data.js`.
The key must be a short lowercase id matching the `id` field (e.g. `"kara"`,
`"thor"`, `"mom"`).

```js
window.VEDIC_DATA = {
  charts: {
    kara: { /* existing */ },
    NEWID: {
      id: "NEWID",
      name: "Full Name",
      birth: {
        date: "DD Mmm YYYY",      // "01 Sep 1987"
        time: "HH:MM",             // "19:22"
        place: "City, State, Country",
        lat: 00.0000,
        lon: -00.0000,
        tz: "GMT-04:00",
        system: "Lahiri · Whole sign · VedAstro"
      },

      // --- ASCENDANT ---
      ascendant: {
        sign: "Aquarius",
        degree: "11° 12'",
        nakshatra: "Shatabhisha",
        theme: "The water-bearer who gathers and stores knowledge",
        motto: "One short resonant phrase about this ascendant",
        deepDive: [
          // Paragraph 1 = LEAD PORTRAIT (see §4): one tight, cohesive statement —
          //   outer-lens function + concrete sign traits + where their power
          //   shines. No literal symbol ("the pot that pours water").
          // Paragraphs 2–5 = deeper reading, same clarity rules: temperament,
          //   career/ambition tendencies, social style, key growth areas.
          "Paragraph 1 ...",
          "Paragraph 2 ...",
          "Paragraph 3 ..."
        ]
      },

      shadbalaRange: { min: 289, max: 537 }, // min/max from this chart's planets

      // --- PLANETS (array of 9) ---
      planets: [
        {
          name: "Sun",           // exact spelling used everywhere
          abbr: "Su",
          sign: "Leo",
          degree: "15° 18'",
          house: 7,
          retrograde: false,
          nakshatra: "Purva Phalguni",
          pada: 1,
          nakshatraLord: "Venus",
          signLord: "Sun",
          housesOwned: [7],      // array of house numbers this planet rules
          dignity: "Own sign",   // see dignity values below
          benefic: true,         // true = functional benefic for this ascendant
          navamsa: "Leo",
          shadbala: 445.38,
          ishta: 26,             // null for Rahu/Ketu
          kashta: 31,            // null for Rahu/Ketu
          aspectsHouses: [1],    // houses aspected from this house position
          aspectsSigns: ["Aquarius"],
          role: "Lord of the 7th (partnership / maraka)",
          theme: "External Persona · Leo — generous, and lives to express itself",
          motto: "One short phrase",
          deepDive: [
            // Paragraph 1 = LEAD PORTRAIT (see §4): fuse the three beats into one
            //   tight statement — what this planet drives + concrete planet-in-sign
            //   traits + the house focused as a lived outcome ("your power shines
            //   when…"). Keep dignity OUT of the prose (it renders as a status tag).
            // Paragraphs 2–4 = deeper reading, same clarity rules: the core
            //   personality energy, what the placement feels like in real life
            //   (explain a strained/exalted placement WITHOUT leaning on the
            //   Sanskrit label), and a practical growth edge.
            "Paragraph 1 ...",
            "Paragraph 2 ...",
            "Paragraph 3 ..."
          ],
          // --- Remedy section ---
          remedyCandidate: true,  // true if challenge score > ease score (or for nodes)
          deity: "Surya, the Sun god",
          remedySupports: "vitality, confidence, health, authority",
          mantra: "Om Hraam Hreem Hraum Sah Suryaya Namah",
          mantraDay: "Sunday"
        },
        // ... repeat for all 9 planets
      ],

      // --- HOUSES (array of 12) ---
      houses: [
        {
          num: 1,
          sign: "Aquarius",
          theme: "Self, body, temperament",
          occupants: [],          // planet name strings, e.g. ["Sun", "Mars"]
          meaning: "Plain-English paragraph about what this house in this sign
                    means for the person, and what any occupants bring here."
        },
        // ... houses 2–12
      ],

      // --- SIGNATURE HIGHLIGHTS (shown on Overview tab) ---
      highlights: [
        {
          title: "A four-planet Leo stellium in the 7th",
          body: "One or two sentences about why this cluster matters and what it
                 means in real life for this person."
        },
        // 3–5 highlights total. Pick the most defining patterns:
        //   - major stelliums or conjunctions
        //   - the chart ruler's placement
        //   - yogakaraka or raja yoga if present
        //   - the Rahu/Ketu axis theme
        //   - any standout dignity (exalted or severely debilitated planet)
      ],

      // --- NAKSHATRA (birth star — the Moon's nakshatra) ---
      nakshatra: {
        name: "Jyeshtha",
        lord: "Mercury",
        deity: "Indra",
        themes: "One sentence describing this person through the lens of their
                 birth star. E.g.: '\"The eldest.\" Seniority, protectiveness,
                 hidden strength, and responsibility that arrives early — a
                 natural (if sometimes reluctant) leader who guards others and
                 prefers depth to surface.'"
      },

      // --- PANCHANGA (birth almanac) ---
      panchanga: {
        summary: "One sentence readable summary of the birth day quality, e.g.:
                  'Born on a Tuesday, waxing 9th lunar day, Vishkambha yoga,
                   Saturn ruling the birth hour.'",
        sunrise: "06:32",
        sunset: "19:31",
        ayanamsa: "23° 41' 04″ (Lahiri)",
        limbs: [
          {
            label: "Vara (weekday)",
            value: "Tuesday",
            note: "Plain-English sentence about what this weekday ruler adds to
                   the birth chart. E.g.: 'The day is ruled by Mars — courage,
                   drive, initiative and heat. It reinforces the strong Mars
                   theme already in your chart, giving your baseline temperament
                   a dynamic, action-first flavor.'"
          },
          {
            label: "Tithi (lunar day)",
            value: "Navami · Shukla Paksha",
            note: "..."
          },
          {
            label: "Nakshatra (star)",
            value: "Jyeshtha · pada 3",
            note: "..."
          },
          {
            label: "Nithya Yoga",
            value: "Vishkambha — \"supporting pillar\"",
            note: "..."
          },
          {
            label: "Karana (half-tithi)",
            value: "Balava",
            note: "..."
          },
          {
            label: "Hora lord (birth hour)",
            value: "Saturn",
            note: "..."
          },
          {
            label: "Lunar month",
            value: "Bhaadrapada",
            note: "..."
          }
        ]
      },

      // --- ASHTAKAVARGA ---
      ashtakavarga: {
        total: 337,
        average: 28,
        intro: "One or two sentences pointing to the most striking feature of
                this person's ashtakavarga map — e.g. which house scores highest
                and what that signals.",
        rows: [
          // 12 rows, one per house
          { house: 1, sign: "Aquarius", bindus: 29,
            note: "Plain-English sentence for this house's score." },
          { house: 2, sign: "Pisces",   bindus: 27, note: "..." },
          // ... houses 3–12
        ],
        takeaways: [
          // 3–5 bullet-style strings that summarise the most important patterns
          // in the bindu map. E.g.:
          "The 5th house's chart-high 36 bindus is a standout: creativity, intelligence and matters of the heart are exceptionally well supported.",
          "The 9th (Libra, 20) and 7th (Leo, 23) score lowest — fortune and partnership reward patience and cultivation.",
          "For timing: transiting Jupiter and Saturn tend to give better results moving through high-bindu signs."
        ]
      }
    }
  }
};
```

### Dignity values (use exactly these strings)

| String | Meaning |
|--------|---------|
| `"Own sign"` | Planet in the sign it rules |
| `"Exalted"` | Planet in its sign of maximum strength |
| `"Friendly sign"` | Planet in a sign ruled by a friend |
| `"Neutral"` | Planet in a sign with neutral relationship |
| `"Enemy sign"` | Planet in a sign ruled by an enemy |
| `"Debilitated"` | Planet in its sign of minimum strength |
| `"Combust"` | Planet too close to the Sun (within ~6–8°) |
| `"Friendly (near-combust)"` | Friendly sign but within combust range |
| `"Enemy sign / combust"` | Both enemy and combust |
| `"North lunar node"` | Rahu (always use this) |
| `"South lunar node"` | Ketu (always use this) |

---

## 4. Writing style guidelines

The goal is a personal portrait, not a reference manual. The old style stacked
facts — *"Sun in Pisces. Sun governs identity. Pisces is empathetic. Resources
and voice. Neutral placement."* — a bag of ingredients that never tells you what
cake you're baking. The new style fuses those facts into one clear, actionable
portrait.

### The cohesive-portrait formula

Write every placement as one flowing statement built from three linked beats:

1. **Function** — what this planet drives (core identity, emotional world, drive,
   communication, etc.).
2. **Expression** — how the sign colors that function, in *concrete traits*.
   Never translate the sign's symbol literally.
3. **Direction** — what the house focuses it on, phrased as a lived outcome:
   *when* and *where* the person's power shines, peace flourishes, confidence
   lands. This replaces the old lordship "math" ("rules the 7th, sits in the 2nd").

> **Before (fragmented):** "Sun in Pisces. Sun governs identity. Pisces is
> empathetic. Resources and voice. Neutral placement."
>
> **After (cohesive):** "The Sun drives your core identity, confidence, and
> vitality. In visionary Pisces, that self-expression turns empathetic, intuitive,
> and soulful — and because it's focused on your 2nd house of voice and values,
> your power shines brightest when you speak from the heart and share your vision
> with the world."

### Two levels of depth

- **Lead portrait** — the Overview cards, and the *first* paragraph of every
  planet's `deepDive`. The tight 2–3 sentence cohesive version above. This is
  what most readers actually see; make it land on its own.
- **Deeper reading** — the remaining `deepDive` paragraphs, shown in the
  Planets-tab accordions. May run longer, but follows the same rules: fuse facts
  into meaning, no jargon, no literal symbols.

### Placement Status tag (dignity)

Keep dignity **out of the prose.** The app renders it as a separate status tag
derived from the `dignity` field. Use these plain translations so every chart
reads consistently:

| `dignity` value | Status tag |
|-----------------|-----------|
| Own sign | Strong · At Home |
| Exalted | Exalted · High Comfort |
| Friendly sign | Comfortable · Supported |
| Neutral | Neutral · Workable |
| Enemy sign | Strained · Works Harder |
| Debilitated | Challenged · Growth Through Effort |
| Combust | Overshadowed · Merged with the Sun |

The deeper reading may still *explain* what a strained or exalted placement feels
like in real life — it just shouldn't lean on the Sanskrit label to do it.

### Standard heading & role labels

Heading: `Sign + Body (House)` — e.g. "Taurus Moon (4th House)".
Subhead: the heading followed by a plain role label:

| Body | Role label |
|------|-----------|
| Ascendant | Your Outer Lens |
| Sun | Core Purpose |
| Moon | Emotional Inner World |
| Birth star (nakshatra) | Your Birth Star |
| Any other planet | that planet's function (e.g. "Drive & Courage" for Mars) |

### Voice

- Warm, direct, second-person ("you", "your").
- No Sanskrit jargon in the narrative — technical terms live in the facts table
  and the status tag, not the portrait.
- No "this could mean..." hedging. State the tendency, then give the nuance.
- Plain sentences. No bullet lists inside portrait paragraphs.

### For highlights

Pick 4–6 patterns that define this chart. Each should answer: *"What does this
mean for this specific person's life?"* — not just what the yoga is called.

### For house meanings

If a house has occupants, lead with what those planets bring to that life area.
If empty, note that the ruling planet (sign lord) carries the house's themes
elsewhere, and name where that planet sits.

### Avoid

- **Literal symbol translation** — "the water-bearer who gathers and pours water,"
  "the red one." Lead with traits (inventive, magnetic, grounded). Imagery is fine
  only if it *immediately* cashes out into a concrete trait.
- **Fragmented fact-stacking** — "Sun governs X. Sign is Y. Neutral placement."
- **Lordship math in prose** — "rules the 7th sitting in the 2nd." Say what it
  means for their life instead.
- Degrees, nakshatra padas, or shadbala numbers in the narrative — those stay in
  the facts table.
- "This is a powerful placement" (show it); "you may or may not feel…" (commit).
- Phrases like "in Vedic astrology, X means…" — just say what X means.
- Any text that assumes the reader knows what a house, sign, or planet is.

### Worked rewrites (Overview cards)

**Aquarius Ascendant**

> ~~Your rising sign is Aquarius, and everything about you is shaped by that
> symbol: the pot that gathers, holds and pours out water.~~
>
> **Aquarius Ascendant · Your Outer Lens**
> You meet the world as an open-minded visionary — inventive, distinct, and
> community-minded. Your power shines brightest when you bring people together
> around fresh, meaningful ideas.

**Taurus Moon**

> ~~Your Moon is exalted in Taurus — the very best sign the Moon can occupy — and
> it sits in your 4th house of home, mother, inner peace and emotional roots.~~
>
> **Taurus Moon (4th House) · Emotional Inner World**
> Your emotional core is naturally serene, steady, and grounded. Sitting in your
> 4th house of home, your peace flourishes when you build a cozy sanctuary and
> nurture reliable bonds.
> *Placement Status: Exalted · High Comfort*

**Rohini Birth Star**

> ~~"The red one" — the Moon's most beloved nakshatra, associated with fertility,
> magnetism and growth…~~
>
> **Rohini Nakshatra · Your Birth Star**
> Guided by magnetism and growth, your inner world thrives on beauty, warmth, and
> life's simple pleasures. You have a natural charm that draws people in and helps
> whatever you tend to flourish.

**Pisces Sun**

> ~~Your Sun rules the 7th house of partnership… and it sits in your 2nd house of
> speech, resources and family.~~
>
> **Pisces Sun (2nd House) · Core Purpose**
> Driven by deep empathy and vision, your core identity is soulful and intuitive.
> Focused on your 2nd house of voice and values, your confidence shines when you
> speak from the heart and share your vision.
> *Placement Status: Neutral · Workable*

---

## 5. Quick checklist before adding the chart

- [ ] Confirmed birth time is exact, not approximate
- [ ] Confirmed VedAstro resolved the correct coordinates
- [ ] Cross-checked Moon nakshatra against at least one other calculator
- [ ] All 9 planets filled in (including Rahu and Ketu)
- [ ] All 12 houses filled in
- [ ] `id` in the object matches the key in the `charts` map
- [ ] `shadbalaRange` reflects the actual min/max from this chart's shadbala values
- [ ] Ashtakavarga total adds up (sum of the 12 bindu values = `total`)
- [ ] DeepDive paragraphs written in second person, no Sanskrit jargon
- [ ] Remedy section filled for all planets (day, mantra, deity, supports)
- [ ] `charts/FIRSTNAME.md` source document written (optional but recommended —
      use `charts/Kara.md` as the template)

---

## 6. Reference: planet mantras and deities

| Planet | Deity | Supports | Mantra | Day |
|--------|-------|----------|--------|-----|
| Sun | Surya / Shiva | vitality, confidence, health, authority | Om Hraam Hreem Hraum Sah Suryaya Namah | Sunday |
| Moon | Chandra / Parvati | emotions, calm, mind, mother, contentment | Om Shraam Shreem Shraum Sah Chandraya Namah | Monday |
| Mars | Skanda / Hanuman | courage, drive, energy, discipline, protection | Om Kraam Kreem Kraum Sah Bhaumaya Namah | Tuesday |
| Mercury | Vishnu (Budha) | intellect, communication, learning, business | Om Braam Breem Braum Sah Budhaya Namah | Wednesday |
| Jupiter | Brihaspati / Brahma | wisdom, growth, luck, teachers, faith | Om Graam Greem Graum Sah Gurave Namah | Thursday |
| Venus | Shukra / Lakshmi | love, relationships, beauty, comfort, creativity | Om Draam Dreem Draum Sah Shukraya Namah | Friday |
| Saturn | Shani / Hanuman | discipline, patience, endurance, long-term work | Om Praam Preem Praum Sah Shanaischaraya Namah | Saturday |
| Rahu | Durga | ambition, worldly desires, overcoming obstacles | Om Bhraam Bhreem Bhraum Sah Rahave Namah | Saturday |
| Ketu | Ganesha | spirituality, insight, detachment, letting go | Om Sraam Sreem Sraum Sah Ketave Namah | Tuesday |

---

## 7. Example prompt for generating interpretations

Once you have the raw numbers, paste this into a new Claude chat along with
the full planet/house data:

```
You are writing a personal Vedic astrology portrait for [Name].

Birth details: [date, time, place]
Ascendant: [sign, degree, nakshatra]
[paste full planet list and house list]

Write the chart entry in the style described below. Every section should be
warm, personal, plain-English — no Sanskrit jargon in the narrative, no hedging,
no generic phrases. Write in second person ("you", "your"). Aim for the depth
and specificity of a skilled human astrologer talking directly to this person.

Write every placement as a COHESIVE PORTRAIT, not a list of facts. Fuse three
beats into flowing prose: (1) what the planet drives, (2) how the sign colors it
in concrete traits — never translate the symbol literally, (3) what the house
focuses it on, phrased as a lived outcome ("your power shines when…"). Keep
dignity out of the prose — it renders as a separate status tag.

For each planet's deepDive:
- Paragraph 1 (the lead): the tight 2–3 sentence cohesive portrait above.
- Paragraphs 2–4 (deeper reading): the core personality energy, what the
  placement feels like in real life (explain a strained/exalted placement
  without leaning on the Sanskrit term), and a practical growth edge.

For the ascendant deepDive:
- Paragraph 1 (the lead): outer-lens function + concrete traits + where their
  power shines.
- Following paragraphs: temperament, career/ambition, social style, and key
  growth areas.

For houses:
- If occupied: what those planets bring to that zone
- If empty: where the ruling planet sits and how that redirects the house's energy

For highlights: 4–6 defining patterns, each with a title and one or two sentences
on what it means for this person's actual life.

Output as a filled-in JSON object matching the chart-data.js structure in
the Vedic-astrology repo (see CHART-GUIDE.md for the full schema).
```

---

*See `charts/Kara.md` for a complete worked example of a finished chart in
narrative form, and `data/chart-data.js` for the actual data objects.*
