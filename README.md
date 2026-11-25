# Pet Health Tracker — desktop (React)

A desktop rebuild of the Flutter Pet Health Tracker: an offline household notebook for one owner,
several pets, a shared journal, vet appointments, vaccinations and append-only clinical notes.
No accounts, no server, no network — everything lives in this browser's own storage.

The approved plan is in [`docs/plan/`](./docs/plan/); `00-PLAN.md` is the approval record and
`06-build-plan.md` is the milestone contract. **Release-one acceptance and the demo script live in
[`docs/build/ACCEPTANCE.md`](./docs/build/ACCEPTANCE.md)**; the milestone gate reports are
`docs/build/GATE-{1,3,5,6}.md`. This README is the working entry point for the build.

## Stack

| Concern     | Choice (installed)                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build       | Vite **8.3.8**, `@vitejs/plugin-react`, TypeScript **7.0.2** (`strict`, `noUncheckedIndexedAccess`)                                                                          |
| UI          | React **19.3.1**, React Router **8.5.3** (data router, lazy children)                                                                                                        |
| Styling     | Tailwind CSS **4.3.5** via `@tailwindcss/vite` (CSS-first, no config file)                                                                                                   |
| Components  | shadcn CLI **4.23.0**, base **radix**, preset **nova** (`style: "radix-nova"`), Lucide icons                                                                                 |
| Magic UI    | **Progressive Blur** vendored (`src/components/ui/magicui/`) for the sticky-header edge; the seven-component set is locked — the other six enter with their screens (see 06) |
| Data        | Dexie **4.4.7** + `dexie-react-hooks` over IndexedDB, Zod **4.6.7** mirrors of the DDL checks                                                                                |
| Tests       | Vitest **5.1.1** (node + jsdom projects), Testing Library, `fake-indexeddb`, Playwright **1.65.1** (Chromium only)                                                           |
| Lint/format | oxlint **1.95**, oxfmt **0.80** (sorts imports and Tailwind classes)                                                                                                         |

## Getting started (from a fresh clone)

**Prerequisites:** Node **22 or newer** (the build and tests run on 24), and **pnpm 10**
(`npm i -g pnpm@10`, or `corepack enable`).

```bash
git clone https://github.com/loudwig1124/pet-health-tracker-web.git
cd pet-health-tracker-web
pnpm install          # resolves the lockfile; no postinstall scripts run
pnpm dev              # http://127.0.0.1:5173
```

First launch shows the **Welcome** card: your name, your first pet, or one tap to load the sample
household. Nothing leaves the browser — no account, no server, no network calls.

**A hosted copy lives at <https://loudwig1124.github.io/pet-health-tracker-web/>** (same app, same
local-only storage, deployed by `.github/workflows/deploy-web.yml`).

> On the machine this was developed on, `~/Library/Caches` is read-only under a sandbox, so a local
> (gitignored) `.npmrc` points pnpm's store at `../.pnpm-store`. A fresh clone does not have that
> file and does not need it.

## Commands

Run everything from this directory.

```bash
pnpm install

pnpm dev            # Vite dev server on http://127.0.0.1:5173
pnpm typecheck      # tsc -b
pnpm lint           # oxlint (layer rules in .oxlintrc.json)
pnpm format         # oxfmt --write
pnpm format:check   # oxfmt --check
pnpm test           # vitest run (node rules/db + jsdom shell)
pnpm build          # tsc -b && vite build && node scripts/check-size.mjs
pnpm size           # re-run the gzip gate against dist/
pnpm preview         # static preview on http://127.0.0.1:4173
pnpm test:e2e       # pnpm build && Playwright Chromium smoke suite
```

**Playwright browsers live inside the repo** (the sandbox cannot write the macOS cache):

```bash
PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install chromium
pnpm test:e2e          # sets PLAYWRIGHT_BROWSERS_PATH=0 for the test process
```

`pnpm exec playwright test` on its own needs the same env var, or use `pnpm e2e`.

## Storage and demo data

- IndexedDB database `pet-health` (Dexie v1, seven stores). `navigator.storage.persist()` is
  requested at boot; a blocked/failed boot renders a blocking storage-failure screen with Retry.
- The vaccine catalog is **always** seeded. The demo household (`demo-*` ids, strictly increasing
  `createdAt`) seeds only when the persisted `sampleDataEnabled` setting is on — off by default.
- Settings are one JSON record in `localStorage` (`pet-health.settings.v1`), not a Dexie table.
- **Origins are separate households**: `:5173` (dev) and `:4173` (preview) each have their own
  IndexedDB + settings. Demo from one URL. Never use `file://` (module scripts are blocked).

## M1 layout (what exists now)

```
src/
├── main.tsx                     # createRoot + RouterProvider (the only eager route import)
├── app/
│   ├── router.tsx               # shell + lazy children, DB boot loader, handles, 404
│   ├── providers.tsx            # TooltipProvider (400 ms)
│   ├── hydrate-fallback.tsx     # first-paint skeleton matching the shell
│   └── error-boundary.tsx       # blocking storage-failure screen
├── components/
│   ├── layout/                  # AppShell, AppSidebar, AppHeader, PageSkeleton
│   └── ui/                      # owned shadcn source (button, avatar, tooltip, …)
│       └── magicui/             # Progressive Blur (static CSS stack)
├── lib/
│   ├── shell.ts                 # destinations, collapse rule (pure)
│   ├── hooks/                   # useSidebar, useOwner
│   ├── db/                      # db.ts, schema.ts, settings.ts, boot.ts,
│   │   ├── repositories/        #   one repository per entity + household
│   │   └── seed/                #   vaccine catalog (always) + demo household (opt-in)
│   └── rules/                   # pure R1–R10 rules (owned by rules-dev)
├── routes/                      # lazy placeholders for every destination until its milestone
└── styles/tokens.css            # the only file with hex values (04 §1)
```

The shell: 240 px sidebar / 72 px rail (forced below 1024, expandable on demand 1024–1279),
64/56 px sticky header, full-width content (one 24/16 px gutter, no centred cap), one scroll container,
the rail toggle in the sidebar's brand row, six destinations with
Lucide icons and a pinned Profile footer (avatar only in the rail). Settings lives inside Profile;
there is no `/settings` route. Route chunks are lazy; the size gate enforces the split.

## Size gate

`scripts/check-size.mjs` reads `dist/.vite/manifest.json`, sums gzip sizes and fails the build when:

- first load (entry + static imports + `/` route) > **200 kB**
- any lazy route chunk > **90 kB**
- initial CSS > **35 kB**
- the eager shell contains table/calendar/palette/chart/motion code markers

Current M1 numbers are printed by `pnpm build` (≈193 kB first load, ≈9 kB CSS, all route chunks
< 1 kB because they are placeholders).
