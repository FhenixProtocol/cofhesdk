import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');

/**
 * Where tarballs, installed fixtures and agent workspaces live. Outside the repository on purpose:
 * the agent must only see what `npm install` gives a user, not the SDK sources next door.
 */
export const EVAL_HOME = process.env.COFHE_EVAL_HOME ?? join(tmpdir(), 'cofhe-agent-eval');

export const RESULTS_ROOT = join(PACKAGE_ROOT, 'results');

export const log = (message) => console.log(`[eval] ${message}`);

/**
 * Runs a command to completion.
 * @returns {Promise<{ code: number | null, stdout: string, stderr: string, timedOut: boolean }>}
 */
export function run(command, args, { cwd, env, timeoutMs, input } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, timeoutMs)
      : undefined;

    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr, timedOut });
    });
    child.stdin.end(input ?? '');
  });
}

/** `run`, throwing with the output when the command fails. */
export async function runOrThrow(command, args, options = {}) {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    const tail = `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-25).join('\n');
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.timedOut ? 'timeout' : `exit ${result.code}`}):\n${tail}`
    );
  }
  return result;
}

export const median = (values) => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
