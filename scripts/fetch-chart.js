#!/usr/bin/env node
/**
 * Fetch raw Vedic chart data from the VedAstro API and save it to data/raw/.
 *
 * Usage:
 *   node scripts/fetch-chart.js --name "Jane Smith" \
 *     --date "15/06/1990" --time "08:30" --tz "+05:30" \
 *     --location "19.0760,72.8777"
 *
 * Output: data/raw/<id>.json   (id = name lowercased, spaces→hyphens)
 *
 * Requirements: Node 18+ (built-in fetch). No npm install needed.
 *
 * Notes on the VedAstro Calculate API (learned the hard way):
 *   - Date MUST be numeric DD/MM/YYYY (e.g. 21/03/1991). A month *name*
 *     like "Mar" silently misparses and the API then blames the timezone.
 *   - Nov 2026: the legacy GET host (api.vedastro.org) now replays a canned
 *     demo chart for every request. We POST JSON to vedastro.zaishi.net (the
 *     host used by the official VedAstro.Python client) and verify the echoed
 *     input matches what we sent.
 *   - Per-planet data comes from AllPlanetData WITH an explicit planetName.
 *   - Free tier is rate-limited to 5 calls/minute, so we throttle. With an
 *     API key (VEDASTRO_API_KEY or --apikey) there is no limit — but only when
 *     the key is sent in the x-api-key header; in the body it is ignored.
 *   - Method names differ from older docs: LagnaSignName, MoonSignName,
 *     SunriseTime/SunsetTime, SarvashtakavargaChart, LunarDay (tithi),
 *     LordOfWeekday (vara/day lord). There is no standalone "Ayanamsa"
 *     calc — it is a request field.
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
const location = arg("--location"); // "LAT,LON"  e.g. 19.0760,72.8777
const ayanamsa = arg("--ayanamsa") || "RAMAN"; // matches the rest of the site
const apikey   = arg("--apikey") || process.env.VEDASTRO_API_KEY; // optional; prefer the env var

if (!name || !date || !time || !tz || !location) {
  console.error(`
Usage: node scripts/fetch-chart.js \\
  --name "Jane Smith" \\
  --date "15/06/1990" \\
  --time "08:30" \\
  --tz "+05:30" \\
  --location "19.0760,72.8777" \\
  [--ayanamsa RAMAN] [--apikey sk_live_...  (or set VEDASTRO_API_KEY)]

Date format : DD/MM/YYYY  (21/03/1991)  — numeric month, NOT "Mar"
Time format : HH:MM  (24-hour)
TZ format   : +HH:MM or -HH:MM  (+05:30 or -06:00)
Location    : "LAT,LON" decimal degrees (required — no geocoding)
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
const id       = arg("--id") || name.toLowerCase().replace(/\s+/g, "-");
const PLANETS  = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const API_BASE = "https://vedastro.zaishi.net/api/Calculate";

// Location: "LAT,LON" (preferred — no geocoding) or a place name.
const coordMatch = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(location);
if (!coordMatch) {
  console.error(`\n✗ --location must be "LAT,LON" (e.g. "39.2904,-76.6122").`);
  console.error(`  The POST API needs coordinates; the old geocoder misfired anyway.\n`);
  process.exit(1);
}
const LAT = Number(coordMatch[1]), LON = Number(coordMatch[2]);
const stdTime = `${time} ${DD}/${MM}/${YYYY} ${tz}`;
const timeJson = { StdTime: stdTime, Location: { Name: location, Longitude: LON, Latitude: LAT } };
// API expects e.g. "Raman"/"Lahiri"; accept any case on the CLI.
const ayanamsaName = ayanamsa.charAt(0).toUpperCase() + ayanamsa.slice(1).toLowerCase();

// Free tier: 5/min → ~13s spacing. With an API key, no throttle.
// The key must go in the x-api-key header — in the JSON body the API ignores
// it and applies the free-tier limit (5/min). Throttle only without a key.
const DELAY_MS = apikey ? 0 : 13000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The API can return HTTP 200 + Status "Pass" with a canned demo chart
// (Mumbai 14:30 25/10/1992) — the legacy host did exactly this. Reject any
// response whose echoed input doesn't match what we sent.
function verifyEcho(json) {
  const params = (json.Input && json.Input.Parameters) || [];
  const t = params.map((p) => p.Value).find((v) => v && v.StdTime);
  if (!t) throw new Error("response has no echoed time — cannot verify");
  const loc = t.Location || {};
  if (t.StdTime !== stdTime ||
      Math.abs(loc.Latitude - LAT) > 1e-4 || Math.abs(loc.Longitude - LON) > 1e-4) {
    throw new Error(`API computed a different chart (${t.StdTime} @ ${loc.Latitude},${loc.Longitude})`);
  }
}

async function get(method, planet, timeKey = "time", extra = {}) {
  const body = { [timeKey]: timeJson, Ayanamsa: ayanamsaName, ...extra };
  if (planet) body.planetName = planet;
  const headers = { "content-type": "application/json" };
  if (apikey) headers["x-api-key"] = apikey;
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // The API returns HTTP 200 even on logical failure — inspect Status.
  if (json && json.Status === "Fail") {
    const payload = typeof json.Payload === "string" ? json.Payload : JSON.stringify(json.Payload);
    throw new Error(payload);
  }
  verifyEcho(json);
  return json;
}

async function call(label, method, planet, results, key, timeKey) {
  process.stdout.write(`  ${label.padEnd(28)}`);
  try {
    results[key] = await get(method, planet, timeKey);
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
  if (DELAY_MS) console.log(`(no API key — throttling ~13s/call for the free 5/min limit)`);
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
    ["SarvashtakavargaChart","SarvashtakavargaChart", "birthTime"],// bindu grid
    ["LunarDay",             "LunarDay"],             // tithi
    ["LordOfWeekday",        "LordOfWeekday"],        // vara / day lord
    ["HoraAtBirth",          "HoraAtBirth"],          // hora lord
    ["NithyaYoga",           "NithyaYoga"],
    ["LunarMonth",           "LunarMonth", "inputTime"],
    ["SunriseTime",          "SunriseTime"],
    ["SunsetTime",           "SunsetTime"],
    ["Karana",               "Karana"],
    ["SodyaAshtakavarga",    "SodyaAshtakavarga"],
  ];
  for (const [label, method, timeKey] of chartMethods) {
    await call(label, method, null, results, method, timeKey);
  }

  // Ascendant degree + nakshatra come from House1 (needs a houseNumber field).
  console.log("\nAscendant:");
  for (const method of ["HouseLongitude", "HouseConstellation"]) {
    process.stdout.write(`  ${method.padEnd(28)}`);
    try {
      results[`${method}_House1`] = await get(method, null, "time", { houseNumber: "House1" });
      console.log("✓");
    } catch (e) {
      console.log(`✗  ${String(e.message).split("\n")[0]}`);
      results[`${method}_House1`] = { error: e.message };
    }
    if (DELAY_MS) await sleep(DELAY_MS);
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
