import { QuickLogBar } from '@/components/app/QuickLogBar'
import { useQuickLog } from '@/lib/hooks/useQuickLog'

export interface QuickLogIslandProps {
  pets: readonly { id: string; name: string }[]
}

/**
 * The interactive half of the dashboard quick-log bar.
 *
 * Loaded as a lazy island from `DashboardPage`: the write path, the shared
 * `useQuickLog` hook and this component's chunk must not sit in the initial `/`
 * chunk, because the first-load gate counts that chunk. The placeholder in
 * `DashboardPage` reserves the layout, so the bar appears without a shift.
 */
export function QuickLogIsland({ pets }: QuickLogIslandProps) {
  const quickLog = useQuickLog(pets)

  return (
    <QuickLogBar
      pets={pets}
      petId={quickLog.petId}
      pendingKind={quickLog.pendingKind}
      onPetChange={quickLog.setPetId}
      onLog={(kind) => {
        void quickLog.log(kind)
      }}
    />
  )
}
