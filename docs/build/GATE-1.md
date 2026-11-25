# GATE 1 — M1 Foundation

| | |
| --- | --- |
| Milestone | **M1 · Foundation** — scaffold, tokens, shell, data layer (06 §2) |
| Verdict | **PASS** |
| Gate owner | qa-reviewer (t7) · milestone owner: foundation-dev (t2) |
| Date | 2026-11-25 12:31–12:45 (Asia/Manila) |
| Evidence log | [`evidence/gate-1.log`](./evidence/gate-1.log) |
| Screenshots | [`shots/m1-1440-dashboard.png`](./shots/m1-1440-dashboard.png) · [`shots/m1-1024-dashboard.png`](./shots/m1-1024-dashboard.png) · [`shots/m1-900-rail-dashboard.png`](./shots/m1-900-rail-dashboard.png) — retention note in §8 |
| Command | `GATE=m1 E2E_SPECS="e2e/shell.spec.ts e2e/resize.spec.ts e2e/reduced-motion.spec.ts e2e/perf.spec.ts e2e/shots.spec.ts" bash scripts/gate.sh` |

## 1 · Acceptance items (06 §2 M1)

| # | Gate item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | App boots in Chromium; the shell renders at 1440 and directly at 1024 | **PASS** | `e2e/shell.spec.ts` — boots at 1440, boots at 1024 directly; 8/8 shell tests green |
| 2 | All seven destinations navigate; deep links survive reload | **PASS** | `shell.spec.ts` — every destination deep-links and survives reload (6 nav items + `/profile`); `/pets/demo-pet-bella/vaccinations` deep link keeps pet id + tab |
| 3 | Zero console errors / page errors | **PASS** | `e2e/support/fixtures.ts` auto fixture fails every spec on any `console.error` or `pageerror`; 15/15 e2e green with none |
| 4 | Sidebar: six destinations + pinned Profile footer; 240 px ↔ 72 px rail, 64/56 px header, avatar-only footer < 1024 | **PASS** | `shell.spec.ts` live resize + avatar footer; `e2e/resize.spec.ts` dashboard 1440 → 1024 → 900 (header 64/64/56, footer avatar-only at 900, toggle hidden) |
| 5 | ⌘1–6, ⌘B, ⌘, shortcuts; visible focus | **PASS** | `shell.spec.ts` shortcuts + focus ring test. ⌘K is the reserved event only (palette is F3/M5) — asserted at GATE 5 |
| 6 | `/settings` is not a route: it renders the in-shell 404 | **PASS** | `shell.spec.ts › /settings is not a route` |
| 7 | DB v1 opens; vaccine catalog always seeds; demo household only when enabled | **PASS** | Vitest: `catalog-settings.test.ts` (2), `seed-and-household.test.ts` (9), `demo-seed.test.ts` (10) — 24 files / 207 tests green |
| 8 | Rules R1–R10 green before any UI consumes them | **PASS** | `src/lib/rules/**` 11 files / 128 tests green (t1); purity guard `purity.test.ts` |
| 9 | Two-tab live-query probe updates a mounted list (R10) | **PASS (unit)** | `src/lib/db/__tests__/journal-live-query.test.ts` (4 tests) proves a mounted Dexie `liveQuery` sees another write with no refresh counter. The browser-level two-tab spec arrives with M4, where `/journal` provides the first real mounted list (it is authored in `e2e/two-tab.spec.ts` at GATE 3/M4 and is not skipped) |
| 10 | Size: first load ≤ 200 kB, lazy route ≤ 90 kB, CSS ≤ 35 kB; no table/calendar/palette/chart/motion in the first chunk | **PASS** | `node scripts/check-size.mjs` inside `pnpm build` — see §3 |
| 11 | `typecheck`, `lint`, `format:check`, `test`, `build`/`size`, `e2e` clean | **PASS** | t2 final gate at 12:28–12:31 on the M1 tree (all clean, 7/7 Playwright). QA harness re-run at 12:41–12:43: typecheck, lint, test, build+size and 15/15 e2e green — see §5 for the one WIP-file format note |
| 12 | Screenshots of the demo-able state at 1440 / 1024 / 72 px rail | **PASS** | `e2e/shots.spec.ts`, files linked in the header. At M1 the demo-able state is the shell + layout skeletons (feature screens are M2–M5 by contract) |

No test is skipped or `.todo`; the E2E suite has no `test.skip`/`fixme` at this gate.

## 2 · Commands run

| Command | Result |
| --- | --- |
| `pnpm typecheck` (`tsc -b`) | **PASS** — 0 errors |
| `pnpm lint` (`oxlint`) | **PASS** — 0 warnings, 0 errors (111 files at time of run) |
| `pnpm format:check` (`oxfmt`) | **PASS** on the M1 tree (t2); QA re-run at 12:43 saw two in-flight M3 files — see §5 |
| `pnpm test` (`vitest run`) | **PASS** — 24 files / 207 tests |
| `pnpm build` (`tsc -b && vite build && node scripts/check-size.mjs`) | **PASS** — size gate green |
| Playwright Chromium (`shell`, `resize`, `reduced-motion`, `perf`, `shots`) | **PASS** — 15/15, 0 console errors |

## 3 · Size gate (gzip, from `evidence/gate-1.log`)

| Budget | Measured | Limit | Result |
| --- | --- | --- | --- |
| First load (eager shell + `/` route) | **193.2 kB** | 200.0 kB | PASS |
| Every lazy route chunk | **≤ 0.4 kB** | 90.0 kB | PASS |
| Initial CSS | **8.7 kB** on the M1 tree (`13.5 kB` in the 12:43 re-run, which already included in-flight M2–M4 component CSS) | 35.0 kB | PASS |
| Eager-shell content scan (table/calendar/palette/chart/motion markers) | no matches | none | PASS |

Per-file first load: entry `192.4 kB` + dashboard route `0.2 kB` + shared skeleton `0.7 kB`.

## 4 · Performance snapshot (recorded early, asserted at GATE 5)

From `e2e/perf.spec.ts` (Chromium, `vite preview`, 1440×900, warm HTTP cache then a real reload):

| Metric | Measured | Budget |
| --- | --- | --- |
| LCP | **28 ms** | ≤ 1,500 ms |
| DOM nodes (dashboard) | **134** | ≤ 1,200 |
| Route swap (median of Pets / Appointments / Vaccinations / Records / Journal) | **1.7 ms** (range 1.5–3.1 ms) | ≤ 100 ms |
| Long tasks > 50 ms during measured load | **none** | none |

The app is a skeleton at M1; these numbers will be re-measured with real data at GATE 5 and only then treated as a pass (the budgets are M5 acceptance items).

## 5 · Current-tree note (transparency)

The QA re-run at 12:41–12:43 executed on a tree that also contained **in-flight M2–M4 work** from pets-dev (t3), schedule-dev (t4) and journal-dev (t5) — `src/routes/journal/journal-*.ts`, `src/lib/schedule/**`, new `src/components/ui/**` primitives. Consequences, stated rather than hidden:

- `oxfmt --check` failed at 12:43 on files being written by **t4 schedule-dev** (`src/lib/schedule/format.ts`, `src/lib/schedule/query.ts`, `src/routes/journal/journal-draft.ts` and two more M3/M4 files at the time of sampling). These files are not part of the M1 deliverable; M1's own tree was format-clean at t2's final gate. Owner: **t4 (schedule-dev)**, fix: run `pnpm exec oxfmt` on the touched files before completing t4. This is re-checked at GATE 3.
- The 13.5 kB CSS reading at 12:43 includes those in-flight component styles; the M1 measurement is 8.7 kB (t2, §3).
- Nothing in the M1 acceptance list regressed: the shell spec, resize, reduced-motion and size-gate results are identical or better.

## 6 · What to fix

**M1: nothing.** No M1 acceptance item is red.

Outstanding, owned outside M1 (do not carry into GATE 3):

| Finding | Owner | Fix |
| --- | --- | --- |
| `oxfmt` diffs in in-flight `src/lib/schedule/*` + `src/routes/journal/journal-*` at 12:43 | **t4** schedule-dev (and t5 if its files still differ) | `pnpm exec oxfmt` the touched files before reporting complete; gate 3 re-runs `format:check` |

## 7 · E2E coverage at this gate

| Spec | Tests | Covers |
| --- | --- | --- |
| `e2e/shell.spec.ts` | 8 | boot at 1440/1024, deep links + reload, mouse nav, ⌘1–6/⌘B/⌘,, live resize, focus ring, `/settings` 404 |
| `e2e/resize.spec.ts` | 1 | dashboard 1440 → 1024 → 900 (rail, avatar footer, no overflow) |
| `e2e/reduced-motion.spec.ts` | 3 | ≤80 ms transform/opacity motion, nav under reduced motion, motion-only information parity |
| `e2e/perf.spec.ts` | 2 | LCP/DOM/long-task, route-swap timing |
| `e2e/shots.spec.ts` | 1 | real app screenshots at 1440 / 1024 / 72 px rail |

Harness added in this gate: `e2e/support/app.ts` (navigation, overflow, local-date, IndexedDB fixture readers/writers, motion probe), `e2e/support/fixtures.ts` (auto console-error guard), `scripts/gate.sh` (one command runs the 06 §5 sequence and logs it), `docs/build/evidence/`, `docs/build/shots/`.

The remaining t7 specs (pets create→edit→delete, vaccination clears overdue, appointment lifecycle, journal undo, preferences/sort-filter persistence, first-run/reset, browser two-tab, command palette/dashboard) are added **with their milestone screens** so they test the real DOM instead of a guess; their gates are recorded in `GATE-3.md` (M3) and `GATE-5.md` (M5).

## 8 · Screenshot retention note

The three files above were captured from the M1 preview build at 12:37–12:41 (shell + layout skeletons;
sizes 43,569 / 20,934 / 14,469 bytes) and the report was written against them. While the other gates were
built, the screenshot spec was extended to four routes and re-run by plain `pnpm e2e` without a `GATE`
prefix, which overwrote the two dashboard files with the then-current integrated tree. The 72 px rail
file (`m1-900-rail-dashboard.png`) is the original capture; the other two paths now show a later
dashboard. M1's own acceptance evidence (shell spec, size table, t2's final gate) is unaffected; from
GATE 3 on the spec defaults to `local` unless `GATE` is set, so gate screenshots are no longer
overwritten by an unlabelled run. GATE 3 and GATE 5 screenshots are the authoritative visual evidence
for their gates.
