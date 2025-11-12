import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [],
    // Suppress React act() warnings in tests - hooks handle their own state updates
    onConsoleLog: (log) => {
      if (log.includes('Warning: An update to TestComponent inside a test was not wrapped in act')) {
        return false;
      }
      return true;
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

