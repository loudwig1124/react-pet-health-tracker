/**
 * Magic UI — Progressive Blur (approved set, user 2026-11-25).
 *
 * A stack of static `backdrop-filter` layers, each revealed by a CSS mask, so
 * scrolled content fades under the sticky header without animating a filter
 * (04 §5's "no animated backdrop-filter" guard). Pointer-events are off; under
 * `prefers-reduced-motion` nothing here moves, so no additional guard is
 * needed. Vendored from the Magic UI registry, placed under `ui/magicui/` per
 * the 04 folder contract; treat as read-only.
 */
import { cn } from '@/lib/utils'

export interface ProgressiveBlurProps {
  className?: string
  height?: string
  position?: 'top' | 'bottom' | 'both'
  blurLevels?: number[]
}

const DEFAULT_BLUR_LEVELS = [0.5, 1, 2, 4, 8, 16, 32, 64]

function maskFor(position: ProgressiveBlurProps['position'], index: number, total: number): string {
  if (position === 'both') {
    return 'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,1) 5%, rgba(0,0,0,1) 95%, rgba(0,0,0,0) 100%)'
  }
  const direction = position === 'top' ? 'to top' : 'to bottom'
  if (index === -1) {
    return `linear-gradient(${direction}, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 12.5%, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 37.5%)`
  }
  if (index === total - 1) {
    return `linear-gradient(${direction}, rgba(0,0,0,0) 87.5%, rgba(0,0,0,1) 100%)`
  }
  const start = (index + 1) * 12.5
  const mid = (index + 2) * 12.5
  const end = (index + 3) * 12.5
  return `linear-gradient(${direction}, rgba(0,0,0,0) ${start}%, rgba(0,0,0,1) ${mid}%, rgba(0,0,0,1) ${end}%, rgba(0,0,0,0) ${end + 12.5}%)`
}

export function ProgressiveBlur({
  className,
  height = '30%',
  position = 'bottom',
  blurLevels = DEFAULT_BLUR_LEVELS,
}: ProgressiveBlurProps) {
  const layers = blurLevels.slice(0, -1)

  return (
    <div
      data-slot="progressive-blur"
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 z-10',
        className,
        position === 'top' ? 'top-0' : position === 'bottom' ? 'bottom-0' : 'inset-y-0',
      )}
      style={{ height: position === 'both' ? '100%' : height }}
    >
      {layers.map((level, index) => (
        <div
          key={`blur-${level}-${index}`}
          className="absolute inset-0"
          style={{
            zIndex: index + 1,
            backdropFilter: `blur(${level}px)`,
            WebkitBackdropFilter: `blur(${level}px)`,
            maskImage: maskFor(position, index === 0 ? -1 : index, layers.length),
            WebkitMaskImage: maskFor(position, index === 0 ? -1 : index, layers.length),
          }}
        />
      ))}
    </div>
  )
}
