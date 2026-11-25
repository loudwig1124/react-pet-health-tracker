import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shown by the root route while the initial DB boot loader runs
 * (`HydrateFallback`, 06 M1). It mirrors the real shell at 1440 and 1024 so the
 * first paint does not jump when the shell replaces it: 240/72 px sidebar,
 * 64/56 px header, content at the page gutter.
 */
export function HydrateFallback() {
  return (
    <div
      data-testid="hydrate-fallback"
      role="status"
      aria-busy="true"
      className="bg-background flex h-svh w-full"
    >
      <span className="sr-only">Opening the household database…</span>
      <div className="border-border bg-sidebar flex w-[72px] shrink-0 flex-col gap-3 border-r p-4 min-[1280px]:w-[240px]">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="mt-4 h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
        <Skeleton className="h-9 rounded-md" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-border flex h-[var(--header-height)] shrink-0 items-center gap-3 border-b px-[var(--page-gutter)]">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="ml-auto h-8 w-24" />
        </div>
        <div className="mx-auto w-full max-w-[var(--content-max-narrow)] px-[var(--page-gutter)] pt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mt-4 h-56 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
