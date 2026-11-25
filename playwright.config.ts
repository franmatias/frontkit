import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173/frontkit/' },
  webServer: {
    command: 'node scripts/pages-preview.mjs',
    url: 'http://127.0.0.1:4173/frontkit/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'], grep: /@smoke/ },
    { name: 'webkit', use: devices['Desktop Safari'], grep: /@smoke/ },
  ],
})
