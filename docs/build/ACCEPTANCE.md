# ACCEPTANCE — Pet Health Tracker (desktop, release one)

| | |
| --- | --- |
| Verdict | **PASS — release one accepted** |
| Date | 2026-11-25 (Asia/Manila) |
| Signed by | qa-reviewer (final acceptance, t8) |
| Frozen tree | `pet-health-react/` at GATE-6; product code unchanged after that gate |
| Final gate | [`GATE-6.md`](./GATE-6.md) · log [`evidence/gate-6.log`](./evidence/gate-6.log) · literal acceptance sequence [`evidence/final-acceptance.log`](./evidence/final-acceptance.log) |
| Milestone gates | [`GATE-1.md`](./GATE-1.md) (M1) · [`GATE-3.md`](./GATE-3.md) (M2+M3) · [`GATE-5.md`](./GATE-5.md) (M5 freeze) · [`GATE-6.md`](./GATE-6.md) (post-polish final) |

This document is enough for someone else to run, verify and demo release one. The approved scope is
[`docs/plan/00-PLAN.md`](../plan/00-PLAN.md); the milestone contract is
[`06-build-plan.md`](../plan/06-build-plan.md).

## 1 · What shipped

**The product** — a desktop-first, local-only rebuild of the Flutter Pet Health Tracker: one household,
several pets, vaccinations with R1 due status, vet appointments with the R3 state machine, append-only
clinical notes, a shared journal with 3 s Undo, profile/preferences, first-run onboarding and an
opt-in sample household. No accounts, no server, no network: the data lives in this browser's
IndexedDB on this laptop, and the app never calls another origin (verified below).

**Routes (all deep-linkable, reload-safe)**

| Route | What it is |
| --- | --- |
| `/` | Desktop dashboard: greeting, quick log, four counters (pets / overdue / due soon / visits this week), pets list, needs-attention rail, next visit, recent journal; first-run takeover is a mode of this route |
| `/pets` | Sortable/filterable household table (TanStack v9 in the route chunk), add/edit/delete with R9 validation |
| `/pets/:petId/:tab?` | Pet detail: header + due chip, ABOUT, DUE AT A GLANCE, five path-addressable tabs (Overview / Vaccinations / Records / Appointments / Journal), context rail |
| `/appointments` | Upcoming/Past segmented table, lazy month calendar (`?view=calendar&day=`), booking, complete / cancel-with-reason / no-show / atomic reschedule |
| `/vaccinations` | Household dose table with per-dose R1 status, superseded history rows, status/pet/vaccine filters, add-dose with catalog prefill |
| `/records` | Read-only household clinical history; add-only dialog; no edit/delete affordance anywhere |
| `/journal` | Three columns ≥1280 (filters · day-grouped feed · inline editor), feed + Sheet below; create/edit/delete with 3 s Undo; URL filters |
| `/profile` | Owner, pets summary, preferences (window/units/density), sample-data toggle, reset household, version |
| `*` | In-shell 404 (including `/settings`, which is not a route; Settings lives in Profile) |

**Shell** — 240 px sidebar / 72 px forced rail below 1024 (expand-on-demand 1024–1279), 64/56 px sticky
header, 1200/1440 px content maxima, one scroll container, six Lucide destinations + pinned Profile
footer, ⌘ shortcuts, visible focus, reduced-motion support, no webfonts.

**Data layer** — Dexie 4 database `pet-health` (seven stores with the 02 §4 indexes and unique
constraints), one repository per entity, Zod mirrors of the DDL checks, Dexie live queries so every
write refreshes every mounted surface (R10), settings/density in `localStorage`, `navigator.storage.persist()`
at boot with a blocking storage-failure screen.

**Rules R1–R10** — pure `src/lib/rules` (no React/Dexie/clock): R1 newest-dose due status, R2 settings
and unit conversion, R3 appointment state machine, R4 one local calendar day, R5 append-only notes,
R6 journal edits/undo, R7 exact-id demo ownership, R8 reset semantics, R9 pet validation, R10 one write
path + hand-off. 128 rule tests + 42 repository integration tests.

**Desktop additions** — all six Musts and all three Shoulds (see §3). Four Magic UI components are
vendored and in use: **Progressive Blur** (header edge), **Number Ticker** (four dashboard counters),
**Animated List** (journal append), **Dot Pattern** (first-run backdrop). The wider catalogue's
Shine Border / Scroll Progress / Glare Hover were not needed; 06's four-component shortlist allows that.

## 2 · Final verification (run on the frozen tree)

The task's acceptance sequence was run verbatim and saved in
[`evidence/final-acceptance.log`](./evidence/final-acceptance.log):

```bash
cd pet-health-react
pnpm install --frozen-lockfile   # up to date; supply-chain policy passes
pnpm typecheck                   # exit 0
pnpm lint                        # 0 warnings, 0 errors
pnpm exec vitest run             # 57 files / 405 tests passed
pnpm build                       # tsc + vite + size gate: exit 0
node scripts/check-size.mjs      # repeated size gate: PASS
pnpm e2e                         # Chromium, 62/62, 0 console errors, 0 skipped
```

| Gate | Result |
| --- | --- |
| First load (eager shell + `/`) | **174.4 kB** / 200 kB |
| Largest lazy chunk | 24.3 / 90 kB |
| `/pets` · `/pets/:petId/:tab?` · `/profile` | 13.4 · 6.9 · 6.9 kB (limit 90) |
| Calendar chunk | 20.1 / 45 kB |
| Initial CSS | 15.4 / 35 kB |
| Eager chunk scan (table/calendar/palette/chart/motion) | clean |
| LCP · DOM · route swap · long tasks | 28 ms · 278 · 9.2 ms · none |
| Reduced motion · two tabs · service worker | pass · pass · none |

The 24.3 kB “largest lazy chunk” is the shared zod/write-helper graph used by the forms; the largest
route chunk is `/pets` at 13.4 kB.

## 3 · Must / Should audit (00-PLAN §3, 05 register, 06 §2 M5)

### Must — all green

| Item | Status | Evidence |
| --- | --- | --- |
| **F1 Dashboard overview** — four counters (pets, overdue, due soon, visits this week) + needs-attention rail; each counter drills into its filtered list | **PASS** | `e2e/dashboard.spec.ts › counters match the rules…` (3/1/1/1 from seeded R1/R4 data; overdue → `/vaccinations?status=overdue`); attention rows + next visit asserted; Vitest `desktop-attention` |
| **F2 Sidebar attention counts** — overdue + due-soon doses (Vaccinations) and today's visits (Appointments), visible from every route, tooltip split, zeros hidden | **PASS** | `dashboard.spec.ts › sidebar badges split…` (count 2, title “1 overdue · 1 due soon”; today = 1) + `badges hide when nothing needs attention`; rail counter covered by GATE-6 screenshots |
| **F3 Command palette (⌘K)** — navigate, find a pet/record/note/visit, run every create command, 8 per group | **PASS** | `dashboard.spec.ts` palette tests: search Bella → Enter → pet page; ⌘N create section → booking dialog; every group ≤8; Esc closes; lazy 3.6 kB chunk; recents group `command-group-recent` |
| **F4 Keyboard-first flow** — ⌘1–6, ⌘K, ⌘N, ⌘B, ⌘,, Esc, table arrows/Enter, visible focus | **PASS** | `shell.spec.ts` (⌘1–6, ⌘B, ⌘,), `dashboard.spec.ts` (⌘K, ⌘N, `?`, plain-key aliases, fields swallow shortcuts), `resize.spec.ts` focus test, Vitest `table-keyboard.test.ts` |
| **F5 Sortable/filterable tables** — pets, appointments, vaccinations (data table), records (plain sorted table) | **PASS** | `pets.spec.ts` (sort + species/due/pet/search filters), `schedule.spec.ts` (status/pet/vaccine filters, 5-column sort), records sort/filter; Vitest comparators (`pets-table` 17, `records-table` 12, schedule read models) |
| **F6 Views survive reload** — sort, filters, selected calendar day in the URL | **PASS** | `pets.spec.ts › sort and filters live in the URL…`, `schedule.spec.ts` status/pet/sort + calendar `?view=calendar&day=` reload; Vitest parse/serialise suites |

### Should — all green, none cut

| Item | Status | Evidence |
| --- | --- | --- |
| **F7 Row quick actions** — act on a row without leaving the list | **PASS** | Pets rows: `pet-edit-<id>` / `pet-delete-<id>` (covered by the CRUD e2e); Appointments rows: `appointment-actions-<id>` → complete/cancel/no-show/reschedule dialog (covered by the schedule e2e); Vaccinations rows: `vaccination-add-dose-<id>`. Delivered as visible row actions rather than a hover-only menu; same handlers as the M3 dialog |
| **F8 `?` shortcut sheet** | **PASS** | `dashboard.spec.ts › palette groups… › ? opens the lazy shortcut sheet` (Shift+?, Escape closes, not while typing); lazy 1.0 kB chunk |
| **F9 Palette recents** | **PASS** | Empty palette shows `command-group-recent` with the last five destinations/pets, stale ids pruned; Vitest `palette.test.ts › palette recents (05 F9)` |

### Milestone gates (06 §2)

| Gate | Verdict | Report |
| --- | --- | --- |
| M1 · Foundation | PASS | [GATE-1](./GATE-1.md) |
| M2 · Pets & records | PASS | [GATE-3](./GATE-3.md) |
| M3 · Vaccinations & appointments | PASS | [GATE-3](./GATE-3.md) |
| M4 · Journal, profile, onboarding | PASS (M4 gate evidence in its owner report; regression-covered in GATE-5/6) | [GATE-5](./GATE-5.md) §5 |
| M5 · Desktop extras + performance | PASS | [GATE-5](./GATE-5.md), re-run as [GATE-6](./GATE-6.md) |
| Final acceptance (post-polish) | PASS | [GATE-6](./GATE-6.md) |

### Parity floor (02 §1, rules R1–R10)

Every Flutter surface keeps its screen/action/rule: dashboard/home, pets, pet detail, pet form,
clinical records (append-only), vaccinations, appointments + actions + calendar, journal, profile/
settings, first-run/welcome, sample household, about/version. The rules are the §4 port:
R1 newest dose, R2 settings/lb, R3 state machine, R4 local day, R5 append-only, R6 journal, R7 demo
ids, R8 reset, R9 pet validation, R10 live refresh/hand-off. Evidence: `src/lib/rules` + `src/lib/db/__tests__`
(128 + 42 tests inside the 405) and the milestone gate reports.

## 4 · Release-one exclusions verified

Verified by source/dependency greps, the built output, and a dedicated runtime audit
(`e2e/no-network.spec.ts`, part of GATE-6): across all seven routes and an open palette, the app makes
**no request outside its own origin**.

| Exclusion | Verified how | Result |
| --- | --- | --- |
| **Photos** | no `photo` field in the data model; no file input, `<img>`, `FileReader`/`createObjectURL`; `PetAvatar` = species paw + initial, profile/sidebar = initials avatar; runtime audit counts `<img>` = 0 | PASS |
| **CSV export** | no CSV code/string anywhere; no export button | PASS |
| **Charting** | no chart dependency (`recharts` etc. absent from package.json); no chart chunk in `dist`; eager-shell scan clean | PASS |
| **Service worker** | no `serviceWorker.register` anywhere; runtime audit: 0 registrations | PASS |
| **Auth** | no login/sign-in/token/session-code; one household, no users (the only “login” string is the first-run copy “not a login”) | PASS |
| **Server calls** | no `fetch(`, `axios`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` in `src`; runtime audit sees only same-origin requests, no external anchors, no cookies | PASS |
| **Webfonts** | system font stack, no `@font-face`, no font/image files in `dist` (only `favicon.svg`); `document.fonts.size` = 0 | PASS |
| **Storage scope** | runtime audit: cookies empty, only `pet-health.*` localStorage keys, only the `pet-health` IndexedDB | PASS |
| **Also out per plan** | dark mode (tokens are light-only, no toggle), mobile layout (desktop-first; forced rail <1024 is the phone-free floor), browser notifications, bulk actions, multi-window, column visibility, split view, Insights, print summary, JSON backup (F17), hosting | PASS — no code/deps for any of them |

## 5 · Visual fixes after the M5 freeze

Three defects found by the captain in the M5 screenshots were fixed and verified **by looking at the
re-captured screenshots**, not only by the suite:

| Defect | Fixed in | Before (evidence) | After (evidence) |
| --- | --- | --- | --- |
| Dashboard left-column void under “Next visit”; duplicated “Pets · 3 pets” | t11 (desktop-dev) | `shots/m5-1440-dashboard.png`, `shots/m5-1024-dashboard.png` | `shots/m6-1440-dashboard.png`, `shots/m6-1024-dashboard.png` (+ `shots/polish-1280-dashboard.png`) |
| `/journal` showed two primary “Log entry” buttons | t12 (journal-dev) | `shots/m5-1440-journal.png`, `shots/m5-1024-journal.png` | `shots/m6-1440-journal.png`, `shots/m6-1024-journal.png` |
| Pets pinned identity column painted an opaque band at rest | t13 (pets-dev) | `shots/m5-1440-pets.png`, `shots/m5-1024-pets.png` | `shots/m6-1440-pets.png`, `shots/m6-1024-pets.png` |

Re-checked at 1440 and 1024: the void is gone and the heading reads “Pets [3]”; the journal has a single
“+ Log entry”; the pets identity column blends with the paper at rest. No regression to specs or the
200 kB budget (GATE-6: 62/62 e2e, first load 174.4 kB). The full final screenshot set is
`docs/build/shots/m6-{1440,1024,900}-{dashboard,pets,appointments,journal}.png`.

## 6 · Demo script — from a fresh build

```bash
cd pet-health-react
pnpm install
pnpm build                 # ends with the size gate table (all PASS)
pnpm preview --port 4173   # serve the production build
```

Then open **http://127.0.0.1:4173** in **Chrome** at **1440×900**, zoom 100%. You can turn Wi-Fi off —
the build is served from localhost and the app makes no external requests.

1. **First run** (fresh browser profile): the takeover asks for your name and first pet, or
   **“Or start with the sample household”** → Bella and Miso appear with an overdue rabies dose and a
   due-soon FeLV dose. (A one-click demo path; the sample data can be turned off later without touching
   your own rows.)
2. **Dashboard** — read the counters aloud: 3 pets, 1 overdue, 1 due soon, 1 visit this week. Click
   **1 overdue** → the filtered vaccination table shows the rabies dose. Back, then open **Needs
   attention → Review** on Miso → filtered to that pet.
3. **Pet detail** — click **Bella** → Overview shows next visit and last visit; walk the tabs
   Vaccinations / Records / Appointments / Journal (each is a deep link; reload keeps the tab).
4. **Book and close a visit** — `/appointments` → **Book visit** (pet, clinic, purpose, date, time) →
   Manage → **Mark completed**; the row moves to Past and is read-only. Try **Mark no-show** on a future
   visit (blocked until the scheduled time).
5. **Quick log + Undo** — on the dashboard, Quick log → **Walk**; the entry appears in Recent journal
   with a 3 s **Undo** toast; press Undo to remove it.
6. **Journal** — `/journal`, filter by pet/kind; log an entry in the inline editor (or the Sheet below
   1280), edit its time and watch it move day sections; delete and Undo from the toast.
7. **Sort survives reload** — `/vaccinations`, sort by Next due, choose status Overdue; copy the URL,
   reload — the same filtered, sorted view returns.
8. **Keyboard** — `⌘K` palette: type “Bella” → Enter; `⌘N` opens the create commands; `?` opens the
   shortcut sheet; `⌘1–6` move between destinations; `⌘B` toggles the rail.
9. **Settings** — `/profile`: change Density to Compact → table/journal rows tighten (spacing only);
   switch Weight units kg→lb → 12.4 kg reads 27.3 lb; toggle **Sample data** off → only your rows remain.
10. **Finish on the size gate** — show the end of `pnpm build` (174.4/200 kB first load, 15.4/35 kB CSS,
    all lazy chunks ≤20.1/90, 62/62 e2e) and the Wi-Fi-off/local-only claim.

Reset between demos: **Profile → Reset household** (optionally “Also forget my name and details”) returns
to the Welcome takeover. Dev (`:5173`) and preview (`:4173`) are **different origins with different
databases** — always demo from one URL, never `file://`.

## 7 · Known limitations

- **Chromium is the tested browser.** Playwright is Chromium-only; Safari/Firefox are untested and the
  demo runs in Chrome (plan risk R6). No polyfills are claimed.
- **Local-only by design.** One household per browser origin; clearing site data or a browser profile
  deletes the household. `navigator.storage.persist()` is requested at boot, and a blocked storage
  environment gets a blocking error screen rather than a silent fallback.
- **No export/backup in release one.** CSV was dropped and F17 JSON backup is deferred to v1.1 (the
  data layer is designed for it; the UI is not built).
- **No hosting / no service worker.** The deliverable is `pnpm build && pnpm preview`; `file://` is
  rejected. A hosted PWA is a later decision.
- **No photos, no dark mode, no mobile redesign.** Every pet uses a species paw/initial placeholder;
  the theme is light-only; below 1024 the app shows the forced 72 px rail (desktop floor), not a phone UI.
- **Desktop-first density.** Density changes spacing only, never type size; it is a profile preference.
- **Native date/time inputs follow the browser locale** (e.g. a US profile shows `11/25/2026` and
  `01:10 PM` in the controls); display dates elsewhere use `Intl` per 02.
- **R9 DOB boundary deviation.** The port accepts exactly `today − 40 years` inclusive; the Flutter
  source used 1 January of `today.year − 40`. This is the deliberate deviation recorded in the rules
  task and 06; it is a one-line change if Flutter-exact parity is ever required.
- **First-run gating.** The takeover shows while the household has no pets and the owner is unnamed
  (or a reset was requested in this tab); a named, pet-less household is not re-onboarded on a normal
  reload. Reset always requests the takeover.
- **In-app “toasts” are a ~2 kB local store**, not Sonner, to protect the 200 kB first-load budget; the
  accessible contract (polite status, Undo button, 3 s dwell) is kept.
- **Dependency hygiene nits** (non-user-facing): `@tanstack/react-virtual` and the `shadcn` CLI package
  are declared but not imported by `src`; `cn` supplies the class-name helper instead of
  `clsx`/`tailwind-merge`. None affects the build, budgets or behaviour.

## 8 · Evidence index

| Artefact | Path |
| --- | --- |
| Final gate report | [`GATE-6.md`](./GATE-6.md) |
| Milestone gate reports | [`GATE-1.md`](./GATE-1.md), [`GATE-3.md`](./GATE-3.md), [`GATE-5.md`](./GATE-5.md) |
| Command logs | [`evidence/gate-1.log`](./evidence/gate-1.log), `gate-3.log`, `gate-5.log`, `gate-6.log`, [`evidence/final-acceptance.log`](./evidence/final-acceptance.log), `preview-3.log`, `preview-5.log` |
| Final screenshots | `shots/m6-{1440,1024,900}-{dashboard,pets,appointments,journal}.png` |
| Before-fix screenshots | `shots/m5-*` (dashboard void/duplicate heading, duplicate Log entry, sticky seam), `shots/polish-*` (supplementary) |
| E2E suite | `e2e/` — 12 specs, 62 tests; `e2e/README.md` documents the gate runner and conventions |
| Gate runner | `scripts/gate.sh` (`GATE=<n> bash scripts/gate.sh`) |

**Acceptance decision: PASS.** Every Must and Should item is evidenced green, every milestone gate
passed, the release-one exclusions are verified in source, built output and a runtime network audit, and
the three post-freeze visual defects are fixed and visually verified. The only open items are the
documented limitations above and the deferred v1.1 features named in `00-PLAN.md`.
