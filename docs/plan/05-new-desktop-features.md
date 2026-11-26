# 05 · Desktop-only features — prioritised proposals

| | |
| --- | --- |
| Status | Draft for review — planning only, no code · **Owner:** ux-planner (t5) |
| Inputs | [01 stack](./01-stack.md) · [02 parity/rules](./02-parity-and-data.md) · [03 IA](./03-ia-layout-motion.md) · [04 components](./04-components-and-tokens.md) |
| Rule | 02 is the floor: **nothing from the Flutter app is removed.** These ideas are additive and must earn their place from the desktop layout, not from parity. Effort: **S** ≤ ½ day, **M** 1–2 days, **L** > 2 days. |
| Budget | 01 §D8 holds: eager shell + first route ≤ 200 kB gzip, each lazy route ≤ 90 kB, no chart/palette/table code in the first chunk, route swap ≤ 100 ms. |

## 1. Feature register
Priority is the heading; each row carries value, IA location, effort and risk. Nothing here changes the data model.

### Must — release one
| ID / feature | One-sentence value | Where in IA | Effort · risk |
| --- | --- | --- | --- |
| F1 Dashboard overview | Four compact counters — pets, overdue, due soon, visits this week — plus the needs-attention rail answer "is anything wrong?" before scrolling. | `/` above the pet grid; each counter drills into its filtered list | S · counts must call R1/R4, never re-implement them; live counts via Dexie; compact cards, not hero tiles |
| F2 Sidebar attention counts | Overdue/due-soon doses and today's visits stay visible from every route, so nothing is missed while working elsewhere. | Sidebar: Vaccinations badge = overdue + due soon (tooltip splits), Appointments badge = today; hide zeros | S · badge noise; colour plus number; badge reads from the same derived status as Home |
| F3 Command palette and search | One ⌘K input navigates, finds a pet, clinical record, journal note or appointment, and runs every create command. | Global overlay; header search trigger; grouped results | M · simple case/diacritic-folded substring, 8 per group, no fuzzy ranking; `cmdk` lazy 16.7 kB; prune stale ids |
| F4 Keyboard-first flow | The app works without a mouse: ⌘1–6, ⌘K, ⌘N (create pet/visit/entry/record), ⌘B, arrows/Enter in tables, Esc, visible focus. | Global; tables; dialogs | S · browser-reserved keys use 03's aliases; never steal keys while typing; focus must stay visible |
| F5 Sortable/filterable tables | Desktop room turns pets, appointments, vaccinations and records into scan-and-sort tables instead of phone cards. | `/pets`, `/appointments`, `/vaccinations` (Data Table), `/records` (plain sorted Table) | M · TanStack 31.6 kB only in the three table routes; records stays dependency-free; filters use the same status fields as parity; virtualise past 50 rows |
| F6 Deep-linkable view state | Sort, filters and the selected calendar day live in the URL, so Back, reload and a bookmark restore the same view. | Table routes and `/appointments` | S · `?pet=all` sentinel vs absent (01 D2); replace-state while typing, push only on committed view changes |

### Should — only after the Must list is green, before freeze
| ID / feature | One-sentence value | Where in IA | Effort · risk |
| --- | --- | --- | --- |
| F7 Row quick actions | A hover/⋯ menu opens the same visit actions without leaving the list. | `/appointments`, `/vaccinations`, `/pets` tables | S · duplicates the Sheet; reuse its handlers and R3 checks; keyboard reachable |
| F8 Shortcut cheat sheet | `?` shows every shortcut in one dialog, making keyboard-first discoverable. | Global overlay | S · ignore while typing; no focus-trap regression |
| F9 Palette recents | The empty palette offers the last five destinations or pets, cutting repeat navigation. | ⌘K empty state | S · local-only; prune deleted pet ids |

### Could — deferred to v1.1 or later
| ID / feature | One-sentence value | Where in IA | Effort · risk |
| --- | --- | --- | --- |
| F10 Split view for Pets | A persistent pet list beside the detail lets you compare and switch pets without going Back. | `/pets` only, ≥1280 px | M · needs a 03/04 revision and 1024 px cases; duplicates navigation |
| F11 Insights charts | Due-status and visits-per-month charts look analytical but change no decision at household scale. | `/insights`, after Journal | M · recharts 177 kB and a route; weak value; **drop Chart from the release-one ledger** |
| F12 Print-friendly vet summary | Print a pet's vaccinations, clinical history and next visit for the vet, using the browser print dialog. | Pet detail action | M · print CSS and paper accuracy; no file export; optional |
| F17 JSON household backup/restore | One versioned JSON file for the whole household — the right later answer where CSV was dropped. | Settings › Data | M · schema versioning and import validation; not release one |

### Reject — not for this product
| ID / feature | One-sentence value | Where in IA | Effort · risk |
| --- | --- | --- | --- |
| F13 Column visibility | Show/hide table columns — but six to eight columns are all useful at this data size. | Table toolbars | S · persisted UI state for little gain |
| F14 Bulk actions | Multi-select visits to complete in a batch — only completion is rule-uniform, and households book few visits. | Tables | M · each row re-checks R3, cancellation needs a reason, complex undo; accidental-change risk |
| F15 Multi-window | Separate app windows for a pet or list — the browser already opens another tab. | Not in the shell | L · no shared selection/context; cross-tab sync is best-effort; doubles the test surface |
| F16 Browser notifications | OS reminders for due vaccines — a static offline app cannot reliably schedule them. | Not applicable | M · permissions; no background worker; a closed tab never reminds |

## 2. Candidate verdicts (accept / reshape / reject)

| Candidate | Verdict | Reason |
| --- | --- | --- |
| Home as a real dashboard | **Accept** as F1/F2 | Reshape "stat cards" into **one stats bar with four equal segments** (owner decision 2026-11-26: four separate cards left a number hundreds of pixels from its own label at 1920) and keep the needs-attention rail; quick log and recent journal stay parity. 03's hand-off asked 05 to decide: **larger cards yes, hero tiles no.** |
| Tables: sorting, filtering, column visibility | **Accept sort/filter** (F5/F6), **reject visibility** (F13) | Sorting and status/pet filters are the desktop payoff; hiding columns at six–eight columns adds state for no gain. |
| Global search / command palette | **Accept** (F3), scoped | Simple substring matching and 8 results per group; no fuzzy ranking or date parsing in v1; navigation and create share one surface. |
| Keyboard-first flow | **Accept** (F4/F8) | Cheap, high perceived quality, already mapped in 03; 03's alias rules cover browser-reserved keys. |
| Split view: list + detail | **Defer** (F10) | Valuable but not required for the first desktop release; it changes 03's detail model and needs responsive work. Keep full-page pet detail in v1; revisit as v1.1. |
| Bulk actions | **Reject** (F14) | R3 gives each visit its own valid moves and cancellation needs a reason; households have few visits, so value is low and accidental-change risk is high. |
| Reminders panel | **Accept**, merged into F2 + F1 | No separate page: sidebar counts are the persistent reminder; Home's attention rail lists the actual doses. |
| Multi-window | **Reject** (F15) | Browser windows already exist; the missing piece is shared context and sync, and that cost buys nothing for one household on one laptop. |
| Insights charts | **Defer for release one** (F11) | 177 kB of charting to restate what the attention rail says; remove the conditional Chart row and recharts from 01/04's release-one ledger. |
| Implicit "light, smooth, friendly" | **Accept as constraints**, not a feature | Enforced by 01's budgets, 03's motion/state rules and Dexie live updates — no extra dependency; palette, tables and motion stay out of the first chunk. |

## 3. Recommended first-release scope

**Must — the smallest set that still feels like a desktop product.** F1 dashboard overview · F2 sidebar attention
counts · F3 command palette · F4 keyboard-first · F5 tables with filter/sort · F6 URL-restored view state. Every
must uses the data and routes already planned in 02/03; none adds a dependency beyond 04's ledger.

**Should — if the Must list is green before the freeze.** F7 row quick actions · F8 `?` shortcut sheet · F9 palette
recents. Cut these first if time runs short; they polish, they do not carry the release.

**Defer.** F10 split view (revise 03/04 first), F11 Insights, F12 print summary; **photos** and **CSV export** (user
decisions); **JSON backup/restore** (F17) is the later export path, not a release-one promise. Also not in release
one: column visibility, bulk actions, multi-window, notifications, dark mode (04 keeps light-only) and a service
worker (01 §D9 defers it). No new entity or schema change is required by any item above.

## 4. Hand-off and verification

- **03:** no route changes; F1 refines the existing stat strip into four compact cards, F2 formalises the sidebar
  badges, F5/F6 use the tables and query parameters already designed. F10 is the only deferred item that would
  revise 03 (and 04) if it is ever accepted.
- **04:** no new primitive or dependency for Musts; Number Ticker is optional, Animated List stays in feeds, Shine
  Border optional. Remove the conditional Chart/recharts entry unless F11 is approved later.
- **01:** budgets unchanged — palette mounts on open (`cmdk` 16.7 kB), table code only in table routes
  (`@tanstack/react-table` 31.6 kB), no chart; route swap ≤ 100 ms with hover-prefetch as the fallback.
- **06 tests:** Vitest — F1/F2 counts against R1/R4 fixtures; F6 URL parse/serialise (`?pet=all`); F3 search matching
  and limits; F5 sort comparators. Playwright — ⌘K open/close, ⌘1–6 navigation, table sort survives reload, overdue
  counter lands on the filtered vaccination view, no console errors, reduced-motion pass. Perf gate from 01 §D8 at
  the shell/Home and freeze milestones.
- **Nothing removed:** every Flutter surface in 02 keeps its route, action and empty state.
