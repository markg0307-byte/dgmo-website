# Genkai demo — derivation record

Dated record of how the scenario model, its ratios, its templates and its
sample data were built. Nothing in the demo was taken from, measured on, or
adjusted to match any client artefact. Every figure below is synthetic and is
labelled as such in the UI.

| Date | Entry |
|---|---|
| 2026-08-30 | Site renamed Genkai. Demo brief written naming `genkai/scenario.html`, `middleware.js`, `verify.js`, `leakscan.js`. None existed at that point. |
| 2026-09-02 | Demo built from scratch as described below. Repository scanner (`scripts/leakscan.mjs`) written first and wired into CI so no commit can carry an identifying figure. |

## Files

| File | What it is |
|---|---|
| `genkai/synthetic.js` | The scenario object: fictional campus, weekly headcount curve, eight domains, ratios, capacities, remedies, consent records, two dated positions, sample CSVs. |
| `genkai/middleware.js` | The engine. Pure functions: demand and capacity curves, capacity-reach / cap-reach week, remedy lead from tables, decide-by date, EIAR peak check, re-base deltas, CSV parsing and the retrospective rebuild. |
| `genkai/verify.js` | Rule checks over the scenario: provenance on every input, verbatim quote and clause on every consented cap, lead times from tables only, consent status on every remedy, reserved-word check, EIAR flags. |
| `genkai/leakscan.js` | Browser-side, pattern-only identifier check run over pasted CSVs and exports. Holds no lists of names. |
| `genkai/scenario.html` | The UI. Dark on screen; the Retrospective report prints in a light palette. |
| `scripts/leakscan.mjs` | Repository scanner with the specific rules. Runs in CI on push and pull request. |

## Terminology

- **capacity-reach date** — the week demand first exceeds a physical cap.
- **cap-reach forecast** — the week demand first exceeds a consented cap.
- **decide-by date** — reach date minus the total lead of the chosen remedy.
- The word reserved for planning officers appears in exactly one place: the
  officer-determination field on each domain, which records what an officer
  has determined, never what the model forecasts. The product name
  "The Breach Check" on the marketing site is the only other permitted use.

## The fictional campus

"DC-North Campus — a campus that does not exist." Weeks are counted from
Monday 5 January 2026. The headcount curve is a logistic ramp,
`3400 / (1 + e^-((w-31)/9))`, with an exponential decline after week 68 and a
small sinusoidal wobble so it does not look machine-made. The wobble carries the
peak (about 3,430 in April 2027) just above the fictional EIAR assessed peak
of 3,400, so the EIAR peak check has something to show. On-site-now (about
1,980 at 1 September 2026) follows from the curve.

## Ratios — every one an input with provenance

Ratios in the demo are chosen so the eight domain cards show a spread of
statuses (reached, decide-passed, watch, clear) on the demo date. They were
set by picking a plausible-looking demand-now figure for each domain and
dividing by on-site-now; they are **not** observations.

| Domain | Ratio in demo | Unit | Provenance in UI | Source shown |
|---|---|---|---|---|
| Beds & travel-to-work | 0.34 | beds per person | assumed, low | synthetic — replace with an accommodation survey |
| Worker parking | 0.62 | spaces per person | assumed, low | synthetic — replace with a counted occupancy survey |
| Welfare | 1/25 | WCs per person | **statutory, medium — provisional** | 1 WC per 25 persons; to be confirmed against the current Irish construction welfare provisions before issue |
| Gates, access & induction | 0.052 | inductions/day per person | assumed, low | synthetic — weekly churn plus growth over five days |
| Deliveries & vehicles | 0.078 | HGV movements/day per person | assumed, low | synthetic — replace with counted gate-log movements |
| Laydown & warehousing | 7.4 | m² per person | assumed, low | synthetic — replace with an allocation register |
| Bussing & park-and-ride | 0.29 | seats per person | assumed, low | synthetic — replace with counted bus loads |
| Canteens | 0.41 | covers per person | assumed, low | synthetic — replace with till counts |

The welfare figure is the only one presented as statutory, and it is marked
provisional until its instrument and clause are confirmed. Its confidence is
"medium", not "high", for that reason.

### Retired ratios

An earlier draft of the demo carried ratios that presented as sourced but
were invented. They must not reappear as sourced figures. The repository
scanner fails on any of them unless the line says "retired":

- retired: 0.565 spaces per person
- retired: 0.42 beds per person
- retired: 0.31 gate throughput
- retired: 0.145 HGV per day per person
- retired: 12.5 m² laydown per person
- retired: 0.22 bus seats per person
- retired: 0.40 canteen seats per person

## Capacities

Chosen to give each domain a different distance to its limit on the demo
date. Two domains have a step (welfare +16 WCs at week 40; laydown +6,500 m²
at week 55) so the staircase renders. All synthetic.

## Consented caps

Two domains are consented in the demo:

- **Worker parking** — instrument CTMP/CEMP; the fictional CTMP rev C §4.2
  quoted verbatim in the scenario; route to remedy: non-material amendment.
- **Deliveries & vehicles** — instrument condition; fictional Condition 14(b)
  quoted verbatim; route to remedy: agreement under the condition.

Both carry `signed_by` and `signed_date` reading "planning advice required".
The lead time of a consented cap is never typed: it is read from the chosen
route branch.

### Consent lead-time tables (placeholders)

| Route to remedy | Weeks | Basis |
|---|---|---|
| Agreement under the condition | 8 | synthetic placeholder |
| Non-material amendment | 12 | synthetic placeholder |
| Parallel application | 26 | synthetic placeholder |

| Remedy consent status | Weeks | Basis |
|---|---|---|
| Exempt development | 0 | synthetic placeholder, medium confidence |
| Section 5 declaration | 6 | synthetic placeholder |
| Planning permission | 26 | synthetic placeholder |
| CEMP / CTMP variation | 6 | synthetic placeholder |

All are labelled assumed with a source line saying they await planning
advice. The engine adds a remedy's build lead to the longer of its own
consent step and the cap's route step (consent steps run in parallel, build
follows). This is documented in `middleware.js` and can be changed there.

## Remedies

Two or three per domain. Capacity added, build lead, cost, consent status and
owner are all synthetic and chosen to make the decide-by arithmetic visible:
at least one remedy per domain needs consent so its decide-by moves.

## EIAR peaks

Assessed peak workforce 3,400 and assessed peak HGV 240/day. Synthetic; they
stand in for the EIAR chapter figures. The workforce peak is exceeded by the
forecast for a handful of weeks around April 2027 by design.

## Client rates for the Retrospective

Each domain carries a `gap_unit_cost` (for example € per space-week short).
All are synthetic placeholders labelled assumed, and the UI lets the client
overwrite them; the cost of the gap is only ever computed at the rates in the
scenario at the time.

## Sample data

- `sampleActualsCsv()` — 36 weeks of weekly actuals generated from a slightly
  higher headcount curve with sinusoidal noise, so some domains reach
  capacity earlier than the forecast said.
- `sampleAccessControlCsv()` — ten days of one-row-per-swipe records in the
  shape an access-control export takes (timestamp, person_id, gate,
  direction). Person IDs are sequential; nothing is real.

## Two dated positions

The re-base card diffs 1 August 2026 against 1 September 2026. The August
position is the same scenario with a slightly lower, later headcount curve
(scale 0.965, peak two weeks later), a lower parking ratio, a lower HGV
ratio, a lower canteen ratio and no welfare step. These are the sort of
things that change between issues; the values are synthetic.

## Palette

Shu vermilion `#E2472B` is used only for the limit (the ceiling bar and the
capacity staircase on charts). Buttons, links, headings and series use amber,
blue and the neutral inks. The Retrospective report prints black on white
with one thin vermilion limit line per chart.
