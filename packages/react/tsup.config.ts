import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/styles.css'],
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
