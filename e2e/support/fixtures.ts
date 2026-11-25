/**
 * Shared Playwright test base (06 §5: "no console errors" at every gate).
 *
 * The `consoleErrors` fixture is auto-used: every spec that imports `test`
 * from here fails when the page logs a console error or throws, with the
 * messages attached to the report. Keeping this in one place means a new spec
 * cannot silently opt out of the gate.
 */
import { expect, test as base } from '@playwright/test'

interface ConsoleGuard {
  consoleErrors: string[]
}

export const test = base.extend<ConsoleGuard>({
  consoleErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text())
        }
      })
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })

      await use(errors)

      if (errors.length > 0) {
        await testInfo.attach('console-errors', {
          body: errors.join('\n'),
          contentType: 'text/plain',
        })
      }
      expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
