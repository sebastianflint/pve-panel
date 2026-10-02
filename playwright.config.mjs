// Browser tests (test/e2e): one isolated stack (simulated Proxmox + panel) for
// the whole run, started in global-setup.mjs.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '**/*.spec.mjs',
  globalSetup: './test/e2e/global-setup.mjs',
  fullyParallel: false,          // tests share one seeded panel
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Local runs may point to an installed Chromium; CI uses Playwright's own.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
