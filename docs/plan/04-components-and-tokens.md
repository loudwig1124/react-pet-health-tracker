# 04 · Component system — design tokens, shadcn/ui + Magic UI, performance budget

**Status:** Draft for team review — planning only, no code, no scaffolding. **Owner:** component-planner (task t4).
**Consumes:** 02 (routes, flows, status palette, avatar contract) + 03's canonical surfaces (verbatim below); **feeds** 01 (bundler/lazy entries), 05 (shortcuts; Insights deferred to v1.1), 06 (budget gates).
**Stack assumption:** React 19 + Vite + React Router 7 + Tailwind v4.3 + shadcn base **radix** with preset `radix-nova` (01's call); if 01 differs, only the deferral mechanics change.

**Decisions in one line:** shadcn/ui is the base, Magic UI is a four-item garnish, zero webfonts, no chart code in release one, and every feed or table over ~50 rows is paged or virtualised. Bundle figures are min+gzip from bundlephobia (Nov 2026) for the whole package — worst case, since tree-shaking only improves them.

## 1. Design tokens

`src/styles/tokens.css` is the only file with a hex value; Tailwind v4 `@theme inline` exposes it as utilities and components use semantic classes (`bg-card`, `text-muted-foreground`, `border-border`) or the status classes. Two collisions to respect: Flutter **accent** (`#0E6B5F`) is the brand **primary**, not shadcn's `--accent` (a hover surface); Flutter **secondary** (`#6B6660`) is text, not shadcn's `--secondary` button.

### 1.1 Colour

| Token | Value | Flutter source | shadcn slot | Use |
| --- | --- | --- | --- | --- |
| `--paper` | `#FAF8F5` | paper | `--background` | App canvas, page background |
| `--surface` / `--paper-raised` | `#FFFFFF` / `#F5F1EB` (derived) | surface / — | `--card`, `--popover` / `--secondary`, `--muted` | Cards, panels, menus; secondary buttons, hover rows, empty fill |
| `--ink` | `#1B1A18` | ink | `--foreground`, `--card-foreground` | Primary text and icons |
| `--secondary-text` | `#6B6660` | secondary | `--muted-foreground` | Captions, meta, inactive icons |
| `--hairline` | `#ECE7E1` | hairline | `--border`, `--input` | 1 px outlines and separators |
| `--accent` | `#0E6B5F` | accent | `--primary`, `--ring`, `--sidebar-primary` | Primary buttons, links, focus ring |
| `--accent-soft` | `#E7F0EF` (10 % accent on white) | — | `--sidebar-accent`, selected row | Scheduled status, selected nav/row |
| `--status-overdue` / `--status-overdue-soft` | `#B3261E` / `#FCEBEA` | overdue / overdueSurface | `--destructive` | Text/icon on tinted chip, row or rail |
| `--status-due-soon` / `--status-due-soon-soft` | `#A16000` / `#FDF3E3` | dueSoon / dueSoonSurface | — | Text/icon on tinted chip, row or rail |
| `--status-up-to-date` / `--status-up-to-date-soft` | `#2F6B3F` / `#EAF3EC` | upToDate / upToDateSurface | — | Text/icon on tinted chip, row or rail |
| `--status-neutral` | `#6B6660` on `--paper` | neutralStatus | — | Cancelled, unknown |

Contrast (AA checked): ink/paper 16.4:1, secondary/paper 5.4:1, accent/white 6.4:1, overdue/soft 5.7:1, due-soon/soft **4.56:1** (passes normal text by 0.06 — always pair colour with an icon or the word), up-to-date 5.6:1. Light theme only in v1 (`color-scheme: light`); tokens are theme-ready if dark is requested later. Status is never colour-only (WCAG 1.4.1).

### 1.2 Radii, spacing, layout, density

| Radius token | Flutter (phone) | Desktop | Rationale |
| --- | --- | --- | --- |
| `--radius` (controls) | button/chip 16 @ 36–52 px | **10 px** on 36–40 px controls | Ratio carried, desktop density; shadcn derives sm/md/lg from this |
| `--radius-card` | card 20 | **16 px** | 20 reads bubbly at 1280 px; 16 keeps the soft edge |
| `--radius-panel` | sheet 28 | **20 px** | 28 belongs to a bottom-sheet grip; desktop dialogs/panels float |
| `--radius-chip` | chip 16 @ 36 px | **10 px** @ 26–28 px | Same shape family, not an accidental pill |
| `--radius-avatar`, focus ring | circle; — | circle (pet) / 999 px (owner); `--ring` 2 px, offset 2 px, radius + 2 | Matches 02's placeholder-avatar contract; visible on paper and accent |

Spacing stays 4-based: 2/4/8/12/16/24/32 px (Tailwind 0.5/1/2/3/4/6/8). Shell metrics follow 03: sidebar **240 px** expanded / **72 px** rail, header **64 px** (**56 px** < 1024), nav row **36 px** (32 compact), rail tiles 40 × 40, active tile accent-soft + 3 px accent pill; content max-width **1200 px** (dashboard, settings, journal) / **1440 px** (the four tables), centred, 65–75ch prose forms; page gutter **32 / 24 / 16 px** at ≥ 1440 / 1024–1439 / < 1024; section gap **24 px**, card padding **16 px**, card gap **16 px**.
Density (`/profile` → Preferences, persisted, data views only): table row **44 / 36 px**, journal feed **64 / 52 px**, form control **36 / 32 px**, sidebar row **36 / 32 px**, section header/card padding **28/16 → 24/12 px**; type size never changes. Buttons follow control height; icon buttons 40 × 40; WCAG 2.2 target ≥ 24 × 24.

### 1.3 Type scale and fonts

| Token | px / line | Weight | Tracking | Use | Flutter source |
| --- | --- | --- | --- | --- | --- |
| `display` | 36 / 42 | 700 | −0.02em | Dashboard greeting, Welcome title | 30 display |
| `title` | 24 / 30 | 600 | −0.01em | Page titles, pet name in header | 27 name |
| `heading` | 17 / 24 | 600 | 0 | Card and dialog titles | 22 title |
| `body` | 14 / 20 | 400 | 0 | Default UI text, form values | 15 body |
| `small` | 13 / 18 | 400 | 0 | Table cells, row meta | 15 body (desktop density) |
| `caption` | 12 / 16 | 400 | 0 | Timestamps, helper text | 12 caption |
| `overline` | 11 / 14 | 700 | +0.14em, uppercase | Section labels | 11 tracked caps |
| `stat` | 28 / 32 | 700 | −0.01em, tabular-nums | Dashboard aggregates | — |

**No webfont ships in v1 — 0 KB.** Stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (01's `--font-sans` plus fallbacks); on macOS/Windows this resolves to SF Pro and Segoe UI, both excellent UI faces, so hierarchy comes from size, weight and tracking instead of a download. The only upgrade worth considering is one self-hosted variable subset — Inter (≈34–45 KB woff2) for UI or Fraunces (≈30 KB) for `display` — and it does **not** earn its bytes before the JS budget is met; if ever added: preload, `font-display: swap`, size-adjust fallback. Numbers use `tabular-nums`.

### 1.4 Motion

`--dur-press` 90 ms, `--dur-fast` 120 ms (hover, tab crossfade, toast out), `--dur-dialog` 160 ms, `--dur-page-in` 200 ms / `--dur-out` 80 ms, `--dur-sheet` 240 ms, `--dur-detail` 320 ms / `--dur-back` 340 ms; sidebar track 180 ms with 80 ms labels; `--ease-standard` `cubic-bezier(.2, 0, 0, 1)`, `--ease-detail` `cubic-bezier(.33, 1, .68, 1)` for the pet push. Mechanism: CSS transitions + `tw-animate-css` for the shell, dialogs and sheets (01), `motion` only for the four Magic UI effects. List entry = 180 ms fade + 6 px rise, 24 ms stagger, ≤ 6 rows; skeleton 1.6 s opacity loop; toast 150 ms in; one choreography at a time with a 300 ms ceiling except the two page transitions (320/340). `prefers-reduced-motion` gives an instant or ≤ 80 ms opacity swap, no slides, scales or stagger, static skeletons and no smooth scrolling.

## 2. shadcn/ui mapping

Legend: **Base** = no package beyond `shadcn init` (`radix-ui`, cva, clsx, tailwind-merge, lucide-react); **+dep** = additional
package with its gzip cost. Shared registry items (Button, Separator, Tooltip) arrive with Sidebar/Command — never duplicate.

| Surface (03 canonical) | shadcn primitives | Extra deps | Notes |
| --- | --- | --- | --- |
| Shell — sidebar + sticky header | Sidebar (Provider, Menu, Group, Footer), Tooltip, Separator, Button, Avatar, DropdownMenu, Kbd, Skeleton, Input (search trigger) | none | 240/72 px; groups OVERVIEW / HOUSEHOLD / SYSTEM; header = page title + ⌘K + contextual primary action |
| Shell — sidebar | `Sidebar` (icon items, 36 px rows, badges, rail + Tooltip), `Avatar` for the pinned Profile row, Lucide icons (`LayoutDashboard`, `PawPrint`, `CalendarDays`, `Syringe`, `FileHeart`, `NotebookPen`) with CSS hover motion | CSS only | Greeting, summary chips, pets grid, Needs-attention rail, Quick log, next visit, recent journal (3–6 rows by breakpoint + "View all → /journal") |
| `/pets` | Data Table, Input, Badge, Button, DropdownMenu, Empty, Dialog | table | Sortable household pets; row opens `/pets/:id/overview` |
| `/pets/:petId/:tab?` | Tabs (path-addressable), Card, Table, Badge, Button, Dialog, Sheet (row details), Empty, Tooltip | none | Three columns ABOUT / tab panel / context rail; tabs overview · vaccinations · records · appointments · journal |
| `/appointments` | Tabs (Upcoming/Past) + ToggleGroup (table/calendar), Data Table, Calendar, Badge, DropdownMenu, Dialog, AlertDialog, Field/Input, Tooltip, Empty | table + day-picker | `?view&status&pet&date` deep-linkable; Calendar split into its own chunk |
| `/vaccinations` | Data Table, ToggleGroup filters, Badge, Button, Dialog, Empty | table | Household-wide doses; filter status / pet / vaccine |
| `/records` | Table or Card rows, Input search, Badge, Empty, Button | none | Read-only append-only notes; no edit/delete affordances |
| `/journal` | Input, Combobox, ToggleGroup, Card rows, Field, Sheet (< 1280), Animated List, DropdownMenu, Empty | cmdk | Three columns: filters · day-grouped feed · inline editor at ≥ 1280 |
| `/profile` | Card, Field, Input, NativeSelect, Switch, ToggleGroup (density), Button, AlertDialog, Avatar | none | Anchors: owner, pets, preferences, data, about; density affects tables/feeds only |
| Welcome — mode of `/`, no route | Card, Field, Input, Button, Empty, Dot Pattern | none | Full-window takeover with sidebar and header hidden; three steps; reset-household returns here |
| Overlays | Command (⌘K), Dialog, Sheet, AlertDialog, Sonner, Tooltip, Popover | cmdk, sonner | Forms = Dialog; row actions/details = Sheet; toasts with 3 s Undo |

**Form / Field / Input** appear in every Dialog: `Field` + `Input`/`Textarea` by default, `Switch` for booleans, `NativeSelect` for enums, `Form` (react-hook-form + zod) only as the optional upgrade in the ledger.

### 2.1 Primitive ledger

| Item | Status | Bundle cost (gzip) | Loading rule |
| --- | --- | --- | --- |
| Button, Card, Badge, Input, Textarea, Label, Field, Tabs, Dialog, AlertDialog, Sheet, DropdownMenu, Tooltip, Popover, Switch, Avatar, Skeleton, Kbd, Spinner, Empty, Table, Separator, Sidebar, ToggleGroup, NativeSelect, Lucide icons | **Base** | `radix-ui` base ≈ **55–70 kB** shared (dialog 13.2, dropdown 30.3, tooltip 19.3, popover 23.5, tabs 8.9, switch 4.7 measured singly; shared deps dedupe); utils ≈ 10.6; icons ≈ 0.6 each (cap ~40) | Shell; Sidebar pulls Button/Separator/Sheet/Tooltip/Input/Skeleton |
| Data Table (`/pets`, `/appointments`, `/vaccinations`) | +dep | @tanstack/react-table **31.6** (+ react-virtual ≈4) | Lazy route chunks; virtualise past 50 rows |
| Command / Combobox | +dep | cmdk **16.7** | Lazy; palette mounts only when opened |
| Calendar / Date Picker | +dep | react-day-picker **19.8** + date-fns 8–17.5 (tree-shaken) | Lazy; date fields and `/appointments?view=calendar` |
| Sonner | +dep | sonner **9.4** (+ drop next-themes ≈1.5) | Shell; hardcode `theme="light"` |
| Form | +dep | react-hook-form 16.4 + resolvers ≈2 + zod 17–89 | Deferred; `Field` covers v1 |
| Magic UI | +dep | motion **≈20–50** gzip (package 64) | Deferred chunk after first paint |

The shell + `/` route stays **≤ 200 kB gzip** because table, calendar, palette and motion are all deferred. A shadcn component is copied source, not a dependency: an unused primitive costs nothing, so delete what we never import. Chart + recharts (177 kB) is the documented v1.1 option only — 05 rejects it for release one, so no release-one surface imports it (the budget table keeps its 220 kB gate for the day F11 returns).

### 2.2 Choices that carry the "light" requirement

- **Forms are Dialog, details are Sheet.** 03 fixes forms as dialogs; Sheet covers row actions/details and the journal editor below 1280 px. No bottom sheets.
- **Tables only where 03 asks for them** (`/pets`, `/appointments`, `/vaccinations`; `/records` is a read-only list); feeds stay card rows. Sorting/filtering is TanStack Table in the route chunk, not a global table abstraction.
- **NativeSelect for the settings enums, Field + controlled state before Form.** Radix Select costs 30.4 kB for four fixed options; native select is 0 kB, keyboard-native and accessible. RHF + zod (~35–107 kB) waits until a form outgrows 3–7 fields with cross-field logic.
- **Calendar is the one date-picker luxury**, lazy and confined to dialogs and the calendar view; native `<input type="date">` is the zero-byte fallback if the chunk budget fails.

## 3. Magic UI shortlist (4 components)

Magic UI is garnish: four effects, each with a fallback that removes the dependency without a redesign. Every effect is disabled under `prefers-reduced-motion`.

| Component | Where it is used | Why it earns its place | Dependency cost | Fallback if dropped |
| --- | --- | --- | --- | --- |
| **Number Ticker** | Dashboard stat strip only — pets, upcoming visits, due-soon (≤ 4 numbers) | Count-up confirms recalculation after a write; mounts once, no layout shift with tabular-nums | motion (shared, 0 incremental) | Static number or CSS `@property` counter |
| **Animated List** | `/journal` feed when **one** row is appended (the dashboard recent list uses 03's 180 ms fade + 6 px rise spec instead) | Moving data is the app's feedback loop; one-item enter confirms the write without choreographing the page | motion (shared) | CSS `fade-rise` keyframe, 0 kB |
| **Shine Border** | One instance: the next-visit card when a visit is ≤ 7 days away | Makes the single most urgent item findable at a glance; pure CSS conic gradient, no JS, paused for reduced motion | **0** (CSS only) | Accent hairline + "Next up" Badge |
| **Dot Pattern** | Welcome panel and empty-state backdrop (static) | Paper texture that matches the brand; static SVG, no animation loop, no runtime | **0** | Flat `--paper` |

**Rejected, with reasons:** **Blur Fade** animates `filter: blur` on entry — it violates the no-animated-filter guard and is
expensive on integrated GPUs; use the CSS fade-rise instead. **Meteors** is continuous motion plus a night-sky motif that
clashes with warm paper. **Particles** animates hundreds of nodes for zero information. **Globe** needs `cobe` + WebGL and means
nothing here. **Retro Grid** is neon-retro and infinitely animated. **Dock** duplicates the sidebar and imports a macOS metaphor.
**Marquee** moves text and hurts readability. **Magic Card / 3D tilt** repaints on every mousemove for a gimmick. **Progressive
Blur** stacks backdrop-filter layers on scrolling surfaces; a static gradient mask gives the same edge for free. **Border Beam /
Animated Beam** are Shine Border's busier siblings — one accent effect is enough.

## 4. Component folder contract

```text
src/
  components/
    ui/              # shadcn generated, owned source (kebab-case). CLI target.
      magicui/       # Magic UI registry components; vendored, treated as read-only
    app/             # product components (PascalCase): PetCard PetAvatar DueBadge
                     # AppointmentStatusBadge AppointmentRow JournalRow StatCard
                     # EmptyState ConfirmDialog PetChooserDialog DateField SectionLabel
    layout/          # AppShell AppSidebar AppHeader CreateMenu Toaster
  features/          # routes + hooks/queries (DashboardPage, PetsPage, PetPage, ...)
  lib/               # tokens.css, format, domain rules, data access
```

| Layer | May import | Must not import |
| --- | --- | --- |
| `components/ui/**` | `lib/utils`, radix-ui, cva, tokens | `app/`, `layout/`, `features/`, domain, data |
| `components/ui/magicui/**` | motion, `lib/utils` | `app/`, `features/`, domain, data |
| `components/app/**` | `ui/**` (compose only), `lib/format`, domain **types** | `features/`, data access, direct radix/cmdk/sonner/recharts |
| `components/layout/**` | `app/**`, shell primitives from `ui/**` | feature internals, data access |
| `features/**` (pages) | `app/**`, `layout/**`, domain, data hooks | **`components/ui/**` directly**, radix/cmdk/motion/recharts |

**The rule:** shadcn primitives are imported only inside `components/` — no page or feature imports one directly, and
`components/app` never imports a raw primitive package (`radix-ui`, `cmdk`, `sonner`, `react-day-picker`, `recharts`, `motion`);
it composes the wrapper from `ui/` and adds product semantics (status colours, the pet placeholder, formatting), so it is not a
pass-through layer. Enforced by oxlint's restricted-import rules plus a folder README; `ui/` and `magicui/` stay domain- and
feature-free. Naming: `ui/` kebab-case (generated), `app/` and `layout/` PascalCase; Magic UI is wrapped, never forked. `PetAvatar`
is 02's placeholder contract: species-aware paw icon + pet initial on a deterministic tint from the four soft tokens (never a
random hue) — no photos, no image loading, no CLS.

## 5. Performance guards

| Never ship | Why | Instead |
| --- | --- | --- |
| Animated layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`) or `transition: all` | Forces layout every frame; the classic jank source | Transform + opacity only; the sidebar grid track is 03's one width exception |
| Animated `filter` / `backdrop-filter` (Blur Fade, frosted sticky header, progressive blur) | Paint + composite per frame on weak GPUs | Static gradient mask or solid tint |
| Unbounded lists — journal history, past appointments, vaccinations | DOM growth and slow mount | Virtualise past **50** rows (`@tanstack/react-virtual`) or "Load older"; the dashboard recent list caps by breakpoint (3–6, 03) + "View all" |
| Images without intrinsic dimensions, or raw originals | CLS and decode jank; v1 has no photos, but illustrations must declare width/height/aspect-ratio | Explicit `width`/`height`, `loading="lazy"`; future photos ≤ 1024 px WebP + revoked blob URLs |
| Continuous decoration plus per-row tickers, `layout` animation on > 20 rows, scroll parallax, rAF loops | Constant CPU/GPU, re-render/reflow storms, motion sickness | Static Dot Pattern, one Shine Border, ticker on ≤ 4 aggregates, observer reveals capped at 6 |
| Chart, Calendar, table or Command code in the initial chunk, or un-lazy-loaded on its route | 177 + 20 + 31.6 + 16.7 kB gzip | Lazy chunks: chart on Insights only, calendar from date fields, table in its route, palette on open |
| Root context holding search/form state; unkeyed lists; animated `box-shadow`; icon fonts; multiple webfonts | Whole-tree re-renders, paint cost and bytes | Local state, memoised rows, stable keys, hairline borders, one system stack |

**Budget the build plan (06) must enforce:**

| Metric | Budget | Gate |
| --- | --- | --- |
| Initial JS (shell + `/`, excluding deferred chunks) | **≤ 200 kB gzip** (01 D8 gate) | `pnpm size` (01's `check-size.mjs`) |
| Each lazy route chunk | ≤ 90 kB gzip | `pnpm size` |
| Lazy calendar chunk (appointments view + date fields) | ≤ 45 kB gzip | `pnpm size` |
| Conditional Chart chunk | ≤ 220 kB gzip, Insights route only | `pnpm size` + import check |
| CSS / webfonts | ≤ **35 kB** gzip / **0 KB** | `pnpm size` + review checklist |
| LCP / INP / CLS | ≤ 1.5 s / ≤ 200 ms / ≤ 0.05 | `vite preview` LCP + Lighthouse |
| Initial DOM / frame work | ≤ 1,200 nodes; route swap ≤ 100 ms; no long task > 50 ms during nav or scroll; 60 fps | Playwright count + Performance panel |
| Animation caps | 80–240 ms (page pushes 320/340), stagger 24 ms, ≤ 6 rows, reduced-motion honoured | Code review + Playwright `reduce` pass |

Verification for the build phase: `pnpm build && pnpm size`, LCP measured on `vite preview` at ≤ 1.5 s, Playwright smoke on all routes with `prefers-reduced-motion: reduce`, and a bundle-visualizer review before each milestone gate.
Budgets are gates, not aspirations: a PR that breaks one is reverted or the effect is dropped.

## 6. Hand-offs

- **01 stack:** the §5 budget matches 01 D8 (200 kB shell / 90 kB route / 35 kB CSS / 1.5 s LCP) — D8's "04 §2.3" pointer now resolves here; expose the lazy entries above.
- **03 IA:** this mapping follows your canonical routes and surfaces; your call still decides the pet-detail context rail's content. The calendar is the `?view=calendar` surface, reusing the same date picker inside dialog fields.
- **05 features:** 05 defers Insights (F11) to v1.1 and rejects the chart for release one, so the `/insights` surface and Chart/recharts are out of the release-one map; ⌘K is the home for its shortcuts and the quick-log "details" affordance needs no new primitive.
- **06 build plan:** import the budget table as milestone gates and the "never ship" table as review criteria.
- **Open questions:** dark mode — propose light-only in v1; brand webfont — propose none; illustration assets must arrive with fixed dimensions.

## 3b. Full-registry survey (what else is worth taking)

I read every entry in the Magic UI registry (260 items, demos included) and shadcn's component index.
**Approved by the user (2026-11-25):** Progressive Blur, Scroll Progress, Glare Hover. **Rejected:** Confetti.

Additions that earn their place in a light app:

| Component | Where | Cost | Why |
| --- | --- | --- | --- |
| **Progressive Blur** (Magic UI) | Sticky header edge and the bottom of long lists | 0 JS, CSS mask only | Removes the hard cut when content scrolls under the header, without a backdrop-filter |
| **Scroll Progress** (Magic UI) | Journal and Vaccinations lists | ~0.5 kB, shares `motion` | Tells you how far through a long day you are; a hairline, not a bar |
| **Glare Hover** (chosen over Magic Card) | The four dashboard stat cards | **0 JS**, CSS only | A pointer-follow highlight makes the counters feel alive without anything running at rest. Magic Card was rejected as the heavier of the two for the same job |
| ~~Confetti~~ | — | — | **Rejected by the user (2026-11-25)** — decoration without information; the app should feel calm, not celebratory |

Everything else in both catalogues is rejected for this app, with the reason that matters:
`dock` (a magnifying dock is a macOS launcher, not a persistent sidebar — and it needs `motion` on every hover),
`icon-cloud`, `orbiting-circles`, `avatar-circles` (decorative, not informative),
`border-beam`, `animated-beam`, `particles`, `meteors`, `retro-grid`, `warp-background`, `lens`, `globe`, `terminal`
(heavy or off-brand), `marquee`/`tweet-card`/`hero-video-dialog` (marketing components), `bento-grid`
(layout we already own), `typing-animation`/`text-animate` (a greeting that types itself is a gimmick on a
screen you see fifty times a day), `animated-theme-toggler` (dark mode is out of scope),
`file-tree` (we already have a table), `ripple-button`/`shimmer-button`/`rainbow-button` (the primary button
is already the accent colour; a second moving affordance competes with it).

**Icons.** Neither registry ships animated icons: shadcn uses **Lucide** (static SVGs) and Magic UI is
effects. So the sidebar gets Lucide icons with CSS-only motion — 70 % opacity at rest, 100 % and
`scale(1.06)` + 1 px lift on hover over 120 ms, `prefers-reduced-motion` removing the transform. No extra
dependency, no animated-icon package.
