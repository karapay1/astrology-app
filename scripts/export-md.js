/*
 * Export each chart in data/chart-data.js to a standalone Markdown file.
 * Usage:  node scripts/export-md.js
 * Output: charts/<Name>.md  (one file per person)
 *
 * Re-run this any time you add or edit a person in data/chart-data.js.
 */
const fs = require("fs");
const path = require("path");

// --- load the browser-oriented data file with a tiny window shim ---
global.window = {};
require(path.join(__dirname, "..", "data", "chart-data.js"));
const CHARTS = global.window.VEDIC_DATA.charts;

// Deities + bija (seed) mantras (kept in sync with index.html PLANET_REMEDIES)
const REMEDIES = {
  Sun:     { deity: "Surya, the Sun god (Sūrya) — also Shiva", governs: "vitality, confidence, health, father, authority", mantra: "Om Hraam Hreem Hraum Sah Suryaya Namah", day: "Sunday" },
  Moon:    { deity: "Chandra, the Moon god (with Parvati / Gauri)", governs: "emotions, calm, the mind, mother, contentment", mantra: "Om Shraam Shreem Shraum Sah Chandraya Namah", day: "Monday" },
  Mars:    { deity: "Skanda – Kartikeya (with Hanuman)", governs: "courage, drive, energy, discipline, protection", mantra: "Om Kraam Kreem Kraum Sah Bhaumaya Namah", day: "Tuesday" },
  Mercury: { deity: "Vishnu (Budha)", governs: "intellect, communication, learning, business", mantra: "Om Braam Breem Braum Sah Budhaya Namah", day: "Wednesday" },
  Jupiter: { deity: "Brihaspati / Brahma (Guru)", governs: "wisdom, growth, luck, teachers, faith", mantra: "Om Graam Greem Graum Sah Gurave Namah", day: "Thursday" },
  Venus:   { deity: "Shukra (with Lakshmi)", governs: "love, relationships, beauty, comfort, creativity", mantra: "Om Draam Dreem Draum Sah Shukraya Namah", day: "Friday" },
  Saturn:  { deity: "Shani (with Hanuman)", governs: "discipline, patience, endurance, long-term work", mantra: "Om Praam Preem Praum Sah Shanaischaraya Namah", day: "Saturday" },
  Rahu:    { deity: "Durga (Rahu)", governs: "ambition, worldly desires, overcoming obstacles", mantra: "Om Bhraam Bhreem Bhraum Sah Rahave Namah", day: "Saturday" },
  Ketu:    { deity: "Ganesha (Ketu)", governs: "spirituality, insight, detachment, letting go", mantra: "Om Sraam Sreem Sraum Sah Ketave Namah", day: "Tuesday" },
};

const ord = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function strengtheningNote(p) {
  const dig = (p.dignity || "").toLowerCase();
  const strained = /debil|enemy|combust/.test(dig);
  const eased = /own|exalt/.test(dig);
  const hasIK = typeof p.ishta === "number" && typeof p.kashta === "number" && (p.ishta || p.kashta);
  if (p.name === "Rahu" || p.name === "Ketu")
    return `As a lunar node, ${p.name} has no ease/challenge score, but its mantra is a classic way to steady its restless, karmic energy.`;
  if (strained || (hasIK && p.kashta > p.ishta))
    return `Leans toward challenge${hasIK ? ` (challenge ${p.kashta} vs. ease ${p.ishta})` : " (strained dignity)"} — a strong candidate for strengthening.`;
  if (eased && (!hasIK || p.ishta >= p.kashta))
    return `Already fairly comfortable${hasIK ? ` (ease ${p.ishta} vs. challenge ${p.kashta})` : ""} — this nurtures an existing strength rather than fixing a problem.`;
  return `Mixed${hasIK ? ` (ease ${p.ishta} vs. challenge ${p.kashta})` : ""} — the mantra offers gentle, general support.`;
}

function planetSection(p) {
  const L = [];
  L.push(`### ${p.name}${p.retrograde ? " ℞" : ""} — ${p.sign} ${p.degree} · ${ord(p.house)} house`);
  if (p.theme || p.motto) L.push(`*${[p.theme, p.motto].filter(Boolean).join(" · ")}*`);
  L.push("");
  L.push(`- **Role:** ${p.role}`);
  L.push(`- **Dignity:** ${p.dignity} · ${p.benefic ? "Functional benefic" : "Functional malefic"}${p.retrograde ? " · Retrograde" : ""}`);
  if (typeof p.shadbala === "number") L.push(`- **Strength (Shadbala):** ${p.shadbala} Rupas`);
  if (typeof p.ishta === "number" && typeof p.kashta === "number" && (p.ishta || p.kashta))
    L.push(`- **Ease vs. challenge (Ishta / Kashta):** ${p.ishta} / ${p.kashta}`);
  L.push(`- **Birth star (Nakshatra):** ${p.nakshatra} · pada ${p.pada} (ruled by ${p.nakshatraLord})`);
  L.push(`- **Sign ruler (Sign lord):** ${p.signLord}`);
  L.push(`- **Deeper chart (Navamsa / D-9):** ${p.navamsa}`);
  L.push(`- **Houses ruled (as lord):** ${p.housesOwned && p.housesOwned.length ? p.housesOwned.map(ord).join(", ") : "—"}`);
  L.push(`- **Aspects (Drishti):** ${p.aspectsHouses && p.aspectsHouses.length ? p.aspectsHouses.map(ord).join(", ") + " house" : "—"}`);
  L.push("");
  (p.deepDive || []).forEach((para) => { L.push(para); L.push(""); });
  const r = REMEDIES[p.name];
  if (r) {
    L.push(`**Strengthening this planet's energy** — ${strengtheningNote(p)}`);
    L.push(`- **Deity:** ${r.deity}`);
    L.push(`- **Supports:** ${r.governs}`);
    L.push(`- **Bija (seed) mantra:** \`${r.mantra}\` — traditionally chanted 108× on ${r.day}.`);
    L.push("");
  }
  return L.join("\n");
}

function toMarkdown(c) {
  const L = [];
  const moon = c.planets.find((p) => p.name === "Moon");
  const sun = c.planets.find((p) => p.name === "Sun");

  L.push(`# ${c.name} — Vedic Birth Chart`);
  L.push("");
  L.push(`**Born:** ${c.birth.date} · ${c.birth.time} · ${c.birth.location} (${c.birth.coordinates}) · ${c.birth.timezone}  `);
  L.push(`**System:** ${c.system.ayanamsa} · ${c.system.houseSystem} houses · ${c.system.source}`);
  L.push("");

  L.push(`## At a glance`);
  L.push(`- **Ascendant (Lagna):** ${c.ascendant.sign} ${c.ascendant.degree} — nakshatra ${c.ascendant.nakshatra}`);
  L.push(`- **Moon sign (Rashi):** ${moon ? moon.sign : "—"} — your emotional inner world`);
  L.push(`- **Birth star (Nakshatra):** ${c.nakshatra.name} — the Moon's lunar mansion`);
  L.push(`- **Sun sign (Sūrya Rashi):** ${sun ? sun.sign : "—"} — your core self`);
  L.push("");

  // Ascendant / personality
  L.push(`## ${c.ascendant.theme || "Personality"} — Ascendant in ${c.ascendant.sign}`);
  if (c.ascendant.motto) L.push(`*${c.ascendant.motto}*`);
  L.push("");
  (c.ascendant.deepDive || []).forEach((para) => { L.push(para); L.push(""); });

  // Highlights
  if (c.highlights && c.highlights.length) {
    L.push(`## Signature themes`);
    L.push("");
    c.highlights.forEach((h) => { L.push(`### ${h.title}`); L.push(h.body); L.push(""); });
  }

  // Birth star detail
  if (c.nakshatra) {
    L.push(`## Birth star (Nakshatra): ${c.nakshatra.name}`);
    L.push(`*Ruled by ${c.nakshatra.lord} · deity ${c.nakshatra.deity}*`);
    L.push("");
    L.push(c.nakshatra.themes);
    L.push("");
  }

  // Planets
  L.push(`## The Planets (Grahas)`);
  L.push("");
  c.planets.forEach((p) => { L.push(planetSection(p)); });

  // Houses
  L.push(`## The Houses (Bhavas)`);
  L.push("");
  c.houses.forEach((h) => {
    L.push(`### House ${h.num} · ${h.sign} · ${h.theme}`);
    L.push(`**Occupants:** ${h.occupants && h.occupants.length ? h.occupants.join(", ") : "— (empty: this life-area plays out through its ruling planet and aspects)"}`);
    L.push("");
    L.push(h.meaning);
    L.push("");
  });

  // Panchanga
  if (c.panchanga) {
    L.push(`## Birth Almanac (Panchanga)`);
    L.push(c.panchanga.summary);
    L.push("");
    L.push(`*Sunrise ${c.panchanga.sunrise} · Sunset ${c.panchanga.sunset} · Ayanamsa ${c.panchanga.ayanamsa}*`);
    L.push("");
    L.push(`| Limb | Value | What it adds |`);
    L.push(`| --- | --- | --- |`);
    c.panchanga.limbs.forEach((x) => {
      L.push(`| ${x.k} | ${x.v} | ${x.note.replace(/\|/g, "\\|")} |`);
    });
    L.push("");
  }

  // Ashtakavarga
  if (c.ashtakavarga) {
    L.push(`## Support Map (Ashtakavarga)`);
    L.push(c.ashtakavarga.intro);
    L.push("");
    L.push(`Total ${c.ashtakavarga.total} bindus across 12 signs · average ~${c.ashtakavarga.average}.`);
    L.push("");
    L.push(`| House | Sign | Bindus | Note |`);
    L.push(`| --- | --- | :---: | --- |`);
    c.ashtakavarga.rows.forEach((r) => {
      L.push(`| ${ord(r.house)} | ${r.sign} | ${r.bindus} | ${r.note.replace(/\|/g, "\\|")} |`);
    });
    L.push("");
    if (c.ashtakavarga.takeaways && c.ashtakavarga.takeaways.length) {
      L.push(`**What it means:**`);
      c.ashtakavarga.takeaways.forEach((t) => L.push(`- ${t}`));
      L.push("");
    }
  }

  L.push(`---`);
  L.push(`*Generated from the birth-chart data (VedAstro · Swiss Ephemeris · Lahiri ayanamsa). Vedic astrology is a symbolic language describing tendencies, not fixed verdicts.*`);
  L.push("");
  return L.join("\n");
}

const outDir = path.join(__dirname, "..", "charts");
fs.mkdirSync(outDir, { recursive: true });

const written = [];
Object.values(CHARTS).forEach((c) => {
  const file = path.join(outDir, `${c.name}.md`);
  fs.writeFileSync(file, toMarkdown(c), "utf8");
  written.push(path.relative(path.join(__dirname, ".."), file));
});

console.log("Wrote:\n" + written.map((f) => "  " + f).join("\n"));
