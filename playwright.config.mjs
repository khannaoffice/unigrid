import { defineConfig, devices } from '@playwright/test'

const reactVersion = process.env.REACT_VERSION || '18.3.1'

export default defineConfig({
  testDir: './browser-tests',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4178',
    viewport: { width: 1300, height: 900 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'node scripts/serve-browser-fixture.mjs',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: !process.env.CI,
    env: { REACT_VERSION: reactVersion },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
