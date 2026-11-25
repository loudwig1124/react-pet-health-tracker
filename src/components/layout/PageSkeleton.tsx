import { Skeleton } from '@/components/ui/skeleton'

export type PageSkeletonVariant =
  | 'dashboard'
  | 'table'
  | 'appointments'
  | 'list'
  | 'journal'
  | 'profile'
  | 'detail'

function Block({ className }: { className?: string }) {
  return <Skeleton className={className} />
}

function StatRow() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((index) => (
        <Block key={index} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}

function TableBody({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Block className="h-8 w-40" />
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Block className="border-border h-11 rounded-none border-b" />
        {Array.from({ length: rows }, (_, index) => (
          <Block key={index} className="border-border h-11 rounded-none border-b last:border-0" />
        ))}
      </div>
    </div>
  )
}

/**
 * The M1 layout skeleton each destination renders until its milestone ships the
 * real screen (06 §2 M1: "every route renders its layout skeleton"). Shapes
 * mirror the eventual composition so the shell can be reviewed at 1024/1440
 * without feature code.
 */
export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  return (
    <div
      data-testid="page-skeleton"
      data-variant={variant}
      className="flex flex-col gap-[var(--section-gap)]"
    >
      {variant === 'dashboard' ? (
        <>
          <StatRow />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Block className="h-56 rounded-xl" />
            <Block className="h-56 rounded-xl" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Block className="h-40 rounded-xl" />
            <Block className="h-40 rounded-xl" />
          </div>
        </>
      ) : null}

      {variant === 'table' ? (
        <>
          <div className="flex gap-3">
            <Block className="h-9 w-32" />
            <Block className="h-9 w-32" />
            <Block className="h-9 w-32" />
          </div>
          <TableBody rows={6} />
        </>
      ) : null}

      {variant === 'appointments' ? (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Block className="h-96 rounded-xl" />
          <TableBody rows={6} />
        </div>
      ) : null}

      {variant === 'list' ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((index) => (
            <Block key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : null}

      {variant === 'journal' ? (
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_320px]">
          <Block className="h-80 rounded-xl" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((index) => (
              <Block key={index} className="h-16 rounded-xl" />
            ))}
          </div>
          <Block className="hidden h-80 rounded-xl xl:block" />
        </div>
      ) : null}

      {variant === 'profile' ? (
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <Block className="h-64 rounded-xl" />
          <div className="flex flex-col gap-4">
            <Block className="h-16 rounded-xl" />
            <Block className="h-16 rounded-xl" />
            <Block className="h-16 rounded-xl" />
            <Block className="h-16 rounded-xl" />
          </div>
        </div>
      ) : null}

      {variant === 'detail' ? (
        <>
          <Block className="h-24 rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_240px]">
            <Block className="h-72 rounded-xl" />
            <Block className="h-72 rounded-xl" />
            <Block className="h-72 rounded-xl" />
          </div>
        </>
      ) : null}
    </div>
  )
}
