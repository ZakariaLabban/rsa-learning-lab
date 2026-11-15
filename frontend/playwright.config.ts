import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    channel: process.env.RSA_BROWSER_CHANNEL,
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
