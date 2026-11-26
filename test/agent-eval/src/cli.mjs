#!/usr/bin/env node
// Entry point. See README.md for what each command is for.
import { appendFileSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runAgent } from './agent.mjs';
import { buildReport, latestResultsDir } from './report.mjs';
import { TASKS, taskById } from './tasks.mjs';
import { EVAL_HOME, PACKAGE_ROOT, RESULTS_ROOT, log } from './util.mjs';
import { WORKTREE, packVariant } from './variants.mjs';
import { checkTask, prepareBase, startWorkspace } from './workspace.mjs';

const { positionals, values: flags } = parseArgs({
  allowPositionals: true,
  options: {
    refs: { type: 'string', default: WORKTREE },
    tasks: { type: 'string' },
    trials: { type: 'string', default: '1' },
    model: { type: 'string' },
    budget: { type: 'string', default: '3' },
    timeout: { type: 'string', default: '1200' },
    concurrency: { type: 'string', default: '1' },
    keep: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

const [command, ...rest] = positionals;
const refs = flags.refs
  .split(',')
  .map((ref) => ref.trim())
  .filter(Boolean);
const tasks = flags.tasks ? flags.tasks.split(',').map((id) => taskById(id.trim())) : TASKS;

const stubOf = (task) => join(PACKAGE_ROOT, 'tasks', task.id, 'stub.ts');
const referenceOf = (task) => join(PACKAGE_ROOT, 'tasks', task.id, 'reference.ts');
const scriptIn = (workspace, task) => join(workspace.directory, 'scripts', task.script);

async function packAll() {
  const variants = [];
  for (const ref of refs) variants.push(await packVariant(ref, { force: flags.force }));
  return variants;
}

/**
 * Proves the harness itself, without an agent: for every task the untouched stub must fail the
 * check and the reference solution must pass it.
 */
async function verify() {
  let broken = 0;
  for (const variant of await packAll()) {
    const base = await prepareBase(variant);
    for (const task of tasks) {
      const workspace = await startWorkspace(base, join(EVAL_HOME, 'runs', `verify-${variant.name}-${task.id}`));
      try {
        const clean = await workspace.chain.snapshot();
        await task.seed(workspace.chain, 0);

        copyFileSync(stubOf(task), scriptIn(workspace, task));
        const stub = await checkTask(workspace, task, clean, 1);

        copyFileSync(referenceOf(task), scriptIn(workspace, task));
        const reference = await checkTask(workspace, task, stub.nextSnapshot, 2);

        const ok = !stub.pass && reference.pass;
        if (!ok) broken += 1;
        log(
          `${ok ? 'ok  ' : 'FAIL'} ${variant.name} · ${task.id}: stub ${stub.pass ? 'PASSED (must fail)' : 'fails'}, reference ${reference.pass ? 'passes' : `FAILS: ${reference.reason}`}`
        );
        if (!reference.pass) console.log(reference.scriptTail);
      } finally {
        workspace.stop();
        if (!flags.keep) rmSync(workspace.directory, { recursive: true, force: true });
      }
    }
  }
  if (broken) throw new Error(`${broken} task check(s) are not working`);
  log('every check rejects the stub and accepts the reference solution');
}

/** One agent on one task with one version. */
async function evaluate({ variant, base, task, trial, resultsDir }) {
  const key = `${task.id}__${variant.name}__${trial}`;
  const runDir = join(resultsDir, key);
  mkdirSync(runDir, { recursive: true });

  const workspace = await startWorkspace(base, join(EVAL_HOME, 'runs', `${Date.now()}-${key}`));
  try {
    copyFileSync(stubOf(task), scriptIn(workspace, task));
    const clean = await workspace.chain.snapshot();
    await task.seed(workspace.chain, 0);

    log(`start ${key}`);
    const agent = await runAgent({
      cwd: workspace.directory,
      prompt: task.prompt,
      transcriptPath: join(runDir, 'transcript.jsonl'),
      model: flags.model,
      maxBudgetUsd: Number(flags.budget),
      timeoutMs: Number(flags.timeout) * 1000,
    });

    const verdict = await checkTask(workspace, task, clean, 1);
    copyFileSync(scriptIn(workspace, task), join(runDir, task.script));
    writeFileSync(join(runDir, 'script-output.txt'), verdict.scriptTail);

    const record = { task: task.id, variant: variant.name, trial, pass: verdict.pass, reason: verdict.reason, agent };
    appendFileSync(join(resultsDir, 'runs.jsonl'), `${JSON.stringify(record)}\n`);
    log(
      `${verdict.pass ? 'pass' : 'FAIL'} ${key}: ${agent.turns ?? '?'} turns, $${(agent.costUsd ?? 0).toFixed(2)}${verdict.pass ? '' : ` (${verdict.reason})`}`
    );
  } finally {
    workspace.stop();
    if (!flags.keep) rmSync(workspace.directory, { recursive: true, force: true });
  }
}

async function runEval() {
  const trials = Number(flags.trials);
  const variants = await packAll();
  const bases = new Map();
  for (const variant of variants) bases.set(variant.name, await prepareBase(variant));

  const resultsDir = join(RESULTS_ROOT, new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(
    join(resultsDir, 'meta.json'),
    JSON.stringify(
      {
        trials,
        tasks: tasks.map((task) => task.id),
        variants: variants.map(({ name, ref, commit }) => ({ name, ref, commit })),
      },
      null,
      2
    )
  );

  // Versions alternate inside each task and trial, so a slow or flaky stretch hits all of them.
  const queue = [];
  for (let trial = 1; trial <= trials; trial++) {
    for (const task of tasks) {
      for (const variant of variants) queue.push({ variant, base: bases.get(variant.name), task, trial, resultsDir });
    }
  }
  log(
    `${queue.length} runs, up to $${flags.budget} each (at most $${(queue.length * Number(flags.budget)).toFixed(0)} in total)`
  );

  const workers = Array.from({ length: Math.max(1, Number(flags.concurrency)) }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      await evaluate(job).catch((error) => {
        log(`ERROR ${job.task.id} · ${job.variant.name} · trial ${job.trial}: ${error.message}`);
      });
    }
  });
  await Promise.all(workers);

  console.log(`\n${buildReport(resultsDir)}`);
  log(`report: ${join(resultsDir, 'report.md')}`);
}

const commands = {
  pack: packAll,
  verify,
  run: runEval,
  report: async () => {
    const directory = rest[0] ?? latestResultsDir();
    if (!directory) throw new Error('No results yet. Run `pnpm eval` first.');
    console.log(buildReport(directory));
  },
};

if (!commands[command]) {
  console.error(
    `Usage: node src/cli.mjs <${Object.keys(commands).join('|')}> [--refs a,b] [--tasks x,y] [--trials n]\nSee README.md.`
  );
  process.exit(1);
}

commands[command]().catch((error) => {
  console.error(`[eval] ${error.message}`);
  process.exit(1);
});
