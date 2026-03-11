#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

const WORKSPACE_ROOT = process.cwd();
const PKG_DIR = path.join(WORKSPACE_ROOT, 'packages', 'hardhat-plugin-test');
const TEST_GLOB_PREFIX = 'integration-';
const TEST_GLOB_SUFFIX = '.test.ts';

function usage(exitCode = 0) {
  const msg = [
    'Usage:',
    '  node scripts/integration-tests.mjs --list',
    '  node scripts/integration-tests.mjs --pick',
    '  node scripts/integration-tests.mjs --substring <text>',
    '',
    'Notes:',
    '  - Discovers tests from packages/hardhat-plugin-test/test/integration-*.test.ts',
    '  - Runs via: pnpm -C packages/hardhat-plugin-test test:integration -- --grep <title>',
  ].join('\n');
  // eslint-disable-next-line no-console
  console.log(msg);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { list: false, pick: false, substring: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--pick') args.pick = true;
    else if (a === '--substring') {
      const value = argv[i + 1];
      if (!value) usage(1);
      args.substring = value;
      i++;
    } else if (a === '--help' || a === '-h') {
      usage(0);
    } else {
      // unknown arg
      usage(1);
    }
  }

  const modeCount = Number(args.list) + Number(args.pick) + Number(Boolean(args.substring));
  if (modeCount !== 1) usage(1);
  return args;
}

function isProbablyIntegrationTestFile(fileName) {
  return fileName.startsWith(TEST_GLOB_PREFIX) && fileName.endsWith(TEST_GLOB_SUFFIX) && !fileName.includes(path.sep);
}

async function discoverIntegrationTestFiles() {
  const testDir = path.join(PKG_DIR, 'test');
  const entries = await fs.readdir(testDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && isProbablyIntegrationTestFile(e.name))
    .map((e) => path.join(testDir, e.name))
    .sort();
  return files;
}

function extractFirstStringLiteral(source, startIndex) {
  // Finds the first JS string literal starting at/after startIndex.
  // Supports '"', "'" and template literals without ${} expressions.
  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch !== '"' && ch !== "'" && ch !== '`') continue;

    const quote = ch;
    let value = '';
    let j = i + 1;
    while (j < source.length) {
      const c = source[j];
      if (c === '\\') {
        const next = source[j + 1];
        if (next === undefined) break;
        // Keep escape sequences readable; we don’t need to fully unescape.
        value += next;
        j += 2;
        continue;
      }

      if (quote === '`' && c === '$' && source[j + 1] === '{') {
        // Template expression: skip this literal (too hard to evaluate statically)
        value = null;
        break;
      }

      if (c === quote) {
        return { value, endIndex: j + 1 };
      }

      value += c;
      j++;
    }
  }

  return null;
}

function findIntegrationIts(source) {
  const results = [];

  // Recognize: it(...), it.only(...), it.skip(...)
  // We’ll parse the first argument if it’s a literal.
  const re = /\bit\s*(?:\.\s*(only|skip))?\s*\(/g;

  for (let match = re.exec(source); match; match = re.exec(source)) {
    const mode = match[1] ?? 'normal';
    const openParenIndex = re.lastIndex - 1;

    const literal = extractFirstStringLiteral(source, openParenIndex + 1);
    if (!literal || literal.value == null) continue;

    const title = literal.value.trim();
    if (!title) continue;

    results.push({ title, mode });
  }

  return results;
}

async function listIntegrationTests() {
  const files = await discoverIntegrationTestFiles();
  if (files.length === 0) {
    throw new Error('No integration test files found at packages/hardhat-plugin-test/test/integration-*.test.ts');
  }

  const all = [];
  for (const file of files) {
    const src = await fs.readFile(file, 'utf8');
    const its = findIntegrationIts(src);
    for (const it of its) {
      all.push({ file, ...it });
    }
  }

  return all;
}

function formatTestEntry(entry, index) {
  const relFile = path.relative(WORKSPACE_ROOT, entry.file);
  const modeTag = entry.mode === 'skip' ? ' [skip]' : entry.mode === 'only' ? ' [only]' : '';
  return `${String(index + 1).padStart(3, ' ')}. ${entry.title}${modeTag}  —  ${relFile}`;
}

async function runIntegrationTestByTitle(title) {
  const args = ['-C', 'packages/hardhat-plugin-test', 'test:integration', '--grep', title];

  await new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, {
      cwd: WORKSPACE_ROOT,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Integration test run failed (exit ${code})`));
    });
  });
}

function findFirstMatch(tests, substring) {
  const needle = substring.toLowerCase();
  return tests.find((t) => t.title.toLowerCase().includes(needle));
}

async function pickAndRun(tests) {
  // eslint-disable-next-line no-console
  console.log('Integration tests:\n');
  tests.forEach((t, idx) => {
    // eslint-disable-next-line no-console
    console.log(formatTestEntry(t, idx));
  });

  // eslint-disable-next-line no-console
  console.log('\nPick one: enter a number (e.g. 3) OR a substring to match (e.g. decryptForTx).');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question('> ')).trim();
    if (!answer) throw new Error('No selection provided');

    const asNumber = Number(answer);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= tests.length) {
      const chosen = tests[asNumber - 1];
      // eslint-disable-next-line no-console
      console.log(`\nRunning: ${chosen.title}\n`);
      await runIntegrationTestByTitle(chosen.title);
      return;
    }

    const match = findFirstMatch(tests, answer);
    if (!match) {
      throw new Error(`No test title matched substring: ${answer}`);
    }

    // eslint-disable-next-line no-console
    console.log(`\nRunning first match: ${match.title}\n`);
    await runIntegrationTestByTitle(match.title);
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const tests = await listIntegrationTests();
  // Keep output stable.
  tests.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.title.localeCompare(b.title);
  });

  if (args.list) {
    tests.forEach((t, idx) => {
      // eslint-disable-next-line no-console
      console.log(formatTestEntry(t, idx));
    });
    return;
  }

  if (args.pick) {
    await pickAndRun(tests);
    return;
  }

  if (args.substring != null) {
    const match = findFirstMatch(tests, args.substring);
    if (!match) {
      // eslint-disable-next-line no-console
      console.error(`No integration test matched: ${args.substring}`);
      // eslint-disable-next-line no-console
      console.error('Tip: run with --list to see all available tests.');
      process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.log(`Running first match: ${match.title}`);
    await runIntegrationTestByTitle(match.title);
    return;
  }

  usage(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exit(1);
});
