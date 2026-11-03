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

const encryptBench = process.env.TEST_ENCRYPT_BENCH_ENABLED === 'true';

// The worker manager loads `./zkProve.worker.js`, the name the file has once built. The test
// server serves sources, where it is `.ts`, so the real worker never starts under test and every
// proof falls back to the main thread. The encrypt benchmark has to measure the worker path, so
// for that run only the request is pointed at the source file.
const serveZkProveWorkerSource = {
  name: 'serve-zk-prove-worker-source',
  configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
    server.middlewares.use((req, _res, next) => {
      if (req.url) req.url = req.url.replace(/\/web\/zkProve\.worker\.js(\?|$)/, '/web/zkProve.worker.ts$1');
      next();
    });
  },
};

// Node 25+ defines a global `localStorage` (undefined unless `--localstorage-file` is set).
// Vitest only copies happy-dom globals that Node does not already define, so happy-dom
// tests see that empty global and the persisted ACP store has no storage. Turning Node's
// Web Storage off lets happy-dom's `localStorage` through. Node 20 rejects the flag, and
// Node 22–24 keep Web Storage off by default, so it is only passed on Node 25+.
const nodeMajor = Number(process.versions.node.split('.')[0]);
const nodeExecArgv = nodeMajor >= 25 ? ['--no-experimental-webstorage'] : [];

export default defineConfig({
  plugins: encryptBench ? [serveZkProveWorkerSource] : [],
  define: {
    __STAGING_TESTS__: JSON.stringify(process.env.TEST_STAGING_ENABLED === 'true'),
    __THREADPOOL_TESTS__: JSON.stringify(process.env.TEST_THREADPOOL_ENABLED === 'true'),
    __ENCRYPT_BENCH__: JSON.stringify(encryptBench),
  },
  resolve: { alias },
  server: { headers: crossOriginIsolationHeaders },

  test: {
    globals: true,
    testTimeout: 15000,
    // Vitest reads fork `execArgv` from the root config only, not from a project.
    poolOptions: { forks: { execArgv: nodeExecArgv } },
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
