import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { OwnerFormDialog } from '@/components/app/OwnerFormDialog'
import type { Owner } from '@/lib/rules/types'

const owner: Owner = {
  id: 'owner',
  name: 'Daniel Reyes',
  email: 'daniel@example.com',
  phone: '+63 917 555 0100',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('OwnerFormDialog', () => {
  it('keeps the stored email and phone when only the name changes', async () => {
    const onSave = vi.fn<(draft: { name: string; email: string; phone: string }) => Promise<void>>(
      () => Promise.resolve(),
    )
    const onOpenChange = vi.fn()

    render(<OwnerFormDialog open owner={owner} onOpenChange={onOpenChange} onSave={onSave} />)

    const name = await screen.findByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Dana Reyes')
    await userEvent.click(screen.getByTestId('profile-owner-save'))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      name: 'Dana Reyes',
      email: 'daniel@example.com',
      phone: '+63 917 555 0100',
    })
  })

  it('refuses a blank name without calling the write path', async () => {
    const onSave = vi.fn(() => Promise.resolve())

    render(<OwnerFormDialog open owner={owner} onOpenChange={vi.fn()} onSave={onSave} />)

    const name = await screen.findByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.click(screen.getByTestId('profile-owner-save'))

    expect(onSave).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your name')
  })
})
