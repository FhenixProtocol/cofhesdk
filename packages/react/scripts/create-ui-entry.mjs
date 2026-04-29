import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');
const uiEsmEntry = `import './styles.css';
export * from './ui-base.js';
`;
const uiCjsEntry = `'use strict';
module.exports = require('./ui-base.cjs');
`;

async function writeEntry(fileName, contents) {
  await writeFile(path.join(distDir, fileName), contents, 'utf8');
}

await writeEntry('ui.js', uiEsmEntry);
await writeEntry('ui.cjs', uiCjsEntry);