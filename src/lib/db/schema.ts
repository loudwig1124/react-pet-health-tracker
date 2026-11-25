/**
 * Zod mirrors of the Flutter `db/schema.sql` DDL checks (02 §4 risk 1).
 *
 * IndexedDB enforces no CHECK/UNIQUE constraints, so every repository parses
 * rows through these schemas before writing. Business rules that need a clock
 * or cross-row context (R1, R3, R9 uniqueness, R4 day math) live in
 * `src/lib/rules` and are applied by the repositories/UI; these schemas carry
 * the storage shape and the constraints SQL used to enforce.
 */
import { z } from 'zod'

import { isDateKey, isIsoInstant } from '@/lib/rules/calendar'
import { APPOINTMENT_STATUSES, JOURNAL_KINDS, PET_SEXES } from '@/lib/rules/constants'

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max)

export const dateKeySchema = z
  .string()
  .refine((value) => isDateKey(value), 'must be a fixed-width YYYY-MM-DD calendar day')

export const isoInstantSchema = z
  .string()
  .refine((value) => isIsoInstant(value), 'must be an ISO-8601 instant')

export const idSchema = z.string().min(1)

/** `pet.microchip`: nullable, and when present 9–15 digits (R9/DDL). */
export const microchipSchema = z
  .string()
  .regex(/^\d{9,15}$/, 'microchip must be 9–15 digits')
  .nullable()

export const petSexSchema = z.enum(PET_SEXES)
export const journalKindSchema = z.enum(JOURNAL_KINDS)
export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES)

/* ------------------------------------------------------------------ Owner */

export const ownerSchema = z.object({
  id: idSchema,
  name: trimmed(1, 80),
  email: z.string().trim(),
  phone: z.string().trim(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
})

export const ownerDraftSchema = z.object({
  name: trimmed(1, 80),
  email: z.string().trim(),
  phone: z.string().trim(),
})

/* -------------------------------------------------------------------- Pet */

export const petSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  name: trimmed(1, 40),
  species: trimmed(1, 30),
  breed: trimmed(1, 40).nullable(),
  sex: petSexSchema,
  dateOfBirth: dateKeySchema,
  weightKg: z.number().positive().max(300),
  microchip: microchipSchema,
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
})

export const petDraftSchema = petSchema.pick({
  name: true,
  species: true,
  breed: true,
  sex: true,
  dateOfBirth: true,
  weightKg: true,
  microchip: true,
})

/* ---------------------------------------------------------- Journal entry */

export const journalEntrySchema = z.object({
  id: idSchema,
  petId: idSchema,
  kind: journalKindSchema,
  occurredAt: isoInstantSchema,
  note: z.string().nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  createdAt: isoInstantSchema,
  updatedAt: isoInstantSchema,
})

export const journalDraftSchema = journalEntrySchema.pick({
  petId: true,
  kind: true,
  occurredAt: true,
  note: true,
  durationMinutes: true,
})

/* ----------------------------------------------------------- Health record */

const healthRecordBase = z.object({
  id: idSchema,
  petId: idSchema,
  recordedOn: dateKeySchema,
  condition: z.string().nullable(),
  diagnosis: z.string().nullable(),
  treatment: z.string().nullable(),
  prescribedMedication: z.string().nullable(),
  vetName: z.string().nullable(),
  createdAt: isoInstantSchema,
})

export const healthRecordSchema = healthRecordBase.refine(
  (record) => Boolean(record.condition?.trim() || record.diagnosis?.trim()),
  {
    message: 'a clinical note needs a condition or a diagnosis',
    path: ['condition'],
  },
)

export const healthRecordDraftSchema = healthRecordBase.omit({
  id: true,
  createdAt: true,
})

/* ------------------------------------------------------------- Vaccination */

const vaccinationBase = z.object({
  id: idSchema,
  petId: idSchema,
  vaccineTypeId: idSchema.nullable(),
  vaccineName: trimmed(1, 80),
  vaccinationDate: dateKeySchema,
  nextDueDate: dateKeySchema.nullable(),
  vetName: z.string().nullable(),
  createdAt: isoInstantSchema,
})

export const vaccinationSchema = vaccinationBase.refine(
  (dose) => dose.nextDueDate === null || dose.nextDueDate > dose.vaccinationDate,
  {
    message: 'next due date must be strictly after the dose date',
    path: ['nextDueDate'],
  },
)

export const vaccinationDraftSchema = vaccinationBase.omit({
  id: true,
  createdAt: true,
})

/* ------------------------------------------------------------- Appointment */

export const appointmentSchema = z
  .object({
    id: idSchema,
    petId: idSchema.nullable(),
    clinicName: trimmed(1, 120),
    purpose: trimmed(1, 120),
    scheduledAt: isoInstantSchema,
    status: appointmentStatusSchema,
    completedAt: isoInstantSchema.nullable(),
    cancelReason: z.string().nullable(),
    createdAt: isoInstantSchema,
    updatedAt: isoInstantSchema,
  })
  .superRefine((appointment, context) => {
    // The DDL invariants: completedAt exactly when completed; cancelReason
    // non-empty exactly when cancelled (02 §3).
    if (appointment.status === 'completed' && appointment.completedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'a completed appointment needs completedAt',
      })
    }
    if (appointment.status !== 'completed' && appointment.completedAt !== null) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'completedAt is only set on a completed appointment',
      })
    }
    const hasReason = Boolean(appointment.cancelReason?.trim())
    if (appointment.status === 'cancelled' && !hasReason) {
      context.addIssue({
        code: 'custom',
        path: ['cancelReason'],
        message: 'a cancelled appointment needs a reason',
      })
    }
    if (appointment.status !== 'cancelled' && appointment.cancelReason !== null) {
      context.addIssue({
        code: 'custom',
        path: ['cancelReason'],
        message: 'cancelReason is only set on a cancelled appointment',
      })
    }
  })

export const appointmentDraftSchema = z.object({
  petId: idSchema.nullable(),
  clinicName: trimmed(1, 120),
  purpose: trimmed(1, 120),
  scheduledAt: isoInstantSchema,
})

/* ------------------------------------------------------------- Vaccine type */

export const vaccineTypeSchema = z.object({
  id: idSchema,
  name: trimmed(1, 80),
  intervalMonths: z.number().int().positive().nullable(),
  isCore: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
})

/**
 * Parses one row, throwing a descriptive error that names the store and the
 * failing field. Used by every write path and by the migration tests.
 */
export function parseRow<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid ${label}: ${detail}`)
  }
  return result.data
}
