import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/design-system-e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:6006',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    viewport: { width: 1024, height: 768 },
  },
  webServer: {
    command: 'pnpm --filter @hansel/web storybook --ci',
    url: 'http://127.0.0.1:6006',
    reuseExistingServer: !process.env.CI,
  },
});
