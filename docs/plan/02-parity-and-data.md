# 02 · Flutter → React parity, business rules and data model

| | |
| --- | --- |
| Status | Draft for team review — planning only, no code |
| Owner | parity-planner (task t2) |
| Feeds | 01 stack, 03 information architecture, 04 component system, 05 desktop features |
| Sources read | `Pet Health Tracker/README.md`, `AGENTS.md`, `db/schema.sql`, `docs/reviews/SUMMARY.md`, `lib/domain/**`, `lib/data/**`, `lib/app/**`, `lib/features/**` |
| Owns in this doc | feature parity, verbatim rules, entity schema, persistence recommendation |

## 0. Fixed decisions that change parity

**Pet photos are out of scope for v1.** Every photo surface (Home pet card, Profile pet row, pet-page
hero, pet form, pet chooser) renders one shared placeholder: a species-aware paw icon on the tinted tile
plus the pet's initial, deterministic per pet. No picking, copying, storing, deleting, capability flag or
file path is planned.

`Pet` gets **no photo field at all in v1** — not even a nullable one. The Flutter field's meaning
(`photo_path` → a file copied into the app's documents directory) does not exist in a browser, and a
field nothing reads is a half-feature — one that already shipped once (reviews A2/D6: a "Choose photo"
control on a build that could never pick). Photos are additive later in either candidate store (new
optional field + a Dexie `version()` bump, or `ALTER TABLE pet ADD COLUMN`), so optionality costs about
the same later and lies to implementers now.

## 1. Feature inventory → React parity

Routes below follow 03's authoritative tree; component names are proposals for doc 04. "Flutter" names the matched surface.

| Flutter surface | React route / component | Notes |
| --- | --- | --- |
| Shell, 4 tabs + centre action (Flutter) | `AppShell` + `CreateMenu` (+ `PetChooserDialog`) | Seven sidebar destinations (Dashboard, Pets, Appointments, Vaccinations, Health records, Journal, Settings) always reachable, active marked, create menu always available. Three create flows: book visit → lands on `/appointments`; log entry → chooser → form → lands on `/journal`; add health record → chooser → form, stays put. The chooser lists pets with "No pets yet" and a retry on load failure |
| Home `/home` | `/` `HomePage` | Greeting (`Good morning/afternoon/evening` + first name; omitted while the owner is still `My household`) + owner avatar → `/profile`; 3 newest household entries (`RecentEntries`, row opens the journal edit dialog, empty "Nothing logged yet.") |
| Pet carousel (`PageView`) | `PetCarousel` + `PetCard` | Sorted by name, case-insensitive; card = name, `species · breed`, age, weight (unit setting), due chip naming the dose, `Last visit · d MMM`; ends with an "Add pet" card; pager when >1 pet. 03's household table lives at `/pets` (row → pet detail) |
| Quick-log chips + long-press form | `QuickLogBar` + `JournalEntryCreateDialog` | Fixed order walk, fed, meds, note. Click saves that kind at *now*; long-press opens the full form (7 kinds, date, time, note, duration). Desktop needs a non-long-press affordance — 05 |
| Next-visit card(s) | `NextVisitCard` | **Every** scheduled visit on the earliest upcoming local day, not only one; empty state "No upcoming visits" links to `/appointments` |
| Home appointment card → actions | `AppointmentActionsDialog` | Same dialog as Appointments, plus "View in Appointments" → `/appointments` filtered to that pet (`petId: null` = unfiltered) |
| Welcome / first run | Shell mode on `/` (`WelcomeTakeover`), no route | Name, pet name, species (10 options), weight (default 5), DOB (default today − 1 y). Primary "Create my household" (saves owner, keeps existing email/phone, creates pet); secondary "Or start with the sample household". Flutter shows the card whenever pets = 0; 03 gates it on an unnamed owner + no pets, hides the shell, and Reset household returns here |
| Journal `/journal` | `/journal` `JournalPage` | Pet filter chips (hidden below 2 pets), day sections Today / Yesterday / `d MMM yyyy`, newest first, per-pet scoping on the query (not a slice of a capped household page) |
| Journal row → edit | `JournalRow` + `JournalEntryDialog` | Editable: time, note, duration; kind is fixed and shown as a label; delete asks for confirmation |
| Appointments `/appointments` | `/appointments` `AppointmentsPage` | Upcoming/Past segmented control, pet filter chips, one card per visit: date block, pet name or `Household`, clinic, `purpose · time`, status chip; 03 makes `?view&status&pet&date` deep-linkable |
| Booking form | `AppointmentDialog` | Pet select (defaults to the first pet), clinic, purpose, date (default tomorrow, range today → +3 y) and time (default 09:30); errors for missing pet/clinic/purpose; save → toast + `/appointments` |
| Appointment actions | `AppointmentActionsDialog` | Mark completed · Cancel (reason dialog, confirm disabled until non-blank) · Mark no-show (disabled until after `scheduled_at`) · Reschedule (date+time; cancels old as `rescheduled`, inserts new, atomically). Terminal = read-only summary + Close |
| Pet page `/pets/:petId` + header | `/pets/:petId/:tab?` `PetPage` + `PetPageHeader` | Flutter is a full-bleed photo with a two-stop drag sheet; 03 replaces the stops with path-addressable tabs (Overview / Vaccinations / Records / Appointments / Journal). Parity is the information, not the gesture: the resting view keeps name, meta, worst due status and the one next dose; everything else is one tab away. Back + Edit in the header; unknown pet → "Pet not found" |
| Pet page vaccines (also a household list) | `/pets/:petId/vaccinations` + `/vaccinations` — `VaccineList` + `VaccinationDialog` | Row = name, `given · next due`/`no booster set`, per-dose due chip from the shared rule; "+ Add"; empty "No vaccines recorded yet." `/vaccinations` (03) is the household read/filter table over the same doses — no schema change |
| Pet page clinical history (also a household list) | `/pets/:petId/records` + `/records` — `ClinicalHistoryList` + `HealthRecordDialog` | Row = title (condition, else diagnosis), `date · vet`, `Rx med · treatment`; **no edit or delete affordance** (the `/records` household view is read-only too); "+ New"; empty "No clinical notes yet." |
| Pet form | `PetFormDialog` (create + edit) | Name, species, breed, sex, DOB, weight kg, microchip. No photo control. Validation = R9 |
| Vaccination form | `VaccinationDialog` | Vaccine from the catalog, dose date, next due prefilled from `intervalMonths` and clearable, vet name; next due must be null or strictly after the dose date |
| Health-record form | `HealthRecordDialog` | Date, condition, diagnosis, treatment, prescribed medication, vet; at least one of condition/diagnosis (trimmed) |
| Profile screen | `/profile` `SettingsPage` + `OwnerFormDialog` | Owner block (initial, name, email/phone with "Add an email"/"Add a phone number", Edit → name required, email, phone), footer `Version · N pets · N records`; 03 supersedes Flutter's `/profile` with `/profile` and moves the pet list to `/pets`, so "Add a pet" and the pet rows live there |
| Profile settings | `/profile` `PreferencesSection` | 4 rows: Due-soon window (7/14/30/60/90, shows "30 days"), Weight unit (kg/lb), Sample data switch, Reset household (destructive styling) |
| Reset household dialog | `ResetHouseholdDialog` | Confirm copy + checkbox "Also forget my name and details" (default off); on confirm: delete all → sample off → optional owner blank; toast "Household reset." |
| Snackbars / undo | Toast (sonner) | `X logged` + 3 s Undo (deletes the just-created entry); `Entry updated/deleted`, `Appointment marked completed`, etc. |
| Pull-to-refresh, phone frame | — | Both dropped: refresh on mutation + window focus (R10), and a responsive desktop layout instead of letterboxing |

## 2. Business rules to port verbatim

**R1 · Vaccination due status — newest dose per vaccine wins.** A pet's tracked status is computed over
*current doses* only: for each vaccine key, keep the newest dose by `vaccinationDate`, ties broken by
creation order. The form requires a catalog entry, so the key is `vaccineTypeId`; `vaccineName` is a
display snapshot and never a ranking key. One dose: null due → `up_to_date`; due < today → `overdue`;
due ≤ today + window → `due_soon`; else `up_to_date`. Pet status = worst of its current doses; no
tracked due dates → `up_to_date`. The headline dose = current dose with the earliest due date.

- Accept: rabies due 2026-01-09 (overdue) then a booster due 2027-03-01 → `up_to_date`; the old row is
  history, same-day doses resolve to the later one, and overdue rabies + due-soon FeLV reads `overdue`
  with Home's chip naming `Rabies`.
- Reject: ranking every row (the fixed D2/Q2 bug) — a re-vaccinated pet must be able to clear `overdue`.

**R2 · Settings and storage formats.** Due-soon window options 7/14/30/60/90 days, default 30, valid
1–365; weight unit `kg` (default) or `lb` (`× 2.2046226218`, one decimal). Both persist across reloads
and re-render open screens without a manual refetch. Instants are ISO-8601 UTC with milliseconds;
date-only values are fixed-width `YYYY-MM-DD` and compare as strings. Settings also carry
`sampleDataEnabled` (default off); an unreadable settings record falls back to defaults instead of
blocking boot.

- Accept: window 14 → due in 15 days `up_to_date`, 14 days `due_soon`, today `due_soon`, yesterday
  `overdue`; unit lb renders 12.4 kg as `27.3 lb` everywhere.

**R3 · Appointment state machine.** `scheduled → completed | cancelled | no_show`; terminal states are
immutable; same-status is rejected; `no_show` only when `now` is *strictly after* `scheduled_at`;
cancelling requires a non-blank trimmed reason; `completed_at` is set exactly on completion;
`cancel_reason` is stored on cancellation and nowhere else; reschedule = cancel with reason
`rescheduled` **plus** insert a new scheduled row (same pet/clinic/purpose) in one transaction, so a
half-rescheduled visit is impossible. The UI disables actions the machine would block and shows the
block message, and the write path re-checks — never trust the disabled state. Read `now` once per
action from one clock module.

- Accept: at `scheduled_at` exactly, no-show is blocked; one second later it is allowed; cancel with
  `"   "` is blocked; completing hides every action and shows the completed timestamp.

**R4 · One local calendar day.** Due status, "last visit", journal day grouping, Today/Yesterday labels
and the next-visit "most urgent day" all use the **local** calendar day. Storage stays UTC instants;
date-only values stay `YYYY-MM-DD`. Never derive a day from a UTC instant — the fixed D3/D4 bug.

- Accept: at 00:30 local (UTC+8) on 2 Mar a dose due 1 Mar reads `overdue` (UTC would say due today); a
  visit completed 07:30 local on 2 Mar shows last visit 2 Mar; an entry logged 23:55 local on 1 Mar
  groups under 1 Mar, not Today.
- Last visit = later of (latest completed appointment's local day, latest `health_record.recorded_on`).

**R5 · Clinical notes are append-only.** `health_record` exposes read + append only: no update, no
delete, no UI affordance. The only deletion is the pet-delete cascade. IndexedDB has no triggers, so
this becomes a repository-surface rule (no exported update/delete + a test that fails if one appears).

- Accept: the history list renders no chevron, edit or delete control; the data exports only
  `listForPet`/`append`.

**R6 · Journal entries are editable.** Time, note and duration may change after creation; kind is
immutable in the edit form; duration must be a positive whole number when present; deleting requires a
confirmation dialog.

- Accept: changing an entry's time moves it to the right day section; cancelling delete leaves the row.

**R7 · Demo rows are owned by exact ids — never an id range.** Per table, a fixed id list defines
"demo" (`demoPetIds`, `demoVaccinationIds`, `demoHealthRecordIds`, `demoAppointmentIds`,
`demoJournalEntryIds`). Toggling sample data on = clear the listed rows then reseed with dates relative
to the seed day; off = delete exactly the listed rows and restore the placeholder owner name if the
demo persona (and no contact details) is still there. "Demo exists" must check the same lists.
For React (stack-planner confirms): user rows get UUID ids, demo rows literal `demo-*` ids, so the id
spaces cannot collide — the rule stays exact-list; the prefix is only a readability aid.

- Accept: seed → add a pet → clear → the pet survives; clear→seed→clear leaves no orphans or duplicates.

**R8 · Reset household.** Delete all appointments, then all pets (cascading journal, vaccinations,
clinical notes), turn sample data off, and blank name/email/phone to `My household`/empty only when
"also forget" was checked. After reset the app shows the Welcome panel.

- Accept: reset without the checkbox keeps the owner's name; with it, Home greets nobody. It is not
  undoable, so it always confirms first.

**R9 · Pet identity rules.** Name 1–40 chars, species 1–30, breed ≤40, sex `male|female|unknown`, DOB
required, not future, not older than 40 years, weight `> 0` and `≤ 300`, microchip 9–15 digits, blank →
null, unique across pets. Species select offers Dog, Cat, Rabbit, Hamster, Guinea pig, Bird, Ferret,
Turtle, Fish, Other, and still shows a legacy value outside that list.

- Accept: two pets cannot share a microchip; a blank name is rejected before any write.

**R10 · One write path; every surface refreshes.** Every mutation goes through the data layer and every
mounted surface showing that data updates without a manual refresh — the fixed A1/F1/F2 class ("centre
action wrote, then navigated to the already-mounted destination, which never reloaded"). A Dexie
`liveQuery` (or one revision counter) is the React equivalent of the Flutter `householdRevision`. The
filtered hand-off keeps the "no request" vs. "no filter" distinction: Home → Appointments carries
`{petId: number | null}`, where `null` means open unfiltered even if a filter was set earlier.

- Accept: booking from the create menu while Home is mounted updates its next-visit card; logging an
  entry makes it appear in Journal; Appointments opened from a Household visit shows "All pets".

### R9 boundary — deliberate deviation from Flutter (decided 2026-11-25)

The Flutter validator floored the birthday at **1 January of `today.year − 40`**, so any date in that year
passed. The React port floors it at **exactly `today − 40 years`**, which is what the error copy ("that is
over 40 years") actually means. Only exactly-40-year-old edge cases differ. Recorded here so it is not
mistaken for a bug: if a test asserts the Flutter year-granularity, change the test, not the rule.

## 3. Data model — seven entities

Ids and timestamps are storage fields; form drafts carry neither. Every entity is a flat record.

| Entity | Fields and constraints |
| --- | --- |
| `Owner` | `id`, `name` (trimmed, non-empty), `email` (default `''`), `phone` (default `''`), `createdAt`, `updatedAt`. Exactly one row (fixed key) |
| `Pet` | `id`, `ownerId`, `name` (1–40), `species` (1–30), `breed?` (≤40), `sex` (`male/female/unknown`), `dateOfBirth` (date, ≤ today, ≥ **exactly** today−40 y — see the R9 note below), `weightKg` (>0, ≤300), `microchip?` (9–15 digits, **unique**), `createdAt`, `updatedAt`. **No photo field** |
| `JournalEntry` | `id`, `petId` (required, cascade), `kind` (`walk/fed/meds/grooming/training/note/symptom`), `occurredAt` (instant), `note?`, `durationMinutes?` (integer > 0), `createdAt`, `updatedAt` |
| `HealthRecord` | `id`, `petId` (required, cascade), `recordedOn` (date), `condition?`, `diagnosis?` (at least one non-empty), `treatment?`, `prescribedMedication?`, `vetName?`, `createdAt`. **No `updatedAt`** — append-only |
| `Vaccination` | `id`, `petId` (required, cascade), `vaccineTypeId?`, `vaccineName` (display snapshot, non-empty), `vaccinationDate` (date), `nextDueDate?` (null or **strictly after** `vaccinationDate`), `vetName?`, `createdAt`. No `updatedAt` |
| `Appointment` | `id`, `petId?` (`null` = household), `clinicName` (non-empty), `purpose` (non-empty), `scheduledAt` (instant), `status` (`scheduled/completed/cancelled/no_show`), `completedAt?`, `cancelReason?`, `createdAt`, `updatedAt`. `completedAt` set **exactly** when completed; `cancelReason` non-empty **exactly** when cancelled |
| `VaccineType` | `id`, `name` (unique, non-empty), `intervalMonths?` (>0), `isCore`, `sortOrder`. Seeded: Rabies, DHPP, Leptospirosis, Bordetella, FVRCP, FeLV (12 mo each), Deworming (3 mo) |

Settings are a ninth, non-entity record — kept outside the tables on both sides (R2).

**Derived read models** (pure, store-agnostic): `PetOverview` (pet, dueStatus, nextVaccination,
nextAppointment, lastVisit) and `Dashboard` (owner, pets, nextAppointments, recentEntries); per-pet lists
ordered `vaccination_date DESC` / `recorded_on DESC`; journal newest-first; upcoming = `scheduled` and
`scheduledAt > now` ascending, history = everything else descending; pets sorted by name
case-insensitively.

**Delete and cascade semantics.** Deleting a pet deletes its journal entries, vaccinations and clinical
notes and keeps its appointments with `petId = null` (rendered "Household"); reset deletes appointments
first, then pets. Both are explicit multi-step transactions — IndexedDB has no cascades.

## 4. Persistence decision input

The data shape is deliberately tiny and relational: 7 flat entities, no joins, no file/blob storage
(photos are cut), one owner, and a decade of a busy household is well under 10 MB. Size does not decide
this — multi-tab safety, migration clarity and re-implemented schema enforcement do.

| Criterion | SQLite-WASM, sql.js (in-memory DB, snapshot → IndexedDB) | SQLite-WASM, wa-sqlite/sqlite-wasm over OPFS | Dexie 4 over IndexedDB |
| --- | --- | --- | --- |
| Offline | Yes; every save rewrites the whole file, so a crash between saves loses the tail | Yes, durable page writes | Yes, durable per transaction |
| Multiple tabs | **Weakest**: each tab holds its own copy and the last save overwrites the others (silent loss) → needs Web Locks leader election or a read-only second tab | OPFS sync access handles are exclusive and the SQLite WASM SAH-pool VFS is documented as single-tab; needs a coordinator/SharedWorker | Normal: concurrent connections, transactions serialize, per-record last-write-wins, no corruption |
| Data size | Fine at this size; cost is O(file) per write | Fine, incremental | Fine, incremental, indexed |
| Migration story | Best fidelity: reuse `db/schema.sql` verbatim with versioned steps, engine-enforced CHECK/UNIQUE/FK/cascades/append-only triggers | Same as sql.js | `db.version(n).upgrade()` — explicit and testable, but constraints move to app code and must be re-established by hand |
| Demo seed/reset | Exact-id deletes in one SQL transaction; seed SQL reusable | Same | `bulkPut`/`bulkDelete` by exact id list in one transaction; simplest code, no DDL |
| Weight / startup | ≈1 MB wasm + worker boot | ≈1 MB wasm + worker; OPFS unavailable in some private modes | Tens of KB, no worker |
| Reactivity | Manual revision/refetch signal (port the Flutter pattern) | Manual revision/refetch signal | `liveQuery` updates on writes, including cross-tab mutation broadcast |

**Recommendation: Dexie 4 over IndexedDB for v1.** The deciding criterion is multi-tab behaviour — a
desktop web app gets opened twice routinely, and both SQLite options push cross-tab locking onto us
(sql.js because the whole file is rewritten; OPFS because access handles are exclusive). Second, the
"light, smooth" goal argues against a wasm module plus worker cold start for a household notebook.
Third, `liveQuery` removes the write-refresh class (R10) instead of re-porting a manual counter. The
cost is real but bounded: the seven entities are flat, so losing engine constraints means a small,
enumerable set of app-level rules.

Risks, each with its mitigation:

1. **Schema enforcement moves into code.** Cap the write surface at one repository module per entity (no
   raw table access elsewhere — enforce with an ESLint restricted-import rule), mirror the DDL checks in
   Zod schemas, keep unique indexes on `microchip` and `VaccineType.name`, run cascade deletes inside one
   `db.transaction`, and re-check the appointment machine on write even though the UI disables actions.
2. **Append-only cannot be enforced by the store.** No exported update/delete for health records, plus a
   test asserting the module's export surface; the pet-delete cascade is the only delete path.
3. **Ordering.** IndexedDB indexes are not `ORDER BY`: add compound indexes `[petId+occurredAt]`,
   `[petId+recordedOn]`, `scheduledAt`, `nextDueDate`, and sort pet names in JS with
   `localeCompare(…, {sensitivity: 'base'})` to match `COLLATE NOCASE`. Never rely on insertion order.
4. **Cross-tab freshness is best-effort** when a tab is frozen: also refetch on `visibilitychange`/focus
   and never memoize a list across a navigation.
5. **Migration testing.** Each version bump ships a fixture-database upgrade test; keep a `schemaVersion`
   record and an upgrade log next to the data.

**Fallback seam.** If stack-planner prefers literal `db/schema.sql` reuse, only the store adapter, the
repository modules and the seed/migration modules change — R1–R10 are pure and store-agnostic. The
Flutter web build already runs SQLite WASM in a worker over IndexedDB (`sqflite_common_ffi_web`), so that
path is proven, at one-tab-at-a-time fidelity.

## 5. Known bugs not to port

Already fixed in the Flutter tree; the React version starts from the corrected rule and must not regress it.

| Class | Wrong behaviour (do not reproduce) | Corrected rule |
| --- | --- | --- |
| Demo-id ownership (D1) | `DELETE … WHERE id >= 9000` destroyed owner rows created after seeding — real data loss | R7: exact per-table id lists, reseed on toggle-on, "demo exists" checks the same lists. Regression test: seed → add pet → clear → pet survives |
| Newest-dose ranking (D2/Q2) | Ranking all doses let an old overdue dose outrank its booster, so a re-vaccinated pet stayed Overdue forever | R1: reduce to current doses per vaccine, then rank |
| UTC calendar day (D3/D4) | Dashboard derived "today" and last-visit from the UTC instant; due status and last visit were a day off near midnight | R4: one local-day helper, used by every date-only comparison |
| One write signal (A1/F1/F2, A6) | Writes from the centre action landed on the already-mounted destination, which never reloaded; and a nullable `petId` notifier could not say "open with no filter" | R10: one revision/live-query signal every mounted surface subscribes to, and a request object `{petId: number \| null}` |

Also already corrected in the tree (carry the behaviour, not just the rule): the screen behind a detail
route reloads when it pops (F3 — Flutter's Profile after the pet page); journal delete confirms (F8); settings writes are atomic with a catch-all read and
defaults (D7); the journal per-pet filter queries per pet rather than slicing a capped page (D8); sample
data reseeds on toggle-on, restores the placeholder owner on clear (D5/D11), and boot repairs a leftover
demo persona on an empty household.

Present in Flutter but **not** carried over: the photo picker and its dead web control (moot — photos
cut), phone-frame letterboxing, pull-to-refresh, the fixed 52 px primary button and the 50-row page cap
as hard constraints (desktop still wants ≥44 px targets and a paged list, but those caps are phone
decisions), and the `AUTOINCREMENT` id scheme.

## 6. Hand-offs

- **01 stack** — confirm Dexie+IndexedDB (or the fallback seam), the id scheme, and the date helper (local `YYYY-MM-DD` for rules, UTC ISO for instants).
- **03 information architecture** — routes follow 03's tree (`/`, `/pets`, `/pets/:petId/:tab?`,
  `/appointments`, `/vaccinations`, `/records`, `/journal`, `/profile`); first run is a mode of `/`.
- **04 component system** — reuse the Flutter status palette semantically (overdue / due soon / up to
  date; appointment statuses), the 60 px list rhythm, and one placeholder avatar contract.
- **05 desktop features** — quick-log needs an explicit "details" affordance to replace long-press, plus
  keyboard shortcuts for create/lookup; multi-window and sync stay out of scope. Home's recent-list
  growth is 03's density decision, not a 05 feature.
