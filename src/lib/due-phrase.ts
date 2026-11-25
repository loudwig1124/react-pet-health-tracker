/**
 * The one human phrase for a vaccination due date: "35 days overdue", "due
 * today", "due in 10 days" (R1/R4 local day).
 *
 * Split from `pets-table.ts` because the M5 desktop surfaces (dashboard rail and
 * sidebar badges) need the same sentence without pulling the table read model
 * into their lazy chunks. The due *status* itself is never computed here — it is
 * always `doseDueStatus`/`petDueSummary` from the R1 rule.
 */

import { daysBetween } from '@/lib/rules/calendar'
import type { DateKey } from '@/lib/rules/types'

function daysLabel(days: number): string {
  return `${days} day${days === 1 ? '' : 's'}`
}

export function dueDatePhrase(dueDate: DateKey | null | undefined, today: DateKey): string | null {
  if (dueDate == null) {
    return null
  }
  const days = daysBetween(today, dueDate)
  if (days < 0) {
    return `${daysLabel(-days)} overdue`
  }
  if (days === 0) {
    return 'due today'
  }
  return `due in ${daysLabel(days)}`
}
