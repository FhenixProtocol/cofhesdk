import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      // Use headless mode
      headless: true,
    },
    globals: true,
    include: ['./src/**/*.test.ts', './test/**/*.test.ts'],
    exclude: ['node_modules'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', '**/*.config.ts', '**/*.config.mts'],
    },
  },
});
