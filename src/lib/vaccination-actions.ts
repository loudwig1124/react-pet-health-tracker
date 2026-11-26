/**
 * Vaccination action helpers (02 §1, owner decision A+C 2026-11-27).
 *
 * A dose is recorded once, but a misclicked vaccine or date must not be
 * permanent: the row can be corrected or deleted from the table, and a freshly
 * recorded dose can be undone for three seconds — the same contract the journal
 * uses, so every create-then-undo surface in the app behaves identically.
 */
import { deleteVaccination } from '@/lib/db/repositories/vaccinations'
import { formatDateKey } from '@/lib/format'
import type { Vaccination } from '@/lib/rules/types'
import { showToast } from '@/lib/toast'

export function showVaccinationCreatedToast(dose: Vaccination, petName: string): void {
  showToast({
    title: 'Vaccination recorded',
    description: `${petName} · ${dose.vaccineName} · ${formatDateKey(dose.vaccinationDate)}`,
    action: {
      label: 'Undo',
      testId: 'vaccination-undo',
      onClick: () => {
        void deleteVaccination(dose.id).catch((cause: unknown) => {
          showToast({
            title: 'Could not undo the vaccination',
            description: cause instanceof Error ? cause.message : 'Please try again.',
          })
        })
      },
    },
  })
}

export function showVaccinationUpdatedToast(dose: Vaccination, petName: string): void {
  showToast({
    title: 'Vaccination updated',
    description: `${petName} · ${dose.vaccineName} · ${formatDateKey(dose.vaccinationDate)}`,
  })
}

export function showVaccinationDeletedToast(dose: Vaccination): void {
  showToast({
    title: 'Vaccination deleted',
    description: `${dose.vaccineName} · ${formatDateKey(dose.vaccinationDate)}`,
  })
}
