import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    adapters: 'adapters/index.ts',
    chains: 'chains/index.ts',
    permits: 'permits/index.ts',
    node: 'node/index.ts',
    web: 'web/index.ts',
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
  },
});
