import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pkgPath = resolve(__dirname, '../package.json');
const outPath = resolve(__dirname, '../core/version.ts');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const name = typeof pkg?.name === 'string' ? pkg.name : '@cofhe/sdk';
const version = typeof pkg?.version === 'string' ? pkg.version : '0.0.0';

console.log(`Generating version.ts with name=${name} and version=${version}`);
const contents = `export const SDK_NAME = ${JSON.stringify(name)};\nexport const SDK_VERSION = ${JSON.stringify(version)};\n`;

writeFileSync(outPath, contents);
