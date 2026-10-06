import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { createNodeStorage } from '../storage.js';

describe('@cofhe/node - filesystem storage', () => {
  let testHome: string;
  let previousHome: string | undefined;
  let previousUserProfile: string | undefined;

  beforeEach(async () => {
    previousHome = process.env.HOME;
    previousUserProfile = process.env.USERPROFILE;
    testHome = await mkdtemp(join(tmpdir(), 'cofhe-storage-'));
    process.env.HOME = testHome;
    delete process.env.USERPROFILE;
  });

  afterEach(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    if (previousUserProfile === undefined) {
      delete process.env.USERPROFILE;
    } else {
      process.env.USERPROFILE = previousUserProfile;
    }

    await rm(testHome, { recursive: true, force: true });
  });

  it('persists writes without leaving temporary files behind', async () => {
    const storage = createNodeStorage();
    const value = { fhe: { 1: { 0: 'key' } }, crs: { 1: 'crs' } };

    await storage.setItem('atomic-write', value);

    const storageDir = join(testHome, '.cofhesdk');
    const files = await readdir(storageDir);
    const persisted = JSON.parse(await readFile(join(storageDir, 'atomic-write.json'), 'utf8'));

    expect(persisted).toEqual(value);
    expect(files).toEqual(['atomic-write.json']);
  });
});
