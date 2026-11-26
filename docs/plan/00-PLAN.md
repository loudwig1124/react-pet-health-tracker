# 00 · The plan — approve this before any code

| | |
| --- | --- |
| Status | **Planning complete, awaiting approval.** No project has been scaffolded; nothing in this round is code. |
| Owner | parity-planner (t7 — synthesis of t1–t6) |
| The six detailed documents | [01 stack](./01-stack.md) · [02 parity, rules, data](./02-parity-and-data.md) · [03 IA, layout, motion](./03-ia-layout-motion.md) · [04 components and tokens](./04-components-and-tokens.md) · [05 desktop features](./05-new-desktop-features.md) · [06 build plan](./06-build-plan.md) |
| What approval means | On your tick below, the next round starts at milestone M1 (scaffold, shell, tokens, data layer) — nothing else. |

## 1. What we are building

A second version of the Pet Health Tracker, this time as a web app for a desktop screen. It is the same
household notebook: one owner, several pets, a shared journal, vet appointments, vaccinations and
clinical notes that are never edited after they are written. It keeps the Flutter app's rules exactly —
the newest dose of a vaccine decides whether a pet is overdue, a visit can only move from booked to
completed, cancelled or a no-show (never back), and all due dates follow the local calendar day. There are still
no accounts, no network and no server: everything the household types is saved in the browser's own
storage on that one laptop, and the app opens without a connection.

It is built with Vite and React, runs from a local build during the school demonstration, and is designed
to feel light and quick on an ordinary laptop: the first screen is small enough to appear immediately,
there are no web fonts to download and no charting library. On a wide screen it does more than a
stretched phone: a dashboard overview with the numbers that matter, attention counts always visible in
the sidebar, a command palette and keyboard shortcuts, sortable and filterable tables, and views whose
sort, filters and selected day survive a reload or a bookmark. Pet photos are the one feature we are
deliberately leaving out of this release; every pet gets a paw-and-initial placeholder instead.

## 2. Decisions

| Area | Choice | Why (one line) | Detail |
| --- | --- | --- | --- |
| Stack | **Vite + React Router** — *your decision* | A local static build with client-side routes matches a no-server, run-it-at-school app; Next.js was considered and rejected. | [01](./01-stack.md) §0, §D1–D2 |
| Project location | **`pet-health-react/`**, a sibling of `Pet Health Tracker/` — *your decision* | Keeps the Flutter app untouched and side by side for parity checks. | [01](./01-stack.md) §0 |
| App name | **stays "Pet Health Tracker"** — *your decision* | It is the same product; a new name would imply a different household notebook. | [01](./01-stack.md) §0 · [03](./03-ia-layout-motion.md) §5 |
| Pet photos | **Out of v1**; paw/initial placeholders everywhere — *your decision* | Photo storage is a phone-file problem the browser does not share; placeholders keep every screen complete. | [02](./02-parity-and-data.md) §0 |
| Demo household | **Ships, off by default** behind the Sample data toggle — *your decision* | A fresh app opens on the welcome screen; the demo stays available for the presentation and can be removed without touching typed rows. | [02](./02-parity-and-data.md) §1, R7 |
| CSV export | **Not in release one** — *your decision* | Export is a later feature; a JSON backup is the more honest later path. | [05](./05-new-desktop-features.md) §1 (F17), §3 |
| Persistence | **Dexie 4 over browser IndexedDB** | Multi-tab safe, no 858 KB WebAssembly download, and live queries remove the stale-screen bug class instead of re-creating it. | [01](./01-stack.md) §D6 · [02](./02-parity-and-data.md) §4 |
| State | **React context + hooks; Dexie live queries; one repository per entity** | No server to cache, so no query library; every write refreshes every open screen. | [01](./01-stack.md) §D5 |
| Styling and components | **Tailwind v4 + shadcn/ui (radix-nova), plus seven approved Magic UI components (Number Ticker, Animated List, Shine Border, Dot Pattern, Progressive Blur, Scroll Progress, Glare Hover)** | Keeps the Flutter palette and calm look, with a small vendored component set instead of a framework. | [04](./04-components-and-tokens.md) §1–§3 |
| Motion | **CSS transitions (+ `motion` only where Magic UI needs it); 300 ms ceiling; reduced motion honoured** | Smooth is measured, not asserted; nothing blocks input and nothing is motion-only. | [03](./03-ia-layout-motion.md) §4 · [01](./01-stack.md) §D8 |
| Testing | **Vitest 5 + Testing Library (with fake-indexeddb) and four Playwright Chromium smoke checks; no Storybook** | Rules and repositories are testable headlessly; the browser test proves the real shell and real storage. | [01](./01-stack.md) §D7 |
| Performance budget | **≤ 200 kB first load, ≤ 90 kB per lazy route, ≤ 35 kB CSS, LCP ≤ 1.5 s, route swap ≤ 100 ms** | "Light and smooth" becomes a gate a script can fail, not a claim. | [01](./01-stack.md) §D8 · [06](./06-build-plan.md) §2 |

## 3. Scope for release one

**Floor — everything from the Flutter app ships.** Every surface mapped in [02 §1](./02-parity-and-data.md)
keeps its screen, actions, empty states and rules; nothing is removed.

**Must — the desktop additions that make the release worth doing**

- **F1 Dashboard overview** — four compact counters (pets, overdue, due soon, visits this week) plus a needs-attention rail.
- **F2 Sidebar attention counts** — overdue/due-soon doses and today's visits visible from every route.
- **F3 Command palette (⌘K)** — navigate, find a pet/record/note/visit, and run every create command.
- **F4 Keyboard-first flow** — ⌘1–6, ⌘K, ⌘N, ⌘B, table arrows/Enter, Esc, visible focus.
- **F5 Sortable, filterable tables** — pets, appointments, vaccinations (data table); records (plain sorted table).
- **F6 Views that survive reload** — sort, filters and the selected calendar day live in the URL.

**Should — only if the Must list is green before the freeze; cut these first**

- **F7** row quick actions · **F8** `?` shortcut sheet · **F9** palette recents.

**Could — deferred to v1.1 or later**

- **F10** split view (needs an IA/component revision) · **F11** Insights charts · **F12** print-friendly vet summary · **F17** JSON household backup/restore.

**Not in release one**

- Photos — placeholder-only, per the decision above.
- CSV export — dropped for the JSON path instead.
- Mobile layout — the phone app stays the Flutter app; this one is desktop-first.
- Accounts (auth) — one household, no sign-in.
- Server — the data never leaves the laptop.
- Also out: dark mode, service worker, browser notifications, bulk actions, multi-window, column visibility, charting, split view.

## 4. Milestones

Five pass/fail gates; release one ships when **M5** passes. A slipped gate moves later, not the scope.
Detail, build steps and proving tests live in [06 §2](./06-build-plan.md).

| Gate | Ships | Acceptance in one line |
| --- | --- | --- |
| **M1 · Foundation** | Scaffold, tokens, shell with seven destinations, Dexie v1, all rules | App boots and deep-links in Chromium; every rule R1–R10 is green; first load ≤ 200 kB with no table/calendar/palette code in the shell. |
| **M2 · Pets and records** | `/pets`, pet form, `/records`, pet detail shell | Pet CRUD with validation and cascade; records expose no edit/delete; sort/filter survive reload; the 200/90 kB size gate is recorded. |
| **M3 · Vaccinations and appointments** | `/vaccinations`, `/appointments`, booking and visit actions | A re-vaccinated pet clears overdue; no-show only after the scheduled time; reschedule leaves no half-row; the calendar loads lazily. |
| **M4 · Journal, profile, onboarding** | `/journal`, `/profile`, first run, quick log | First run, sample toggle and reset behave; 3 s undo works; settings persist; density changes spacing only. |
| **M5 · Desktop extras and performance pass** | Dashboard counters, sidebar badges, palette, keyboard completion | Counters match the rules; every shortcut works or has an alias; LCP ≤ 1.5 s, DOM ≤ 1,200, route swap ≤ 100 ms, two tabs in sync, no chart and no service worker. |

## 5. One open question for you

**JSON household backup/restore — decided: yes (2026-11-25).** Release one ships with no export path
at all (CSV was dropped). **F17** — one versioned JSON file that backs up and restores the whole
household — is designed into the data layer now and built after M5 as the v1.1 export. It is entered in
[05](./05-new-desktop-features.md) as deferred and in [06](./06-build-plan.md) as post-M5 work.

**Responsiveness — clarified.** [03 §1–§2](./03-ia-layout-motion.md) specifies the breakpoints
(1920 / 1440 / 1280 / 1024–1279 / forced rail <1024; the sidebar only collapses by user choice) and M1 accepts a first paint at 1024 and 1440. What
the documents did **not** pin down is **live resizing**: shrinking the window while a screen is open must
collapse the sidebar, convert the journal editor to a sheet, make tables scroll horizontally with a sticky
name column, and never produce horizontal overflow. That is now an explicit M1 (structural) and
M5-（behavioural）acceptance in the build team's task contracts.

## 6. What this plan does not cover

- **No Flutter changes.** The existing app stays exactly as it is.
- **No server.** No API, no database service, no sync between machines.
- **No accounts.** No login, no users, no permissions.
- **No mobile layout.** The phone experience remains the Flutter app.
- **No photos in v1.** Placeholder only; revisit as a later decision.
- **No hosting decision.** A published URL (and therefore any service worker) is deferred until asked for.

## 7. Approval

Tick what you agree with; anything unticked becomes the next round's discussion instead of code.

- [x] **Stack** — Vite + React Router, Tailwind v4 + shadcn/ui, Dexie over IndexedDB ([01](./01-stack.md))
- [x] **Data layer and rules** — seven entities, append-only notes, newest-dose rule, local calendar day, demo ownership ([02](./02-parity-and-data.md))
- [x] **Information architecture** — sidebar shell, `/`, `/pets`, `/pets/:petId/:tab?`, `/appointments`, `/vaccinations`, `/records`, `/journal`, `/profile` ([03](./03-ia-layout-motion.md))
- [x] **Components and tokens** — Flutter palette carried over, shadcn mapping, seven Magic UI additions ([04](./04-components-and-tokens.md))
- [x] **New desktop features** — Must F1–F6; Should F7–F9 if time allows ([05](./05-new-desktop-features.md))
- [x] **Build plan** — the five gates and their acceptance tests ([06](./06-build-plan.md))

| Approved by | Date | Notes |
| --- | --- | --- |
| Daniel | 2026-11-25 | All six ticks approved together with the `pet-health-react-build` team plan. Execution starts at M1 (rules + foundation in parallel). |
