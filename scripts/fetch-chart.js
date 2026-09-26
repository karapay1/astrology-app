#!/usr/bin/env node
/**
 * Fetch raw Vedic chart data from the VedAstro API and save it to data/raw/.
 *
 * Usage:
 *   node scripts/fetch-chart.js --name "Jane Smith" \
 *     --date "15/06/1990" --time "08:30" --tz "+05:30" \
 *     --location "Mumbai"
 *
 * Output: data/raw/<id>.json   (id = name lowercased, spaces→hyphens)
 *
 * Requirements: Node 18+ (built-in fetch). No npm install needed.
 *
 * Notes on the VedAstro Calculate API (learned the hard way):
 *   - Date MUST be numeric DD/MM/YYYY (e.g. 21/03/1991). A month *name*
 *     like "Mar" silently misparses and the API then blames the timezone.
 *   - Per-planet data comes from AllPlanetData WITH an explicit PlanetName
 *     segment. Without it, the API returns a year-2000 placeholder chart.
 *   - Free tier is rate-limited to 5 calls/minute, so we throttle. Pass an
 *     API key with --apikey to lift the limit (and we drop the delay).
 *   - Method names differ from older docs: LagnaSignName, MoonSignName,
 *     SunriseTime/SunsetTime, SarvashtakavargaChart, LunarDay (tithi),
 *     LordOfWeekday (vara/day lord). There is no standalone "Ayanamsa"
 *     calc — it is a URL parameter.
 */

const fs   = require("fs");
const path = require("path");

// ---------- parse CLI args ----------
const args = process.argv.slice(2);
function arg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const name     = arg("--name");
const date     = arg("--date");     // DD/MM/YYYY  e.g. 21/03/1991
const time     = arg("--time");     // HH:MM        e.g. 08:30
const tz       = arg("--tz");       // +HH:MM       e.g. +05:30 or -06:00
const location = arg("--location"); // city string  e.g. Mumbai
const ayanamsa = arg("--ayanamsa") || "RAMAN"; // matches the rest of the site
const apikey   = arg("--apikey");   // optional VedAstro premium key

if (!name || !date || !time || !tz || !location) {
  console.error(`
Usage: node scripts/fetch-chart.js \\
  --name "Jane Smith" \\
  --date "15/06/1990" \\
  --time "08:30" \\
  --tz "+05:30" \\
  --location "Mumbai" \\
  [--ayanamsa RAMAN] [--apikey sk_live_...]

Date format : DD/MM/YYYY  (21/03/1991)  — numeric month, NOT "Mar"
Time format : HH:MM  (24-hour)
TZ format   : +HH:MM or -HH:MM  (+05:30 or -06:00)
Location    : city name only — avoid country/state suffixes if you get wrong coords
Ayanamsa    : RAMAN (default, matches the site) or LAHIRI
`);
  process.exit(1);
}

// ---------- validate date shape early (numeric month is required) ----------
const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
if (!dateMatch) {
  console.error(`\n✗ --date must be numeric DD/MM/YYYY (e.g. 21/03/1991). Got: "${date}"`);
  console.error(`  A month name like "Mar" will be misparsed by the API.\n`);
  process.exit(1);
}
const [, DD, MM, YYYY] = dateMatch;

// ---------- helpers ----------
const id       = name.toLowerCase().replace(/\s+/g, "-");
const locEnc   = encodeURIComponent(location);
// tz keeps its sign and colon literally in the path; only encode the colon so
// the offset stays a numeric offset the API accepts (verified: raw works too).
const tzPath   = tz;
const PLANETS  = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

// Free tier: 5/min → ~13s spacing. With an API key, no throttle.
const DELAY_MS = apikey ? 0 : 13000;

function url(method, planet) {
  const keySeg    = apikey ? `APIKey/${apikey}/` : "";
  const planetSeg = planet ? `PlanetName/${planet}/` : "";
  return `https://api.vedastro.org/api/${keySeg}Calculate/${method}/${planetSeg}` +
         `Location/${locEnc}/Time/${time}/${DD}/${MM}/${YYYY}/${tzPath}/Ayanamsa/${ayanamsa}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(method, planet) {
  const res = await fetch(url(method, planet));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // The API returns HTTP 200 even on logical failure — inspect Status.
  if (json && json.Status === "Fail") {
    const payload = typeof json.Payload === "string" ? json.Payload : JSON.stringify(json.Payload);
    throw new Error(payload);
  }
  return json;
}

async function call(label, method, planet, results, key) {
  process.stdout.write(`  ${label.padEnd(28)}`);
  try {
    results[key] = await get(method, planet);
    console.log("✓");
  } catch (e) {
    console.log(`✗  ${String(e.message).split("\n")[0]}`);
    results[key] = { error: e.message };
  }
  if (DELAY_MS) await sleep(DELAY_MS);
}

// ---------- main ----------
async function main() {
  console.log(`\nFetching chart for ${name}…`);
  console.log(`Location: ${location}  Date: ${DD}/${MM}/${YYYY}  Time: ${time}  TZ: ${tz}  Ayanamsa: ${ayanamsa}`);
  if (!apikey) console.log(`(free tier — throttling ~13s/call to respect 5/min limit)`);
  console.log("");

  const results = {};

  // Per-planet data — one AllPlanetData call each (the workhorse).
  console.log("Planets:");
  for (const planet of PLANETS) {
    await call(planet, "AllPlanetData", planet, results, `Planet_${planet}`);
  }

  // Chart-level methods (no PlanetName segment).
  console.log("\nChart:");
  const chartMethods = [
    ["LagnaSignName",        "LagnaSignName"],        // ascendant sign
    ["MoonSignName",         "MoonSignName"],
    ["SarvashtakavargaChart","SarvashtakavargaChart"],// bindu grid
    ["LunarDay",             "LunarDay"],             // tithi
    ["LordOfWeekday",        "LordOfWeekday"],        // vara / day lord
    ["HoraAtBirth",          "HoraAtBirth"],          // hora lord
    ["NithyaYoga",           "NithyaYoga"],
    ["LunarMonth",           "LunarMonth"],
    ["SunriseTime",          "SunriseTime"],
    ["SunsetTime",           "SunsetTime"],
  ];
  for (const [label, method] of chartMethods) {
    await call(label, method, null, results, method);
  }

  // save raw JSON
  const record = { name, date: `${DD}/${MM}/${YYYY}`, time, tz, location, ayanamsa, results };
  const outDir = path.join(__dirname, "..", "data", "raw");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${id}.json`);
  fs.writeFileSync(outFile, JSON.stringify(record, null, 2));

  const failed = Object.entries(results).filter(([, v]) => v && v.error).map(([k]) => k);
  console.log(`\nSaved → data/raw/${id}.json`);
  if (failed.length) console.log(`⚠  ${failed.length} call(s) failed: ${failed.join(", ")}`);
  else console.log("All calls succeeded.");
  console.log('Say "chart data saved" and I\'ll build the chart entry.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
