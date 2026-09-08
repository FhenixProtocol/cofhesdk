import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { createNodeStorage } from '../storage.js';

describe('createNodeStorage memory fallback', () => {
  let originalHome: string | undefined;
  let testDir: string;
  let invalidHome: string;

  beforeEach(async () => {
    originalHome = process.env.HOME;
    testDir = await fs.mkdtemp(join(tmpdir(), 'cofhesdk-storage-fallback-'));

    // HOME points to a regular file, so creating HOME/.cofhesdk fails.
    invalidHome = join(testDir, 'not-a-directory');
    await fs.writeFile(invalidHome, 'file', 'utf8');
    process.env.HOME = invalidHome;
  });

  afterEach(async () => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('round-trips the same value when filesystem storage is unavailable', async () => {
    const storage = createNodeStorage();
    const value = {
      state: {
        fhe: { 1: { 0: 'key' } },
        crs: { 1: 'crs' },
      },
      version: 0,
    };

    await storage.setItem('fallback-roundtrip', value);

    await expect(storage.getItem('fallback-roundtrip')).resolves.toEqual(value);
  });
});
