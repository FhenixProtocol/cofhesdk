#!/usr/bin/env node
import { stat } from 'node:fs/promises';

import { checkBuildInfoDir, checkBuildInfoFile, formatFindings } from './index.js';

const USAGE = `cofhe contract-check

  Verifies the encrypted-type boundary rules against compiler output.

  Usage:
    contract-check [path]        path to a build-info file or directory
                                 (default: artifacts/build-info, then out/build-info)
    contract-check --help

  Exit code is 1 when any error-severity finding is reported.
`;

async function resolveTarget(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  for (const candidate of ['artifacts/build-info', 'out/build-info']) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // try the next default
    }
  }
  throw new Error(
    'No build-info found. Compile first, or pass the path explicitly (see --help).',
  );
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    process.stdout.write(USAGE);
    return;
  }

  const target = await resolveTarget(arg);
  const info = await stat(target);
  const findings = info.isDirectory()
    ? await checkBuildInfoDir(target)
    : await checkBuildInfoFile(target);

  process.stdout.write(`${formatFindings(findings)}\n`);
  if (findings.some((f) => f.severity === 'error')) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`contract-check: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
