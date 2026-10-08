#!/usr/bin/env node

// The contracts this package takes as-is from cofhe-contracts instead of mocking: the ACP
// share registry, the default revoker and the ACP struct / signature checks they build on.
// They are copied verbatim from one pinned cofhe-contracts commit and must not be edited here;
// mock-specific behaviour goes in separate files (MockPermissioned.sol).
//
//   node scripts/cofhe-contracts.mjs --update <commit>   fetch the files at <commit>, rewrite the manifest
//   node scripts/cofhe-contracts.mjs --update <commit> --from <checkout>
//                                                        the same, read from a local cofhe-contracts clone
//   node scripts/cofhe-contracts.mjs --check             fail if a copy differs from the manifest (offline)
//
// Temporary: once @fhenixprotocol/cofhe-contracts publishes these files, import them from the
// npm package and delete the copies, this script and the manifest.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const REPO = 'FhenixProtocol/cofhe-contracts';
const SOURCE_DIR = 'contracts/internal/host-chain/contracts';
const FILES = ['ACPShareRegistry.sol', 'ACPTimestampRevoker.sol', 'Permissioned.sol'];
const MANIFEST = 'contracts/cofhe-contracts.json';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

async function readSource(commit, name, checkout) {
  if (checkout) {
    return execFileSync('git', ['-C', checkout, 'show', `${commit}:${SOURCE_DIR}/${name}`], { encoding: 'utf8' });
  }
  const url = `https://raw.githubusercontent.com/${REPO}/${commit}/${SOURCE_DIR}/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.text();
}

async function update(commit, checkout) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('--update needs a full 40-character commit hash');
  const files = {};
  for (const name of FILES) {
    const text = await readSource(commit, name, checkout);
    writeFileSync(`contracts/${name}`, text);
    files[name] = sha256(text);
  }
  writeFileSync(MANIFEST, JSON.stringify({ repo: REPO, commit, sourceDir: SOURCE_DIR, files }, null, 2) + '\n');
  console.log(`copied ${FILES.length} files from ${REPO}@${commit}`);
}

function check() {
  const { repo, commit, files } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const changed = Object.entries(files).filter(
    ([name, hash]) => sha256(readFileSync(`contracts/${name}`, 'utf8')) !== hash
  );
  if (changed.length > 0) {
    console.error(
      `These files are copies of ${repo}@${commit} and were edited here: ${changed.map(([name]) => name).join(', ')}.\n` +
        `Change them in cofhe-contracts, then run: node scripts/cofhe-contracts.mjs --update <commit>`
    );
    process.exit(1);
  }
}

const [mode, arg, fromFlag, checkout] = process.argv.slice(2);
if (mode === '--update') await update(arg, fromFlag === '--from' ? checkout : undefined);
else if (mode === '--check') check();
else {
  console.error('usage: cofhe-contracts.mjs --update <commit> [--from <checkout>] | --check');
  process.exit(2);
}
