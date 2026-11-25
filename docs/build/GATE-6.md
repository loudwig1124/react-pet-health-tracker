# GATE 6 — final acceptance re-gate after the t11–t13 polish

| | |
| --- | --- |
| Milestone | Post-M5 final acceptance (t8) — the frozen release-one tree |
| Verdict | **PASS** |
| Gate owner | qa-reviewer (t8) |
| Date | 2026-11-25 14:22–14:28 (Asia/Manila) |
| Evidence log | [`evidence/gate-6.log`](./evidence/gate-6.log) · literal acceptance sequence: [`evidence/final-acceptance.log`](./evidence/final-acceptance.log) |
| Command | `GATE=6 bash scripts/gate.sh` and the task's `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm exec vitest run && pnpm build && node scripts/check-size.mjs && pnpm e2e` |
| Supersedes | [`GATE-5.md`](./GATE-5.md) for the post-polish numbers and screenshots (GATE-5 stays as the M5-freeze evidence and as the “before” pictures) |
| Superseded by | [`GATE-7.md`](./GATE-7.md) — the owner removed keyboard shortcuts and widened the layout (t14); GATE-7 is the release-one final gate |

## 1 · What changed since GATE-5

Three visual defects the gate checks could not catch were fixed after M5 (captain review):

| # | Defect | Owner | Fix | Before → after |
| --- | --- | --- | --- | --- |
| 1 | Dashboard left column had a tall void under “Next visit”; heading repeated “Pets · 3 pets” | t11 desktop-dev | 2×2 card grid (Pets \| Needs attention; Next visit \| Recent journal) and a count badge beside “Pets”; counter/rail/journal-cap behaviour untouched | `shots/m5-1440-dashboard.png`, `m5-1024-dashboard.png` → `shots/m6-1440-dashboard.png`, `m6-1024-dashboard.png` (supplementary: `shots/polish-1440-dashboard.png`, `polish-1280-dashboard.png`, `polish-1024-dashboard.png`) |
| 2 | `/journal` rendered two primary “Log entry” buttons (header + filter toolbar) | t12 journal-dev | toolbar button removed; the header `PageAction` is the single create affordance, editor unchanged | `shots/m5-1440-journal.png`, `m5-1024-journal.png` → `shots/m6-1440-journal.png`, `m6-1024-journal.png` |
| 3 | Pets table pinned identity column painted an opaque band at rest (white step on the left) | t13 pets-dev | one shared sticky-table treatment (`StickyTable`) so the pinned cell matches the surface at rest and only paints when pinned | `shots/m5-1440-pets.png`, `m5-1024-pets.png` → `shots/m6-1440-pets.png`, `m6-1024-pets.png` |

**Visual verification (not just green tests):** the after shots at 1440 and 1024 were opened and inspected — the dashboard void is gone and the heading reads “Pets [3]”; the journal has one “+ Log entry”; the pets identity column has no seam at rest at either width. No new defect is visible in the re-captured dashboard/pets/appointments/journal sets at 1440, 1024 and the 72 px rail.

A new E2E spec, `e2e/no-network.spec.ts`, was added for the release-one exclusions: across all seven routes and a palette open it asserts zero requests outside the local origin, zero webfonts, zero `<img>`/media/iframe, no external anchors, no service-worker registrations, no cookies, only `pet-health.*` localStorage keys and only the `pet-health` IndexedDB. Product code was frozen; only tests/docs changed for this gate.

## 2 · Full gate (final tree)

| Step | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | **PASS** | lockfile up to date; 524 entries pass the supply-chain policy |
| `pnpm typecheck` | **PASS** | 0 errors |
| `pnpm lint` (`oxlint`) | **PASS** | 0 warnings, 0 errors |
| `pnpm format:check` (`oxfmt`) | **PASS** | all files formatted |
| `pnpm exec vitest run` | **PASS** | **57 files / 405 tests** |
| `pnpm build` (`tsc -b && vite build && node scripts/check-size.mjs`) | **PASS** | size gate green — §3 |
| `pnpm e2e` (Chromium, all specs) | **PASS** | **62/62**, zero console/page errors, 0 skipped |

## 3 · Size gate (gzip)

| Budget | Measured | Limit | Result |
| --- | --- | --- | --- |
| First load (shell + `/`) | **174.4 kB** | 200.0 kB | PASS |
| Largest lazy chunk (`write-helpers`, zod/write graph) | 24.3 kB | 90.0 kB | PASS |
| `/pets` | 13.4 kB | 90.0 kB | PASS |
| `/pets/:petId/:tab?` | 6.9 kB | 90.0 kB | PASS |
| `/profile` | 6.9 kB | 90.0 kB | PASS |
| `/journal` | 4.9 kB | 90.0 kB | PASS |
| `/records` | 3.3 kB | 90.0 kB | PASS |
| `/appointments` | 2.9 kB | 90.0 kB | PASS |
| `/vaccinations` | 2.2 kB | 90.0 kB | PASS |
| Calendar chunk | 20.1 kB | 45.0 kB | PASS |
| Palette / shortcut-sheet chunks | 3.6 / 1.0 kB | 90.0 kB | PASS |
| Initial CSS | **15.4 kB** | 35.0 kB | PASS |
| Eager-shell content scan (table/calendar/palette/chart/motion) | no matches | none | PASS |

## 4 · Performance (final tree)

| Metric | Measured | Budget | Result |
| --- | --- | --- | --- |
| LCP | **28 ms** | ≤ 1,500 ms | PASS |
| DOM nodes (dashboard with data) | **278** | ≤ 1,200 | PASS |
| Route swap, max of five destinations | **9.2 ms** | ≤ 100 ms | PASS |
| Long tasks > 50 ms | **none** | none | PASS |

## 5 · E2E suite (62 tests, 12 specs)

`dashboard` 9 · `pets` 6 · `schedule` 10 · `journal` 7 · `preferences` 10 · `resize` 4 · `reduced-motion` 3 ·
`two-tab` 1 · `perf` 2 · `shell` 8 · `shots` 1 · `no-network` 1.

## 6 · What to fix

**No failed item.** No skipped test, no console error, no budget breach, and the three post-M5 defects are
visually verified fixed. Any remaining polish is recorded as “known limitations/nits” in
[`ACCEPTANCE.md`](./ACCEPTANCE.md); none blocks release one.
