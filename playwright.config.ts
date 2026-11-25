import { defineConfig, devices } from '@playwright/test'

/**
 * Chromium-only smoke suite (01 D7, 06 M1). Browsers are installed inside the
 * workspace because the sandbox cannot write to the macOS caches:
 *
 *   PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install chromium
 *
 * `pnpm test:e2e` sets the same env var before running, and the webServer is a
 * `vite preview` of the production build (`pnpm build` runs the size gate too).
 */
/**
 * The port and whether an external preview server already owns it are env
 * switches: `scripts/gate.sh` starts its own server on an isolated port so a
 * teammate's concurrent `pnpm e2e` (or a stale preview) cannot kill the gate's
 * server mid-run. Plain `pnpm e2e` keeps the Playwright-managed server.
 */
const port = Number(process.env.PW_PORT ?? 4173)
const externalServer = process.env.PW_EXTERNAL_SERVER === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalServer
    ? undefined
    : {
        command: `pnpm preview --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}`,
        /**
         * Never reuse a preview server: `vite preview` keeps the built
         * `index.html` in memory, so a server started before `pnpm build` would
         * serve hashed asset URLs that no longer exist → 404s and a blank app.
         */
        reuseExistingServer: false,
        timeout: 120_000,
      },
})
