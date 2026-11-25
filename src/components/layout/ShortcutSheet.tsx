import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { SHORTCUT_GROUPS } from '@/lib/desktop/shortcuts'

export interface ShortcutSheetProps {
  onClose: () => void
}

/**
 * F8 — the `?` cheat sheet.
 *
 * Every binding comes from `SHORTCUT_GROUPS`, the same registry the copy in this
 * file is tested against, so the sheet can never advertise a key that does
 * nothing (the M5 acceptance: "every shortcut works or has a documented alias").
 * Lazy: it mounts from its own chunk only when `?` is pressed outside a field.
 */
export function ShortcutSheet({ onClose }: ShortcutSheetProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent data-testid="shortcut-sheet" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Everything here works without a mouse. Browsers may reserve ⌘N or ⌘1–6; the plain-key
            aliases and the Search button are always available.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`shortcut-group-${group.id}`}>
              <h3
                id={`shortcut-group-${group.id}`}
                className="text-overline text-muted-foreground pb-1.5"
              >
                {group.title}
              </h3>
              <dl className="flex flex-col divide-y">
                {group.rows.map((row) => (
                  <div
                    key={`${group.id}-${row.label}`}
                    className="flex items-center justify-between gap-4 py-1.5"
                  >
                    <dt className="text-small">
                      {row.label}
                      {row.alias === undefined ? null : (
                        <span className="text-caption text-muted-foreground"> ({row.alias})</span>
                      )}
                    </dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {row.keys.map((key) => (
                        <Kbd key={key} className="text-caption h-5">
                          {key}
                        </Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
