# 01 · Stack, scaffold and tooling — decision log

| | |
| --- | --- |
| Status | Decided by stack-planner (t1), 2026-11-25, for captain review — planning only, nothing scaffolded or installed |
| Sources read | `Pet Health Tracker/README.md`, `AGENTS.md`, `db/schema.sql`; `02-parity-and-data.md`, `03-ia-layout-motion.md`, `04-components-and-tokens.md` |
| Decides | template + TypeScript, lint/format, router, styling, Magic UI intake, state, persistence call, ids/keys, testing, perf budget, static/offline delivery |
| Does not decide | information architecture (03), component shortlist (04), desktop features (05), milestone sequence (06) |

`02-parity-and-data.md` asks 01 to confirm Dexie+IndexedDB, the id scheme and the date helper — answered in **D6**, **D6a** and **§5**; 03/04 are aligned in §5.

## 0 · Locked by the user — recorded, not re-opened

| Decision | Value |
| --- | --- |
| Framework | **Vite + React Router**, not Next.js (kept as rejected in §4) |
| Location | **`pet-health-react/`** — a sibling of `Pet Health Tracker/`, never inside it |
| UI | shadcn/ui + Magic UI (user verified both work on this machine) |
| Verified toolchain | Node **v24.20.0**, pnpm **12.21.0** (`pnpm -v` this session) |
| Parity contract | Flutter `lib/domain/` rules + `db/schema.sql` invariants — not the Flutter widgets |
## 1 · Decision log
### D1 · Vite template and TypeScript strictness
**Options:** `react-ts` (Vite 8, React 19.3, TS 7, oxlint) · plain `react` JS template · the `shadcn init -t vite` one-shot scaffold.
**Choice:** `--template react-ts`. Keep its toolchain — **oxlint** for lint — and add **oxfmt** for formatting (it sorts imports *and* Tailwind classes, so no ESLint/Prettier). Make strictness explicit in `tsconfig.app.json`: `"strict": true` (TS 6+ already defaults it), `noUncheckedIndexedAccess`, `noImplicitOverride`; leave `exactOptionalPropertyTypes` off (it fights Radix/shadcn optional-prop spreads). `build` stays `tsc -b && vite build`, so a type error fails the build.
**Reason:** smallest current official template; oxlint `no-restricted-imports` overrides can enforce 02's layer rules (only `data/` imports Dexie; `domain/` imports neither React nor the DB) without an ESLint install.
**Risk:** TS 7.0 is young (2026-07) and `@types` packages can lag; if `tsc -b` breaks on a dependency, pin `typescript@~6.0` — no app-code change. Template versions will move: trust `pnpm-lock.yaml`, not this doc.
### D2 · Router wiring for a persistent sidebar shell
**Superseded by 06:** React Router 8.5.3 (see 06).
**Options:** React Router **data router** (`createBrowserRouter` + `RouterProvider`, `react-router@^7.18`) · declarative `<BrowserRouter><Routes>` · framework mode (`@react-router/dev`).
**Choice:** data router. Route tree (03 §2's canonical set; the shell layout stands):
```
/                    AppShell — sidebar 240 px expanded / 72 px rail; <Outlet/>; root loader awaits DB open
├── /                dashboard · first run renders a full-window takeover in the shell, not a route (03 §2)
├── /pets            lazy · sortable household table
├── /pets/:petId/:tab?  lazy · overview + deep-linkable tabs + context rail
├── /appointments    lazy · table + month calendar; ?view&status&pet&date
├── /vaccinations    lazy · read view over doses
├── /records         lazy · notes list with row correction
├── /journal         lazy
├── /profile         lazy · owner, pets, preferences, data
└── *                lazy NotFound
```
**Reason:** the layout route keeps the shell mounted while destinations swap; route `lazy` is the code-split boundary D8 budgets; `HydrateFallback` + `errorElement` cover DB open and a failed chunk; filters live in search params (`?pet=…`) so back/forward works where Flutter kept hidden tab state. Loaders handle **prerequisites only** (DB open, 404 checks); live lists use Dexie `useLiveQuery` (D5), so a write on any surface refreshes every mounted surface (02 R10).
**Risk:** data-mode loaders are one extra concept — confine them to the root DB gate and ownership checks, never data reads, or they will fight live queries. Per-tab scroll positions are not restored; add `<ScrollRestoration/>` only if review asks. 02 R10's `null` (= "clear the filter") cannot be expressed by an absent URL param, so 03 should give it a sentinel such as `?pet=all`; `undefined` means no request. Paths are 03 §2's canonical set; 04's `/dashboard`/`/welcome` mentions are stale aliases (root `/` is the dashboard and first run is a shell mode).
### D3 · Styling pipeline (Tailwind v4 + shadcn CSS variables)
**Options:** Tailwind v4.3 via `@tailwindcss/vite` (CSS-first) · Tailwind v3 + PostCSS config · CSS-in-JS.
**Choice:** `@tailwindcss/vite` + `@import "tailwindcss";` in `src/index.css`, with every design token in `src/styles/tokens.css` (04 §1.1); **no `tailwind.config.js`, no PostCSS file** (v4 is CSS-first). `shadcn init` owns `components.json`, `src/lib/utils.ts` and the `shadcn/tailwind.css` + `tw-animate-css` imports; base library **radix**, preset **nova** → `style: "radix-nova"` (current CLI naming; 04 §0's `new-york-v4` label is stale — tokens are overridden anyway).
**The `@/` alias is mandatory and must exist before `init`:** `baseUrl` + `paths` in **both** `tsconfig.json` and `tsconfig.app.json`; `resolve.alias` in `vite.config.ts` (`path.resolve(__dirname, "./src")`; `@types/node` already ships in the template); `init` writes the matching `components.json` aliases (`components`, `ui`, `lib`, `hooks`, `utils`) and fails if they do not resolve.
**Theme:** map Flutter tokens (`AppColors`/`AppRadii` in `AGENTS.md`) onto shadcn variables in `src/styles/tokens.css` — paper `#FAF8F5` → `--background`, ink → `--foreground`, accent `#0E6B5F` → `--primary`, hairline → `--border`, plus `--status-overdue|due-soon|up-to-date`; no hex outside that file; light-only v1.
**Risk:** shadcn components are copied source, not a pinned dependency — record the CLI version (4.23.0 today) and re-add deliberately; never `add --overwrite` blind.
### D4 · Magic UI as a shadcn registry
**Options:** registry CLI · manual copy-paste · npm package (none published).
**Choice:** registry CLI. `@magicui` is in shadcn's public registry index, so first use auto-writes `"@magicui": "https://magicui.design/r/{name}"` into `components.json`:
```bash
pnpm dlx shadcn@latest view @magicui/number-ticker   # inspect deps + files first
pnpm dlx shadcn@latest add  @magicui/number-ticker   # CLI writes components/ui/<name>.tsx, installs motion
# move it to components/ui/magicui/ (04 folder contract) and fix its one @/lib/utils import
```
**Rule — shortlist only:** 04's whitelist is **Number Ticker, Animated List, Shine Border, Dot Pattern** (Blur Fade is rejected there — animated `filter: blur`); an add needs that entry plus its screen, no `--all`, and the shell layout may not import Magic UI unless it sits inside the D8 initial budget. Vendored files are committed, so the registry can never change our build silently.
**Risk:** registry items add real dependencies (`motion`, shared by Number Ticker/Animated List) and animated components inflate a route chunk; the size gate is the backstop — remove a component rather than micro-optimize it.
### D5 · State
**What each is actually for here:** **TanStack Query** caches server state (network dedupe, retries, background refetch) — there is no server, and caching a local DB creates a second source of truth. **Zustand** is a small store for cross-cutting client state, not a data layer. **React context + hooks** is dependency injection (db, repositories, settings) plus per-feature state.
**Choice:** context + hooks only. Reads: Dexie `useLiveQuery` (`dexie-react-hooks`) — reactive across writes *and* tabs, which is 02 R10's "one write path, every surface refreshes". Writes: one repository module per entity → IndexedDB transaction; the live query re-renders. Settings: a tiny external store (`useSyncExternalStore`) persisted as JSON, mirroring Flutter's `settings.json`. Ephemeral UI state stays local or in the URL; no Redux/Query/Zustand.
**Reason:** live queries delete the manual revision-counter bug class (A1/F1/F2) instead of re-porting it, and the state layer is two small deps, not a framework.
**Risk:** every `useLiveQuery` is a subscription — keep queries coarse and backed by 02 §4's indexes, or a screen re-renders too often. Cross-tab propagation must be proven in the M1 spike (two tabs, one write); if Dexie's broadcast does not fire, add one `BroadcastChannel("pet-health")` ping on commit.
### D6 · Persistence — Dexie 4 over IndexedDB (the stack call 02 asked for)
**Options:** Dexie 4 / IndexedDB · SQLite-WASM (`@sqlite.org/sqlite-wasm` or `sql.js`, over OPFS or snapshot-to-IndexedDB) · a small JSON store.
**Choice: adopt Dexie 4 over IndexedDB.** 02 §4 evaluates the candidates and recommends it; the captain delegated the final call, so this is the decision, not a hand-off. SQLite-WASM remains only 02's documented fallback seam behind `src/data/db.ts` — not a parallel implementation. Trade-offs reviewed:

| Candidate | Shape | Cost on a school laptop | Parity / schema cost |
| --- | --- | --- | --- |
| **Dexie 4 / IndexedDB** *(chosen)* | typed object store, `version().upgrade()` migrations, `liveQuery` | ~25–30 kB gzip, no wasm, instant open; IndexedDB is universal; multi-tab safe | CHECKs/triggers move to app code (Zod + repository surface) and tests |
| SQLite-WASM over OPFS / memory | 858 KB wasm (~330 KB gzip) + worker; `sql.js` exports the whole DB per save | ≈100–300 ms cold start (measure in M1); OPFS: Chrome 86+/Safari 15.2+/Firefox 111+ (sync handles in workers Chrome 102+); **OPFS handles are single-tab** | best: `db/schema.sql` CHECKs/triggers reused verbatim |
| JSON store | one document in localStorage or an IndexedDB blob | ~0 deps; localStorage 5 MB synchronous ceiling | no transactions/indexes, corruption window — **settings only** |

**Reason:** multi-tab safety is decisive for a desktop app that gets opened twice — IndexedDB serialises transactions and `liveQuery` broadcasts writes, while both SQLite options push cross-tab locking onto us (`sql.js` rewrites the whole file; OPFS sync handles are exclusive). Second, "light and smooth" argues against 858 KB of wasm + worker cold start for a household notebook. Third, `liveQuery` removes 02 R10's write-refresh bug class instead of re-porting it. **`zod` 4.6 is added** as the CHECK-constraint replacement (one validation lib, no wasm).
**Risk:** no engine-enforced constraints — mitigate exactly as 02 §4 risks 1–5 (one repository per entity, Zod schemas, repository export-surface test, compound indexes, migration fixtures). If M1 finds IndexedDB unavailable or locked down, fall back to the OPFS path, never to localStorage.
### D6a · Identity and keys (confirms 02 §6)
**Question:** do UUID user ids plus literal `demo-*` demo ids work for Dexie keys, multi-tab writes and `/pets/:petId`, and can `createdAt` replace the old `id` tie-break?
**Choice — confirmed, with one addition.** Our stores use string keys, so UUIDs and `demo-pet-bella` are one key type: no reserved-range hack, and no numeric `++id` (numbers and literal ids cannot share a key path at all). Multi-tab writes stay per-record last-write-wins; UUIDs are minted client-side so two tabs cannot allocate the same id, unlike autoincrement. `/pets/<uuid>` and `/pets/demo-pet-bella` are URL-safe, and `{ petId: string | null }` becomes the hand-off/search-param payload unchanged in shape. **Tie-break:** `createdAt` (ISO ms) is fine as the vaccination ordering key, but append `id` as the final deterministic tie-break and give seeded demo rows distinct, monotonic `createdAt` values — otherwise two same-millisecond doses make tests order-dependent. Migration cost is zero (initial schema); the only alternative (numeric ids + reserved demo range) is explicitly forbidden by 02.
### D7 · Testing
**Options:** Vitest + Testing Library (unit/component) + Playwright (shell smoke) with Storybook · Jest + Cypress alternates.
**Choice:** Vitest 5 (`jsdom` + Testing Library + jest-dom + user-event, `fake-indexeddb` for repository tests) and Playwright 1.65 **Chromium only**, four smoke checks: first run shows the takeover on `/`; every sidebar destination renders; create a journal entry, reload, still there; zero console errors. Playwright `webServer` runs `pnpm build && pnpm preview`. **Storybook: no.**
**Reason:** Vitest reuses Vite's config/aliases and the same tsconfig; Playwright exercises the real shell + IndexedDB, which jsdom cannot. Storybook earns nothing: primitives are vendored shadcn/Magic UI with upstream docs, we own <10 custom kit pieces, and it adds ~100 MB of dev deps, a second build and a maintenance surface — a dev-only `/gallery` route shows visual states instead.
**Risk:** no isolated visual regression and no WebKit/Firefox run; the school demo is one Chromium-family browser, and the gallery plus optional Playwright screenshots cover review. Revisit Storybook only if the custom kit passes ~15 components.
### D8 · Performance budget for "light and smooth"
Budgets are **gzip, measured on `dist/`**:

| Gate | Ceiling | Why |
| --- | --- | --- |
| eager shell + first route (React, router, Dexie, shell UI, Home) | **≤ 200 kB** | first paint is the app's feel; matches 04 §2.3 |
| each other lazy route chunk | **≤ 90 kB** | keeps navigation cheap; matches 04 §2.3 |
| CSS | **≤ 35 kB** | one Tailwind sheet, no component CSS |
| LCP on the school laptop via `vite preview` | ≤ 1.5 s | no wasm and no network — slower means our JS |
| route swap (sidebar click → painted) | ≤ 100 ms | "smooth" is measured, not asserted |

**Splitting:** shell eager; every destination and `/pets/:petId/*` lazy; table code only in table routes, calendar in its own chunk, `cmdk` palette on open, chart only if Insights is approved, `motion` + Magic UI after first paint (04 §2.1); if route swap exceeds 100 ms add a hover-`import()` prefetch on sidebar links (one handler), not a state library.
**Fonts:** system stack first (`--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`), **no webfont** in v1; if the style tile demands a display face, self-host one Fontsource variable subset, preloaded, `font-display: swap` — never a Google Fonts CDN on an offline school laptop.
**Animation:** CSS transitions + `tw-animate-css` for the shell, dialogs and sheets; **`motion` 14 only because Magic UI imports it** — no GSAP/React Spring; animate `transform`/`opacity` only and honour `prefers-reduced-motion`. CSS is free at runtime; motion costs ~20–50 kB gzip and must stay out of the initial chunk.
**Milestone gate:** `pnpm build && pnpm size`, where `scripts/check-size.mjs` gzips every `dist/assets/*.js|css`, prints the table and exits non-zero if first load > 200 kB or any lazy chunk > 90 kB (04 §2.3's numbers; a dependency-free script rather than `size-limit`). Run at **M2 (shell + Home)** and **M6 (freeze)**; put the first real numbers in the build plan.
### D9 · Running offline from a static build
**Choice:** build static, serve locally: `pnpm build && pnpm preview --port 4173` (plain `pnpm dlx serve dist` also works). Preview supplies SPA history fallback and correct MIME types and needs no network once installed — the school demo path.
**`file://` rejected:** Chrome blocks ES-module scripts and `fetch` from `file://` (opaque origin), so no `dist/index.html` double-click; `base: "./"` + hash routing cannot fix module/dynamic-import loading. Never promise it.
**If published** (GitHub Pages, like the Flutter app): `base: "/<repo>/"`, `basename: import.meta.env.BASE_URL` on the router, a `404.html` SPA fallback and a Pages workflow; no `vite-plugin-singlefile` (it destroys code splitting).
**Service worker — decided: not in v1.** For a static build served at school from `vite preview`, "offline after first load" is already true: the "first load" reads local disk, not the network, so a SW would cache what is already local. A SW only becomes necessary if the final deliverable is loaded once from a remote URL (GitHub Pages) and must reopen with Wi-Fi off; then add `vite-plugin-pwa` 2.x (`registerType: "autoUpdate"`, precache `dist`) in a later slice and test a true cold offline load — it needs https/localhost, never `file://`. It is a deferred option, not a permanent rejection.
**Origin note:** IndexedDB/OPFS are origin-scoped, so `localhost:5173` (dev) and `:4173` (preview) are different households. Document it, demo from one URL, and call `navigator.storage.persist()` on first boot so the browser is less likely to evict the household.

## 2 · Exact scaffold sequence (run in a later round — nothing here has been run)
```bash
# From the workspace root, a sibling of "Pet Health Tracker".
cd "/path/to/your/workspace"        # the folder that contains pet-health-react/

# 1. Vite template. pet-health-react/ already holds docs/plan/, and create-vite refuses a
#    non-empty dir — scaffold beside it and merge, keeping the plan docs intact.
pnpm create vite@latest pet-health-react-scaffold --template react-ts
rsync -a pet-health-react-scaffold/ pet-health-react/    # no --delete: docs/ stays
rm -rf pet-health-react-scaffold                         # verify the absolute path first
# package.json → "name": "pet-health-react"
cd pet-health-react && pnpm install

# 2. Tailwind v4 + the @/ alias (all three places, before shadcn init)
pnpm add tailwindcss @tailwindcss/vite
# src/index.css        → @import "tailwindcss" + import ./styles/tokens.css (04)
# vite.config.ts       → plugins: [react(), tailwindcss()]; resolve.alias "@" → ./src
# tsconfig.json + tsconfig.app.json → baseUrl "." + paths { "@/*": ["./src/*"] }
# tsconfig.app.json    → add "strict": true, "noUncheckedIndexedAccess": true, "noImplicitOverride": true

# 3. shadcn v4 init. Prompts: base library = radix, preset = nova, base color = neutral, CSS variables = yes.
pnpm dlx shadcn@latest init
# verify components.json: ui/lib/hooks/utils aliases, style radix-nova, tailwind.css = src/index.css, tailwind.config blank

# 4. One batch of primitives — no --all, no blocks. Later adds only via doc 04.
pnpm dlx shadcn@latest add button card badge input label textarea select dialog alert-dialog \
  dropdown-menu tabs separator switch tooltip skeleton sonner avatar sheet empty

# 5. Router, data, validation; table libs stay in lazy table routes (04 §2.1)
pnpm add react-router@^7 dexie dexie-react-hooks zod @tanstack/react-table @tanstack/react-virtual
# recharts only if 05 approves Insights — dynamic import, never in the shell

# 6. One Magic UI component, only after doc 04 approves it (example)
pnpm dlx shadcn@latest view @magicui/number-ticker
pnpm dlx shadcn@latest add  @magicui/number-ticker    # components/ui/number-ticker.tsx + motion; move to ui/magicui/

# 7. Tests and tooling (oxlint ships with the template); scripts: dev, build, preview, lint,
#    format/format:check, test, test:e2e (build + playwright), size (scripts/check-size.mjs)
pnpm add -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom fake-indexeddb @playwright/test oxfmt
pnpm exec playwright install chromium

# 8. First gate
pnpm build && pnpm size && pnpm test && pnpm test:e2e
```

## 3 · Proposed folder layout

```
pet-health-react/
├── docs/plan/                 # 01 stack, 02 parity/data, 03 IA, 04 components, 05 features, 06 build plan
├── public/                    # favicon + static images only
├── src/
│   ├── main.tsx               # createRoot + RouterProvider; the only eager route import
│   ├── app/                   # router.tsx, providers.tsx, error boundary
│   ├── components/
│   │   ├── ui/                # shadcn generated, owned source (CLI target)
│   │   │   └── magicui/       # shortlisted Magic UI only, read-only
│   │   ├── app/               # PetCard, DueBadge, EmptyState, ConfirmDialog, forms…
│   │   └── layout/            # AppShell, AppSidebar, AppHeader, CreateMenu, Toaster
│   ├── features/              # one folder per canonical route (03), each with a lazy route.tsx
│   ├── domain/                # models/ + rules/ (due status, appointment FSM, calendar, validation), pure TS
│   ├── data/                  # db.ts (Dexie), repositories/, schema/ (Zod), seed/ (demo-* ids), settings.ts
│   ├── lib/                   # dates.ts (local-day rules, Intl), format.ts, utils.ts (cn), hooks/
│   ├── index.css              # @import "tailwindcss" + imports tokens.css
│   └── styles/tokens.css      # Flutter tokens → shadcn variables (only file with hex)
├── e2e/shell.spec.ts  ·  scripts/check-size.mjs   # Playwright shell smoke · D8 gzip gate
├── components.json  vite.config.ts  vitest.config.ts  playwright.config.ts
└── tsconfig{,.app,.node}.json  .oxlintrc.json  .oxfmtrc.json
```

## 4 · Rejected options

| Option | Why rejected |
| --- | --- |
| **Next.js** | **User decision** — Vite + React Router instead. SSR/RSC/API routes are unused by a 100% client-side local app, dev needs a Node server, static export adds config for no gain. |
| React Router framework mode (`@react-router/dev`) | a route-module compiler/build layer around Vite for loaders data mode already gives us; no server to benefit. |
| Declarative `<Routes>` | no route objects → no per-route `lazy`, `HydrateFallback` or `errorElement`; shell-refresh logic becomes per-screen effects. |
| React Router 8 (8.5.3 is latest) | same APIs we use; a new major mid-conversion adds review surface for zero feature gain. Revisit after freeze. |
| ESLint + Prettier | oxlint + oxfmt cover rules, import order and Tailwind class order in two fast Rust binaries; no plugin matrix to maintain. |
| TanStack Query / Zustand / Redux | server cache / global store we do not need; context + Dexie live queries cover it (D5). |
| GSAP / React Spring / anime.js | `motion` already arrives with Magic UI; a second engine adds 30–60 kB for no design need. |
| Google Fonts / webfont CDN | offline school laptop (D8). |
| `file://` + `vite-plugin-singlefile` | browsers block module scripts on `file://`; single-file inlining kills route splitting (D9). |
| localStorage JSON as the main store | no transactions/indexes, 5 MB ceiling, corruption window — settings only (D6). |
| `shadcn init -t vite` one-shot scaffold | viable, but it picks a preset/theme and hides the alias/Tailwind edits we want reviewable; the manual path is documented and deterministic. |

## 5 · Hand-offs and open questions
- **02 parity/data — confirmed:** Dexie 4 + IndexedDB is decided here (D6); ids are `crypto.randomUUID()` strings for user rows and literal `demo-*` strings for demo rows (D6a); one `src/lib/dates.ts` does local `YYYY-MM-DD` day math and UTC ISO instants with `Intl` — no date library. 02's "ESLint restricted-import rule" ships as an **oxlint** `no-restricted-imports` override; no ESLint.
- **03 IA / 04 components — input:** route tree shape in D2 (the `?pet=all` sentinel for 02 R10); 03 §2 is authoritative for the canonical route set (root `/`, no `/welcome`; 04's `/dashboard` label is a stale alias) and the pathless-layout + lazy-children shape is unchanged. Magic UI whitelist (D4), tokens file `src/styles/tokens.css` (D3), 60 px list rhythm + status tokens (02 §6); its §0 `new-york-v4` style label should be updated to the preset style (`radix-nova`).
- **06 build plan — input:** D8's size gate is a milestone gate (M2 + freeze); M1 includes the two-tab live-query check and a cold-start measurement so persistence is evidence-backed. The gate is the dependency-free `scripts/check-size.mjs`; 04's `size-limit` mention is non-binding.
- **Open for captain:** (1) keep `react-router@^7` or adopt 8? (2) will the deliverable be hosted on GitHub Pages or run locally — hosting is the only trigger for the service worker (D9); (3) is Chromium-only Playwright acceptable for the school demo?
