import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default environment
    environment: 'node',

    // Custom environment resolver
    environmentMatchGlobs: [
      // All .web.test.ts files use browser environment
      ['**/*.web.test.ts', 'browser'],
      // All .test.ts files use node environment (default)
      ['**/*.test.ts', 'node'],
    ],

    include: ['**/*.test.ts', '**/*.web.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    globals: true,
  },
});
