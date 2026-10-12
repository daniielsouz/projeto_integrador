import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'),
    viewport: { width: 1440, height: 1080 },
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node backend/server.js',
    url: 'http://127.0.0.1:3001/api/health',
    reuseExistingServer: false,
    env: { PORT: '3001', HOST: '127.0.0.1', DATABASE_PATH: ':memory:' },
  },
});
