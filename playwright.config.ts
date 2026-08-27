import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry' },
  webServer: [
    {
      command:
        'ALLOWED_ORIGIN=http://127.0.0.1:5173 pnpm --filter @hansel/api dev',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'VITE_API_URL=http://127.0.0.1:3000 pnpm --filter @hansel/web dev --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
