'use client'

import { cn } from '@/lib/utils'

/**
 * Magic UI's **Animated List** effect (04 §3), vendored with the documented
 * zero-dependency fallback: a CSS `fade-rise` keyframe instead of `motion`.
 *
 * 04 §3 lists "CSS `fade-rise` keyframe, 0 kB" as the accepted fallback, and
 * 01 D4 warns that the registry's `motion` dependency must not enter the eager
 * chunk. The behaviour 03 §4 asks for is preserved:
 *
 * - lists animate only when a row is **appended** (never on scroll or filter);
 * - 180 ms fade + 6 px rise with a 24 ms stagger, capped at six rows;
 * - `prefers-reduced-motion` removes the movement via the global rule.
 *
 * `AnimatedListItem` receives `animate` from the screen (the newly created id)
 * instead of animating every mount, which keeps filtering silent.
 */
export interface AnimatedListProps extends React.ComponentProps<'div'> {}

export function AnimatedList({ className, ...props }: AnimatedListProps) {
  return (
    <div data-slot="animated-list" className={cn('flex w-full flex-col', className)} {...props} />
  )
}

export interface AnimatedListItemProps extends React.ComponentProps<'div'> {
  /** Play the entry animation for this row (newly appended only). */
  animate?: boolean
  /** Position in the list; drives the 24 ms stagger, capped at six rows. */
  index?: number
}

export function AnimatedListItem({
  animate = false,
  index = 0,
  className,
  style,
  ...props
}: AnimatedListItemProps) {
  const delay = Math.min(Math.max(index, 0), 6) * 24

  return (
    <div
      data-slot="animated-list-item"
      data-animate={animate ? 'true' : undefined}
      className={cn(animate && 'magicui-fade-rise', className)}
      style={animate ? { animationDelay: `${delay}ms`, ...style } : style}
      {...props}
    />
  )
}
