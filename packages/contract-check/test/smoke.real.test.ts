/**
 * Smoke test against real compiler output.
 *
 * Point CONTRACT_CHECK_FIXTURE at any project's build-info directory to see the
 * rules run over production sources:
 *
 *   CONTRACT_CHECK_FIXTURE=../my-app/artifacts/build-info pnpm test
 *
 * Skipped when unset (the default, including CI), so the suite never depends on
 * a particular checkout.
 */
import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { checkBuildInfoDir, formatFindings } from '../src/index.js';

const REAL_BUILD_INFO = process.env.CONTRACT_CHECK_FIXTURE;

const maybe = REAL_BUILD_INFO && existsSync(REAL_BUILD_INFO) ? describe : describe.skip;

maybe('real build-info', () => {
  it('parses production output and reports findings without throwing', async () => {
    const findings = await checkBuildInfoDir(REAL_BUILD_INFO!);

    // eslint-disable-next-line no-console -- the point of the smoke test
    console.log(formatFindings(findings));

    for (const f of findings) {
      expect(f.file).toBeTruthy();
      expect(f.line).toBeGreaterThan(0);
      expect(f.message).toBeTruthy();
    }
  });
});
