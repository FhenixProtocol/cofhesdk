// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const alias = { '@': resolve(__dirname, './') }; // or './src'

export default defineConfig({
  resolve: { alias },

  // global config (applies to all projects)
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'dist/**', '**/*.config.*'],
    },

    // 👇 Vitest 3: define projects here
    projects: [
      {
        // inherit root config
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: ['web/**', 'node_modules/**', 'dist/**'],
        },
        resolve: { alias },
      },
      {
        extends: true,
        test: {
          name: 'web',
          include: ['web/**/*.test.ts'],
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
    ],
  },
});
