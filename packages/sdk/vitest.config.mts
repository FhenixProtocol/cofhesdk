import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const alias = { '@': resolve(__dirname, './') }; // or './src'
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { name?: string; version?: string };

export default defineConfig({
  resolve: { alias },

  define: {
    'globalThis.__COFHE_SDK_NAME__': JSON.stringify(pkg.name ?? '@cofhe/sdk'),
    'globalThis.__COFHE_SDK_VERSION__': JSON.stringify(pkg.version ?? '0.0.0'),
  },

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
        resolve: { alias },
      },
    ],
  },
});
