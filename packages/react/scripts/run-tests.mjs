#!/usr/bin/env node
// `pnpm test`. The unit project always runs. The chain project runs only in CI, because it needs
// anvil, forge and the Playwright Chromium. Run it by hand with `pnpm test:chain`.

import { execSync } from 'node:child_process';

const projects = process.env.CI === 'true' ? ['unit', 'chain'] : ['unit'];

for (const project of projects) {
  console.log(`[react] vitest run --project ${project}`);
  execSync(`pnpm exec vitest run --project ${project}`, { stdio: 'inherit' });
}
