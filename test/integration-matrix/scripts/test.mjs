#!/usr/bin/env node
import { execSync } from 'node:child_process';

const isCI = process.env.CI === 'true';
const cmd = isCI ? 'pnpm test:all' : 'pnpm test:node';

console.log(`[integration-matrix] Running: ${cmd} (CI=${isCI})`);
execSync(cmd, { stdio: 'inherit', cwd: import.meta.dirname ? undefined : process.cwd() });
