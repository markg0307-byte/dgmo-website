// DC-North Campus — a campus that does not exist.
//
// Every figure in this file is synthetic.  Nothing here was measured on, or
// carried across from, any client programme.  docs/DERIVATION.md records how
// each value was chosen.  Ratios and rates are INPUTS: each carries a
// provenance marker {statutory | observed | assumed}, a source and a date, and
// the UI lets the user replace any of them.

export const WEEK_MS = 7 * 24 * 3600 * 1000;

// Consent routes for a CONSENTED cap.  Lead time comes from the chosen
// branch — it is never typed free-hand.  Values are synthetic placeholders
// until planning advice replaces them.
export const CONSENT_ROUTES = {
  agreement_under_condition: { label: "Agreement under the condition", lead_weeks: 8,
    basis: { provenance: "assumed", source: "synthetic placeholder — typical time to agree a variation with the planning authority under the condition's own mechanism", date: "2026-09-01", confidence: "low" } },
  non_material_amendment:    { label: "Non-material amendment", lead_weeks: 12,
    basis: { provenance: "assumed", source: "synthetic placeholder — statutory timetable for a non-material amendment application, to be confirmed by planning advice", date: "2026-09-01", confidence: "low" } },
  parallel_application:      { label: "Parallel application", lead_weeks: 26,
    basis: { provenance: "assumed", source: "synthetic placeholder — a fresh application run alongside the parent consent, to be confirmed by planning advice", date: "2026-09-01", confidence: "low" } },
};

// Consent status of a REMEDY (the fix column).  The lead time delays the
// remedy start and therefore moves the decide-by date earlier.
export const REMEDY_CONSENT = {
  exempt:         { label: "Exempt development", lead_weeks: 0,
    basis: { provenance: "assumed", source: "synthetic placeholder — no consent step; confirm exemption class before relying on it", date: "2026-09-01", confidence: "medium" } },
  s5_declaration: { label: "Section 5 declaration", lead_weeks: 6,
    basis: { provenance: "assumed", source: "synthetic placeholder — declaration on whether the works are exempted development; timetable to be confirmed by planning advice", date: "2026-09-01", confidence: "low" } },
  permission:     { label: "Planning permission", lead_weeks: 26,
    basis: { provenance: "assumed", source: "synthetic placeholder — a full application including the decision period and a judicial-review window; to be confirmed by planning advice", date: "2026-09-01", confidence: "low" } },
  cemp_variation: { label: "CEMP / CTMP variation", lead_weeks: 6,
    basis: { provenance: "assumed", source: "synthetic placeholder — agreeing a revision to the construction environmental or traffic management plan with the authority", date: "2026-09-01", confidence: "low" } },
};

// The officer-determination field is the ONE place the word "breach" appears
// in the demo.  It records what a planning officer has determined, not what
// the model forecasts.
export const OFFICER_DETERMINATION_OPTIONS = ["not determined", "no breach found", "breach of condition determined"];

const P = (provenance, source, date, confidence) => ({ provenance, source, date, confidence });
const SYN = (what) => P("assumed", `synthetic demonstration value — ${what}`, "2026-09-01", "low");

// Weekly headcount curve.  104 weeks from Monday 5 Jan 2026.  A logistic
// ramp to a peak in Apr 2027 and a decline into commissioning.
export function headcountCurve(scale = 1, peakShift = 0) {
  const out = [];
  for (let w = 0; w < 104; w++) {
    const t = w - peakShift;
    const ramp = 3400 / (1 + Math.exp(-(t - 31) / 9));
    const fall = t > 68 ? Math.exp(-(t - 68) / 14) : 1;
    const wobble = 1 + 0.03 * Math.sin(w / 3.1) + 0.02 * Math.cos(w / 5.7);
    out.push(Math.round(Math.max(380, ramp * fall * wobble * scale)));
  }
  return out;
}

export const SCENARIO = {
  meta: {
    name: "DC-North Campus",
    strap: "a campus that does not exist",
    synthetic: true,
    week0: "2026-01-05",
    issued: "2026-09-01",      // this month's position
    previous: "2026-08-01",    // last month's position (re-base card)
    today: "2026-09-01",
    currency: "€",
  },

  // Environmental impact assessment peaks the consent was assessed against.
  eiar: {
    peak_workforce: { value: 3400, unit: "persons on site", basis: P("assumed", "synthetic — stands in for the EIAR chapter that assessed construction workforce; replace with the assessed figure and chapter reference", "2026-09-01", "low") },
    peak_hgv_per_day: { value: 240, unit: "HGV movements/day", basis: P("assumed", "synthetic — stands in for the EIAR traffic chapter's assessed construction HGV peak", "2026-09-01", "low") },
  },

  headcount: { values: headcountCurve(), basis: SYN("logistic ramp to a peak of about 3,430 in Apr 2027, then a commissioning-phase decline") },

  domains: [
    {
      id: "beds", name: "Beds & travel-to-work", unit: "beds within 45 min", cap_type: "physical",
      ratio: { value: 0.34, unit: "beds per person on site", basis: SYN("share of the workforce needing a bed within 45 minutes; replace with an observed accommodation survey") },
      capacity: [{ from: 0, value: 760, basis: SYN("market bed stock within 45 minutes; replace with a lettings survey") }],
      gap_unit_cost: { value: 210, unit: "€ per bed-week short", basis: SYN("cost of a hotel-rate bed over a lettings-rate bed; replace with the client's own rate") },
      remedies: [
        { id: "b1", name: "Block-book a hostel", capacity_add: 120, lead_weeks: 10, cost: 180000, consent: "exempt", owner: "Accommodation lead" },
        { id: "b2", name: "Temporary worker village", capacity_add: 400, lead_weeks: 30, cost: 2400000, consent: "permission", owner: "Programme director" },
      ],
      officer_determination: "not determined",
    },
    {
      id: "parking", name: "Worker parking", unit: "spaces", cap_type: "consented",
      ratio: { value: 0.62, unit: "spaces per person on site", basis: SYN("observed-looking occupancy ratio; replace with a counted occupancy survey") },
      capacity: [{ from: 0, value: 1180, basis: P("assumed", "synthetic — cap quoted from the fictional CTMP below", "2026-09-01", "low") }],
      consent: {
        instrument: "CTMP/CEMP",
        quote: "On-site parking for construction personnel shall not exceed 1,180 spaces at any time during the construction phase.",
        clause: "CTMP rev C §4.2 (fictional)",
        route_to_remedy: "non_material_amendment",
        signed_by: "planning advice required",
        signed_date: "planning advice required",
      },
      gap_unit_cost: { value: 95, unit: "€ per space-week short", basis: SYN("marshalled overflow cost per space per week; replace with the client's own rate") },
      remedies: [
        { id: "p1", name: "Staggered shift starts", capacity_add: 90, lead_weeks: 3, cost: 25000, consent: "exempt", owner: "Site logistics manager" },
        { id: "p2", name: "Remote lot with shuttle", capacity_add: 350, lead_weeks: 14, cost: 620000, consent: "permission", owner: "Programme director" },
        { id: "p3", name: "Deck the north car park", capacity_add: 500, lead_weeks: 22, cost: 1900000, consent: "permission", owner: "Client estates" },
      ],
      officer_determination: "not determined",
    },
    {
      id: "welfare", name: "Welfare", unit: "WCs", cap_type: "physical",
      ratio: { value: 1 / 25, unit: "WCs per person on site", basis: P("statutory", "1 WC per 25 persons — provisional; to be confirmed against the current Irish construction welfare provisions before issue", "2026-09-01", "medium") },
      capacity: [{ from: 0, value: 96, basis: SYN("installed WC count across three welfare blocks") }, { from: 40, value: 112, basis: SYN("fourth welfare block, week 40") }],
      gap_unit_cost: { value: 240, unit: "€ per WC-week short", basis: SYN("hire cost of a serviced unit per week; replace with the client's own rate") },
      remedies: [
        { id: "w1", name: "Hired welfare units, plumbed", capacity_add: 24, lead_weeks: 6, cost: 90000, consent: "exempt", owner: "Site services manager" },
        { id: "w2", name: "Fifth welfare block", capacity_add: 40, lead_weeks: 16, cost: 410000, consent: "s5_declaration", owner: "Client estates" },
      ],
      officer_determination: "not determined",
    },
    {
      id: "gates", name: "Gates, access & induction", unit: "inductions/day", cap_type: "physical",
      ratio: { value: 0.052, unit: "inductions per day per person on site (churn + growth)", basis: SYN("weekly churn plus net growth, spread over five days; replace with the access-control system's own starter count") },
      capacity: [{ from: 0, value: 88, basis: SYN("two induction rooms at 44/day") }],
      gap_unit_cost: { value: 310, unit: "€ per induction-day of backlog", basis: SYN("lost first-day productivity per person queued; replace with the client's own rate") },
      remedies: [
        { id: "g1", name: "Third induction room", capacity_add: 44, lead_weeks: 5, cost: 60000, consent: "exempt", owner: "HSE manager" },
        { id: "g2", name: "Off-site induction centre", capacity_add: 120, lead_weeks: 12, cost: 340000, consent: "cemp_variation", owner: "Programme director" },
      ],
      officer_determination: "not determined",
    },
    {
      id: "hgv", name: "Deliveries & vehicles", unit: "HGV movements/day", cap_type: "consented",
      ratio: { value: 0.078, unit: "HGV movements per day per person on site", basis: SYN("delivery intensity per head; replace with the gate log's counted movements") },
      capacity: [{ from: 0, value: 240, basis: P("assumed", "synthetic — cap quoted from the fictional planning condition below", "2026-09-01", "low") }],
      consent: {
        instrument: "condition",
        quote: "Construction-related HGV movements to and from the site shall not exceed 240 per day (120 in, 120 out) Monday to Friday, and 60 per day on Saturdays.",
        clause: "Condition 14(b) of the parent permission (fictional)",
        route_to_remedy: "agreement_under_condition",
        signed_by: "planning advice required",
        signed_date: "planning advice required",
      },
      gap_unit_cost: { value: 140, unit: "€ per movement-week held off site", basis: SYN("holding-compound and re-delivery cost per movement per week; replace with the client's own rate") },
      remedies: [
        { id: "h1", name: "Consolidation centre", capacity_add: 60, lead_weeks: 12, cost: 520000, consent: "cemp_variation", owner: "Logistics lead" },
        { id: "h2", name: "Rail-fed aggregate", capacity_add: 40, lead_weeks: 20, cost: 900000, consent: "permission", owner: "Programme director" },
      ],
      officer_determination: "not determined",
    },
    {
      id: "laydown", name: "Laydown & warehousing", unit: "m² serviced", cap_type: "physical",
      ratio: { value: 7.4, unit: "m² per person on site", basis: SYN("laydown intensity per head; replace with a measured allocation register") },
      capacity: [{ from: 0, value: 19500, basis: SYN("serviced laydown across four zones") }, { from: 55, value: 26000, basis: SYN("east field opened week 55") }],
      gap_unit_cost: { value: 1.8, unit: "€ per m²-week short", basis: SYN("off-site storage and double-handling per m² per week; replace with the client's own rate") },
      remedies: [
        { id: "l1", name: "Open the east field early", capacity_add: 6500, lead_weeks: 8, cost: 240000, consent: "exempt", owner: "Site logistics manager" },
        { id: "l2", name: "Off-site warehouse", capacity_add: 8000, lead_weeks: 10, cost: 380000, consent: "exempt", owner: "Logistics lead" },
      ],
      officer_determination: "not determined",
    },
    {
      id: "bus", name: "Bussing & park-and-ride", unit: "seats", cap_type: "physical",
      ratio: { value: 0.29, unit: "seats per person on site", basis: SYN("share of the workforce arriving by shuttle; replace with counted bus loads") },
      capacity: [{ from: 0, value: 840, basis: SYN("fourteen coaches at 60 seats, two runs") }],
      gap_unit_cost: { value: 3900, unit: "€ per coach-week added", basis: SYN("coach-and-driver hire per week; replace with the client's own rate") },
      remedies: [
        { id: "s1", name: "Two more coaches", capacity_add: 120, lead_weeks: 4, cost: 110000, consent: "exempt", owner: "Transport coordinator" },
        { id: "s2", name: "Second park-and-ride", capacity_add: 400, lead_weeks: 18, cost: 760000, consent: "permission", owner: "Programme director" },
      ],
      officer_determination: "not determined",
    },
    {
      id: "canteen", name: "Canteens", unit: "covers", cap_type: "physical",
      ratio: { value: 0.41, unit: "covers per person on site", basis: SYN("share of the workforce taking a canteen sitting; replace with till counts") },
      capacity: [{ from: 0, value: 1080, basis: SYN("three canteens over two sittings") }],
      gap_unit_cost: { value: 6.5, unit: "€ per cover-week short", basis: SYN("packed-meal premium per cover; replace with the client's own rate") },
      remedies: [
        { id: "c1", name: "Third sitting", capacity_add: 300, lead_weeks: 3, cost: 40000, consent: "exempt", owner: "Site services manager" },
        { id: "c2", name: "Fourth canteen", capacity_add: 400, lead_weeks: 14, cost: 520000, consent: "s5_declaration", owner: "Client estates" },
      ],
      officer_determination: "not determined",
    },
  ],

  // Last month's position, expressed as overrides on this month's.  The
  // re-base card diffs the two.
  positions: {
    "2026-08-01": {
      headcount: headcountCurve(0.965, 2),
      overrides: {
        parking: { ratio: 0.58 },
        welfare: { capacity: [{ from: 0, value: 96 }] },
        hgv: { ratio: 0.072 },
        canteen: { ratio: 0.39 },
      },
    },
  },
};

// A sample of weekly actuals for the Retrospective — 36 weeks of the same
// fictional campus, with the kind of noise real records have.
export function sampleActualsCsv() {
  const rows = ["week,gate_count,canteen_sittings,parking_occupancy,bus_loads,hgv_per_day,beds_booked,wc_installed_demand,laydown_m2"];
  const hc = headcountCurve(1.04, -1);
  for (let w = 0; w < 36; w++) {
    const h = hc[w];
    const n = (k) => 1 + 0.06 * Math.sin(w * k + 1) + 0.03 * Math.cos(w * k * 1.7);
    rows.push([
      w,
      Math.round(h * 0.055 * n(0.7)),
      Math.round(h * 0.43 * n(0.9)),
      Math.round(h * 0.64 * n(1.1)),
      Math.round(h * 0.30 * n(0.5)),
      Math.round(h * 0.081 * n(1.3)),
      Math.round(h * 0.35 * n(0.4)),
      Math.round(h / 25 * n(0.8)),
      Math.round(h * 7.6 * n(0.6)),
    ].join(","));
  }
  return rows.join("\n");
}

// A sample in the shape an access-control export takes: one row per swipe.
export function sampleAccessControlCsv() {
  const rows = ["timestamp,person_id,gate,direction"];
  const base = new Date("2026-03-02T06:00:00Z").getTime();
  let id = 1000;
  for (let day = 0; day < 10; day++) {
    if (day % 7 >= 5) continue;
    const onSite = 900 + day * 12;
    for (let p = 0; p < onSite; p++) {
      const t = base + day * 86400000 + (p % 90) * 60000;
      rows.push(`${new Date(t).toISOString()},P${id + (p % 950)},G${1 + (p % 3)},in`);
    }
  }
  return rows.join("\n");
}
