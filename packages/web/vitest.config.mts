import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
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
  // Optimize dependency handling
  optimizeDeps: {
    exclude: ['tfhe'], // Don't pre-bundle tfhe to preserve WASM loading
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
