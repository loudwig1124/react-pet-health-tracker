# GATE 3 — M2 Pets & records / M3 Vaccinations & appointments

| | |
| --- | --- |
| Milestones | **M2 · Pets and records** + **M3 · Vaccinations and appointments** (06 §2) |
| Verdict | **PASS** |
| Gate owner | qa-reviewer (t7) · milestone owners: pets-dev (t3, t9), schedule-dev (t4) |
| Date | 2026-11-25 14:05–14:08 (Asia/Manila) |
| Evidence log | [`evidence/gate-3.log`](./evidence/gate-3.log) · preview log: `evidence/preview-3.log` |
| Command | `GATE=3 E2E_SPECS="e2e/journal.spec.ts e2e/perf.spec.ts e2e/pets.spec.ts e2e/preferences.spec.ts e2e/reduced-motion.spec.ts e2e/resize.spec.ts e2e/schedule.spec.ts e2e/shell.spec.ts e2e/shots.spec.ts e2e/two-tab.spec.ts" bash scripts/gate.sh` |
| Screenshots | `shots/m3-{1440,1024,900}-{pets,appointments,journal}.png` (12 files) — dashboard shots also exist; see §6 note |

## 1 · M2 acceptance (06 §2 M2)

| # | Gate item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | `/pets` sortable table; filters and sort in the URL; reload/Back restore the view | **PASS** | `e2e/pets.spec.ts › sort and filters live in the URL and survive reload` — name-desc, per-pet, species and free-text state, each asserted after reload; `aria-sort` asserted |
| 2 | Add/edit/delete a pet through the dialog; row opens the pet page | **PASS** | `pets.spec.ts › create → edit → delete`; the full cycle drives the real dialog and asserts the row/detail text |
| 3 | Duplicate microchip rejected with a message | **PASS** | `pets.spec.ts › R9 validation` (role=alert contains “microchip”); repository rejects before write (Vitest R9) |
| 4 | DOB / weight / name bounds enforced | **PASS** | same test: future birthday, 301 kg, blank name; Vitest pet-validation suite |
| 5 | Deleting a pet cascades (journal/vaccinations/records deleted; appointments keep `petId = null`) | **PASS** | `pets.spec.ts › deleting a pet cascades…` asserts all four stores after the UI delete; Vitest pet-cascade suite |
| 6 | Records are append-only — no edit/delete affordance anywhere | **PASS** | `pets.spec.ts › records are append-only…` adds a note from `/records`, asserts the row, asserts no edit/delete text in the list, and checks the pet Records tab; Vitest R5 export-surface suite |
| 7 | Empty / error states; pet-not-found | **PASS** | `pets.spec.ts › a pet detail deep link for a missing pet explains itself`; `pets-empty` is exercised by the create test; skeletons/error panels are Vitest-covered |
| 8 | Route chunks within budget; size gate re-run and recorded here | **PASS** | `/pets` 13.4 kB, `/pets/:petId/:tab?` 6.9 kB, `/records` 3.3 kB gzip — §4 |
| 9 | Sort/filter comparators + URL parse/serialise | **PASS (unit)** | Vitest `src/lib/__tests__/pets-table.test.ts` (17), `records-table.test.ts` (12) |

## 2 · M3 acceptance (06 §2 M3)

| # | Gate item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Newest-dose-per-vaccine wins; a re-vaccinated pet clears overdue | **PASS** | `e2e/schedule.spec.ts › a newer dose clears overdue` — old row becomes `Superseded`, new row `Up to date`, `?status=overdue` filter empty; Vitest R1 tie-break suite (same-day createdAt → id) |
| 2 | Window edges (today / +14 / +15) correct | **PASS (unit)** | `src/lib/rules/vaccination-due.test.ts` (21); the e2e UI uses the same rule through `useVaccinationsData` |
| 3 | Booked visit → completed; terminal states immutable | **PASS** | `schedule.spec.ts › a booked visit can be completed…` asserts row status, `completedAt` in the store, and no Manage affordance after completion |
| 4 | Cancel requires a non-blank reason and stores it | **PASS** | `schedule.spec.ts › cancel needs a reason…` — confirm disabled for blank/whitespace, enabled for text, `cancelReason` asserted in the store |
| 5 | No-show blocked at `scheduled_at`, allowed one second later | **PASS** | `schedule.spec.ts › no-show is rejected…` — future visit shows the blocked helper and a disabled action; a seeded past visit allows it and lands `no_show` |
| 6 | Reschedule leaves no half-row | **PASS** | `schedule.spec.ts › reschedule closes the old visit as rescheduled…` — old row `cancelled` + reason `rescheduled`, replacement `scheduled`, one transaction (Vitest atomic-reschedule suite) |
| 7 | Calendar chunk lazy and ≤45 kB; routes ≤90 kB | **PASS** | `AppointmentCalendar` 20.1 kB gzip in its own lazy chunk; `schedule.spec.ts › calendar view…` asserts exactly one calendar chunk request on demand and URL restore on reload |
| 8 | URL state restores (`?status`, `?pet=all`, sort) | **PASS** | `schedule.spec.ts` status/pet/sort + `?pet=all` hand-off tests; `resize.spec.ts` keeps table layouts stable |
| 9 | An overdue row drills into the filtered list | **PASS** | covered end-to-end in GATE 5 (`dashboard.spec.ts › counters…`); the M3 filtered URL itself is asserted here |
| 10 | Pet detail Vaccinations and Appointments tabs are real screens | **PASS** | `schedule.spec.ts › pet-detail schedule tabs` — per-pet filter, newest-dose chip, empty state wording, past segment in the URL, and locked `pet`/`booking-pet` selects |
| 11 | Completed/cancelled invariants; blank reason blocked; write path re-checks | **PASS (unit + e2e)** | `appointment-fsm` 14 tests + the two e2e action flows above |

## 3 · Common gate (06 §5)

| Step | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` (`tsc -b`) | **PASS** | 0 errors |
| `pnpm lint` (`oxlint`) | **PASS** | 0 warnings, 0 errors |
| `pnpm format:check` (`oxfmt`) | **PASS** | all files formatted |
| `pnpm test` (`vitest run`) | **PASS** | **56 files / 402 tests** |
| `pnpm build` (`tsc -b && vite build && node scripts/check-size.mjs`) | **PASS** | size gate green — §4 |
| Playwright Chromium (10 specs) | **PASS** | **51/51**, 0 console/page errors (auto console guard in every spec) |
| 04 §5 “never ship” review | **PASS** | no animated width/height/filter, bounded lists, table/calendar/palette code only in lazy chunks (size scan) |
| No skipped/`.todo` tests | **PASS** | no `test.skip` / `test.fixme` / `.todo(` in `e2e/` or `src/` |

## 4 · Size gate (gzip, `evidence/gate-3.log`)

| Budget | Measured | Limit | Result |
| --- | --- | --- | --- |
| First load (shell + `/`) | **174.3 kB** | 200.0 kB | PASS |
| Largest lazy chunk | **24.3 kB** (`write-helpers`, zod/write graph) | 90.0 kB | PASS |
| `/pets` | 13.4 kB | 90.0 kB | PASS |
| `/pets/:petId/:tab?` | 6.9 kB | 90.0 kB | PASS |
| `/profile` | 6.9 kB | 90.0 kB | PASS |
| `/journal` | 4.9 kB | 90.0 kB | PASS |
| `/records` | 3.3 kB | 90.0 kB | PASS |
| `/appointments` | 2.9 kB | 90.0 kB | PASS |
| `/vaccinations` | 2.2 kB | 90.0 kB | PASS |
| Calendar chunk | **20.1 kB** | 45.0 kB | PASS |
| Initial CSS | **15.4 kB** | 35.0 kB | PASS |
| Eager-shell content scan (table/calendar/palette/chart/motion) | no matches | none | PASS |

## 5 · Performance snapshot (asserted at GATE 5)

From `e2e/perf.spec.ts` (Chromium, production preview, warm-cache reload):

| Metric | Measured | Budget |
| --- | --- | --- |
| LCP | **336 ms** | ≤ 1,500 ms |
| DOM nodes (dashboard) | **260** | ≤ 1,200 |
| Route swap, max of five destinations | **9.6 ms** | ≤ 100 ms |
| Long tasks > 50 ms | **none** | none |

## 6 · How this gate was captured (transparency)

M2, M3, M4 and M5 were built in parallel by different members on one tree. A clean, reproducible gate run over M2/M3 was only possible once M4/M5 stopped writing (a first attempt at 13:24 hit in-flight `src/lib/desktop/**` and `src/lib/pets-table.ts` changes; a second attempt at 13:26 was killed by a stale preview server on 4173 — now prevented by an isolated gate port). The run above is on the integrated tree; every M2/M3 acceptance item is unchanged and regression-covered, and `schedule-dev` re-ran the M3 suites (7 files / 50 tests) on the tab-wiring tree.

The 12 `m3-*` screenshots were captured on the same integrated tree. Pets, appointments and journal are the M2/M3 compositions; the dashboard in the `m3-*` set already shows the M5 counters, so treat the dashboard screenshots as current-state evidence and the per-screen shots as the M2/M3 layout evidence.

## 7 · What to fix

**None for this gate.** No failed acceptance item, no skipped test, no console error.

Non-blocking follow-ups for the final acceptance pass (not milestone failures):

| Observation | Owner | Note |
| --- | --- | --- |
| Journal repeats the primary action: header `Log entry` and toolbar `Log entry` | M4 (journal-dev) | visual duplication only; both open the same editor |
| Dashboard section heading reads “Pets · 3 pets” | M5 (desktop-dev) | duplicated noun in the heading; cosmetic |
