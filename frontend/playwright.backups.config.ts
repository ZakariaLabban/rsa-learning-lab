import { defineConfig } from '@playwright/test';
import config from './playwright.config';
// The retained interfaces run only in an explicit, unpublished backup-test build.
export default defineConfig({
  ...config,
  testMatch: '**/*.spec.ts',
  testIgnore: [
    '**/lecture.spec.ts',
    '**/account.spec.ts',
    '**/offline.spec.ts',
    '**/onboarding.spec.ts',
  ],
  use: { ...config.use, baseURL: 'http://127.0.0.1:4174' },
  webServer: {
    command: 'npm run preview -- --outDir dist-backups --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
});
