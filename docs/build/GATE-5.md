# GATE 5 — M5 Desktop extras and performance pass

| | |
| --- | --- |
| Milestone | **M5 · Desktop extras and performance pass** (06 §2 M5) — the release-one freeze gate |
| Verdict | **PASS** |
| Gate owner | qa-reviewer (t7) · milestone owner: desktop-dev (t6) |
| Date | 2026-11-25 14:08–14:11 (Asia/Manila) |
| Evidence log | [`evidence/gate-5.log`](./evidence/gate-5.log) · preview log: `evidence/preview-5.log` |
| Previous gates | [`GATE-1.md`](./GATE-1.md) (M1) · [`GATE-3.md`](./GATE-3.md) (M2+M3) |
| Superseded by | [`GATE-6.md`](./GATE-6.md) — final numbers and screenshots after the t11–t13 visual fixes; this report remains the M5-freeze evidence and the “before” pictures |
| Command | `GATE=5 bash scripts/gate.sh` |
| Screenshots | 12 files: [`shots/m5-1440-dashboard.png`](./shots/m5-1440-dashboard.png), `m5-1024-dashboard.png`, `m5-900-dashboard.png`, and the same three widths for `pets`, `appointments`, `journal` |

## 1 · M5 acceptance (06 §2 M5)

| # | Gate item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Four counters match R1/R4 fixtures (pets, overdue, due soon, visits this week) | **PASS** | `e2e/dashboard.spec.ts › counters match the rules…` — 3 pets / 1 overdue / 1 due soon / 1 visit, seeded through the shared fixture; counts derive from `computeHouseholdAttention` (Vitest `desktop-attention.test.ts`) |
| 2 | Each counter drills into its filtered list | **PASS** | same test: `counter-overdue` → `/vaccinations?status=overdue`, table shows the overdue dose and hides the due-soon one |
| 3 | Attention rail lists the actual doses and next visit | **PASS** | `dashboard.spec.ts` — `attention-row-e2e-dose-rabies` / `-felv`, `next-visit-row-e2e-visit-today` with purpose |
| 4 | Sidebar attention counts: Vaccinations = overdue + due soon, Appointments = today, tooltip splits, zeros hidden | **PASS** | `dashboard.spec.ts › sidebar badges split…` (`data-count=2`, title “1 overdue · 1 due soon”; appointments today = 1) and `› badges hide when nothing needs attention` |
| 5 | ⌘K palette searches pets/records/notes/visits, runs create commands, ≤8 per group, Enter navigates, Esc closes | **PASS** | `dashboard.spec.ts` palette tests: search “Bella” → `command-group-pets` → Enter → `/pets/demo/health`; every group ≤8; Escape closes; `command-empty`/`command-loading` states covered by Vitest |
| 6 | Keyboard flow complete: ⌘1–6, ⌘K, ⌘N, ⌘B, ⌘,, `?`, plain-key aliases, fields swallow shortcuts | **PASS** | `shell.spec.ts` (⌘1–6/⌘B/⌘,) + `dashboard.spec.ts` (⌘K, ⌘N → create section → booking dialog, `?` → shortcut sheet, plain `2`/`6`/`n`, typing in a field does not navigate) |
| 7 | Sort/filter still survive reload (F5/F6 regression) | **PASS** | `pets.spec.ts` and `schedule.spec.ts` URL-state tests re-run in this gate |
| 8 | Palette mounts lazily; table/calendar/palette code never in the first chunk | **PASS** | size scan: “no table, calendar, palette, chart or motion code in the first chunk”; `CommandPalette` is a 3.6 kB lazy chunk |
| 9 | No chart dependency, no service worker registered | **PASS** | size scan has no recharts/chart chunk; `dashboard.spec.ts › no service worker…` asserts `navigator.serviceWorker.getRegistrations()` is empty |
| 10 | Performance budgets: LCP ≤ 1.5 s, DOM ≤ 1,200, route swap ≤ 100 ms, no long task > 50 ms | **PASS** | `perf.spec.ts` — LCP **336 ms**, DOM **260**, max route swap **9.1 ms**, long tasks **none** (§4) |
| 11 | `prefers-reduced-motion` honoured, nothing motion-only | **PASS** | `reduced-motion.spec.ts` — no transform/opacity motion > 80 ms on any route, navigation works, normal-vs-reduced visible text identical |
| 12 | Two tabs stay in sync without a refresh | **PASS** | `two-tab.spec.ts` — a journal write in tab A appears in the mounted feed in tab B, then survives a reload |
| 13 | Keyboards, focus and table actions; `?` sheet; palette recents (Should F8/F9 after Musts) | **PASS** | `dashboard.spec.ts` shortcut sheet + palette recents group (`command-group-recent`), visible-focus test in `shell.spec.ts`, arrow/Enter row keyboard tests in Vitest (`table-keyboard.test.ts`) |
| 14 | Size gate re-run before freeze | **PASS** | §3, inside this log |

## 2 · Common gate (06 §5)

| Step | Result | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | **PASS** | 0 errors |
| `pnpm lint` | **PASS** | 0 warnings, 0 errors |
| `pnpm format:check` | **PASS** | all files formatted |
| `pnpm test` | **PASS** | **56 files / 402 tests** |
| `pnpm build` + size gate | **PASS** | §3 |
| Playwright Chromium, all specs | **PASS** | **60/60**, zero console/page errors |
| No skipped/`.todo` tests | **PASS** | no `test.skip` / `test.fixme` / `.todo(` in `e2e/` or `src/` |
| 04 §5 “never ship” review | **PASS** | no animated height/filter, bounded lists, lazy table/calendar/palette, four Magic UI components only (Progressive Blur in the shell, Dot Pattern + Animated List in M4, Number Ticker/Shine Border optional — first load stayed at 174.3 kB) |

## 3 · Size gate (gzip, `evidence/gate-5.log`)

| Budget | Measured | Limit | Result |
| --- | --- | --- | --- |
| First load (eager shell + `/` route, incl. dashboard overview) | **174.3 kB** | 200.0 kB | PASS |
| Largest lazy chunk (`write-helpers`, zod/write graph) | **24.3 kB** | 90.0 kB | PASS |
| `/pets` | 13.4 kB | 90.0 kB | PASS |
| `/pets/:petId/:tab?` (incl. Vaccinations/Appointments/Journal tabs) | 6.9 kB | 90.0 kB | PASS |
| `/profile` | 6.9 kB | 90.0 kB | PASS |
| `/journal` | 4.9 kB | 90.0 kB | PASS |
| `/records` | 3.3 kB | 90.0 kB | PASS |
| `/appointments` | 2.9 kB | 90.0 kB | PASS |
| `/vaccinations` | 2.2 kB | 90.0 kB | PASS |
| Calendar chunk | **20.1 kB** | 45.0 kB | PASS |
| Palette chunk | 3.6 kB | 90.0 kB | PASS |
| Shortcut-sheet chunk | 1.0 kB | 90.0 kB | PASS |
| Initial CSS | **15.4 kB** | 35.0 kB | PASS |
| Eager-shell content scan | no table/calendar/palette/chart/motion markers | none | PASS |

First-load file breakdown: entry 134.9 kB + rolldown runtime 0.4 + jsx-runtime 3.0 + two `dist` helpers 3.1 + `db` 31.0 + dashboard route 1.4 + summary-format 0.5 = **174.3 kB**.

## 4 · Performance

Measured by `e2e/perf.spec.ts` on the production preview (Chromium, warm HTTP cache, then a genuine reload):

| Metric | Measured | Budget | Result |
| --- | --- | --- | --- |
| LCP | **336 ms** | ≤ 1,500 ms | PASS |
| DOM nodes (dashboard with data) | **260** | ≤ 1,200 | PASS |
| Route swap (max of Pets / Appointments / Vaccinations / Records / Journal) | **9.1 ms** | ≤ 100 ms | PASS |
| Long tasks > 50 ms | **none** | none | PASS |

The M5 eager-graph trim (light owner projection + literal catalog seed in boot; zod kept on all write paths) is why first load dropped from the M4 reading of 203.8 kB to 174.3 kB.

## 5 · E2E coverage (60 tests, 11 specs)

| Spec | Tests | What it gates |
| --- | --- | --- |
| `shell.spec.ts` | 8 | boot 1440/1024, deep links + reload, mouse nav, ⌘1–6/⌘B/⌘,, live resize, focus ring, `/settings` 404 |
| `resize.spec.ts` | 4 | live resize on dashboard, `/pets`, journal (editor → Sheet) and pet detail; no sideways scrolling; avatar footer |
| `reduced-motion.spec.ts` | 3 | ≤80 ms transform/opacity motion, navigation, motion-only information parity |
| `perf.spec.ts` | 2 | LCP/DOM/long task, route-swap timing |
| `shots.spec.ts` | 1 | 1440/1024/72 px rail screenshots at every gate |
| `pets.spec.ts` | 6 | create → edit → delete, R9 validation, cascade, sort/filter reload, append-only records, missing pet |
| `schedule.spec.ts` | 10 | vaccination newest-dose clears overdue, URL filters, book → complete, cancel reason, no-show gating, atomic reschedule, calendar lazy, `?pet=all`, pet-detail tabs |
| `journal.spec.ts` | 6 | day grouping, edit moves day, immutable kind, delete + 3 s Undo, filters reload, pet-detail journal tab |
| `preferences.spec.ts` | 10 | owner persist, window/unit/density persist, density spacing only, sample toggle R7, reset R8 ±forget, first-run create/sample, first-run gate |
| `two-tab.spec.ts` | 1 | cross-tab live update without refresh |
| `dashboard.spec.ts` | 9 | counters + drill-down, badges, recent-journal cap, no SW/DOM budget, ⌘K palette, ⌘N create, group cap + `?` sheet, plain-key aliases |

## 6 · Screenshots

`docs/build/shots/m5-{1440,1024,900}-{dashboard,pets,appointments,journal}.png` — captured from the final preview build with a populated household (three pets, an overdue and a due-soon dose, an upcoming and a completed visit, a clinical note, journal entries) and a data-ready wait, so they show the demo-able product, not skeletons. The 72 px rail is the 900 px width.

## 7 · What to fix

**No gate failures.** Every M5 acceptance item is green, every budget is inside its limit, and there are no skipped tests or console errors.

Non-blocking polish for the final acceptance pass (cosmetic, not acceptance items):

| Observation | Owner | Suggested fix |
| --- | --- | --- |
| Dashboard heading reads “Pets · 3 pets” (noun repeated) | M5 (desktop-dev) | render “Pets · 3” or “3 pets” only |
| Journal has two `Log entry` buttons (header action + toolbar) | M4 (journal-dev) | keep the header action and drop the toolbar one, or hide the toolbar action ≥1280 |
| Appointments/injections occasionally show a native select date/time format (e.g. `11/25/2026`, `01:10 PM`) | M3/M4 | accepted: the browser locale drives native date/time inputs; the app's display dates use `Intl` per 02 |
