import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Records every name this package exports, per entry point, in `exports.snap.txt`.
 *
 * An export is a promise to outside users, so adding or removing one should be a decision someone
 * sees in review. When this test fails, check that the change to the public surface is intended,
 * then update the file with `pnpm vitest run api-surface -u`.
 *
 * The names are read with the TypeScript compiler, without running the entries: types are exports
 * too, and the `web` and `node` entries load WASM when run.
 */

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Entry point in `package.json` `exports` -> its source file. Must match `tsup.config.ts`. */
const ENTRY_SOURCES: Record<string, string> = {
  '.': 'core/index.ts',
  './adapters': 'adapters/index.ts',
  './chains': 'chains/index.ts',
  './acps': 'acps/index.ts',
  './node': 'node/index.ts',
  './web': 'web/index.ts',
};

function listExports(): string {
  const configPath = resolve(packageRoot, 'tsconfig.json');
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  if (!parsed) throw new Error(`Could not read ${configPath}`);

  const entryFiles = Object.values(ENTRY_SOURCES).map((file) => resolve(packageRoot, file));
  const program = ts.createProgram({ rootNames: entryFiles, options: parsed.options });
  const checker = program.getTypeChecker();

  const sections = Object.entries(ENTRY_SOURCES).map(([entry, file]) => {
    const sourceFile = program.getSourceFile(resolve(packageRoot, file));
    const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) throw new Error(`No exports found in ${file}`);

    const lines = checker.getExportsOfModule(moduleSymbol).map((exported) => {
      const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      // A class or an enum is both a type and a value: it is listed as a value.
      const isValue = (target.flags & ts.SymbolFlags.Value) !== 0;
      return `${isValue ? 'value' : 'type '} ${exported.getName()}`;
    });
    lines.sort((a, b) => a.slice(6).localeCompare(b.slice(6), 'en') || a.localeCompare(b, 'en'));

    const specifier = entry === '.' ? '@cofhe/sdk' : `@cofhe/sdk/${entry.slice(2)}`;
    return [`## ${specifier} (${file})`, ...lines].join('\n');
  });

  return sections.join('\n\n') + '\n';
}

describe('public exports', () => {
  it('covers every entry point in package.json', () => {
    const pkg = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(ENTRY_SOURCES).sort()).toEqual(Object.keys(pkg.exports).sort());
  });

  it('match the recorded list', async () => {
    await expect(listExports()).toMatchFileSnapshot('./exports.snap.txt');
  }, 120_000);
});
