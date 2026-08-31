import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000' },
      '/auth': { target: 'http://localhost:3000' },
      '/login': { target: 'http://localhost:3000' },
      '/forgot-password': { target: 'http://localhost:3000' },
      '/reset-password': { target: 'http://localhost:3000' },
      '/onboarding/about-you': { target: 'http://localhost:3000' },
      '/onboarding/plan-selection': { target: 'http://localhost:3000' },
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'design-system-e2e/**'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test-setup.ts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
