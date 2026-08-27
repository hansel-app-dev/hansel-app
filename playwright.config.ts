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
        'ALLOWED_ORIGIN=http://127.0.0.1:5173 EMAIL_DELIVERY_MODE=console PASSWORD_PEPPER=e2e-password-pepper VERIFICATION_DIGEST_KEY=e2e-verification-digest-key DATABASE_URL=postgresql://hansel:hansel@127.0.0.1:5433/hansel?schema=public pnpm --filter @hansel/api dev',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @hansel/web dev --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
