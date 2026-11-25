import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

/** 404 inside the shell (03 §1: unknown paths keep the sidebar reachable). */
export function Component() {
  return (
    <div data-testid="not-found" className="mx-auto max-w-xl py-16 text-center">
      <p className="text-overline text-muted-foreground">404</p>
      <h2 className="text-title mt-2">Page not found</h2>
      <p className="text-body text-muted-foreground mt-3">
        That address is not part of the household notebook. Use the sidebar, ⌘1–6, or head back to
        the dashboard.
      </p>
      <div className="mt-6 flex justify-center">
        <Button asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
