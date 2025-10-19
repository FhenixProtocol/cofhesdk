import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    port: 3000,
    fs: {
      allow: ['..', '../..'], // Allow serving files from parent directories (for node_modules)
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    outDir: 'dist',
  },
  // Optimize dependency handling for TFHE
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
