import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/consts.ts'], // add all needed files here

  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['hardhat', '@nomicfoundation/hardhat-ethers', 'ethers'],
});
