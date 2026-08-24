#!/usr/bin/env node
import { stat } from 'node:fs/promises';

import { checkBuildInfoDir, checkBuildInfoFile, formatFindings, type ProofStyle } from './index.js';

const USAGE = `cofhe contract-check

  Verifies the encrypted-type boundary rules against compiler output.

  Usage:
    contract-check [path]        path to a build-info file or directory
                                 (default: artifacts/build-info, then out/build-info)
    contract-check --help

  Options:
    --proof-style <style>        any (default) | per-value | trailing
                                 House arrangement for proofs covering external
                                 inputs. Both arrangements are valid in the
                                 library, so this only reports deviations when
                                 you pin one; it never blocks by default.

  Exit code is 1 when any error-severity finding is reported.
`;

const PROOF_STYLES = new Set<ProofStyle>(['any', 'per-value', 'trailing']);

function parseProofStyle(argv: string[]): ProofStyle {
  const at = argv.indexOf('--proof-style');
  if (at === -1) return 'any';
  const value = argv[at + 1];
  if (!value || !PROOF_STYLES.has(value as ProofStyle)) {
    throw new Error(
      `--proof-style expects one of: ${[...PROOF_STYLES].join(', ')}`,
    );
  }
  return value as ProofStyle;
}

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
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }

  const proofStyle = parseProofStyle(argv);
  const positional = argv.filter(
    (a, i) => !a.startsWith('-') && argv[i - 1] !== '--proof-style',
  );

  const target = await resolveTarget(positional[0]);
  const info = await stat(target);
  const options = { proofStyle };
  const findings = info.isDirectory()
    ? await checkBuildInfoDir(target, options)
    : await checkBuildInfoFile(target, options);

  process.stdout.write(`${formatFindings(findings)}\n`);
  if (findings.some((f) => f.severity === 'error')) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`contract-check: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
