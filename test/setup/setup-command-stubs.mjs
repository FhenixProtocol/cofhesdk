import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Patch the child process before its ESM imports load. These tests exercise
// setup's command decisions, without relying on /bin/sh, PATH shims or Foundry.
export function setupCommandStubs(fixtureDir, { failDeployment = false } = {}) {
  const preload = join(fixtureDir, 'command-stubs.cjs');
  writeFileSync(
    preload,
    `
const cp = require('node:child_process');
const fs = require('node:fs');
const log = ${JSON.stringify(join(fixtureDir, 'calls.log'))};
fs.writeFileSync(log, '');
cp.execSync = (command) => {
  command = command.replace(' 2>/dev/null', '');
  fs.appendFileSync(log, command + '\\n');
  if (command.startsWith('cast wallet ')) return '0x1111111111111111111111111111111111111111';
  if (command.startsWith('cast balance ')) {
    if (!command.includes('--ether')) return '1';
    if (command.includes('staging-hostchain')) return /^cast send\\b/m.test(fs.readFileSync(log, 'utf8')) ? '1' : '0.01';
    return '10000';
  }
  if (command.startsWith('cast code ')) return '0x';
  if (command.startsWith('cast rpc ')) return '"0x1"';
  if (command.startsWith('cast call ')) return '0x0';
  if (command.startsWith('cast send ')) return 'stubbed transaction';
  if (command.startsWith('forge create ')) {
    if (${JSON.stringify(failDeployment)}) throw new Error('Command failed: ' + command + '\\nsimulated deployment failure');
    return 'Deployed to: 0x2222222222222222222222222222222222222222';
  }
  if (command.startsWith('forge inspect ')) return '[]';
  if (/^(forge build|npx |pnpm )/.test(command)) return '';
  throw new Error('Unstubbed setup command: ' + command);
};
require('node:module').syncBuiltinESMExports();
`
  );
  return preload;
}
