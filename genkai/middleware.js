// Genkai scenario engine.  Pure functions over the scenario object; no DOM.
//
// Terminology:
//   capacity-reach date — the week demand first exceeds a PHYSICAL cap
//   cap-reach forecast  — the week demand first exceeds a CONSENTED cap
//   decide-by date      — reach date minus the total lead of the chosen remedy
// The planning officer's word is not used here.  The only field that carries
// it is the officer determination, which records what an officer decided.

import { CONSENT_ROUTES, REMEDY_CONSENT, WEEK_MS } from "./synthetic.js";

export const STATUS = { CLEAR: "clear", WATCH: "watch", DECIDE_PASSED: "decide passed", REACHED: "reached" };

// ---------------------------------------------------------------- dates ----
export function weekDate(meta, w) { return new Date(new Date(meta.week0 + "T00:00:00Z").getTime() + w * WEEK_MS); }
export function weekOf(meta, dateStr) { return Math.floor((new Date(dateStr + "T00:00:00Z") - new Date(meta.week0 + "T00:00:00Z")) / WEEK_MS); }
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function fmtMonth(d) { return d ? `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "—"; }
export function fmtDay(d) { return d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "—"; }
export function fmtWeek(meta, w) { return w == null ? "—" : `w/c ${fmtDay(weekDate(meta, w))}`; }

// ------------------------------------------------------------ positions ----
// Apply a dated position's overrides to the scenario to get the domains and
// headcount as they stood on that date.
export function buildPosition(scenario, key) {
  const pos = key === scenario.meta.issued ? null : scenario.positions[key];
  const headcount = pos ? pos.headcount : scenario.headcount.values;
  const domains = scenario.domains.map((d) => {
    const o = pos?.overrides?.[d.id] || {};
    return {
      ...d,
      ratio: o.ratio != null ? { ...d.ratio, value: o.ratio } : d.ratio,
      capacity: o.capacity ? o.capacity.map((c, i) => ({ ...(d.capacity[i] || d.capacity[0]), ...c })) : d.capacity,
    };
  });
  return { key, headcount, domains };
}

// --------------------------------------------------------------- curves ----
export function demandCurve(domain, headcount) {
  return headcount.map((h) => Math.round(h * domain.ratio.value));
}
export function capacityCurve(domain, n) {
  const steps = [...domain.capacity].sort((a, b) => a.from - b.from);
  const out = new Array(n);
  let cur = steps[0].value;
  for (let w = 0; w < n; w++) {
    for (const s of steps) if (s.from === w) cur = s.value;
    out[w] = cur;
  }
  return out;
}
export function reachWeek(demand, capacity) {
  for (let w = 0; w < demand.length; w++) if (demand[w] > capacity[w]) return w;
  return null;
}
export function peakShortfall(demand, capacity) {
  let best = 0;
  for (let w = 0; w < demand.length; w++) best = Math.max(best, demand[w] - capacity[w]);
  return best;
}

// ------------------------------------------------------------- remedies ----
// Lead time of a remedy = its build lead + the longer of (its own consent
// step, the cap's route-to-remedy step when the cap is consented).  Consent
// steps are assumed to run in parallel with each other and to precede the
// build.  Both consent leads come from tables, never from free text.
export function remedyLead(domain, remedy) {
  const consent = REMEDY_CONSENT[remedy.consent]?.lead_weeks ?? 0;
  const route = domain.cap_type === "consented" ? (CONSENT_ROUTES[domain.consent?.route_to_remedy]?.lead_weeks ?? 0) : 0;
  return { build: remedy.lead_weeks, consent, route, total: remedy.lead_weeks + Math.max(consent, route) };
}

// Pick the remedy the decide-by date is quoted against: the cheapest one that
// covers the peak shortfall, else the largest.
export function chooseRemedy(domain, shortfall) {
  const covering = domain.remedies.filter((r) => r.capacity_add >= shortfall);
  if (covering.length) return covering.sort((a, b) => a.cost - b.cost)[0];
  return [...domain.remedies].sort((a, b) => b.capacity_add - a.capacity_add)[0] || null;
}

// ------------------------------------------------------------- evaluate ----
export function evaluateDomain(domain, headcount, meta) {
  const demand = demandCurve(domain, headcount);
  const capacity = capacityCurve(domain, headcount.length);
  const reachW = reachWeek(demand, capacity);
  const shortfall = peakShortfall(demand, capacity);
  const nowW = weekOf(meta, meta.today);
  const remedies = domain.remedies.map((r) => {
    const lead = remedyLead(domain, r);
    const decideByW = reachW == null ? null : reachW - lead.total;
    return { ...r, lead, decideByW, decideByDate: decideByW == null ? null : weekDate(meta, decideByW), passed: decideByW != null && decideByW < nowW };
  });
  const chosen = chooseRemedy(domain, shortfall);
  const chosenEval = remedies.find((r) => r.id === chosen?.id) || null;
  let status = STATUS.CLEAR;
  if (reachW != null) {
    if (reachW <= nowW) status = STATUS.REACHED;
    else if (chosenEval?.passed) status = STATUS.DECIDE_PASSED;
    else status = STATUS.WATCH;
  }
  return {
    id: domain.id, name: domain.name, unit: domain.unit, cap_type: domain.cap_type,
    reachLabel: domain.cap_type === "consented" ? "cap-reach forecast" : "capacity-reach date",
    demand, capacity, reachW, reachDate: reachW == null ? null : weekDate(meta, reachW),
    demandNow: demand[nowW], capacityNow: capacity[nowW], shortfall,
    remedies, chosen: chosenEval, decideByW: chosenEval?.decideByW ?? null, decideByDate: chosenEval?.decideByDate ?? null,
    status, nowW,
  };
}

export function eiarCheck(scenario, headcount, hgvDemand) {
  const pw = scenario.eiar.peak_workforce.value, ph = scenario.eiar.peak_hgv_per_day.value;
  const workforce = [], hgv = [];
  headcount.forEach((h, w) => { if (h > pw) workforce.push(w); });
  (hgvDemand || []).forEach((v, w) => { if (v > ph) hgv.push(w); });
  return { workforce, hgv, any: workforce.length + hgv.length > 0 };
}

export function evaluatePosition(scenario, key = scenario.meta.issued) {
  const pos = buildPosition(scenario, key);
  const domains = pos.domains.map((d) => evaluateDomain(d, pos.headcount, scenario.meta));
  const hgv = domains.find((d) => d.id === "hgv");
  const eiar = eiarCheck(scenario, pos.headcount, hgv?.demand);
  const nowW = weekOf(scenario.meta, scenario.meta.today);
  const peakW = pos.headcount.indexOf(Math.max(...pos.headcount));
  const firstWall = domains.filter((d) => d.reachW != null).sort((a, b) => a.reachW - b.reachW)[0] || null;
  return { key, headcount: pos.headcount, domains, eiar, nowW, peakW, onSiteNow: pos.headcount[nowW], peak: pos.headcount[peakW], firstWall };
}

// --------------------------------------------------------------- re-base ----
// "What moved since last month": per-domain deltas between two dated positions.
export function rebase(scenario) {
  const now = evaluatePosition(scenario, scenario.meta.issued);
  const prev = evaluatePosition(scenario, scenario.meta.previous);
  const dW = (a, b) => (a == null || b == null ? null : a - b);
  return {
    issued: scenario.meta.issued, previous: scenario.meta.previous,
    headcount: { prevPeak: prev.peak, nowPeak: now.peak, prevPeakW: prev.peakW, nowPeakW: now.peakW },
    rows: now.domains.map((n) => {
      const p = prev.domains.find((x) => x.id === n.id);
      return {
        id: n.id, name: n.name, unit: n.unit, reachLabel: n.reachLabel,
        reach: { prev: p.reachDate, now: n.reachDate, deltaWeeks: dW(n.reachW, p.reachW), prevNull: p.reachW == null, nowNull: n.reachW == null },
        decideBy: { prev: p.decideByDate, now: n.decideByDate, deltaWeeks: dW(n.decideByW, p.decideByW) },
        shortfall: { prev: p.shortfall, now: n.shortfall, delta: n.shortfall - p.shortfall },
        status: { prev: p.status, now: n.status },
      };
    }),
  };
}

// --------------------------------------------------------- retrospective ----
export function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((l) => {
    const cells = l.split(",").map((c) => c.trim());
    const o = {}; headers.forEach((h, i) => (o[h] = cells[i] ?? "")); return o;
  });
  return { headers, rows };
}

// Two supported shapes: a weekly-actuals table, or an access-control export
// (one row per swipe: timestamp, person_id, gate, direction).
export function detectShape(headers) {
  const h = new Set(headers);
  if (h.has("timestamp") && h.has("person_id")) return "access";
  if (h.has("week")) return "weekly";
  return "unknown";
}

// Access-control rows -> weekly table with gate_count (peak daily unique
// persons in the week) so it can join the weekly shape.
export function accessToWeekly(rows, meta) {
  const byDay = new Map();
  for (const r of rows) {
    if ((r.direction || "in").toLowerCase() !== "in") continue;
    const day = r.timestamp.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(r.person_id);
  }
  const byWeek = new Map();
  for (const [day, set] of byDay) {
    const w = weekOf(meta, day);
    byWeek.set(w, Math.max(byWeek.get(w) || 0, set.size));
  }
  return [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([w, n]) => ({ week: String(w), on_site_peak: String(n) }));
}

// Column -> domain mapping for the weekly shape.
export const ACTUAL_COLUMNS = {
  gate_count: "gates", canteen_sittings: "canteen", parking_occupancy: "parking", bus_loads: "bus",
  hgv_per_day: "hgv", beds_booked: "beds", wc_installed_demand: "welfare", laydown_m2: "laydown",
};

// Rebuild each domain's curve from actuals; find the week capacity was
// actually reached, the decide-by that implied, and the cost of the gap at
// the client's own (input) rates.
export function retrospective(scenario, weeklyRows, columns = ACTUAL_COLUMNS) {
  const meta = scenario.meta;
  const pos = buildPosition(scenario, meta.issued);
  const weeks = weeklyRows.map((r) => parseInt(r.week, 10)).filter((w) => !Number.isNaN(w));
  const n = weeks.length ? Math.max(...weeks) + 1 : 0;
  const out = [];
  for (const [col, id] of Object.entries(columns)) {
    if (!weeklyRows.some((r) => r[col] !== undefined && r[col] !== "")) continue;
    const d = pos.domains.find((x) => x.id === id);
    const actual = new Array(n).fill(null);
    weeklyRows.forEach((r) => { const w = parseInt(r.week, 10); const v = parseFloat(r[col]); if (!Number.isNaN(w) && !Number.isNaN(v)) actual[w] = v; });
    const capacity = capacityCurve(d, n);
    let reachW = null, gapUnits = 0, gapWeeks = 0;
    for (let w = 0; w < n; w++) {
      if (actual[w] == null) continue;
      if (actual[w] > capacity[w]) { if (reachW == null) reachW = w; gapUnits += actual[w] - capacity[w]; gapWeeks++; }
    }
    const shortfall = Math.max(0, ...actual.map((a, w) => (a == null ? 0 : a - capacity[w])));
    const chosen = chooseRemedy(d, shortfall);
    const lead = chosen ? remedyLead(d, chosen) : null;
    const impliedDecideByW = reachW == null || !lead ? null : reachW - lead.total;
    const gapCost = gapUnits * d.gap_unit_cost.value;
    out.push({
      id, name: d.name, unit: d.unit, cap_type: d.cap_type, column: col,
      reachLabel: d.cap_type === "consented" ? "cap actually reached" : "capacity actually reached",
      actual, capacity, weeks: n, reachW, reachDate: reachW == null ? null : weekDate(meta, reachW),
      chosen, lead, impliedDecideByW, impliedDecideByDate: impliedDecideByW == null ? null : weekDate(meta, impliedDecideByW),
      decideByBeforeRecord: impliedDecideByW != null && impliedDecideByW < Math.min(...weeks),
      gapWeeks, gapUnits: Math.round(gapUnits), shortfall: Math.round(shortfall), gapCost: Math.round(gapCost),
      rate: d.gap_unit_cost,
    });
  }
  return { rows: out, weeks: n, totalGapCost: out.reduce((s, r) => s + r.gapCost, 0) };
}

export function money(meta, v) { return v == null ? "—" : `${meta.currency}${Math.round(v).toLocaleString("en-IE")}`; }
