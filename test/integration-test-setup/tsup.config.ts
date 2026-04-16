import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  splitting: false,
  define: {
    'process.env.TEST_LOCALCOFHE_ENABLED': JSON.stringify(process.env.TEST_LOCALCOFHE_ENABLED ?? ''),
    'process.env.TEST_LOCALCOFHE_PRIVATE_KEY': JSON.stringify(process.env.TEST_LOCALCOFHE_PRIVATE_KEY ?? ''),
    'process.env.COFHE_CHAIN_ID': JSON.stringify(process.env.COFHE_CHAIN_ID ?? ''),
    'process.env.PRIMARY_TEST_CHAIN': JSON.stringify(process.env.PRIMARY_TEST_CHAIN ?? ''),
  },
});
