import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm()], // Optimize dependency handling for TFHE
  optimizeDeps: {
    exclude: ['tfhe'], // Don't pre-bundle tfhe to preserve WASM loading
    esbuildOptions: {
      target: 'esnext', // Ensure modern JS features for WASM
    },
  },
  // Handle WASM files as assets
  assetsInclude: ['**/*.wasm'],
  // Define for proper WASM loading
  define: {
    global: 'globalThis',
  },
  // Worker configuration for WASM
  worker: {
    format: 'es',
  },
});
