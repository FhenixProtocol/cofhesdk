import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  splitting: false,
  define: {
    'process.env.TEST_PRIVATE_KEY': JSON.stringify(process.env.TEST_PRIVATE_KEY ?? ''),
    'process.env.TEST_LOCALCOFHE_PRIVATE_KEY': JSON.stringify(process.env.TEST_LOCALCOFHE_PRIVATE_KEY ?? ''),
    'process.env.PRIMARY_TEST_CHAIN': JSON.stringify(process.env.PRIMARY_TEST_CHAIN ?? ''),
  },
});
