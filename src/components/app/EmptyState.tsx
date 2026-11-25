/**
 * One empty-state composition for the whole app (03 §5, 04 §2).
 *
 * The rule matters more than the styling: an empty household says what to do
 * next, while a filtered view never pretends there is no data — it names the
 * filter and offers "Clear filters".
 */
import type { ReactNode } from 'react'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  secondaryAction?: ReactNode
  icon?: ReactNode
  testId?: string
  className?: string
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  icon,
  testId,
  className,
}: EmptyStateProps) {
  return (
    <Empty
      data-testid={testId}
      className={cn('border-border bg-card/60 border border-dashed py-10', className)}
    >
      <EmptyHeader>
        {icon === undefined ? null : <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description === undefined ? null : <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action === undefined && secondaryAction === undefined ? null : (
        <EmptyContent className="flex flex-row flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </EmptyContent>
      )}
    </Empty>
  )
}
