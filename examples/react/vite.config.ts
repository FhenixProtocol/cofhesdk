import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig(({ mode }) => {
  // Optional comma-separated host allowlist for serving the app to other
  // devices through a proxy (set VITE_ALLOWED_HOSTS in .env.local).
  const allowedHosts = loadEnv(mode, __dirname, 'VITE_').VITE_ALLOWED_HOSTS?.split(',') ?? [];

  return {
    plugins: [react(), wasm(), topLevelAwait()],
    server: {
      // 5199: the local CoFHE stack occupies :3000 (threshold network). Bound to
      // all interfaces so other devices can reach the dev server; port pinned so
      // external proxy mappings stay valid, strictPort fails loudly instead of hopping.
      port: 5199,
      host: true,
      strictPort: true,
      allowedHosts,
      fs: {
        allow: ['..', '../..'], // Allow serving files from parent directories (for node_modules)
      },
      headers: {
        // Use 'credentialless' instead of 'require-corp' to allow external images
        // while still enabling SharedArrayBuffer for WASM
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
    build: {
      outDir: 'dist',
    },
    // `vite preview` (production build) with the same reachability as the dev server.
    preview: {
      host: true,
      port: 5198,
      strictPort: true,
      allowedHosts,
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
  };
});
