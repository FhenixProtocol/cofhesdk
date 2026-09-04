#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function hasCommand(cmd) {
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';
  const res = spawnSync(whichCmd, [cmd], { stdio: 'ignore', shell: false });
  return res.status === 0;
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

run('tsup', []);

if (hasCommand('forge')) {
  run('forge', ['build']);
} else {
  // Same fallback as @cofhe/mock-contracts. This package is a devDependency of
  // @cofhe/sdk, so a docs-only build (@cofhe/site on Vercel) pulls it in even
  // though nothing in the docs needs compiled contracts. The forge build step
  // writes out/, which setup.mjs reads when deploying test contracts — never
  // the bundle tsup produces above. Skipping it still yields a complete dist/;
  // every flow that actually needs out/ runs with Foundry installed.
  console.warn(
    '[test-setup] forge not found; skipping forge build. dist/ is unaffected, but pnpm test:setup needs Foundry.'
  );
}
