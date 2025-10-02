import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['./**/*.test.ts'],
    exclude: ['./**/*.browser.test.ts', 'node_modules'], // Exclude browser tests from Node.js runs
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', 'test/**', '**/*.config.ts'],
    },
  },
});
