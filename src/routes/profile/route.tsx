import { useRouteError } from 'react-router'

import { Button } from '@/components/ui/button'

import { ProfilePage } from './ProfilePage'

/**
 * `/profile` — owner, pets summary, preferences and household data (03 §2).
 * Settings lives inside this route; there is no `/settings` route.
 */
export function Component() {
  return <ProfilePage />
}

/** Inline profile error state (03 §5); the shell stays usable. */
export function ErrorBoundary() {
  const error = useRouteError()
  const detail = error instanceof Error ? error.message : 'The browser did not provide a reason.'

  return (
    <div data-testid="profile-error" role="alert" className="mx-auto max-w-lg py-16 text-center">
      <p className="text-overline text-status-overdue">Could not load your profile</p>
      <h2 className="text-title mt-2">The household details did not load</h2>
      <p className="text-small text-muted-foreground mt-3">
        The data is still in this browser; the read failed. Try again, or reload the app.
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
