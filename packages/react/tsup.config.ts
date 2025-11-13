import { defineConfig } from 'tsup';

export default defineConfig({
  // Keep only JS/TS entry files in tsup. We'll copy CSS to `dist` in a post-build step
  // to avoid tsup generating a malformed CSS source map.
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: false, // Disabled because nodemon cleans before each run
  external: ['react', 'react-dom', '@mui/material', '@mui/icons-material', '@cofhe/sdk'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  onSuccess: 'echo "Build completed successfully"',
});
