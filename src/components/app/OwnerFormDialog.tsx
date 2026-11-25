import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DEFAULT_OWNER_NAME } from '@/lib/rules/constants'
import type { Owner, OwnerDraft } from '@/lib/rules/types'

export interface OwnerFormDialogProps {
  open: boolean
  owner: Owner
  onOpenChange: (open: boolean) => void
  /** Persists the whole draft; rejects to keep the dialog open with the error. */
  onSave: (draft: OwnerDraft) => Promise<void>
}

/**
 * The Profile owner dialog (02 §1, 03 §2). All three fields are present on
 * mount and saved together, so editing only the name keeps the stored email and
 * phone instead of blanking them — the concrete acceptance rule for M4.
 *
 * `DialogContent` unmounts when closed, so each open starts from the live owner
 * row and can never show a stale name.
 */
export function OwnerFormDialog({ open, owner, onOpenChange, onSave }: OwnerFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Your name appears in the sidebar and the dashboard greeting. Email and phone are
            optional.
          </DialogDescription>
        </DialogHeader>
        <OwnerForm owner={owner} onSave={onSave} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function OwnerForm({
  owner,
  onSave,
  onDone,
}: {
  owner: Owner
  onSave: (draft: OwnerDraft) => Promise<void>
  onDone: () => void
}) {
  const [name, setName] = useState(owner.name === DEFAULT_OWNER_NAME ? '' : owner.name)
  const [email, setEmail] = useState(owner.email)
  const [phone, setPhone] = useState(owner.phone)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(): Promise<void> {
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setError('Enter your name')
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSave({ name: trimmedName, email: email.trim(), phone: phone.trim() })
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Field data-invalid={error === null ? undefined : 'true'}>
        <FieldLabel htmlFor="profile-owner-name">Name</FieldLabel>
        <Input
          id="profile-owner-name"
          data-testid="profile-owner-name"
          value={name}
          autoComplete="name"
          aria-invalid={error === null ? undefined : true}
          onChange={(event) => {
            setName(event.currentTarget.value)
          }}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="profile-owner-email">Email</FieldLabel>
        <Input
          id="profile-owner-email"
          data-testid="profile-owner-email"
          type="email"
          autoComplete="email"
          placeholder="optional"
          value={email}
          onChange={(event) => {
            setEmail(event.currentTarget.value)
          }}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="profile-owner-phone">Phone</FieldLabel>
        <Input
          id="profile-owner-phone"
          data-testid="profile-owner-phone"
          type="tel"
          autoComplete="tel"
          placeholder="optional"
          value={phone}
          onChange={(event) => {
            setPhone(event.currentTarget.value)
          }}
        />
      </Field>

      {error === null ? null : <FieldError>{error}</FieldError>}

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onDone}
          disabled={pending}
          data-testid="profile-owner-cancel"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending} data-testid="profile-owner-save">
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  )
}
