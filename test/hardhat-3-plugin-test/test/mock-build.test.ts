import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import hre from 'hardhat';

const require = createRequire(import.meta.url);
const mockContractsDir = path.join(path.dirname(require.resolve('@cofhe/mock-contracts/package.json')), 'contracts');
const mockFiles = fs.readdirSync(mockContractsDir).filter((file) => file.endsWith('.sol'));

describe('Mock contract build', () => {
  it('a full build includes the mock contracts, so it keeps their artifacts', async () => {
    const rootFilePaths = await hre.solidity.getRootFilePaths();

    assert.ok(mockFiles.length > 0);
    for (const file of mockFiles) {
      assert.ok(rootFilePaths.includes(`npm:@cofhe/mock-contracts/contracts/${file}`), file);
    }
  });
});
