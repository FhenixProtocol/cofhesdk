import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupCommandStubs } from './setup-command-stubs.mjs';

const setupDir = dirname(fileURLToPath(import.meta.url));

function runSetup(args) {
  const fixtureDir = mkdtempSync(join(setupDir, '.setup-dry-run-'));
  const callLog = join(fixtureDir, 'calls.log');

  try {
    mkdirSync(join(fixtureDir, 'out', 'SimpleTest.sol'), { recursive: true });
    mkdirSync(join(fixtureDir, 'src'));
    copyFileSync(join(setupDir, 'setup.mjs'), join(fixtureDir, 'setup.mjs'));
    writeFileSync(
      join(fixtureDir, 'out', 'SimpleTest.sol', 'SimpleTest.json'),
      JSON.stringify({ bytecode: { object: '0x00' } })
    );
    writeFileSync(callLog, '');

    const preload = setupCommandStubs(fixtureDir);

    const result = spawnSync(process.execPath, ['--require', preload, 'setup.mjs', '--chains', '420105', ...args], {
      cwd: fixtureDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        CALL_LOG: callLog,
        TEST_PRIVATE_KEY: 'placeholder-test-key',
        TEST_STAGING_ENABLED: 'true',
        STAGING_RPC_URL: 'https://staging-hostchain-v1.sw-dom.co',
        STAGING_FUNDER_KEY: 'placeholder-funder-key',
      },
    });

    return { result, calls: readFileSync(callLog, 'utf8') };
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

test('dry-run previews staging auto-funding without calling cast send', () => {
  const { result, calls } = runSetup(['--dry-run']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[dry-run\].*would auto-fund/i);
  assert.doesNotMatch(calls, /^cast send\b/m);
});

test('normal setup still auto-funds an underfunded staging deployer', () => {
  const { result, calls } = runSetup([]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Auto-funding.*CoFHE Staging/i);
  assert.match(
    calls,
    /^cast send 0x1111111111111111111111111111111111111111 --value 1ether .* --rpc-url https:\/\/staging-hostchain-v1\.sw-dom\.co$/m
  );
  assert.equal(
    calls.match(/^cast balance .* --ether --rpc-url https:\/\/staging-hostchain-v1\.sw-dom\.co$/gm)?.length,
    2
  );
});
