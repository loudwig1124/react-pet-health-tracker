# E2E and gate harness

Chromium-only Playwright suite for the desktop Pet Health Tracker (01 D7, 06 §2/§5). It runs against
`vite preview` of the production build, so every spec proves the shipped bundle — not the dev server.

## Commands

```bash
# everything, including a fresh build + size gate
pnpm test:e2e

# just the suite against the current dist/ (build first if src changed)
GATE=m5 pnpm e2e

# one gate, with the 06 §5 command sequence and a saved log
GATE=m1 E2E_SPECS="e2e/shell.spec.ts e2e/reduced-motion.spec.ts" bash scripts/gate.sh

# one file / test
PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright test e2e/shell.spec.ts --workers=1
```

`GATE` names the screenshot prefix (`m1-1440-dashboard.png`, `m3-…`); without it the spec writes
`local-*` files so an ad-hoc run cannot overwrite gate evidence. `scripts/gate.sh` writes the full
command log to `docs/build/evidence/gate-<n>.log`; the reports in `docs/build/GATE-*.md` quote it. The
gate script also starts its **own preview server on `PW_PORT` (default 4273)** and sets
`PW_EXTERNAL_SERVER=1`: a concurrent `pnpm e2e` or a stale `vite preview` on 4173 must not kill the
gate mid-run, and a preview must never reuse an `index.html` cached before the build. Browsers live
inside the repo (`PLAYWRIGHT_BROWSERS_PATH=0`) because the sandbox cannot write the macOS cache;
`pnpm test:e2e` and `pnpm e2e` set the variable.

## Files

| File                     | Milestone  | What it proves                                                                                                              |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `support/app.ts`         | —          | navigation/readiness, no-sideways-overflow, local dates, raw IndexedDB fixture writes/reads, transform/opacity motion probe |
| `support/fixtures.ts`    | —          | auto **console-error guard**: any `console.error` or `pageerror` fails the test and attaches the text                       |
| `shell.spec.ts`          | M1         | boot at 1440/1024, deep links + reload, mouse nav, ⌘1–6/⌘B/⌘,, live resize, focus ring, `/settings` 404                     |
| `resize.spec.ts`         | M1 → M5    | live resize on dashboard / tables / journal / pet detail; rail, avatar-only footer, editor → Sheet, no overflow             |
| `reduced-motion.spec.ts` | M1 → M5    | `prefers-reduced-motion: reduce`: no transform/opacity motion > 80 ms, motion-only information parity                       |
| `perf.spec.ts`           | M5         | LCP ≤ 1.5 s, DOM ≤ 1,200, route swap ≤ 100 ms, no long task > 50 ms                                                         |
| `shots.spec.ts`          | every gate | real app at 1440 / 1024 / 72 px rail into `docs/build/shots/`                                                               |
| `pets.spec.ts`           | M2         | pet create → edit → delete, validation, records append-only, sort/filter survive reload                                     |
| `schedule.spec.ts`       | M3         | vaccination newest-dose clears overdue, booking + complete/cancel/no-show, URL state, calendar lazy chunk                   |
| `journal.spec.ts`        | M4         | journal create/edit/delete, undo window, day grouping, filters survive reload, editor mode                                  |
| `preferences.spec.ts`    | M4         | owner, due-soon window, kg↔lb, density, sample data toggle, reset + first run                                               |
| `two-tab.spec.ts`        | M4         | a write in one tab appears in a mounted list in the second tab without refresh                                              |
| `dashboard.spec.ts`      | M5         | counters vs rules, overdue drill-down, sidebar badges, ⌘K palette, ⌘N/?, shortcuts                                          |

## Conventions

- **Every spec starts from a fresh browser context** (Playwright default), so IndexedDB and
  localStorage are empty; seed through the UI, or with `writeStore()` only for states the UI cannot
  deterministically reach (for example a visit scheduled in the past). Raw writes must mirror
  `src/lib/db/db.ts`.
- **No `test.skip`/`fixme` without a written reason** in the same file. Prefer a failing assertion over
  a silent skip: a red gate is a finding, a skipped gate is a lie.
- **Selectors**: accessible roles and names first (`getByRole('button', { name: /add pet/i })`),
  `data-testid` for containers and rows. The stable hooks are requested from each milestone owner; if
  the UI has to change, change the selector in one place.
- **Time**: use `localDateISO(offsetDays)` / `minutesFromNow()` from `support/app.ts` — the app's rules
  are local-day (R4), so fixtures are local too.
- **Console errors are always failures.** If a spec legitimately triggers a browser warning that is an
  error-level message, fix the app; do not filter the listener.
- Resize tests assert `document.scrollWidth <= document.clientWidth` (never sideways scrolling at the
  1024 px desktop floor) but allow a table wrapper to scroll internally.
