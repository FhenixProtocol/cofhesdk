// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const alias = { '@': resolve(__dirname, './') }; // or './src'

export default defineConfig({
  resolve: { alias },

  test: {
    globals: true,
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
          exclude: ['**/*.web.test.ts', '**/*.hh2.test.ts', 'node_modules/**', 'dist/**'],
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
        server: { fs: { allow: ['..'] } },
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
      },
    ],
  },
});
