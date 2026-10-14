import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { createNodeStorage } from '../storage.js';

const withTempHome = async (fn: (home: string) => Promise<void>) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'cofhe-home-'));
  const oldHome = process.env.HOME;
  process.env.HOME = home;
  try {
    await fn(home);
  } finally {
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    await fs.rm(home, { recursive: true, force: true });
  }
};

describe('node storage permissions', () => {
  it.skipIf(process.platform === 'win32')('does not make stored data readable by other users', () =>
    withTempHome(async (home) => {
      await createNodeStorage().setItem('t', { value: 1 });
      const st = await fs.stat(path.join(home, '.cofhesdk', 't.json'));
      expect(st.mode & 0o077).toBe(0);
    })
  );

  it.skipIf(process.platform === 'win32')('tightens permissions of a file created with loose permissions', () =>
    withTempHome(async (home) => {
      const dir = path.join(home, '.cofhesdk');
      await fs.mkdir(dir, { mode: 0o755 });
      const file = path.join(dir, 't.json');
      await fs.writeFile(file, '{}', { mode: 0o644 });
      await createNodeStorage().setItem('t', { value: 1 });
      expect((await fs.stat(file)).mode & 0o077).toBe(0);
      expect((await fs.stat(dir)).mode & 0o077).toBe(0);
    })
  );
});
