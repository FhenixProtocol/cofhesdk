import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'node',

    // Browser environment configuration
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
    },

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
    testTimeout: 10000,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', '**/*.config.ts', '**/*.config.mts'],
    },
  },

  // Optimize dependency handling
  optimizeDeps: {
    exclude: ['tfhe', 'node-tfhe'], // Don't pre-bundle tfhe to preserve WASM loading
    esbuildOptions: {
      target: 'esnext', // Ensure modern JS features for WASM
    },
  },

  // Handle WASM files as assets
  assetsInclude: ['**/*.wasm'],

  // Allow serving files from node_modules for WASM access
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
