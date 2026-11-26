// A variant is one version of the @cofhe packages, packed the way npm would publish them.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVAL_HOME, REPO_ROOT, log, runOrThrow } from './util.mjs';

/** The packages the fixture installs, by directory under `packages/`. */
const PACKAGES = {
  sdk: '@cofhe/sdk',
  'mock-contracts': '@cofhe/mock-contracts',
  'hardhat-plugin': '@cofhe/hardhat-plugin',
};

/** The ref that means "the files in this checkout, as they are". */
export const WORKTREE = 'WORKTREE';

const variantDir = (name) => join(EVAL_HOME, 'variants', name);

/** A git ref as a directory name: `feat/x` -> `feat-x`. */
export const variantNameOf = (ref) => (ref === WORKTREE ? 'worktree' : ref.replace(/[^\w.-]+/g, '-'));

/**
 * Packs the @cofhe packages at `ref` into tarballs.
 * @returns {Promise<{ name: string, ref: string, commit: string, tarballs: Record<string, string> }>}
 */
export async function packVariant(ref, { force = false } = {}) {
  const name = variantNameOf(ref);
  const dir = variantDir(name);
  const manifestPath = join(dir, 'variant.json');

  const commit =
    ref === WORKTREE
      ? 'worktree'
      : (await runOrThrow('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: REPO_ROOT })).stdout.trim();

  // A ref is packed once per commit. The checkout itself is repacked every time: its files change.
  if (!force && ref !== WORKTREE && existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.commit === commit) return manifest;
  }

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  let source = REPO_ROOT;
  if (ref !== WORKTREE) {
    source = join(EVAL_HOME, 'sources', name);
    await runOrThrow('git', ['worktree', 'remove', '--force', source], { cwd: REPO_ROOT }).catch(() => {});
    rmSync(source, { recursive: true, force: true });
    log(`${name}: checking out ${ref} (${commit.slice(0, 8)})`);
    await runOrThrow('git', ['worktree', 'add', '--detach', source, commit], { cwd: REPO_ROOT });
    log(`${name}: installing dependencies`);
    await runOrThrow('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], { cwd: source });
  }

  log(`${name}: building ${Object.values(PACKAGES).join(', ')}`);
  const filters = Object.values(PACKAGES).flatMap((packageName) => ['--filter', packageName]);
  await runOrThrow('pnpm', [...filters, 'build'], { cwd: source });

  const tarballs = {};
  for (const [directory, packageName] of Object.entries(PACKAGES)) {
    const before = new Set(readdirSync(dir));
    await runOrThrow('pnpm', ['pack', '--pack-destination', dir], { cwd: join(source, 'packages', directory) });
    const created = readdirSync(dir).find((file) => file.endsWith('.tgz') && !before.has(file));
    if (!created) throw new Error(`pnpm pack produced no tarball for ${packageName}`);
    tarballs[packageName] = join(dir, created);
  }

  const manifest = { name, ref, commit, tarballs };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(`${name}: packed into ${dir}`);
  return manifest;
}
