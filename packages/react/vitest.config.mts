import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const alias = {
  '@': resolve(__dirname, './src'),
  // The chain tests import the package by name, the way an app does. Point it at the source.
  '@cofhe/react': resolve(__dirname, './src/index.ts'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    projects: [
      {
        // Hook and store tests with mocked clients. No chain.
        resolve: { alias },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['dist/**', 'node_modules/**'],
        },
      },
      {
        // Hook tests against a chain: an Anvil with the CoFHE mocks, in Chromium.
        // Needs anvil, forge and the Playwright Chromium. See test/chain/README.md.
        // `pnpm test:unit` skips it.
        resolve: { alias },
        test: {
          name: 'chain',
          globals: true,
          testTimeout: 180_000,
          globalSetup: ['./test/chain/anvil.setup.ts'],
          include: ['test/chain/**/*.web.test.tsx'],
          environment: 'browser',
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
        assetsInclude: ['**/*.wasm'],
        optimizeDeps: {
          // Pre-bundle the react stack. If Vite discovers it mid-run it reloads the browser,
          // which kills the test connection.
          include: [
            'react',
            'react/jsx-dev-runtime',
            'react/jsx-runtime',
            'react-dom',
            'react-dom/client',
            '@testing-library/react',
            '@tanstack/react-query',
          ],
          exclude: ['tfhe', 'node-tfhe'],
          esbuildOptions: { target: 'esnext' },
        },
        server: { fs: { allow: ['../..'] } },
      },
    ],
  },
});
