#!/usr/bin/env node
/*
Simple circular dependency checker using madge.
Scans key TS entry points in packages and example app.
*/

const path = require('path');

async function main() {
  let madge;
  try {
    madge = require('madge');
  } catch (e) {
    console.error('madge is not installed. Install with: pnpm add -D madge');
    process.exitCode = 1;
    return;
  }

  const root = process.cwd();
  const targets = [
    // packages
    ['packages/sdk', ['core/index.ts']],
    ['packages/react', ['src/index.ts']],
    ['packages/mock-contracts', ['src/index.ts']],
    ['packages/hardhat-plugin', ['src/index.ts']],
    // example app
    ['examples/react', ['src/main.tsx', 'src/App.tsx']],
  ];

  const failures = [];

  for (const [pkg, entries] of targets) {
    for (const entry of entries) {
      const abs = path.join(root, pkg, entry);
      try {
        const res = await madge(abs, {
          fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
          tsConfig: path.join(root, 'packages/sdk/tsconfig.json'),
          includeNpm: false,
          baseDir: path.dirname(abs),
        });
        const circular = res.circular();
        if (circular.length) {
          failures.push({ pkg, entry: abs, circular });
          console.log(`\n[!] Circular dependencies detected in ${pkg}:${entry}`);
          circular.forEach((cycle, i) => {
            console.log(`  Cycle #${i + 1}: ${cycle.join(' -> ')}`);
          });
        } else {
          console.log(`[ok] No circles in ${pkg}:${entry}`);
        }
      } catch (err) {
        console.log(`[-] Skipping ${pkg}:${entry} (error reading):`, err.message);
      }
    }
  }

  if (failures.length) {
    console.error(`\nFound ${failures.length} target(s) with circular dependencies.`);
    process.exitCode = 1;
  } else {
    console.log('\nNo circular dependencies found in scanned targets.');
  }
}

main();
