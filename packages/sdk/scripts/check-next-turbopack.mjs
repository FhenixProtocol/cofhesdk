#!/usr/bin/env node
/**
 * Smoke: `next build` (Turbopack default) against a minimal app that imports
 * `@cofhe/sdk/web`. Fails if the build hangs past TIMEOUT_MS (regression for #467).
 *
 * Expects packages/sdk to already be built (`pnpm --filter @cofhe/sdk build`).
 */
import { spawn } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sdkRoot = join(__dirname, '..');
const distWeb = join(sdkRoot, 'dist', 'web.js');
const TIMEOUT_MS = Number(process.env.NEXT_TURBOPACK_TIMEOUT_MS || 180_000);

if (!existsSync(distWeb)) {
  console.error(`Missing ${distWeb}. Run: pnpm --filter @cofhe/sdk build`);
  process.exit(1);
}

const distWebSrc = readFileSync(distWeb, 'utf8');
if (!distWebSrc.includes('webpackIgnore')) {
  console.error(
    'dist/web.js is missing webpackIgnore on the tfhe import — rebuild @cofhe/sdk'
  );
  process.exit(1);
}

const root = mkdtempSync(join(tmpdir(), 'cofhe-next-turbo-'));
const appName = 'turborepro';
const app = join(root, appName);

function run(cmd, args, opts = {}) {
  const timeout = opts.timeout ?? TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: opts.cwd ?? root,
      env: process.env,
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out after ${timeout}ms: ${cmd} ${args.join(' ')}`));
    }, timeout);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${cmd} ${args.join(' ')} exited ${code}${signal ? ` signal=${signal}` : ''}`
          )
        );
    });
  });
}

try {
  console.log('smoke root:', root);

  await run(
    'pnpm',
    [
      'dlx',
      'create-next-app@16.0.0',
      appName,
      '--ts',
      '--eslint',
      '--app',
      '--src-dir',
      '--no-tailwind',
      '--turbopack',
      '--use-pnpm',
      '--yes',
      '--disable-git',
      '--empty',
    ],
    { timeout: TIMEOUT_MS }
  );

  await run('pnpm', ['add', `file:${sdkRoot}`, 'viem'], { cwd: app });

  writeFileSync(
    join(app, 'next.config.ts'),
    `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cofhe/sdk"],
};

export default nextConfig;
`
  );

  mkdirSync(join(app, 'src', 'app'), { recursive: true });
  writeFileSync(
    join(app, 'src', 'app', 'cofhe-client.tsx'),
    `"use client";

import { createCofheClient, createCofheConfig } from "@cofhe/sdk/web";

export function CofheClientProbe() {
  void createCofheClient;
  void createCofheConfig;
  return <p>cofhe web import ok</p>;
}
`
  );
  writeFileSync(
    join(app, 'src', 'app', 'page.tsx'),
    `import { CofheClientProbe } from "./cofhe-client";

export default function Home() {
  return (
    <main>
      <h1>cofhe turbopack smoke</h1>
      <CofheClientProbe />
    </main>
  );
}
`
  );

  await run('pnpm', ['exec', 'next', 'build'], { cwd: app, timeout: TIMEOUT_MS });
  console.log('OK: next build (Turbopack) completed with @cofhe/sdk/web import');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  rmSync(root, { recursive: true, force: true });
}
