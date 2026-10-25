import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './checks/browser',
  outputDir: 'node_modules/.cache/test-results',
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
  },
});
