import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { Outlet, useLoaderData, useLocation, useMatches, useNavigate } from 'react-router'

import { useDesktopOverlays } from '@/app/desktop-overlays'
import {
  loadFirstRunSnapshot,
  shouldShowFirstRun,
  useFirstRunRequested,
  type FirstRunSnapshot,
} from '@/app/first-run-state'
import { AppProviders } from '@/app/providers'
import { useShellShortcuts } from '@/app/shell-shortcuts'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { applyDensity } from '@/lib/density'
import { useDensity } from '@/lib/hooks/useDensity'
import { useSidebarModel } from '@/lib/hooks/useSidebar'
import { routeHandleFrom, type RouteHandle } from '@/lib/shell'
import { cn } from '@/lib/utils'

const FALLBACK_HANDLE: RouteHandle = {
  title: 'Pet Health Tracker',
  description: 'An offline household notebook for pets.',
  maxWidth: 1200,
}

/** The takeover is only needed on a fresh/reset household: lazy, like a route. */
const FirstRunTakeover = lazy(() => import('@/app/first-run-takeover'))

/**
 * Toasts come from a tiny store, but the outlet is still split out of the eager
 * shell: the first-load gate counts this chunk's dependencies and the M4 gate
 * runs with only a few kB of headroom. The chunk is requested as soon as the
 * shell mounts, so a toast is never lost — this changes the budget line, not
 * the behaviour.
 */
const Toaster = lazy(() =>
  import('@/components/layout/Toaster').then((module) => ({ default: module.Toaster })),
)

/**
 * F3/F8 overlays: the shell only owns their open/closed state. The components
 * (palette, shortcut sheet) live in their own lazy chunks, mounted on demand by
 * the `pet-health:command-palette` / `pet-health:shortcut-sheet` events.
 */
const CommandPalette = lazy(() =>
  import('@/components/layout/CommandPalette').then((module) => ({
    default: module.CommandPalette,
  })),
)
const ShortcutSheet = lazy(() =>
  import('@/components/layout/ShortcutSheet').then((module) => ({
    default: module.ShortcutSheet,
  })),
)

/**
 * The shell (03 §1): fixed sidebar | content column. The content column is the
 * single scroll container, its header is sticky and opaque, and the content is
 * centred at 1200/1440 px depending on the matched route's handle. Route
 * children are lazy; only the shell is eager (D8).
 *
 * M4 adds three cross-cutting pieces here:
 * - the first-run **mode** (03 §5): no pets + an unnamed/reset household hides
 *   the sidebar and header and renders the takeover on any path;
 * - the density preference applied to `<html data-density>` (03 §6);
 * - the single toast outlet (3 s dwell, Undo).
 */
export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const matches = useMatches()
  const sidebar = useSidebarModel()
  const scrollRef = useRef<HTMLElement>(null)
  const density = useDensity()

  // The root loader has already opened the DB and read this snapshot, so the
  // first paint decides first-run vs shell without a flash; the live query then
  // keeps the gate honest through resets and writes (R10).
  const loadedSnapshot = useLoaderData() as FirstRunSnapshot | null
  const liveSnapshot = useLiveQuery(loadFirstRunSnapshot, [])
  const resetRequested = useFirstRunRequested()
  const snapshot = liveSnapshot ?? loadedSnapshot
  const firstRun =
    snapshot === null
      ? false
      : shouldShowFirstRun({
          hasPets: snapshot.hasPets,
          ownerName: snapshot.ownerName,
          resetRequested,
        })

  const handle = routeHandleFrom(matches) ?? FALLBACK_HANDLE
  const maxWidth = handle.maxWidth ?? 1200
  const widthClass =
    maxWidth === 1440 ? 'max-w-[var(--content-max-wide)]' : 'max-w-[var(--content-max-narrow)]'

  const overlays = useDesktopOverlays()

  useShellShortcuts({
    navigate: (path) => navigate(path),
    toggleSidebar: sidebar.toggle,
    sidebarForced: sidebar.forced,
    pathname: location.pathname,
  })

  // Density changes spacing only; the token overrides key off this attribute.
  useEffect(() => {
    applyDensity(density)
  }, [density])

  // Route change returns to the top of the one scroll container (03 §1).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  if (firstRun && snapshot !== null) {
    return (
      <AppProviders>
        <Suspense fallback={<FirstRunFallback />}>
          <FirstRunTakeover
            snapshot={snapshot}
            onComplete={() => {
              navigate('/')
            }}
          />
        </Suspense>
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      </AppProviders>
    )
  }

  return (
    <AppProviders>
      <div
        className="flex h-svh w-full overflow-hidden"
        data-testid="app-shell"
        data-sidebar-mode={sidebar.mode}
      >
        <AppSidebar open={sidebar.open} onToggle={sidebar.toggle} />
        <main
          ref={scrollRef}
          className="app-scroll relative h-svh min-w-0 flex-1"
          data-testid="app-scroll"
        >
          <AppHeader
            title={handle.title}
            description={handle.description}
            maxWidth={maxWidth}
            showToggle={!sidebar.forced}
            open={sidebar.open}
            onToggle={sidebar.toggle}
          />
          <div
            data-testid="app-content"
            className={cn(
              'mx-auto w-full min-w-0 shrink-0 px-[var(--page-gutter)] pt-6 pb-10',
              widthClass,
            )}
          >
            <div key={location.pathname} className="app-page">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
      {overlays.paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette
            initialSection={overlays.paletteSection}
            onClose={overlays.closePalette}
          />
        </Suspense>
      ) : null}
      {overlays.shortcutSheetOpen ? (
        <Suspense fallback={null}>
          <ShortcutSheet onClose={overlays.closeShortcutSheet} />
        </Suspense>
      ) : null}
    </AppProviders>
  )
}

function FirstRunFallback() {
  return (
    <main
      data-testid="first-run-loading"
      aria-busy="true"
      className="bg-background grid min-h-svh w-full place-items-center px-6 py-10"
    >
      <div className="border-border bg-card flex w-full max-w-5xl flex-col gap-4 rounded-2xl border p-8 shadow-sm">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-40" />
      </div>
    </main>
  )
}
