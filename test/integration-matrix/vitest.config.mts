import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 180_000,
    globalSetup: ['./setup/anvil.ts'],
    // suites share one anvil instance and the zk-verifier signer wallet —
    // parallel files race its nonce (observed: 'Nonce provided ... too low')
    fileParallelism: false,

    projects: [
      {
        test: {
          name: 'node',
          globals: true,
          testTimeout: 180_000,
          environment: 'node',
          include: ['test/**/*.test.ts'],
          exclude: ['test/**/*.web.test.ts'],
        },
      },

      {
        test: {
          name: 'web',
          globals: true,
          testTimeout: 180_000,
          include: ['test/**/*.web.test.ts'],
          environment: 'browser',
          browser: {
            enabled: true,
            name: 'chromium',
            provider: 'playwright',
            headless: true,
          },
        },
        assetsInclude: ['**/*.wasm'],
        optimizeDeps: {
          exclude: ['tfhe', 'node-tfhe'],
          esbuildOptions: { target: 'esnext' },
        },
        server: { fs: { allow: ['../..'] } },
      },
    ],
  },
});
