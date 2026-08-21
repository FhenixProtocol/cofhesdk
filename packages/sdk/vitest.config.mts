import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const alias = { '@': resolve(__dirname, './') }; // or './src'

// tfhe's rayon thread pool (`initThreadPool`) hands a shared WebAssembly.Memory
// to its worker threads via postMessage, which the browser only permits in a
// cross-origin-isolated context. Without these headers `crossOriginIsolated` is
// false and initThreadPool fails with "SharedArrayBuffer transfer requires
// self.crossOriginIsolated". Single-threaded tfhe works either way.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig({
  define: { __STAGING_TESTS__: JSON.stringify(process.env.TEST_STAGING_ENABLED === 'true') },
  resolve: { alias },
  server: { headers: crossOriginIsolationHeaders },

  test: {
    globals: true,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', '**/*.config.*'],
    },

    projects: [
      // NODE (*.test.ts)
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: [
            'type-tests/**',
            '**/type-tests/**',
            '**/*.web.test.ts',
            '**/*.hh2.test.ts',
            'node_modules/**',
            'dist/**',
          ],
        },
        resolve: { alias },
      },

      // WEB (*.web.test.ts)
      {
        extends: true,
        test: {
          name: 'web',
          include: ['**/*.web.test.ts'],
          environment: 'browser',
          browser: {
            enabled: true,
            name: 'chromium',
            provider: 'playwright',
            headless: true,
          },
        },
        resolve: { alias },
        assetsInclude: ['**/*.wasm'],
        optimizeDeps: {
          exclude: ['tfhe', 'node-tfhe'],
          esbuildOptions: { target: 'esnext' },
        },
        server: { fs: { allow: ['..'] }, headers: crossOriginIsolationHeaders },
      },

      // HARDHAT 2 (*.hh2.test.ts)
      {
        extends: true,
        test: {
          name: 'hardhat-2',
          include: ['**/*.hh2.test.ts'],
          environment: 'node',
          pool: 'threads',
          poolOptions: { threads: { singleThread: true } },
          isolate: false,
        },
        resolve: { alias },
      },
    ],
  },
});
