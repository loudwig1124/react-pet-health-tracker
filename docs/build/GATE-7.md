# GATE 7 — final gate after the owner-requested shortcut removal and full-width layout

| | |
| --- | --- |
| Change set | t14 (all keyboard shortcuts removed, full-width shell, toggle moved into the sidebar brand row) + t15 (mouse-only proof suite, negative spec, acceptance rewrite) |
| Verdict | **PASS** |
| Gate owner | qa-reviewer (t15) |
| Date | 2026-11-25 21:05–21:12 (Asia/Manila) |
| Evidence log | [`evidence/gate-7.log`](./evidence/gate-7.log) · literal acceptance sequence [`evidence/final-acceptance.log`](./evidence/final-acceptance.log) |
| Command | `GATE=7 bash scripts/gate.sh`, then `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm exec vitest run && pnpm build && node scripts/check-size.mjs && pnpm e2e` |
| Supersedes | [`GATE-6.md`](./GATE-6.md) for the final numbers and screenshots (GATE-6 remains the pre-shortcut-removal record and the m6 before/after polish evidence) |

## 1 · What changed

1. **All keyboard shortcuts were removed at the owner's request** (t14): the shortcut module, matcher,
   shortcut sheet, `Kbd` hints and every visible key hint are deleted; ⌘K/⌘1–6/⌘N/⌘B/⌘,/`?` and the
   plain-key aliases do nothing. The command palette remains, opened by the header **Search** button.
2. **The shell is full-width** (t14): no `mx-auto` max-width cap, one `--page-gutter` (24 px desktop,
   16 px <1024); the page title, header row, cards and tables share that gutter.
3. **The rail toggle moved into the sidebar brand row** (owner follow-up): visible with air on both
   sides when expanded, alongside the brand in the 72 px rail, hidden in the forced <1024 rail. The
   header is title + description + Search only.
4. **The proof suite is mouse-only** (t15): every former shortcut step is now a click — sidebar items,
   header **Search**, header primary action/empty-state buttons, sidebar brand-row toggle, Profile
   footer. Keyboard use remains only inside widgets (typing, dialog Tab/Enter, palette arrows/Enter/
   Escape, table rows).
5. **New negative spec** `e2e/no-shortcuts.spec.ts`: presses ⌘K, ⌘1–6, ⌘N, ⌘B, ⌘,, `?`, Shift+?, and the
   Ctrl/plain-key equivalents on the dashboard and on `/pets`; asserts no palette, no shortcut sheet, no
   navigation, no rail change and no console/page error, then proves the mouse paths still work.
6. **New layout spec** `e2e/layout.spec.ts`: asserts the full-width geometry at 1440/1280/1024 and the
   toggle-in-sidebar/hidden-in-forced-rail rules; the zero-overflow checks cover all widths.

## 2 · Mouse-only proof

| Former headless key | Mouse path now tested |
| --- | --- |
| ⌘K | click `header-search` → palette; arrow/Enter/Escape *inside* the palette still tested |
| ⌘1–6 | click `nav-<key>` (all six destinations + active state) |
| ⌘N | click `header-search` → `command-item-create:*` (all five create commands open their dialogs) |
| ⌘B | click `sidebar-toggle` in the sidebar brand row (1440 and 1024 rail) |
| ⌘, | click `nav-profile` (pinned footer) |
| `?` | no shortcut sheet exists; negative spec proves the key is inert |

Keyboard presses remaining in `e2e/`: `Escape` (dialog/palette close), `Tab` (inside the Add pet
dialog), `Enter`/`ArrowUp`/`ArrowDown` (inside the palette), and the deliberate former-key presses in
`no-shortcuts.spec.ts`. No spec depends on a global shortcut.

## 3 · Final gate (frozen tree)

| Step | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | **PASS** | lockfile up to date |
| `pnpm typecheck` | **PASS** | 0 errors |
| `pnpm lint` (`oxlint`) | **PASS** | 0 warnings, 0 errors |
| `pnpm format:check` (`oxfmt`) | **PASS** | all files formatted |
| `pnpm exec vitest run` | **PASS** | **57 files / 397 tests** |
| `pnpm build` | **PASS** | size gate green — §4 |
| `node scripts/check-size.mjs` | **PASS** | repeated gate green |
| `pnpm e2e` (Chromium, all specs) | **PASS** | **67/67**, zero console/page errors, 0 skipped |

## 4 · Size gate (gzip)

| Budget | Measured | Limit | Result |
| --- | --- | --- | --- |
| First load (shell + `/`) | **172.8 kB** (was 174.4 kB at GATE-6; the shortcut matcher/sheet removal is the drop) | 200.0 kB | PASS |
| Largest lazy chunk (shared write/zod graph) | 24.3 kB | 90.0 kB | PASS |
| `/pets` | 13.4 kB | 90.0 kB | PASS |
| `/pets/:petId/:tab?` · `/profile` | 6.9 · 6.9 kB | 90.0 kB | PASS |
| `/journal` | 4.9 kB | 90.0 kB | PASS |
| `/records` · `/appointments` · `/vaccinations` | 3.3 · 2.9 · 2.2 kB | 90.0 kB | PASS |
| Calendar chunk | 20.1 kB | 45.0 kB | PASS |
| Palette chunk | 3.6 kB | 90.0 kB | PASS |
| Initial CSS | 15.4 kB | 35.0 kB | PASS |
| Eager-shell content scan | no table/calendar/palette/chart/motion markers | none | PASS |

## 5 · Performance

| Metric | Measured | Budget | Result |
| --- | --- | --- | --- |
| LCP | **32 ms** | ≤ 1,500 ms | PASS |
| DOM nodes (dashboard with data) | **255** | ≤ 1,200 | PASS |
| Route swap, max of five destinations | **13.1 ms** | ≤ 100 ms | PASS |
| Long tasks > 50 ms | **none** | none | PASS |

## 6 · Full-width layout — verified by looking

The eight fresh `edge-*` shots (4 screens × 1440/1024) were opened and inspected after this gate:

- **1440** (`edge-1440-dashboard.png`, `edge-1440-journal.png`): the sidebar brand row shows
  “Pet Health Tracker” with the rail toggle at its right edge and visible air on both sides; the page
  title starts exactly above the cards at the same 24 px line (x = 264, main starts at 240); cards and
  tables reach viewport − 24; there is no centred dead margin and no white band between sidebar and
  content. The header shows only title/description and the Search button — no shortcut hints.
- **1024** (`edge-1024-dashboard.png`): the 72 px rail shows the paw + toggle centred together, no
  orphan toggle in the header; the title starts at x = 96 (72 + 24) and every card/table edge aligns to
  the same gutter and right edge.
- **900 forced rail** (`m7-900-dashboard.png`): no toggle at all; the title and cards still start at
  96 px and no horizontal overflow appears.
- Geometry is also asserted in `layout.spec.ts`: 0 px overflow at 1440/1280/1024, toggle inside the
  sidebar with ≥4 px air both sides, title/card left edges equal, cards right edge = viewport − 24,
  header width = main width, and the forced rail hides the toggle.

## 7 · Screenshots

| Set | What it is |
| --- | --- |
| `shots/edge-{1440,1024}-{dashboard,pets,appointments,journal}.png` | **fresh full-width proof** (8 files, re-captured on the frozen build) |
| `shots/m7-{1440,1024,900}-{dashboard,pets,appointments,journal}.png` | gate screenshot set at the final build (12 files, incl. the 72 px rail) |
| `shots/m5-*` → `shots/m6-*` | before/after for the t11–t13 polish (GATE-6) |

## 8 · What to fix

**No failed item.** No skipped test, no console error, no budget breach. F4 and F8 are recorded in
`ACCEPTANCE.md` as **superseded/removed by the owner's explicit shortcut-removal request**, with the
mouse paths and the negative spec as the replacement evidence; there is no open defect.
