import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const setupDir = dirname(fileURLToPath(import.meta.url));

const commandStub = `#!/bin/sh
command=$(basename "$0")

if [ "$command" = "cast" ]; then
  case "$1" in
    wallet) printf '%s\\n' '0x1111111111111111111111111111111111111111' ;;
    balance)
      case "$*" in
        *--ether*) printf '%s\\n' '10000' ;;
        *) printf '%s\\n' '1' ;;
      esac
      ;;
    code) printf '%s\\n' '0x' ;;
    rpc) printf '%s\\n' '"0x1"' ;;
  esac
elif [ "$command" = "forge" ]; then
  case "$1" in
    create)
      printf '%s\\n' 'simulated deployment failure' >&2
      exit 17
      ;;
    inspect) printf '%s\\n' '[]' ;;
  esac
fi
`;

test('setup exits non-zero when forge create fails', () => {
  const fixtureDir = mkdtempSync(join(setupDir, '.setup-deployment-failure-'));
  const binDir = join(fixtureDir, 'bin');

  try {
    mkdirSync(binDir);
    mkdirSync(join(fixtureDir, 'out', 'SimpleTest.sol'), { recursive: true });
    mkdirSync(join(fixtureDir, 'src'));
    copyFileSync(join(setupDir, 'setup.mjs'), join(fixtureDir, 'setup.mjs'));
    writeFileSync(
      join(fixtureDir, 'out', 'SimpleTest.sol', 'SimpleTest.json'),
      JSON.stringify({ bytecode: { object: '0x00' } })
    );

    for (const command of ['cast', 'forge', 'npx', 'pnpm']) {
      const commandPath = join(binDir, command);
      writeFileSync(commandPath, commandStub);
      chmodSync(commandPath, 0o755);
    }

    const result = spawnSync(process.execPath, ['setup.mjs', '--chains', '84532'], {
      cwd: fixtureDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        TEST_PRIVATE_KEY: 'placeholder-test-key',
        BASE_SEPOLIA_RPC_URL: 'https://base-sepolia.example.invalid',
      },
    });

    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /FAILED:.*forge create.*simulated deployment failure/s);
    assert.doesNotMatch(result.stdout, /All deployments up to date|Build complete/);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
