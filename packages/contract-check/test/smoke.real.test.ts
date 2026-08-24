/**
 * Smoke test against real compiler output, when a local build-info is present.
 *
 * Skipped automatically where the artifacts are absent (CI, fresh clones), so
 * it documents behaviour on production sources without becoming a dependency
 * on someone else's checkout.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkBuildInfoDir, formatFindings } from '../src/index.js';

const REAL_BUILD_INFO = join(
  homedir(),
  'repos/TGE-platform/contracts/stablecoin/artifacts/build-info',
);

const maybe = existsSync(REAL_BUILD_INFO) ? describe : describe.skip;

maybe('real build-info', () => {
  it('parses production output and reports findings without throwing', async () => {
    const findings = await checkBuildInfoDir(REAL_BUILD_INFO);

    // eslint-disable-next-line no-console -- the point of the smoke test
    console.log(formatFindings(findings));

    for (const f of findings) {
      expect(f.file).toBeTruthy();
      expect(f.line).toBeGreaterThan(0);
      expect(f.message).toBeTruthy();
    }
  });
});
