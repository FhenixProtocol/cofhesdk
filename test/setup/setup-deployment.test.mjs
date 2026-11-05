import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupCommandStubs } from './setup-command-stubs.mjs';

const setupDir = dirname(fileURLToPath(import.meta.url));

test('setup exits non-zero when forge create fails', () => {
  const fixtureDir = mkdtempSync(join(setupDir, '.setup-deployment-failure-'));

  try {
    mkdirSync(join(fixtureDir, 'out', 'SimpleTest.sol'), { recursive: true });
    mkdirSync(join(fixtureDir, 'src'));
    copyFileSync(join(setupDir, 'setup.mjs'), join(fixtureDir, 'setup.mjs'));
    writeFileSync(
      join(fixtureDir, 'out', 'SimpleTest.sol', 'SimpleTest.json'),
      JSON.stringify({ bytecode: { object: '0x00' } })
    );

    const preload = setupCommandStubs(fixtureDir, { failDeployment: true });

    const result = spawnSync(process.execPath, ['--require', preload, 'setup.mjs', '--chains', '84532'], {
      cwd: fixtureDir,
      encoding: 'utf8',
      env: {
        ...process.env,
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
