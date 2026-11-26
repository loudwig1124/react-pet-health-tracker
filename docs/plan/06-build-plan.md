# 06 · Build plan — milestone gates, file map, rules port order

| | |
| --- | --- |
| Status | Draft for approval — planning only; no code, scaffold or install has been created |
| Owner | stack-planner (t6) · inputs: 01–05 (all locked) + captain decisions of 2026-11-25 |
| Rule | Milestones are **gates**, never dates. A gate passes only when every item below passes. This file wins over 01/04 where they disagree |
| Budget | 200 kB first-load JS · 90 kB per lazy route · 45 kB calendar chunk · 35 kB CSS · 0 KB webfonts · 0 chart code |

**Locked inputs — do not re-open:**
- **React Router 8.5.3**, pinned `^8.5.3`. If a v7-only API or example turns out to be required: stop, pin `7.18.7`, add one line to the risk register — never mix silently. 01 D2 carries the supersede note; 04's `React Router 7` stack line is historical.
- **Local-only v1, no service worker.** The deliverable is `pnpm build && pnpm preview`; `file://` stays rejected. If the app is ever hosted (GitHub Pages), add `vite-plugin-pwa` as a later slice — deferred, not rejected.
- **Chromium-only Playwright.** Safari is untested and acceptable only while the demo runs in Chrome (risk R6).
- **Dexie 4 over IndexedDB**; SQLite-WASM stays a fallback seam only (02 §4), never built alongside.
- **03 §2 is authoritative** for routes and shell metrics; 04's `/dashboard` and `/welcome` are stale aliases (root `/` is the dashboard, first run is a shell mode). 04's `new-york-v4` label is stale: shadcn base radix, preset nova → `style: "radix-nova"`.
- **No chart/recharts in release one** (Insights deferred, 05); any remaining 04 Chart row is dropped.
- **Folder names finalised here:** `src/routes/<area>` (01/04 said `features/`), `src/lib/rules` (was `domain/`), `src/lib/db` (was `data/`); 04's component layers and import matrix are unchanged.
- **Size gate:** `scripts/check-size.mjs` (dependency-free) is an explicit **M1 and M2** acceptance item and is re-run at every later gate.

## 1 · Must features → milestone gates

| Must (05) | Gate |
| --- | --- |
| **F1** dashboard overview — four compact counters + attention rail, drill-downs | **M5** (M1 ships the `/` layout and empty state; F1 needs M2–M4 data) |
| **F2** sidebar attention counts — overdue + due-soon, today's visits | **M5** |
| **F3** ⌘K palette — pets/records/notes/appointments + create commands | **M5** |
| **F4** keyboard-first | **M1** shell nav shortcuts (⌘1–6, ⌘B, visible focus) → **M5** complete (⌘N, palette, `?` sheet) |
| **F5** sortable/filterable tables | **M2** pets/records · **M3** appointments/vaccinations · regression **M5** |
| **F6** URL-restored sort/filter/calendar day | **M2** pets · **M3** appointments incl. `?pet=all` · regression **M5** |
| Should **F7** row actions · **F8** `?` sheet · **F9** palette recents | **M5**, only after every Must is green — first cut line |

**Deferred:** F10 split view, F11 Insights, F12 print summary, F17 JSON backup. **Rejected:** column visibility, bulk actions, multi-window, notifications. Photos, CSV and dark mode stay deferred by earlier decisions (05 §2).

## 2 · Milestone gates

Release one ships when **M5** passes; a slipped gate moves later, not the scope. No new feature enters after the M5 freeze.

### M1 · Foundation — scaffold, shell, tokens, data layer
**Demo-able:** the shell boots with all seven sidebar destinations and the rail toggle, every route renders its layout skeleton, the Dexie database opens and seeds the vaccine catalog (demo household on request), and the rules tests pass.
**Bootstrap (run once from the workspace root; the target folder already holds `docs/plan/`):**
```bash
pnpm create vite@latest pet-health-react-scaffold --template react-ts
rsync -a pet-health-react-scaffold/ pet-health-react/ && rm -rf pet-health-react-scaffold
cd pet-health-react && pnpm install
pnpm add tailwindcss @tailwindcss/vite
# vite.config.ts: react() + tailwindcss() plugins, resolve.alias "@" → ./src
# tsconfig.json AND tsconfig.app.json: baseUrl "." + paths { "@/*": ["./src/*"] }
# src/index.css: @import "tailwindcss";
pnpm dlx shadcn@latest init          # base radix, preset nova, base colour neutral, CSS variables
pnpm dlx shadcn@latest add button card badge input label textarea select dialog alert-dialog \
  dropdown-menu tabs separator switch tooltip skeleton sonner avatar sheet empty command calendar \
  sidebar table field kbd native-select toggle-group
pnpm add react-router@^8.5.3 dexie dexie-react-hooks zod @tanstack/react-table @tanstack/react-virtual
pnpm add -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom fake-indexeddb @playwright/test oxfmt
pnpm exec playwright install chromium
```
Scripts: `dev` · `build` (`tsc -b && vite build`) · `preview` · `typecheck` (`tsc -b`) · `lint` (oxlint) · `format` / `format:check` (oxfmt) · `test` (vitest) · `test:e2e` (`pnpm build && playwright test`) · `size` (`node scripts/check-size.mjs`).
**Build:** tokens from 04 §1 into `src/styles/tokens.css` — paper `#FAF8F5`, surface `#FFFFFF`, ink `#1B1A18`, secondary `#6B6660`, hairline `#ECE7E1`, accent `#0E6B5F`, three status fg/soft pairs; radii 10/16/20; system font stack; 03's 240/72 px sidebar, 64/56 px header, 1200/1440 px content. Then `src/lib/db`: Dexie v1, seven stores with the 02 §4.3 indexes (journal `[petId+occurredAt]`, records `[petId+recordedOn]`, appointments `scheduledAt`, vaccinations `nextDueDate` and `[petId+vaccinationDate]`, unique `pet.microchip` and `vaccineType.name`), one repository per entity, settings JSON, seed (`demo-*` ids, strictly increasing `createdAt`), `navigator.storage.persist()`, blocking storage-failure screen. Then rules in §4 order with tests first; router + `AppShell` + lazy route placeholders + `HydrateFallback`/`ErrorBoundary`; Vitest node/dom projects, Playwright Chromium config with `webServer: pnpm preview`; `check-size.mjs` gzips `dist/assets/*.js|css`, prints the table and exits non-zero over budget.
**Acceptance (gate):** app boots in Chromium; seven routes navigate and deep-link reloads; zero console errors; DB v1 opens, catalog always seeds, demo only when enabled; every rule case in §4 (R1–R10) is green — the UI consumes them later at the listed gates; **first-load ≤ 200 kB, every lazy route ≤ 90 kB, CSS ≤ 35 kB**, with no table/calendar/palette/motion/chart code in the first chunk; `typecheck`, `lint`, `format:check`, `test`, `test:e2e`, `size` all clean; two-tab liveQuery probe updates a mounted list.
**Proves it:** `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm size && pnpm test:e2e`; rule suites per §4; Playwright `shell.spec.ts` (boot, seven routes, reload, console).
**Out of scope:** real screens and their mutations, onboarding, dashboard counters, palette/keyboard completion, sorting/filtering.

### M2 · Pets and records
**Demo-able:** `/pets` sortable table with filters in the URL; add/edit/delete a pet with validation; pet detail Overview + Records tab; `/records` read-only household list with "Add record"; empty/error states.
**Build:** `PetFormDialog` (R9); pet CRUD + cascade delete (appointments keep `petId = null`); correctable health records (R5, amended: record + correct + delete); `PetAvatar` placeholder (02); pet detail shell with ABOUT / tab panel / context rail and stub tabs; F5/F6 for `/pets` (TanStack in the route chunk) and `/records` (plain sorted table, no TanStack); skeletons and empty states.
**Acceptance (gate):** duplicate microchip rejected with a message; DOB/weight/name bounds enforced; deleting a pet removes its journal/vaccinations/records and keeps its appointments as Household; records expose no edit/delete anywhere; sort/filter/URL survive reload; route chunks within budget; **the 200/90 kB size gate is re-run and recorded here**; no layout thrash in review (04 §5 list).
**Proves it:** Vitest R9, R5 export-surface + cascade, F5 sort comparators, F6 parse/serialise; Playwright pets CRUD, record append, sort survives reload, empty states, no console errors; `pnpm build && pnpm size`.
**Out of scope:** vaccinations/appointments tabs, booking/actions, journal, profile, onboarding, palette.

### M3 · Vaccinations and appointments
**Demo-able:** `/vaccinations` household table with status/pet/vaccine filters and add-dose form; `/appointments` Upcoming/Past table + month calendar, booking, complete/cancel/no-show/reschedule; pet detail Vaccinations and Appointments tabs; an overdue row drills into the filtered list.
**Build:** R1 due-status UI + chips; vaccination form (next due prefilled from `intervalMonths`, strictly after the dose date); R3 actions with atomic reschedule and re-checks on write; lazy calendar chunk; F5/F6 query state incl. Home's `?pet=all` hand-off; toasts.
**Acceptance (gate):** newest-dose-per-vaccine wins with `vaccinationDate` desc, then `createdAt` desc, then `id` (final tie-break) — a re-vaccinated pet clears overdue; window edges (today / +14 / +15) correct; no-show disabled at `scheduled_at` and allowed one second later; blank cancel reason blocked; completedAt/cancelReason invariants; reschedule leaves no half-row; calendar chunk ≤ 45 kB, routes ≤ 90 kB; URL state restores.
**Proves it:** Vitest R1 (incl. tie-break fixture), R3, R4 date cases, sort comparators for appointments/vaccinations, atomic reschedule repository test; Playwright book → complete, cancel, no-show, reschedule, reload persistence, filtered hand-off, calendar lazy.
**Out of scope:** journal, profile, onboarding, dashboard counters, sidebar badges, palette.

### M4 · Journal, profile, onboarding
**Demo-able:** `/journal` filters + day-grouped feed + inline editor ≥1280 (Sheet below); quick-log chips with 3 s Undo; `/profile` owner/preferences/density/sample data/reset; first-run takeover on `/`; sample household one click.
**Build:** R6 journal CRUD + undo; R2 settings store/persistence; R7/R8 demo toggle and reset; first-run shell mode; quick-log bar and forms; pet detail Journal tab; sonner toasts; density scoped to tables/feeds. Add Magic UI `@magicui/dot-pattern` (Welcome backdrop) and `@magicui/animated-list` (journal append) here, one at a time per 01 D4.
**Acceptance (gate):** undo restores the entry after 3 s and not before; editing time moves the row to the right day; kind immutable; duration positive; settings survive reload and re-render open screens; demo toggle deletes exactly `demo-*` rows and user rows survive; reset respects the "also forget" checkbox; first run appears only while owner unnamed and no pets exist; density changes spacing only; Magic UI adds stay inside the journal/Welcome route chunks.
**Proves it:** Vitest R6 with fake timers, R7/R8, R2 (unit conversion, corrupt-settings fallback); Playwright onboarding, sample toggle, reset, journal edit/delete/undo, density.
**Out of scope:** F1 dashboard counters/rail, F2 badges, F3 palette, F4 completion, full performance pass.

### M5 · Desktop extras and performance pass
**Demo-able:** full `/` dashboard (F1 four counters + attention rail + next visits + recent journal), sidebar attention counts (F2), ⌘K palette/search (F3), keyboard flow completed (F4: ⌘1–6, ⌘K, ⌘N, ⌘B, `?`), F5/F6 regression; performance evidence; F7–F9 only if every Must is green.
**Build:** dashboard read model from live queries (counts call R1/R4, never re-implement); badges from the same derived status; `CommandPalette` (`cmdk`, mounts on open); shortcut registry with 03's aliases; hover-prefetch fallback if route swap > 100 ms; performance fixes; conditional F7/F9 (F8 is the `?` sheet); add `@magicui/number-ticker` and `@magicui/shine-border` last, after the budget passes without them.
**Acceptance (gate):** counters match R1/R4 fixtures (12.4 kg ↔ lb, local-day edges); badge tooltip splits overdue/due-soon and today; palette returns ≤ 8 per group, navigates and creates; every shortcut works or has its documented alias; sort/filter still survive reload; overdue counter lands on the filtered `/vaccinations`; **no chart dependency and no service worker registered**; all budgets pass — first load ≤ 200 kB, lazy ≤ 90 kB, CSS ≤ 35 kB, LCP ≤ 1.5 s, DOM ≤ 1,200 nodes, route swap ≤ 100 ms, no long task > 50 ms, `prefers-reduced-motion` honoured; two tabs stay in sync; size gate re-run before freeze.
**Proves it:** Vitest F1/F2 counts against R1/R4 fixtures, `?pet=all`, palette matching/limits, table sort comparators; Playwright ⌘K, ⌘1–6, sort survives reload, overdue drill-down, reduced-motion pass, no console errors, two-tab; `pnpm build && pnpm size`; manual perf checklist.
**Out of scope / deferred:** split view (F10, needs 03/04 revision), Insights charts (F11), print summary (F12), JSON backup (F17), photos, CSV, dark mode, service worker unless hosted.

## 3 · File map (final names)

```
pet-health-react/
├── docs/plan/                    # 01–06 + 00-PLAN approval record
├── public/                       # favicon + illustrations with fixed width/height (no photos)
├── src/
│   ├── main.tsx                  # createRoot + RouterProvider; the only eager route import
│   ├── app/                      # router.tsx, providers.tsx, error-boundary.tsx, first-run gate
│   ├── routes/                   # one folder per canonical route, each with a lazy route.tsx + page
│   │   ├── dashboard/            # `/` — F1 composition + first-run takeover mode
│   │   ├── pets/                 # `/pets` table
│   │   ├── pets.$petId/          # `/pets/:petId/:tab?` + ABOUT rail
│   │   ├── appointments/         # `/appointments` table + lazy calendar
│   │   ├── vaccinations/         # `/vaccinations` household doses
│   │   ├── records/              # `/records` notes with per-row correction
│   │   ├── journal/              # `/journal` feed + inline editor/Sheet
│   │   ├── settings/             # `/profile` owner, preferences, data
│   │   └── not-found.tsx         # 404 inside the shell
│   ├── components/
│   │   ├── ui/                   # shadcn generated, owned source (kebab-case)
│   │   ├── ui/magicui/           # four shortlisted Magic UI components, vendored read-only
│   │   ├── app/                  # product components: PetCard, DueBadge, StatusChip, rows, dialogs
│   │   └── layout/               # AppShell, AppSidebar, AppHeader, CreateMenu, Toaster, CommandPalette
│   ├── lib/
│   │   ├── db/                   # db.ts (Dexie v1), repositories/, seed/, settings.ts, schema.ts
│   │   ├── rules/                # pure rules: calendar, vaccination-due, appointment-fsm, pet-validation
│   │   ├── hooks/                # useLiveQuery read models: useDashboard, usePets, useAppointments…
│   │   ├── format.ts             # Intl date/weight formatting per 02
│   │   └── utils.ts              # cn()
│   ├── styles/tokens.css         # the only file with hex (04 §1)
│   └── index.css                 # @import "tailwindcss" + tokens + shadcn imports
├── e2e/                          # shell, pets, appointments, journal, desktop, offline smoke specs
├── scripts/check-size.mjs        # gzip budget gate (dependency-free)
├── components.json  vite.config.ts  vitest.config.ts  playwright.config.ts
└── tsconfig{,.app,.node}.json  .oxlintrc.json  .oxfmtrc.json
```

## 4 · Port order for business rules — tests first

`src/lib/rules` is pure: no React, no Dexie, no `Date.now()`; `today`/`now` are parameters. No UI consumes a rule before its cases are green.

1. **R4 local calendar day** (`calendar.ts`) — first; every date decision depends on it. Cases: 00:30 local (UTC+8) on 2 Mar vs the UTC day; fixed-width `YYYY-MM-DD` string compare; a 23:55 entry groups under its local day; last visit = later of latest completed visit day and latest `recordedOn`; `addMonths` for next-due prefill.
2. **R1 vaccination due — newest dose wins** (`vaccination-due.ts`). Cases: newest dose per `vaccineTypeId` (old overdue + booster → `up_to_date`); same-day doses resolve by `createdAt`, then **`id` as the final deterministic tie-break** (the newest dose is the one given latest: `vaccinationDate` desc first); null due → `up_to_date`; due < today `overdue`; due today and within window `due_soon`; window edges 14/15 days; pet worst status; no doses → `up_to_date`; headline dose = earliest due.
3. **R3 appointment state machine** (`appointment-fsm.ts`). Cases: scheduled → completed/cancelled/no_show; terminal immutable; same-status rejected; no-show blocked exactly at `scheduled_at` and allowed one second later; `"   "` cancel reason blocked; `completedAt` exactly when completed; `cancelReason` exactly when cancelled; reschedule = cancelled(`rescheduled`) + new scheduled row atomically (repository test).
4. **R9 pet validation** (`pet-validation.ts`). Cases: trimmed name 1–40; DOB not future / not > 40 years; weight > 0 ≤ 300; microchip 9–15 digits, blank → null, unique across pets.
5. **R2 settings** (`lib/db/settings.ts` + rule helpers). Cases: window 1–365 and the 7/14/30/60/90 options; lb conversion 12.4 → 27.3; unreadable settings → defaults; persistence across reload.
6. **R5 correction surface** (`lib/db/repositories/health-records.ts`). Cases: the export surface is exactly read/append/update/delete; a bulk wipe can never appear; an edit that fails the draft rule leaves the row untouched; deleting a pet still cascades to its notes.
7. **R7/R8 demo ownership and reset** (`lib/db/seed`, household repository). Cases: fixed `demo-*` id lists; seed `createdAt` strictly increasing (demo doses deterministic, no same-millisecond pair); seed → add pet → clear → pet survives; clear → seed → clear leaves no orphans/duplicates; reset checkbox semantics.
8. **R6 journal + R10 writes** (journal repository + hooks). Cases: editing time moves the day section; kind immutable; duration positive integer; delete confirms; `{petId: null}` hand-off becomes `?pet=all`; a write in one tab updates a mounted list in the other.

**Consumption gates:** 1–3 green before M3 UI; 4–6 before M2; 7–8 before M4; 8's two-tab check runs from M1.

## 5 · Definition of done — every milestone

A gate is pass/fail; any red item blocks the next milestone. Run in this order:
1. `pnpm typecheck` (`tsc -b`) — zero errors; no new `@ts-expect-error`.
2. `pnpm lint` (oxlint) and `pnpm format:check` (oxfmt) — clean.
3. `pnpm test` — rules, repositories, components; no skipped or `.todo` tests.
4. `pnpm build && pnpm size` — budgets; **M2 records the size gate explicitly**, every later gate re-runs it.
5. `pnpm test:e2e` — Chromium smoke for the routes this milestone ships; no console errors.
6. Review the 04 §5 "never ship" list: no animated width/height/filter, no unbounded lists, table/calendar/palette lazy.
7. Write the gate report: commands run, size table, route chunk list, screenshots of the demo-able state.

| Milestone | Manual checklist in addition to the common gate |
| --- | --- |
| M1 | boot/first paint at 1024 and 1440; rail + tooltips; deep-link reload; skeleton/empty/error states; initial chunk free of table/calendar/palette/motion/chart |
| M2 | pet add/edit/delete; duplicate-microchip message; records have no edit/delete; sort/filter survive reload; **200/90 kB size gate** |
| M3 | book/complete/cancel/no-show/reschedule; no-show gating at the scheduled time; calendar lazy; `?pet=all` hand-off; overdue drill-down lands filtered |
| M4 | first run + reset; sample toggle keeps user rows; 3 s undo; settings persist; density scope; journal editor at 1280 |
| M5 | ⌘K, ⌘1–6, ⌘N, ⌘B, `?`; sort survives reload; reduced-motion pass; two tabs in sync; no service worker in DevTools › Application; LCP ≤ 1.5 s, DOM ≤ 1,200, route swap ≤ 100 ms; size gate before freeze |

## 6 · Risk register — top six

| # | Risk | Mitigation / trigger |
| --- | --- | --- |
| R1 | **Storage availability and the SQLite-WASM/OPFS fallback.** A locked-down school browser profile can block or evict IndexedDB; the fallback store is unproven on the target. OPFS needs Chrome 86+/Safari 15.2+/Firefox 111+ (sync handles in workers Chrome 102+), and its handles are single-tab. | Probe storage at boot, `navigator.storage.persist()`, blocking failure screen with advice; never fall back to localStorage. Build the wasm path only if the probe fails, timeboxed behind the `lib/db` adapter seam and the two-tab test. |
| R2 | **Bundle creep from Magic UI and its neighbours** — motion ≈20–50 kB, TanStack 31.6, `cmdk` 16.7, calendar 19.8 + date-fns, radix base 55–70. | Four-component shortlist only; palette on open, table in table routes, calendar in its own chunk, motion after first paint; size gate every gate; **drop the effect rather than optimize it**; review 04's ledger before adding anything. |
| R3 | **Scope creep from desktop features.** F1–F6 are release one; F7–F9 are conditional; F10–F17 are deferred/rejected. | Lock the 05 register: no new route, dependency or data-model field without revising 03/04/06. Cut line at M5 = F7–F9. Musts green before any Should. |
| R4 | **Rule drift / schema enforcement.** Dexie has no CHECK/UNIQUE/triggers, so parity bugs can return. | Zod schemas mirror the DDL, one repository per entity enforced by oxlint restricted imports, repository export-surface test, §4 cases including the `createdAt` + `id` tie-break; 02 §5 regression cases are mandatory. |
| R5 | **Cross-tab / live-query freshness.** A frozen tab or missed broadcast shows stale household data. | Two-tab Playwright test each gate, refetch on `visibilitychange`/focus, `BroadcastChannel("pet-health")` fallback, never memoize lists across navigation. |
| R6 | **Toolchain and test-matrix drift.** RR8 may hit a v7-only pattern; TS 7 types may lag; Chromium-only means **Safari is untested** and acceptable only while the demo runs in Chrome. | RR8 guard: stop, pin 7.18.7, one-line risk-register reason. TS 7 → pin `~6.0` if a dependency breaks. Safari smoke is a post-v1 task; demo in Chrome; reduced-motion and date/locale checks in M5. |

## 7 · Rehearsal and demo plan

**Build to show:** `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm size && pnpm test:e2e`, then `pnpm preview --port 4173` in Chrome at 1440×900, zoom 100%, Wi-Fi off to prove the offline claim. Never `file://`.
**Flow (≈5 min):** dashboard counters → overdue drill-down; pet detail tabs; book and complete a visit; quick-log a walk + Undo; journal filter; sort `/vaccinations` and reload (URL restored); ⌘K search/navigate/create; settings density + sample data; finish on the size-gate output.
**Fallbacks:** `pnpm dev` if preview fails; Settings → Reset household then sample data on for a clean state; never demo from a red gate. Dev (`:5173`) and preview (`:4173`) are different origins with separate databases — seed and demo from the same one.
**Read aloud:** "This is Pet Health Tracker, rebuilt as a desktop web app. Everything runs on this laptop in the browser — there is no server and no account, and the household database stays on the machine, so it keeps working with Wi-Fi off. The sidebar keeps the whole household one click away, and the dashboard answers the one urgent question first: what needs attention today? You can log a walk in two clicks, book and close out a vet visit, and find anything from the keyboard, while the whole app is built to stay light and open quickly on a school laptop."
