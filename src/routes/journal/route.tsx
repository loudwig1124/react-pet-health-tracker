import { useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'

import { JournalPage } from './JournalPage'

/** `/journal` (03 §3): filters · day-grouped feed · inline editor / Sheet. */
export function Component() {
  return <JournalPage />
}

/**
 * A failed journal read keeps the shell (and therefore every other route)
 * usable and offers a retry; this is the 03 §5 inline error state for a list
 * rather than a full-window takeover.
 */
export function ErrorBoundary() {
  const error = useRouteError()
  const detail = error instanceof Error ? error.message : 'The browser did not provide a reason.'

  return (
    <div data-testid="journal-error" role="alert" className="mx-auto max-w-lg py-16 text-center">
      <p className="text-overline text-status-overdue">Could not load the journal</p>
      <h2 className="text-title mt-2">The journal did not open</h2>
      <p className="text-small text-muted-foreground mt-3">
        Your entries are still in this browser — the read failed. Try again, or reload the app if it
        keeps happening.
      </p>
      <p className="bg-muted text-caption text-muted-foreground mt-3 rounded-lg px-3 py-2">
        {detail}
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    </div>
  )
}
