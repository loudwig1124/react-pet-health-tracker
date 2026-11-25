import {
  CalendarDays,
  FileHeart,
  LayoutDashboard,
  NotebookPen,
  PawPrint,
  Syringe,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, useLocation } from 'react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Kbd } from '@/components/ui/kbd'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useOwnerIdentity } from '@/lib/hooks/useOwnerIdentity'
import { APP_DESTINATIONS, PROFILE_PATH, type AppDestinationKey } from '@/lib/shell'
import { cn } from '@/lib/utils'

/**
 * F2's counts are a lazy island: the badge imports the R1/R4 derivation, which
 * must not enter the eager shell budget. Hidden while zero; the nav row is fully
 * usable before it lands.
 */
const SidebarAttentionBadge = lazy(() =>
  import('./SidebarAttentionBadge').then((module) => ({
    default: module.SidebarAttentionBadge,
  })),
)

const NAV_ICONS: Record<AppDestinationKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  pets: PawPrint,
  appointments: CalendarDays,
  vaccinations: Syringe,
  records: FileHeart,
  journal: NotebookPen,
}

function isDestinationActive(pathname: string, path: string): boolean {
  if (path === '/') {
    return pathname === '/'
  }
  return pathname === path || pathname.startsWith(`${path}/`)
}

function ownerInitial(name: string): string {
  const first = name.trim().charAt(0)
  return first === '' ? 'P' : first.toUpperCase()
}

export interface AppSidebarProps {
  open: boolean
  onToggle: () => void
}

/**
 * The persistent sidebar (03 §1–§2 revised): six destinations in two groups, a
 * hairline, then the pinned Profile footer row (avatar + owner name expanded,
 * avatar only in the rail with a tooltip). Settings lives inside Profile —
 * there is no Settings item and no `/settings` route.
 *
 * Deliberately built from Tooltip/Avatar/Separator rather than shadcn's
 * `Sidebar` primitive: that primitive drags Sheet/Dialog/Input into the eager
 * shell (1.3 kB over the D8 budget) and its mobile off-canvas branch conflicts
 * with 03's forced 72 px rail below 1024 px. The rail contract here is CSS +
 * this component. Icon motion is the CSS contract in `index.css` (70 % at rest
 * → 100 % + scale(1.06) + 1 px lift on hover, 120 ms, reduced-motion aware).
 */
export function AppSidebar({ open, onToggle }: AppSidebarProps) {
  const { pathname } = useLocation()
  const owner = useOwnerIdentity()

  const rail = !open

  return (
    <aside
      data-testid="app-sidebar"
      data-state={open ? 'expanded' : 'collapsed'}
      data-rail={rail ? 'true' : 'false'}
      aria-label="Household navigation"
      style={{ width: open ? 'var(--sidebar-width)' : 'var(--sidebar-width-rail)' }}
      className="border-border bg-sidebar text-sidebar-foreground flex h-svh shrink-0 flex-col overflow-hidden border-r transition-[width] duration-[var(--dur-sidebar)] ease-[var(--ease-standard)]"
    >
      <div className="border-sidebar-border flex h-[var(--header-height)] shrink-0 items-center border-b px-3">
        <Link
          to="/"
          aria-label="Pet Health Tracker — Dashboard"
          data-testid="sidebar-brand"
          className="focus-visible:ring-sidebar-ring flex min-w-0 items-center gap-2.5 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="bg-accent-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
            <PawPrint aria-hidden="true" className="size-4" strokeWidth={2.25} />
          </span>
          {rail ? null : (
            <span className="text-small truncate font-semibold tracking-tight">
              Pet Health Tracker
            </span>
          )}
        </Link>
      </div>

      <nav
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3"
        aria-label="Primary"
      >
        {(
          [
            { key: 'overview', label: 'Overview', items: APP_DESTINATIONS.slice(0, 1) },
            { key: 'household', label: 'Household', items: APP_DESTINATIONS.slice(1) },
          ] as const
        ).map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            {rail ? (
              <span className="sr-only">{group.label}</span>
            ) : (
              <p className="text-overline text-muted-foreground px-2 pb-1">{group.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.key]
                const active = isDestinationActive(pathname, item.path)
                const badgeKind =
                  item.key === 'vaccinations'
                    ? ('vaccinations' as const)
                    : item.key === 'appointments'
                      ? ('appointments' as const)
                      : null
                const link = (
                  <Link
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    data-testid={`nav-${item.key}`}
                    data-active={active}
                    className={cn(
                      'app-nav-item group flex h-9 items-center gap-2.5 rounded-md px-2 text-small text-sidebar-foreground/85',
                      'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]',
                      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
                      rail && 'mx-auto h-10 w-10 justify-center px-0',
                      active && 'text-sidebar-accent-foreground',
                    )}
                  >
                    <Icon aria-hidden="true" className="app-nav-icon size-4 shrink-0" />
                    {rail ? (
                      badgeKind === null ? null : (
                        <Suspense fallback={null}>
                          <SidebarAttentionBadge kind={badgeKind} rail />
                        </Suspense>
                      )
                    ) : (
                      <>
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          {badgeKind === null ? null : (
                            <Suspense fallback={null}>
                              <SidebarAttentionBadge kind={badgeKind} />
                            </Suspense>
                          )}
                          <Kbd className="text-caption h-5 min-w-5">{`⌘${item.shortcut}`}</Kbd>
                        </span>
                      </>
                    )}
                  </Link>
                )

                return (
                  <li key={item.key}>
                    {rail ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" align="center">
                          <span className="flex items-center gap-2">
                            {item.label}
                            <Kbd className="text-caption">{`⌘${item.shortcut}`}</Kbd>
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* A plain hairline keeps radix Separator out of the eager shell (size gate). */}
      <div className="bg-border mx-2 h-px shrink-0" role="presentation" />
      <div className="shrink-0 p-2">
        {rail ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={PROFILE_PATH}
                aria-label={owner ? `Profile — ${owner.name}` : 'Profile'}
                data-testid="nav-profile"
                data-active={isDestinationActive(pathname, PROFILE_PATH)}
                className="app-nav-item focus-visible:ring-sidebar-ring hover:bg-sidebar-accent mx-auto flex h-10 w-10 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
              >
                <OwnerAvatar ownerName={owner?.name} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" align="center">
              <span className="flex items-center gap-2">
                {owner?.name ?? 'Profile'}
                <Kbd className="text-caption">⌘,</Kbd>
              </span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            to={PROFILE_PATH}
            aria-label={owner ? `Profile — ${owner.name}` : 'Profile'}
            data-testid="nav-profile"
            data-active={isDestinationActive(pathname, PROFILE_PATH)}
            className={cn(
              'app-nav-item flex h-11 items-center gap-2.5 rounded-md px-2 text-small',
              'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]',
              'hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
            )}
          >
            <OwnerAvatar ownerName={owner?.name} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-small truncate font-medium" data-testid="footer-owner-name">
                {owner?.name ?? 'Loading…'}
              </span>
              <span className="text-caption text-muted-foreground truncate">Profile</span>
            </span>
            <Kbd className="text-caption h-5 min-w-5 shrink-0">⌘,</Kbd>
          </Link>
        )}
      </div>

      {/* The rail's toggle stays keyboard/header reachable; this is the visual handle. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        title="Toggle sidebar (⌘B)"
        data-testid="sidebar-rail-toggle"
        className="sr-only"
      >
        Toggle sidebar
      </button>
    </aside>
  )
}

function OwnerAvatar({ ownerName }: { ownerName: string | undefined }) {
  if (ownerName === undefined) {
    return <Skeleton className="size-7 shrink-0 rounded-full" />
  }
  return (
    <Avatar className="size-7 shrink-0">
      <AvatarFallback className="bg-accent-soft text-caption text-primary font-semibold">
        {ownerInitial(ownerName)}
      </AvatarFallback>
    </Avatar>
  )
}
