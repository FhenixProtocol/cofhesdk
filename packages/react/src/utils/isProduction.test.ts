import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const modulePath = resolve(__dirname, 'isProduction.ts');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isProduction', () => {
  it('does not reference import.meta in code bundled for CommonJS', () => {
    const source = readFileSync(modulePath, 'utf8');

    expect(source).not.toContain('import.meta');
  });

  it('treats NODE_ENV=development as non-production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');

    const { isProduction } = await import('./isProduction');

    expect(isProduction()).toBe(false);
  });
});
