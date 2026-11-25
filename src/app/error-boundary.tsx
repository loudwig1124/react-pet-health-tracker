import { useRouteError } from 'react-router'

function errorMessage(error: unknown): { title: string; detail: string } {
  if (error instanceof Error) {
    return { title: 'The household database could not open', detail: error.message }
  }
  if (typeof error === 'string') {
    return { title: 'The household database could not open', detail: error }
  }
  return {
    title: 'The household database could not open',
    detail: 'The browser did not provide a reason.',
  }
}

/**
 * Blocking storage-failure screen (03 §5 error state, 06 R1): names what
 * failed, offers Retry, and gives browser advice. Reached only when the root
 * boot loader rejects — one of the few intentionally full-window error paths.
 */
export function StorageErrorBoundary() {
  const error = useRouteError()
  const { title, detail } = errorMessage(error)

  return (
    <main
      role="alert"
      data-testid="storage-error"
      className="bg-background flex min-h-svh items-center justify-center px-6 py-12"
    >
      <div className="border-border bg-card w-full max-w-xl rounded-2xl border p-8 shadow-sm">
        <p className="text-overline text-status-overdue">Storage unavailable</p>
        <h1 className="text-title mt-2">{title}</h1>
        <p className="text-body text-muted-foreground mt-3">
          Pet Health Tracker keeps the whole household in this browser&apos;s own storage — no
          server, no account. The browser refused to open it, so nothing can be read or saved.
        </p>
        <p className="bg-muted text-small text-muted-foreground mt-3 rounded-lg px-3 py-2">
          {detail}
        </p>
        <ul className="text-small text-muted-foreground mt-4 list-disc space-y-1 pl-5">
          <li>Leave private/incognito mode and reload.</li>
          <li>Allow site data for this origin, then reload.</li>
          <li>Free some disk space, or close the other tab that is upgrading the database.</li>
        </ul>
        <div className="mt-6 flex gap-3">
          {/*
           * Native button, not shadcn's Button: the root error screen is eager
           * and the first-load gate counts every shared chunk. Same look, same
           * keyboard behaviour, no radix Slot in the shell.
           */}
          <button
            type="button"
            className="bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-[var(--radius)] px-2.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  )
}
