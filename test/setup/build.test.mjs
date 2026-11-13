import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const setupDir = dirname(fileURLToPath(import.meta.url));

function build(exitCode = 0) {
  const dir = mkdtempSync(join(tmpdir(), 'cofhe build with spaces '));
  try {
    const cliDir = join(dir, 'node_modules', 'tsup', 'dist');
    mkdirSync(cliDir, { recursive: true });
    copyFileSync(join(setupDir, 'scripts', 'build.mjs'), join(dir, 'build.mjs'));
    writeFileSync(
      join(dir, 'node_modules', 'tsup', 'package.json'),
      JSON.stringify({ name: 'tsup', version: '0.0.0' })
    );
    writeFileSync(
      join(cliDir, 'cli-default.js'),
      `require('node:fs').writeFileSync('cli-ran.json', JSON.stringify({node: process.execPath, args: process.argv.slice(2)})); process.exit(${exitCode});`
    );
    writeFileSync(
      join(dir, 'probe.cjs'),
      `const cp = require('node:child_process');
const spawn = cp.spawnSync;
cp.spawnSync = (command, args, options) => {
  require('node:fs').appendFileSync('spawn.jsonl', JSON.stringify({command, args, shell: options.shell}) + '\\n');
  if ((command === 'where' || command === 'which') && args[0] === 'forge') return {status: 1};
  if (command === 'forge') throw new Error('Foundry must not run in this fixture');
  return spawn(command, args, options);
};
require('node:module').syncBuiltinESMExports();`
    );
    const result = spawnSync(process.execPath, ['--require', join(dir, 'probe.cjs'), join(dir, 'build.mjs')], {
      cwd: dir,
      encoding: 'utf8',
    });
    return {
      result,
      cli: existsSync(join(dir, 'cli-ran.json')) ? JSON.parse(readFileSync(join(dir, 'cli-ran.json'), 'utf8')) : null,
      spawns: readFileSync(join(dir, 'spawn.jsonl'), 'utf8').trim().split('\n').map(JSON.parse),
    };
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    rmSync(dir, { recursive: true, force: true });
  }
}

test('build resolves the installed CLI and invokes Node without a shell from a path with spaces', () => {
  const { result, cli, spawns } = build();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(cli.node, process.execPath);
  assert.deepEqual(cli.args, []);
  assert.equal(spawns[0].command, process.execPath);
  assert.match(spawns[0].args[0], /node_modules[/\\]tsup[/\\]dist[/\\]cli-default\.js$/);
  assert.equal(spawns[0].shell, false);
  assert.match(result.stderr, /forge not found; skipping forge build/);
});

test('build preserves the CLI failure status instead of continuing to Foundry', () => {
  const { result, cli, spawns } = build(7);
  assert.equal(result.status, 7, result.stderr);
  assert.ok(cli);
  assert.equal(spawns.length, 1);
});
