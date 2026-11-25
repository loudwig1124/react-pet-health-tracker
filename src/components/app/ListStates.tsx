/**
 * The two list states 03 §5 requires in addition to EmptyState:
 *
 * - `TableSkeleton` — the first-load skeleton matching the final composition
 *   (no full-page spinner).
 * - `ListErrorState` — an inline panel naming the failure with Retry.
 */
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface TableSkeletonProps {
  rows?: number
  columns?: number
  testId?: string
  className?: string
}

export function TableSkeleton({
  rows = 6,
  columns = 6,
  testId = 'list-skeleton',
  className,
}: TableSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      data-testid={testId}
      className={cn('flex flex-col gap-3', className)}
    >
      <Skeleton className="h-5 w-40" />
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <div className="border-border bg-muted/40 flex h-[var(--row-height)] items-center gap-4 border-b px-3">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={rowIndex}
            className="border-border flex h-[var(--row-height)] items-center gap-4 border-b px-3 last:border-0"
          >
            {Array.from({ length: columns }, (_, columnIndex) => (
              <Skeleton key={columnIndex} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export interface ListErrorStateProps {
  /** The noun the panel names: "pets", "clinical records", "this pet". */
  what: string
  error: Error
  onRetry: () => void
  testId?: string
}

export function ListErrorState({
  what,
  error,
  onRetry,
  testId = 'list-error',
}: ListErrorStateProps) {
  return (
    <div
      role="alert"
      data-testid={testId}
      className="border-status-overdue/25 bg-status-overdue-soft flex flex-col items-start gap-2 rounded-xl border p-5"
    >
      <p className="text-heading flex items-center gap-2">
        <TriangleAlert aria-hidden="true" className="text-status-overdue size-4" />
        Could not load {what}.
      </p>
      <p className="text-small text-muted-foreground break-words">{error.message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
