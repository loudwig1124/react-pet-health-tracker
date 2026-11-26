# 03 · Desktop information architecture — shell, wireframes, motion
**Status:** draft for review · planning only, no code, no scaffold · **Owner:** ux-planner (t3).
**Sources:** `Pet Health Tracker/README.md`, `AGENTS.md`, `lib/features/**`, `lib/app/shell/app_shell.dart`, `lib/features/pets/pet_routes.dart`; parity in [02](./02-parity-and-data.md). **Consumed by:** [04](./04-components-and-tokens.md), [05](./05-new-desktop-features.md), [06](./06-build-plan.md).

Desktop-first rebuild: persistent **left sidebar**, content right, keyboard complete, 1024 px floor. The
phone's bottom bar, swipeable deck and full-screen pet page become the compositions below; tokens live in
04 and §7 records supersessions. No photos in v1 — every avatar is the paw placeholder.

## 1. Shell layout
Grid `sidebar | content`. Fixed sidebar (240 px expanded / 72 px rail); the content column is a single
scroll container with a sticky 64 px header. Nothing else scrolls except dialog bodies.

| Region | Spec |
| --- | --- |
| Sidebar | 240 px expanded, 72 px icon rail; fixed, full height, paper with a 1 px hairline edge. 36 px nav rows with a leading icon and an optional count badge; 40×40 rail tiles with tooltips. **Profile row pinned to the bottom** (avatar + name; avatar only in the rail). Collapse state persisted. |
| Header | 64 px (56 px <1024): title or breadcrumb, ⌘K search trigger, contextual primary action. Sticky; opaque paper + hairline, no blur. |
| Content | 1200 px max for dashboard, settings, journal; 1440 px for the four data tables. Centred; 65–75ch for prose forms. Padding 32 px ≥1440 · 24 px 1024–1439 · 16 px <1024; section gap 24, card padding 16. Route change scrolls to top; Back restores the offset; pet tabs keep their own. `scrollbar-gutter: stable`. |

| Viewport | Sidebar | Composition |
| --- | --- | --- |
| 1920 | 240 expanded | 1200/1440 container centred; detail keeps all three columns; space stays gutter |
| 1440–1919 | 240 expanded | Standard: dashboard 2-col, detail 3-col, journal 3-col |
| 1280–1439 | 240 expanded | Journal editor 320→280; appointments calendar 300→280; detail rail 240 |
| 1024–1279 | 240 px sidebar (collapses only on request) | One content column; journal editor becomes a Sheet; appointments toggles table/calendar; detail rail stacks |
| <1024 | 72 rail, forced | 16 px gutters; tables scroll horizontally with the name column sticky; no phone redesign in v1 |

**Active state.** Accent-soft tile, 3×16 accent pill, accent icon, ink 600 label (rail: 40×40 tile with
tooltip); hover `paper-raised`; focus 2 px accent ring; badges show counts as colour + number; no sliding indicator.

**Sidebar states.** Expanded (240 px): paw mark, search, then Dashboard / Pets / Appointments 2 /
Vaccinations !1 / Health records / Journal / Settings / owner chip in OVERVIEW · HOUSEHOLD · SYSTEM. The
72 px rail shrinks each to a 40×40 icon tile (H P A V R J S) with a tooltip naming page + shortcut; the
brand is the paw mark.

## 2. Navigation map
**Groups:** OVERVIEW (Dashboard) · HOUSEHOLD (Pets, Appointments, Vaccinations, Health records, Journal)
· **FOOTER: Profile** (avatar + owner name, pinned to the bottom). Settings is not its own destination any
more: it lives inside Profile, which is where an owner edits the household, preferences and the reset.
"Demo data" badge rides the Profile row while the sample toggle is on.
Routes are deep-linkable and survive reload.

| Item | Route | What it shows | Primary action | Shortcut |
| --- | --- | --- | --- | --- |
| Dashboard | `/` | Greeting, pet grid, Needs attention, Quick log, next visits, Recent journal | New ▾ | ⌘1 |
| Pets | `/pets` | All pets as a sortable table; row opens pet detail | Add pet | ⌘2 |
| Appointments | `/appointments` | Upcoming/Past table + month calendar; `?view&status&pet&date` | Book visit | ⌘3 |
| Vaccinations | `/vaccinations` | Household doses with per-dose due status; status/pet/vaccine filters | Add vaccination | ⌘4 |
| Health records | `/records` | Append-only clinical notes, newest first, read-only | Add record | ⌘5 |
| Journal | `/journal` | Day-grouped feed, filters, inline editor ≥1280 | Log entry | ⌘6 |
| **Profile** (bottom) | `/profile` | Owner, pets summary → `/pets`, preferences, density, data, about | Save (dirty form) | ⌘, |
| Pet detail | `/pets/:petId/:tab?` | Overview / Vaccinations / Records / Appointments / Journal | Edit pet · Add ▾ | — |

**Icons.** Every destination gets one **Lucide** icon (shadcn's icon set): `LayoutDashboard`, `PawPrint`,
`CalendarDays`, `Syringe`, `FileHeart`, `NotebookPen`, and the footer is an **Avatar with the owner's
initial** rather than an icon. The stack ships no animated-icon set — Magic UI is effects, not icons — so
icon motion is CSS only: 70 % opacity at rest, 100 % on hover, `scale(1.06)` + 1 px lift over 120 ms,
suppressed under `prefers-reduced-motion`. Active rows keep a 3 px accent pill and a soft accent fill, so
the state never depends on the icon alone.

- `/pets/:petId/:tab?` is path-addressable; unknown pets show "Pet not found" + back to Pets. Appointments
  query state is shareable; Home's "View in Appointments" passes `pet` and clears earlier filters.
- ⌘K = palette; ⌘N = create (preselects the pet on a pet route); ⌘B = rail; Esc closes. Browsers may
  reserve ⌘N/⌘1–9/⌘,: bind best-effort and also accept `N`/`1`–`6` outside fields — sidebar, buttons and
  ⌘K are the guaranteed path.

## 3. Wireframes
### Dashboard — two columns + a quick-log bar
```text
+------------------+----------------------------------------------------------------------------+
| [paw] Pet Health | Dashboard                                    [Search Cmd+K]  [+ New v]    |
| [Search Cmd+K]   | Wednesday 26 Nov 2026          [3 pets] [1 overdue] [2 due soon]           |
|                  | QUICK LOG  [Bella v]  [Walk] [Fed] [Meds] [Note]  [More...]                |
| > Dashboard      | +---------------------------------------+  +----------------------------+ |
|   Pets        3  | |PETS                                   |  |NEEDS ATTENTION             | |
|   Appointments 2 | |+-------------+ +-------------+        |  |! Bella - Rabies            | |
|   Vaccinations!1 | || [paw] Bella | | [paw] Miso  |        |  |  35 days overdue [Book]    | |
|   Health records | || dog - 3 yrs | | cat - 2 yrs |        |  |~ Miso - FeLV               | |
|   Journal        | || ! Overdue   | | ~ Due soon  |        |  |  due in 10 days  [Book]    | |
|   Settings       | |+-------------+ +-------------+        |  +----------------------------+ |
|                  | |[+ Add pet]                            |  |RECENT JOURNAL    [View all]| |
| [D] Daniel       | +---------------------------------------+  |Today 07:10  Bella  Walk  30m| |
|   3 pets         | +---------------------+                |  |Yesterday    Miso   Note     | |
|                  | |NEXT VISIT           |                |  |21 Nov       Bella  Walk  20m| |
|                  | |Wed 26 Nov 09:30     |                |  +----------------------------+ |
|                  | |Bella - Annual       |                |                                |
|                  | |wellness       [Open]|                |                                |
|                  | +---------------------+                |                                |
+------------------+----------------------------------------------------------------------------+
```
**Recent journal cap (t2).** Grow past the phone's 3: **3 rows <1024, 4 at 1024–1279, 5 at 1280–1439, 6 at
≥1440**, newest first, always `View all → /journal`. The phone's cap was card height, not an information
rule; six rows fill the 1440 pane without scrolling. Fetch six once, hide overflow with CSS; empty state
"Nothing logged yet — use Quick log or Log entry." Next visit lists every visit on the earliest upcoming day.

### Pets — the household as a sortable table
```text
+------------------+------------------------------------------------------------------------------+
| [paw] Pet Health | Pets                                        [Search Cmd+K]   [+ Add pet]     |
| [Search Cmd+K]   | [All species v]  [Due: any v]  [Sort: Name v]      3 pets - 1 alert          |
|                  | +-----+-----------+--------+------+------+----------------+---------+-------+ |
| > Dashboard      | |     | NAME      | SPECIES | AGE | KG   | DUE            | NEXT    |       | |
|   Pets        3  | +-----+-----------+--------+------+------+----------------+---------+-------+ |
|   Appointments 2 | | [p] | Bella     | Dog    | 3 y | 12.4 | ! Overdue 35 d | 26 Nov  | Open  | |
|   Vaccinations!1 | | [p] | Miso      | Cat    | 2 y | 4.2  | ~ Due in 10 d  | 04 Dec  | Open  | |
|   Health records | | [p] | Coco      | Dog    | 1 y | 8.1  | OK up to date  | -       | Open  | |
|   Journal        | +-----+-----------+--------+------+------+----------------+---------+-------+ |
|   Settings       | Row opens the pet page; [p] is the paw placeholder.                          |
+------------------+------------------------------------------------------------------------------+
```

### Pet detail — summary · tabs · context rail
```text
+------------------+-----------------------------------------------------------------------------------+
| [paw] Pet Health | Pets / Bella                                     [Edit pet]  [+ Add record]       |
| [Search Cmd+K]   | [paw] Bella - Dog, Golden Retriever mix - 3 yrs - 12.4 kg  ! Rabies overdue         |
|                  | +------------------+  +------------------------------------+  +-------------------+ |
| > Dashboard      | |ABOUT             |  |[Overview] [Vaccinations] [Records] |  |NEXT VISIT         | |
|   Pets        3  | |Owner: Daniel     |  |[Appointments] [Journal]            |  |Wed 26 Nov 09:30   | |
|   Appointments 2 | |Born: 12 Mar 2023 |  |+-------------------------------+   |  |Bella - Annual     | |
|   Vaccinations!1 | |                  |  || VACCINATIONS                  |   |  |wellness check     | |
|   Health records | |DUE AT A GLANCE   |  || Vaccine Last   Next   Status  |   |  |[Open]             | |
|   Journal        | |! Rabies 26 Oct   |  || Rabies  12 Nov 26 Oct ! Over  |   |  |                   | |
|   Settings       | |~ FeLV 04 Dec     |  || DHPP    03 Mar 01 Mar OK      |   |  |RECENT             | |
|                  | |OK DHPP 01 Mar    |  || FeLV    30 Aug 04 Dec ~ 10 d  |   |  |Today Walk 30m     | |
| [D] Daniel       | +------------------+  || [+ Add vaccination]           |   |  |21 Nov Note        | |
|   3 pets         |                       |+-------------------------------+   |  |18 Nov Walk 20m    | |
|                  |                       +------------------------------------+  +-------------------+ |
+------------------+-----------------------------------------------------------------------------------+
```
Tabs are path-addressable; health records have no edit/delete affordance. Below 1024 ABOUT is a strip under the header and the rail stacks below the tab panel.

### Appointments — table beside the month calendar
```text
+------------------+--------------------------------------------------------------------------------+
| [paw] Pet Health | Appointments                               [Search Cmd+K]   [+ Book visit]     |
| [Search Cmd+K]   | [Upcoming | Past]   [All pets v]   [Table | Calendar]        2 this week       |
|                  | +------------------------+  +------------------------------------------------+ |
| > Dashboard      | |NOVEMBER 2026           |  |WHEN         PET   VISIT            STATUS      | |
|   Pets        3  | |Mo Tu We Th Fr Sa Su    |  |Wed 26 09:30 Bella Annual wellness  Scheduled   | |
|   Appointments 2 | |                   1 2  |  |Wed 26 14:00 Miso  Dental cleaning  Scheduled   | |
|   Vaccinations!1 | | 3  4  5  6  7  8  9    |  |Sat 29 10:15 Bella Boosters         Scheduled   | |
|   Health records | |10 11 12 13 14 15 16    |  |Thu 04 09:00 Miso  Six-month check  Scheduled   | |
|   Journal        | |17 18 19 20 21 22 23    |  |                                                | |
|   Settings       | |24 25 [26] 27 28 29 30  |  |Click a day to filter. Row opens actions Sheet. | |
| [D] Daniel       | +------------------------+  +------------------------------------------------+ |
|   3 pets         |                                                                                |
+------------------+--------------------------------------------------------------------------------+
```

### Journal — filters · day-grouped feed · inline editor
```text
+------------------+---------------------------------------------------------------------------------+
| [paw] Pet Health | Journal                                   [Search Cmd+K]   [+ Log entry]        |
| [Search Cmd+K]   | [All pets v] [All kinds v] [Last 30 days v] [Search...]     128 entries         |
|                  | +-------------+  +-------------------------------+  +-------------------------+ |
| > Dashboard      | |PETS         |  |TODAY                          |  |EDIT ENTRY               | |
|   Pets        3  | |* All pets   |  |+-----------------------------+|  |Tue 25 Nov - 07:10       | |
|   Appointments 2 | |  [p] Bella  |  || [W] Walk - Bella - 07:10 30m||  |Pet   [Bella v]          | |
|   Vaccinations!1 | |  [p] Miso   |  |+-----------------------------+|  |Kind  [Walk v]           | |
|   Health records | |KINDS        |  |YESTERDAY                      |  |Time  [07:10] [30 min]   | |
|   Journal        | |[x] Walk     |  |+-----------------------------+|  |Note  [...............]  | |
|   Settings       | |[x] Fed      |  || [N] Note - Miso - 20:15     ||  |                         | |
|                  | |[x] Meds     |  |+-----------------------------+|  |[Save]      [Delete]     | |
| [D] Daniel       | +-------------+  |... 126 more entries           |  +-------------------------+ |
|   3 pets         |                  +-------------------------------+                              |
+------------------+---------------------------------------------------------------------------------+
```

### Settings — sub-nav plus one scrollable form
```text
+------------------+--------------------------------------------------------------------------+
| [paw] Pet Health | Settings                                                                 |
| [Search Cmd+K]   | +------------------+  Owner name  [Daniel              ]                 |
|                  | |HOUSEHOLD         |  Email       [                    ]                 |
| > Dashboard      | |> Owner           |  Phone       [                    ]                 |
|   Pets        3  | |PREFERENCES       |                                                    |
|   Appointments 2 | |  General         |  Due-soon window  [30 days v]                      |
|   Vaccinations!1 | |  Appearance      |  Weight unit      [Kilograms v]                   |
|   Health records | |DATA              |  Density          [Comfortable | Compact]         |
|   Journal        | |  Sample data     |                                                    |
|   Settings       | |  Reset           |  Sample data      [ OFF ]                          |
| [D] Daniel       | |ABOUT             |  Reset household  [Reset...]                       |
|   3 pets         | |  Version         |  Version 1.0.0                                     |
|                  | +------------------+                                                    |
+------------------+--------------------------------------------------------------------------+
```

## 4. Motion and feel
Timing derives from the Flutter shell (80 ms out, 200 ms in), pet route (320 ms in, 340 ms back) and pet
sheet (260 ms); tokens are 04's.

| Element | Duration / easing | Notes |
| --- | --- | --- |
| Section route change | 80 ms out → 200 ms in | Fade-through, ease-in then ease-out. Sibling tabs use the shortest transition. |
| Detail push (`/pets/:id`) | 320 ms in · 340 ms back | 24 px slide + fade, `cubic-bezier(.33,1,.68,1)`; back reversed. Flutter slides 100% — desktop uses short travel. Tab switches inside the page crossfade 120 ms with no slide. |
| Sidebar expand/collapse | 180 ms width, 80 ms labels | Animate the grid track; tooltip after 400 ms. |
| Hover / press | 120 ms / 90 ms | Background tint; `scale(.98)` on buttons only, never rows. |
| List entry | 180 ms fade + 6 px rise | New rows only; 24 ms stagger, ≤6 rows, 300 ms total. Never on scroll/filter. |
| Dialog, Sheet, toast | 160 ms · 240 ms · 150/120 ms | Dialog scale .98→1; Sheet from right; toast dwell 3 s with 3 s Undo (Flutter parity). |

- **300 ms ceiling:** nothing animates longer than 300 ms except the two page transitions (320/340 ms).
  Durations are tokens, never per-component magic numbers. Skeletons pulse on a 1.6 s loop, not a
  transition, and are static under reduced motion.
- Enter with transform and opacity only; never animate `filter`, `box-shadow`, `height` or text layout
  (the sidebar grid track is the one width exception). One choreography at a time; input never waits, and
  a second input supersedes the first (the Flutter A4 fade race).
- **`prefers-reduced-motion: reduce`:** instant or ≤80 ms opacity swap, no slides/scales/stagger, static
  skeletons, smooth scrolling off; route changes keep a brief crossfade. No information is motion-only.

## 5. States
| State | Rule | Example |
| --- | --- | --- |
| First load | Skeleton matching the final layout; no full-page spinner. | 6 table rows; dashboard cards; pet header |
| Refetch after write | Keep data, update optimistically where safe, reconcile from the store; a 2 px progress line only if a read exceeds 200 ms. Every write updates every mounted surface through the store subscription (02 R10). | Quick log, appointment status |
| Empty | Welcome takeover on `/` (below) for an empty household; otherwise `EmptyState` with one sentence + create action. Filtered views say "Nothing for this pet" + Clear filters, never the no-data message. | No pets; no vaccines; filtered journal |
| Error / retry | Inline panel naming the failure with Retry; keep stale data with a banner. Boot or storage failure gets a full-window blocking screen with what failed, retry and browser advice. | "Could not load the journal."; IndexedDB unavailable |
| Pending write | Inline button spinner + disabled; dialog stays open on failure. | Booking, saving a pet |

**First run.** `/` renders a full-window takeover (sidebar/header hidden): household name → first pet
(name, species, weight, date of birth) → start empty or sample household. A shell mode, not a route;
completion or Reset household returns here, and it only appears while the owner is unnamed and no pets exist.

```text
[paw] Pet Health Tracker                                          Step 1 of 3
+----------------------------+   +------------------------------------------+
|[paw]                       |   |Let's set up your household                |
|A calmer way to keep track  |   |Your name                                  |
|of every pet's health.      |   |[ Daniel                                ]  |
|- vaccine due dates         |   |                                            |
|Everything stays on this    |   |[Back]                      [Continue]      |
|computer. No account.       |   |[Use the sample household instead]          |
+----------------------------+   +------------------------------------------+
```
## 6. Density
| Element | Comfortable (default) | Compact |
| --- | --- | --- |
| Sidebar nav row | 36 px | 32 px (rail tile stays 40×40) |
| Table row (pets, appointments, vaccinations, records) | 44 px | 36 px |
| Journal feed row | 64 px (two-line) | 52 px |
| Form control / button | 36 px | 32 px |
| Section header / card padding | 28 px / 16 px | 24 px / 12 px |

**Does it earn its place?** Yes, scoped to the data views (four tables + journal feed): a persisted two-state
control in Settings › Preferences, not a window-width heuristic. Spacing only, never type size; at 1280 it buys roughly three table rows.
## 7. Hand-off and supersessions
| Provisional in 02/04 | Decision here | Why |
| --- | --- | --- |
| `/settings` | `/profile` | The sidebar footer is the owner's **Profile**: avatar + name, opening owner details, preferences and data. The Flutter app's Profile screen keeps its name; its pet list moves to `/pets`. |
| `/dashboard` or `/welcome` | `/` only | Home is root; first run is a shell mode on `/` (no Welcome route). |
| — | `/vaccinations`, `/records` added | Required sidebar items; read views over existing doses/notes, no schema change. |
| 248/64 sidebar, 1180 content (04) | 240/72, 1200/1440 | 03 is authoritative for shell metrics; 04's tokens follow. |
| Appointments cards, no Data Table (04) | Table + calendar | Required by this IA; 04 already maps Tabs + Data Table + Calendar. |

- **04:** sidebar 240/72, header 64/56, content 1200/1440, nav row 36, active tile from tokens.
- **05:** dashboard stat chips and Needs-attention are parity data recomposed, not new features; 05 decides
  whether larger stat cards/Insights ship. Recent growth is a density decision here, not a 05 feature.
- **06 acceptance:** verify 1024/1280/1440/1920, ⌘1–6 + ⌘K + ⌘B, first run + reset, every empty/error
  state, and a `prefers-reduced-motion` pass.