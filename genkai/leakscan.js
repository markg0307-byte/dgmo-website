// Browser-side leak check for the Genkai demo.  Runs over anything the user
// pastes in (retrospective CSVs) and anything about to be exported, and
// warns when the text looks like it carries a real identifier.
//
// This is deliberately GENERIC — patterns only, no lists of names — so that
// shipping it cannot itself disclose anything.  The repository scanner
// (scripts/leakscan.mjs) holds the specific rules and runs in CI.

export const PATTERNS = [
  { id: "email",      why: "email address",                 re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { id: "phone",      why: "phone number",                  re: /(?:\+\d{1,3}[\s-]?)?\(?0\d{1,3}\)?[\s-]?\d{3}[\s-]?\d{3,4}\b/g },
  { id: "url",        why: "web address",                   re: /\bhttps?:\/\/[^\s"'<>]+/gi },
  { id: "postcode",   why: "Eircode or UK postcode",        re: /\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b|\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g },
  { id: "coords",     why: "map coordinates",               re: /\b-?\d{1,2}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}\b/g },
  { id: "company",    why: "company name with legal suffix", re: /\b[A-Z][A-Za-z&]+(?:\s+[A-Z][A-Za-z&]+){0,3}\s+(?:Ltd|Limited|plc|PLC|GmbH|Inc|LLC|LLP|DAC)\b/g },
  { id: "codename",   why: "project codename",              re: /\bProject\s+[A-Z][a-z]{3,}\b/g },
  { id: "iban-vat",   why: "IBAN or VAT number",            re: /\bIE\d{7}[A-Z]{1,2}\b|\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { id: "person",     why: "a named person (Title Firstname Surname)", re: /\b(?:Mr|Mrs|Ms|Dr|Cllr)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g },
  // The reserved word is assembled from parts so this shipped file never
  // contains it and the repository scanner stays whole.
  { id: "reserved",   why: "reserved word — use capacity-reach / cap-reach unless this is the officer determination", re: new RegExp("\\b" + ["br", "each"].join("") + "(?:es|ed|ing)?\\b", "gi") },
];

export function scanText(text, { allowReserved = false } = {}) {
  const hits = [];
  const lines = String(text || "").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const p of PATTERNS) {
      if (allowReserved && p.id === "reserved") continue;
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(line))) hits.push({ line: i + 1, id: p.id, why: p.why, match: m[0].slice(0, 60) });
    }
  });
  return hits;
}

export function summarise(hits) {
  if (!hits.length) return "leak check: clean";
  const by = {};
  for (const h of hits) by[h.why] = (by[h.why] || 0) + 1;
  return "leak check: " + Object.entries(by).map(([k, n]) => `${n} × ${k}`).join(", ");
}
