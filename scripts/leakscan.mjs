#!/usr/bin/env node
// leakscan — fails the build if anything shippable names or implies a client,
// site, engagement or rate that identifies one.  Run before every commit:
//
//     node scripts/leakscan.mjs            # scan the repo
//     node scripts/leakscan.mjs path ...   # scan specific files or folders
//
// Exit 0 = clean.  Exit 1 = one or more hits, listed with file:line.
//
// Two things are masked before the rules run so they cannot cause false hits:
//   * long base64 runs (the access-keyed pages carry encrypted payloads)
//   * the product name "The Breach Check", which is the only permitted use
//     of the word "breach" on the site; the terminology elsewhere is
//     "capacity-reach date" (physical) and "cap-reach forecast" (consented).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_EXT = new Set([".html", ".htm", ".md", ".js", ".mjs", ".css", ".xml", ".txt", ".csv", ".json", ".yml", ".yaml", ".conf", ".svg"]);
const SCAN_BARE = new Set(["Dockerfile", "nginx.conf"]);
const SKIP_DIRS = new Set([".git", "node_modules", ".github/ISSUE_TEMPLATE"]);
const SELF = "scripts/leakscan.mjs";

// ---------------------------------------------------------------------------
// Rules.  Each is {id, why, re}.  Every hit fails the scan.
// ---------------------------------------------------------------------------
const RULES = [
  { id: "org-name", why: "Named employer, client or contractor",
    re: /\b(Arcadis|DPS\s+Engineering|DPS\b|Jacobs|Mace\b|PM\s+Group|Exyte|Intel\b|Meta\b|Facebook|Microsoft|Amazon|AWS\b|Google\b|Apple\b|TSMC|Samsung|Micron|Analog\s+Devices|Pfizer|MSD\b|Lilly|Equinix|Digital\s+Realty|Vantage|EdgeConneX)\b/g },
  { id: "site-name", why: "Named site, campus or town that identifies a programme",
    re: /\b(Leixlip|Clonee|Grange\s+Castle|Ringaskiddy|Ballycoolin|Dunboyne|Kilcarbery|Mulhuddart|Hinkley|Sizewell|Magdeburg|Dresden|Kulim|Penang|Chandler|Ocotillo|New\s+Albany|Rio\s+Rancho|Hillsboro)\b/g },
  { id: "project-name", why: "Named road, port, airport or campus works",
    re: /\b(M11\b|Gort|Tuam|Dublin\s+Port|Liverpool\s+(Port|Airport)|Fab\s?\d{2}\b|Fab\s?[A-Z]\b)/g },
  { id: "current-engagement", why: "Present-tense reference to a live engagement",
    re: /\b(runs?\s+live\s+site\s+services\s+today|where\s+the\s+practice\s+runs|currently\s+(engaged|running|delivering|on\s+site)|on\s+engagement\s+today|our\s+current\s+(client|programme|site|engagement))\b/gi },
  { id: "europe-largest", why: "Superlative that narrows a programme to one or two candidates",
    re: /\b(one\s+of\s+Europe'?s\s+largest|Europe'?s\s+largest|the\s+largest\s+\w+\s+programme\s+in)\b/gi },
  { id: "rate-lot", why: "Identifying delivered rate: remote-lot quarterly cost",
    re: /€\s?111\s?k|111,000|€111/g },
  { id: "rate-spaces", why: "Identifying capacity: N-space lot",
    re: /\b230[-\s]space/g },
  { id: "rate-bus", why: "Identifying delivered rate: per-bus day rate",
    re: /€\s?800\b/g },
  { id: "rate-security", why: "Identifying delivered rate: blended security hourly rate",
    re: /€\s?32\s?(\/|per)\s?(hr|hour)/gi },
  { id: "rates-we-have-paid", why: "Rates 'we have paid' point at a real engagement",
    re: /\b(rates?\s+we\s+have\s+(actually\s+)?paid|programmes?\s+we\s+have\s+run,?\s+anonymi[sz]ed|delivered\s+rates?\s+from\s+programmes?)\b/gi },
  { id: "breach", why: "'breach' is reserved for the product name and the officer-determination field",
    re: /\bbreach(es|ed|ing|line)?\b/gi },
  { id: "invented-ratio", why: "Invented ratio that presents as sourced (must carry provenance or be retired)",
    re: /\b0\.565\b|\b0\.145\b|\b0\.42\s?(beds?|bed\s?spaces?)|\b0\.31\s?(gate|throughput|inductions?)|\b12\.5\s?m(²|2|\^2)\s?(laydown|per)|\b0\.22\s?(bus\s?)?seats?|\b0\.40\s?(canteen|covers?|seats?)/gi,
    guard: (m, line) => !/\bretired\b/i.test(line) },                           // docs may list them as retired
  { id: "email", why: "Email address other than the practice inbox",
    re: /\b(?!info@dgmoconsultancy\.com)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { id: "phone", why: "Phone number",
    re: /(\+\d{1,3}[\s-]?)?\(?0?\d{2,3}\)?[\s-]?\d{3}[\s-]?\d{3,4}\b(?![\d,])/g,
    guard: (m, line) => /\b(tel|phone|call|mob|ph)\b/i.test(line) || /^\+/.test(m) },
  { id: "eircode-postcode", why: "Eircode or UK postcode",
    re: /\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b|\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g,
    guard: (m, line) => !/\b(S\.I\.|CFR|ASR|ISO|BS\s?\d|EN\s?\d|IS\s?\d)/.test(line) },
  { id: "vat-iban", why: "VAT number or IBAN",
    re: /\bIE\d{7}[A-Z]{1,2}\b|\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { id: "coordinates", why: "Map coordinates",
    re: /\b-?\d{1,2}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g },
  { id: "apex-host", why: "Link to the apex host; the canonical host is www",
    re: /https?:\/\/dgmoconsultancy\.com/g },
  { id: "http-own-host", why: "Plain-http link to own host",
    re: /http:\/\/(www\.)?dgmoconsultancy\.com/g },
  { id: "infra-host", why: "Internal hosting URL exposed",
    re: /[a-z0-9-]+\.up\.railway\.app|railway\.internal/g },
  { id: "local-path", why: "Local machine path",
    re: /[A-Z]:\\Users\\[^\s"'<>]+|\/Users\/[a-z]+\/|\/home\/[a-z]+\//g },
];

// ---------------------------------------------------------------------------
function mask(text) {
  return text
    .replace(/[A-Za-z0-9+/]{60,}={0,2}/g, (m) => "•".repeat(m.length))          // base64 blobs
    .replace(/The\s+Breach\s+Check/g, (m) => "•".repeat(m.length))               // permitted product name
    .split(/\r?\n/)                                                              // permitted field: a line that names the
    .map((line) => (/officer[-\s_]determination/i.test(line)                    // officer determination may say what
      ? line.replace(/breach/gi, (m) => "•".repeat(m.length)) : line))          // it records
    .join("\n");
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(ROOT, p).split(sep).join("/");
    if (SKIP_DIRS.has(name) || SKIP_DIRS.has(rel)) continue;
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (rel !== SELF && (SCAN_BARE.has(name) || SCAN_EXT.has(name.slice(name.lastIndexOf("."))))) yield p;
  }
}

function scanFile(path) {
  const rel = relative(ROOT, path).split(sep).join("/");
  const lines = mask(readFileSync(path, "utf8")).split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line))) {
        if (rule.guard && !rule.guard(m[0], line)) continue;
        hits.push({ file: rel, line: i + 1, rule: rule.id, why: rule.why, match: m[0].slice(0, 60) });
        if (!rule.re.global) break;
      }
    }
  });
  return hits;
}

const targets = process.argv.slice(2);
const files = [];
if (targets.length === 0) files.push(...walk(ROOT));
else for (const t of targets) {
  const p = join(ROOT, t);
  if (statSync(p).isDirectory()) files.push(...walk(p)); else files.push(p);
}

const all = files.flatMap(scanFile);
if (all.length === 0) {
  console.log(`leakscan: clean — ${files.length} files, ${RULES.length} rules, 0 hits`);
  process.exit(0);
}
for (const h of all) console.log(`${h.file}:${h.line}  [${h.rule}]  ${h.why}  →  "${h.match}"`);
console.log(`\nleakscan: FAIL — ${all.length} hit${all.length === 1 ? "" : "s"} across ${new Set(all.map((h) => h.file)).size} file(s), ${files.length} scanned, ${RULES.length} rules`);
process.exit(1);
