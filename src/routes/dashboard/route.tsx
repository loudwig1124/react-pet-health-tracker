import { useRouteError } from 'react-router'

import { DashboardPage } from './DashboardPage'

/**
 * `/` — the desktop dashboard (03 §3). M4 ships the quick-log bar and the live
 * household summary; M5 adds the F1 counters and attention rail.
 */
export function Component() {
  return <DashboardPage />
}

/** Inline dashboard error state (03 §5); the shell stays usable. */
export function ErrorBoundary() {
  const error = useRouteError()
  const detail = error instanceof Error ? error.message : 'The browser did not provide a reason.'

  return (
    <div data-testid="dashboard-error" role="alert" className="mx-auto max-w-lg py-16 text-center">
      <p className="text-overline text-status-overdue">Could not load the dashboard</p>
      <h2 className="text-title mt-2">The household did not load</h2>
      <p className="text-small text-muted-foreground mt-3">
        The data is still in this browser; the read failed. Try again, or reload the app.
      </p>
      <p className="bg-muted text-caption text-muted-foreground mt-3 rounded-lg px-3 py-2">
        {detail}
      </p>
      <div className="mt-6 flex justify-center">
        {/* Native: this error screen ships in the initial route chunk (size gate). */}
        <button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-[var(--radius)] px-2.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
