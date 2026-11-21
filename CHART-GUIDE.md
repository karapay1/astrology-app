# How to add a new person's birth chart

This guide covers everything needed to add a chart to the site: fetching the
numbers, filling in the data object, and writing the copy. Section 4 (writing
style) is the part most often skipped. Read it before writing a word.

---

## 0. How charts get made

```
fetch-chart.js  ──►  data/raw/<id>.json  ──►  data/chart-data.js  ──►  index.html
 (VedAstro API)       (raw numbers)           (numbers + copy)         (the site)
                                                     │
                                                     └──►  export-md.js  ──►  charts/<Name>.md
```

- **The site reads only `data/chart-data.js`.** `index.html`, `share.html` and
  `compatibility.html` all load it as a plain script. Nothing else is read at
  runtime.
- **`data/raw/<id>.json` is the source of truth for numbers.** Every degree,
  score and placement in `chart-data.js` comes from here.
- **The copy is written by hand** (or by an agent following this guide) and
  goes straight into `chart-data.js`.
- **`charts/*.md` files are generated output**, made by
  `node scripts/export-md.js`. Never edit them and never build a chart from
  them. Re-run the script after any change to `chart-data.js`.

---

## 1. What you need from the person

| Field | Example |
|-------|---------|
| Full name | Kara Black |
| Date of birth | 1 September 1987 |
| **Exact** time of birth | 19:22 (7:22 PM), local clock time |
| City of birth | Scranton, PA, USA |

The time must be exact, not "around 7 pm." Without it the Ascendant, the
houses and the Moon position can all be wrong.

---

## 2. Pull the raw numbers from VedAstro

Run `scripts/fetch-chart.js`. It POSTs to `vedastro.zaishi.net`, uses the
**Raman** ayanamsa (the project standard, also used by the VedAstro MCP tools)
and saves `data/raw/<id>.json`. Houses are **whole-sign**.

```
node scripts/fetch-chart.js --name "Jane Smith" \
  --date "15/06/1990" --time "08:30" --tz "+05:30" \
  --location "19.0760,72.8777"
```

Set `VEDASTRO_API_KEY` to skip the free tier's 5-calls-a-minute throttle. The
key only works in the `x-api-key` header, which the script handles.

> ⚠️ **Pass coordinates, never a place name.** VedAstro's geocoder fails
> silently: it returns `Name: "Empty"` at lat 4.59, lon 101 (Malaysia) and
> computes the whole chart there. "Long Branch, NJ" hit exactly this. Always
> use `--location "LAT,LON"`, then confirm the echoed location in
> `results.LagnaSignName.Input.Parameters[0].Value.Location`.
>
> ⚠️ **Match the timezone to the season.** Use standard time in winter and
> daylight time in summer for the birth place. New Jersey is −05:00 (EST)
> roughly Nov–Mar and −04:00 (EDT) roughly Apr–Oct. One hour off shifts the
> Ascendant and every house.
>
> ⚠️ **The legacy host is broken.** `api.vedastro.org` (GET) now returns the
> same demo chart for every request. Don't use it or any URL built for it.

`methods.html` in this repo indexes all 1,190 VedAstro `Calculate` methods if
you need something the script doesn't fetch.

### What to take from the JSON

For each of the 9 planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn,
Rahu, Ketu): sign, degree, house, retrograde, nakshatra and pada, nakshatra
lord, sign lord, dignity, houses owned, houses aspected, navamsa (D-9),
shadbala, and ishta/kashta.

**Rahu and Ketu get no strength scores.** Shadbala and ishta/kashta are only
defined for the seven visible planets. The API still returns a
`PlanetShadbalaPinda` for the nodes, but it is a copy of another planet's value
(usually the lord of the sign they sit in). Leave `shadbala`, `ishta` and
`kashta` off the Rahu and Ketu objects entirely; the site hides the strength
bar when they are missing.

Take `dignity` from the API flags (`IsPlanetExalted`, `IsPlanetInOwnSign`,
`IsPlanetInFriendSign`, `IsPlanetInEnemySign`, `IsPlanetDebilitated`), and add
"/ combust" only when `IsPlanetCombust` is `"True"`. Don't judge combustion by eye.

The `role` string must agree with `housesOwned`. Call a planet yogakaraka
only if it rules both a kendra (1, 4, 7, 10) and a trikona (5, 9) for this
rising sign. Don't write "yogakaraka influence" for anything weaker.

For the ascendant: sign, degree, nakshatra.

For the 12 houses: the sign on each house and its occupants.

For the panchanga: sunrise, sunset, tithi and paksha, weekday, nakshatra and
pada, nithya yoga, karana, hora lord, lunar month, ayanamsa value.

For ashtakavarga: the points per sign and the total.

House lordship and Sarvashtakavarga are computed locally (whole-sign rulers
and the classical tables), because the API's versions are unreliable.

---

## 3. The data structure (`data/chart-data.js`)

Every chart is an object in the `charts` map. The key is a short lowercase id
that matches the `id` field. The comments show **where each field appears on
the site**, which matters for the writing rules in section 4.

```js
NEWID: {
  id: "NEWID",
  name: "First name",
  birth: {
    date: "01 September 1987",
    time: "19:22 (7:22 PM)",
    location: "Scranton, PA, USA",
    coordinates: "41.4087° N, 75.6621° W",
    timezone: "GMT−04:00",
  },
  system: {
    ayanamsa: "Raman (sidereal)",
    houseSystem: "Whole sign",
    source: "VedAstro · Swiss Ephemeris",
  },

  // Overview, top of the page, under "Your story". See §4 "The story".
  story: [
    "Paragraph 1 ...",
    "Paragraph 2 ...",
  ],

  ascendant: {
    sign: "Aquarius", degree: "12° 39'", nakshatra: "Shatabhisha",
    theme: "Personality",           // eyebrow label, keep as-is
    motto: "...",                   // Overview rising-sign card, under the title
    cardBlurb: "...",               // Overview summary card
    deepDive: [ "...", "...", "...", "..." ],  // Overview rising-sign card, ALL 4 shown
  },

  shadbalaRange: { min: 290, max: 550 },  // bar scale on the Planets tab: lowest of the
                                          // 7 planets' shadbala rounded down to the
                                          // nearest 10, highest rounded up

  planets: [
    {
      name: "Sun", abbr: "Su", sign: "Leo", degree: "16° 45'", house: 7,
      retrograde: false, nakshatra: "Purva Phalguni", pada: 2, nakshatraLord: "Venus",
      signLord: "Sun", housesOwned: [7], dignity: "Own sign", benefic: true,
      navamsa: "Virgo", shadbala: 403.65, ishta: 25.6, kashta: 31.2,
      aspectsHouses: [1], aspectsSigns: ["Aquarius"],
      role: "Lord of the 7th (partnership / maraka)",  // technical, facts panel only
      theme: "Core Self & Vitality",  // Planets-tab eyebrow, see label table in §4
      motto: "...",                   // Planets tab
      cardBlurb: "...",               // Sun and Moon ONLY: Overview summary card
      deepDive: [ "...", "...", "..." ],  // Planets tab shows all 3
      // Rahu and Ketu: no shadbala, ishta or kashta (see §2)
    },
    // ... all 9 planets
  ],

  houses: [
    { num: 1, sign: "Aquarius", theme: "Self, body, temperament", occupants: [],
      meaning: "..." },             // Houses tab
    // ... all 12
  ],

  highlights: [                     // Overview, "Signature themes"
    { title: "...", body: "..." },  // 4–6 of these
  ],

  nakshatra: {                      // the Moon's nakshatra
    name: "Jyeshtha", lord: "Mercury", deity: "Indra (king of the gods)",
    cardBlurb: "...",               // Overview summary card
    themes: "...",                  // Overview birth-star card
  },

  panchanga: {                      // Birth almanac tab
    summary: "...",
    sunrise: "06:32", sunset: "19:31",
    ayanamsa: "22° 13' 50″ (Raman)",
    limbs: [
      { k: "Vara (weekday)", v: "Tuesday", note: "..." },
      // Tithi, Nakshatra, Nithya Yoga, Karana, Hora lord, Lunar month
    ],
  },

  ashtakavarga: {                   // Energy map tab
    total: 337, average: 28,
    intro: "...",
    rows: [ { house: 1, sign: "Aquarius", bindus: 29, note: "..." }, /* 12 rows */ ],
    takeaways: [ "...", "...", "..." ],  // "What does this mean for you", 3–4 items
  },
}
```

**Not needed:** `remedyCandidate`, `deity`, `remedySupports`, `mantra` and
`mantraDay` appear in some charts, but neither the site nor `export-md.js`
reads them. Both use their own built-in remedy table (see §6). Leave them out
of new charts.

### Dignity values

Use one of these base strings, optionally followed by `(combust)`,
`(near-combust)` or `(retrograde)`, or joined with ` / combust`.

| Base string | Meaning |
|-------------|---------|
| `"Own sign"` | Planet in the sign it rules |
| `"Moolatrikona"` | Planet in its special strong sign |
| `"Exalted"` | Planet in its sign of maximum strength |
| `"Friendly sign"` | Planet in a sign ruled by a friend |
| `"Neutral"` | Planet in a sign with a neutral relationship |
| `"Enemy sign"` | Planet in a sign ruled by an enemy |
| `"Debilitated"` | Planet in its sign of minimum strength |
| `"North lunar node"` | Rahu (always) |
| `"South lunar node"` | Ketu (always) |

The site turns these into status badges automatically (`dignityBadgeContent`
in `index.html`): Strong · Home Field, Exalted · High Comfort, Comfortable ·
Supported, Neutral · Workable Placement, Challenged · Friction, Strained ·
Works Harder, Overshadowed · Merged with the Sun.

---

## 4. Writing style

The copy should read like a skilled astrologer talking to one person they
know well. The old copy was produced from a template, and it shows: every
planet opens the same way, every motto is three adjectives and a dash, and the
same few words ("quietly", "genuinely", "real") turn up in every paragraph.
Read across ten charts, it sounds generated.

The rules below exist to stop that. When they conflict with sounding natural,
sound natural, then check the hard limits.

### Each field has one job

A placement shows up in more than one place: the summary card on the Overview,
then the motto and reading on the Planets tab (or the rising-sign card for the
ascendant). If they say the same thing, the site repeats itself. Each field
must add something the others don't.

| Field | Its job | Length |
|-------|---------|--------|
| `story` | The chart's central theme and its main tension. The first thing the person reads. | 2 paragraphs, 70–110 words total |
| `cardBlurb` | The hook. The single most recognizable thing about this placement. | 2 sentences, under 45 words |
| `motto` | One concrete line about the person's life. Not a summary of the card. | Under 12 words |
| `deepDive[0]` | The opening of the reading. **New information**: how it shows up day to day. Must not restate the card. | 2–3 sentences |
| `deepDive[1–2]` | The deeper reading: a real-life example, what a strong or strained placement feels like, and one thing to work on. | 3–5 sentences each |
| `highlights` | The 4–6 patterns behind the story, each with a plain-English title. | 1–2 sentences each |
| `nakshatra.cardBlurb` / `themes` | The card is the hook; `themes` goes further. `themes` must not repeat the card. | 2 sentences / 3–4 sentences |
| `houses[].meaning` | What this area of life is like for them. | 2–3 full sentences |

Before moving on from a placement, read its `cardBlurb`, `motto` and
`deepDive[0]` together. If two of them make the same point, rewrite one.

### The story

The story is the narrative the rest of the chart hangs on. Find it from
**where the chart's weight sits**, in this order:

1. **The most crowded house.** Three or more planets in one house is almost
   always the headline.
2. **The chart ruler** (lord of the 1st house): where it sits and how strong
   it is.
3. **The luck planet** (the yogakaraka, or the 9th-house lord if there is no
   yogakaraka): where it sits and whether it's comfortable or strained.
   Check the yogakaraka against the rule in §2 rather than trusting `role`.
4. **Ashtakavarga**: the highest- and lowest-scoring houses, as supporting
   evidence.

Don't build the story from the strongest planet alone. That produces the same
story for every chart with a strong Saturn.

Name **one central theme** and **one tension**. Write it in plain language with
no planet jargon beyond planet and house names. Then, in the 2–3 planet
readings that make up the story, add one sentence that links back to it. Leave
the other planet readings alone. Don't bend every planet to fit the theme.

The story and the highlights must not overlap. The story is the theme; the
highlights are the specific patterns that support it.

### Vary the shape

- **No two planet readings in a chart may open with the same structure.** Bad:
  "Mars drives your energy…" / "Mercury drives your thinking…" / "Jupiter
  drives your growth…". Open with the person, a situation, a contrast, a habit,
  or the planet. Change it up each time.
- **Never open a reading by defining the planet** ("Mars is your drive,
  courage and initiative", "Rahu marks where…"). The theme label above the
  text already does that.
- **The planet → sign → house order is a checklist, not a sentence template.**
  Each reading should cover what the planet drives, how the sign colors it,
  and where the house points it. Cover them in any order, and fold them into
  what the person does rather than stating each one.
- **Mix sentence lengths.** Short sentences land. Use them after a long one.
- **Mottos are statements, not adjective lists.** Write a short sentence about
  their life, a habit, or how others see them.

### Voice

- Warm and direct, in second person ("you", "your").
- Commit. State the tendency, then the nuance. No "this could mean…" and no
  "you may or may not feel…".
- Show, don't announce. Instead of "This is a powerful placement," describe
  what it lets them do.
- Concrete over abstract. "You'll rewrite an email four times before sending
  it" beats "you value precision in communication."
- No bullet lists inside prose fields.

### Jargon

Technical terms belong in the facts panel and the status badge, never in
prose. That includes highlight titles, house meanings and ashtakavarga notes.

| Don't write | Write |
|-------------|-------|
| lagna, lagna lord | rising sign, chart ruler |
| kendra, trikona | (say what the house is about) |
| yogakaraka | the planet that brings you luck and joy |
| combust | very close to the Sun, overshadowed by it |
| stellium | four planets in one house |
| maraka, dusthana | (leave out) |
| bindus | points |
| debilitated, exalted, own sign | (leave to the badge, or describe how it feels) |
| "rules the 7th, sits in the 2nd" | what that means for their life |

Don't write "In Vedic astrology, X means…". Just say what it means. Don't
translate a sign's symbol literally ("the water-bearer who pours"). If you use
an image, it must turn into a concrete trait in the same sentence.

### Hard limits

Check these before finishing a chart. `node scripts/lint-copy.js <id>` checks
most of them automatically. If you change a rule here, change it in the lint
too. The compatibility page's copy lives in `src/compat-engine.js` and follows
the same rules with no em dashes at all. `node scripts/lint-copy.js --compat`
checks every string it can produce, for every pair.

**Em dashes (—)**
- None in `motto`, `cardBlurb`, `story` or highlight titles.
- At most one per paragraph anywhere else.
- Under 20 in the whole chart. The current charts average about 75.
- Replace with a period first, then a comma or colon. Usually two sentences
  read better than one sentence joined by a dash.

**Banned words.** Delete them. If the sentence feels empty without one, the
sentence needs a fact.
- quietly, genuinely, genuine, truly, deeply, really, unusually, remarkably,
  literally, simply, actually, incredibly
- "real" as an intensifier ("real strength", "a real gift")

**Banned phrases**
- "growth edge", "the key is", "here is the key", "here is the single most
  important thing", "in plain terms", "the good news", "the invitation is"
- "shines brightest", "comes alive", "lands strongest"
- "Sitting in your Nth house of…" to open a sentence

**Banned sentence shapes**
- Contrast reveals: "This is not X; it is Y." "Not X, but Y." "X, not Y."
  State Y and give the reason.
- Self-answered questions: "The result? …"

**Caps**
- "rather than": at most 3 per chart. The current charts average 12.
- Lists of three ("warm, generous, and magnetic"): at most one per paragraph.
- Sentences starting with "Because": at most 2 per chart.

### Theme labels (planet eyebrows)

Use exactly these. They are also the role labels on the Overview cards.

| Body | `theme` |
|------|---------|
| Sun | Core Self & Vitality |
| Moon | Emotional Inner World |
| Mars | Drive & Courage |
| Mercury | Mind & Communication |
| Jupiter | Wisdom & Growth |
| Venus | Love & Beauty |
| Saturn | Discipline & Endurance |
| Rahu | What You're Reaching For |
| Ketu | What You Already Know |

### Highlights

Pick 4–6 patterns that support the story. Each title is plain English and says
what it means: "Four planets in your house of partnership," not "A four-planet
Leo stellium in the 7th." Each body answers *what does this mean for this
person's life?*

### House meanings

Write full sentences in second person. Don't use the "Gemini 5th: playful,
versatile…" fragment style. If the house has occupants, lead with what they
bring to that area of life. If it's empty, say where its ruling planet sits
and how that carries the house's themes elsewhere.

### Worked example: Kara

**Story** (built from four planets in the 7th, the luck planet Venus strained
there, and the chart ruler Saturn strong in the 10th)

> Four of your nine planets sit in your house of partnership, your Sun among
> them. You come most alive beside someone else: a partner, a close friend, a
> collaborator. Your work and your sense of self grow fastest when you share
> them.
>
> Venus is there too. It governs your home, your peace and your luck, and it is
> the weakest planet in your chart. Love is where you shine, and it is also
> where good things need deliberate care. Your strongest planet, Saturn,
> anchors your career and gives you steady ground to build the rest on.

**Moon: card, motto and reading, each doing a different job**

> ~~Card: "Your emotional core runs deep and private — you feel intensely…"~~
> ~~Motto: "Deep, loyal, and quietly intense — you feel everything and show little."~~
> ~~Reading: "Your emotional world runs deep, private, and intense — you feel everything strongly…"~~
>
> **Card:** Your feelings run deep and you keep them close. Your Moon sits in
> your house of career, so your mood follows your work: when the job means
> something, you're steady.
>
> **Motto:** You feel everything. Your colleagues rarely see it.
>
> **Reading:** You'd rather lead than be led, and a heavy-handed boss can make
> you miserable. What you want underneath is recognition, from the wider world
> and from your own people. You have the charisma to earn it.

**Ascendant motto**

> ~~Inventive, independent, and endlessly curious — you lead with the mind.~~
>
> You'd rather understand how a thing works than own it.

**A planet opening**

> ~~Mars is your drive, courage, and initiative, and in Leo it makes you strong,
> confident, and daring — real willpower, and very little rattles you.~~
>
> Very little rattles you. Your Mars is in bold, warm Leo, and it sits in your
> house of partnership, so your fire comes out most around the people you're
> closest to. You fall fast, and you fight for the people you love.

---

## 5. Checklist before adding the chart

**Data**
- [ ] Birth time is exact, not approximate
- [ ] Fetched with coordinates, and the echoed location in the raw JSON matches
- [ ] Timezone matches the season (standard or daylight time)
- [ ] All 9 planets and all 12 houses filled in
- [ ] `id` matches the key in the `charts` map
- [ ] `shadbalaRange` brackets the 7 planets' shadbala (rounded to 10s)
- [ ] Rahu and Ketu have no `shadbala`, `ishta` or `kashta`
- [ ] Each `role` matches `housesOwned`; "combust" only where the API says so
- [ ] The 12 ashtakavarga values add up to `total`

**Copy**
- [ ] `story` written, built from where the chart's weight sits
- [ ] For Sun, Moon and ascendant: card, motto and `deepDive[0]` each make a
      different point
- [ ] No two planet readings open with the same structure
- [ ] Em dashes: none in mottos, cards, story or highlight titles; under 20 total
- [ ] No banned words, phrases or sentence shapes (§4 Hard limits)
- [ ] No jargon in prose, highlight titles, house meanings or ashtakavarga notes
- [ ] Theme labels match the table in §4

**After saving**
- [ ] `node scripts/lint-copy.js <id>` shows no errors
- [ ] Run `node scripts/export-md.js` to regenerate `charts/*.md`
- [ ] Open `index.html` and read the Overview from top to bottom

---

## 6. Reference: planet mantras and deities

The site's remedy section comes from `PLANET_REMEDIES` in `index.html`, and
`export-md.js` keeps its own copy. This table is for reference only. Don't
copy it into chart data.

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

## 7. Brief for an agent writing a chart

In Claude Code, the `write-chart` project skill (`.claude/skills/write-chart/`)
runs this whole process and loads the guide automatically. For any other
agent, give it this brief along with the raw JSON:

```
Write the chart entry for [Name] in data/chart-data.js.

1. Read CHART-GUIDE.md in full. Section 3 is the data shape; section 4 is the
   writing style, and its hard limits are requirements, not suggestions.
2. Take every number from data/raw/[id].json. Never guess a value.
3. Before writing any planet copy, decide the story (§4 "The story"): find
   where the chart's weight sits, and name one central theme and one tension.
4. Write the story first, then the ascendant, Sun and Moon, then the other
   planets, then houses, highlights, nakshatra, panchanga and ashtakavarga.
5. Run node scripts/lint-copy.js [id] and fix every error. Rerun until clean.
   Don't swap in synonyms; rewrite the sentence from the fact underneath it.
6. Check the chart against the §5 checklist and fix anything that fails.
7. Run node scripts/export-md.js.
8. Report the story you used and the lint result before and after.
```
