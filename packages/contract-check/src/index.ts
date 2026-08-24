import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { runRules, type Finding } from './rules/index.js';
import { sourceUnitsFromBuildInfo, type BuildInfo } from './walk.js';

export type { Finding, Severity, Rule } from './rules/index.js';
export { RULES } from './rules/index.js';

/** Sources exempt from the rules: the FHE library defines the turnstile itself. */
const DEFAULT_LIBRARY_PATHS = ['@fhenixprotocol/cofhe-contracts/', '/FHE.sol'];

export interface CheckOptions {
  /** Path fragments treated as library code (defaults cover cofhe-contracts). */
  libraryPaths?: string[];
}

export function checkBuildInfo(buildInfo: BuildInfo, options: CheckOptions = {}): Finding[] {
  const units = sourceUnitsFromBuildInfo(buildInfo);
  return runRules({
    units,
    libraryPaths: options.libraryPaths ?? DEFAULT_LIBRARY_PATHS,
  });
}

export async function checkBuildInfoFile(
  path: string,
  options: CheckOptions = {},
): Promise<Finding[]> {
  const raw = await readFile(path, 'utf8');
  return checkBuildInfo(JSON.parse(raw) as BuildInfo, options);
}

/**
 * Check every build-info JSON in a directory — the shape hardhat
 * (`artifacts/build-info`) and foundry (`out/build-info`) both produce.
 */
export async function checkBuildInfoDir(
  dir: string,
  options: CheckOptions = {},
): Promise<Finding[]> {
  const entries = await readdir(dir);
  const files = entries.filter((f) => f.endsWith('.json'));
  const all: Finding[] = [];
  for (const file of files) {
    all.push(...(await checkBuildInfoFile(join(dir, file), options)));
  }
  return dedupe(all);
}

/** The same source can appear in several build-info files. */
function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.rule}|${f.file}|${f.line}|${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return 'cofhe contract-check: no violations found.';
  const lines = findings.map(
    (f) => `  ${f.severity === 'error' ? 'error' : 'warn '} ${f.file}:${f.line}  [${f.rule}]\n         ${f.message}`,
  );
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  return `cofhe contract-check: ${errors} error(s), ${warnings} warning(s)\n${lines.join('\n')}`;
}
