import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as { name?: string; version?: string };

export default defineConfig({
  entry: {
    core: 'core/index.ts',
    adapters: 'adapters/index.ts',
    chains: 'chains/index.ts',
    permits: 'permits/index.ts',
    node: 'node/index.ts',
    web: 'web/index.ts',
    'zkProve.worker': 'web/zkProve.worker.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['node-tfhe', 'tfhe'],
  treeshake: true,
  esbuildOptions(options) {
    options.alias = {
      '@': './',
    };

    options.define = {
      ...(options.define ?? {}),
      'globalThis.__COFHE_SDK_NAME__': JSON.stringify(pkg.name ?? '@cofhe/sdk'),
      'globalThis.__COFHE_SDK_VERSION__': JSON.stringify(pkg.version ?? '0.0.0'),
    };
  },
});
