#!/usr/bin/env node
/*
 * Lint chart copy in data/chart-data.js against CHART-GUIDE.md §4 (hard limits).
 *
 * Usage:
 *   node scripts/lint-copy.js            # every chart, summary table
 *   node scripts/lint-copy.js kara       # one chart, every issue listed
 *   node scripts/lint-copy.js kara thor  # several charts, every issue listed
 *   node scripts/lint-copy.js --compat   # every compatibility-page string, all pairs and relationships
 *
 * Set CHART_DATA=<path> to lint a different copy of the data file.
 * Exit code 1 if any listed chart has errors, so an agent can loop until clean.
 * Errors = hard limits. Warnings = caps and soft rules worth a second look.
 */
const path = require("path");
global.window = {};
require(process.env.CHART_DATA ? path.resolve(process.env.CHART_DATA) : path.join(__dirname, "..", "data", "chart-data.js"));
const CHARTS = global.window.VEDIC_DATA.charts;

// ---------- rules (keep in sync with CHART-GUIDE.md §4) ----------
const BANNED_WORDS = [
  "quietly", "genuinely", "genuine", "truly", "deeply", "really", "unusually",
  "remarkably", "literally", "simply", "actually", "incredibly",
];
const BANNED_PHRASES = [
  "growth edge", "the key is", "here is the key", "here is the single most important thing",
  "in plain terms", "the good news", "the invitation is", "shines brightest",
  "comes alive", "lands strongest",
];
const JARGON = [
  "lagna", "kendra", "trikona", "yogakaraka", "combust", "stellium", "maraka",
  "dusthana", "bindu", "debilitated", "exalted", "moolatrikona",
];
const DASH_FREE = /^(story|.*\.motto|.*\.cardBlurb|highlights\[\d+\]\.title)$/;
const MAX_DASHES_PER_CHART = 20;
const MAX_RATHER_THAN = 3;
const MAX_BECAUSE = 2;
// Fields where jargon is forbidden (prose). Facts fields like `role` and
// `dignity` are excluded on purpose.
const PROSE_FIELD = /(story|motto|cardBlurb|deepDive|meaning|highlights|themes|summary|note|intro|takeaways)/;

// ---------- collect prose strings with their field path ----------
function collect(chart) {
  const out = [];
  const add = (field, text) => { if (typeof text === "string" && text.trim()) out.push({ field, text }); };
  (chart.story || []).forEach((t, i) => add(`story`, t));
  const a = chart.ascendant || {};
  add("ascendant.motto", a.motto);
  add("ascendant.cardBlurb", a.cardBlurb);
  (a.deepDive || []).forEach((t, i) => add(`ascendant.deepDive[${i}]`, t));
  (chart.planets || []).forEach((p) => {
    add(`${p.name}.motto`, p.motto);
    add(`${p.name}.cardBlurb`, p.cardBlurb);
    (p.deepDive || []).forEach((t, i) => add(`${p.name}.deepDive[${i}]`, t));
  });
  (chart.houses || []).forEach((h) => add(`house${h.num}.meaning`, h.meaning));
  (chart.highlights || []).forEach((h, i) => {
    add(`highlights[${i}].title`, h.title);
    add(`highlights[${i}].body`, h.body);
  });
  const n = chart.nakshatra || {};
  add("nakshatra.cardBlurb", n.cardBlurb);
  add("nakshatra.themes", n.themes);
  const pc = chart.panchanga || {};
  add("panchanga.summary", pc.summary);
  (pc.limbs || []).forEach((l) => add(`panchanga.${l.k}`, l.note));
  const av = chart.ashtakavarga || {};
  add("ashtakavarga.intro", av.intro);
  (av.rows || []).forEach((r) => add(`ashtakavarga.house${r.house}.note`, r.note));
  (av.takeaways || []).forEach((t, i) => add(`ashtakavarga.takeaways[${i}]`, t));
  return out;
}

const count = (text, re) => (text.match(re) || []).length;
const wordRe = (w) => new RegExp(`\\b${w}\\b`, "gi");
const snippet = (text, idx, len = 60) =>
  "…" + text.slice(Math.max(0, idx - 25), idx + len - 25).replace(/\s+/g, " ") + "…";

function lint(chart) {
  const errors = [], warnings = [];
  const strings = collect(chart);
  let dashes = 0, ratherThan = 0, because = 0;

  for (const { field, text } of strings) {
    const d = count(text, /—/g);
    dashes += d;
    if (d && DASH_FREE.test(field)) errors.push([field, `em dash not allowed in this field`]);
    else if (d > 1) errors.push([field, `${d} em dashes in one paragraph (max 1)`]);

    for (const w of BANNED_WORDS) {
      let m; const re = wordRe(w);
      while ((m = re.exec(text))) errors.push([field, `banned word "${m[0]}"  ${snippet(text, m.index)}`]);
    }
    const realHits = text.match(/\breal\b(?! estate| life| world)/gi);
    if (realHits) errors.push([field, `"real" used ${realHits.length}x (banned as an intensifier)`]);

    let m;
    const lower = text.toLowerCase();
    for (const p of BANNED_PHRASES) {
      const i = lower.indexOf(p);
      if (i >= 0) errors.push([field, `banned phrase "${p}"  ${snippet(text, i)}`]);
    }
    if (/^Sitting in your \d/.test(text) || /\. Sitting in your \d/.test(text))
      errors.push([field, `opens a sentence with "Sitting in your Nth house"`]);

    // Contrast reveals: "is not X; it is Y", "not X, but Y", "X, not Y."
    const contrast = text.match(/\b(is|are|was) not [^.;]{1,60}[;,] (it|this|that|they) (is|are)\b|\bnot [^.,;]{1,40}, but\b|, not [^.,;]{1,30}\./gi);
    if (contrast) contrast.forEach((c) => errors.push([field, `contrast reveal  "${c.trim()}"`]));
    const question = text.match(/\b[A-Z][a-z]+( [a-z]+){0,3}\? [A-Z]/g);
    if (question) errors.push([field, `self-answered question  "${question[0]}"`]);

    if (PROSE_FIELD.test(field)) {
      for (const j of JARGON) {
        const re = new RegExp(`\\b${j}\\w*`, "gi");
        const hit = text.match(re);
        if (hit) errors.push([field, `jargon "${hit[0]}"`]);
      }
    }

    ratherThan += count(text, /\brather than\b/gi);
    because += count(text, /(^|[.!?]\s+)Because\b/g);

    // Lists of three: "x, y, and z" / "x, y and z"
    const triples = count(text, /\b\w+, \w+,? and \w+\b/g);
    if (triples > 1) warnings.push([field, `${triples} lists of three (max 1 per paragraph)`]);
  }

  if (dashes > MAX_DASHES_PER_CHART) errors.push(["chart", `${dashes} em dashes total (max ${MAX_DASHES_PER_CHART})`]);
  if (ratherThan > MAX_RATHER_THAN) warnings.push(["chart", `"rather than" used ${ratherThan}x (max ${MAX_RATHER_THAN})`]);
  if (because > MAX_BECAUSE) warnings.push(["chart", `${because} sentences start with "Because" (max ${MAX_BECAUSE})`]);

  // Structure checks
  if (!chart.story || !chart.story.length) errors.push(["story", "missing story field"]);
  const openers = {};
  (chart.planets || []).forEach((p) => {
    const first = (p.deepDive || [""])[0];
    const shape = first.split(/\s+/).slice(0, 3).join(" ").replace(new RegExp(p.name, "g"), "PLANET");
    (openers[shape] = openers[shape] || []).push(p.name);
    if (new RegExp(`^(The )?${p.name} (is|drives|marks|points|shows)\\b`).test(first))
      errors.push([`${p.name}.deepDive[0]`, `opens by defining the planet ("${first.split(/\s+/).slice(0, 3).join(" ")}…")`]);
  });
  for (const [shape, names] of Object.entries(openers))
    if (names.length > 1) errors.push(["planets", `${names.join(", ")} all open with "${shape}…"`]);

  // Repetition between card and the opening reading paragraph (shared 4-word phrases)
  const grams = (t) => {
    const w = (t || "").toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter(Boolean);
    const s = new Set(); for (let i = 0; i + 3 < w.length; i++) s.add(w.slice(i, i + 4).join(" ")); return s;
  };
  const trio = [["ascendant", chart.ascendant], ...(chart.planets || []).filter((p) => p.name === "Sun" || p.name === "Moon").map((p) => [p.name, p])];
  for (const [label, o] of trio) {
    if (!o) continue;
    const a = grams(o.cardBlurb), b = grams((o.deepDive || [])[0]);
    const shared = [...a].filter((g) => b.has(g));
    if (shared.length) warnings.push([label, `card and reading share wording: "${shared[0]}"`]);
  }
  const nk = chart.nakshatra || {};
  const nShared = [...grams(nk.cardBlurb)].filter((g) => grams(nk.themes).has(g));
  if (nShared.length) warnings.push(["nakshatra", `card and themes share wording: "${nShared[0]}"`]);

  return { errors, warnings, dashes };
}

// ---------- compatibility page ----------
// Runs the same sentence rules over every string src/compat-engine.js can
// produce, for every pair and relationship type.
function lintText(field, text) {
  const errors = [];
  if (/—/.test(text)) errors.push([field, "em dash"]);
  for (const w of BANNED_WORDS) { const m = text.match(wordRe(w)); if (m) errors.push([field, `banned word "${m[0]}"`]); }
  if (/\breal\b(?! estate| life| world)/i.test(text)) errors.push([field, `"real" as an intensifier`]);
  const lower = text.toLowerCase();
  for (const p of BANNED_PHRASES) if (lower.includes(p)) errors.push([field, `banned phrase "${p}"`]);
  const contrast = text.match(/\b(is|are|was) not [^.;]{1,60}[;,] (it|this|that|they) (is|are)\b|\bnot [^.,;]{1,40}, but\b|, not [^.,;]{1,30}\./gi);
  if (contrast) errors.push([field, `contrast reveal "${contrast[0]}"`]);
  for (const j of JARGON) { const m = text.match(new RegExp(`\\b${j}\\w*`, "gi")); if (m) errors.push([field, `jargon "${m[0]}"`]); }
  if (/\{\w+\}|undefined|NaN/.test(text)) errors.push([field, "unfilled template"]);
  return errors;
}
if (process.argv[2] === "--compat") {
  const E = require(path.join(__dirname, "..", "src", "compat-engine.js"));
  const ids = Object.keys(CHARTS), seen = new Map();
  let n = 0;
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    for (const rel of Object.keys(E.REL)) {
      const r = E.buildReport(CHARTS[a], CHARTS[b], rel);
      for (const t of E.allText(r)) { n++; for (const e of lintText(`${a}×${b} ${rel}`, t)) seen.set(e[1] + " | " + t, e[0]); }
    }
  }
  console.log(`Checked ${n} strings across ${ids.length * (ids.length - 1)} ordered pairs.`);
  for (const [msg, where] of seen) console.log(`  ${where.padEnd(32)} ${msg}`);
  console.log(seen.size ? `${seen.size} problems.` : "Clean.");
  process.exit(seen.size ? 1 : 0);
}

// ---------- run ----------
const ids = process.argv.slice(2);
const targets = ids.length ? ids : Object.keys(CHARTS);
let failed = false;

for (const id of ids) if (!CHARTS[id]) { console.error(`No chart with id "${id}". Known: ${Object.keys(CHARTS).join(", ")}`); process.exit(2); }

if (!ids.length) {
  console.log("chart          errors  warnings  em dashes");
  for (const id of targets) {
    const r = lint(CHARTS[id]);
    if (r.errors.length) failed = true;
    console.log(`${id.padEnd(14)} ${String(r.errors.length).padStart(6)}  ${String(r.warnings.length).padStart(8)}  ${String(r.dashes).padStart(9)}`);
  }
  console.log("\nRun with a chart id to see every issue, e.g. node scripts/lint-copy.js kara");
} else {
  for (const id of targets) {
    const r = lint(CHARTS[id]);
    if (r.errors.length) failed = true;
    console.log(`\n## ${id}: ${r.errors.length} errors, ${r.warnings.length} warnings, ${r.dashes} em dashes`);
    if (r.errors.length) { console.log("\nErrors"); r.errors.forEach(([f, m]) => console.log(`  ${f.padEnd(30)} ${m}`)); }
    if (r.warnings.length) { console.log("\nWarnings"); r.warnings.forEach(([f, m]) => console.log(`  ${f.padEnd(30)} ${m}`)); }
    if (!r.errors.length && !r.warnings.length) console.log("  Clean.");
  }
}
process.exit(failed ? 1 : 0);
