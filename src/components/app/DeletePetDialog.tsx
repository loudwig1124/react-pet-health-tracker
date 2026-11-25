/**
 * Destructive pet-delete confirmation (02 §3, R8). The copy states the cascade
 * before it happens: journal entries, vaccinations and clinical notes go, the
 * pet's appointments stay as Household visits.
 *
 * The actual delete is the route's repository call, so this dialog stays free
 * of data access; a failed transaction keeps the dialog open with the message.
 */
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
import type { Pet } from '@/lib/rules/types'

export interface DeletePetDialogProps {
  pet: Pet
  onClose: () => void
  /** Called after a successful delete, before the dialog closes (e.g. navigate away). */
  onDeleted?: () => void
  onConfirm: () => Promise<void>
}

export function DeletePetDialog({ pet, onClose, onDeleted, onConfirm }: DeletePetDialogProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async (): Promise<void> => {
    setError(null)
    setDeleting(true)
    try {
      await onConfirm()
      onDeleted?.()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !deleting) {
          onClose()
        }
      }}
    >
      <AlertDialogContent data-testid="delete-pet-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {pet.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {pet.name}&apos;s journal entries, vaccinations and clinical notes. Their
            appointments stay on the household calendar as Household visits. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error === null ? null : (
          <p role="alert" className="text-destructive text-small">
            Could not delete the pet: {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            data-testid="confirm-delete"
            onClick={handleConfirm}
          >
            {deleting ? 'Deleting…' : 'Delete pet'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
