'use client'

import { useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { getToasts, runToastAction, subscribeToasts } from '@/lib/toast'
import { cn } from '@/lib/utils'

const EMPTY_TOASTS = [] as const

function subscribe(listener: () => void): () => void {
  return subscribeToasts(listener)
}

/**
 * The single toast outlet, mounted once by the shell (03 §4). Polite status
 * regions, bottom-right on desktop, never blocking the page; the action button
 * carries the Undo contract. Reduced motion removes the entry transition.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts, () => EMPTY_TOASTS)

  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      data-testid="toaster"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          data-testid={`toast-${toast.id}`}
          className={cn(
            'bg-card text-card-foreground pointer-events-auto rounded-xl border p-3 shadow-lg',
            'animate-in fade-in slide-in-from-bottom-2 duration-150',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-small font-medium">{toast.title}</p>
              {toast.description === undefined ? null : (
                <p className="text-caption text-muted-foreground mt-0.5">{toast.description}</p>
              )}
            </div>
            {toast.action === undefined ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary -my-1 shrink-0"
                data-testid={toast.action.testId}
                onClick={() => runToastAction(toast.id)}
              >
                {toast.action.label}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
