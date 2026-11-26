// Turns the runs of one evaluation into a Markdown report.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranscriptReader } from './agent.mjs';
import { RESULTS_ROOT, median } from './util.mjs';

export const latestResultsDir = () => {
  if (!existsSync(RESULTS_ROOT)) return undefined;
  const runs = readdirSync(RESULTS_ROOT).filter((name) => existsSync(join(RESULTS_ROOT, name, 'runs.jsonl')));
  return runs.length ? join(RESULTS_ROOT, runs.sort().at(-1)) : undefined;
};

/**
 * The runs of an evaluation. Their agent metrics are read again from the saved transcripts, so a
 * report always reflects the current way of counting, also for an evaluation run earlier.
 */
export const readRuns = (directory) =>
  readFileSync(join(directory, 'runs.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .map((run) => {
      const transcript = join(directory, `${run.task}__${run.variant}__${run.trial}`, 'transcript.jsonl');
      if (!existsSync(transcript)) return run;

      const { metrics, onEvent } = createTranscriptReader();
      for (const line of readFileSync(transcript, 'utf8').split('\n')) {
        try {
          onEvent(JSON.parse(line));
        } catch {
          // not an event line
        }
      }
      // A run cut off by the harness has no result event: keep what the harness recorded for it.
      return metrics.turns === undefined ? run : { ...run, agent: { ...run.agent, ...metrics } };
    });

const number = (value, digits = 0) => (value === undefined ? '-' : value.toFixed(digits));
const usd = (value) => (value === undefined ? '-' : `$${value.toFixed(2)}`);

/** One row of numbers for a set of runs. */
function summarize(runs) {
  const of = (key) => runs.map((run) => run.agent[key]).filter((value) => typeof value === 'number');
  const passed = runs.filter((run) => run.pass).length;
  return {
    runs: runs.length,
    passed,
    unattended: runs.filter((run) => run.pass && run.agent.finished).length,
    turns: median(of('turns')),
    // Turns only count for a run that got there: a fast failure is not a good result.
    turnsWhenPassed: median(
      runs
        .filter((run) => run.pass)
        .map((run) => run.agent.turns)
        .filter((v) => typeof v === 'number')
    ),
    toolErrors: median(of('toolErrors')),
    cost: median(of('costUsd')),
    minutes: median(of('durationMs').map((ms) => ms / 60_000)),
  };
}

const row = (label, s) =>
  `| ${label} | ${s.passed}/${s.runs} | ${number(s.turnsWhenPassed)} | ${number(s.turns)} | ${number(s.toolErrors)} | ${usd(s.cost)} | ${number(s.minutes, 1)} |`;

const SIGNALS = [
  ['sawModuleError', 'hit an import or module error'],
  ['sawTypeError', 'hit a TypeScript error'],
  ['sawCofheError', 'hit a CofheError'],
  ['openedReadme', 'opened the SDK README'],
  ['openedErrorGuide', 'opened the error guide'],
  ['openedTypes', 'opened the SDK type declarations'],
  ['openedSource', 'opened the SDK source'],
];

export function buildReport(directory) {
  const runs = readRuns(directory);
  const variants = [...new Set(runs.map((run) => run.variant))];
  const tasks = [...new Set(runs.map((run) => run.task))];
  const meta = existsSync(join(directory, 'meta.json'))
    ? JSON.parse(readFileSync(join(directory, 'meta.json'), 'utf8'))
    : {};
  const lines = [];

  lines.push('# Agent eval', '');
  lines.push(
    `- Runs: ${runs.length} (${tasks.length} tasks x ${variants.length} versions x ${meta.trials ?? '?'} trials)`
  );
  lines.push(`- Model: ${[...new Set(runs.map((run) => run.agent.model).filter(Boolean))].join(', ') || 'unknown'}`);
  for (const variant of meta.variants ?? [])
    lines.push(`- Version \`${variant.name}\`: ${variant.ref} at ${variant.commit.slice(0, 8)}`);
  lines.push('');

  const header = [
    '| | Passed | Turns (passed runs) | Turns (all runs) | Tool errors | Cost | Minutes |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  lines.push('## By version', '', ...header);
  for (const variant of variants)
    lines.push(row(`\`${variant}\``, summarize(runs.filter((run) => run.variant === variant))));
  lines.push('');

  lines.push('## By task', '', ...header);
  for (const task of tasks) {
    for (const variant of variants) {
      const subset = runs.filter((run) => run.task === task && run.variant === variant);
      if (subset.length) lines.push(row(`${task} · \`${variant}\``, summarize(subset)));
    }
  }
  lines.push('');

  lines.push('## What the agents ran into', '', 'Number of runs in which the agent, at least once:', '');
  lines.push(
    `| | ${variants.map((variant) => `\`${variant}\``).join(' | ')} |`,
    `| --- | ${variants.map(() => '---').join(' | ')} |`
  );
  for (const [key, label] of SIGNALS) {
    const cells = variants.map((variant) => {
      const subset = runs.filter((run) => run.variant === variant);
      return `${subset.filter((run) => run.agent[key] > 0).length}/${subset.length}`;
    });
    lines.push(`| ${label} | ${cells.join(' | ')} |`);
  }
  lines.push('');

  const failures = runs.filter((run) => !run.pass);
  if (failures.length) {
    lines.push('## Failed runs', '');
    for (const run of failures)
      lines.push(
        `- ${run.task} · \`${run.variant}\` · trial ${run.trial}: ${run.reason} (agent: ${run.agent.stopReason})`
      );
    lines.push('');
  }

  lines.push('## Reading this', '');
  lines.push(
    '- Medians. "Passed" counts runs whose script solved the task when the harness re-ran it on a fresh chain with new values.'
  );
  lines.push(
    '- Agent runs vary a lot. With fewer than about 5 trials per cell, treat a difference of one pass or a few turns as noise.'
  );
  lines.push('- Transcripts and each final script are next to this file, one folder per run.');
  lines.push('');

  const report = lines.join('\n');
  writeFileSync(join(directory, 'report.md'), report);
  return report;
}
