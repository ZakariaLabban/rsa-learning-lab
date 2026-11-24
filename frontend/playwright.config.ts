import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  testMatch: [
    'lecture.spec.ts',
    'account.spec.ts',
    'offline.spec.ts',
    'onboarding.spec.ts',
    'accessibility.spec.ts',
    'hardening.spec.ts',
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    channel: process.env.RSA_BROWSER_CHANNEL,
    // Several specs stub worker scripts with page.route, which a service worker would
    // answer from its cache first. Only offline.spec.ts enables the offline worker.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
