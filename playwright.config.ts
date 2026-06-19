import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  globalSetup: './global-setup.ts',
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['playwright-qase-reporter', {
      mode: process.env.QASE_MODE || 'off',
      testops: {
        api: { token: process.env.QASE_TESTOPS_API_TOKEN },
        project: 'FW',
        uploadAttachments: true,
        run: { complete: true },
      },
    }],
  ],
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
  webServer: {
    command: 'npx ts-node server/server.ts',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
