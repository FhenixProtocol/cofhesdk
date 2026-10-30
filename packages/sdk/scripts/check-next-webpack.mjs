#!/usr/bin/env node
/**
 * Smoke: `next build --webpack` against a minimal app that imports
 * `@cofhe/sdk/web`. Guards the supported Next.js 16 workaround for #467
 * (Turbopack hangs on tfhe's wasm-bindgen-rayon worker graph —
 * vercel/next.js#100131; `webpackIgnore` is not a fix because it leaves a
 * bare `tfhe` specifier that fails at runtime in the browser).
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
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sdkRoot = join(__dirname, '..');
const distWeb = join(sdkRoot, 'dist', 'web.js');
const TIMEOUT_MS = Number(process.env.NEXT_WEBPACK_TIMEOUT_MS || 180_000);

if (!existsSync(distWeb)) {
  console.error(`Missing ${distWeb}. Run: pnpm --filter @cofhe/sdk build`);
  process.exit(1);
}

const root = mkdtempSync(join(tmpdir(), 'cofhe-next-webpack-'));
const appName = 'webrepro';
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
      <h1>cofhe webpack smoke</h1>
      <CofheClientProbe />
    </main>
  );
}
`
  );

  // Turbopack hangs on tfhe (see #467); assert the supported workaround.
  await run('pnpm', ['exec', 'next', 'build', '--webpack'], {
    cwd: app,
    timeout: TIMEOUT_MS,
  });
  console.log('OK: next build --webpack completed with @cofhe/sdk/web import');
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  rmSync(root, { recursive: true, force: true });
}
