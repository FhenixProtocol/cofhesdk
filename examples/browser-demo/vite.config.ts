import { defineConfig } from 'vite';

export default defineConfig({
  // `tfhe` loads its WASM via:
  //   new URL('tfhe_bg.wasm', import.meta.url)
  // Vite's dependency prebundling can break this, leading to the dev server
  // returning HTML (index.html) instead of the .wasm file.
  optimizeDeps: {
    exclude: ['tfhe'],
  },
  assetsInclude: ['**/*.wasm'],
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
