import { useState } from 'react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export interface ResetHouseholdDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Runs the R8 reset; rejects to keep the dialog open with the error. */
  onConfirm: (forgetOwner: boolean) => Promise<void>
}

/**
 * Reset household confirmation (R8, 03 §3). Not undoable, so it always confirms
 * first; the "Also forget my name and details" checkbox is the forget-owner
 * option from the reset rule (default off) and the copy states both outcomes.
 *
 * The form state lives in a child that only exists while the dialog is open, so
 * every open starts from the documented default without a reset effect.
 */
export function ResetHouseholdDialog({ open, onOpenChange, onConfirm }: ResetHouseholdDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <ResetHouseholdForm
          onClose={() => {
            onOpenChange(false)
          }}
          onConfirm={onConfirm}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ResetHouseholdForm({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (forgetOwner: boolean) => Promise<void>
}) {
  const [forgetOwner, setForgetOwner] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm(): Promise<void> {
    setPending(true)
    setError(null)
    try {
      await onConfirm(forgetOwner)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reset the household.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Reset the household?</AlertDialogTitle>
        <AlertDialogDescription>
          This deletes every pet, vaccination, clinical note, visit and journal entry stored in this
          browser. It cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          data-testid="settings-reset-forget"
          className="accent-primary mt-0.5 size-4 shrink-0"
          checked={forgetOwner}
          disabled={pending}
          onChange={(event) => {
            setForgetOwner(event.currentTarget.checked)
          }}
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Also forget my name and details</span>
          <span className="text-muted-foreground text-xs">
            {forgetOwner
              ? 'The household name, email and phone will be cleared.'
              : 'Your name, email and phone stay with the household.'}
          </span>
        </span>
      </label>

      {error === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} data-testid="settings-reset-cancel">
          Cancel
        </AlertDialogCancel>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          data-testid="settings-reset-confirm"
          onClick={() => {
            void confirm()
          }}
        >
          {pending ? 'Resetting…' : 'Reset household'}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
