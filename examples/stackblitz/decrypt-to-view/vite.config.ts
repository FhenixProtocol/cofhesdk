import { defineConfig } from 'vite';

export default defineConfig({
  // The SDK's web entrypoint uses workers; ensure Vite emits module workers.
  worker: {
    format: 'es',
  },
});
