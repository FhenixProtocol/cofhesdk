import { spawn } from 'node:child_process';

function normalizeUrl(value) {
  const trimmed = value?.trim();

  if (!trimmed) return undefined;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  return withProtocol.replace(/\/+$/, '');
}

function resolveVocsBaseUrl(env) {
  if (env.VOCS_BASE_URL) return normalizeUrl(env.VOCS_BASE_URL);

  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeUrl(env.VERCEL_PROJECT_PRODUCTION_URL);
  }

  if (env.VERCEL_BRANCH_URL) return normalizeUrl(env.VERCEL_BRANCH_URL);
  if (env.VERCEL_URL) return normalizeUrl(env.VERCEL_URL);

  return undefined;
}

const env = { ...process.env };
const vocsBaseUrl = resolveVocsBaseUrl(env);

if (vocsBaseUrl) {
  env.VOCS_BASE_URL = vocsBaseUrl;
  console.error(`[build:docs] VOCS_BASE_URL=${vocsBaseUrl}`);
}

const turboCommand = process.platform === 'win32' ? 'turbo.cmd' : 'turbo';
const child = spawn(turboCommand, ['run', 'build', '--filter=@cofhe/site'], {
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
