/**
 * The `/appointments` month calendar — the only date-picker luxury in v1
 * (04 §2.2) and deliberately its own lazy chunk (`?view=calendar`).
 *
 * It is presentational: it takes marked/selected local day keys and reports a
 * pick. No data access, so it stays inside the `components/app` rules. The
 * schedule format helpers keep every day key on the local calendar (R4).
 *
 * The component styles react-day-picker entirely through its `classNames`
 * prop + Tailwind instead of importing its stylesheet, so the lazy calendar
 * chunk is one JS file: no second CSS request, and the initial CSS stays
 * calendar-free (04 §5).
 */
import type { CSSProperties } from 'react'
import { DayPicker } from 'react-day-picker'

import type { DateKey } from '@/lib/rules/types'
import {
  formatDateKey,
  formatMonthYearOfKey,
  localDateFromKey,
  monthStartKey,
} from '@/lib/schedule/format'
import { cn } from '@/lib/utils'

export interface AppointmentCalendarProps {
  /** The first day of the displayed month. */
  month: DateKey
  selectedDay: DateKey | null
  markedDays: readonly DateKey[]
  onSelectDay: (day: DateKey | null) => void
  onMonthChange: (month: DateKey) => void
  className?: string
}

const CLASS_NAMES = {
  root: 'rdp-root relative text-small',
  months: 'relative w-full',
  month: 'relative w-full',
  nav: 'pointer-events-none absolute inset-x-0 top-0 flex h-9 items-center justify-between',
  button_previous:
    'pointer-events-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  button_next:
    'pointer-events-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  chevron: 'size-4 fill-primary',
  month_caption: 'flex h-9 items-center justify-center font-semibold',
  month_grid: 'w-full border-collapse',
  weekdays: '',
  weekday: 'pb-1 text-center text-caption font-normal text-muted-foreground',
  week: '',
  day: 'p-0 text-center align-middle',
  day_button:
    'mx-auto flex size-8 cursor-pointer appearance-none items-center justify-center rounded-[var(--radius-chip)] border-0 bg-transparent p-0 text-sm text-inherit transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  selected:
    '[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button:hover]:bg-primary',
  today: '[&>button]:ring-1 [&>button]:ring-primary/40',
  outside: 'invisible',
  hidden: 'invisible',
  disabled: 'opacity-40',
  footer: 'pt-3 text-caption text-muted-foreground',
}

const CALENDAR_STYLE = {
  '--rdp-accent-color': 'var(--primary)',
  '--rdp-today-color': 'var(--primary)',
} as CSSProperties

/**
 * The local day a DayPicker click reports, or null when the selected day was
 * clicked again (deselect = clear `?day=`).
 */
function dayKeyOf(date: Date | undefined): DateKey | null {
  if (date === undefined) {
    return null
  }
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AppointmentCalendar({
  month,
  selectedDay,
  markedDays,
  onSelectDay,
  onMonthChange,
  className,
}: AppointmentCalendarProps) {
  const marked = [...new Set(markedDays)].map(localDateFromKey)

  return (
    <div
      data-testid="appointments-calendar"
      data-month={month}
      data-selected-day={selectedDay ?? ''}
      className={cn(
        'border-border bg-card rounded-xl border p-3',
        'shadow-[0_1px_2px_rgb(0_0_0/0.03)]',
        className,
      )}
    >
      <DayPicker
        mode="single"
        required={false}
        selected={selectedDay === null ? undefined : localDateFromKey(selectedDay)}
        onSelect={(date) => onSelectDay(dayKeyOf(date))}
        month={localDateFromKey(month)}
        onMonthChange={(date) => onMonthChange(monthStartKey(date))}
        modifiers={{ has_visit: marked }}
        modifiersClassNames={{
          has_visit:
            'relative after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary',
        }}
        showOutsideDays={false}
        weekStartsOn={1}
        style={CALENDAR_STYLE}
        classNames={CLASS_NAMES}
        footer={
          selectedDay === null ? (
            'Click a day to filter the table.'
          ) : (
            <span>
              Showing{' '}
              <span className="text-foreground font-medium">{formatDateKey(selectedDay)}</span>
              {' — click it again to clear.'}
            </span>
          )
        }
        aria-label={`Calendar for ${formatMonthYearOfKey(month)}`}
      />
    </div>
  )
}
