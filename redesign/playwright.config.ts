import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './checks/browser',
  outputDir: 'node_modules/.cache/test-results',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  // Most suites intercept movie/asset failures; real-worker lifecycle is covered separately by pwa.spec.ts.
  use: {
    serviceWorkers: 'block',
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: process.env.ARCADE_REUSE_PREVIEW === '1',
  },
});
