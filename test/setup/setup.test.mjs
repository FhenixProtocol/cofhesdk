import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const setupDir = dirname(fileURLToPath(import.meta.url));

const commandStub = `#!/bin/sh
command=$(basename "$0")
printf '%s %s\\n' "$command" "$*" >> "$CALL_LOG"

if [ "$command" = "cast" ]; then
  case "$1" in
    wallet)
      printf '%s\\n' '0x1111111111111111111111111111111111111111'
      ;;
    balance)
      case "$*" in
        *--ether*staging-hostchain*)
          if grep -q '^cast send\\b' "$CALL_LOG"; then
            printf '%s\\n' '1'
          else
            printf '%s\\n' '0.01'
          fi
          ;;
        *--ether*) printf '%s\\n' '10000' ;;
        *) printf '%s\\n' '1' ;;
      esac
      ;;
    code)
      printf '%s\\n' '0x'
      ;;
    rpc)
      printf '%s\\n' '"0x1"'
      ;;
    call)
      printf '%s\\n' '0x0'
      ;;
    send)
      printf '%s\\n' 'stubbed transaction'
      ;;
  esac
elif [ "$command" = "forge" ] && [ "$1" = "inspect" ]; then
  printf '%s\\n' '[]'
fi
`;

function runSetup(args) {
  const fixtureDir = mkdtempSync(join(setupDir, '.setup-dry-run-'));
  const binDir = join(fixtureDir, 'bin');
  const callLog = join(fixtureDir, 'calls.log');

  try {
    mkdirSync(binDir);
    mkdirSync(join(fixtureDir, 'out', 'SimpleTest.sol'), { recursive: true });
    mkdirSync(join(fixtureDir, 'src'));
    copyFileSync(join(setupDir, 'setup.mjs'), join(fixtureDir, 'setup.mjs'));
    writeFileSync(
      join(fixtureDir, 'out', 'SimpleTest.sol', 'SimpleTest.json'),
      JSON.stringify({ bytecode: { object: '0x00' } })
    );
    writeFileSync(callLog, '');

    for (const command of ['cast', 'forge', 'npx', 'pnpm']) {
      const commandPath = join(binDir, command);
      writeFileSync(commandPath, commandStub);
      chmodSync(commandPath, 0o755);
    }

    const result = spawnSync(process.execPath, ['setup.mjs', '--chains', '420105', ...args], {
      cwd: fixtureDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
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
