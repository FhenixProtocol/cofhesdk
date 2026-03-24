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

const hasForge = hasCommand('forge');

if (hasForge) {
  run('forge', ['build', '-q']);
  run('tsx', ['scripts/build-artifacts.ts']);
  run('npx', ['typechain', '--target', 'ethers-v6', '--out-dir', 'src/typechain-types', 'abi/*.json']);
  run('tsx', ['scripts/remove-typechain-factories.ts']);
  run('prettier', ['--write', 'src/**/*.ts']);
} else {
  // In CI environments like Vercel, Foundry may not be installed.
  // This package checks in `abi/` and the generated TS sources,
  // so we can still build the JS bundle without regenerating them.
  console.warn(
    '[mock-contracts] forge not found; skipping artifact/typechain generation and using checked-in sources.'
  );
}

run('tsup');
