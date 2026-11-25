import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CofheError, CofheErrorCode } from '../error';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const GUIDE_FILE = 'skills/cofhe-errors/SKILL.md';
const guide = readFileSync(`${packageRoot}${GUIDE_FILE}`, 'utf8');

/** Anchors as GitHub and most Markdown renderers derive them from a heading. */
const anchorOf = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

const headings = [...guide.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1].trim());
const codeSections = [...guide.matchAll(/^### ([A-Z0-9_]+)$/gm)].map((match) => match[1]);
const codes = Object.values(CofheErrorCode) as string[];

describe('error repair guide', () => {
  it('has exactly one section per CofheErrorCode', () => {
    expect([...codeSections].sort()).toEqual([...codes].sort());
  });

  it.each(codes)('%s: the error points at its own section', (code) => {
    const error = new CofheError({ code: code as CofheErrorCode, message: 'Boom' });
    const [file, anchor] = error.repairGuide.split('#');

    expect(file).toBe(`node_modules/@cofhe/sdk/${GUIDE_FILE}`);
    expect(headings.map(anchorOf)).toContain(anchor);
    expect(error.message).toBe(`Boom | Guide: ${error.repairGuide}`);
  });

  it('has no dead links between its sections', () => {
    const anchors = new Set(headings.map(anchorOf));
    const links = [...guide.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1]);

    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((link) => !anchors.has(link))).toEqual([]);
  });

  it('is published with the package', () => {
    const { files } = JSON.parse(readFileSync(`${packageRoot}package.json`, 'utf8'));

    expect(files).toContain('skills/**');
  });

  it('is named in toString() and serialize()', () => {
    const error = new CofheError({ code: CofheErrorCode.ACPNotFound, message: 'No active ACP' });
    const path = 'node_modules/@cofhe/sdk/skills/cofhe-errors/SKILL.md#acp_not_found';

    expect(error.repairGuide).toBe(path);
    expect(error.toString()).toContain(`Guide: ${path}`);
    expect(JSON.parse(error.serialize()).repairGuide).toBe(path);
  });
});
