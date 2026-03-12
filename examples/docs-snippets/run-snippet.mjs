import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , snippetPath] = process.argv;

if (!snippetPath) {
  console.error('Usage: node run-snippet.mjs <relative-snippet-path>');
  process.exit(2);
}

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const envFilePath = resolve(here, '../../.env');
const hasEnvFile = existsSync(envFilePath);

const args = [];
if (hasEnvFile) args.push('--env-file', envFilePath);
args.push('--import', 'tsx', snippetPath);

const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
  cwd: here,
});

process.exit(result.status ?? 1);
