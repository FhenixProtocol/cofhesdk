// A workspace is one copy of the fixture project with one variant installed and its own local
// chain. The agent works in it, then the harness checks it.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { ACCOUNT_KEY, connectChain } from './chain.mjs';
import { EVAL_HOME, PACKAGE_ROOT, log, run, runOrThrow } from './util.mjs';

const FIXTURE = join(PACKAGE_ROOT, 'fixture');
const VAULT_ARTIFACT = 'artifacts/contracts/EvalVault.sol/EvalVault.json';

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

/**
 * The fixture with `variant` installed and the contract compiled. Built once per variant, then
 * copied for every run: installing takes a minute, copying a second.
 */
export async function prepareBase(variant) {
  const base = join(EVAL_HOME, 'base', variant.name);
  const stamp = join(base, '.eval-base.json');
  const identity = JSON.stringify({ commit: variant.commit, tarballs: variant.tarballs });

  if (variant.commit !== 'worktree' && existsSync(stamp) && readFileSync(stamp, 'utf8') === identity) return base;

  log(`${variant.name}: installing the fixture project`);
  rmSync(base, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  cpSync(FIXTURE, base, { recursive: true });

  let manifest = readFileSync(join(base, 'package.json'), 'utf8');
  for (const [placeholder, packageName] of [
    ['__COFHE_SDK__', '@cofhe/sdk'],
    ['__COFHE_MOCK_CONTRACTS__', '@cofhe/mock-contracts'],
    ['__COFHE_HARDHAT_PLUGIN__', '@cofhe/hardhat-plugin'],
  ]) {
    manifest = manifest.replaceAll(placeholder, `file:${variant.tarballs[packageName]}`);
  }
  writeFileSync(join(base, 'package.json'), manifest);

  // --ignore-workspace: never let a pnpm-workspace.yaml further up claim this project.
  await runOrThrow('pnpm', ['install', '--ignore-workspace', '--prefer-offline'], { cwd: base });
  await runOrThrow('npx', ['hardhat', 'compile'], { cwd: base });

  writeFileSync(stamp, identity);
  return base;
}

/**
 * Copies the base into a fresh directory, starts a Hardhat node in it and deploys the vault.
 * @returns the workspace, with `stop()` to shut the node down.
 */
export async function startWorkspace(base, directory) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  // -c clones on APFS (instant, no extra disk); plain -R everywhere else.
  const cloned = await run('cp', ['-cR', `${base}/.`, directory]);
  if (cloned.code !== 0) await runOrThrow('cp', ['-R', `${base}/.`, directory]);
  rmSync(join(directory, '.eval-base.json'), { force: true });

  const port = await freePort();
  const rpcUrl = `http://127.0.0.1:${port}`;
  const node = spawn('npx', ['hardhat', 'node', '--port', String(port), '--hostname', '127.0.0.1'], {
    cwd: directory,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // its own process group, so stop() takes the node's children with it
  });
  let nodeOutput = '';
  node.stdout.on('data', (chunk) => (nodeOutput = (nodeOutput + chunk).slice(-4000)));
  node.stderr.on('data', (chunk) => (nodeOutput = (nodeOutput + chunk).slice(-4000)));

  const stop = () => {
    try {
      process.kill(-node.pid, 'SIGKILL');
    } catch {
      // already gone
    }
  };

  try {
    const chain = connectChain(rpcUrl);
    const deadline = Date.now() + 90_000;
    while (!(await chain.mocksReady())) {
      if (node.exitCode !== null) throw new Error(`hardhat node exited:\n${nodeOutput}`);
      if (Date.now() > deadline) throw new Error(`hardhat node did not deploy the mocks in 90s:\n${nodeOutput}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const artifact = JSON.parse(readFileSync(join(directory, VAULT_ARTIFACT), 'utf8'));
    const vaultAddress = await chain.deployVault(artifact);
    writeFileSync(
      join(directory, 'eval-env.json'),
      JSON.stringify({ rpcUrl, chainId: 31337, privateKey: ACCOUNT_KEY, vaultAddress }, null, 2)
    );

    return { directory, chain, stop };
  } catch (error) {
    stop();
    throw error;
  }
}

/** Runs the task's script the way the prompt says to, and reports what it printed. */
export async function runScript(workspace, script, timeoutMs = 180_000) {
  const result = await run('npx', ['tsx', `scripts/${script}`], { cwd: workspace.directory, timeoutMs });
  return { exitCode: result.code, timedOut: result.timedOut, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Decides whether the script in the workspace solves the task. The chain is rewound to the state
 * before the agent touched it and seeded with new values, then the script runs once.
 */
export async function checkTask(workspace, task, cleanSnapshot, attempt) {
  await workspace.chain.revert(cleanSnapshot);
  const nextSnapshot = await workspace.chain.snapshot();
  const seeded = await task.seed(workspace.chain, attempt);

  const scriptRun = await runScript(workspace, task.script);
  const tail = `${scriptRun.stdout}\n${scriptRun.stderr}`.trim().split('\n').slice(-15).join('\n');

  let verdict;
  if (scriptRun.timedOut) verdict = { pass: false, reason: 'the script did not finish in 180s' };
  else if (scriptRun.exitCode !== 0)
    verdict = { pass: false, reason: `the script exited with code ${scriptRun.exitCode}` };
  else verdict = await task.check(workspace.chain, scriptRun, seeded);

  return { ...verdict, scriptTail: tail, nextSnapshot };
}
