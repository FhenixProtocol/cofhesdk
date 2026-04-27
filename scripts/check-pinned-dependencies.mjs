import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies'];
const ignoredDirs = new Set(['.git', 'node_modules', '.turbo', 'dist', 'build', 'coverage']);
const exactVersionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
const exactNpmAliasPattern = /^npm:[^@]+@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
const commitPinnedGithubPattern = /^github:[^/\s]+\/[^#\s]+#[0-9a-f]{7,40}$/iu;
const commitPinnedGitUrlPattern = /^git\+.+#[0-9a-f]{7,40}$/iu;
const tarballUrlPattern = /^https?:\/\//iu;

const violations = [];

function isAllowedSpecifier(specifier) {
  if (
    specifier.startsWith('workspace:') ||
    specifier.startsWith('file:') ||
    specifier.startsWith('link:') ||
    tarballUrlPattern.test(specifier)
  ) {
    return true;
  }

  if (exactVersionPattern.test(specifier)) {
    return true;
  }

  if (exactNpmAliasPattern.test(specifier)) {
    return true;
  }

  if (commitPinnedGithubPattern.test(specifier) || commitPinnedGitUrlPattern.test(specifier)) {
    return true;
  }

  return false;
}

function collectPackageJsonFiles(dirPath, results) {
  for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      if (ignoredDirs.has(dirent.name)) {
        continue;
      }

      collectPackageJsonFiles(path.join(dirPath, dirent.name), results);
      continue;
    }

    if (dirent.name === 'package.json') {
      results.push(path.join(dirPath, dirent.name));
    }
  }
}

const packageJsonFiles = [];
collectPackageJsonFiles(rootDir, packageJsonFiles);

for (const filePath of packageJsonFiles) {
  const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const section of dependencySections) {
    const dependencies = packageJson[section];
    if (!dependencies) {
      continue;
    }

    for (const [name, specifier] of Object.entries(dependencies)) {
      if (typeof specifier !== 'string') {
        violations.push({
          filePath,
          section,
          name,
          specifier: String(specifier),
          reason: 'dependency specifier must be a string',
        });
        continue;
      }

      if (!isAllowedSpecifier(specifier)) {
        violations.push({
          filePath,
          section,
          name,
          specifier,
          reason: 'must be exact, workspace/file/link, tarball URL, or a git/github dependency pinned to a commit SHA',
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Found unpinned direct dependency specifiers:');

  for (const violation of violations) {
    const relativePath = path.relative(rootDir, violation.filePath);
    console.error(
      `- ${relativePath} :: ${violation.section}.${violation.name} = ${JSON.stringify(violation.specifier)} (${violation.reason})`
    );
  }

  process.exit(1);
}

console.log(`Validated ${packageJsonFiles.length} package.json files: all direct dependency specifiers are pinned.`);
