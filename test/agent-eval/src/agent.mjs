// Runs one coding agent in a workspace and reduces its transcript to numbers.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';

/** The tools the agent gets: a shell and files. No web, no subagents. */
const TOOLS = ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'];

/**
 * Things worth counting in what the agent ran into and opened. They say where a version helped: an
 * agent that reads the shipped guide, or stops hitting a particular compiler error.
 *
 * The "ran into" patterns match what a failing command prints, not the word itself: the README and
 * the type declarations mention `CofheError` too, and reading them is not hitting one.
 */
const RAN_INTO = {
  sawCofheError: (text) => /CofheError: |CofheError \[[A-Z_]+\]|code: '[A-Z][A-Z_]+'/.test(text),
  sawTypeError: (text) => /error TS\d+/.test(text),
  sawModuleError: (text) =>
    /has no exported member|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_MODULE_NOT_FOUND|Cannot find module|WRONG_ENTRYPOINT/.test(
      text
    ),
};
/**
 * What the agent opened. The docs are recognised by lines of their content, not by the command:
 * agents `cd` into the package first, `cat README.md 2>/dev/null` on a version without a README
 * opens nothing, and `sed -n 20,120p README.md` skips the title. Any one heading is enough. Update
 * the lists if those headings are reworded.
 */
const README_HEADINGS = [
  'Client SDK for the Fhenix CoFHE coprocessor',
  '## Which entrypoint',
  '## Encrypt inputs and send them to a contract',
  '## Decrypt for display',
  '## Decrypt to publish on chain',
  '## Two call forms',
];
const ERROR_GUIDE_HEADINGS = [
  '# Fixing a CofheError',
  '## Read the error first',
  '## Setup and config',
  '## Encrypting inputs',
  '## Decrypting',
];

const OPENED_BY_CONTENT = {
  openedReadme: (text) => README_HEADINGS.some((heading) => text.includes(heading)),
  openedErrorGuide: (text) => ERROR_GUIDE_HEADINGS.some((heading) => text.includes(heading)),
};
const OPENED_BY_COMMAND = {
  openedTypes: (input) => /\.d\.(ts|mts|cts)/.test(input),
  openedSource: (input) =>
    /@cofhe\/sdk/.test(input) &&
    /\b(core|node|web|acps|chains|adapters)\/[\w/.*-]*\.ts\b/.test(input.replace(/\.d\.ts/g, '')),
};
const SIGNAL_KEYS = [...Object.keys(RAN_INTO), ...Object.keys(OPENED_BY_CONTENT), ...Object.keys(OPENED_BY_COMMAND)];

/** A tool call that only reads documentation or declarations: its output is not something that happened. */
const isReadingDocs = (input) => /README\.md|SKILL\.md|CHANGELOG\.md|\.d\.(ts|mts|cts)/.test(input);

/**
 * Reduces a stream of CLI events to the metrics of a run. Also used to re-score a saved transcript.
 */
export function createTranscriptReader() {
  const metrics = {
    finished: false,
    stopReason: 'unknown',
    turns: undefined,
    toolCalls: 0,
    toolErrors: 0,
    costUsd: undefined,
    durationMs: undefined,
    model: undefined,
    ...Object.fromEntries(SIGNAL_KEYS.map((key) => [key, 0])),
  };

  const docReads = new Set();

  const onEvent = (event) => {
    if (event.type === 'system' && event.subtype === 'init') metrics.model = event.model;

    if (event.type === 'assistant') {
      for (const block of event.message?.content ?? []) {
        if (block.type !== 'tool_use') continue;
        metrics.toolCalls += 1;
        const input = JSON.stringify(block.input ?? {});
        if (isReadingDocs(input)) docReads.add(block.id);
        for (const [key, test] of Object.entries(OPENED_BY_COMMAND)) if (test(input)) metrics[key] += 1;
      }
    }

    if (event.type === 'user') {
      for (const block of Array.isArray(event.message?.content) ? event.message.content : []) {
        if (block.type !== 'tool_result') continue;
        if (block.is_error) metrics.toolErrors += 1;
        const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '');
        for (const [key, test] of Object.entries(OPENED_BY_CONTENT)) if (test(text)) metrics[key] += 1;
        if (docReads.has(block.tool_use_id)) continue;
        for (const [key, test] of Object.entries(RAN_INTO)) if (test(text)) metrics[key] += 1;
      }
    }

    if (event.type === 'result') {
      metrics.finished = event.subtype === 'success' && !event.is_error;
      metrics.stopReason = event.subtype ?? 'unknown';
      metrics.turns = event.num_turns;
      metrics.costUsd = event.total_cost_usd;
      metrics.durationMs = event.duration_ms;
    }
  };

  return { metrics, onEvent };
}

/**
 * @returns {Promise<object>} the metrics of the run. `finished` is false when the agent was cut off
 * (budget, timeout) or the CLI failed; the workspace is still checked either way.
 */
export function runAgent({ cwd, prompt, transcriptPath, model, maxBudgetUsd, timeoutMs }) {
  const args = [
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    // Cold start: none of this machine's user settings, memory, skills or MCP servers.
    '--setting-sources',
    'project',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--tools',
    TOOLS.join(','),
    '--allowedTools',
    TOOLS.join(','),
    '--permission-mode',
    'dontAsk',
    '--max-budget-usd',
    String(maxBudgetUsd),
  ];
  if (model) args.push('--model', model);

  // A run started from inside a Claude Code session must not inherit that session's identity.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(CLAUDECODE$|CLAUDE_CODE_|CLAUDE_AGENT_)/.test(key))
  );

  return new Promise((resolve) => {
    const child = spawn('claude', args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const transcript = createWriteStream(transcriptPath);

    const { metrics, onEvent } = createTranscriptReader();

    let buffer = '';
    child.stdout.on('data', (chunk) => {
      transcript.write(chunk);
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          onEvent(JSON.parse(line));
        } catch {
          // not an event line
        }
      }
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr = (stderr + chunk).slice(-2000)));

    const timer = setTimeout(() => {
      metrics.stopReason = 'timeout';
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      transcript.end();
      resolve({ ...metrics, stopReason: 'spawn_failed', error: String(error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      transcript.end();
      if (code !== 0 && metrics.stopReason === 'unknown') metrics.stopReason = `cli_exit_${code}`;
      resolve(stderr && !metrics.finished ? { ...metrics, error: stderr.trim() } : metrics);
    });

    child.stdin.end(prompt);
  });
}
